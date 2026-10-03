import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  PermissionFlagsBits,
  User,
  Role,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getGuildConfig,
  toggleSpecializedBot,
  removeSpecializedBot,
  type SpecializedBotCategory,
  type SpecializedBotEntry,
  type GuildConfig,
} from "../storage/config";
import { isPermanentOwner, PERMANENT_BOT_OWNER_ID } from "../storage/premium";
import { CE, EMOJI } from "../utils/embedStyle";

export interface CategoryInfo {
  key: SpecializedBotCategory;
  name: string;
  commandName: string;
  aliases: string[];
  emojiStr: string;
  badge: string;
  color: number;
  description: string;
  permissionsGranted: string[];
}

export const SPECIALIZED_CATEGORIES: Record<SpecializedBotCategory, CategoryInfo> = {
  adminbots: {
    key: "adminbots",
    name: "Admin Bots & Roles",
    commandName: "adminbots",
    aliases: ["adminbot", "adminbots"],
    emojiStr: CE.admin.str,
    badge: `${CE.owner.str} ADMIN CLEARANCE`,
    color: 0xF1C40F,
    description: "Bots or roles with server administration and top-tier security clearance",
    permissionsGranted: [
      "Full Anti-Nuke immunity across all security modules (anti-ban, anti-kick, anti-role, anti-channel, anti-join)",
      "Immune to bot moderation actions (ban, kick, mute, jail, unwarn)",
      "AutoMod filter bypass and global spam rate exemption",
    ],
  },
  commonbots: {
    key: "commonbots",
    name: "Common Bots & Roles",
    commandName: "commonbots",
    aliases: ["commonbot", "commonbots"],
    emojiStr: CE.settings.str,
    badge: `${CE.settings.str} UTILITY CLEARANCE`,
    color: 0x5865F2,
    description: "Standard utility, economy, fun, giveaway, or game bots",
    permissionsGranted: [
      "Exempt from rapid message spam filters and duplicate message detection",
      "Protected from accidental automod timeouts, kicks, and mute triggers",
      "Recognized server utility bot clearance",
    ],
  },
  ticketbot: {
    key: "ticketbot",
    name: "Ticket Bots & Roles",
    commandName: "ticketbot",
    aliases: ["ticketbot", "ticketbots"],
    emojiStr: CE.ticket.str,
    badge: `${CE.ticket.str} TICKET CLEARANCE`,
    color: 0x3498DB,
    description: "Support ticket management bots (e.g., Ticket Tool, Ticketmaster)",
    permissionsGranted: [
      "Anti-Nuke channel creation and channel deletion exemption",
      "Permitted to create, delete, and adjust permissions for ticket channels and categories",
      "Exempt from mass channel creation/deletion security alarms",
    ],
  },
  staffmanagement: {
    key: "staffmanagement",
    name: "Staff Management Bots & Roles",
    commandName: "staffmanagement",
    aliases: ["staffmangement", "staffmanagement", "staffmanagementbot", "staffbot"],
    emojiStr: CE.staff.str,
    badge: `${CE.staff.str} STAFF CLEARANCE`,
    color: 0x9B59B6,
    description: "Staff role assignment, promotion management, and activity tracking bots",
    permissionsGranted: [
      "Anti-Nuke role update and member role assignment exemption",
      "Permitted to add, modify, or remove hierarchy roles without triggering anti-role alarms",
      "Staff directory and shift tracking permission",
    ],
  },
  musicbot: {
    key: "musicbot",
    name: "Music Bots & Roles",
    commandName: "musicbot",
    aliases: ["musicbot", "musicbots"],
    emojiStr: CE.music.str,
    badge: `${CE.music.str} AUDIO CLEARANCE`,
    color: 0x1DB954,
    description: "Music playback, stage streaming, and voice utility bots",
    permissionsGranted: [
      "Immunity from voice channel disconnects, server deafen, or server mute",
      "Exempt from voice-text slowmode and command cooldowns",
      "24/7 stage / voice channel residency clearance",
    ],
  },
  welcomerbot: {
    key: "welcomerbot",
    name: "Welcomer Bots & Roles",
    commandName: "welcomerbot",
    aliases: ["welcomerbot", "welcomer", "welcomebot"],
    emojiStr: CE.members.str,
    badge: `${CE.members.str} ONBOARDING CLEARANCE`,
    color: 0x2ECC71,
    description: "Greeting, auto-role, and server onboarding bots",
    permissionsGranted: [
      "Anti-Nuke anti-join and member join autorole assignment exemption",
      "Exempt from embed link and attachment automod filters in welcome channels",
      "Permitted to send greetings and assign initial join roles immediately",
    ],
  },
  loggingbot: {
    key: "loggingbot",
    name: "Logging Bots & Roles",
    commandName: "loggingbot",
    aliases: ["loggingbot", "logbot", "loggerbot"],
    emojiStr: CE.information.str,
    badge: `${CE.information.str} AUDIT CLEARANCE`,
    color: 0xE67E22,
    description: "Audit logging, transcript archiving, and tracking bots",
    permissionsGranted: [
      "Exempt from rapid message rate limits and webhook flood detection",
      "Permitted to stream audit logs and member event feeds continuously",
      "Transcript export and multi-channel logging bypass",
    ],
  },
  moderationbot: {
    key: "moderationbot",
    name: "Moderation Bots & Roles",
    commandName: "moderationbot",
    aliases: ["moderationbot", "modbot"],
    emojiStr: CE.moderation.str,
    badge: `${CE.moderation.str} MOD CLEARANCE`,
    color: 0xE74C3C,
    description: "Secondary moderation and server auto-defense partner bots",
    permissionsGranted: [
      "Anti-Nuke ban & kick exemption (actions recognized as authorized moderation)",
      "Recognized partner moderation bot clearance",
      "Exempt from anti-raid timeouts and rapid moderation triggers",
    ],
  },
  antinukebot: {
    key: "antinukebot",
    name: "Anti-Nuke Bots & Roles",
    commandName: "antinukebot",
    aliases: ["antinukebot", "securitybot"],
    emojiStr: CE.nuke.str,
    badge: `${CE.nuke.str} SECURITY CLEARANCE`,
    color: 0xE0245E,
    description: "External anti-nuke and security partner bots",
    permissionsGranted: [
      "Full global Anti-Nuke immunity across every single security module",
      "Recognized secondary security authority in the server",
      "Immunity from all bot moderation actions",
    ],
  },
};

async function hasWhitelistManagementPerms(
  userId: string,
  guildOwnerId: string,
  cfg: GuildConfig,
  member: import("discord.js").GuildMember | null,
): Promise<boolean> {
  if (isPermanentOwner(userId)) return true;
  if (userId === guildOwnerId) return true;
  const { isBotAdmin } = await import("../storage/premium");
  if (isBotAdmin(userId)) return true;
  try {
    const { getBotStaffMember } = await import("../storage/botStaff");
    const staff = await getBotStaffMember(userId);
    if (staff && (staff.role === "owner" || staff.role === "co_owner" || staff.role === "admin")) {
      return true;
    }
  } catch {}
  if (cfg.serverOwnerWhitelistUserIds?.includes(userId)) return true;
  if (cfg.serverAdminWhitelistUserIds?.includes(userId)) return true;
  if (member && member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

function resolveCategory(invokedName: string): SpecializedBotCategory | null {
  const norm = invokedName.toLowerCase().replace(/[-_ ]/g, "");
  for (const cat of Object.values(SPECIALIZED_CATEGORIES)) {
    if (cat.key.toLowerCase() === norm) return cat.key;
    if (cat.commandName.toLowerCase() === norm) return cat.key;
    if (cat.aliases.some((a) => a.toLowerCase().replace(/[-_ ]/g, "") === norm)) return cat.key;
  }
  return null;
}

export function buildOverviewEmbed(cfg: GuildConfig): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const sb: Partial<Record<SpecializedBotCategory, SpecializedBotEntry[]>> = cfg.specializedBots ?? {};
  const lines: string[] = [];

  for (const cat of Object.values(SPECIALIZED_CATEGORIES)) {
    const list: SpecializedBotEntry[] = sb[cat.key] ?? [];
    const count = list.length;
    lines.push(
      `### ${cat.emojiStr} **${cat.name}** (\`.${cat.commandName}\`)\n` +
      `*${cat.description}*\n` +
      `• **Configured**: \`${count}\` item${count === 1 ? "" : "s"}` +
      (count > 0 ? ` (${list.map((i: SpecializedBotEntry) => i.type === "role" ? `<@&${i.id}>` : `<@${i.id}>`).slice(0, 3).join(", ")}${count > 3 ? "..." : ""})` : "") +
      `\n• **Perms**: ${cat.permissionsGranted[0]}`
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(`${EMOJI.shield} Specialized Bots & Roles Whitelist Hub`)
    .setColor(0x2B2D31)
    .setDescription(
      `Configure specific bots or roles with customized permission tiers without giving full root admin access.\n\n` +
      lines.join("\n\n") +
      `\n\n**Quick Commands:**\n` +
      `• \`.adminbots @bot\` or \`.adminbots @role\`\n` +
      `• \`.ticketbot @TicketTool\`\n` +
      `• \`.staffmanagement @StaffBot\`\n` +
      `• \`.welcomer @WelcomeBot\`\n` +
      `• \`.musicbot @Fredboat\`\n` +
      `• \`.loggingbot @Logger\`\n` +
      `• \`.moderationbot @Carl-bot\`\n` +
      `• \`.antinukebot @SecurityBot\``
    )
    .setFooter({ text: "Specialized Bot Matrix • Granular Security Clearance" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn:bw:refresh")
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:bw:admin")
      .setLabel("Admin Bots")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn:bw:ticket")
      .setLabel("Ticket Bots")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn:bw:dismiss")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger),
  );

  return { embed, row };
}

export function buildCategoryEmbed(
  category: SpecializedBotCategory,
  cfg: GuildConfig,
  _guild: import("discord.js").Guild,
): EmbedBuilder {
  const cat = SPECIALIZED_CATEGORIES[category];
  const list = cfg.specializedBots?.[category] ?? [];

  const roleEntries = list.filter((i) => i.type === "role");
  const botEntries = list.filter((i) => i.type === "bot");

  let entriesText = "";
  if (list.length === 0) {
    entriesText = `*No bots or roles configured in this category yet.*\n*Use \`.${cat.commandName} @bot\` or \`.${cat.commandName} @role\` to add.*`;
  } else {
    if (botEntries.length > 0) {
      entriesText += `**Whitelisted Bots (${botEntries.length}):**\n` +
        botEntries.map((b) => `• <@${b.id}> (\`${b.id}\`) — added by <@${b.addedBy}>`).join("\n") + "\n\n";
    }
    if (roleEntries.length > 0) {
      entriesText += `**Whitelisted Roles (${roleEntries.length}):**\n` +
        roleEntries.map((r) => `• <@&${r.id}> (\`${r.id}\`) — added by <@${r.addedBy}>`).join("\n") + "\n";
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`${cat.emojiStr} ${cat.name} (${cat.badge})`)
    .setColor(cat.color)
    .setDescription(
      `*${cat.description}*\n\n` +
      `### Specific Permissions & Clearances Granted\n` +
      cat.permissionsGranted.map((p) => `• ${p}`).join("\n") +
      `\n\n### Current Whitelist Entries\n` +
      entriesText +
      `\n\n**Usage:**\n` +
      `• \`.${cat.commandName} @bot\` (Toggles bot)\n` +
      `• \`.${cat.commandName} @role\` (Toggles role)\n` +
      `• \`.${cat.commandName} <id>\` (Adds or removes by ID)`
    )
    .setFooter({ text: `Specialized Whitelist • Category: ${cat.commandName}` })
    .setTimestamp();

  return embed;
}

export const botWhitelistCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("botwhitelist")
    .setDescription("Manage specialized bot & role categories for granular permissions")
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Display the Specialized Bot Whitelist overview panel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("manage")
        .setDescription("Add, remove, or toggle a bot or role in a specialized category")
        .addStringOption((o) =>
          o
            .setName("category")
            .setDescription("The category to configure")
            .setRequired(true)
            .addChoices(
              { name: "👑 Admin Bots & Roles (.adminbots)", value: "adminbots" },
              { name: "⚙️ Common Bots & Roles (.commonbots)", value: "commonbots" },
              { name: "🎫 Ticket Bots & Roles (.ticketbot)", value: "ticketbot" },
              { name: "📋 Staff Management Bots (.staffmanagement)", value: "staffmanagement" },
              { name: "🎵 Music Bots & Roles (.musicbot)", value: "musicbot" },
              { name: "👋 Welcomer Bots & Roles (.welcomerbot)", value: "welcomerbot" },
              { name: "📜 Logging Bots & Roles (.loggingbot)", value: "loggingbot" },
              { name: "🔨 Moderation Bots & Roles (.moderationbot)", value: "moderationbot" },
              { name: "🛡️ Anti-Nuke Bots & Roles (.antinukebot)", value: "antinukebot" },
            )
        )
        .addMentionableOption((o) =>
          o.setName("target").setDescription("Bot or role to add/remove").setRequired(false)
        )
        .addStringOption((o) =>
          o
            .setName("action")
            .setDescription("Action to perform (default: toggle)")
            .addChoices(
              { name: "Toggle", value: "toggle" },
              { name: "Add", value: "add" },
              { name: "Remove", value: "remove" },
              { name: "List", value: "list" },
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: `${CE.failure.str} This command can only be executed in a server.`,
        flags: 1 << 6,
      });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId);
    const member = interaction.member
      ? (interaction.guild.members.cache.get(interaction.user.id) ?? (interaction.member as import("discord.js").GuildMember | null))
      : null;

    if (!(await hasWhitelistManagementPerms(interaction.user.id, interaction.guild.ownerId, cfg, member))) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: You need **Server Admin**, **Server Owner**, or **Administrator** permissions to configure bot whitelists.`,
        flags: 1 << 6,
      });
      return;
    }

    const invokedName = (interaction as any).invokedCommandName || "";
    const rawArgs: string[] = (interaction as any).rawArgs || [];

    // 1. Check if invoked by category alias directly (e.g. .adminbots, .ticketbot, .welcomer)
    let category: SpecializedBotCategory | null = resolveCategory(invokedName);

    // 2. If not from command alias, check options or first argument
    if (!category) {
      const catOpt = interaction.options.getString("category");
      if (catOpt && catOpt in SPECIALIZED_CATEGORIES) {
        category = catOpt as SpecializedBotCategory;
      } else if (rawArgs.length > 0) {
        const checkFirst = resolveCategory(rawArgs[0]);
        if (checkFirst) {
          category = checkFirst;
          rawArgs.shift();
        }
      }
    }

    // 3. If no category specified at all, show the master overview panel
    if (!category) {
      const { embed, row } = buildOverviewEmbed(cfg);
      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // 4. Resolve target (Bot or Role)
    let targetId: string | null = null;
    let targetType: "bot" | "role" = "bot";

    const mentionableOpt = interaction.options.getMentionable("target") as any;
    if (mentionableOpt) {
      targetId = mentionableOpt.id;
      if ("color" in mentionableOpt) {
        targetType = "role";
      } else {
        targetType = "bot";
      }
    }

    // If not found via slash option, scan rawArgs
    if (!targetId && rawArgs.length > 0) {
      for (const token of rawArgs) {
        // Check role mention <@&id>
        const roleMentionMatch = token.match(/^<@&(\d{17,20})>$/);
        if (roleMentionMatch) {
          targetId = roleMentionMatch[1];
          targetType = "role";
          break;
        }

        // Check user mention <@!?id>
        const userMentionMatch = token.match(/^<@!?(\d{17,20})>$/);
        if (userMentionMatch) {
          targetId = userMentionMatch[1];
          targetType = "bot";
          break;
        }

        // Check raw ID
        const idMatch = token.match(/^\d{17,20}$/);
        if (idMatch) {
          targetId = idMatch[0];
          const r = interaction.guild.roles.cache.get(targetId);
          if (r) {
            targetType = "role";
          } else {
            targetType = "bot";
          }
          break;
        }
      }
    }

    const actionOpt = interaction.options.getString("action");
    const isListAction = actionOpt === "list" || rawArgs[0]?.toLowerCase() === "list";

    // If no target provided or list explicitly requested, show category list
    if (!targetId || isListAction) {
      const embed = buildCategoryEmbed(category, cfg, interaction.guild);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Execute toggle / add / remove
    const cat = SPECIALIZED_CATEGORIES[category];
    const currentList = cfg.specializedBots?.[category] ?? [];
    const isAlready = currentList.some((item) => item.id === targetId);

    let isNowAdded = false;
    if (actionOpt === "remove" || (rawArgs[0]?.toLowerCase() === "remove")) {
      const res = await removeSpecializedBot(interaction.guildId, category, targetId);
      isNowAdded = !res.removed && isAlready;
    } else if (actionOpt === "add" || (rawArgs[0]?.toLowerCase() === "add")) {
      if (isAlready) {
        isNowAdded = true;
      } else {
        const res = await toggleSpecializedBot(interaction.guildId, category, targetId, targetType, interaction.user.id);
        isNowAdded = res.added;
      }
    } else {
      const res = await toggleSpecializedBot(interaction.guildId, category, targetId, targetType, interaction.user.id);
      isNowAdded = res.added;
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle(`${isNowAdded ? CE.success.str : CE.failure.str} ${cat.name} ${isNowAdded ? "Granted" : "Revoked"}`)
      .setColor(isNowAdded ? cat.color : 0xED4245)
      .setDescription(
        isNowAdded
          ? `Successfully whitelisted ${targetType === "role" ? `<@&${targetId}>` : `<@${targetId}>`} (\`${targetId}\`) under **${cat.name}**!\n\n` +
            `### Active Clearances & Permissions:\n` +
            cat.permissionsGranted.map((p) => `• ${p}`).join("\n")
          : `Revoked **${cat.name}** clearance from ${targetType === "role" ? `<@&${targetId}>` : `<@${targetId}>`} (\`${targetId}\`).`
      )
      .setFooter({ text: `Action by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [resultEmbed] });
  },
};

export async function handleBotWhitelistButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;

  const cfg = await getGuildConfig(interaction.guildId);
  const member = interaction.member
    ? (interaction.guild.members.cache.get(interaction.user.id) ?? (interaction.member as import("discord.js").GuildMember | null))
    : null;

  if (!(await hasWhitelistManagementPerms(interaction.user.id, interaction.guild.ownerId, cfg, member))) {
    await interaction.reply({
      content: `${CE.failure.str} Access Denied: Insufficient permissions.`,
      flags: 1 << 6,
    });
    return;
  }

  const customId = interaction.customId;

  if (customId === "btn:bw:refresh") {
    const { embed, row } = buildOverviewEmbed(cfg);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId === "btn:bw:dismiss") {
    await interaction.message.delete().catch(() => {});
    return;
  }

  if (customId === "btn:bw:admin") {
    const embed = buildCategoryEmbed("adminbots", cfg, interaction.guild);
    await interaction.reply({ embeds: [embed], flags: 1 << 6 });
    return;
  }

  if (customId === "btn:bw:ticket") {
    const embed = buildCategoryEmbed("ticketbot", cfg, interaction.guild);
    await interaction.reply({ embeds: [embed], flags: 1 << 6 });
    return;
  }
}
