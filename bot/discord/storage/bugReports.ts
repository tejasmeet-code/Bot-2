import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { logger } from "../../lib/logger";

export interface BugReport {
  id: string;
  userId: string;
  description: string;
  imageUrl?: string;
  status: "pending" | "approved" | "rejected";
  timestamp: number;
  approvedBy?: string;
}

export interface BugReportsStore {
  points: Record<string, number>; // userId -> points
  reports: Record<string, BugReport>; // reportId -> report
}

const STORE_NAME = "bug_reports_store.json";
const FILE_PATH = path.join(DATA_DIR, STORE_NAME);

let cache: BugReportsStore | null = null;

async function getStore(): Promise<BugReportsStore> {
  if (cache) return cache;
  cache = await loadPersistentJson<BugReportsStore>(STORE_NAME, FILE_PATH, {
    points: {},
    reports: {},
  });
  return cache;
}

async function saveStore(store: BugReportsStore): Promise<void> {
  cache = store;
  await persistPersistentJson(STORE_NAME, FILE_PATH, store);
}

export async function addBugReport(report: BugReport): Promise<void> {
  const store = await getStore();
  store.reports[report.id] = report;
  await saveStore(store);
}

export async function getBugReport(id: string): Promise<BugReport | null> {
  const store = await getStore();
  return store.reports[id] ?? null;
}

export async function updateBugReportStatus(id: string, status: "approved" | "rejected", approvedBy: string): Promise<void> {
  const store = await getStore();
  const report = store.reports[id];
  if (report) {
    report.status = status;
    report.approvedBy = approvedBy;
    await saveStore(store);
  }
}

export async function getUserBugPoints(userId: string): Promise<number> {
  const store = await getStore();
  return store.points[userId] ?? 0;
}

export async function addBugPoints(userId: string, amount: number): Promise<number> {
  const store = await getStore();
  const current = store.points[userId] ?? 0;
  const updated = current + amount;
  store.points[userId] = updated;
  await saveStore(store);
  return updated;
}

export interface BugHunterTier {
  tier: number;
  name: string;
  minPoints: number;
  badgeKey: string;
  emojiStr: string;
  color: string;
}

export const BUG_HUNTER_TIERS: BugHunterTier[] = [
  { tier: 1, name: "Bug Hunter I", minPoints: 1, badgeKey: "bug_hunter_1", emojiStr: "<:icons_6:1357085417790505100>", color: "#1abc9c" },
  { tier: 2, name: "Bug Hunter II", minPoints: 5, badgeKey: "bug_hunter_2", emojiStr: "<a:Tester:799143615804342273>", color: "#3498db" },
  { tier: 3, name: "Bug Hunter III", minPoints: 15, badgeKey: "bug_hunter_3", emojiStr: "<a:37496alert:1269243594913611857>", color: "#9b59b6" },
  { tier: 4, name: "Bug Hunter IV", minPoints: 30, badgeKey: "bug_hunter_4", emojiStr: "<a:startpixel:1524110226901434530>", color: "#e67e22" },
  { tier: 5, name: "Bug Master", minPoints: 50, badgeKey: "bug_hunter_5", emojiStr: "<a:AllBadges:1550883328520097832>", color: "#e74c3c" },
];

export async function getBugHunterTier(points: number): Promise<BugHunterTier | null> {
  // Find highest tier where points >= minPoints
  let currentTier: BugHunterTier | null = null;
  for (const tier of BUG_HUNTER_TIERS) {
    if (points >= tier.minPoints) {
      currentTier = tier;
    }
  }
  return currentTier;
}
