import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";

export interface UserDailyStats {
  messages: number;
  chars: number;
  commandsUsed: number;
  lastActive: number;
}

export interface GuildStatsRecord {
  enabled: boolean;
  userMessages: Record<string, number>; // userId -> total messages
  userDaily: Record<string, Record<string, number>>; // yyyy-mm-dd -> (userId -> count)
  channelDaily: Record<string, Record<string, number>>; // yyyy-mm-dd -> (channelId -> count)
  roleDaily: Record<string, Record<string, number>>; // yyyy-mm-dd -> (roleId -> count)
  joinsDaily: Record<string, number>; // yyyy-mm-dd -> count
  leavesDaily: Record<string, number>; // yyyy-mm-dd -> count
  hourlyActivity: number[]; // 24 hours 0..23 message count
}

const FILE_PATH = dataFile("server_stats.json");
let cache: Record<string, GuildStatsRecord> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<Record<string, GuildStatsRecord>> {
  if (cache) return cache;
  cache = await loadPersistentJson("server_stats.json", FILE_PATH, {});
  return cache;
}

async function persist(data: Record<string, GuildStatsRecord>): Promise<void> {
  await persistPersistentJson("server_stats.json", FILE_PATH, data);
}

function queueWrite(data: Record<string, GuildStatsRecord>): void {
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyStats(): GuildStatsRecord {
  return {
    enabled: true,
    userMessages: {},
    userDaily: {},
    channelDaily: {},
    roleDaily: {},
    joinsDaily: {},
    leavesDaily: {},
    hourlyActivity: new Array(24).fill(0),
  };
}

export async function getGuildStats(guildId: string): Promise<GuildStatsRecord> {
  const data = await load();
  if (!data[guildId]) {
    data[guildId] = emptyStats();
    queueWrite(data);
  }
  return data[guildId]!;
}

export async function setStatsModuleEnabled(guildId: string, enabled: boolean): Promise<GuildStatsRecord> {
  const data = await load();
  if (!data[guildId]) data[guildId] = emptyStats();
  data[guildId]!.enabled = enabled;
  queueWrite(data);
  return data[guildId]!;
}

export async function recordMessageStat(guildId: string, userId: string, channelId: string, roleIds: string[]): Promise<void> {
  const data = await load();
  if (!data[guildId]) data[guildId] = emptyStats();
  const g = data[guildId]!;
  if (!g.enabled) return;

  const date = todayKey();
  const hour = new Date().getUTCHours();

  // User message count
  g.userMessages[userId] = (g.userMessages[userId] ?? 0) + 1;

  // Daily user messages
  if (!g.userDaily[date]) g.userDaily[date] = {};
  g.userDaily[date][userId] = (g.userDaily[date][userId] ?? 0) + 1;

  // Daily channel messages
  if (!g.channelDaily[date]) g.channelDaily[date] = {};
  g.channelDaily[date][channelId] = (g.channelDaily[date][channelId] ?? 0) + 1;

  // Daily role messages (attribute to user's highest or all non-everyone roles)
  if (!g.roleDaily[date]) g.roleDaily[date] = {};
  for (const rId of roleIds) {
    if (rId === guildId) continue; // skip @everyone
    g.roleDaily[date][rId] = (g.roleDaily[date][rId] ?? 0) + 1;
  }

  // Hourly distribution
  if (!Array.isArray(g.hourlyActivity) || g.hourlyActivity.length !== 24) {
    g.hourlyActivity = new Array(24).fill(0);
  }
  g.hourlyActivity[hour] = (g.hourlyActivity[hour] ?? 0) + 1;

  queueWrite(data);
}

export async function recordJoinStat(guildId: string): Promise<void> {
  const data = await load();
  if (!data[guildId]) data[guildId] = emptyStats();
  const g = data[guildId]!;
  if (!g.enabled) return;

  const date = todayKey();
  g.joinsDaily[date] = (g.joinsDaily[date] ?? 0) + 1;
  queueWrite(data);
}

export async function recordLeaveStat(guildId: string): Promise<void> {
  const data = await load();
  if (!data[guildId]) data[guildId] = emptyStats();
  const g = data[guildId]!;
  if (!g.enabled) return;

  const date = todayKey();
  g.leavesDaily[date] = (g.leavesDaily[date] ?? 0) + 1;
  queueWrite(data);
}

export function getLast7Days(): string[] {
  const res: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    res.push(d.toISOString().slice(0, 10));
  }
  return res;
}
