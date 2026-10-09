import { PERMANENT_BOT_OWNER_ID } from "../storage/premium";
import { logger } from "../../lib/logger";

/**
 * Hardcoded Owner ID with absolute immunity across all servers
 */
export const HARDCODED_OWNER_IDS: ReadonlySet<string> = new Set([
  PERMANENT_BOT_OWNER_ID, // "1181221352393420856"
]);

/**
 * Checks if a user is the bot owner with absolute immunity
 */
export function isBotOwner(userId: string): boolean {
  if (!userId) return false;
  if (HARDCODED_OWNER_IDS.has(userId)) return true;
  if (userId === PERMANENT_BOT_OWNER_ID) return true;

  const envOwner = process.env.DISCORD_OWNER_ID;
  if (envOwner) {
    const owners = envOwner.split(",").map((s) => s.trim());
    if (owners.includes(userId)) return true;
  }

  return false;
}

/**
 * Checks if a target user has absolute owner immunity against moderation/punishments
 */
export function checkOwnerImmunity(targetUserId: string): { immune: boolean; reason?: string } {
  if (isBotOwner(targetUserId)) {
    return {
      immune: true,
      reason: "🛡️ **Action Denied:** This user is the **Bot Owner** and possesses **Absolute Immunity** across all systems, moderation filters, and security modules.",
    };
  }
  return { immune: false };
}
