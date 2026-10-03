import { type Guild, REST, Routes } from "discord.js";
import { isGuildPremium } from "../storage/premium";
import { getGuildConfig } from "../storage/config";
import { logger } from "../../lib/logger";
import fs from "fs";
import path from "path";

export const GOLDEN_ZENITH_AVATAR_URL =
  "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=800&auto=format&fit=crop";

let cachedGoldenAvatarBase64 = "";
const appliedGuildBranding = new Map<string, { isPremium: boolean; timestamp: number }>();

export async function getGoldenAvatarBase64(): Promise<string | null> {
  if (cachedGoldenAvatarBase64) return cachedGoldenAvatarBase64;

  // 1. Check local asset files first (Instant 3D Metallic Gold Z Icon)
  const localPaths = [
    path.resolve(process.cwd(), "artifacts/api-server/src/assets/golden-zenith-avatar.png"),
    path.resolve(process.cwd(), "artifacts/api-server/public/golden-zenith-avatar.png"),
    path.resolve(process.cwd(), "dist/golden-zenith-avatar.png"),
    path.resolve(process.cwd(), "public/golden-zenith-avatar.png"),
  ];

  for (const lp of localPaths) {
    if (fs.existsSync(lp)) {
      try {
        const buf = fs.readFileSync(lp);
        cachedGoldenAvatarBase64 = `data:image/png;base64,${buf.toString("base64")}`;
        return cachedGoldenAvatarBase64;
      } catch {}
    }
  }

  // 2. Network Fallback
  try {
    const res = await fetch(GOLDEN_ZENITH_AVATAR_URL);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      cachedGoldenAvatarBase64 = `data:image/png;base64,${buf.toString("base64")}`;
      return cachedGoldenAvatarBase64;
    }
  } catch (err: any) {
    logger.debug({ err: err?.message }, "Failed to convert golden avatar to base64");
  }
  return null;
}

export async function applyServerPremiumBranding(guild: Guild): Promise<void> {
  if (!guild || !guild.id) return;
  try {
    const isPremium = await isGuildPremium(guild.id, guild);
    const lastState = appliedGuildBranding.get(guild.id);
    const now = Date.now();

    // Cache guard: Don't re-execute more than once every 5 minutes if state hasn't changed
    if (lastState && lastState.isPremium === isPremium && now - lastState.timestamp < 5 * 60 * 1000) {
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!me) return;

    const token = process.env.DISCORD_BOT_TOKEN?.trim() || process.env.DISCORD_TOKEN?.trim();
    const cfg = await getGuildConfig(guild.id).catch(() => ({}) as any);
    const customProfile = cfg?.customBotProfile;

    if (isPremium) {
      // 1. Set Per-Server Nickname to "Zenith Prime" (unless custom name configured)
      const targetName = customProfile?.name || "Zenith Prime";
      if (me.nickname !== targetName) {
        await me.setNickname(targetName).catch((err) => {
          logger.debug({ err: err?.message, guildId: guild.id }, "Guild nickname update warning");
        });
      }

      // 2. Set Per-Server Guild Avatar to Golden 3D Z Version
      const goldenBase64 = await getGoldenAvatarBase64();
      if (goldenBase64 && !customProfile?.avatarUrl) {
        let avatarApplied = false;

        // Method A: Discord.js GuildMember.edit
        try {
          if (typeof (me as any).edit === "function") {
            await (me as any).edit({ avatar: goldenBase64 });
            avatarApplied = true;
          }
        } catch (editErr: any) {
          logger.debug({ err: editErr?.message, guildId: guild.id }, "GuildMember.edit avatar attempt");
        }

        // Method B: Direct Discord REST API PATCH /guilds/{guild.id}/members/@me
        if (!avatarApplied && token) {
          try {
            const rest = new REST({ version: "10" }).setToken(token);
            await rest.patch(Routes.guildMember(guild.id, "@me"), {
              body: {
                avatar: goldenBase64,
                nick: targetName,
              },
            });
            avatarApplied = true;
          } catch (restErr: any) {
            logger.debug({ err: restErr?.message, guildId: guild.id }, "REST guildMember @me avatar attempt");
          }
        }
      }

      appliedGuildBranding.set(guild.id, { isPremium: true, timestamp: now });
    } else {
      // Non-premium server: Reset to default "Zenith Bot" unless custom name set
      if (!customProfile?.name && me.nickname && me.nickname !== "Zenith Bot") {
        await me.setNickname("Zenith Bot").catch(() => {});
      }
      appliedGuildBranding.set(guild.id, { isPremium: false, timestamp: now });
    }
  } catch (err: any) {
    logger.debug({ err: err?.message, guildId: guild.id }, "Error applying server premium branding");
  }
}
