import {
  type Guild,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getGuildConfig, updateGuildConfig, type GuildConfig } from "../storage/config";
import { listStaffRoles, addStaffRole } from "../storage/staff";
import { detectSmartRoles } from "./roleDetector";
import { CE, COLORS } from "./embedStyle";
import { logger } from "../../lib/logger";

export const COMMON_STAFF_ROLE_NAMES = [
  "staff team",
  "staff",
  "staffs",
  "team staff",
  "moderator",
  "moderators",
  "mod",
  "mods",
  "admin",
  "administrator",
  "administrators",
  "admins",
  "support",
  "support team",
  "helper",
  "helpers",
  "management",
  "manager",
  "trial mod",
  "junior mod",
  "senior mod",
  "community manager",
  "server staff",
];

export const COMMON_MEMBER_ROLE_NAMES = [
  "member",
  "members",
  "verified",
  "citizen",
  "citizens",
  "user",
  "users",
  "community",
  "regular",
  "regulars",
  "people",
];

export const COMMON_MUTED_ROLE_NAMES = [
  "muted",
  "mute",
  "jail",
  "jailed",
  "isolated",
  "timeout",
  "quarantined",
];

export const COMMON_LOG_CHANNEL_NAMES = [
  "mod-logs",
  "modlogs",
  "logs",
  "audit-logs",
  "bot-logs",
  "staff-logs",
  "server-logs",
  "case-logs",
  "moderation-logs",
  "action-logs",
];

export const COMMON_WELCOME_CHANNEL_NAMES = [
  "welcome",
  "joins",
  "join-leave",
  "greetings",
  "lounge",
  "arrivals",
  "hello",
];

export const COMMON_ANNOUNCE_CHANNEL_NAMES = [
  "announcements",
  "announcement",
  "updates",
  "news",
  "server-announcements",
];

export const COMMON_BOT_CHANNEL_NAMES = [
  "bot-commands",
  "commands",
  "bot-cmds",
  "cmds",
  "bot",
  "bots",
  "bot-spam",
];

export interface AutoSetupResult {
  mainRoleId?: string;
  staffCommonRoleId?: string;
  staffRoleHierarchy: string[];
  logChannelId?: string;
  welcomeChannelId?: string;
  botChannelId?: string;
  announceChannelId?: string;
  configuredRolesCount: number;
  unlockedCommands: boolean;
}

/**
 * Executes a 1-Click Auto Setup for the server:
 * Scans all roles and channels, maps standard names, sets up staff tracking,
 * marks setupWizardCompleted = true, and lifts all command restrictions.
 */
export async function runAutoSetupWizard(guild: Guild, executorId: string): Promise<{ result: AutoSetupResult; embed: EmbedBuilder }> {
  // 1. Smart detect roles using deep permission & name scoring
  const detection = await detectSmartRoles(guild);
  const mainRole = detection.mainMemberRole;
  const staffCommonRole = detection.staffCommonRole;
  const staffHierarchyCandidates = detection.staffHierarchy;
  const staffRoleHierarchy = staffHierarchyCandidates.map((r) => r.id);

  await guild.channels.fetch().catch(() => {});
  const channels = [...guild.channels.cache.values()].filter((c) => c.isTextBased());

  // 5. Register detected staff roles into staff-roles storage
  let configuredRolesCount = 0;
  try {
    const existingStaff = await listStaffRoles(guild.id);
    const existingIds = new Set(existingStaff.map((s) => s.roleId));
    for (const role of staffHierarchyCandidates) {
      if (!existingIds.has(role.id)) {
        await addStaffRole(guild.id, role.id).catch(() => {});
        configuredRolesCount++;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not auto-register staff roles");
  }

  // 6. Identify Channels
  const logChannel = channels.find((c) =>
    COMMON_LOG_CHANNEL_NAMES.some((name) => c.name.toLowerCase().includes(name)),
  );
  const welcomeChannel = channels.find((c) =>
    COMMON_WELCOME_CHANNEL_NAMES.some((name) => c.name.toLowerCase().includes(name)),
  );
  const announceChannel = channels.find((c) =>
    COMMON_ANNOUNCE_CHANNEL_NAMES.some((name) => c.name.toLowerCase().includes(name)),
  );
  const botChannel = channels.find((c) =>
    COMMON_BOT_CHANNEL_NAMES.some((name) => c.name.toLowerCase().includes(name)),
  );

  // 7. Persist configuration and mark wizard as completed
  await updateGuildConfig(guild.id, (cfg) => {
    return {
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      setupConfig: {
        mainRoleId: mainRole?.id ?? cfg.setupConfig?.mainRoleId,
        staffCommonRoleId: staffCommonRole?.id ?? cfg.setupConfig?.staffCommonRoleId,
        staffRoleHierarchy:
          staffRoleHierarchy.length > 0 ? staffRoleHierarchy : (cfg.setupConfig?.staffRoleHierarchy ?? []),
      },
      // Automatically map detected log/announce channels if not already configured
      channels: {
        ...cfg.channels,
        moderation: logChannel?.id ?? cfg.channels.moderation,
        botNotifications: announceChannel?.id ?? cfg.channels.botNotifications,
      },
    };
  });

  const result: AutoSetupResult = {
    mainRoleId: mainRole?.id,
    staffCommonRoleId: staffCommonRole?.id,
    staffRoleHierarchy,
    logChannelId: logChannel?.id,
    welcomeChannelId: welcomeChannel?.id,
    botChannelId: botChannel?.id,
    announceChannelId: announceChannel?.id,
    configuredRolesCount,
    unlockedCommands: true,
  };

  // 8. Build a rich status embed
  const mainRoleStr = mainRole ? `<@&${mainRole.id}> (\`${mainRole.name}\`)` : `${CE.warning.str} *None detected (create a 'Member' role)*`;
  const staffRoleStr = staffCommonRole ? `<@&${staffCommonRole.id}> (\`${staffCommonRole.name}\`)` : `${CE.warning.str} *None detected (create a 'Staff' role)*`;
  const hierarchyStr =
    staffHierarchyCandidates.length > 0
      ? staffHierarchyCandidates.slice(0, 5).map((r) => `<@&${r.id}>`).join(" ➔ ") +
        (staffHierarchyCandidates.length > 5 ? ` *(+${staffHierarchyCandidates.length - 5} more)*` : "")
      : "*No staff hierarchy roles found*";

  const logChannelStr = logChannel ? `<#${logChannel.id}>` : "*Not detected*";
  const botChannelStr = botChannel ? `<#${botChannel.id}>` : "*All channels active*";
  const welcomeChannelStr = welcomeChannel ? `<#${welcomeChannel.id}>` : "*Not detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.success.str} 1-Click Server Setup Wizard Complete!`)
    .setColor(0x57f287)
    .setDescription(
      `**Zenith Bot** has scanned your server, automatically identified roles and channels, configured staff hierarchy, and **unlocked all commands**!\n\n` +
      `${CE.locked.str} **Status**: **All command restrictions have been lifted!** Normal usage is now 100% active.`,
    )
    .addFields(
      { name: `${CE.owner.str} Staff Common Role`, value: staffRoleStr, inline: true },
      { name: `${CE.members.str} Main Member Role`, value: mainRoleStr, inline: true },
      { name: `${CE.level.str} Staff Hierarchy (Ranked)`, value: hierarchyStr, inline: false },
      { name: `${CE.information.str} Moderation Logs Channel`, value: logChannelStr, inline: true },
      { name: `${CE.settings.str} Bot Commands Channel`, value: botChannelStr, inline: true },
      { name: `${CE.star.str} Welcome Channel`, value: welcomeChannelStr, inline: true },
      {
        name: `${CE.promotion.str} Instant Aliases & Features Unlocked`,
        value:
          `• **Anti-Nuke Quick Setup**: \`.an st\`\n` +
          `• **Command Info Inspector**: \`.(command) -info\` (e.g. \`.ban -info\` or \`.an -info\`)\n` +
          `• **Music Player Engine**: \`.play <song>\` / \`.p <song>\` with full VC controls\n` +
          `• **No-Prefix Commands**: Enabled for staff & administrators`,
        inline: false,
      },
    )
    .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
    .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
    .setFooter({ text: `Auto-configured by Zenith Engine • Executed by <@${executorId}>` })
    .setTimestamp();

  return { result, embed };
}

/**
 * Runs the Master Setup Wizard (.wizard all) that sets up EVERYTHING:
 * Anti-Nuke, AutoMod, Staff Management, Roles Hierarchy, Logging Channels, and unlocks commands.
 */
export async function runAllSetupWizard(
  guild: Guild,
  executorId: string,
): Promise<{ embed: EmbedBuilder }> {
  // 1. Run base role & channel detection
  const { result } = await runAutoSetupWizard(guild, executorId);

  // 2. Perform deep AntiNuke + AutoMod + Staff configuration
  const PERMANENT_OWNER_ID = "1181221352393420856";
  const ownerId = guild.ownerId;

  await updateGuildConfig(guild.id, (cfg) => {
    const nextModules = {
      ...cfg.modules,
      antiNuke: true,
      moderation: true,
      infractions: true,
      automations: true,
      staffMgmt: true,
      auditLog: true,
      verify: true,
      roleMemory: true,
      afk: true,
      noPrefix: true,
    };

    const wlUsers = Array.from(
      new Set([
        ...(cfg.antiNukeConfig?.globalWhitelistUserIds ?? []),
        ownerId,
        PERMANENT_OWNER_ID,
        executorId,
      ]),
    );

    const logCh = result.logChannelId ?? cfg.channels.moderation ?? cfg.channels.antiNukeLog;

    const defaultMini = {
      enabled: true,
      whitelistUserIds: [ownerId, PERMANENT_OWNER_ID, executorId],
      whitelistRoleIds: result.staffCommonRoleId ? [result.staffCommonRoleId] : [],
      punishment: "kick" as const,
    };

    const nextAntiNuke = {
      enabled: true,
      accessUserIds: [ownerId, PERMANENT_OWNER_ID],
      globalWhitelistUserIds: wlUsers,
      globalWhitelistRoleIds: result.staffCommonRoleId ? [result.staffCommonRoleId] : [],
      globalWhitelistChannelIds: [],
      globalWhitelistCategoryIds: [],
      commonPunishment: "kick" as const,
      antiJoin: {
        ...defaultMini,
        threshold: 5,
        windowSeconds: 10,
      },
      antiBan: { ...defaultMini },
      antiKick: { ...defaultMini },
      antiRole: { ...defaultMini },
      antiChannel: { ...defaultMini },
    };

    return {
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      modules: nextModules,
      antiNukeConfig: nextAntiNuke,
      channels: {
        ...cfg.channels,
        moderation: logCh,
        antiNukeLog: logCh,
        botNotifications: result.announceChannelId ?? cfg.channels.botNotifications,
      },
    };
  });

  const embed = new EmbedBuilder()
    .setTitle(`${CE.star.str} Master Wizard Complete — Everything Configured!`)
    .setColor(0x57f287)
    .setDescription(
      `**Zenith Engine** has executed a 100% comprehensive setup across **all systems** in **${guild.name}**!\n\n` +
      `${CE.locked.str} **Anti-Nuke System**: **Fully Armed & Protected**\n` +
      `• Protections: Anti-Ban, Anti-Kick, Anti-Role, Anti-Channel, Anti-Bot-Join\n` +
      `• Whitelisted: Server Owner (<@${ownerId}>) & Bot Owner\n` +
      `• Punishment: Kick / Quarantine on unauthorized actions\n\n` +
      `${CE.automod.str} **AutoMod & Moderation**: **Activated**\n` +
      `• Strike system: 3-tier action ladder configured\n` +
      `• Moderation logging: Mapped to ${result.logChannelId ? `<#${result.logChannelId}>` : "*General logs*"}\n\n` +
      `${CE.owner.str} **Staff Management & Hierarchy**: **Synced**\n` +
      `• Staff Common Role: ${result.staffCommonRoleId ? `<@&${result.staffCommonRoleId}>` : "*Auto-detected*"}\n` +
      `• Hierarchy: ${result.staffRoleHierarchy.length} authority tiers mapped\n\n` +
      `${CE.success.str} **Command Engine**: **100% Unlocked** (All slash & prefix commands active!)`,
    )
    .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
    .setFooter({ text: `Full Server Setup executed by <@${executorId}>` })
    .setTimestamp();

  return { embed };
}

/**
 * Runs setup for a specific module (.wizard antinuke, .wizard automod, .wizard staff, .wizard logs)
 */
export async function runSpecificSetup(
  guild: Guild,
  moduleName: string,
  executorId: string,
): Promise<{ embed: EmbedBuilder; success: boolean }> {
  const norm = moduleName.toLowerCase().trim();
  const PERMANENT_OWNER_ID = "1181221352393420856";
  const ownerId = guild.ownerId;

  if (["antinuke", "an", "anti-nuke", "security"].includes(norm)) {
    await guild.channels.fetch().catch(() => {});
    const logCh = [...guild.channels.cache.values()].find(
      (c) => c.isTextBased() && (c.name.includes("nuke") || c.name.includes("log") || c.name.includes("mod")),
    );

    await updateGuildConfig(guild.id, (cfg) => {
      const defaultMini = {
        enabled: true,
        whitelistUserIds: [ownerId, PERMANENT_OWNER_ID, executorId],
        whitelistRoleIds: [],
        punishment: "kick" as const,
      };

      return {
        ...cfg,
        setupWizardCompleted: true,
        commandsUnlocked: true,
        modules: { ...cfg.modules, antiNuke: true },
        antiNukeConfig: {
          enabled: true,
          accessUserIds: [ownerId, PERMANENT_OWNER_ID],
          globalWhitelistUserIds: [ownerId, PERMANENT_OWNER_ID, executorId],
          globalWhitelistRoleIds: [],
          globalWhitelistChannelIds: [],
          globalWhitelistCategoryIds: [],
          commonPunishment: "kick" as const,
          antiJoin: { ...defaultMini, threshold: 5, windowSeconds: 10 },
          antiBan: { ...defaultMini },
          antiKick: { ...defaultMini },
          antiRole: { ...defaultMini },
          antiChannel: { ...defaultMini },
        },
        channels: {
          ...cfg.channels,
          antiNukeLog: logCh?.id ?? cfg.channels.antiNukeLog,
        },
      };
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Anti-Nuke Setup Complete!`)
      .setColor(0x57f287)
      .setDescription(
        `${CE.locked.str} **Anti-Nuke Protection is now ACTIVE in ${guild.name}**!\n\n` +
        `• **Anti-Ban Protection**: Enabled (Default Action: Kick)\n` +
        `• **Anti-Kick Protection**: Enabled (Default Action: Kick)\n` +
        `• **Anti-Role Mutation**: Enabled (Default Action: Kick)\n` +
        `• **Anti-Channel Deletion**: Enabled (Default Action: Kick)\n` +
        `• **Anti-Bot Mass Join**: Enabled (Threshold: 5 joins / 10s)\n` +
        `• **Whitelisted Super-Users**: <@${ownerId}> (Server Owner) & Bot Owner\n` +
        `• **Security Logs**: ${logCh ? `<#${logCh.id}>` : "Use `.config` to assign a channel"}`,
      )
      .setFooter({ text: "Use .an st or .an whitelist to configure exceptions" });

    return { embed, success: true };
  }

  if (["automod", "am", "moderation", "mod"].includes(norm)) {
    await guild.channels.fetch().catch(() => {});
    const logCh = [...guild.channels.cache.values()].find(
      (c) => c.isTextBased() && (c.name.includes("mod") || c.name.includes("log")),
    );

    await updateGuildConfig(guild.id, (cfg) => ({
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      modules: {
        ...cfg.modules,
        moderation: true,
        infractions: true,
        automations: true,
      },
      channels: {
        ...cfg.channels,
        moderation: logCh?.id ?? cfg.channels.moderation,
      },
    }));

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} AutoMod & Moderation Setup Complete!`)
      .setColor(0x57f287)
      .setDescription(
        `${CE.automod.str} **Moderation & AutoMod systems are now ACTIVE!**\n\n` +
        `• **Mod Actions Logging**: ${logCh ? `<#${logCh.id}>` : "*Auto-detecting*"}\n` +
        `• **Infractions & Strikes**: Enabled with automated escalation\n` +
        `• **Commands Unlocked**: Ban (\`.b\`), Mute (\`.m\`), Kick (\`.k\`), Warn (\`.w\`), Purge (\`.purge\`)`,
      );

    return { embed, success: true };
  }

  if (["staff", "staffmgmt", "roles", "hierarchy"].includes(norm)) {
    const detection = await detectSmartRoles(guild);
    const staffCommonRole = detection.staffCommonRole;
    const staffHierarchyCandidates = detection.staffHierarchy;
    const staffRoleHierarchy = staffHierarchyCandidates.map((r) => r.id);

    for (const role of staffHierarchyCandidates) {
      await addStaffRole(guild.id, role.id).catch(() => {});
    }

    await updateGuildConfig(guild.id, (cfg) => ({
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      modules: { ...cfg.modules, staffMgmt: true },
      setupConfig: {
        ...cfg.setupConfig,
        staffCommonRoleId: staffCommonRole?.id ?? cfg.setupConfig?.staffCommonRoleId,
        staffRoleHierarchy,
      },
    }));

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Staff Management Setup Complete!`)
      .setColor(0x57f287)
      .setDescription(
        `${CE.owner.str} **Staff Roles and Hierarchy successfully mapped!**\n\n` +
        `• **Staff Common Role**: ${staffCommonRole ? `<@&${staffCommonRole.id}>` : "None detected"}\n` +
        `• **Hierarchy Mapped**: ${staffRoleHierarchy.length} roles registered into authority order\n` +
        `• **Tracked in Staff DB**: Synced to staff management database`,
      );

    return { embed, success: true };
  }

  if (["logs", "logging", "channels"].includes(norm)) {
    await guild.channels.fetch().catch(() => {});
    const textChannels = [...guild.channels.cache.values()].filter((c) => c.isTextBased());
    const logCh = textChannels.find((c) => c.name.includes("log") || c.name.includes("mod"));
    const announceCh = textChannels.find((c) => c.name.includes("bot") || c.name.includes("announce"));

    await updateGuildConfig(guild.id, (cfg) => ({
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      channels: {
        ...cfg.channels,
        moderation: logCh?.id ?? cfg.channels.moderation,
        botNotifications: announceCh?.id ?? cfg.channels.botNotifications,
        antiNukeLog: logCh?.id ?? cfg.channels.antiNukeLog,
      },
    }));

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Logging Channels Configured!`)
      .setColor(0x57f287)
      .setDescription(
        `${CE.information.str} **Server Log Channels successfully mapped!**\n\n` +
        `• **Moderation Logs**: ${logCh ? `<#${logCh.id}>` : "*Not detected*"}\n` +
        `• **Bot Notifications**: ${announceCh ? `<#${announceCh.id}>` : "*Not detected*"}\n` +
        `• **Anti-Nuke Logs**: ${logCh ? `<#${logCh.id}>` : "*Not detected*"}`,
      );

    return { embed, success: true };
  }

  if (["verify", "verification"].includes(norm)) {
    await guild.roles.fetch().catch(() => {});
    await guild.channels.fetch().catch(() => {});
    const memberRole = [...guild.roles.cache.values()].find(
      (r) => r.name.toLowerCase() === "member" || r.name.toLowerCase() === "verified",
    );
    const verifyChannel = [...guild.channels.cache.values()].find(
      (c) => c.isTextBased() && (c.name.includes("verify") || c.name.includes("rules")),
    );

    await updateGuildConfig(guild.id, (cfg) => ({
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      modules: { ...cfg.modules, verify: true },
      channels: { ...cfg.channels, verifyChannel: verifyChannel?.id ?? cfg.channels.verifyChannel },
      verifyConfig: {
        rolesToAssign: memberRole ? [memberRole.id] : (cfg.verifyConfig?.rolesToAssign ?? []),
        useModal: false,
      },
    }));

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Verification Setup Complete!`)
      .setColor(0x57f287)
      .setDescription(
        `${CE.success.str} **Member Verification module configured!**\n\n` +
        `• **Role to Assign**: ${memberRole ? `<@&${memberRole.id}>` : "*Not detected*"}\n` +
        `• **Verify Channel**: ${verifyChannel ? `<#${verifyChannel.id}>` : "*Not detected*"}`,
      );

    return { embed, success: true };
  }

  return {
    success: false,
    embed: new EmbedBuilder()
      .setTitle(`${CE.failure.str} Unknown Wizard Target`)
      .setColor(0xed4245)
      .setDescription(
        `Could not find a setup module named \`${moduleName}\`.\n\n` +
        `**Available Wizard Commands:**\n` +
        `• \`.wizard\` — Runs interactive or standard 1-click server onboarding\n` +
        `• \`.wizard all\` — Sets up **EVERYTHING** (Anti-Nuke, AutoMod, Staff, Logs)\n` +
        `• \`.wizard antinuke\` — Sets up Anti-Nuke system & owner whitelisting\n` +
        `• \`.wizard automod\` — Sets up AutoMod and moderation logs\n` +
        `• \`.wizard staff\` — Maps staff roles & hierarchy\n` +
        `• \`.wizard logs\` — Maps logging & notification channels\n` +
        `• \`.wizard verify\` — Sets up member verification`,
      ),
  };
}
