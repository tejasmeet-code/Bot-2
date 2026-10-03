import { type Guild } from "discord.js";
import { isGuildPremium } from "../storage/premium";
import { logger } from "../../lib/logger";
import fs from "fs";
import path from "path";

export const GOLDEN_ZENITH_AVATAR_URL =
  "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=800&auto=format&fit=crop";

let cachedGoldenAvatarBase64 = "";

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
  if (!guild) return;
  try {
    const isPremium = await isGuildPremium(guild.id);
    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!me) return;

    if (isPremium) {
      // 1. Set Per-Server Nickname to "Zenith Prime" (Clean, Premium, No Suffix)
      if (me.nickname !== "Zenith Prime") {
        await me.setNickname("Zenith Prime").catch((err) => {
          logger.debug({ err: err?.message, guildId: guild.id }, "Guild nickname update warning");
        });
      }

      // 2. Set Per-Server Guild Avatar to Golden Version if possible
      // (This requires Nitro for the bot, but we keep the logic ready)
      const goldenBase64 = await getGoldenAvatarBase64();
      if (goldenBase64) {
        try {
          // Check if we already have the golden avatar set to avoid spamming API
          // me.displayAvatarURL() might not be enough to check if it's the SAME golden one
          // but we can try to skip if it looks like it's already set
          await (me as any).setAvatar(goldenBase64);
        } catch {}
      }
    } else {
      // Non-premium server: Reset to default "Zenith Bot"
      if (me.nickname && me.nickname !== "Zenith Bot") {
        await me.setNickname("Zenith Bot").catch(() => {});
      }
    }
  } catch (err: any) {
    logger.debug({ err: err?.message, guildId: guild.id }, "Error applying server premium branding");
  }
}
