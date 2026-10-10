import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildStats } from "../storage/stats";
import { getGuildConfig } from "../storage/config";
import { renderStatsCard } from "../utils/statsRenderer";
import { CE, prettyEmbed, COLORS } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("hourstats")
    .setDescription("View 24-hour server traffic heatmap and peak hours activity card."),

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

    const hourly = statsData.hourlyActivity || new Array(24).fill(0);
    let maxVal = -1;
    let peakHour = 0;
    let minVal = Infinity;
    let quietHour = 0;

    for (let h = 0; h < 24; h++) {
      const v = hourly[h] || 0;
      if (v > maxVal) { maxVal = v; peakHour = h; }
      if (v < minVal) { minVal = v; quietHour = h; }
    }

    const total24h = hourly.reduce((a, b) => a + b, 0);

    const imgBuffer = await renderStatsCard({
      categoryTitle: "24-HOUR TRAFFIC TIMELINE",
      mainTitle: "Server Traffic & Peak Activity",
      subtitle: `Hourly Activity Heatmap • Current Members: ${guild.memberCount}`,
      guildName: guild.name,
      items: [
        { label: "Peak Hour", value: `${peakHour.toString().padStart(2, "0")}:00 UTC`, sub: `${maxVal} peak messages` },
        { label: "Quiet Hour", value: `${quietHour.toString().padStart(2, "0")}:00 UTC`, sub: `${minVal === Infinity ? 0 : minVal} quiet messages` },
        { label: "24h Volume", value: total24h.toLocaleString(), sub: "Messages in rolling 24h" },
        { label: "Total Members", value: guild.memberCount.toLocaleString(), sub: "Community size" },
      ],
      hourlyActivity: hourly,
      footerNote: `24-Hour hourly distribution heatmap for ${guild.name} • Zenith Intelligence Engine`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-hourly-${guild.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
