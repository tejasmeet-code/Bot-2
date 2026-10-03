import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildTextBasedChannel, ChannelType, PermissionFlagsBits } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { isPermanentOwner } from "../storage/premium";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("broadcast")
    .setDescription("Bot Owner only: Broadcast an announcement embed to all servers.")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("The message or announcement content to broadcast")
        .setRequired(true),
    )
    .setDMPermission(false),
  globalWhitelistOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isPermanentOwner(interaction.user.id)) {
      await interaction.reply({
        content: `${CE.error.str} Access denied. Only the permanent bot owner can broadcast announcements.`,
        ephemeral: true,
      });
      return;
    }

    const broadcastMsg = interaction.options.getString("message", true);
    await interaction.deferReply({ ephemeral: true });

    const guilds = Array.from(interaction.client.guilds.cache.values());
    let sentCount = 0;
    let failedCount = 0;

    const embed = prettyEmbed({
      title: `📢 Official Bot Broadcast`,
      description: broadcastMsg,
      color: COLORS.primary,
      footer: `Broadcast from Bot Administration`,
    });

    for (const guild of guilds) {
      try {
        // Find suitable announcement / system / general channel
        let targetChannel: GuildTextBasedChannel | null = null;
        if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.SendMessages)) {
          targetChannel = guild.systemChannel;
        } else {
          targetChannel = (guild.channels.cache.find(
            (c) =>
              c.type === ChannelType.GuildText &&
              c.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.SendMessages),
          ) as GuildTextBasedChannel) ?? null;
        }

        if (targetChannel) {
          await targetChannel.send({ embeds: [embed] });
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    await interaction.editReply({
      embeds: [
        prettyEmbed({
          title: `${CE.success.str} Broadcast Complete`,
          description: `Successfully broadcast message to **${sentCount}** servers (${failedCount} failed or lacked permissions).`,
          color: COLORS.success,
          footer: `Requested by ${interaction.user.tag}`,
        }),
      ],
    });
  },
};

export default command;
