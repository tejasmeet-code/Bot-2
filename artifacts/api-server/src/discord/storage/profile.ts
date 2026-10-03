import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { isUserPremium, isGuildPremium, isPermanentOwner } from "./premium";
import { logger } from "../../lib/logger";
import { DATA_DIR } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";

export interface UserProfileData {
  userId: string;
  username: string;
  avatarUrl: string;
  bio: string;
  premiumTier: number; // 0 to 4
  premiumTierName: string;
  noPrefixEnabled: boolean;
  isBotStaff: boolean;
  botStaffRole?: string | null;
  joinedAt?: string;
  createdAt?: string;
  level?: number;
  xp?: number;
  nextLevelXp?: number;
  progressPercent?: number;
  serverRank?: string;
  audioDspQuality?: string;
  serverRoles?: string[];
  badges?: string[]; // Array of badge keys
}

const STORE = "profile_store";
const PROFILE_FILE = path.join(DATA_DIR, "profile_store.json");

// Memory stores backed by persistent sync
const userBios = new Map<string, string>();
const noPrefixUsers = new Set<string>();
const disabledNoPrefixUsers = new Set<string>();
const noPrefixGuilds = new Set<string>();
const userPremiumTiers = new Map<string, number>();
const userBadges = new Map<string, Set<string>>();

let isLoaded = false;
async function ensureLoaded(): Promise<void> {
  if (isLoaded) return;
  isLoaded = true;
  try {
    const data = await loadPersistentJson<any>(STORE, PROFILE_FILE, {}).catch(() => null);
    if (data) {
      if (Array.isArray(data.noPrefixUsers)) {
        for (const u of data.noPrefixUsers) noPrefixUsers.add(u);
      }
      if (Array.isArray(data.disabledNoPrefixUsers)) {
        for (const u of data.disabledNoPrefixUsers) disabledNoPrefixUsers.add(u);
      }
      if (Array.isArray(data.noPrefixGuilds)) {
        for (const g of data.noPrefixGuilds) noPrefixGuilds.add(g);
      }
      if (data.userBios && typeof data.userBios === "object") {
        for (const [k, v] of Object.entries(data.userBios)) userBios.set(k, String(v));
      }
      if (data.userPremiumTiers && typeof data.userPremiumTiers === "object") {
        for (const [k, v] of Object.entries(data.userPremiumTiers)) userPremiumTiers.set(k, Number(v));
      }
      if (data.userBadges && typeof data.userBadges === "object") {
        for (const [k, v] of Object.entries(data.userBadges)) {
          if (Array.isArray(v)) userBadges.set(k, new Set(v));
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "Error loading profile store");
  }
}

async function saveProfileStore(): Promise<void> {
  try {
    const badgesObj: Record<string, string[]> = {};
    for (const [k, v] of userBadges.entries()) {
      badgesObj[k] = Array.from(v);
    }
    const data = {
      noPrefixUsers: Array.from(noPrefixUsers),
      disabledNoPrefixUsers: Array.from(disabledNoPrefixUsers),
      noPrefixGuilds: Array.from(noPrefixGuilds),
      userBios: Object.fromEntries(userBios),
      userPremiumTiers: Object.fromEntries(userPremiumTiers),
      userBadges: badgesObj,
    };
    await persistPersistentJson(STORE, PROFILE_FILE, data);
  } catch (err) {
    logger.warn({ err }, "Error saving profile store");
  }
}

export async function getUserBadges(userId: string): Promise<string[]> {
  await ensureLoaded();
  return Array.from(userBadges.get(userId) ?? []);
}

export async function addUserBadge(userId: string, badgeKey: string): Promise<string[]> {
  await ensureLoaded();
  if (!userBadges.has(userId)) userBadges.set(userId, new Set());
  userBadges.get(userId)!.add(badgeKey);
  await saveProfileStore();
  return Array.from(userBadges.get(userId)!);
}

export async function removeUserBadge(userId: string, badgeKey: string): Promise<string[]> {
  await ensureLoaded();
  const set = userBadges.get(userId);
  if (set) {
    set.delete(badgeKey);
    await saveProfileStore();
    return Array.from(set);
  }
  return [];
}

export async function giveAllBadges(userId: string): Promise<string[]> {
  await ensureLoaded();
  const allKeys = Object.keys(BADGE_CONFIGS);
  userBadges.set(userId, new Set(allKeys));
  await saveProfileStore();
  return allKeys;
}

/**
 * Gets or sets user bio
 */
export function getUserBio(userId: string): string {
  ensureLoaded().catch(() => {});
  return userBios.get(userId) || "Passionate audio lover & Zenith community member.";
}

export function setUserBio(userId: string, bio: string): string {
  ensureLoaded().catch(() => {});
  const sanitized = bio.trim().slice(0, 160);
  userBios.set(userId, sanitized);
  saveProfileStore().catch(() => {});
  return sanitized;
}

/**
 * Checks if No-Prefix is enabled for a user or guild
 */
export async function isNoPrefixEnabled(userId: string, guildId?: string): Promise<boolean> {
  await ensureLoaded();
  if (disabledNoPrefixUsers.has(userId)) return false;
  const isOwner = isPermanentOwner(userId);
  const { isBotAdmin } = await import("./premium");
  const isAdmin = isBotAdmin(userId);
  const { isBotStaff } = await import("./botStaff");
  const isStaff = await isBotStaff(userId);
  const uPrem = await isUserPremium(userId, guildId);

  // Non-premium users are NOT permitted to use no-prefix
  if (!isOwner && !isAdmin && !isStaff && !uPrem) {
    return false;
  }

  if (noPrefixUsers.has(userId)) return true;
  return true;
}

export function setNoPrefix(targetId: string, type: "user" | "guild", enabled: boolean): void {
  ensureLoaded().catch(() => {});
  if (type === "user") {
    if (enabled) {
      noPrefixUsers.add(targetId);
      disabledNoPrefixUsers.delete(targetId);
    } else {
      noPrefixUsers.delete(targetId);
      disabledNoPrefixUsers.add(targetId);
    }
  } else {
    if (enabled) noPrefixGuilds.add(targetId);
    else noPrefixGuilds.delete(targetId);
  }
  saveProfileStore().catch(() => {});
}

/**
 * Gets Premium Tier for a user (0: Free, 1: VIP Supporter, 2: Pro Master, 3: Enterprise God, 4: Relosta Apex)
 */
export async function getUserPremiumTier(userId: string, guildId?: string): Promise<number> {
  if (userPremiumTiers.has(userId)) {
    return userPremiumTiers.get(userId)!;
  }
  const uPrem = await isUserPremium(userId);
  const gPrem = guildId ? await isGuildPremium(guildId) : false;
  if (uPrem || gPrem) {
    return 4; // Top Tier
  }
  return 0;
}

export function setUserPremiumTier(userId: string, tier: number): void {
  const bounded = Math.max(0, Math.min(4, tier));
  userPremiumTiers.set(userId, bounded);
}

export const PREMIUM_TIER_NAMES: Record<number, string> = {
  0: "Standard Free User",
  1: "Tier 1: VIP Supporter",
  2: "Tier 2: Pro Master",
  3: "Tier 3: Enterprise God",
  4: "Tier 4: Relosta Apex",
};

export const PREMIUM_TIERS: Record<number, { name: string; title: string }> = {
  1: { name: "VIP Supporter", title: "Tier 1: VIP Supporter" },
  2: { name: "Pro Master", title: "Tier 2: Pro Master" },
  3: { name: "Enterprise God", title: "Tier 3: Enterprise God" },
  4: { name: "Relosta Apex", title: "Tier 4: Relosta Apex" },
};

export type VectorIconType =
  | "triangle"
  | "crown"
  | "co_crown"
  | "shield"
  | "flask"
  | "star"
  | "flame"
  | "gem"
  | "lightning"
  | "trophy"
  | "signal";

export interface BadgeMeta {
  key: string;
  label: string;
  iconType: VectorIconType;
  color: string;
  bg: string;
  border: string;
}

export const BADGE_EMOJI_URLS: Record<string, string> = {
  owner: "https://cdn.discordapp.com/emojis/1555133769659187260.png",
  co_owner: "https://cdn.discordapp.com/emojis/1555133610858647603.png",
  admin: "https://cdn.discordapp.com/emojis/1555133552797028443.png",
  head_tester: "https://cdn.discordapp.com/emojis/1555133664554393620.png",
  tester: "https://cdn.discordapp.com/emojis/1555133862030483548.png",
  manager: "https://cdn.discordapp.com/emojis/1555133708057575466.png",
  mod: "https://cdn.discordapp.com/emojis/1555133403261571144.png",
  help: "https://cdn.discordapp.com/emojis/1555133671340515439.png",
  vip: "https://cdn.discordapp.com/emojis/1555133891281428500.png",
  homies: "https://cdn.discordapp.com/emojis/1555133678009589810.png",
  partner: "https://cdn.discordapp.com/emojis/1555133776475070464.png",
  supporter: "https://cdn.discordapp.com/emojis/1555133839351873556.png",
  premium: "https://cdn.discordapp.com/emojis/1555133783634616371.png",
  premium_1: "https://cdn.discordapp.com/emojis/1555133459192615042.png",
  premium_2: "https://cdn.discordapp.com/emojis/1555133465022828626.png",
  premium_3: "https://cdn.discordapp.com/emojis/1555133473205780550.png",
  premium_4: "https://cdn.discordapp.com/emojis/1555133480810193016.png",
  no_prefix: "https://cdn.discordapp.com/emojis/1555133762734657581.png",
  bot_staff: "https://cdn.discordapp.com/emojis/1555133846801092631.png",
  bug_hunter_1: "https://cdn.discordapp.com/emojis/1555133271896096788.png",
  bug_hunter_2: "https://cdn.discordapp.com/emojis/1555133279030485082.png",
  bug_hunter_3: "https://cdn.discordapp.com/emojis/1555133286676832366.png",
  bug_hunter_4: "https://cdn.discordapp.com/emojis/1555133293765070880.png",
  bug_hunter_5: "https://cdn.discordapp.com/emojis/1555133575165124638.png",
};

export const BADGE_PRIORITY: Record<string, number> = {
  owner: 100,
  co_owner: 95,
  admin: 90,
  manager: 85,
  head_tester: 80,
  tester: 75,
  mod: 70,
  partner: 65,
  vip: 60,
  homies: 55,
  premium_4: 50,
  premium_3: 45,
  premium_2: 40,
  premium_1: 35,
  no_prefix: 30,
  help: 25,
  supporter: 20,
  bug_hunter_5: 15,
  bug_hunter_4: 14,
  bug_hunter_3: 13,
  bug_hunter_2: 12,
  bug_hunter_1: 11,
  bot_staff: 10,
};

export const BADGE_CUSTOM_EMOJIS: Record<string, string> = {
  owner: "<:white_owner:1555133769659187260>",
  co_owner: "<:white_co_owner:1555133610858647603>",
  admin: "<:white_admin:1555133552797028443>",
  head_tester: "<:white_HeadTester:1555133664554393620>",
  tester: "<:white_Tester:1555133862030483548>",
  manager: "<:white_manager:1555133708057575466>",
  mod: "<:Moderator:1555133403261571144>",
  help: "<:white_helper:1555133671340515439>",
  vip: "<:white_vip:1555133891281428500>",
  homies: "<:white_homies:1555133678009589810>",
  partner: "<:white_partner:1555133776475070464>",
  supporter: "<:white_supporter:1555133839351873556>",
  premium_1: "<:Premium1:1555133459192615042>",
  premium_2: "<:Premium2:1555133465022828626>",
  premium_3: "<:Premium3:1555133473205780550>",
  premium_4: "<:Premium4:1555133480810193016>",
  no_prefix: "<:white_no_prefix:1555133762734657581>",
  bot_staff: "<:white_support_team:1555133846801092631>",
  bug_hunter_1: "<:Bughunter_1:1555133271896096788>",
  bug_hunter_2: "<:Bughunter_2:1555133279030485082>",
  bug_hunter_3: "<:Bughunter_3:1555133286676832366>",
  bug_hunter_4: "<:Bughunter_4:1555133293765070880>",
  bug_hunter_5: "<:white_award:1555133575165124638>",
};

export async function getUserAllBadges(userId: string, guildId?: string): Promise<{ badges: string[]; badgeEmojisStr: string; topBadgesStr: string }> {
  await ensureLoaded();
  const { getBotStaffMember } = await import("./botStaff");
  const { isPermanentOwner, isBotAdmin } = await import("./premium");
  const { getUserBugPoints, getBugHunterTier } = await import("./bugReports");

  const tier = await getUserPremiumTier(userId, guildId);
  const noPrefix = await isNoPrefixEnabled(userId, guildId);
  const staffMember = await getBotStaffMember(userId);
  const isStaff = !!staffMember;

  const isOwner = isPermanentOwner(userId) || staffMember?.role === "owner";
  const isCoOwner = staffMember?.role === "co_owner";
  const isAdmin = isBotAdmin(userId) || staffMember?.role === "admin";

  const badgeSet = new Set<string>();
  if (isOwner) badgeSet.add("owner");
  else if (isCoOwner) badgeSet.add("co_owner");

  if (isAdmin) badgeSet.add("admin");
  if (staffMember?.role === "head_tester") badgeSet.add("head_tester");
  if (staffMember?.role === "tester") badgeSet.add("tester");
  if (staffMember?.role === "manager") badgeSet.add("manager");
  if (staffMember?.role === "mod") badgeSet.add("mod");
  if (staffMember?.role === "help") badgeSet.add("help");
  if (staffMember?.role === "vip") badgeSet.add("vip");
  if (staffMember?.role === "homies") badgeSet.add("homies");
  if (staffMember?.role === "partner") badgeSet.add("partner");
  if (staffMember?.role === "supporter") badgeSet.add("supporter");
  if (staffMember?.role === "support_team") badgeSet.add("bot_staff");

  if (tier > 0) badgeSet.add(`premium_${tier}`);
  if (noPrefix) badgeSet.add("no_prefix");
  if (isStaff && !badgeSet.has("owner") && !badgeSet.has("admin")) badgeSet.add("bot_staff");

  const bugPoints = await getUserBugPoints(userId);
  const bugTier = await getBugHunterTier(bugPoints);
  if (bugTier) {
    badgeSet.add(bugTier.badgeKey);
  }

  const customBadges = await getUserBadges(userId);
  for (const cb of customBadges) {
    badgeSet.add(cb);
  }

  const sorted = sortBadgesByPriority(Array.from(badgeSet));
  const badgeEmojis = sorted.map((b) => BADGE_CUSTOM_EMOJIS[b] || "").filter(Boolean);
  const badgeEmojisStr = badgeEmojis.join(" ");
  const topBadgesStr = badgeEmojis.slice(0, 5).join(" ");

  return { badges: sorted, badgeEmojisStr, topBadgesStr };
}

export function sortBadgesByPriority(badges: string[]): string[] {
  return [...badges].sort((a, b) => {
    const prioA = BADGE_PRIORITY[a] ?? 0;
    const prioB = BADGE_PRIORITY[b] ?? 0;
    return prioB - prioA;
  });
}

export const BADGE_CONFIGS: Record<string, BadgeMeta> = {
  owner: { key: "owner", label: "OWNER", iconType: "crown", color: "#f1c40f", bg: "rgba(241, 196, 15, 0.22)", border: "#f1c40f" },
  co_owner: { key: "co_owner", label: "CO-OWNER", iconType: "co_crown", color: "#f39c12", bg: "rgba(243, 156, 18, 0.22)", border: "#f39c12" },
  admin: { key: "admin", label: "ADMIN", iconType: "shield", color: "#e74c3c", bg: "rgba(231, 76, 60, 0.22)", border: "#e74c3c" },
  head_tester: { key: "head_tester", label: "HEAD TESTER", iconType: "trophy", color: "#a855f7", bg: "rgba(168, 85, 247, 0.22)", border: "#a855f7" },
  tester: { key: "tester", label: "TESTER", iconType: "flask", color: "#1abc9c", bg: "rgba(26, 188, 156, 0.22)", border: "#1abc9c" },
  manager: { key: "manager", label: "MANAGER", iconType: "star", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.22)", border: "#3b82f6" },
  mod: { key: "mod", label: "MOD", iconType: "shield", color: "#e67e22", bg: "rgba(230, 126, 34, 0.22)", border: "#e67e22" },
  help: { key: "help", label: "HELPER", iconType: "star", color: "#2ecc71", bg: "rgba(46, 204, 113, 0.22)", border: "#2ecc71" },
  vip: { key: "vip", label: "VIP", iconType: "gem", color: "#ec4899", bg: "rgba(236, 72, 153, 0.22)", border: "#ec4899" },
  homies: { key: "homies", label: "HOMIES", iconType: "flame", color: "#ff6b81", bg: "rgba(255, 107, 129, 0.22)", border: "#ff6b81" },
  partner: { key: "partner", label: "PARTNER", iconType: "gem", color: "#00d2d3", bg: "rgba(0, 210, 211, 0.22)", border: "#00d2d3" },
  supporter: { key: "supporter", label: "SUPPORTER", iconType: "flame", color: "#fd79a8", bg: "rgba(253, 121, 168, 0.22)", border: "#fd79a8" },
  premium_1: { key: "premium_1", label: "VIP TIER 1", iconType: "gem", color: "#3498db", bg: "rgba(52, 152, 219, 0.22)", border: "#3498db" },
  premium_2: { key: "premium_2", label: "VIP TIER 2", iconType: "gem", color: "#9b59b6", bg: "rgba(155, 89, 182, 0.22)", border: "#9b59b6" },
  premium_3: { key: "premium_3", label: "VIP TIER 3", iconType: "crown", color: "#e91e63", bg: "rgba(233, 30, 99, 0.22)", border: "#e91e63" },
  premium_4: { key: "premium_4", label: "VIP TIER 4", iconType: "gem", color: "#f1c40f", bg: "rgba(241, 196, 15, 0.22)", border: "#f1c40f" },
  no_prefix: { key: "no_prefix", label: "NO-PREFIX", iconType: "lightning", color: "#2ecc71", bg: "rgba(46, 204, 113, 0.22)", border: "#2ecc71" },
  bot_staff: { key: "bot_staff", label: "BOT STAFF", iconType: "shield", color: "#8e44ad", bg: "rgba(142, 68, 173, 0.22)", border: "#8e44ad" },
  bug_hunter_1: { key: "bug_hunter_1", label: "BUG TIER I", iconType: "star", color: "#1abc9c", bg: "rgba(26, 188, 156, 0.22)", border: "#1abc9c" },
  bug_hunter_2: { key: "bug_hunter_2", label: "BUG TIER II", iconType: "shield", color: "#3498db", bg: "rgba(52, 152, 219, 0.22)", border: "#3498db" },
  bug_hunter_3: { key: "bug_hunter_3", label: "BUG TIER III", iconType: "lightning", color: "#9b59b6", bg: "rgba(155, 89, 182, 0.22)", border: "#9b59b6" },
  bug_hunter_4: { key: "bug_hunter_4", label: "BUG TIER IV", iconType: "gem", color: "#e67e22", bg: "rgba(230, 126, 34, 0.22)", border: "#e67e22" },
  bug_hunter_5: { key: "bug_hunter_5", label: "BUG MASTER", iconType: "crown", color: "#e74c3c", bg: "rgba(231, 76, 60, 0.22)", border: "#e74c3c" },
};

const badgeImageCache = new Map<string, any>();

async function getCachedImage(url: string): Promise<any> {
  if (badgeImageCache.has(url)) return badgeImageCache.get(url);
  try {
    const img = await loadImage(url);
    if (img) badgeImageCache.set(url, img);
    return img;
  } catch {
    return null;
  }
}

/**
 * Renders custom Canvas 2D vector icons without relying on OS emoji fonts
 */
function drawVectorIcon(ctx: any, iconType: VectorIconType, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  if (iconType === "triangle") {
    ctx.beginPath();
    const top = cy - size * 0.45;
    const bottom = cy + size * 0.45;
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + size * 0.45, bottom);
    ctx.lineTo(cx - size * 0.45, bottom);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "crown") {
    ctx.beginPath();
    const w = size * 1.1;
    const h = size * 0.85;
    const left = cx - w / 2;
    const top = cy - h / 2;
    ctx.moveTo(left, top + h);
    ctx.lineTo(left, top + h * 0.2);
    ctx.lineTo(left + w * 0.25, top + h * 0.6);
    ctx.lineTo(left + w * 0.5, top);
    ctx.lineTo(left + w * 0.75, top + h * 0.6);
    ctx.lineTo(left + w, top + h * 0.2);
    ctx.lineTo(left + w, top + h);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "co_crown") {
    ctx.beginPath();
    const w = size * 1.05;
    const h = size * 0.8;
    const left = cx - w / 2;
    const top = cy - h / 2;
    ctx.moveTo(left, top + h);
    ctx.lineTo(left, top + h * 0.35);
    ctx.lineTo(left + w * 0.25, top + h * 0.65);
    ctx.lineTo(left + w * 0.5, top);
    ctx.lineTo(left + w * 0.75, top + h * 0.65);
    ctx.lineTo(left + w, top + h * 0.35);
    ctx.lineTo(left + w, top + h);
    ctx.closePath();
    ctx.fill();
    // Inner jewel dot
    ctx.beginPath();
    ctx.arc(cx, top + h * 0.55, size * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  } else if (iconType === "shield") {
    ctx.beginPath();
    const w = size * 0.85;
    const h = size * 1.0;
    const left = cx - w / 2;
    const top = cy - h / 2;
    ctx.moveTo(left, top);
    ctx.lineTo(left + w, top);
    ctx.lineTo(left + w, top + h * 0.45);
    ctx.quadraticCurveTo(left + w, top + h * 0.85, cx, top + h);
    ctx.quadraticCurveTo(left, top + h * 0.85, left, top + h * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "flask") {
    ctx.beginPath();
    const w = size * 0.85;
    const h = size * 1.0;
    const left = cx - w / 2;
    const top = cy - h / 2;
    ctx.moveTo(cx - w * 0.2, top);
    ctx.lineTo(cx + w * 0.2, top);
    ctx.lineTo(cx + w * 0.2, top + h * 0.35);
    ctx.lineTo(left + w, top + h * 0.9);
    ctx.quadraticCurveTo(left + w, top + h, cx, top + h);
    ctx.quadraticCurveTo(left, top + h, left, top + h * 0.9);
    ctx.lineTo(cx - w * 0.2, top + h * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "star") {
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = size * 0.5;
    const innerRadius = size * 0.22;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "flame") {
    ctx.beginPath();
    const top = cy - size * 0.5;
    const bottom = cy + size * 0.5;
    ctx.moveTo(cx, top);
    ctx.quadraticCurveTo(cx + size * 0.4, cy, cx + size * 0.35, bottom);
    ctx.quadraticCurveTo(cx, bottom + size * 0.1, cx - size * 0.35, bottom);
    ctx.quadraticCurveTo(cx - size * 0.4, cy, cx, top);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "gem") {
    ctx.beginPath();
    const w = size * 1.0;
    const h = size * 0.85;
    const left = cx - w / 2;
    const top = cy - h / 2;
    ctx.moveTo(left + w * 0.25, top);
    ctx.lineTo(left + w * 0.75, top);
    ctx.lineTo(left + w, top + h * 0.35);
    ctx.lineTo(cx, top + h);
    ctx.lineTo(left, top + h * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "lightning") {
    ctx.beginPath();
    const w = size * 0.75;
    const h = size * 1.05;
    const left = cx - w / 2;
    const top = cy - h / 2;
    ctx.moveTo(cx + w * 0.1, top);
    ctx.lineTo(left, top + h * 0.55);
    ctx.lineTo(cx - w * 0.1, top + h * 0.55);
    ctx.lineTo(cx - w * 0.2, top + h);
    ctx.lineTo(left + w, top + h * 0.45);
    ctx.lineTo(cx + w * 0.1, top + h * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "trophy") {
    const w = size * 0.8;
    const h = size;
    const top = cy - h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.4, top);
    ctx.lineTo(cx + w * 0.4, top);
    ctx.lineTo(cx + w * 0.35, top + h * 0.5);
    ctx.quadraticCurveTo(cx, top + h * 0.7, cx - w * 0.35, top + h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - w * 0.1, top + h * 0.65, w * 0.2, h * 0.2);
    ctx.fillRect(cx - w * 0.3, top + h * 0.85, w * 0.6, h * 0.15);
  } else if (iconType === "signal") {
    const barW = size * 0.22;
    const spacing = size * 0.1;
    const startX = cx - (barW * 3 + spacing * 2) / 2;
    const bottomY = cy + size * 0.45;
    ctx.fillRect(startX, bottomY - size * 0.35, barW, size * 0.35);
    ctx.fillRect(startX + barW + spacing, bottomY - size * 0.65, barW, size * 0.65);
    ctx.fillRect(startX + (barW + spacing) * 2, bottomY - size * 0.95, barW, size * 0.95);
  }

  ctx.restore();
}

/**
 * Renders an AI Studio custom high-fidelity dynamic profile image card using Canvas
 */
export async function renderProfileCard(data: UserProfileData): Promise<Buffer> {
  const width = 1000;
  const height = 580;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Deep Cyber Obsidian Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#080b12");
  bgGrad.addColorStop(0.4, "#0f1629");
  bgGrad.addColorStop(0.8, "#141126");
  bgGrad.addColorStop(1, "#090a12");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Background Glowing Audio Equalizer Grid Lines
  ctx.save();
  ctx.globalAlpha = 0.08;
  const barCount = 52;
  const barWidth = 12;
  const spacing = 6;
  for (let i = 0; i < barCount; i++) {
    const x = 30 + i * (barWidth + spacing);
    const barHeight = Math.sin(i * 0.35) * 140 + Math.cos(i * 0.6) * 90 + 160;
    const y = height - barHeight;
    const waveGrad = ctx.createLinearGradient(x, y, x, height);
    waveGrad.addColorStop(0, data.premiumTier > 0 ? "#f1c40f" : "#5865f2");
    waveGrad.addColorStop(1, "#3b82f6");
    ctx.fillStyle = waveGrad;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
  ctx.restore();

  // 3. Main Glassmorphic Outer Container
  ctx.save();
  ctx.fillStyle = "rgba(15, 20, 35, 0.75)";
  ctx.strokeStyle = data.premiumTier > 0 ? "rgba(241, 196, 15, 0.4)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 2.5;
  const rx = 35;
  const ry = 35;
  const rw = width - 70;
  const rh = height - 70;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 28);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Avatar Image with Double Glowing Ring
  const avatarX = 65;
  const avatarY = 60;
  const avatarSize = 135;

  try {
    const avatarImg = await loadImage(data.avatarUrl);
    ctx.save();
    // Avatar Outer Glow Ring
    ctx.shadowColor = data.premiumTier > 0 ? "#f1c40f" : "#5865f2";
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.fillStyle = data.premiumTier > 0 ? "#f1c40f" : "#5865f2";
    ctx.fill();

    // Clip Avatar Circle
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    logger.debug({ err }, "Could not load avatar for canvas profile card");
  }

  // 5. Header Typography (Username & User Details)
  const textX = 220;

  ctx.font = "bold 34px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.username, textX, 95);

  ctx.font = "13px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const joinedStr = data.joinedAt || "Apr 23, 2026";
  const createdStr = data.createdAt || "Dec 4, 2023";
  ctx.fillText(`ID: ${data.userId} • Joined: ${joinedStr} • Created: ${createdStr}`, textX, 122);

  // 6. Badges Pill Row with Vector Icons
  let badgeX = textX;
  const badgeY = 136;
  const badgeH = 22;

  const defaultBadges = [];
  if (data.isBotStaff) defaultBadges.push("owner", "admin");
  if (data.premiumTier > 0) defaultBadges.push(`premium_${data.premiumTier}`);
  if (data.noPrefixEnabled) defaultBadges.push("no_prefix");
  if (data.isBotStaff) defaultBadges.push("bot_staff");

  const badgesToRender = data.badges && data.badges.length > 0 ? data.badges : defaultBadges;

  for (const bKey of badgesToRender) {
    const meta = BADGE_CONFIGS[bKey];
    if (!meta) continue;

    ctx.save();
    ctx.font = "bold 11px sans-serif";
    const textWidth = ctx.measureText(meta.label).width;
    const iconSize = 14;
    const pillW = 8 + iconSize + 6 + textWidth + 10;

    ctx.fillStyle = meta.bg;
    ctx.strokeStyle = meta.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, pillW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    // Draw high-fidelity custom emoji image if available, fallback to vector
    const emojiUrl = BADGE_EMOJI_URLS[bKey];
    const loadedImg = emojiUrl ? await getCachedImage(emojiUrl) : null;

    if (loadedImg) {
      ctx.drawImage(loadedImg, badgeX + 8, badgeY + badgeH / 2 - 7, 14, 14);
    } else {
      const iconCx = badgeX + 11;
      const iconCy = badgeY + badgeH / 2;
      drawVectorIcon(ctx, meta.iconType, iconCx, iconCy, 10, meta.color);
    }

    // Draw Badge Text
    ctx.fillStyle = meta.color;
    ctx.fillText(meta.label, badgeX + 8 + iconSize + 6, badgeY + 15);
    ctx.restore();

    badgeX += pillW + 8;
    if (badgeX > width - 100) break;
  }

  // 7. Level & XP Progress Bar
  const barY = 175;
  const userLevel = data.level ?? 0;
  const currentXp = data.xp ?? 0;
  const targetXp = data.nextLevelXp ?? 100;
  const pct = Math.min(100, Math.max(0, data.progressPercent ?? Math.round((currentXp / Math.max(1, targetXp)) * 100)));

  // Level badge on left
  ctx.save();
  ctx.fillStyle = "#5865f2";
  ctx.beginPath();
  ctx.roundRect(textX, barY, 54, 20, 6);
  ctx.fill();

  ctx.font = "bold 10px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`LVL ${userLevel}`, textX + 8, barY + 14);

  // Bar track
  const trackX = textX + 64;
  const trackW = 514;
  ctx.fillStyle = "#1a202c";
  ctx.beginPath();
  ctx.roundRect(trackX, barY + 5, trackW, 10, 5);
  ctx.fill();

  // Bar fill
  const fillW = Math.max(8, trackW * (pct / 100));
  const barGrad = ctx.createLinearGradient(trackX, barY, trackX + fillW, barY);
  barGrad.addColorStop(0, "#3b82f6");
  barGrad.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  ctx.roundRect(trackX, barY + 5, fillW, 10, 5);
  ctx.fill();

  // XP Text
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#a0aec0";
  ctx.fillText(`${currentXp} / ${targetXp} XP (${pct}%)`, trackX + trackW + 12, barY + 14);
  ctx.restore();

  // 8. 4 Grid Status Cards (Horizontal Row)
  const gridY = 210;
  const isPrem = data.premiumTier > 0;

  // Card 1: Premium VIP
  ctx.save();
  ctx.fillStyle = isPrem ? "rgba(241, 196, 15, 0.08)" : "rgba(255, 255, 255, 0.04)";
  ctx.strokeStyle = isPrem ? "rgba(241, 196, 15, 0.5)" : "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(65, gridY, 210, 75, 14);
  ctx.fill();
  ctx.stroke();

  // Header with Custom Emoji white_Premium
  const premImg = await getCachedImage("https://cdn.discordapp.com/emojis/1555133783634616371.png");
  if (premImg) {
    ctx.drawImage(premImg, 76, gridY + 14, 16, 16);
  } else {
    drawVectorIcon(ctx, "crown", 81, gridY + 22, 11, isPrem ? "#f1c40f" : "#95a5a6");
  }
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = isPrem ? "#f1c40f" : "#95a5a6";
  ctx.fillText("PREMIUM VIP", 97, gridY + 26);

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(isPrem ? `${data.premiumTierName}` : "Standard Free", 81, gridY + 54);
  ctx.restore();

  // Card 2: No-Prefix Mode (With Custom Emoji white_no_prefix & Toggle Switch Graphic)
  ctx.save();
  const isNp = data.noPrefixEnabled;
  const npColor = isNp ? "#2ecc71" : "#e74c3c";
  ctx.fillStyle = isNp ? "rgba(46, 204, 113, 0.08)" : "rgba(231, 76, 60, 0.08)";
  ctx.strokeStyle = isNp ? "rgba(46, 204, 113, 0.5)" : "rgba(231, 76, 60, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(290, gridY, 210, 75, 14);
  ctx.fill();
  ctx.stroke();

  // Header with Custom Emoji white_no_prefix
  const npImg = await getCachedImage("https://cdn.discordapp.com/emojis/1555133762734657581.png");
  if (npImg) {
    ctx.drawImage(npImg, 301, gridY + 14, 16, 16);
  } else {
    drawVectorIcon(ctx, "lightning", 306, gridY + 21, 10, npColor);
  }
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = npColor;
  ctx.fillText("NO-PREFIX MODE", 322, gridY + 24);

  // ON / OFF Toggle Switch Capsule Graphic
  const btnX = 306;
  const btnY = gridY + 35;
  const btnW = 80;
  const btnH = 26;
  const btnRadius = 13;

  ctx.fillStyle = isNp ? "#2ecc71" : "rgba(231, 76, 60, 0.35)";
  ctx.strokeStyle = isNp ? "#27ae60" : "#e74c3c";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, btnRadius);
  ctx.fill();
  ctx.stroke();

  // Toggle Knob Circle
  const knobRadius = 9;
  const knobX = isNp ? btnX + btnW - knobRadius - 4 : btnX + knobRadius + 4;
  const knobY = btnY + btnH / 2;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
  ctx.fill();

  // Text inside toggle button
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#ffffff";
  if (isNp) {
    ctx.fillText("ON", btnX + 12, btnY + 17);
  } else {
    ctx.fillText("OFF", btnX + 38, btnY + 17);
  }
  ctx.restore();

  // Card 3: Server Rank with Custom Emoji white_first
  ctx.save();
  ctx.fillStyle = "rgba(155, 89, 182, 0.08)";
  ctx.strokeStyle = "rgba(155, 89, 182, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(515, gridY, 210, 75, 14);
  ctx.fill();
  ctx.stroke();

  const rankImg = await getCachedImage("https://cdn.discordapp.com/emojis/1555133634346750035.png");
  if (rankImg) {
    ctx.drawImage(rankImg, 526, gridY + 14, 16, 16);
  } else {
    drawVectorIcon(ctx, "trophy", 531, gridY + 22, 11, "#a855f7");
  }
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#a855f7";
  ctx.fillText("SERVER RANK", 547, gridY + 26);

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.serverRank || "Unranked", 531, gridY + 54);
  ctx.restore();

  // Card 4: Audio DSP Tier with Custom Emoji white_musicnote
  ctx.save();
  ctx.fillStyle = "rgba(0, 180, 216, 0.08)";
  ctx.strokeStyle = "rgba(0, 180, 216, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(740, gridY, 195, 75, 14);
  ctx.fill();
  ctx.stroke();

  const audioImg = await getCachedImage("https://cdn.discordapp.com/emojis/1555133737837006910.png");
  if (audioImg) {
    ctx.drawImage(audioImg, 751, gridY + 14, 16, 16);
  } else {
    drawVectorIcon(ctx, "signal", 756, gridY + 22, 10, "#38bdf8");
  }
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText("AUDIO DSP TIER", 772, gridY + 26);

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.audioDspQuality || (data.premiumTier > 0 ? "384kbps FLAC" : "320kbps MP3"), 756, gridY + 54);
  ctx.restore();

  // 9. Server Roles Row
  const rolesY = 300;
  ctx.save();
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#718096";
  ctx.fillText("SERVER ROLES:", 65, rolesY + 16);

  let roleX = 165;
  const rolesToDisplay = data.serverRoles && data.serverRoles.length > 0 ? data.serverRoles : ["None"];

  for (const roleName of rolesToDisplay) {
    const cleanName = roleName
      .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim() || "Role";

    ctx.font = "11px sans-serif";
    const nameWidth = ctx.measureText(cleanName).width;
    const pillW = nameWidth + 18;

    ctx.fillStyle = cleanName === "None" ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.08)";
    ctx.strokeStyle = cleanName === "None" ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(roleX, rolesY, pillW, 22, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cleanName === "None" ? "#718096" : "#e2e8f0";
    ctx.fillText(cleanName, roleX + 9, rolesY + 15);

    roleX += pillW + 8;
    if (roleX > width - 100) break;
  }
  ctx.restore();

  // 10. User Biography & Status Box
  const bioY = 338;
  const bioW = width - 130;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(65, bioY, bioW, 160, 18);
  ctx.fill();
  ctx.stroke();

  // Accent Yellow Line on Left
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.roundRect(78, bioY + 15, 5, 130, 3);
  ctx.fill();

  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#f1c40f";
  ctx.fillText("USER BIOGRAPHY & STATUS", 98, bioY + 36);

  ctx.font = "italic 18px sans-serif";
  ctx.fillStyle = "#e2e8f0";

  // Wrap bio text
  const maxBioWidth = bioW - 60;
  const words = data.bio.split(" ");
  let currentLine = "";
  let lineY = bioY + 70;

  for (let w = 0; w < words.length; w++) {
    const testLine = currentLine + words[w] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxBioWidth && w > 0) {
      ctx.fillText(currentLine, 98, lineY);
      currentLine = words[w] + " ";
      lineY += 28;
      if (lineY > bioY + 140) break;
    } else {
      currentLine = testLine;
    }
  }
  if (lineY <= bioY + 140) {
    ctx.fillText(currentLine, 98, lineY);
  }
  ctx.restore();

  // 11. Footer Branding Line
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillText("RELOSTA VIP AUDIO ENGINE • OFFICIAL DISCORD USER PROFILE", 65, height - 22);

  return canvas.toBuffer("image/png");
}
