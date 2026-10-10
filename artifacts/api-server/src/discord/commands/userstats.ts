import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildStats, getLast7Days } from "../storage/stats";
import { getGuildConfig } from "../storage/config";
import { renderStatsCard } from "../utils/statsRenderer";
import { CE, prettyEmbed, COLORS } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("userstats")
    .setDescription("View user message analytics, activity profile, and 7-day trend card.")
    .addUserOption((o) => o.setName("target").setDescription("User to view stats for").setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const cfg = await getGuildConfig(guild.id);
    const statsData = await getGuildStats(guild.id);

    const isStatsEnabled = cfg.modules.stats ?? statsData.enabled ?? true;
    if (!isStatsEnabled) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Stats Module Disabled`,
            description: `The **Stats Module** is disabled on **${guild.name}**.\nEnable it in **.config** under **Analytics & Stats** to use this command!`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser("target") || interaction.user;
    const totalUserMsgs = statsData.userMessages[targetUser.id] || 0;

    const allUsersSorted = Object.entries(statsData.userMessages).sort((a, b) => b[1] - a[1]);
    const rankIdx = allUsersSorted.findIndex(([uid]) => uid === targetUser.id);
    const rankStr = rankIdx >= 0 ? `#${rankIdx + 1} of ${allUsersSorted.length}` : "Unranked";

    const days = getLast7Days();
    const dailyBars = days.map((d) => ({
      label: d.slice(5),
      value: statsData.userDaily[d]?.[targetUser.id] || 0,
    }));

    const totalGuildMsgs = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);
    const sharePercent = totalGuildMsgs > 0 ? ((totalUserMsgs / totalGuildMsgs) * 100).toFixed(1) : "0";

    const imgBuffer = await renderStatsCard({
      categoryTitle: "USER MESSAGE ANALYTICS",
      mainTitle: `${targetUser.username}'s Activity Profile`,
      subtitle: `Server Contributor Insights • ID: ${targetUser.id}`,
      guildName: guild.name,
      items: [
        { label: "Total Messages", value: totalUserMsgs.toLocaleString(), sub: "Tracked server messages" },
        { label: "Server Rank", value: rankStr, sub: "Message leaderboard" },
        { label: "Activity Share", value: `${sharePercent}%`, sub: "Of all guild messages" },
        { label: "Account Type", value: targetUser.bot ? "Bot Automation" : "Community Member", sub: "User category" },
      ],
      bars: dailyBars,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Real-time activity profile for @${targetUser.username} • Generated via Canvas`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-user-${targetUser.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
