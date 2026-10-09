import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { logger } from "../../lib/logger";

const STORE = "music_sessions_store";
const FILE = () => dataFile("music_sessions_store.json");

export interface PersistedMusicSession {
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  currentTrack: any;
  queue: any[];
  volume: number;
  speed: number;
  equalizer: string;
  loopMode: string;
  autoplay: boolean;
  twentyFourSeven: {
    enabled: boolean;
    query?: string;
    type?: string;
    artistName?: string;
    songMode?: string;
  };
  savedAt: number;
}

let cache: Record<string, PersistedMusicSession> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<Record<string, PersistedMusicSession>> {
  if (cache) return cache;
  cache = await loadPersistentJson<Record<string, PersistedMusicSession>>(STORE, FILE(), {});
  return cache;
}

async function save(store: Record<string, PersistedMusicSession>): Promise<void> {
  cache = store;
  writeQueue = writeQueue.then(() => persistPersistentJson(STORE, FILE(), store));
  return writeQueue;
}

export async function savePersistedSession(session: PersistedMusicSession): Promise<void> {
  try {
    const store = await load();
    store[session.guildId] = session;
    await save(store);
  } catch (err) {
    logger.debug({ err, guildId: session.guildId }, "Could not persist active music session");
  }
}

export async function removePersistedSession(guildId: string): Promise<void> {
  try {
    const store = await load();
    if (store[guildId]) {
      delete store[guildId];
      await save(store);
    }
  } catch (err) {
    logger.debug({ err, guildId }, "Could not remove persisted music session");
  }
}

export async function getAllPersistedSessions(): Promise<PersistedMusicSession[]> {
  try {
    const store = await load();
    return Object.values(store);
  } catch {
    return [];
  }
}
