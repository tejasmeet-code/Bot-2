import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getUserBugPoints, getBugHunterTier } from "../storage/bugReports";
import { getBotStaffMember } from "../storage/botStaff";
import { isPermanentOwner, isBotAdmin } from "../storage/premium";
import {
  isNoPrefixEnabled,
  getUserPremiumTier,
  getUserBadges,
  addUserBadge,
  removeUserBadge,
  giveAllBadges,
  removeAllBadges,
  BADGE_CONFIGS,
} from "../storage/profile";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { isAdminOrOwner } from "../utils/staffPerms";

export const BADGE_DEFINITIONS: Record<string, { name: string; emoji: string; desc: string }> = {
  owner: { name: "Bot Owner", emoji: "<:white_owner:1555133769659187260>", desc: "Primary bot owner & creator clearance" },
  co_owner: { name: "Co-Owner", emoji: "<:white_co_owner:1555133610858647603>", desc: "Executive co-owner & partner clearance" },
  admin: { name: "Bot Administrator", emoji: "<:white_admin:1555133552797028443>", desc: "Global administrative authority" },
  head_tester: { name: "Head Tester", emoji: "<:white_HeadTester:1555133664554393620>", desc: "Lead quality assurance & tester" },
  tester: { name: "Quality Tester", emoji: "<:white_Tester:1555133862030483548>", desc: "Beta feature tester & QA team" },
  manager: { name: "Community Manager", emoji: "<:white_manager:1555133708057575466>", desc: "Operations & server manager" },
  mod: { name: "Bot Moderator", emoji: "<:Moderator:1555133403261571144>", desc: "Global server moderation staff" },
  help: { name: "Support Helper", emoji: "<:white_helper:1555133671340515439>", desc: "Official customer assistance & helper" },
  vip: { name: "VIP Contributor", emoji: "<:white_vip:1555133891281428500>", desc: "VIP lifetime contributor status" },
  homies: { name: "Homie", emoji: "<:white_homies:1555133678009589810>", desc: "Inner core community friend" },
  partner: { name: "Verified Partner", emoji: "<:white_partner:1555133776475070464>", desc: "Official server affiliate & partner" },
  supporter: { name: "Server Supporter", emoji: "<:white_supporter:1555133839351873556>", desc: "Dedicated server boosting supporter" },
  premium_1: { name: "VIP Supporter (Tier 1)", emoji: "<:Premium1:1555133459192615042>", desc: "Tier 1: VIP audio supporter perks" },
  premium_2: { name: "Pro Master (Tier 2)", emoji: "<:Premium2:1555133465022828626>", desc: "Tier 2: Pro master multi-server perks" },
  premium_3: { name: "Enterprise God (Tier 3)", emoji: "<:Premium3:1555133473205780550>", desc: "Tier 3: Enterprise high-speed audio perks" },
  premium_4: { name: "Relosta Apex (Tier 4)", emoji: "<:Premium4:1555133480810193016>", desc: "Tier 4: Supreme Apex VIP status" },
  no_prefix: { name: "No-Prefix Access", emoji: "<:white_no_prefix:1555133762734657581>", desc: "Rapid prefixless command execution" },
  bot_staff: { name: "Bot Staff Member", emoji: "<:white_support_team:1555133846801092631>", desc: "Official Zenith Bot staff member" },
  bug_hunter_1: { name: "Bug Hunter Tier I", emoji: "<:Bughunter_1:1555133271896096788>", desc: "1+ bug reports verified" },
  bug_hunter_2: { name: "Bug Hunter Tier II", emoji: "<:Bughunter_2:1555133279030485082>", desc: "5+ bug reports verified" },
  bug_hunter_3: { name: "Bug Hunter Tier III", emoji: "<:Bughunter_3:1555133286676832366>", desc: "15+ bug reports verified" },
  bug_hunter_4: { name: "Bug Hunter Tier IV", emoji: "<:Bughunter_4:1555133293765070880>", desc: "30+ bug reports verified" },
  bug_hunter_5: { name: "Bug Master", emoji: "<:white_award:1555133575165124638>", desc: "50+ bug reports verified" },
};

/**
 * Builds the list of active badges for a target user
 */
export async function getActiveBadgesForUser(userId: string, guildId?: string): Promise<string[]> {
  const staffMember = await getBotStaffMember(userId);
  const isOwner = isPermanentOwner(userId) || staffMember?.role === "owner";
  const isCoOwner = staffMember?.role === "co_owner";
  const isAdmin = isBotAdmin(userId) || staffMember?.role === "admin";
  const tier = await getUserPremiumTier(userId, guildId);
  const noPrefix = await isNoPrefixEnabled(userId, guildId);

  const badges: string[] = [];
  if (isOwner) badges.push("owner");
  else if (isCoOwner) badges.push("co_owner");

  if (isAdmin) badges.push("admin");
  if (staffMember?.role === "head_tester") badges.push("head_tester");
  if (staffMember?.role === "tester") badges.push("tester");
  if (staffMember?.role === "manager") badges.push("manager");
  if (staffMember?.role === "mod") badges.push("mod");
  if (staffMember?.role === "help") badges.push("help");
  if (staffMember?.role === "vip") badges.push("vip");
  if (staffMember?.role === "homies") badges.push("homies");
  if (staffMember?.role === "partner") badges.push("partner");
  if (staffMember?.role === "supporter") badges.push("supporter");

  if (tier > 0) badges.push(`premium_${tier}`);
  if (noPrefix) badges.push("no_prefix");
  if (staffMember && !badges.includes("owner") && !badges.includes("admin")) badges.push("bot_staff");

  const bugPoints = await getUserBugPoints(userId);
  const bugTier = await getBugHunterTier(bugPoints);
  if (bugTier) badges.push(bugTier.badgeKey);

  const customBadges = await getUserBadges(userId);
  for (const cb of customBadges) {
    if (!badges.includes(cb)) badges.push(cb);
  }

  const { sortBadgesByPriority } = await import("../storage/profile");
  return sortBadgesByPriority(badges);
}

/**
 * /badges list - List all badges in the bot
 */
export const badgesListCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badgeslist")
    .setDescription("List all available badges, custom emojis, and requirements"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const lines = Object.entries(BADGE_DEFINITIONS).map(([key, def]) => {
      return `${def.emoji} **${def.name}** (\`${key}\`)\n> ${def.desc}`;
    });

    const embed = prettyEmbed({
      title: `${CE.trophy.str} Official Zenith Bot Badges Directory`,
      description:
        `### All Available Badges & Custom Icons:\n\n` +
        lines.join("\n\n") +
        `\n\n> **Commands:**\n` +
        `> \`/badges [user]\` • View user badges\n` +
        `> \`/badges add <user> <badge>\` • Grant badge\n` +
        `> \`/badges remove <user> <badge>\` • Remove badge\n` +
        `> \`/badges all <user>\` • Grant all badges`,
      color: COLORS.primary,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

/**
 * /badges add <user> <badge>
 */
export const badgesAddCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badgesadd")
    .setDescription("Grant a custom badge to a user")
    .addUserOption((o) => o.setName("target").setDescription("User to receive badge").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("badge")
        .setDescription("Badge key to grant")
        .setRequired(true)
        .addChoices(
          ...Object.keys(BADGE_DEFINITIONS).slice(0, 25).map((k) => ({
            name: `${BADGE_DEFINITIONS[k].name} (${k})`,
            value: k,
          }))
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isAdminOrOwner(interaction)) {
      await interaction.reply({
        content: `${CE.failure.str} Only administrators and bot owners can assign badges.`,
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("target", true);
    const badgeKey = interaction.options.getString("badge", true).toLowerCase().trim();

    const def = BADGE_DEFINITIONS[badgeKey];
    if (!def) {
      await interaction.reply({
        content: `${CE.failure.str} Unknown badge key \`${badgeKey}\`. Run \`/badges list\` to view valid badges.`,
        ephemeral: true,
      });
      return;
    }

    await addUserBadge(targetUser.id, badgeKey);

    const embed = prettyEmbed({
      title: "Badge Granted",
      description:
        `### ${CE.check.str} **Successfully added badge to <@${targetUser.id}>!**\n\n` +
        `> **Badge:** ${def.emoji} **${def.name}** (\`${badgeKey}\`)\n` +
        `> **Perk:** ${def.desc}\n\n` +
        `Run \`/profile\` or \`/badges\` to view updated user graphics!`,
      color: COLORS.success,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * /badges remove <user> <badge>
 */
export const badgesRemoveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badgesremove")
    .setDescription("Remove a custom badge from a user")
    .addUserOption((o) => o.setName("target").setDescription("User to remove badge from").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("badge")
        .setDescription("Badge key to remove")
        .setRequired(true)
        .addChoices(
          ...Object.keys(BADGE_DEFINITIONS).slice(0, 25).map((k) => ({
            name: `${BADGE_DEFINITIONS[k].name} (${k})`,
            value: k,
          }))
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isAdminOrOwner(interaction)) {
      await interaction.reply({
        content: `${CE.failure.str} Only administrators and bot owners can remove badges.`,
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("target", true);
    const badgeKey = interaction.options.getString("badge", true).toLowerCase().trim();

    const def = BADGE_DEFINITIONS[badgeKey];
    await removeUserBadge(targetUser.id, badgeKey);

    const embed = prettyEmbed({
      title: "Badge Removed",
      description:
        `### ${CE.check.str} **Successfully removed badge from <@${targetUser.id}>!**\n\n` +
        `> **Badge:** ${def ? def.emoji : ""} **${def ? def.name : badgeKey}** (\`${badgeKey}\`)\n\n` +
        `Run \`/profile\` or \`/badges\` to view updated user graphics.`,
      color: COLORS.warning,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * /badges all <user> - Give all badges to a user
 */
export const badgesAllCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badgesall")
    .setDescription("Grant all badges to a target user")
    .addUserOption((o) => o.setName("target").setDescription("User to grant all badges").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isAdminOrOwner(interaction)) {
      await interaction.reply({
        content: `${CE.failure.str} Only administrators and bot owners can grant all badges.`,
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("target", true);
    await giveAllBadges(targetUser.id);

    const embed = prettyEmbed({
      title: "All Badges Granted",
      description:
        `### ${CE.check.str} **Successfully granted ALL ${Object.keys(BADGE_DEFINITIONS).length} badges to <@${targetUser.id}>!**\n\n` +
        `> All VIP, Staff, QA, Bug Hunter, and Supporter badges have been unlocked.\n` +
        `> Check profile card graphics with \`/profile\` or \`.profile\`!`,
      color: COLORS.success,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * /badges removeall <user> - Remove all custom badges from a user
 */
export const badgesRemoveAllCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badgesremoveall")
    .setDescription("Remove all custom badges from a target user")
    .addUserOption((o) => o.setName("target").setDescription("User to remove all badges from").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!isAdminOrOwner(interaction)) {
      await interaction.reply({
        content: `${CE.failure.str} Only administrators and bot owners can remove all badges.`,
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("target", true);
    await removeAllBadges(targetUser.id);

    const embed = prettyEmbed({
      title: "All Custom Badges Removed",
      description:
        `### ${CE.check.str} **Successfully removed ALL custom badges from <@${targetUser.id}>!**\n\n` +
        `> User badges cleared. Run \`/profile\` or \`/badges\` to view updated profile graphics.`,
      color: COLORS.warning,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * Main /badges command with subcommands: list, add, remove, all, removeall, view
 */
export const badgesCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badges")
    .setDescription("Badges management: view, list, add, remove, grant all, or remove all badges")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View unlocked badges of a person")
        .addUserOption((o) => o.setName("target").setDescription("User whose badges to view").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all available badges and custom icons in the bot")
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Grant a badge to a user")
        .addUserOption((o) => o.setName("target").setDescription("User to receive badge").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("badge")
            .setDescription("Badge key to grant (or 'all')")
            .setRequired(true)
            .addChoices(
              ...Object.keys(BADGE_DEFINITIONS).slice(0, 25).map((k) => ({
                name: `${BADGE_DEFINITIONS[k].name} (${k})`,
                value: k,
              }))
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a badge from a user")
        .addUserOption((o) => o.setName("target").setDescription("User to remove badge from").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("badge")
            .setDescription("Badge key to remove (or 'all')")
            .setRequired(true)
            .addChoices(
              ...Object.keys(BADGE_DEFINITIONS).slice(0, 25).map((k) => ({
                name: `${BADGE_DEFINITIONS[k].name} (${k})`,
                value: k,
              }))
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("all")
        .setDescription("Give a user all badges")
        .addUserOption((o) => o.setName("target").setDescription("User to grant all badges").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("removeall")
        .setDescription("Remove all badges from a user")
        .addUserOption((o) => o.setName("target").setDescription("User to remove all badges from").setRequired(true))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    // Prefix argument parsing support (.badge add all @user, .badge remove all @user, etc.)
    // @ts-ignore
    const rawArgs: string[] = interaction.rawArgs || [];
    if (rawArgs.length > 0) {
      const arg1 = rawArgs[0].toLowerCase();
      const arg2 = rawArgs[1]?.toLowerCase();

      // Check for 'add all' or 'addall' or 'giveall' or 'all'
      if ((arg1 === "add" && arg2 === "all") || arg1 === "addall" || arg1 === "giveall" || arg1 === "all") {
        const targetMention = rawArgs.find((a, idx) => idx >= (arg1 === "add" && arg2 === "all" ? 2 : 1) && a.match(/\d{17,20}/));
        const targetId = targetMention ? targetMention.match(/\d{17,20}/)?.[0] : interaction.user.id;
        if (targetId) {
          await giveAllBadges(targetId);
          await interaction.reply({
            embeds: [prettyEmbed({
              title: "All Badges Granted",
              description: `### ${CE.check.str} **Successfully granted ALL badges to <@${targetId}>!**`,
              color: COLORS.success,
            })],
          });
          return;
        }
      }

      // Check for 'remove all' or 'removeall' or 'clearall'
      if ((arg1 === "remove" && arg2 === "all") || arg1 === "removeall" || arg1 === "clearall") {
        const targetMention = rawArgs.find((a, idx) => idx >= (arg1 === "remove" && arg2 === "all" ? 2 : 1) && a.match(/\d{17,20}/));
        const targetId = targetMention ? targetMention.match(/\d{17,20}/)?.[0] : interaction.user.id;
        if (targetId) {
          await removeAllBadges(targetId);
          await interaction.reply({
            embeds: [prettyEmbed({
              title: "All Custom Badges Removed",
              description: `### ${CE.check.str} **Successfully removed ALL custom badges from <@${targetId}>!**`,
              color: COLORS.warning,
            })],
          });
          return;
        }
      }

      // Check for 'add <badge> <user>'
      if (arg1 === "add" && arg2) {
        const targetMention = rawArgs.find((a, idx) => idx > 1 && a.match(/\d{17,20}/));
        const targetId = (targetMention ? targetMention.match(/\d{17,20}/)?.[0] : interaction.user.id) || interaction.user.id;
        const badgeKey = arg2;
        await addUserBadge(targetId, badgeKey);
        await interaction.reply({
          embeds: [prettyEmbed({
            title: "Badge Added",
            description: `### ${CE.check.str} Added badge \`${badgeKey}\` to <@${targetId}>!`,
            color: COLORS.success,
          })],
        });
        return;
      }

      // Check for 'remove <badge> <user>'
      if (arg1 === "remove" && arg2) {
        const targetMention = rawArgs.find((a, idx) => idx > 1 && a.match(/\d{17,20}/));
        const targetId = (targetMention ? targetMention.match(/\d{17,20}/)?.[0] : interaction.user.id) || interaction.user.id;
        const badgeKey = arg2;
        await removeUserBadge(targetId, badgeKey);
        await interaction.reply({
          embeds: [prettyEmbed({
            title: "Badge Removed",
            description: `### ${CE.check.str} Removed badge \`${badgeKey}\` from <@${targetId}>!`,
            color: COLORS.warning,
          })],
        });
        return;
      }
    }

    const sub = interaction.options.getSubcommand(false);

    if (sub === "list") {
      return badgesListCommand.execute(interaction);
    }
    if (sub === "add") {
      return badgesAddCommand.execute(interaction);
    }
    if (sub === "remove") {
      return badgesRemoveCommand.execute(interaction);
    }
    if (sub === "all") {
      return badgesAllCommand.execute(interaction);
    }
    if (sub === "removeall") {
      return badgesRemoveAllCommand.execute(interaction);
    }

    // Default / "view" subcommand: List unlocked badges of target user
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("target") || interaction.user;
    const guildId = interaction.guildId || undefined;

    const badges = await getActiveBadgesForUser(targetUser.id, guildId);

    const unlockedLines = badges.map((b) => {
      const def = BADGE_DEFINITIONS[b];
      if (def) {
        return `${def.emoji} **${def.name}**\n> ${def.desc}`;
      }
      return `<:Tool:1555133545918369894> **${b.toUpperCase()}**\n> Custom server achievement badge`;
    });

    const embed = prettyEmbed({
      title: `${targetUser.username}'s Unlocked Badges`,
      description:
        unlockedLines.length > 0
          ? `### Active Badges (${unlockedLines.length}):\n\n` + unlockedLines.join("\n\n")
          : `*No badges unlocked yet for <@${targetUser.id}>.*\n\nRun \`/badges list\` to view all available badges!`,
      color: COLORS.primary,
      footer: "Zenith Intelligence • /badges list for all badges",
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default badgesCommand;
