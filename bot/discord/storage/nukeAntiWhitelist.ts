import path from "node:path";
import { DATA_DIR } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";

interface AntiWhitelistShape {
  // List of server IDs where nuke command is blocked even for global whitelisted users
  serverIds: string[];
}

const FILE_PATH = path.join(DATA_DIR, "nuke-anti-whitelist.json");

let cache: AntiWhitelistShape | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<AntiWhitelistShape> {
  if (cache) return cache;
  const parsed = await loadPersistentJson<Partial<AntiWhitelistShape>>(
    "nuke-anti-whitelist.json",
    FILE_PATH,
    { serverIds: [] },
  );
  cache = {
    serverIds: Array.isArray(parsed.serverIds) ? parsed.serverIds : [],
  };
  return cache;
}

async function persist(data: AntiWhitelistShape): Promise<void> {
  await persistPersistentJson("nuke-anti-whitelist.json", FILE_PATH, data);
}

export async function isNukeBlocked(guildId: string): Promise<boolean> {
  const data = await load();
  return data.serverIds.includes(guildId);
}

export async function addNukeBlock(guildId: string): Promise<boolean> {
  const data = await load();
  if (data.serverIds.includes(guildId)) return false;
  data.serverIds.push(guildId);
  cache = data;
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
  await writeQueue;
  return true;
}

export async function removeNukeBlock(guildId: string): Promise<boolean> {
  const data = await load();
  const index = data.serverIds.indexOf(guildId);
  if (index === -1) return false;
  data.serverIds.splice(index, 1);
  cache = data;
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
  await writeQueue;
  return true;
}

export async function getNukeBlockList(): Promise<string[]> {
  const data = await load();
  return [...data.serverIds];
}
