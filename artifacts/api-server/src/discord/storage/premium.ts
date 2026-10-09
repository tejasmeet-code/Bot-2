import { EmbedBuilder } from "discord.js";
import { dataFile } from "../../lib/paths";
import { logger } from "../../lib/logger";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { CE } from "../utils/embedStyle";

const STORE = "premium_store";
const FILE = () => dataFile("premium_store.json");

export const PERMANENT_BOT_OWNER_ID = "1181221352393420856";

export function isPermanentOwner(userId: string): boolean {
  return userId === PERMANENT_BOT_OWNER_ID;
}

export const BOT_ADMIN_IDS = new Set<string>([
  "1181221352393420856",
  "1384512046200127570",
  "867277178684178453",
  "1466728565352435847",
  "1414620491544658021",
  "1209755174420221984",
]);

export function isBotAdmin(userId: string): boolean {
  if (userId === PERMANENT_BOT_OWNER_ID) return true;
  if (BOT_ADMIN_IDS.has(userId)) return true;
  if (process.env.DISCORD_OWNER_ID && process.env.DISCORD_OWNER_ID.split(",").includes(userId)) {
    return true;
  }
  return false;
}

export interface PremiumCode {
  code: string;
  codeType: "user" | "server";
  durationDays: number;
  guildLimit: number;
  redeemedCount: number;
  createdAt: number;
}

export interface PremiumRoleConfig {
  guildId: string;
  roleId: string;
  setBy: string;
  createdAt: number;
}

interface PremiumStore {
  codes: Record<string, PremiumCode>;
  userPremiums: Record<string, number>;
  guildPremiums: Record<string, number>;
  premiumRoles?: Record<string, PremiumRoleConfig>; // key: `${guildId}:${roleId}`
  notifiedLifetimeUsers?: string[];
  notifiedStaffBriefing?: string[];
}

let cache: PremiumStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export const LIFETIME_TIMESTAMP = 4102444800000; // Year 2100+ Lifetime
const NINETY_NINE_NINETY_NINE_DAYS_MS = 9999 * 24 * 60 * 60 * 1000;

async function load(): Promise<PremiumStore> {
  if (cache) return cache;
  cache = await loadPersistentJson<PremiumStore>(STORE, FILE(), {
    codes: {},
    userPremiums: {},
    guildPremiums: {},
    premiumRoles: {},
    notifiedLifetimeUsers: [],
    notifiedStaffBriefing: [],
  });
  if (!cache.premiumRoles) cache.premiumRoles = {};
  if (!cache.notifiedLifetimeUsers) cache.notifiedLifetimeUsers = [];
  if (!cache.notifiedStaffBriefing) cache.notifiedStaffBriefing = [];

  // Hardcoded owner and all bot admins always hold permanent lifetime premium
  cache.userPremiums[PERMANENT_BOT_OWNER_ID] = LIFETIME_TIMESTAMP;
  for (const adminId of BOT_ADMIN_IDS) {
    if (!cache.userPremiums[adminId]) {
      cache.userPremiums[adminId] = LIFETIME_TIMESTAMP;
    }
  }

  // Auto-migrate any existing users or guilds that have ~9999 days to lifetime
  const now = Date.now();
  let migrated = false;
  for (const [id, exp] of Object.entries(cache.userPremiums)) {
    if (exp >= LIFETIME_TIMESTAMP) continue;
    // If the remaining time or total expiry is >= 9000 days from now, or within 9999 days calculation
    if (exp - now >= (9000 * 24 * 60 * 60 * 1000)) {
      cache.userPremiums[id] = LIFETIME_TIMESTAMP;
      migrated = true;
    }
  }
  for (const [id, exp] of Object.entries(cache.guildPremiums)) {
    if (exp >= LIFETIME_TIMESTAMP) continue;
    if (exp - now >= (9000 * 24 * 60 * 60 * 1000)) {
      cache.guildPremiums[id] = LIFETIME_TIMESTAMP;
      migrated = true;
    }
  }
  if (migrated) {
    await save(cache);
  }

  return cache;
}

async function save(store: PremiumStore): Promise<void> {
  cache = store;
  writeQueue = writeQueue.then(() => persistPersistentJson(STORE, FILE(), store));
  return writeQueue;
}

export async function createPremiumCode(
  code: string,
  codeType: "user" | "server",
  durationDays: number,
  guildLimit = 1,
): Promise<PremiumCode> {
  const store = await load();
  const entry: PremiumCode = {
    code: code.toUpperCase(),
    codeType,
    durationDays,
    guildLimit: Math.max(1, guildLimit),
    redeemedCount: 0,
    createdAt: Date.now(),
  };
  store.codes[entry.code] = entry;
  await save(store);
  return entry;
}

export async function redeemPremiumCode(
  codeString: string,
  targetId: string,
  targetType: "user" | "server",
): Promise<{ success: boolean; message: string; expiresAt?: number }> {
  const store = await load();
  const code = store.codes[codeString.toUpperCase()];
  if (!code) {
    return { success: false, message: "Invalid premium license code." };
  }
  if (code.codeType !== targetType) {
    return {
      success: false,
      message: `This code is intended for ${code.codeType} premium activation, but was redeemed for a ${targetType}.`,
    };
  }
  if (code.redeemedCount >= code.guildLimit) {
    return {
      success: false,
      message: "This premium license code has already reached its redemption quota limit.",
    };
  }

  let newExpiry: number;
  const now = Date.now();

  if (code.durationDays >= 9999) {
    newExpiry = LIFETIME_TIMESTAMP;
  } else {
    const durationMs = code.durationDays * 24 * 60 * 60 * 1000;
    if (targetType === "user") {
      const existing = store.userPremiums[targetId] ?? now;
      newExpiry = Math.max(now, existing) + durationMs;
    } else {
      const existing = store.guildPremiums[targetId] ?? now;
      newExpiry = Math.max(now, existing) + durationMs;
    }
  }

  if (targetType === "user") {
    store.userPremiums[targetId] = newExpiry;
  } else {
    store.guildPremiums[targetId] = newExpiry;
  }

  code.redeemedCount += 1;
  await save(store);
  return {
    success: true,
    message: `Premium activated successfully until <t:${Math.floor(newExpiry / 1000)}:F>.`,
    expiresAt: newExpiry,
  };
}

export async function sendPremiumRoleAssignedDM(member: any, role: any, guild: any): Promise<boolean> {
  try {
    if (!member || member.user?.bot) return false;
    const dmEmbed = new EmbedBuilder()
      .setTitle(`${CE.trophy.str} Zenith Premium VIP Activated!`)
      .setColor(0xF1C40F)
      .setDescription(
        `Hello **${member.user.username}**! You have been granted the **${role.name}** role in **${guild.name}**, which has granted you full **${CE.trophy.str} Global VIP Premium Access**!\n\n` +
        `### ${CE.trophy.str} Your VIP Benefits & Features:\n` +
        `• ${CE.music.str} **24/7 Voice Channel Radio**: Keep the bot streaming continuously 24/7 with \`.24/7\` or \`/twentyfourseven\`\n` +
        `• ${CE.radio.str} **Remote VC Summoning**: Summon music into any voice channel via channel ID/mention or user ID without joining it\n` +
        `• ${CE.music.str} **Audio DSP Equalizer**: Boost bass, treble, nightcore, vaporwave, 8D audio (\`.eq\`, \`.bass\`)\n` +
        `• ${CE.boost.str} **Global No-Prefix Execution**: Run any bot command seamlessly across servers with zero prefix needed\n` +
        `• ${CE.admin.str} **Advanced Security Suite**: Full clearance across server management tools\n\n` +
        `*Your VIP privileges are active globally across all servers as long as you hold the role!*`,
      )
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
      .setFooter({ text: `Zenith Premium Engine • Guild: ${guild.name}` })
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] });
    logger.info({ userId: member.id, roleId: role.id, guildId: guild.id }, "Delivered Premium Role VIP DM");
    return true;
  } catch (err) {
    logger.debug({ err, userId: member?.id }, "Could not send Premium Role VIP DM (DMs may be disabled)");
    return false;
  }
}

export async function sendPremiumRoleRemovedDM(member: any, role: any, guild: any): Promise<boolean> {
  try {
    if (!member || member.user?.bot) return false;
    const dmEmbed = new EmbedBuilder()
      .setTitle(`${CE.information.str} Zenith Premium Status Update`)
      .setColor(0x747f8d)
      .setDescription(
        `Hello **${member.user.username}**,\n\n` +
        `The **${role.name}** role was removed from your profile in **${guild.name}**. Your role-based VIP Premium subscription has now concluded.\n\n` +
        `If you'd like to acquire a standalone User Premium license, please visit our official support server!`,
      )
      .setFooter({ text: `Zenith Premium Engine • Guild: ${guild.name}` })
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] });
    return true;
  } catch {
    return false;
  }
}

export async function isUserPremium(userId: string, guildId?: string | null, member?: any): Promise<boolean> {
  if (isPermanentOwner(userId)) return true;
  if (isBotAdmin(userId)) return true;
  try {
    const { getBotStaffMember } = await import("./botStaff");
    const staff = await getBotStaffMember(userId);
    if (staff && (staff.role === "owner" || staff.role === "co_owner" || staff.role === "admin")) {
      return true;
    }
  } catch {}
  const store = await load();
  const expiry = store.userPremiums[userId];
  if (expiry && Date.now() <= expiry) {
    return true;
  }
  if (expiry && Date.now() > expiry) {
    delete store.userPremiums[userId];
    await save(store);
  }

  // Check partner staff roles
  try {
    const { getPartnerGuildConfig } = await import("./referrals");
    const client = (globalThis as any).__discordClient;
    if (guildId && client?.guilds?.cache) {
      const g = client.guilds.cache.get(guildId);
      if (g) {
        const pCfg = await getPartnerGuildConfig(guildId);
        if (pCfg) {
          const m = member || g.members.cache.get(userId);
          if (m?.roles?.cache) {
            if (pCfg.juniorStaffRoleId && m.roles.cache.has(pCfg.juniorStaffRoleId)) return true;
            if (pCfg.higherStaffRoleId && m.roles.cache.has(pCfg.higherStaffRoleId)) return true;
          }
        }
      }
    }
  } catch {}

  // Check role-based premium: if user holds any configured premium role
  try {
    const roles = Object.values(store.premiumRoles ?? {});
    if (roles.length > 0) {
      // 1. Direct check on provided member if passed
      if (member?.roles?.cache) {
        for (const pr of roles) {
          if ((!guildId || pr.guildId === guildId) && member.roles.cache.has(pr.roleId)) {
            return true;
          }
        }
      }

      // 2. Cross-guild check via client
      const client = (globalThis as any).__discordClient;
      if (client?.guilds?.cache) {
        for (const pr of roles) {
          const guild = client.guilds.cache.get(pr.guildId);
          if (guild) {
            const role = guild.roles.cache.get(pr.roleId);
            if (role?.members.has(userId)) {
              return true;
            }
            const m = guild.members.cache.get(userId);
            if (m && m.roles.cache.has(pr.roleId)) {
              return true;
            }
          }
        }
      }
    }
  } catch {}

  return false;
}

export async function isGuildPremium(guildId: string, _guild?: any): Promise<boolean> {
  if (!guildId) return false;
  const store = await load();
  const expiry = store.guildPremiums[guildId];
  if (expiry) {
    if (Date.now() <= expiry) {
      return true;
    }
    delete store.guildPremiums[guildId];
    await save(store);
  }
  return false;
}

export async function hasPremiumAccess(userId: string, guildId?: string | null, member?: any): Promise<boolean> {
  if (isPermanentOwner(userId)) return true;
  if (isBotAdmin(userId)) return true;
  if (await isUserPremium(userId, guildId, member)) return true;
  if (guildId && (await isGuildPremium(guildId))) return true;
  return false;
}

export async function grantDirectPremium(
  targetId: string,
  targetType: "user" | "server",
  durationDays: number,
): Promise<{ success: boolean; expiresAt: number; durationDays: number }> {
  const store = await load();
  const now = Date.now();
  let newExpiry: number;

  // If duration is 9999 days or more, grant lifetime
  if (durationDays >= 9999) {
    newExpiry = LIFETIME_TIMESTAMP;
  } else {
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    if (targetType === "user") {
      const existing = store.userPremiums[targetId] ?? now;
      newExpiry = Math.max(now, existing) + durationMs;
    } else {
      const existing = store.guildPremiums[targetId] ?? now;
      newExpiry = Math.max(now, existing) + durationMs;
    }
  }

  if (targetType === "user") {
    store.userPremiums[targetId] = newExpiry;
  } else {
    store.guildPremiums[targetId] = newExpiry;
  }

  await save(store);
  return {
    success: true,
    expiresAt: newExpiry,
    durationDays,
  };
}

export async function removeDirectPremium(
  targetId: string,
  targetType: "user" | "server",
): Promise<{ success: boolean; removed: boolean; message: string }> {
  if (targetType === "user" && isPermanentOwner(targetId)) {
    return {
      success: false,
      removed: false,
      message: "Cannot remove premium from the permanent Bot Owner.",
    };
  }

  const store = await load();
  let removed = false;

  if (targetType === "user") {
    if (store.userPremiums[targetId]) {
      delete store.userPremiums[targetId];
      removed = true;
    }
  } else {
    if (store.guildPremiums[targetId]) {
      delete store.guildPremiums[targetId];
      removed = true;
    }
  }

  if (removed) {
    await save(store);

    if (targetType === "user") {
      try {
        const client = (globalThis as any).__discordClient;
        if (client) {
          const user = await client.users.fetch(targetId).catch(() => null);
          if (user) {
            const { safeSendUserDm } = await import("../utils/dmWebhook");
            const { COLORS, prettyEmbed } = await import("../utils/embedStyle");
            const embed = prettyEmbed({
              title: `${CE.warning.str} Zenith VIP Premium License Revoked`,
              description:
                `Hello <@${targetId}>!\n\n` +
                `Your **Zenith VIP Premium License** has been revoked or expired.\n\n` +
                `• **Status:** License Revoked / Terminated\n` +
                `• **Impact:** Premium features and exclusive privileges have been removed from your account.\n\n` +
                `If you believe this was an error, please visit our official support server or run \`.premium\`.`,
              color: COLORS.danger,
            });
            await safeSendUserDm(user, { embeds: [embed] }).catch(() => {});
          }
        }
      } catch (dmErr) {
        logger.debug({ dmErr, targetId }, "Could not send premium revocation DM");
      }
    }
  }

  return {
    success: true,
    removed,
    message: removed
      ? `Successfully removed ${targetType.toUpperCase()} premium from ${targetType === "user" ? `<@${targetId}>` : `Server \`${targetId}\` `}.`
      : `No active ${targetType.toUpperCase()} premium was found for that target.`,
  };
}

export async function setPremiumRole(
  guildId: string,
  roleId: string,
  setBy: string,
): Promise<{ success: boolean; message: string; notifiedCount: number }> {
  const store = await load();
  if (!store.premiumRoles) store.premiumRoles = {};

  const key = `${guildId}:${roleId}`;
  store.premiumRoles[key] = {
    guildId,
    roleId,
    setBy,
    createdAt: Date.now(),
  };

  await save(store);

  let notifiedCount = 0;
  const client = (globalThis as any).__discordClient;
  if (client) {
    try {
      const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
      if (guild) {
        await guild.members.fetch().catch(() => null);
        const role = guild.roles.cache.get(roleId);
        if (role) {
          const membersWithRole = role.members.filter((m: any) => !m.user.bot);
          for (const member of membersWithRole.values()) {
            const ok = await sendPremiumRoleAssignedDM(member, role, guild);
            if (ok) notifiedCount++;
          }
        }
      }
    } catch (err) {
      logger.warn({ err, guildId, roleId }, "Error sending initial Premium Role DMs");
    }
  }

  const dmSummary = notifiedCount > 0
    ? `\n\n${CE.dm_sent.str} Sent **${notifiedCount} Direct Message(s)** to existing role holders notifying them of their VIP status!`
    : "";

  return {
    success: true,
    message: `Role <@&${roleId}> is now configured as a Premium Role. Members who hold this role will enjoy Global User Premium until the role is removed!${dmSummary}`,
    notifiedCount,
  };
}

export async function removePremiumRole(
  guildId: string,
  roleId: string,
): Promise<{ success: boolean; removed: boolean; message: string }> {
  const store = await load();
  if (!store.premiumRoles) store.premiumRoles = {};

  const key = `${guildId}:${roleId}`;
  if (store.premiumRoles[key]) {
    delete store.premiumRoles[key];
    await save(store);
    return {
      success: true,
      removed: true,
      message: `Role <@&${roleId}> is no longer configured as a Premium Role.`,
    };
  }

  return {
    success: true,
    removed: false,
    message: `Role <@&${roleId}> was not configured as a Premium Role.`,
  };
}

export async function listPremiumRoles(): Promise<PremiumRoleConfig[]> {
  const store = await load();
  return Object.values(store.premiumRoles ?? {});
}

export async function listActivePremiums(): Promise<{
  users: Array<{ id: string; expiresAt: number }>;
  guilds: Array<{ id: string; expiresAt: number }>;
  roles: PremiumRoleConfig[];
}> {
  const store = await load();
  const now = Date.now();

  // Guarantee permanent owner & all bot admins are in userPremiums
  store.userPremiums[PERMANENT_BOT_OWNER_ID] = LIFETIME_TIMESTAMP;
  for (const adminId of BOT_ADMIN_IDS) {
    if (!store.userPremiums[adminId]) {
      store.userPremiums[adminId] = LIFETIME_TIMESTAMP;
    }
  }

  // Also include any active bot staff
  try {
    const { getBotStaff } = await import("./botStaff");
    const staffMap = await getBotStaff();
    for (const userId of Object.keys(staffMap)) {
      if (!store.userPremiums[userId]) {
        store.userPremiums[userId] = LIFETIME_TIMESTAMP;
      }
    }
  } catch {}

  const users = Object.entries(store.userPremiums)
    .filter(([_, exp]) => exp > now)
    .map(([id, expiresAt]) => ({ id, expiresAt }));
  const guilds = Object.entries(store.guildPremiums)
    .filter(([_, exp]) => exp > now)
    .map(([id, expiresAt]) => ({ id, expiresAt }));
  const roles = Object.values(store.premiumRoles ?? {});
  return { users, guilds, roles };
}

export async function canAccessPremiumPanel(userId: string, guildOwnerId?: string | null): Promise<boolean> {
  if (isPermanentOwner(userId)) return true;
  if (isBotAdmin(userId)) return true;
  if (guildOwnerId && userId === guildOwnerId) return true;
  try {
    const { getBotStaffMember } = await import("./botStaff");
    const staff = await getBotStaffMember(userId);
    if (staff && (staff.role === "owner" || staff.role === "co_owner" || staff.role === "admin")) {
      return true;
    }
  } catch {}
  return false;
}

export interface PremiumCheckInfo {
  targetId: string;
  found: boolean;
  type: "user" | "server" | "both" | "unknown";
  isPermanentOwner: boolean;
  isBotAdmin: boolean;
  isBotStaff: boolean;
  staffRole?: string;
  hasUserPremium: boolean;
  userExpiry?: number;
  userDaysLeft?: number;
  isUserLifetime: boolean;
  hasGuildPremium: boolean;
  guildExpiry?: number;
  guildDaysLeft?: number;
  isGuildLifetime: boolean;
  rolePremiums: Array<{ guildId: string; roleId: string; guildName?: string }>;
  isActive: boolean;
  overallPlan: string;
}

export async function checkTargetPremium(targetId: string, client?: any): Promise<PremiumCheckInfo> {
  const store = await load();
  const now = Date.now();

  const isPerm = isPermanentOwner(targetId);
  const isBAdmin = isBotAdmin(targetId);

  let isBStaff = false;
  let staffRole: string | undefined;
  try {
    const { getBotStaffMember } = await import("./botStaff");
    const staff = await getBotStaffMember(targetId);
    if (staff) {
      isBStaff = true;
      staffRole = staff.role;
    }
  } catch {}

  const userExp = store.userPremiums[targetId];
  const hasUserPrem = isPerm || isBAdmin || (userExp !== undefined && userExp > now);
  const isUserLifetime = isPerm || (userExp !== undefined && userExp >= LIFETIME_TIMESTAMP);
  const userDaysLeft = userExp ? Math.max(0, Math.ceil((userExp - now) / (24 * 60 * 60 * 1000))) : undefined;

  const guildExp = store.guildPremiums[targetId];
  const hasGuildPrem = guildExp !== undefined && guildExp > now;
  const isGuildLifetime = guildExp !== undefined && guildExp >= LIFETIME_TIMESTAMP;
  const guildDaysLeft = guildExp ? Math.max(0, Math.ceil((guildExp - now) / (24 * 60 * 60 * 1000))) : undefined;

  const matchedRoles: Array<{ guildId: string; roleId: string; guildName?: string }> = [];
  try {
    const roles = Object.values(store.premiumRoles ?? {});
    if (roles.length > 0 && client?.guilds) {
      for (const pr of roles) {
        const guild = client.guilds.cache.get(pr.guildId);
        if (guild) {
          const member = guild.members.cache.get(targetId);
          if (member && member.roles.cache.has(pr.roleId)) {
            matchedRoles.push({ guildId: pr.guildId, roleId: pr.roleId, guildName: guild.name });
          }
        }
      }
    }
  } catch {}

  let type: "user" | "server" | "both" | "unknown" = "unknown";
  if ((hasUserPrem || matchedRoles.length > 0 || isBStaff) && hasGuildPrem) {
    type = "both";
  } else if (hasGuildPrem) {
    type = "server";
  } else if (hasUserPrem || matchedRoles.length > 0 || isBStaff || isPerm || isBAdmin) {
    type = "user";
  }

  const isActive = hasUserPrem || hasGuildPrem || matchedRoles.length > 0;
  let overallPlan = "Inactive";
  if (isPerm) {
    overallPlan = "Permanent Bot Owner (Lifetime)";
  } else if (isUserLifetime || isGuildLifetime) {
    overallPlan = "Lifetime Premium VIP";
  } else if (hasUserPrem && userDaysLeft) {
    overallPlan = `Active User Premium (${userDaysLeft} days remaining)`;
  } else if (hasGuildPrem && guildDaysLeft) {
    overallPlan = `Active Server Premium (${guildDaysLeft} days remaining)`;
  } else if (matchedRoles.length > 0) {
    overallPlan = `Active Server Premium Role (${matchedRoles.length} configured role${matchedRoles.length > 1 ? "s" : ""})`;
  }

  return {
    targetId,
    found: isActive,
    type,
    isPermanentOwner: isPerm,
    isBotAdmin: isBAdmin,
    isBotStaff: isBStaff,
    staffRole,
    hasUserPremium: hasUserPrem,
    userExpiry: userExp,
    userDaysLeft,
    isUserLifetime,
    hasGuildPremium: hasGuildPrem,
    guildExpiry: guildExp,
    guildDaysLeft,
    isGuildLifetime,
    rolePremiums: matchedRoles,
    isActive,
    overallPlan,
  };
}

/**
 * DMs all users who held ~9997-9999 days (or were migrated to Lifetime)
 * informing them their subscription has been upgraded to permanent Lifetime,
 * listing their full VIP privileges and command list with their purpose.
 */
export async function notifyLifetimeUpgradedUsers(client: any): Promise<{ notifiedCount: number; userIds: string[] }> {
  if (!client?.users) {
    return { notifiedCount: 0, userIds: [] };
  }
  const store = await load();
  if (!store.notifiedLifetimeUsers) store.notifiedLifetimeUsers = [];

  const candidates: string[] = [];
  const now = Date.now();

  for (const [id, exp] of Object.entries(store.userPremiums)) {
    // Check if upgraded to lifetime or within 9000+ days range
    if (exp >= LIFETIME_TIMESTAMP || (exp - now) >= (9000 * 24 * 60 * 60 * 1000)) {
      candidates.push(id);
    }
  }

  const notified: string[] = [];

  for (const userId of candidates) {
    if (store.notifiedLifetimeUsers.includes(userId)) continue;

    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user || user.bot) {
        store.notifiedLifetimeUsers.push(userId);
        continue;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${CE.trophy.str} Zenith Premium: Upgraded to Lifetime Access!`)
        .setColor(0xF1C40F)
        .setDescription(
          `Hello **${user.username}**! We are pleased to notify you that your previous **9,999-Day Premium Subscription** has been officially upgraded to permanent **${CE.trophy.str} Lifetime Access** at no additional charge!\n\n` +
          `Your VIP entitlements are permanently active and will never expire.\n\n` +
          `### ${CE.trophy.str} Your VIP Benefits & Privileges:\n` +
          `• ${CE.radio.str} **Remote VC Audio**: Stream audio directly into any voice channel without needing to join it (\`.play <song> <vc_or_user>\`)\n` +
          `• ${CE.music.str} **24/7 Voice Radio Loop**: Keep Zenith playing in your voice channel 24/7 with auto-reconnection (\`.24/7 <vc_or_user>\`)\n` +
          `• ${CE.boost.str} **Global No-Prefix Execution**: Run any bot command seamlessly across servers with zero prefix needed\n` +
          `• ${CE.promotion.str} **High-Fidelity Audio Bitrate & Priority Processing**: Ultra-low latency voice streaming\n` +
          `• ${CE.admin.str} **Permanent VIP Clearance**: Zero renewal requirements\n\n` +
          `### ${CE.clipboard.str} Available Commands & Their Purpose:\n` +
          `• \`.play <song> [vc_or_user]\` — Stream music or audio directly into voice channels remotely\n` +
          `• \`.24/7 [channel]\` — Locks bot in voice channel with 24/7 continuous radio loop\n` +
          `• \`.pause\` / \`.resume\` — Pause or continue active audio playback\n` +
          `• \`.skip\` — Skip currently playing audio track\n` +
          `• \`.stop\` — Stop playback, reset playlist queue, and safely leave voice\n` +
          `• \`.queue\` / \`.clearqueue\` — Inspect upcoming songs or reset your active playlist\n` +
          `• \`.volume <1-150>\` — Set custom audio playback volume\n` +
          `• \`.loop <track|queue|off>\` — Repeat current audio track or the full queue\n` +
          `• \`.premiumcheck\` — Verify your active Lifetime status and entitlements at any time\n\n` +
          `Thank you for being one of our premier supporters! Enjoy your permanent VIP access.`,
        )
        .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
        .setFooter({ text: "Zenith Lifetime Premium Experience" })
        .setTimestamp();

      await user.send({ embeds: [embed] }).catch(() => null);
      store.notifiedLifetimeUsers.push(userId);
      notified.push(userId);
      logger.info({ userId, username: user.username }, "Sent Lifetime Upgrade DM to user");
    } catch (err) {
      logger.warn({ err, userId }, "Failed to deliver Lifetime Upgrade DM");
    }
  }

  if (notified.length > 0) {
    await save(store);
  }

  return { notifiedCount: notified.length, userIds: notified };
}

/**
 * DMs all Bot Owners and Staff Members an official operational briefing
 * detailing their authority, VIP benefits, and a complete command manual
 * outlining what commands they can use and their exact purpose.
 */
export async function sendStaffAndOwnerBriefing(
  client: any,
  forceUserId?: string,
): Promise<{ notifiedCount: number; userIds: string[] }> {
  if (!client?.users) {
    return { notifiedCount: 0, userIds: [] };
  }
  const store = await load();
  if (!store.notifiedStaffBriefing) store.notifiedStaffBriefing = [];

  const recipientIds = new Set<string>();

  if (forceUserId) {
    recipientIds.add(forceUserId);
  } else {
    // Add permanent owner
    recipientIds.add(PERMANENT_BOT_OWNER_ID);
    // Add bot admins
    for (const adminId of BOT_ADMIN_IDS) {
      recipientIds.add(adminId);
    }
    // Add all staff from botStaff storage
    try {
      const { getBotStaff } = await import("./botStaff");
      const staffMap = await getBotStaff();
      for (const s of Object.values(staffMap)) {
        recipientIds.add(s.userId);
      }
    } catch {}
  }

  const notified: string[] = [];

  for (const userId of recipientIds) {
    if (!forceUserId && store.notifiedStaffBriefing.includes(userId)) {
      continue;
    }

    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user || user.bot) {
        if (!forceUserId) store.notifiedStaffBriefing.push(userId);
        continue;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Zenith Bot: Official Staff & Owner Operations Briefing`)
        .setColor(0x5865F2)
        .setDescription(
          `Greetings **${user.username}**! Here is your official command directive and executive operations manual for **Zenith Bot Owners & Staff Members**.\n\n` +
          `### ${CE.owner.str} Executive & Owner Commands\n` +
          `• \`.setup\` / \`.wizard\` — Full-featured interactive onboarding and server security setup wizard\n` +
          `• \`.premiumpanel\` — Executive control panel for active subscriptions, role-based premium, and license management\n` +
          `• \`.premiumcheck <user_or_server_id>\` — Check real-time premium status, expiry, and perks of any user or server\n` +
          `• \`.premium give <@user|id> <days>\` — *(Permanent Bot Owner only)* Direct-grant VIP licenses (enter 9999 for Lifetime)\n` +
          `• \`.botstaff\` — Manage official bot staff rankings and appointments (Owner, Co-Owner, Admin, Mod, Helper)\n` +
          `• \`.maintenance\` — Toggle bot maintenance mode globally or for specific servers\n` +
          `• \`.globalautoreact\` — Configure server and cross-server automatic emoji reactions\n\n` +
          `### ${CE.admin.str} Server Defense & Whitelists\n` +
          `• \`.botwhitelist\` — Granular external bot & role clearance hub\n` +
          `• \`.adminbots @bot\` — Grant top-tier administrative Anti-Nuke and AutoMod clearance\n` +
          `• \`.ticketbot @bot\` — Grant ticket bots channel creation/deletion immunity\n` +
          `• \`.welcomerbot @bot\` — Grant welcomer bots autorole and channel bypass\n` +
          `• \`.antinuke\` — Configure real-time server security modules (anti-ban, anti-kick, anti-channel, anti-role)\n\n` +
          `### ${CE.limited.str} VIP Audio & Utility Privileges\n` +
          `• \`.play <song> [vc_name_or_user]\` — Remote voice playback without joining voice channel\n` +
          `• \`.24/7 [channel]\` — Continuous 24/7 voice channel residency with auto-reconnect\n` +
          `• \`.noprefix\` — Run any bot command seamlessly without prefix across all servers\n\n` +
          `### ${CE.ban.str} Moderation Suite\n` +
          `• \`.ban\`, \`.unban\`, \`.kick\`, \`.mute\`, \`.unmute\`, \`.jail\`, \`.unjail\` — Standard swift moderation actions\n` +
          `• \`.purge <amount>\`, \`.lock\`, \`.unlock\` — Channel chat management\n` +
          `• \`.quota\` / \`.partnership\` — Staff duty shift tracking and partnership management\n\n` +
          `*Please wield all executive and administrative commands with discretion and care.*`,
        )
        .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
        .setFooter({ text: "Zenith Executive Operations • Staff Directive" })
        .setTimestamp();

      await user.send({ embeds: [embed] }).catch(() => null);
      if (!forceUserId) store.notifiedStaffBriefing.push(userId);
      notified.push(userId);
      logger.info({ userId, username: user.username }, "Sent Staff & Owner briefing DM");
    } catch (err) {
      logger.warn({ err, userId }, "Failed to deliver Staff briefing DM");
    }
  }

  if (notified.length > 0 && !forceUserId) {
    await save(store);
  }

  return { notifiedCount: notified.length, userIds: notified };
}

/**
 * Dispatches both automated Lifetime Upgrade notifications and Staff briefings.
 */
export async function dispatchLifetimeAndStaffBriefings(client: any): Promise<{ lifetimeNotified: number; staffNotified: number }> {
  try {
    const res1 = await notifyLifetimeUpgradedUsers(client);
    const res2 = await sendStaffAndOwnerBriefing(client);
    return { lifetimeNotified: res1.notifiedCount, staffNotified: res2.notifiedCount };
  } catch (err) {
    logger.warn({ err }, "Error during automated lifetime and staff briefing dispatch");
    return { lifetimeNotified: 0, staffNotified: 0 };
  }
}
