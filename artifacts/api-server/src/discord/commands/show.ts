import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type GuildChannel,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("show")
    .setDescription("Unhide a channel and restore visibility for @everyone.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to show (defaults to current)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const channel = (interaction.options.getChannel("channel") || interaction.channel) as GuildChannel;
    
    if (!channel) {
      await interaction.reply({ content: "Could not resolve channel.", ephemeral: true });
      return;
    }

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { ViewChannel: null },
        { reason: `Channel shown by ${interaction.user.tag}` }
      );

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.success.str} Channel Visible`,
            description: `Successfully restored visibility for <#${channel.id}> to **@everyone**.`,
            color: COLORS.success,
          }),
        ],
      });
    } catch (err) {
      await interaction.reply({
        content: `${CE.error.str} Failed to show channel. Ensure I have **Manage Channels** and my role is above the channel's existing overrides.`,
        ephemeral: true,
      });
    }
  },
};

export default command;
