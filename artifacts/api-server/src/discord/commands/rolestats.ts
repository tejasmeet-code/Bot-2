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
    .setName("rolestats")
    .setDescription("View message volume and activity trends for a server role.")
    .addRoleOption((o) => o.setName("role").setDescription("Role to view message stats for").setRequired(true)),

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

    const role = interaction.options.getRole("role");
    if (!role) {
      await interaction.reply({ content: "Please specify a role to view stats for.", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const days = getLast7Days();
    const dailyBars = days.map((d) => ({
      label: d.slice(5),
      value: statsData.roleDaily[d]?.[role.id] || 0,
    }));

    const totalRoleMsgs = dailyBars.reduce((a, b) => a + b.value, 0);
    const roleMemberCount = (guild.roles.cache.get(role.id) as any)?.members?.size ?? 0;
    const avgPerMember = roleMemberCount > 0 ? (totalRoleMsgs / roleMemberCount).toFixed(1) : "0";

    const imgBuffer = await renderStatsCard({
      categoryTitle: "ROLE ENGAGEMENT ANALYTICS",
      mainTitle: `@${role.name} Activity Breakdown`,
      subtitle: `Role Group Insights • Role ID: ${role.id}`,
      guildName: guild.name,
      items: [
        { label: "Role Members", value: roleMemberCount.toLocaleString(), sub: "Assigned guild members" },
        { label: "7-Day Messages", value: totalRoleMsgs.toLocaleString(), sub: "Messages sent by role" },
        { label: "Avg / Member", value: avgPerMember, sub: "Activity per member" },
        { label: "Role Color", value: (role as any).hexColor?.toUpperCase() || "#5865F2", sub: "Discord role accent" },
      ],
      bars: dailyBars,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Real-time role activity graph for @${role.name} • Zenith Intelligence`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-role-${role.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
