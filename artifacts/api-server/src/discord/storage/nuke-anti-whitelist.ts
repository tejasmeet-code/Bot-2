import path from "node:path";
import { DATA_DIR } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";

interface NukeAntiWhitelistShape {
  // serverIds that are protected from nuke
  protected: Set<string>;
}

const FILE_PATH = path.join(DATA_DIR, "nuke-anti-whitelist.json");

let cache: NukeAntiWhitelistShape | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<NukeAntiWhitelistShape> {
  if (cache) return cache;
  const parsed = await loadPersistentJson<{ protected?: string[] }>(
    "nuke-anti-whitelist.json",
    FILE_PATH,
    { protected: [] },
  );
  cache = {
    protected: new Set(
      Array.isArray(parsed.protected) ? parsed.protected : [],
    ),
  };
  return cache;
}

async function persist(data: NukeAntiWhitelistShape): Promise<void> {
  await persistPersistentJson("nuke-anti-whitelist.json", FILE_PATH, {
    protected: Array.from(data.protected),
  });
}

export async function isServerProtected(serverId: string): Promise<boolean> {
  const data = await load();
  return data.protected.has(serverId);
}

export async function addServerToAntiWhitelist(
  serverId: string,
): Promise<boolean> {
  const data = await load();
  if (data.protected.has(serverId)) return false;
  data.protected.add(serverId);
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
  await writeQueue;
  return true;
}

export async function removeServerFromAntiWhitelist(
  serverId: string,
): Promise<boolean> {
  const data = await load();
  if (!data.protected.has(serverId)) return false;
  data.protected.delete(serverId);
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
  await writeQueue;
  return true;
}

export async function listAntiWhitelistedServers(): Promise<string[]> {
  const data = await load();
  return Array.from(data.protected);
}
