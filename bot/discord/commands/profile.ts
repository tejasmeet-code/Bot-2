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
      : "Apr 23, 2026";

    const createdAt = targetUser.createdAt
      ? targetUser.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Dec 4, 2023";

    const serverRoles = member
      ? member.roles.cache
          .filter((r) => r.name !== "@everyone")
          .map((r) => r.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, "").trim())
          .filter(Boolean)
          .slice(0, 5)
      : ["Admin", "Verified", "Application Ping"];

    const bio = getUserBio(targetUser.id);
    const tier = await getUserPremiumTier(targetUser.id, guildId);
    const tierName = PREMIUM_TIER_NAMES[tier] || "Standard Free User";
    const noPrefix = await isNoPrefixEnabled(targetUser.id, guildId);
    const staffMember = await getBotStaffMember(targetUser.id);
    const isStaff = !!staffMember;

    const isOwner = isPermanentOwner(targetUser.id) || staffMember?.role === "owner";
    const isCoOwner = staffMember?.role === "co_owner";
    const isAdmin = isBotAdmin(targetUser.id) || staffMember?.role === "admin";

    const badges: string[] = [];
    if (isOwner) badges.push("owner");
    else if (isCoOwner) badges.push("co_owner");

    if (isAdmin) badges.push("admin");
    if (staffMember?.role === "head_tester") badges.push("head_tester");
    if (staffMember?.role === "tester") badges.push("tester");
    if (staffMember?.role === "mod") badges.push("mod");
    if (staffMember?.role === "help") badges.push("help");
    if (staffMember?.role === "vip") badges.push("vip");
    if (staffMember?.role === "homies") badges.push("homies");

    if (tier > 0) badges.push(`premium_${tier}`);
    if (noPrefix) badges.push("no_prefix");
    if (isStaff && !badges.includes("owner") && !badges.includes("admin")) badges.push("bot_staff");

    const bugPoints = await getUserBugPoints(targetUser.id);
    const bugTier = await getBugHunterTier(bugPoints);
    if (bugTier) {
      badges.push(bugTier.badgeKey);
    }

    const getEmojiStr = (name: string, fallbackId: string, animated = false) => {
      const found = interaction.client.emojis.cache.find(e => e.name?.toLowerCase() === name.toLowerCase());
      if (found) {
        return found.toString();
      }
      return animated ? `<a:${name}:${fallbackId}>` : `<:${name}:${fallbackId}>`;
    };

    const BADGE_EMOJIS: Record<string, string> = {
      owner: getEmojiStr("icons_crown", "1077445439743336570"),
      co_owner: getEmojiStr("white_crown", "886844273671176263"),
      admin: getEmojiStr("Mod", "1524820838828871752", true),
      head_tester: getEmojiStr("xD_Head_mod", "1011353178060632074", true),
      tester: getEmojiStr("Tester", "799143615804342273", true),
      mod: getEmojiStr("xD_Head_mod", "1011353178060632074", true),
      help: getEmojiStr("support", "1140225994825941093", true),
      vip: getEmojiStr("vip", "938795741470654504", true),
      homies: getEmojiStr("Homies", "978688292809764874", true),
      premium_1: getEmojiStr("nitro_1_months", "1269242944938971168", true),
      premium_2: getEmojiStr("nitro_2_months", "1269242962370367613", true),
      premium_3: getEmojiStr("nitro_3_months", "1269242977620987936", true),
      premium_4: getEmojiStr("nitro_12_months", "1269243021770358796", true),
      no_prefix: getEmojiStr("Turn_OnOff_Button", "1350893966156894278", true),
      bot_staff: getEmojiStr("Mod", "1524820838828871752", true),
      bug_hunter_1: getEmojiStr("icons_6", "1357085417790505100"),
      bug_hunter_2: getEmojiStr("Tester", "799143615804342273", true),
      bug_hunter_3: getEmojiStr("37496alert", "1269243594913611857", true),
      bug_hunter_4: getEmojiStr("startpixel", "1524110226901434530", true),
      bug_hunter_5: getEmojiStr("AllBadges", "1550883328520097832", true)
    };

    const badgeListStr = badges.map((b) => BADGE_EMOJIS[b] || "").filter(Boolean).join(" ");

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
        badges,
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
      await interaction.reply({ content: `${CE.failure.str} Guild scope can only be configured inside a server.`, flags: 1 << 6 });
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
