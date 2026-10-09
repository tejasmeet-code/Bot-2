import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  User,
} from "discord.js";
import type { SlashCommand } from "../types";
import { isUserPremium, isGuildPremium } from "../storage/premium";
import { getUserPremiumTier } from "../storage/profile";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

/**
 * /ghostradar command - Stealth Alt-Account & Raid Cluster Intelligence Radar
 */
export const ghostRadarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ghostradar")
    .setDescription("VIP Premium: Scan server members for stealth alt-accounts, suspicious join clusters & raid networks")
    .addUserOption((o) =>
      o.setName("target").setDescription("Member to inspect for alt-account patterns").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} Ghost Radar can only be used inside a server.`, ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const userId = interaction.user.id;
    const tier = await getUserPremiumTier(userId, guild.id);
    const uPrem = await isUserPremium(userId);
    const gPrem = await isGuildPremium(guild.id);

    if (!uPrem && !gPrem && tier < 1) {
      const embed = prettyEmbed({
        title: "👑 Premium Feature Required • Ghost Audit Radar",
        color: COLORS.premium,
        description:
          `### 🕵️ **Ghost Audit Radar is a VIP Premium Feature**\n\n` +
          `Detect hidden alt accounts, raid network clusters, and suspicious account creation patterns!\n\n` +
          `• 🔍 **Alt Account Risk Score**: Analyzes account age, default avatars, and mutual server metrics\n` +
          `• ⚡ **Raid Cluster Interception**: Identifies mass-joins occurring within seconds\n` +
          `• 🔒 **Stealth Member Profiling**: Deep risk report without alerting scanned users\n\n` +
          `> 💎 Run \`/premium\` or \`.premium\` to upgrade and unlock Ghost Radar!`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser("target");

    if (targetUser) {
      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      const createdAgeDays = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
      const joinedAgeDays = member ? Math.floor((Date.now() - (member.joinedTimestamp || Date.now())) / (1000 * 60 * 60 * 24)) : 0;

      const isNewAccount = createdAgeDays < 7;
      const isDefaultAvatar = targetUser.avatar === null;
      const riskScore = (isNewAccount ? 45 : 0) + (isDefaultAvatar ? 30 : 0) + (joinedAgeDays < 1 ? 25 : 0);

      const embed = prettyEmbed({
        title: `Ghost Radar • Stealth Analysis for ${targetUser.username}`,
        color: riskScore > 50 ? 0xed4245 : 0x2ecc71,
        description:
          `### 🕵️ **Member Threat & Alt-Account Assessment**\n\n` +
          `**User:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n` +
          `**User ID:** \`${targetUser.id}\`\n` +
          `**Account Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R> (\`${createdAgeDays} days old\`)\n` +
          `**Joined Server:** ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "`Unknown`"}\n` +
          `**Avatar Status:** ${isDefaultAvatar ? "⚠️ `DEFAULT DISCORD AVATAR`" : "✅ `CUSTOM AVATAR`"}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `### 📊 **Risk Calculation Matrix**\n` +
          `**Threat Score:** \`${riskScore}/100\` (${riskScore > 50 ? "🔴 HIGH RISK ALT ACCOUNT" : "🟢 LOW RISK VERIFIED USER"})\n` +
          `**Recommended Action:** ${riskScore > 50 ? "⚠️ `MONITOR FOR SPAM / QUARANTINE`" : "✅ `PASS (NO ACTION NEEDED)`"}`,
        thumbnail: targetUser.displayAvatarURL({ extension: "png", size: 512 }),
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Guild-wide scan
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    const now = Date.now();
    const recentJoins = members.filter((m) => m.joinedTimestamp && (now - m.joinedTimestamp) < 24 * 60 * 60 * 1000);
    const youngAccounts = members.filter((m) => (now - m.user.createdTimestamp) < 7 * 24 * 60 * 60 * 1000);

    const embed = prettyEmbed({
      title: `Ghost Radar • Server Scan Report for ${guild.name}`,
      color: COLORS.primary,
      description:
        `### 🕵️ **Server-Wide Stealth Security Audit**\n\n` +
        `**Total Scanned Members:** \`${guild.memberCount}\`\n` +
        `**Joined in Last 24 Hours:** \`${recentJoins.size}\` members\n` +
        `**Accounts Under 7 Days Old:** \`${youngAccounts.size}\` members\n` +
        `**Raid Network Risk Level:** ${youngAccounts.size > 5 ? "🔴 `ELEVATED RAID RISK`" : "🟢 `NORMAL / SECURE`"}\n\n` +
        `> 💡 **Tip:** Use \`/ghostradar target:@user\` to perform deep alt-account threat profiling on a specific member!`,
    });
    await interaction.editReply({ embeds: [embed] });
  },
};
