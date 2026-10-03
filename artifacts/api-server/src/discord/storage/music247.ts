import path from "node:path";
import { DATA_DIR } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { logger } from "../../lib/logger";

export interface Music247Config {
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  enabled: boolean;
  query?: string;
  presetStationIndex?: number;
  updatedAt: number;
}

interface Music247Store {
  configs: Record<string, Music247Config>;
}

const STORE_NAME = "music_247_sessions.json";
const FILE_PATH = path.join(DATA_DIR, STORE_NAME);

export async function get247Config(guildId: string): Promise<Music247Config | null> {
  const store = await loadPersistentJson<Music247Store>(STORE_NAME, FILE_PATH, { configs: {} });
  return store.configs[guildId] ?? null;
}

export async function getAll247Configs(): Promise<Music247Config[]> {
  const store = await loadPersistentJson<Music247Store>(STORE_NAME, FILE_PATH, { configs: {} });
  return Object.values(store.configs).filter((c): c is Music247Config => Boolean(c && c.enabled));
}

export async function set247Config(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string | undefined,
  enabled: boolean,
  query?: string,
): Promise<Music247Config> {
  const store = await loadPersistentJson<Music247Store>(STORE_NAME, FILE_PATH, { configs: {} });
  const config: Music247Config = {
    guildId,
    voiceChannelId,
    textChannelId,
    enabled,
    query,
    updatedAt: Date.now(),
  };

  if (enabled) {
    store.configs[guildId] = config;
  } else {
    delete store.configs[guildId];
  }

  await persistPersistentJson<Music247Store>(STORE_NAME, FILE_PATH, store);
  logger.info({ guildId, voiceChannelId, enabled }, "Persisted 24/7 music configuration");
  return config;
}

