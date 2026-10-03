import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  User,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getBotStaffMember, BOT_STAFF_ROLES } from "../storage/botStaff";
import { isPermanentOwner } from "../storage/premium";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

/**
 * /checkstaff command - Verify if a user is an official Bot Staff member
 */
export const checkstaffCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("checkstaff")
    .setDescription("Check and verify if a user is an official Zenith Bot Staff member")
    .addUserOption((o) =>
      o.setName("target").setDescription("User to check staff verification status").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("target") || interaction.user;
    const isOwner = isPermanentOwner(targetUser.id);
    const staffMember = await getBotStaffMember(targetUser.id);

    if (isOwner) {
      const embed = prettyEmbed({
        title: "Bot Staff Verification • Permanent Owner",
        color: 0xf1c40f,
        description:
          `### ${CE.owner.str} **VERIFIED PERMANENT BOT OWNER**\n\n` +
          `**User:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n` +
          `**User ID:** \`${targetUser.id}\`\n` +
          `**Staff Rank:** \`[HARDCODED PERMANENT OWNER]\` ${CE.owner.str}\n\n` +
          `> ${CE.trophy.str} **Verification Status:** This user is the **Permanent Creator & Hardcoded Owner** of Zenith Bot.`,
        thumbnail: targetUser.displayAvatarURL({ extension: "png", size: 512 }),
        footer: "Zenith Official Security Verification Engine",
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (staffMember) {
      const roleMeta = BOT_STAFF_ROLES[staffMember.role];
      const embed = prettyEmbed({
        title: "Bot Staff Verification • Verified Staff Member",
        color: roleMeta?.color || COLORS.primary,
        description:
          `### ${CE.admin.str} **VERIFIED OFFICIAL BOT STAFF**\n\n` +
          `**User:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n` +
          `**User ID:** \`${targetUser.id}\`\n` +
          `**Staff Title:** \`${roleMeta?.title || "Bot Staff Member"}\` ${roleMeta?.emojiStr || CE.admin.str}\n` +
          `**Staff Badge:** \`${roleMeta?.badge || "[STAFF]"}\`\n` +
          `**Assigned On:** <t:${Math.floor(staffMember.assignedAt / 1000)}:F>\n\n` +
          `> ${CE.information.str} **Staff Description:** *${roleMeta?.description || "Official community support and administration staff."}*\n\n` +
          `**Staff Privileges:**\n` +
          (roleMeta?.benefits?.map((b) => `• ${b}`).join("\n") || "• Official support & community management clearance"),
        thumbnail: targetUser.displayAvatarURL({ extension: "png", size: 512 }),
        footer: "Zenith Official Security Verification Engine",
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Regular User
    const embed = prettyEmbed({
      title: "Bot Staff Verification • Community Member",
      color: 0x747f8d,
      description:
        `### ${CE.user.str} **REGULAR COMMUNITY USER**\n\n` +
        `**User:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n` +
        `**User ID:** \`${targetUser.id}\`\n` +
        `**Verification Status:** ${CE.error.str} **NOT A BOT STAFF MEMBER**\n\n` +
        `> ${CE.warning.str} **Security Warning:** This user is **NOT** an official Zenith Bot Staff member. Never trust fake staff claims asking for passwords, tokens, or administrator permissions!`,
      thumbnail: targetUser.displayAvatarURL({ extension: "png", size: 512 }),
      footer: "Zenith Official Security Verification Engine",
    });
    await interaction.reply({ embeds: [embed] });
  },
};
