import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { Client, EmbedBuilder, ChannelType, type GuildMember } from "discord.js";
import { CE, COLORS, SUPPORT_SERVER_URL } from "../utils/embedStyle";
import { logger } from "../../lib/logger";
import { safeSendUserDm } from "../utils/dmWebhook";

const STORE = "bot_staff_store";
const FILE = () => dataFile("bot_staff_store.json");

export const TEST_SERVER_STAFF_ROLE_ID = "1553398642835071056";

export type BotStaffRole =
  | "owner"
  | "co_owner"
  | "admin"
  | "head_tester"
  | "tester"
  | "mod"
  | "help"
  | "vip"
  | "homies"
  | "manager"
  | "partner"
  | "supporter"
  | "support_team";

export interface BotStaffMember {
  userId: string;
  role: BotStaffRole;
  assignedAt: number;
  assignedBy: string;
}

export interface BotStaffStore {
  staff: Record<string, BotStaffMember>;
}

export interface RoleMetadata {
  key: BotStaffRole;
  name: string;
  title: string;
  badge: string;
  color: number;
  emojiStr: string;
  description: string;
  benefits: string[];
}

export const BOT_STAFF_ROLES: Record<BotStaffRole, RoleMetadata> = {
  owner: {
    key: "owner",
    name: "Owner",
    title: "Bot Owner",
    badge: "[OWNER]",
    color: 0xF1C40F, // Gold
    emojiStr: CE.owner.str,
    description: "All premium features and full command privileges globally across all servers.",
    benefits: [
      "Access to all bot commands and administrative controls across all servers",
      "Full lifetime premium access on your account and servers",
      "Immunity from moderation actions, timeouts, and automod filters",
      "Priority execution and server management privileges",
      "Auto-granted Official Staff & Tester Role in the Test Server",
    ],
  },
  co_owner: {
    key: "co_owner",
    name: "Co Owner",
    title: "Bot Co-Owner",
    badge: "[CO-OWNER]",
    color: 0xF39C12, // Orange/Gold
    emojiStr: CE.owner.str,
    description: "Same as Owner — all premium features and full command privileges globally.",
    benefits: [
      "Access to all bot commands and administrative controls across all servers",
      "Full lifetime premium access on your account and servers",
      "Immunity from moderation actions, timeouts, and automod filters",
      "Priority execution and server management privileges",
      "Auto-granted Official Staff & Tester Role in the Test Server",
    ],
  },
  admin: {
    key: "admin",
    name: "Admin",
    title: "Bot Administrator",
    badge: "[ADMIN]",
    color: 0x5865F2, // Blurple
    emojiStr: CE.admin.str,
    description: "Bot administration clearance, configuration controls, and user premium perks.",
    benefits: [
      "Access to bot administration and configuration tools",
      "Full lifetime user premium clearance across all servers",
      "Elevated moderation permissions and immunity from standard automod",
      "Ability to manage server setup wizards and diagnostics",
      "Auto-granted Official Staff & Tester Role in the Test Server",
    ],
  },
  head_tester: {
    key: "head_tester",
    name: "Head Tester",
    title: "Bot Head Quality Assurance & Tester",
    badge: "[HEAD-TESTER]",
    color: 0x9B59B6, // Purple
    emojiStr: CE.star.str,
    description: "Lead testing oversight, early build access, and permanent Lifetime Premium.",
    benefits: [
      "**Full Lifetime Zenith Premium** granted automatically",
      "Unrestricted Global No-Prefix Command Execution across all servers",
      "Early access to upcoming releases, beta commands, and test builds",
      "Direct testing channel access and priority issue triage in Testing Server",
      "Auto-granted Official Tester Role (<@&1553398642835071056>) in Testing Server",
    ],
  },
  tester: {
    key: "tester",
    name: "Tester",
    title: "Bot Quality Assurance & Tester",
    badge: "[TESTER]",
    color: 0x1ABC9C, // Teal
    emojiStr: CE.settings.str,
    description: "Active feature testing, bug verification, and 1-Year Zenith Premium.",
    benefits: [
      "**1 Year (365 Days) Zenith Premium** granted automatically",
      "Global No-Prefix Command Execution across all servers",
      "Access to test commands, audio features, and stress testing builds",
      "Dedicated Tester channels & developer communication",
      "Auto-granted Official Tester Role (<@&1553398642835071056>) in Testing Server",
    ],
  },
  mod: {
    key: "mod",
    name: "Mod",
    title: "Bot Moderator",
    badge: "[MOD]",
    color: 0xE74C3C, // Red
    emojiStr: CE.moderation.str,
    description: "Global moderation tools, ticket oversight, and user investigation.",
    benefits: [
      "Access to moderation commands, warning inspections, and user case logs",
      "Oversight on support tickets and moderation queues",
      "Bypass standard spam cooldowns and rate limits",
      "Auto-granted Official Staff & Tester Role in the Test Server",
    ],
  },
  help: {
    key: "help",
    name: "Help",
    title: "Bot Support / Helper",
    badge: "[HELP]",
    color: 0x2ECC71, // Green
    emojiStr: CE.staff.str,
    description: "Support helper clearance, server onboarding, and user assistance.",
    benefits: [
      "Official Zenith Bot Support Staff verification and badge",
      "Ability to guide server owners through .wizard and onboarding setups",
      "Priority ticket handling and access to community support channels",
      "Auto-granted Official Staff & Tester Role in the Test Server",
    ],
  },
  vip: {
    key: "vip",
    name: "VIP",
    title: "Bot VIP Member",
    badge: "[VIP]",
    color: 0x9B59B6, // Purple
    emojiStr: CE.star.str,
    description: "Special VIP community member rank, Lifetime Premium, and profile badge recognition.",
    benefits: [
      "**Full Lifetime Zenith Premium** granted automatically",
      "Official VIP badge displayed on your profile card graphic",
      "Special VIP status and recognition across Zenith servers",
      "Priority assistance in community support channels",
    ],
  },
  homies: {
    key: "homies",
    name: "Homies",
    title: "Bot Homies Rank",
    badge: "[HOMIES]",
    color: 0xEC4899, // Pink
    emojiStr: CE.heart ? CE.heart.str : CE.star.str,
    description: "Close community friend & Homies rank with Lifetime Premium and profile badge.",
    benefits: [
      "**Full Lifetime Zenith Premium** granted automatically",
      "Official Homies rank badge on profile card graphic",
      "Special Homies status and access in community channels",
      "Exclusive community recognition",
    ],
  },
  manager: {
    key: "manager",
    name: "Manager",
    title: "Bot Manager",
    badge: "[MANAGER]",
    color: 0x3498DB,
    emojiStr: CE.white_manager.str,
    description: "Bot management clearance, support oversight, and administrative access.",
    benefits: [
      "Access to bot management and team oversight",
      "Full lifetime premium clearance",
      "Priority execution and support privileges",
    ],
  },
  partner: {
    key: "partner",
    name: "Partner",
    title: "Official Bot Partner",
    badge: "[PARTNER]",
    color: 0x9B59B6,
    emojiStr: CE.white_partner.str,
    description: "Official bot partner and community collaborator.",
    benefits: [
      "Lifetime Zenith Premium for partnered servers",
      "Official Partner badge on profile card",
      "Priority support and co-promotion features",
    ],
  },
  supporter: {
    key: "supporter",
    name: "Supporter",
    title: "Bot Supporter",
    badge: "[SUPPORTER]",
    color: 0xE91E63,
    emojiStr: CE.white_supporter.str,
    description: "Community supporter recognizing significant contributions.",
    benefits: [
      "Lifetime Zenith Premium tier",
      "Official Supporter badge on profile card",
      "Early feature previews",
    ],
  },
  support_team: {
    key: "support_team",
    name: "Support Team",
    title: "Official Support Team",
    badge: "[SUPPORT-TEAM]",
    color: 0x1ABC9C,
    emojiStr: CE.white_support_team.str,
    description: "Official Support Team member providing technical and community support.",
    benefits: [
      "Official Support Team badge on profile card",
      "Support ticket handling and priority triage tools",
      "Direct staff communications",
    ],
  },
};

let cache: BotStaffStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<BotStaffStore> {
  if (cache) return cache;
  cache = await loadPersistentJson<BotStaffStore>(STORE, FILE(), {
    staff: {},
  });
  return cache;
}

async function save(store: BotStaffStore): Promise<void> {
  cache = store;
  writeQueue = writeQueue.then(() => persistPersistentJson(STORE, FILE(), store));
  return writeQueue;
}

export async function getBotStaff(): Promise<Record<string, BotStaffMember>> {
  const store = await load();
  return store.staff;
}

export async function getBotStaffMember(userId: string): Promise<BotStaffMember | null> {
  const store = await load();
  return store.staff[userId] ?? null;
}

export async function isBotStaff(userId: string): Promise<boolean> {
  const store = await load();
  const entry = store.staff[userId];
  if (!entry) return false;
  return entry.role !== "vip" && entry.role !== "homies";
}

export async function getBotStaffRole(userId: string): Promise<BotStaffRole | null> {
  const store = await load();
  return store.staff[userId]?.role ?? null;
}

export async function removeBotStaffRole(userId: string): Promise<boolean> {
  const store = await load();
  if (!store.staff[userId]) return false;
  const oldRole = store.staff[userId].role;
  delete store.staff[userId];
  await save(store);
  try {
    const { removeUserBadge } = await import("./profile");
    if (oldRole) await removeUserBadge(userId, oldRole);
  } catch {}
  return true;
}

/**
 * Creates or fetches a permanent invite link to the Bot Testing / Support server.
 */
export async function getTestingServerInvite(client?: Client): Promise<string> {
  if (!client) return SUPPORT_SERVER_URL;

  try {
    for (const guild of client.guilds.cache.values()) {
      const hasRole = guild.roles.cache.has(TEST_SERVER_STAFF_ROLE_ID);
      if (hasRole) {
        const textChannel = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && (c as any).permissionsFor(guild.members.me!)?.has("CreateInstantInvite")
        );
        if (textChannel && "createInvite" in textChannel) {
          const inv = await (textChannel as any).createInvite({
            maxAge: 0,
            maxUses: 0,
            unique: false,
            reason: "Permanent invite for Bot Staff & Testers",
          });
          if (inv?.url) return inv.url;
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not generate permanent test server invite; falling back to default");
  }

  return SUPPORT_SERVER_URL;
}

/**
 * Ensures a staff/tester member is automatically assigned the tester role in any guild that contains it.
 */
export async function syncTesterRole(client: Client, userId: string): Promise<boolean> {
  const userRole = await getBotStaffRole(userId);
  // VIP and Homies are community/VIP ranks, NOT staff, so do NOT assign testing server role
  if (userRole === "vip" || userRole === "homies") return false;

  let roleAssigned = false;
  try {
    for (const guild of client.guilds.cache.values()) {
      if (guild.roles.cache.has(TEST_SERVER_STAFF_ROLE_ID)) {
        const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
        if (member && !member.roles.cache.has(TEST_SERVER_STAFF_ROLE_ID)) {
          await member.roles.add(TEST_SERVER_STAFF_ROLE_ID, "Auto-assigned Bot Staff / Tester role");
          roleAssigned = true;
          logger.info({ userId, guildId: guild.id }, "Auto-assigned tester role 1553398642835071056 to staff member");
        }
      }
    }
  } catch (err) {
    logger.warn({ err, userId }, "Failed to sync tester role to staff member");
  }
  return roleAssigned;
}

export async function setBotStaffRole(
  userId: string,
  role: BotStaffRole,
  assignedBy: string,
  client?: Client,
): Promise<{ member: BotStaffMember; dmSent: boolean }> {
  const store = await load();
  const entry: BotStaffMember = {
    userId,
    role,
    assignedAt: Date.now(),
    assignedBy,
  };
  store.staff[userId] = entry;
  await save(store);

  // 1. Grant Premium based on appointed role:
  // - Head Testers, Owners, Co-Owners, Admins, VIP, Homies: Lifetime Premium (9999 days)
  // - Testers: 1 Year Premium (365 days)
  try {
    const { grantDirectPremium } = await import("./premium");
    if (
      role === "head_tester" ||
      role === "owner" ||
      role === "co_owner" ||
      role === "admin" ||
      role === "vip" ||
      role === "homies"
    ) {
      await grantDirectPremium(userId, "user", 9999);
    } else if (role === "tester") {
      await grantDirectPremium(userId, "user", 365);
    }
  } catch (err) {
    logger.warn({ err, userId }, "Failed to grant premium to appointed user");
  }

  // 1b. Sync badge directly into profile store
  try {
    const { addUserBadge } = await import("./profile");
    await addUserBadge(userId, role);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to sync badge into profile store");
  }

  // 2. Sync testing server role ONLY if user is a staff member (NOT VIP or Homies)
  if (client && role !== "vip" && role !== "homies") {
    await syncTesterRole(client, userId);
  }

  // 3. Create permanent invite link to test server & send official DM
  let dmSent = false;
  if (client) {
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const meta = BOT_STAFF_ROLES[role];
        const inviteUrl = await getTestingServerInvite(client);
        const isStaffRole = role !== "vip" && role !== "homies";
        const isLifetime = role === "head_tester" || role === "owner" || role === "co_owner" || role === "admin" || role === "vip" || role === "homies";

        const dmEmbed = new EmbedBuilder()
          .setTitle(`${meta.emojiStr} Official Appointment: **${meta.title}**`)
          .setColor(meta.color)
          .setDescription(
            `Greetings **${user.username}**! You have been officially appointed as **${meta.name}** by <@${assignedBy}>!\n\n` +
            `**Appointed Rank:** ${meta.emojiStr} \`${meta.name.toUpperCase()}\` (${meta.badge})\n` +
            `**Premium Status:** ${isLifetime ? "**Lifetime Zenith VIP Access**" : role === "tester" ? "**1 Year (365 Days) VIP Access**" : "Active Clearance"}\n` +
            `**Official Community Server:** [Click to Join Server](${inviteUrl})\n\n` +
            `### **Your Unlocked Role Benefits & Privileges:**\n` +
            meta.benefits.map((b) => `• ${b}`).join("\n") +
            (isStaffRole
              ? `\n\n> **Testing Server Role:** When you join the testing server, you will automatically be granted role <@&${TEST_SERVER_STAFF_ROLE_ID}>!\n\n`
              : "\n\n") +
            `*Enjoy your new privileges!*`
          )
          .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
          .setFooter({ text: "Zenith Official Administration Directive" })
          .setTimestamp();

        const dmResult = await safeSendUserDm(user, { embeds: [dmEmbed] }, `Official Appointment: ${meta.title}`);
        dmSent = dmResult.success;
      }
    } catch (err) {
      logger.warn({ err, userId }, "Could not send DM to newly appointed member");
    }
  }

  return { member: entry, dmSent };
}

export async function canManageBotStaff(
  userId: string,
  guild?: { ownerId?: string | null } | null,
  client?: Client | null
): Promise<boolean> {
  const { isPermanentOwner, isBotAdmin, PERMANENT_BOT_OWNER_ID } = await import("./premium");
  const { BASE_PERM_WHITELIST } = await import("./whitelist");

  // 1. Permanent bot owner
  if (isPermanentOwner(userId) || userId === PERMANENT_BOT_OWNER_ID) return true;

  // 2. Bot administrators and whitelisted developers
  if (isBotAdmin(userId)) return true;
  if (BASE_PERM_WHITELIST.has(userId)) return true;

  // 3. Environment variable owners
  if (
    process.env.DISCORD_OWNER_ID &&
    process.env.DISCORD_OWNER_ID.split(",")
      .map((s) => s.trim())
      .includes(userId)
  ) {
    return true;
  }

  // 4. Appointed bot staff with elevated roles
  const staffRole = await getBotStaffRole(userId);
  if (staffRole === "owner" || staffRole === "co_owner" || staffRole === "admin") return true;

  // 5. Discord Application Owner / Team member
  if (client?.application?.owner) {
    const appOwner = client.application.owner;
    if ("id" in appOwner && appOwner.id === userId) return true;
    if ("members" in appOwner && (appOwner as any).members?.has(userId)) return true;
  }

  // 6. Guild owner
  if (guild?.ownerId && guild.ownerId === userId) return true;

  return false;
}
