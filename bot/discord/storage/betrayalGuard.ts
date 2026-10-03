import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { logger } from "../../lib/logger";

export interface BetrayalGuardConfig {
  guildId: string;
  enabled: boolean;
  maxActionsPerMinute: number;
  quarantineRole?: string;
  notifyOwner: boolean;
  autoRollback: boolean;
  antiRogueAdmin: boolean;
  actionThresholds: {
    massBan: number;
    massKick: number;
    massRoleDelete: number;
    massChannelDelete: number;
    massWebhookCreate: number;
    massRoleRemove: number;
  };
}

export interface BetrayalIncident {
  id: string;
  guildId: string;
  executorId: string;
  executorTag: string;
  actionType: string;
  timestamp: number;
  quarantined: boolean;
  actionCount: number;
  details: string;
}

const CONFIG_FILE = dataFile("betrayal_guard_configs.json");
const INCIDENT_FILE = dataFile("betrayal_guard_incidents.json");

let configCache: Record<string, BetrayalGuardConfig> = {};
let incidentCache: BetrayalIncident[] = [];
let isLoaded = false;

async function ensureLoaded(): Promise<void> {
  if (isLoaded) return;
  try {
    configCache = await loadPersistentJson<Record<string, BetrayalGuardConfig>>(
      "betrayal_guard_configs.json",
      CONFIG_FILE,
      {}
    );
    incidentCache = await loadPersistentJson<BetrayalIncident[]>(
      "betrayal_guard_incidents.json",
      INCIDENT_FILE,
      []
    );
    isLoaded = true;
  } catch (err) {
    logger.error({ err }, "Failed to load Betrayal Guard storage");
  }
}

async function persistConfigs(): Promise<void> {
  await persistPersistentJson("betrayal_guard_configs.json", CONFIG_FILE, configCache);
}

async function persistIncidents(): Promise<void> {
  await persistPersistentJson("betrayal_guard_incidents.json", INCIDENT_FILE, incidentCache);
}

// In-memory action tracker for rate thresholds
const recentExecutorActions = new Map<string, { count: number; firstTimestamp: number }>();

export function getBetrayalGuardConfig(guildId: string): BetrayalGuardConfig {
  const existing = configCache[guildId];
  if (existing) return existing;

  const defaultConfig: BetrayalGuardConfig = {
    guildId,
    enabled: true,
    maxActionsPerMinute: 3,
    notifyOwner: true,
    autoRollback: true,
    antiRogueAdmin: true,
    actionThresholds: {
      massBan: 2,
      massKick: 3,
      massRoleDelete: 2,
      massChannelDelete: 2,
      massWebhookCreate: 3,
      massRoleRemove: 4,
    },
  };
  configCache[guildId] = defaultConfig;
  persistConfigs().catch(() => {});
  return defaultConfig;
}

export function updateBetrayalGuardConfig(guildId: string, update: Partial<BetrayalGuardConfig>): BetrayalGuardConfig {
  const current = getBetrayalGuardConfig(guildId);
  const updated = { ...current, ...update };
  configCache[guildId] = updated;
  persistConfigs().catch(() => {});
  return updated;
}

export function recordBetrayalIncident(incident: BetrayalIncident): void {
  incidentCache = [incident, ...incidentCache.slice(0, 100)];
  persistIncidents().catch(() => {});
}

export function getGuildBetrayalIncidents(guildId: string): BetrayalIncident[] {
  return incidentCache.filter((i: BetrayalIncident) => i.guildId === guildId);
}

/**
 * Checks if an action performed by a staff member exceeds Betrayal Guard threshold
 */
export function registerStaffAction(
  guildId: string,
  executorId: string,
  actionType: keyof BetrayalGuardConfig["actionThresholds"],
): { triggered: boolean; actionCount: number; threshold: number } {
  const cfg = getBetrayalGuardConfig(guildId);
  if (!cfg.enabled) return { triggered: false, actionCount: 0, threshold: 99 };

  const key = `${guildId}:${executorId}:${actionType}`;
  const now = Date.now();
  const record = recentExecutorActions.get(key) || { count: 0, firstTimestamp: now };

  // Reset window if older than 60 seconds
  if (now - record.firstTimestamp > 60_000) {
    record.count = 1;
    record.firstTimestamp = now;
  } else {
    record.count += 1;
  }

  recentExecutorActions.set(key, record);

  const threshold = cfg.actionThresholds[actionType] || cfg.maxActionsPerMinute;
  const triggered = record.count >= threshold;

  return { triggered, actionCount: record.count, threshold };
}

// Trigger initial load on module import
ensureLoaded().catch(() => {});
