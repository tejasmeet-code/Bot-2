import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getUserBio,
  setUserBio,
  isNoPrefixEnabled,
  setNoPrefix,
  getUserPremiumTier,
  PREMIUM_TIER_NAMES,
  renderProfileCard,
} from "../storage/profile";
import { getBotStaffMember } from "../storage/botStaff";
import { isPermanentOwner, isBotAdmin } from "../storage/premium";
import { getUserBugPoints, getBugHunterTier } from "../storage/bugReports";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

/**
 * /profile command - View user profile card with AI Studio Canvas graphic, Premium Tier, No-Prefix status, and Bio
 */
export const profileCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View user profile card with Premium Tier, No-Prefix status, and bio")
    .addUserOption((o) => o.setName("target").setDescription("User profile to view").setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("target") || interaction.user;
    const guildId = interaction.guildId || undefined;

    const member = interaction.guild
      ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      : null;

    const joinedAt = member?.joinedAt
      ? member.joinedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : interaction.guild ? "Not in server" : "Direct Message";

    const createdAt = targetUser.createdAt
      ? targetUser.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Dec 4, 2023";

    // ONLY show actual roles from the current server, ordered by highest position
    const serverRoles = member
      ? member.roles.cache
          .filter((r) => r.id !== interaction.guildId && r.name !== "@everyone")
          .sort((a, b) => b.position - a.position)
          .map((r) => r.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, "").trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    const bio = getUserBio(targetUser.id);
    const tier = await getUserPremiumTier(targetUser.id, guildId);
    const tierName = PREMIUM_TIER_NAMES[tier] || "Standard Free User";
    const noPrefix = await isNoPrefixEnabled(targetUser.id, guildId);
    const staffMember = await getBotStaffMember(targetUser.id);
    const isStaff = !!staffMember;

    const { getUserAllBadges } = await import("../storage/profile");
    const { badges: sortedBadges, badgeEmojisStr, topBadgesStr } = await getUserAllBadges(targetUser.id, guildId);

    const { getMemberLevel, getLeaderboardRank } = await import("../storage/levels");
    const { xpToNextLevel } = await import("../utils/levelCalc");
    const memberLevel = guildId ? await getMemberLevel(guildId, targetUser.id) : { level: 0, xp: 0, totalXp: 0, lastMessageXp: 0 };
    const userRank = (guildId && (memberLevel.totalXp ?? 0) > 0) ? await getLeaderboardRank(guildId, targetUser.id) : -1;
    const userLevel = memberLevel.level;
    const currentXp = memberLevel.xp;
    const neededXp = xpToNextLevel(userLevel);
    const progressPercent = Math.min(100, Math.max(0, Math.round((currentXp / Math.max(1, neededXp)) * 100)));
    const serverRank = userRank > 0 ? `Rank #${userRank}` : "Unranked";

    const badgeListStr = badgeEmojisStr;

    try {
      const cardBuffer = await renderProfileCard({
        userId: targetUser.id,
        username: targetUser.username,
        avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 512 }),
        bio,
        premiumTier: tier,
        premiumTierName: tierName,
        noPrefixEnabled: noPrefix,
        isBotStaff: isStaff,
        botStaffRole: staffMember?.role || null,
        joinedAt,
        createdAt,
        serverRoles,
        badges: sortedBadges,
        level: userLevel,
        xp: currentXp,
        nextLevelXp: neededXp,
        progressPercent,
        serverRank,
      });

      const attachment = new AttachmentBuilder(cardBuffer, { name: "profile.png" });

      await interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error({ err, userId: targetUser.id }, "Error rendering profile card");
      const fallbackEmbed = prettyEmbed({
        title: `${targetUser.username}'s Profile`,
        color: COLORS.primary,
        description:
          `### ${badgeListStr ? badgeListStr + " " : ""}**${targetUser.username}**\n` +
          `**Premium Rank:** \`${tierName}\`\n` +
          `**No-Prefix Mode:** ${noPrefix ? `${CE.check.str} \`ENABLED (ON)\`` : `${CE.failure.str} \`DISABLED (OFF)\` `}\n` +
          `**Bot Staff Clearance:** ${isStaff ? `${CE.verified.str} \`OFFICIAL STAFF\`` : `${CE.user.str} \`STANDARD MEMBER\``}\n\n` +
          `> ${CE.chat ? CE.chat.str : ""} **Bio:** *"${bio}"*`,
      });
      await interaction.editReply({ embeds: [fallbackEmbed] });
    }
  },
};

/**
 * /setbio command - Update custom user profile bio
 */
export const setbioCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setbio")
    .setDescription("Update your custom bio quote on your profile card")
    .addStringOption((o) =>
      o.setName("bio").setDescription("Your new bio text (up to 160 characters)").setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const rawBio = interaction.options.getString("bio", true);
    const updated = setUserBio(interaction.user.id, rawBio);

    const embed = prettyEmbed({
      title: "Profile Bio Updated",
      description:
        `### ${CE.check.str} **Successfully updated your profile bio!**\n\n` +
        `> **New Bio:** *"${updated}"*\n\n` +
        `Run \`/profile\` or \`.profile\` to view your updated card graphics!`,
      color: COLORS.primary,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * /noprefix command - Toggle No-Prefix execution mode for users or servers
 */
export const noprefixCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("noprefix")
    .setDescription("Toggle No-Prefix command execution for yourself or server")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Enable, disable or toggle No-Prefix mode")
        .setRequired(false)
        .addChoices(
          { name: "Enable No-Prefix", value: "on" },
          { name: "Disable No-Prefix", value: "off" }
        )
    )
    .addStringOption((o) =>
      o
        .setName("scope")
        .setDescription("Target scope (Personal user or Guild)")
        .setRequired(false)
        .addChoices(
          { name: "Personal User Scope", value: "user" },
          { name: "Server Guild Scope", value: "guild" }
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const rawMode = interaction.options.getString("mode", false);
    const scope = interaction.options.getString("scope", false) || "user";
    const targetId = scope === "guild" ? interaction.guildId : interaction.user.id;

    if (scope === "guild" && !interaction.guildId) {
      await interaction.reply({ content: `${CE.failure.str} Guild scope can only be configured inside a server.`, ephemeral: true });
      return;
    }

    const currentActive = await isNoPrefixEnabled(targetId!, scope === "guild" ? interaction.guildId ?? undefined : undefined);
    
    let mode: boolean;
    if (rawMode) {
      const lower = rawMode.toLowerCase();
      mode = lower === "on" || lower === "enable" || lower === "true" || lower === "1";
    } else {
      // Auto-toggle when no mode argument is provided
      mode = !currentActive;
    }

    setNoPrefix(targetId!, scope as any, mode);

    if (scope === "guild" && mode && interaction.guild) {
      try {
        const ownerUser = await interaction.client.users.fetch(interaction.guild.ownerId).catch(() => null);
        if (ownerUser) {
          const ownerDmEmbed = prettyEmbed({
            title: "Server No-Prefix Mode Activated",
            color: 0x2ecc71,
            description:
              `### ${CE.check.str} **No-Prefix Activated for ${interaction.guild.name}**\n\n` +
              `All members inside **${interaction.guild.name}** can now execute Zenith commands directly without typing a prefix!\n\n` +
              `*Configured by:* <@${interaction.user.id}>`,
          });
          await ownerUser.send({ embeds: [ownerDmEmbed] }).catch(() => {});
        }
      } catch (err) {
        logger.debug({ err }, "Could not notify guild owner about No-Prefix mode activation");
      }
    }

    const embed = prettyEmbed({
      title: "No-Prefix Mode Updated",
      description:
        `### ${mode ? CE.check.str : CE.failure.str} **No-Prefix Mode is now ${mode ? "`ACTIVE (ON)`" : "`DISABLED (OFF)`"}**\n\n` +
        `**Scope:** \`${scope.toUpperCase()}\` (${scope === "guild" ? interaction.guild?.name : interaction.user.username})\n` +
        `You can now run commands ${mode ? "directly without typing a prefix" : "using the default prefix"}!`,
      color: mode ? COLORS.success : COLORS.danger,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
