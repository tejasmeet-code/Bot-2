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
    .setName("hide")
    .setDescription("Hide a channel from @everyone.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to hide (defaults to current)")
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
        { ViewChannel: false },
        { reason: `Channel hidden by ${interaction.user.tag}` }
      );

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.locked.str} Channel Hidden`,
            description: `Successfully hidden <#${channel.id}> from **@everyone**.\nOnly members with explicit access or administrator bypass can see it now.`,
            color: COLORS.danger,
          }),
        ],
      });
    } catch (err) {
      await interaction.reply({
        content: `${CE.error.str} Failed to hide channel. Ensure I have **Manage Channels** and my role is above the channel's existing overrides.`,
        ephemeral: true,
      });
    }
  },
};

export default command;
