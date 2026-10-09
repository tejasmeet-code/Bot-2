import { EmbedBuilder, Guild, GuildMember, PermissionFlagsBits, TextChannel, ChannelType } from "discord.js";
import { getGuildConfig, updateGuildConfig } from "../storage/config";
import { getAntiNukeConfig } from "../storage/config";
import { PERM_WHITELIST } from "../storage/whitelist";
import type { AntiNukeMiniModuleConfig, AntiNukeConfig, AntiNukePunishment } from "../storage/config";
import { logger } from "../../lib/logger";
import { CE } from "./embedStyle";

// ── Suspension (for whitelist ops like nuke/ban-all/highfi) ──────────────────
// When suspended, ALL anti-nuke handlers silently skip enforcement for the guild.
// Suspension automatically expires after 5 minutes as a safety net.
const suspendedGuilds = new Map<string, ReturnType<typeof setTimeout>>();

export function suspendAntiNuke(guildId: string, durationMs = 5 * 60 * 1000): void {
  const existing = suspendedGuilds.get(guildId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => suspendedGuilds.delete(guildId), durationMs);
  if (timer.unref) timer.unref();
  suspendedGuilds.set(guildId, timer);
  logger.info({ guildId, durationMs }, "[Anti-Nuke] Suspended for whitelist operation");
}

export function resumeAntiNuke(guildId: string): void {
  const existing = suspendedGuilds.get(guildId);
  if (existing) clearTimeout(existing);
  suspendedGuilds.delete(guildId);
  logger.info({ guildId }, "[Anti-Nuke] Resumed after whitelist operation");
}

export function isAntiNukeSuspended(guildId: string): boolean {
  return suspendedGuilds.has(guildId);
}

// ── In-memory join tracking ───────────────────────────────────────────────────
// guildId -> userId -> sorted array of join timestamps (ms)
const joinHistory = new Map<string, Map<string, number[]>>();

export function recordJoin(guildId: string, userId: string): void {
  if (!joinHistory.has(guildId)) joinHistory.set(guildId, new Map());
  const guildMap = joinHistory.get(guildId)!;
  const existing = guildMap.get(userId) ?? [];
  existing.push(Date.now());
  guildMap.set(userId, existing);
}

export function recentJoins(guildId: string, userId: string, windowMs: number): number {
  const guildMap = joinHistory.get(guildId);
  if (!guildMap) return 0;
  const cutoff = Date.now() - windowMs;
  const all = guildMap.get(userId) ?? [];
  const recent = all.filter((t) => t > cutoff);
  guildMap.set(userId, recent);
  return recent.length;
}

// ── Permanent anti-nuke bypass (hardcoded, code-level) ───────────────────────
// These IDs are always exempt from every anti-nuke module regardless of guild config.
const ANTI_NUKE_PERM_WHITELIST: ReadonlySet<string> = new Set([
  "1490586810710102076",
  "1488637779305955413",
  "1500148456176619711",
  "1452255891272368333",
]);

// ── Whitelist check ───────────────────────────────────────────────────────────

function isWhitelisted(
  userId: string,
  userRoleIds: string[],
  mod: Pick<AntiNukeMiniModuleConfig, "whitelistUserIds" | "whitelistRoleIds">,
  global: Pick<AntiNukeConfig, "globalWhitelistUserIds" | "globalWhitelistRoleIds">,
  cfg?: any,
  moduleType?: "antiJoin" | "antiBan" | "antiKick" | "antiRole" | "antiChannel",
  guildOwnerId?: string,
): boolean {
  if (ANTI_NUKE_PERM_WHITELIST.has(userId)) return true;
  if (PERM_WHITELIST.has(userId)) return true;

  // 1. Wall 1: Apex Sovereign & Full Whitelist
  // Server Owner, Bot Owner, and Owner-whitelisted members have unconditional FULL WHITELIST
  if (guildOwnerId && guildOwnerId === userId) return true;
  if (cfg?.antiNukeConfig?.ownerWhitelistedUserIds?.includes(userId)) return true;
  if (cfg?.serverOwnerWhitelistUserIds?.includes(userId)) return true;
  if (cfg?.antiNukeConfig?.fourWalls?.wall1OwnerUserIds?.includes(userId)) return true;
  if (cfg?.antiNukeConfig?.threeWalls?.wall1OwnerUserIds?.includes(userId)) return true;

  // Direct module whitelist
  if (mod.whitelistUserIds.includes(userId)) return true;
  if (global.globalWhitelistUserIds.includes(userId)) return true;
  for (const roleId of userRoleIds) {
    if (mod.whitelistRoleIds.includes(roleId)) return true;
    if (global.globalWhitelistRoleIds.includes(roleId)) return true;
  }

  // 2. Wall 2, 3 & 4 Hierarchy Checks
  const walls = cfg?.antiNukeConfig?.fourWalls || cfg?.antiNukeConfig?.threeWalls;
  if (walls) {
    // Wall 2: Senior Management - Defenses & mod actions only (antiBan, antiKick, antiJoin)
    const inWall2 = userRoleIds.some((r) => walls.wall2AdminRoleIds?.includes(r));
    if (inWall2) {
      if (moduleType === "antiBan" || moduleType === "antiKick" || moduleType === "antiJoin") {
        return true;
      }
      // Prohibited from channel and role destruction
      return false;
    }

    // Wall 3: Standard Staff - Operational defense only (antiJoin, antiKick)
    const inWall3 = userRoleIds.some((r) => walls.wall3StaffRoleIds?.includes(r));
    if (inWall3) {
      if (moduleType === "antiJoin" || moduleType === "antiKick") {
        return true;
      }
      return false;
    }

    // Wall 4: General Community (Normal Members) - ZERO bypass rights
    const inWall4 = userRoleIds.some((r) => (walls as any).wall4MemberRoleIds?.includes(r));
    if (inWall4) {
      return false; // Zero bypass for regular members
    }
  }

  if (cfg) {
    if (cfg.serverAdminWhitelistUserIds?.includes(userId)) {
      if (moduleType === "antiBan" || moduleType === "antiKick" || moduleType === "antiJoin") return true;
    }
    if (cfg.trustedWhitelistUserIds?.includes(userId)) return true;

    // Check specialized bot categories and roles
    const sb = cfg.specializedBots ?? {};
    const checkCat = (cat: string): boolean => {
      const list = sb[cat] ?? [];
      if (list.some((item: any) => item.id === userId)) return true;
      if (userRoleIds.length > 0 && list.some((item: any) => item.type === "role" && userRoleIds.includes(item.id))) {
        return true;
      }
      return false;
    };

    // Full immunity across all modules
    if (checkCat("adminbots") || checkCat("antinukebot")) return true;

    // Ticket bots immune to channel actions
    if (moduleType === "antiChannel" && checkCat("ticketbot")) return true;

    // Staff management bots immune to role updates/assignments
    if (moduleType === "antiRole" && checkCat("staffmanagement")) return true;

    // Moderation bots immune to kicks & bans
    if ((moduleType === "antiBan" || moduleType === "antiKick") && checkCat("moderationbot")) return true;

    // Welcomer bots immune to joins and autorole assignments
    if ((moduleType === "antiJoin" || moduleType === "antiRole") && checkCat("welcomerbot")) return true;
  }
  return false;
}

// ── Log embed sender ──────────────────────────────────────────────────────────

const MINI_LABELS: Record<string, string> = {
  antiBan: "Anti-Ban",
  antiKick: "Anti-Kick",
  antiPrune: "Anti-Prune",
  antiBotAdd: "Anti-Bot Add",
  antiServerUpdate: "Anti-Server Update",
  antiMemberUpdate: "Anti-Member Update",
  antiChannelCreate: "Anti-Channel Create",
  antiChannelDelete: "Anti-Channel Delete",
  antiChannelUpdate: "Anti-Channel Update",
  antiRoleCreate: "Anti-Role Create",
  antiRoleUpdate: "Anti-Role Update",
  antiRoleDelete: "Anti-Role Delete",
  antiEveryoneHere: "Anti-Everyone/Here",
  antiWebhook: "Anti-Webhook",
  antiSticker: "Anti-Sticker",
  antiEmojiCreate: "Anti-Emoji Create",
  antiEmojiDelete: "Anti-Emoji Delete",
  antiEmojiUpdate: "Anti-Emoji Update",
  antiInviteRole: "Anti-Invite Role",
  antiJoin: "Anti-Join",
  antiRole: "Anti-Role",
  antiChannel: "Anti-Channel",
};

const PUNISHMENT_LABELS: Record<AntiNukePunishment, string> = {
  none: "None (detection only)",
  kick: "Kick",
  ban: "Ban",
  timeout_1h: "Timeout 1 hour",
  timeout_24h: "Timeout 24 hours",
  timeout_7d: "Timeout 7 days",
};

async function sendAntiNukeLog(
  guild: Guild,
  opts: {
    miniModule: string;
    targetId: string;
    reason: string;
    punishment: AntiNukePunishment;
    logChannelId: string;
  },
): Promise<void> {
  try {
    const ch = guild.channels.cache.get(opts.logChannelId) ??
      await guild.channels.fetch(opts.logChannelId).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.admin.str} Anti-Nuke Triggered — ${MINI_LABELS[opts.miniModule] ?? opts.miniModule}`)
      .setColor(0xed4245)
      .addFields(
        { name: "Offender / Executor", value: `<@${opts.targetId}> (\`${opts.targetId}\`)`, inline: true },
        { name: "Punishment Applied", value: PUNISHMENT_LABELS[opts.punishment] ?? opts.punishment, inline: true },
        { name: "Trigger Reason", value: opts.reason, inline: false },
      )
      .setTimestamp();

    await (ch as TextChannel).send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, "[Anti-Nuke] Failed to send log embed");
  }
}

// ── Generic Anti-Nuke Trigger Handler ──────────────────────────────────────────

export async function handleAntiNukeTrigger(
  guild: Guild,
  executorId: string | null | undefined,
  miniKey: keyof AntiNukeConfig,
  reason: string,
): Promise<boolean> {
  if (!executorId) return false;
  try {
    if (isAntiNukeSuspended(guild.id)) return false;
    const cfg = await getGuildConfig(guild.id);
    const an = getAntiNukeConfig(cfg);
    if (!an.enabled) return false;

    const miniConfig = (an as any)[miniKey] as AntiNukeMiniModuleConfig | undefined;
    if (!miniConfig || !miniConfig.enabled) return false;

    const executor =
      guild.members.cache.get(executorId) ??
      (await guild.members.fetch(executorId).catch(() => null));
    const userRoleIds = executor ? Array.from(executor.roles.cache.keys()) : [];

    if (isWhitelisted(executorId, userRoleIds, miniConfig, an, cfg, miniKey as any, guild.ownerId)) {
      return false;
    }

    logger.info({ guildId: guild.id, executorId, miniKey, reason }, "[Anti-Nuke] Violation triggered");
    await applyPunishment(guild, executorId, miniConfig.punishment, `[Anti-Nuke ${miniKey}] ${reason}`);

    if (cfg.channels.antiNukeLog) {
      await sendAntiNukeLog(guild, {
        miniModule: miniKey as string,
        targetId: executorId,
        reason,
        punishment: miniConfig.punishment,
        logChannelId: cfg.channels.antiNukeLog,
      });
    }
    return true;
  } catch (err) {
    logger.error({ err, guildId: guild.id, executorId, miniKey }, "[Anti-Nuke] Trigger error");
    return false;
  }
}

// ── Punishment application ────────────────────────────────────────────────────

export async function applyPunishment(
  guild: Guild,
  targetId: string,
  punishment: AntiNukePunishment,
  reason: string,
): Promise<void> {
  try {
    if (punishment !== "none") {
      const user = await guild.client.users.fetch(targetId).catch(() => null);
      if (user) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`${CE.admin.str} Anti-Nuke Action Taken`)
          .setColor(0xed4245)
          .setDescription(`An anti-nuke protection action was triggered in **${guild.name}**.`)
          .addFields(
            { name: "Violation / Reason", value: reason, inline: true },
            { name: "Punishment / Action", value: PUNISHMENT_LABELS[punishment] ?? punishment, inline: true }
          )
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => null);
      }
    }

    switch (punishment) {
      case "kick": {
        const member =
          guild.members.cache.get(targetId) ??
          (await guild.members.fetch(targetId).catch(() => null));
        await member?.kick(reason).catch(() => {});
        break;
      }
      case "ban":
        await guild.bans.create(targetId, { reason }).catch(() => {});
        break;
      case "timeout_1h": {
        const member =
          guild.members.cache.get(targetId) ??
          (await guild.members.fetch(targetId).catch(() => null));
        await member?.timeout(60 * 60 * 1000, reason).catch(() => {});
        break;
      }
      case "timeout_24h": {
        const member =
          guild.members.cache.get(targetId) ??
          (await guild.members.fetch(targetId).catch(() => null));
        await member?.timeout(24 * 60 * 60 * 1000, reason).catch(() => {});
        break;
      }
      case "timeout_7d": {
        const member =
          guild.members.cache.get(targetId) ??
          (await guild.members.fetch(targetId).catch(() => null));
        await member?.timeout(7 * 24 * 60 * 60 * 1000, reason).catch(() => {});
        break;
      }
      case "none":
      default:
        break;
    }
  } catch (err) {
    logger.warn({ err, guildId: guild.id, targetId, punishment }, "[Anti-Nuke] Failed to apply punishment");
  }
}

// ── Anti-Join ─────────────────────────────────────────────────────────────────

export async function handleAntiJoin(guild: Guild, member: GuildMember): Promise<void> {
  try {
    if (isAntiNukeSuspended(guild.id)) return;
    const cfg = await getGuildConfig(guild.id);
    const an = getAntiNukeConfig(cfg);
    if (!an.enabled || !an.antiJoin.enabled) return;

    const userRoleIds = Array.from(member.roles.cache.keys());
    if (isWhitelisted(member.id, userRoleIds, an.antiJoin, an, cfg, "antiJoin", guild.ownerId)) return;

    const windowMs = (an.antiJoin.windowSeconds ?? 60) * 1000;
    recordJoin(guild.id, member.id);
    const count = recentJoins(guild.id, member.id, windowMs);

    if (count >= (an.antiJoin.threshold ?? 3)) {
      const reason = "[Anti-Nuke] Repeated join/leave detected";
      logger.info({ guildId: guild.id, userId: member.id, count }, "[Anti-Nuke] Anti-join triggered");
      await applyPunishment(guild, member.id, an.antiJoin.punishment, reason);
      if (cfg.channels.antiNukeLog) {
        await sendAntiNukeLog(guild, {
          miniModule: "antiJoin",
          targetId: member.id,
          reason: `Joined **${count}** times within the **${an.antiJoin.windowSeconds}s** window (threshold: ${an.antiJoin.threshold})`,
          punishment: an.antiJoin.punishment,
          logChannelId: cfg.channels.antiNukeLog,
        });
      }
    }
  } catch (err) {
    logger.error({ err, guildId: guild.id, userId: member.id }, "[Anti-Nuke] Anti-join error");
  }
}

// ── Sub-module Specific Exporters ─────────────────────────────────────────────

export async function handleAntiBan(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiBan", "Unauthorized member ban");
}
export async function handleAntiKick(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiKick", "Unauthorized member kick");
}
export async function handleAntiPrune(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiPrune", "Unauthorized member prune");
}
export async function handleAntiBotAdd(guild: Guild, executorId?: string | null, botTag?: string) {
  return handleAntiNukeTrigger(guild, executorId, "antiBotAdd", `Added unwhitelisted bot (${botTag || "unwhitelisted bot"})`);
}
export async function handleAntiServerUpdate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiServerUpdate", "Unauthorized server settings update");
}
export async function handleAntiMemberUpdate(guild: Guild, executorId?: string | null, reason = "Unauthorized member update") {
  return handleAntiNukeTrigger(guild, executorId, "antiMemberUpdate", reason);
}
export async function handleAntiChannelCreate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiChannelCreate", "Unauthorized channel created");
}
export async function handleAntiChannelDelete(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiChannelDelete", "Unauthorized channel deleted");
}
export async function handleAntiChannelUpdate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiChannelUpdate", "Unauthorized channel updated");
}
export async function handleAntiRoleCreate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiRoleCreate", "Unauthorized role created");
}
export async function handleAntiRoleUpdate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiRoleUpdate", "Unauthorized role updated");
}
export async function handleAntiRoleDelete(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiRoleDelete", "Unauthorized role deleted");
}
export async function handleAntiEveryoneHere(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiEveryoneHere", "Unauthorized @everyone/@here mass ping");
}
export async function handleAntiWebhook(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiWebhook", "Unauthorized webhook/integration modification");
}
export async function handleAntiSticker(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiSticker", "Unauthorized sticker modification");
}
export async function handleAntiEmojiCreate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiEmojiCreate", "Unauthorized emoji created");
}
export async function handleAntiEmojiDelete(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiEmojiDelete", "Unauthorized emoji deleted");
}
export async function handleAntiEmojiUpdate(guild: Guild, executorId?: string | null) {
  return handleAntiNukeTrigger(guild, executorId, "antiEmojiUpdate", "Unauthorized emoji updated");
}
export async function handleAntiInviteRole(guild: Guild, executorId?: string | null, roleName?: string) {
  return handleAntiNukeTrigger(guild, executorId, "antiInviteRole", `Created or assigned dangerous invite/admin role (${roleName || "role"})`);
}

export function isDangerousRole(permissions: bigint): boolean {
  const dangerous = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.MentionEveryone,
  ];
  return dangerous.some((flag) => (permissions & flag) === flag);
}

export async function handleAntiRole(
  guild: Guild,
  executorId: string | null | undefined,
  reason: string,
): Promise<void> {
  await handleAntiNukeTrigger(guild, executorId, "antiRoleCreate", reason);
  await handleAntiNukeTrigger(guild, executorId, "antiRoleUpdate", reason);
}

export async function handleAntiChannel(
  guild: Guild,
  executorId: string | null | undefined,
  reason: string,
): Promise<void> {
  await handleAntiNukeTrigger(guild, executorId, "antiChannelCreate", reason);
  await handleAntiNukeTrigger(guild, executorId, "antiChannelDelete", reason);
}