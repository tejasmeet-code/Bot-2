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
    .setName("channelstats")
    .setDescription("View channel message volume, activity trends, and breakdown as an image.")
    .addChannelOption((o) => o.setName("target").setDescription("Channel to view stats for").setRequired(false)),

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

    const targetCh = interaction.options.getChannel("target") || interaction.channel;
    const targetChId = targetCh ? targetCh.id : interaction.channelId;
    const targetChName = (targetCh as any)?.name || "channel";

    const days = getLast7Days();
    const dailyBars = days.map((d) => ({
      label: d.slice(5),
      value: statsData.channelDaily[d]?.[targetChId] || 0,
    }));

    const totalChMsgs = dailyBars.reduce((a, b) => a + b.value, 0);
    const totalGuildMsgs = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);
    const sharePct = totalGuildMsgs > 0 ? ((totalChMsgs / totalGuildMsgs) * 100).toFixed(1) : "0";

    const imgBuffer = await renderStatsCard({
      categoryTitle: "CHANNEL ENGAGEMENT ANALYTICS",
      mainTitle: `#${targetChName} Activity Profile`,
      subtitle: `Channel Insights • ID: ${targetChId}`,
      guildName: guild.name,
      items: [
        { label: "Channel Msgs", value: totalChMsgs.toLocaleString(), sub: "Last 7 days volume" },
        { label: "Guild Share", value: `${sharePct}%`, sub: "Of overall server talk" },
        { label: "Channel Type", value: targetCh ? String((targetCh as any).type ?? "Text") : "Text", sub: "Discord channel kind" },
        { label: "Tracked Days", value: "7 Days", sub: "Rolling analytics window" },
      ],
      bars: dailyBars,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Channel activity template for #${targetChName} • Zenith Analytics`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-channel-${targetChId}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
