import { type Guild, REST, Routes } from "discord.js";
import { isGuildPremium } from "../storage/premium";
import { getGuildConfig } from "../storage/config";
import { logger } from "../../lib/logger";
import fs from "fs";
import path from "path";

export const GOLDEN_ZENITH_AVATAR_URL =
  "https://cdn.discordapp.com/guilds/1510975690068070501/users/1553292201835102278/avatars/274193e40f2448dc4e31a032cf54f5ec.png";
export const NORMAL_ZENITH_AVATAR_URL =
  "https://cdn.discordapp.com/emojis/1555133589581070416.png";

let cachedGoldenAvatarBase64 = "";
let cachedNormalAvatarBase64 = "";
const appliedGuildBranding = new Map<string, { isPremium: boolean; timestamp: number }>();

export async function getNormalAvatarBase64(): Promise<string | null> {
  if (cachedNormalAvatarBase64) return cachedNormalAvatarBase64;
  try {
    const res = await fetch(NORMAL_ZENITH_AVATAR_URL);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      cachedNormalAvatarBase64 = `data:image/png;base64,${buf.toString("base64")}`;
      return cachedNormalAvatarBase64;
    }
  } catch (err: any) {
    logger.debug({ err: err?.message }, "Failed to convert normal avatar to base64");
  }
  return null;
}

export async function syncGlobalNormalAvatar(client: any): Promise<void> {
  try {
    const res = await fetch(NORMAL_ZENITH_AVATAR_URL);
    if (res.ok && client?.user) {
      const buf = Buffer.from(await res.arrayBuffer());
      await client.user.setAvatar(buf).catch((err: any) => {
        logger.debug({ err: err?.message }, "Global avatar setAvatar note");
      });
      logger.info("Successfully synced global bot avatar to standard clean Zenith Bot logo");
    }
  } catch (err: any) {
    logger.debug({ err: err?.message }, "syncGlobalNormalAvatar warning");
  }
}
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

export async function applyServerPremiumBranding(guild: Guild, force: boolean = false): Promise<void> {
  if (!guild || !guild.id) return;
  try {
    const isPremium = await isGuildPremium(guild.id, guild);
    const lastState = appliedGuildBranding.get(guild.id);
    const now = Date.now();

    // Cache guard: Don't re-execute more than once every 5 minutes if state hasn't changed unless forced
    if (!force && lastState && lastState.isPremium === isPremium && now - lastState.timestamp < 5 * 60 * 1000) {
      return;
    }

    const token = process.env.DISCORD_BOT_TOKEN?.trim() || process.env.DISCORD_TOKEN?.trim();
    if (!token) return;

    const cfg = await getGuildConfig(guild.id).catch(() => ({}) as any);
    const customProfile = cfg?.customBotProfile;
    const rest = new REST({ version: "10" }).setToken(token);

    if (isPremium) {
      const targetName = customProfile?.name || "Zenith Prime";
      const goldenBase64 = await getGoldenAvatarBase64();
      const targetAvatar = customProfile?.avatarUrl || goldenBase64 || null;

      await rest.patch(Routes.guildMember(guild.id, "@me"), {
        body: {
          nick: targetName,
          avatar: targetAvatar,
        },
      }).catch((err: any) => {
        logger.debug({ err: err?.message, guildId: guild.id }, "REST guildMember @me premium avatar attempt");
      });

      appliedGuildBranding.set(guild.id, { isPremium: true, timestamp: now });
    } else {
      const defaultNick = customProfile?.name || "Zenith Bot";

      await rest.patch(Routes.guildMember(guild.id, "@me"), {
        body: {
          nick: defaultNick,
          avatar: null,
        },
      }).catch((err: any) => {
        logger.debug({ err: err?.message, guildId: guild.id }, "REST guildMember @me non-premium reset attempt");
      });

      appliedGuildBranding.set(guild.id, { isPremium: false, timestamp: now });
    }
  } catch (err: any) {
    logger.debug({ err: err?.message, guildId: guild.id }, "Error applying server premium branding");
  }
}
