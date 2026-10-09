import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getUserBugPoints, getBugHunterTier, BUG_HUNTER_TIERS } from "../storage/bugReports";
import { getBotStaffMember } from "../storage/botStaff";
import { isPermanentOwner, isBotAdmin } from "../storage/premium";
import { isNoPrefixEnabled, getUserPremiumTier } from "../storage/profile";
import { CE, COLORS, resolveDynamicEmoji } from "../utils/embedStyle";

export const badgesCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("badges")
    .setDescription("View your unlocked profile badges and see how to earn others")
    .addUserOption((o) =>
      o.setName("target")
        .setDescription("User whose badges you want to view")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("target") || interaction.user;
    const guildId = interaction.guildId || undefined;

    const staffMember = await getBotStaffMember(targetUser.id);
    const isOwner = isPermanentOwner(targetUser.id) || staffMember?.role === "owner";
    const isCoOwner = staffMember?.role === "co_owner";
    const isAdmin = isBotAdmin(targetUser.id) || staffMember?.role === "admin";
    const tier = await getUserPremiumTier(targetUser.id, guildId);
    const noPrefix = await isNoPrefixEnabled(targetUser.id, guildId);

    const bugPoints = await getUserBugPoints(targetUser.id);
    const bugTier = await getBugHunterTier(bugPoints);

    // List of active badges for this user
    const unlocked: string[] = [];

    const getSafeEmoji = (name: string, fallback: string) => resolveDynamicEmoji(interaction.client, name, fallback);

    if (isOwner) unlocked.push(`${getSafeEmoji("icons_crown", CE.owner.str)} **Bot Owner** (Full access global badge)`);
    else if (isCoOwner) unlocked.push(`${getSafeEmoji("white_crown", CE.owner.str)} **Co-Owner** (Full clearance global badge)`);

    if (isAdmin) unlocked.push(`${getSafeEmoji("Mod", CE.admin.str)} **Bot Administrator** (Bot admin credentials)`);
    if (staffMember?.role === "head_tester") unlocked.push(`${getSafeEmoji("xD_Head_mod", CE.staff.str)} **QA Head Tester** (QA Quality lead badge)`);
    if (staffMember?.role === "tester") unlocked.push(`${getSafeEmoji("Tester", CE.staff.str)} **QA Quality Tester** (Beta feature tester)`);
    if (staffMember?.role === "mod") unlocked.push(`${getSafeEmoji("xD_Head_mod", CE.staff.str)} **Bot Moderator** (Global moderation staff)`);
    if (staffMember?.role === "help") unlocked.push(`${getSafeEmoji("support", CE.staff.str)} **Helper / Support Staff** (Support team)`);
    if (staffMember?.role === "vip") unlocked.push(`${getSafeEmoji("vip", CE.fortune.str)} **VIP Contributor** (Premium lifetimer)`);
    if (staffMember?.role === "homies") unlocked.push(`${getSafeEmoji("Homies", CE.members.str)} **Homie Member** (Core community friend)`);

    if (tier === 1) unlocked.push(`${getSafeEmoji("nitro_1_months", CE.fortune.str)} **VIP Supporter (Tier 1)**`);
    if (tier === 2) unlocked.push(`${getSafeEmoji("nitro_2_months", CE.fortune.str)} **Pro Master (Tier 2)**`);
    if (tier === 3) unlocked.push(`${getSafeEmoji("nitro_3_months", CE.fortune.str)} **Enterprise God (Tier 3)**`);
    if (tier === 4) unlocked.push(`${getSafeEmoji("nitro_12_months", CE.owner.str)} **Zenith Apex (Tier 4)**`);

    if (noPrefix) unlocked.push(`${getSafeEmoji("Turn_OnOff_Button", CE.automod.str)} **No-Prefix Mode Access** (Global speed executor)`);

    if (bugTier) {
      const bugEmoji = resolveDynamicEmoji(interaction.client, bugTier.emojiStr, CE.trophy.str);
      unlocked.push(`${bugEmoji} **${bugTier.name}** (Bug Points: \`${bugPoints}\`)`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Unlocked Badges`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .setColor(COLORS.primary)
      .setDescription(
        unlocked.length > 0
          ? `### Unlocked Badges:\n` + unlocked.map((b) => `◽ ${b}`).join("\n")
          : "*No badges unlocked yet. Follow the guide below to earn badges!*"
      )
      .addFields([
        {
          name: `${CE.bot.str} Official Zenith Bot Badges`,
          value:
            `> ${CE.automod.str} **Uses AutoMod**: Active Discord Native AutoMod integration\n` +
            `> ${CE.link.str} **Supports Commands**: Full Slash & Application Commands support\n` +
            `> ${CE.trophy.str} **Verified Bot**: Verified Discord Application Status`,
          inline: false,
        },
        {
          name: `${CE.admin.str} How to Get Staff & QA Badges`,
          value: "Apply during staff/testing recruitment cycles in our Support Server to get Owner, Admin, Tester, or Mod badges.",
          inline: false,
        },
        {
          name: `${CE.fortune.str} How to Get Premium Badges`,
          value: "Subscribe to Zenith Premium or upgrade your account to unlock VIP Tiers 1-4 and No-Prefix access badges.",
          inline: false,
        },
        {
          name: `${CE.trophy.str} How to Get Bug Hunter Badges`,
          value:
            "Use `/bugreport` to submit bugs. Our team reviews submissions: if approved, you earn points! \n" +
            BUG_HUNTER_TIERS.map(
              (t) => `◽ **${t.name}**: \`${t.minPoints}+\` Points (${resolveDynamicEmoji(interaction.client, t.emojiStr, CE.trophy.str)})`
            ).join("\n"),
          inline: false,
        },
      ])
      .setFooter({ text: "Zenith Quality Assurance & Badge Directory" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default badgesCommand;
