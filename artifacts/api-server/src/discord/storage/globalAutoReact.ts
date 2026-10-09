import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { isPermanentOwner } from "./premium";
import { getBotStaffMember } from "./botStaff";

const STORE = "global_auto_react";
const FILE = () => dataFile("global_auto_react.json");

export type GlobalAutoReactTargetType = "word" | "user" | "channel" | "role";

export interface GlobalAutoReactRule {
  id: string;
  targetType: GlobalAutoReactTargetType;
  target: string;
  emoji: string;
  addedBy: string;
  addedByName?: string;
  addedAt: number;
  enabled: boolean;
}

export interface GlobalAutoReactStore {
  enabled: boolean;
  rules: GlobalAutoReactRule[];
}

let cache: GlobalAutoReactStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<GlobalAutoReactStore> {
  if (cache) return cache;
  cache = await loadPersistentJson<GlobalAutoReactStore>(STORE, FILE(), {
    enabled: true,
    rules: [],
  });
  if (!Array.isArray(cache.rules)) {
    cache.rules = [];
  }
  if (typeof cache.enabled !== "boolean") {
    cache.enabled = true;
  }
  return cache;
}

async function save(store: GlobalAutoReactStore): Promise<void> {
  cache = store;
  writeQueue = writeQueue.then(() => persistPersistentJson(STORE, FILE(), store));
  return writeQueue;
}

/**
 * Checks if the user is authorized to manage global auto-react.
 * Strictly restricted to Bot Owner and Bot Co-Owner.
 */
export async function isOwnerOrCoOwner(userId: string): Promise<boolean> {
  if (isPermanentOwner(userId)) return true;
  if (
    process.env.DISCORD_OWNER_ID &&
    process.env.DISCORD_OWNER_ID.split(",").map((s) => s.trim()).includes(userId)
  ) {
    return true;
  }
  const staff = await getBotStaffMember(userId);
  if (staff && (staff.role === "owner" || staff.role === "co_owner")) {
    return true;
  }
  return false;
}

export async function getGlobalAutoReactStore(): Promise<GlobalAutoReactStore> {
  return await load();
}

export async function addGlobalAutoReactRule(
  targetType: GlobalAutoReactTargetType,
  target: string,
  emoji: string,
  addedBy: string,
  addedByName?: string,
): Promise<{ rule: GlobalAutoReactRule; isNew: boolean }> {
  const store = await load();
  const existingIdx = store.rules.findIndex(
    (r) => r.targetType === targetType && r.target.toLowerCase() === target.toLowerCase(),
  );

  if (existingIdx >= 0) {
    // Update existing rule's emoji and status
    store.rules[existingIdx]!.emoji = emoji;
    store.rules[existingIdx]!.enabled = true;
    store.rules[existingIdx]!.addedBy = addedBy;
    if (addedByName) store.rules[existingIdx]!.addedByName = addedByName;
    await save(store);
    return { rule: store.rules[existingIdx]!, isNew: false };
  }

  const id = Math.random().toString(36).substring(2, 8);
  const rule: GlobalAutoReactRule = {
    id,
    targetType,
    target,
    emoji,
    addedBy,
    addedByName,
    addedAt: Date.now(),
    enabled: true,
  };

  store.rules.push(rule);
  await save(store);
  return { rule, isNew: true };
}

export async function removeGlobalAutoReactRule(idOrTarget: string): Promise<boolean> {
  const store = await load();
  const lower = idOrTarget.toLowerCase();
  const nextRules = store.rules.filter(
    (r) => r.id.toLowerCase() !== lower && r.target.toLowerCase() !== lower,
  );

  if (nextRules.length === store.rules.length) {
    return false;
  }

  store.rules = nextRules;
  await save(store);
  return true;
}

export async function toggleGlobalAutoReactRule(idOrTarget: string): Promise<GlobalAutoReactRule | null> {
  const store = await load();
  const lower = idOrTarget.toLowerCase();
  const rule = store.rules.find(
    (r) => r.id.toLowerCase() === lower || r.target.toLowerCase() === lower,
  );

  if (!rule) return null;

  rule.enabled = !rule.enabled;
  await save(store);
  return rule;
}

export async function setGlobalAutoReactMasterEnabled(enabled: boolean): Promise<boolean> {
  const store = await load();
  store.enabled = enabled;
  await save(store);
  return store.enabled;
}

export async function toggleGlobalAutoReactMaster(): Promise<boolean> {
  const store = await load();
  store.enabled = !store.enabled;
  await save(store);
  return store.enabled;
}

export async function clearGlobalAutoReactRules(): Promise<number> {
  const store = await load();
  const count = store.rules.length;
  store.rules = [];
  await save(store);
  return count;
}
