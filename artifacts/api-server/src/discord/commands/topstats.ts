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
    .setName("topstats")
    .setDescription("View top users and channels by message activity as an image template."),

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

    const sortedUsers = Object.entries(statsData.userMessages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([uid, cnt]) => {
        const user = guild.members.cache.get(uid)?.user;
        return {
          label: user ? `@${user.username}` : `User ${uid.slice(0, 8)}`,
          value: cnt,
        };
      });

    const totalTracked = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);

    const imgBuffer = await renderStatsCard({
      categoryTitle: "TOP ENGAGEMENT LEADERBOARD",
      mainTitle: "Most Active Community Members",
      subtitle: "Ranked by Recorded Message Volume",
      guildName: guild.name,
      items: [
        { label: "Tracked Messages", value: totalTracked.toLocaleString(), sub: "Across all channels" },
        { label: "Active Contributors", value: Object.keys(statsData.userMessages).length.toLocaleString(), sub: "Unique authors" },
        { label: "#1 Contributor", value: sortedUsers[0] ? sortedUsers[0].label : "None", sub: sortedUsers[0] ? `${sortedUsers[0].value} msgs` : "0 msgs" },
        { label: "Server Guild", value: guild.name, sub: "Zenith Community" },
      ],
      bars: sortedUsers,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Leaderboard ranking for ${guild.name} • Zenith Intelligence Template`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-top-${guild.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
