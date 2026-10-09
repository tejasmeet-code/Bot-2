import { type GuildMember } from "discord.js";
import { logger } from "../../lib/logger";

interface RaidState {
  joinTimestamps: number[];
}

const raidStates = new Map<string, RaidState>();

/**
 * Record a member join and return the number of joins in the last window.
 */
export function recordRaidJoin(guildId: string, windowSeconds: number = 15): number {
  const now = Date.now();
  const state = raidStates.get(guildId) || { joinTimestamps: [] };
  
  // Filter out timestamps outside the window
  state.joinTimestamps = state.joinTimestamps.filter(t => now - t < windowSeconds * 1000);
  state.joinTimestamps.push(now);
  
  raidStates.set(guildId, state);
  return state.joinTimestamps.length;
}

/**
 * Handle a detected raid burst.
 */
export async function handleRaidBurst(member: GuildMember, config: { action: string, muteDurationMinutes: number, strictMode: boolean }) {
  const { action, muteDurationMinutes, strictMode } = config;
  const reason = "Automated Anti-Raid Defense triggered";
  
  try {
    // If strict mode is on, check account age
    if (strictMode) {
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
      if (accountAgeDays < 7) {
        // New accounts get banned/kicked immediately during a raid in strict mode
        if (action === "ban") {
          await member.ban({ reason: `${reason} (Strict Mode: New Account)` }).catch(() => {});
          return;
        } else {
          await member.kick(`${reason} (Strict Mode: New Account)`).catch(() => {});
          return;
        }
      }
    }

    if (action === "ban") {
      await member.ban({ reason }).catch(() => {});
    } else if (action === "kick") {
      await member.kick(reason).catch(() => {});
    } else if (action === "mute") {
      await member.timeout(muteDurationMinutes * 60_000, reason).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, guildId: member.guild.id, userId: member.id }, "Error executing raid burst action");
  }
}
