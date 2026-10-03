import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show detailed identity, server join history, and roles for a user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to look up (defaults to you)")
        .setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

    const createdTs = Math.floor(target.createdTimestamp / 1000);
    const joinedTs = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    let rolesStr = "None";
    if (member && member.roles.cache.size > 1) {
      rolesStr = member.roles.cache
        .filter((r) => r.id !== interaction.guild?.id)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 10)
        .join(" ");
    }

    const embed = prettyEmbed({
      title: `${target.tag} — Identity Dossier`,
      description:
        `### ${CE.members.str}  **User Profile**\n\n` +
        `> **Username:** \`${target.tag}\`\n` +
        `> **User ID:** \`${target.id}\`\n` +
        `> **Mention:** <@${target.id}>\n` +
        `> **Bot Account:** \`${target.bot ? "Yes" : "No"}\`\n\n` +
        `${CE.manager.str} **Want automated role assignments and custom auto-reactions?**\n` +
        `Unlock full community automation with **Zenith Premium**.`,
      color: COLORS.primary,
      thumbnail: target.displayAvatarURL({ size: 256 }),
      fields: [
        {
          name: `${CE.information.str}  Timeline & Verification`,
          value:
            `> **Registered:** <t:${createdTs}:F> (<t:${createdTs}:R>)\n` +
            (joinedTs ? `> **Joined Guild:** <t:${joinedTs}:F> (<t:${joinedTs}:R>)\n` : "") +
            `> **Key Permissions:** \`${member?.permissions.has("Administrator") ? "Administrator" : member?.permissions.has("ManageGuild") ? "Manage Server" : "Standard"}\``,
          inline: false,
        },
        {
          name: `${CE.star.str}  Assigned Roles (${member ? member.roles.cache.size - 1 : 0})`,
          value: rolesStr,
          inline: false,
        },
      ],
      footer: `User ID: ${target.id} • discord.gg/gFgAfpSYdp`,
    });

    await interaction.reply({
      embeds: [embed],
      components: [buildSupportRow()],
    });
  },
};

export default command;
