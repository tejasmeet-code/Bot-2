import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show detailed information, security, and statistics about this server."),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const owner = await guild.fetchOwner().catch(() => null);
    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);
    const verificationLevel = guild.verificationLevel.toString();

    const embed = prettyEmbed({
      title: `${guild.name} — Server Information`,
      description:
        `### ${CE.admin.str}  **Guild Overview**\n\n` +
        `> **Server Name:** **${guild.name}**\n` +
        `> **Server ID:** \`${guild.id}\`\n` +
        `> **Owner:** ${owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : "Unknown"}\n` +
        `> **Created:** <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)\n\n` +
        `${CE.boost.str} **Want automated Anti-Raid & 24/7 Music for this server?**\n` +
        `Upgrade with **Zenith Premium** to protect your community from unauthorized raids.`,
      color: COLORS.primary,
      thumbnail: guild.iconURL({ size: 256 }) || undefined,
      fields: [
        {
          name: `${CE.members.str}  Community & Channels`,
          value:
            `> **Members:** \`${guild.memberCount.toLocaleString()}\` members\n` +
            `> **Channels:** \`${guild.channels.cache.size}\` channels\n` +
            `> **Roles:** \`${guild.roles.cache.size}\` roles\n` +
            `> **Emojis:** \`${guild.emojis.cache.size}\` custom emojis`,
          inline: true,
        },
        {
          name: `${CE.settings.str}  Security & Verification`,
          value:
            `> **Verification Level:** \`${verificationLevel}\`\n` +
            `> **AFK Channel:** ${guild.afkChannelId ? `<#${guild.afkChannelId}>` : "`None`"}\n` +
            `> **Boost Tier:** \`Tier ${guild.premiumTier}\` (${guild.premiumSubscriptionCount || 0} boosts)\n` +
            `> **Zenith Shield:** ${CE.check.str} \`Active\``,
          inline: true,
        },
      ],
      footer: `Server ID: ${guild.id} • discord.gg/gFgAfpSYdp`,
    });

    await interaction.reply({
      embeds: [embed],
      components: [buildSupportRow()] as any,
    });
  },
};

export default command;
