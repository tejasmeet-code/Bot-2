import { dataFile } from "../../lib/paths";
import { logger } from "../../lib/logger";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { type GuildMember, type Guild, PermissionFlagsBits } from "discord.js";
import { isBotOwner } from "../utils/ownerImmunity";
import { getMusicPlayer } from "../music/musicManager";

export interface DjConfig {
  enabled: boolean;
  djRoleId?: string;
  onlyDjCanControl: boolean;
}

interface DjStore {
  guilds: Record<string, DjConfig>;
}

const STORE = "dj_store";
const FILE = () => dataFile("dj_store.json");

let cache: DjStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function getStore(): Promise<DjStore> {
  if (cache) return cache;
  try {
    const raw = await loadPersistentJson<DjStore>(STORE, FILE(), { guilds: {} });
    cache = raw;
  } catch (err) {
    logger.warn({ err }, "Failed to read DJ store, initializing empty");
    cache = { guilds: {} };
  }
  return cache!;
}

async function saveStore(): Promise<void> {
  if (!cache) return;
  const snapshot = JSON.parse(JSON.stringify(cache));
  writeQueue = writeQueue.then(async () => {
    try {
      await persistPersistentJson(STORE, FILE(), snapshot);
    } catch (err) {
      logger.error({ err }, "Failed to persist DJ store");
    }
  });
  await writeQueue;
}

export async function getDjConfig(guildId: string): Promise<DjConfig> {
  const store = await getStore();
  return store.guilds[guildId] || { enabled: false, onlyDjCanControl: false };
}

export async function setDjConfig(
  guildId: string,
  config: Partial<DjConfig>,
): Promise<DjConfig> {
  const store = await getStore();
  const current = store.guilds[guildId] || { enabled: false, onlyDjCanControl: false };
  const updated: DjConfig = { ...current, ...config };
  store.guilds[guildId] = updated;
  await saveStore();
  return updated;
}

/**
 * Checks if a member has permission to execute destructive music operations (skip, stop, vol, eq, clear)
 */
export async function hasDjPermission(member: GuildMember, guild: Guild): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Bot Owner always has absolute bypass
  if (isBotOwner(member.id)) {
    return { allowed: true };
  }

  // 2. Server Admins & Managers bypass DJ restrictions
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.MuteMembers)
  ) {
    return { allowed: true };
  }

  const djConfig = await getDjConfig(guild.id);
  if (!djConfig.enabled || !djConfig.djRoleId) {
    return { allowed: true };
  }

  // 3. If user is alone in the voice channel with the bot, allow them control
  const player = getMusicPlayer(guild.id);
  if (player?.voiceChannel) {
    const humanCount = player.voiceChannel.members.filter((m) => !m.user.bot).size;
    if (humanCount <= 1) {
      return { allowed: true };
    }
  }

  // 4. Check if member has the designated DJ role
  if (member.roles.cache.has(djConfig.djRoleId)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `🎧 **DJ Role Required:** Only members with the <@&${djConfig.djRoleId}> role or server administrators can use destructive music controls on this server.`,
  };
}
