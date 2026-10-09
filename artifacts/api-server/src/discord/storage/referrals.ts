import { dataFile } from "../../lib/paths";
import { logger } from "../../lib/logger";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { grantDirectPremium, LIFETIME_TIMESTAMP } from "./premium";
import type { Guild, GuildMember, Role } from "discord.js";

const STORE = "referral_store";
const FILE = () => dataFile("referral_store.json");

export type ReferralType = "server" | "user" | "partner";

export interface ReferralCode {
  code: string;
  type: ReferralType;
  ownerId: string;
  ownerName: string;
  createdBy: string;
  createdAt: number;
  maxUses: number; // -1 for unlimited
  usesCount: number;
  redeemedGuilds: string[];
  redeemedUserIds: string[];
}

export interface UserReferralData {
  userId: string;
  userName: string;
  points: number;
  serverRedeems: number;
  userRedeems: number;
  partnerRedeems: number;
  codes: string[];
}

export interface PartnerGuildConfig {
  guildId: string;
  guildName: string;
  redeemedCode: string;
  redeemedBy: string;
  redeemedAt: number;
  juniorStaffRoleId?: string;
  higherStaffRoleId?: string;
  juniorStaffRoleName?: string;
  higherStaffRoleName?: string;
  rolesConfiguredAt?: number;
}

interface ReferralStore {
  codes: Record<string, ReferralCode>; // Key: code string (uppercase)
  users: Record<string, UserReferralData>; // Key: userId
  partnerGuilds: Record<string, PartnerGuildConfig>; // Key: guildId
}

let cache: ReferralStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<ReferralStore> {
  if (cache) return cache;
  cache = await loadPersistentJson<ReferralStore>(STORE, FILE(), {
    codes: {},
    users: {},
    partnerGuilds: {},
  });
  if (!cache.codes) cache.codes = {};
  if (!cache.users) cache.users = {};
  if (!cache.partnerGuilds) cache.partnerGuilds = {};
  return cache;
}

async function save(store: ReferralStore): Promise<void> {
  cache = store;
  writeQueue = writeQueue
    .then(async () => {
      await persistPersistentJson(STORE, FILE(), store);
    })
    .catch((err) => {
      logger.error({ err }, "Failed to save referral_store.json");
    });
  await writeQueue;
}

export function generateRandomCode(prefix: string, name?: string): string {
  const cleanName = (name || "REF")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix.toUpperCase()}-${cleanName}-${rand}`;
}

/**
  * Create or assign a referral code (Owner / Bot Admin command)
  */
export async function createReferralCode(options: {
  code?: string;
  type: ReferralType;
  ownerId: string;
  ownerName: string;
  createdBy: string;
  maxUses?: number;
}): Promise<ReferralCode> {
  const store = await load();
  const typePrefix = options.type === "partner" ? "PARTNER" : options.type === "server" ? "SERVER" : "REF";
  const rawCode = options.code?.trim() ? options.code.trim().toUpperCase() : generateRandomCode(typePrefix, options.ownerName);
  
  if (store.codes[rawCode]) {
    throw new Error(`Referral code \`${rawCode}\` already exists! Please choose a different code.`);
  }

  const newCode: ReferralCode = {
    code: rawCode,
    type: options.type,
    ownerId: options.ownerId,
    ownerName: options.ownerName,
    createdBy: options.createdBy,
    createdAt: Date.now(),
    maxUses: options.maxUses ?? -1,
    usesCount: 0,
    redeemedGuilds: [],
    redeemedUserIds: [],
  };

  store.codes[rawCode] = newCode;

  // Initialize or update user stats
  if (!store.users[options.ownerId]) {
    store.users[options.ownerId] = {
      userId: options.ownerId,
      userName: options.ownerName,
      points: 0,
      serverRedeems: 0,
      userRedeems: 0,
      partnerRedeems: 0,
      codes: [],
    };
  }

  if (!store.users[options.ownerId].codes.includes(rawCode)) {
    store.users[options.ownerId].codes.push(rawCode);
  }

  await save(store);
  return newCode;
}

/**
  * Get referral code details
  */
export async function getReferralCode(codeStr: string): Promise<ReferralCode | null> {
  const store = await load();
  return store.codes[codeStr.trim().toUpperCase()] ?? null;
}

/**
  * List all referral codes created for a user or globally
  */
export async function listReferralCodes(ownerId?: string): Promise<ReferralCode[]> {
  const store = await load();
  const all = Object.values(store.codes);
  if (ownerId) {
    return all.filter((c) => c.ownerId === ownerId);
  }
  return all;
}

/**
  * Get user referral statistics / points
  */
export async function getUserReferralStats(userId: string): Promise<UserReferralData> {
  const store = await load();
  return (
    store.users[userId] ?? {
      userId,
      userName: "Unknown",
      points: 0,
      serverRedeems: 0,
      userRedeems: 0,
      partnerRedeems: 0,
      codes: [],
    }
  );
}

/**
  * Get top referral leaderboard
  */
export async function getReferralLeaderboard(limit = 10): Promise<UserReferralData[]> {
  const store = await load();
  return Object.values(store.users)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

/**
  * Redeem a referral code in a server or for a user
  */
export async function redeemReferralCode(options: {
  codeStr: string;
  redeemerUser: { id: string; username: string };
  guild?: Guild | null;
}): Promise<{
  success: boolean;
  message: string;
  code?: ReferralCode;
  requiresStaffRoleSetup?: boolean;
}> {
  const store = await load();
  const cleanCode = options.codeStr.trim().toUpperCase();
  const code = store.codes[cleanCode];

  if (!code) {
    return { success: false, message: `Referral code \`${cleanCode}\` was not found or is invalid.` };
  }

  if (code.maxUses > 0 && code.usesCount >= code.maxUses) {
    return { success: false, message: `Referral code \`${cleanCode}\` has reached its maximum usage limit.` };
  }

  // Type: Server
  if (code.type === "server") {
    if (!options.guild) {
      return { success: false, message: "Server referral codes must be redeemed inside a server!" };
    }
    if (code.redeemedGuilds.includes(options.guild.id)) {
      return { success: false, message: `This server (**${options.guild.name}**) has already redeemed this server referral code!` };
    }

    // Grant 30 Days Server Premium
    await grantDirectPremium(options.guild.id, "server", 30);

    code.usesCount += 1;
    code.redeemedGuilds.push(options.guild.id);

    // Award +1 point to code owner
    const ownerData = store.users[code.ownerId] ?? {
      userId: code.ownerId,
      userName: code.ownerName,
      points: 0,
      serverRedeems: 0,
      userRedeems: 0,
      partnerRedeems: 0,
      codes: [cleanCode],
    };
    ownerData.points += 1;
    ownerData.serverRedeems += 1;
    store.users[code.ownerId] = ownerData;

    await save(store);
    return {
      success: true,
      message: `🎉 **Server Referral Activated!**\n\nGranted **30 Days Server Premium** to **${options.guild.name}**!\nReferral owner **${code.ownerName}** earned **+1 Referral Point**!`,
      code,
    };
  }

  // Type: User
  if (code.type === "user") {
    if (code.redeemedUserIds.includes(options.redeemerUser.id)) {
      return { success: false, message: "You have already redeemed this user referral code!" };
    }

    // Grant 30 Days User Premium
    await grantDirectPremium(options.redeemerUser.id, "user", 30);

    code.usesCount += 1;
    code.redeemedUserIds.push(options.redeemerUser.id);

    // Award +1 point to code owner
    const ownerData = store.users[code.ownerId] ?? {
      userId: code.ownerId,
      userName: code.ownerName,
      points: 0,
      serverRedeems: 0,
      userRedeems: 0,
      partnerRedeems: 0,
      codes: [cleanCode],
    };
    ownerData.points += 1;
    ownerData.userRedeems += 1;
    store.users[code.ownerId] = ownerData;

    await save(store);
    return {
      success: true,
      message: `🌟 **User Referral Activated!**\n\nGranted **30 Days User Premium** to **${options.redeemerUser.username}**!\nReferral owner **${code.ownerName}** earned **+1 Referral Point**!`,
      code,
    };
  }

  // Type: Partner
  if (code.type === "partner") {
    if (!options.guild) {
      return { success: false, message: "Partner referral codes must be redeemed inside a server!" };
    }
    if (code.redeemedGuilds.includes(options.guild.id)) {
      return { success: false, message: `This server (**${options.guild.name}**) has already redeemed this partner code!` };
    }

    // 1. Grant Lifetime Server Premium to Guild
    await grantDirectPremium(options.guild.id, "server", 9999);

    // 2. Grant Lifetime User Premium to Guild Owner (Server Owner)
    if (options.guild.ownerId) {
      await grantDirectPremium(options.guild.ownerId, "user", 9999);
      logger.info({ guildId: options.guild.id, ownerId: options.guild.ownerId }, "Granted Lifetime User Premium to Server Owner on Partner code redemption");
    }

    code.usesCount += 1;
    code.redeemedGuilds.push(options.guild.id);

    // Record Partner Guild Config
    store.partnerGuilds[options.guild.id] = {
      guildId: options.guild.id,
      guildName: options.guild.name,
      redeemedCode: cleanCode,
      redeemedBy: options.redeemerUser.id,
      redeemedAt: Date.now(),
    };

    // Award +5 points to partner referral owner
    const ownerData = store.users[code.ownerId] ?? {
      userId: code.ownerId,
      userName: code.ownerName,
      points: 0,
      serverRedeems: 0,
      userRedeems: 0,
      partnerRedeems: 0,
      codes: [cleanCode],
    };
    ownerData.points += 5;
    ownerData.partnerRedeems += 1;
    store.users[code.ownerId] = ownerData;

    await save(store);

    return {
      success: true,
      message:
        `🤝 **PARTNER REFERRAL ACTIVATED!**\n\n` +
        `• **Server Perk:** Granted **LIFETIME SERVER PREMIUM** to **${options.guild.name}**!\n` +
        `• **Staff Perks Pending:** Junior Staff (1 Year Premium) & Higher Staff (Lifetime Premium).\n` +
        `• **Partner Rewards:** Referral owner **${code.ownerName}** earned **+5 Referral Points**!\n\n` +
        `⚠️ **Action Required:** Please select your server's **Junior Staff Role** and **Higher Staff Role** below to activate staff premium perks!`,
      code,
      requiresStaffRoleSetup: true,
    };
  }

  return { success: false, message: "Unknown referral code type." };
}

/**
  * Configure Partner Staff Roles for a server & grant staff premiums
  */
export async function savePartnerStaffRoles(options: {
  guild: Guild;
  juniorStaffRoleId: string;
  higherStaffRoleId: string;
}): Promise<{
  success: boolean;
  juniorCount: number;
  higherCount: number;
  message: string;
}> {
  const store = await load();
  const cfg = store.partnerGuilds[options.guild.id];

  if (!cfg) {
    return {
      success: false,
      juniorCount: 0,
      higherCount: 0,
      message: `No partner redemption found for **${options.guild.name}**. Please redeem a Partner code first!`,
    };
  }

  const juniorRole = options.guild.roles.cache.get(options.juniorStaffRoleId);
  const higherRole = options.guild.roles.cache.get(options.higherStaffRoleId);

  if (!juniorRole || !higherRole) {
    return {
      success: false,
      juniorCount: 0,
      higherCount: 0,
      message: "One or both selected staff roles do not exist in this server.",
    };
  }

  cfg.juniorStaffRoleId = juniorRole.id;
  cfg.juniorStaffRoleName = juniorRole.name;
  cfg.higherStaffRoleId = higherRole.id;
  cfg.higherStaffRoleName = higherRole.name;
  cfg.rolesConfiguredAt = Date.now();

  store.partnerGuilds[options.guild.id] = cfg;
  await save(store);

  // Grant 1 Year Premium to all members with Junior Staff Role
  let juniorCount = 0;
  for (const member of juniorRole.members.values()) {
    if (member.user.bot) continue;
    await grantDirectPremium(member.id, "user", 365);
    juniorCount++;
  }

  // Grant Lifetime Premium to all members with Higher Staff Role
  let higherCount = 0;
  for (const member of higherRole.members.values()) {
    if (member.user.bot) continue;
    await grantDirectPremium(member.id, "user", 9999);
    higherCount++;
  }

  return {
    success: true,
    juniorCount,
    higherCount,
    message:
      `✅ **Partner Staff Roles Successfully Configured!**\n\n` +
      `• **Junior Staff Role:** <@&${juniorRole.id}> (\`${juniorRole.name}\`)\n` +
      `  └ Granted **1 Year User Premium** to **${juniorCount}** member(s)!\n` +
      `• **Higher Staff Role:** <@&${higherRole.id}> (\`${higherRole.name}\`)\n` +
      `  └ Granted **LIFETIME User Premium** to **${higherCount}** member(s)!\n\n` +
      `*Staff members holding these roles automatically hold premium privileges!*`,
  };
}

/**
  * Check Partner Guild Role Integrity Watchdog
  * Verifies if configured Junior or Higher staff roles were deleted or missing.
  */
export async function checkPartnerRolesIntegrity(guild: Guild): Promise<{
  isPartnerGuild: boolean;
  rolesValid: boolean;
  missingRoles: string[];
  config?: PartnerGuildConfig;
}> {
  const store = await load();
  const cfg = store.partnerGuilds[guild.id];

  if (!cfg) {
    return { isPartnerGuild: false, rolesValid: true, missingRoles: [] };
  }

  const missing: string[] = [];
  if (!cfg.juniorStaffRoleId || !guild.roles.cache.has(cfg.juniorStaffRoleId)) {
    missing.push(`Junior Staff Role (${cfg.juniorStaffRoleName || "Not Configured"})`);
  }
  if (!cfg.higherStaffRoleId || !guild.roles.cache.has(cfg.higherStaffRoleId)) {
    missing.push(`Higher Staff Role (${cfg.higherStaffRoleName || "Not Configured"})`);
  }

  return {
    isPartnerGuild: true,
    rolesValid: missing.length === 0,
    missingRoles: missing,
    config: cfg,
  };
}

/**
  * Get all partner guild configs
  */
export async function getPartnerGuildConfig(guildId: string): Promise<PartnerGuildConfig | null> {
  const store = await load();
  return store.partnerGuilds[guildId] ?? null;
}
