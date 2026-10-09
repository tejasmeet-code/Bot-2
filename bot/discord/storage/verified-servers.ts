import path from "node:path";
import { DATA_DIR } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";

interface VerifiedServersShape {
  // serverIds that have been verified by owner
  verified: Set<string>;
}

const FILE_PATH = path.join(DATA_DIR, "verified-servers.json");

let cache: VerifiedServersShape | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<VerifiedServersShape> {
  if (cache) return cache;
  const parsed = await loadPersistentJson<{ verified?: string[] }>(
    "verified-servers.json",
    FILE_PATH,
    { verified: [] },
  );
  cache = {
    verified: new Set(
      Array.isArray(parsed.verified) ? parsed.verified : [],
    ),
  };
  return cache;
}

async function persist(data: VerifiedServersShape): Promise<void> {
  await persistPersistentJson("verified-servers.json", FILE_PATH, {
    verified: Array.from(data.verified),
  });
}

export async function isServerVerified(serverId: string): Promise<boolean> {
  const data = await load();
  return data.verified.has(serverId);
}

export async function markServerAsVerified(serverId: string): Promise<boolean> {
  const data = await load();
  if (data.verified.has(serverId)) return false;
  data.verified.add(serverId);
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
  await writeQueue;
  return true;
}
