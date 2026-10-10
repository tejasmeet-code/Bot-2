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
    .setName("flowstats")
    .setDescription("View 7-day join & leave flow graphs and member velocity as a generated image."),

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

    const days = getLast7Days();
    const joinBars = days.map((d) => {
      const joins = statsData.joinsDaily[d] || 0;
      const leaves = statsData.leavesDaily[d] || 0;
      return {
        label: `${d.slice(5)} (+${joins}/-${leaves})`,
        value: joins,
      };
    });

    const totalJoins = Object.values(statsData.joinsDaily).reduce((a, b) => a + b, 0);
    const totalLeaves = Object.values(statsData.leavesDaily).reduce((a, b) => a + b, 0);
    const netGrowth = totalJoins - totalLeaves;

    const imgBuffer = await renderStatsCard({
      categoryTitle: "MEMBER RETENTION & FLOW",
      mainTitle: "Server Join & Leave Trajectory",
      subtitle: `7-Day Community Growth Rate • Current Members: ${guild.memberCount}`,
      guildName: guild.name,
      items: [
        { label: "Current Members", value: guild.memberCount.toLocaleString(), sub: "Total guild population" },
        { label: "Total Joins", value: `+${totalJoins}`, sub: "Tracked new joins" },
        { label: "Total Leaves", value: `-${totalLeaves}`, sub: "Tracked member departures" },
        { label: "Net Growth", value: `${netGrowth >= 0 ? "+" : ""}${netGrowth}`, sub: "Net community flow" },
      ],
      bars: joinBars,
      footerNote: `7-Day Join/Leave velocity curve for ${guild.name} • Generated automatically`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-flow-${guild.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
