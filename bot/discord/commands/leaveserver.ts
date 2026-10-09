import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { isPermanentOwner } from "../storage/premium";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("leaveserver")
    .setDescription("Bot Owner only: Force the bot to leave a specified server by ID.")
    .addStringOption((opt) =>
      opt
        .setName("guild_id")
        .setDescription("The ID of the server to leave")
        .setRequired(true),
    )
    .setDMPermission(false),
  globalWhitelistOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isPermanentOwner(interaction.user.id)) {
      await interaction.reply({
        content: `${CE.error.str} Access denied. Only the permanent bot owner can force server leaves.`,
        ephemeral: true,
      });
      return;
    }

    const targetGuildId = interaction.options.getString("guild_id", true).trim();
    const guild = interaction.client.guilds.cache.get(targetGuildId);

    if (!guild) {
      await interaction.reply({
        content: `${CE.error.str} Could not find server with ID \`${targetGuildId}\`. The bot may not be in that server.`,
        ephemeral: true,
      });
      return;
    }

    const guildName = guild.name;
    const memberCount = guild.memberCount;

    try {
      await guild.leave();
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.success.str} Server Left Successfully`,
            description: `Left **${guildName}** (\`${targetGuildId}\`) with **${memberCount}** members.`,
            color: COLORS.success,
            footer: `Executed by ${interaction.user.tag}`,
          }),
        ],
        ephemeral: true,
      });
    } catch (err: any) {
      await interaction.reply({
        content: `${CE.error.str} Failed to leave server: ${err?.message || err}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
