import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { isPermanentOwner, isBotAdmin } from "../storage/premium";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("serverlist")
    .setDescription("Bot Owner only: List all servers the bot is currently in.")
    .setDMPermission(false),
  globalWhitelistOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const isOwner = isPermanentOwner(interaction.user.id) || (await isBotAdmin(interaction.user.id));
    if (!isOwner) {
      await interaction.reply({
        content: `${CE.error.str} This command is restricted to the bot owner.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const guilds = Array.from(interaction.client.guilds.cache.values());
    guilds.sort((a, b) => b.memberCount - a.memberCount);

    const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);

    const lines = guilds.slice(0, 20).map((g, idx) => {
      return `**${idx + 1}. ${g.name}**\n> ${CE.link_icon.str} \`${g.id}\` • ${CE.members.str} **${g.memberCount.toLocaleString()}** members • ${CE.owner.str} <@${g.ownerId}>`;
    });

    const moreText = guilds.length > 20 ? `\n*... and ${guilds.length - 20} more servers*` : "";

    await interaction.editReply({
      embeds: [
        prettyEmbed({
          title: `${CE.information.str} Active Servers (${guilds.length})`,
          description: `Total Combined Users: **${totalMembers.toLocaleString()}**\n\n` + lines.join("\n\n") + moreText,
          color: COLORS.primary,
          footer: `Requested by ${interaction.user.tag}`,
        }),
      ],
    });
  },
};

export default command;
