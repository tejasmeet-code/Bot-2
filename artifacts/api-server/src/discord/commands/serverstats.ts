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
    .setName("serverstats")
    .setDescription("View comprehensive server activity, traffic breakdown, and hourly heatmaps as an image."),

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

    const totalMsgs = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);
    const totalActiveUsers = Object.keys(statsData.userMessages).length;
    const channelsCount = guild.channels.cache.size;

    const days = getLast7Days();
    const serverDailyBars = days.map((d) => {
      const dailyMap = statsData.channelDaily[d] || {};
      const sum = Object.values(dailyMap).reduce((a, b) => a + b, 0);
      return {
        label: d.slice(5),
        value: sum,
      };
    });

    const imgBuffer = await renderStatsCard({
      categoryTitle: "SERVER ACTIVITY INTELLIGENCE",
      mainTitle: `${guild.name} Analytics Overview`,
      subtitle: `Realtime Server Metrics & 24h Heatmap • Total Members: ${guild.memberCount}`,
      guildName: guild.name,
      items: [
        { label: "Total Messages", value: totalMsgs.toLocaleString(), sub: "Historical message logs" },
        { label: "Active Writers", value: totalActiveUsers.toLocaleString(), sub: "Unique message posters" },
        { label: "Total Channels", value: channelsCount.toLocaleString(), sub: "Voice & text channels" },
        { label: "Server Size", value: guild.memberCount.toLocaleString(), sub: "Total cached members" },
      ],
      bars: serverDailyBars,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Live server analytics dashboard template for ${guild.name} • Zenith High-Fi Core`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-overview-${guild.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
