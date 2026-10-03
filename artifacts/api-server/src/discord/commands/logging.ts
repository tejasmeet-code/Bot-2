import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { getGuildConfig, updateGuildConfig } from "../storage/config";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("logging")
    .setDescription("Configure server audit logging channels for messages, moderation, voice, and member events.")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set target channel for a logging category")
        .addStringOption((opt) =>
          opt
            .setName("category")
            .setDescription("The log category to configure")
            .setRequired(true)
            .addChoices(
              { name: "Message Logs (Edits/Deletes)", value: "message" },
              { name: "Moderation Logs (Bans/Mutes/Kicks)", value: "moderation" },
              { name: "Member Logs (Joins/Leaves/Nicknames)", value: "member" },
              { name: "Voice Logs (VC Joins/Leaves/Moves/Roles)", value: "voice" },
              { name: "Role Logs (Role Creates/Deletes/Updates)", value: "role" },
              { name: "Channel Logs (Channel Creates/Deletes/Updates)", value: "channel" },
              { name: "Emoji & Sticker Logs", value: "emoji" },
              { name: "Music Logs", value: "music" },
              { name: "Ticket Logs", value: "ticket" },
              { name: "Staff Logs", value: "staff" }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Target text channel for logs")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable audit logging for the server")
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("True to enable, False to disable")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View all current audit logging channels and module statuses")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Permission Denied`,
            description: "You require the **Manage Server** permission to configure audit logging.",
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false) || "status";
    const cfg = await getGuildConfig(guildId);

    if (sub === "status") {
      const ch = cfg.channels || {};
      const isLoggingActive = cfg.modules?.auditLog ?? true;

      const getCh = (chId?: string) => (chId ? `<#${chId}>` : "`Not Configured`");

      const embed = prettyEmbed({
        title: `${CE.settings.str} Audit & Event Logging Configuration`,
        description:
          `### ${CE.clipboard.str} **Log Category Statuses**\n\n` +
          `> **Logging Module:** ${isLoggingActive ? `${CE.success.str} \`ENABLED\`` : `${CE.failure.str} \`DISABLED\``}\n` +
          `> **Message Logs (Edits/Deletes):** ${getCh(ch.messageLogChannel)}\n` +
          `> **Moderation Logs (Bans/Mutes):** ${getCh(ch.moderation)}\n` +
          `> **Member Logs (Joins/Leaves):** ${getCh(ch.memberLogChannel)}\n` +
          `> **Voice Logs (VC Joins/Moves):** ${getCh(ch.vcLogChannel)}\n` +
          `> **Role Logs (Role Updates):** ${getCh(ch.roleLogChannel)}\n` +
          `> **Channel Logs (Channel Updates):** ${getCh(ch.channelLogChannel)}\n\n` +
          `*Use \`.logging channel <category> <#channel>\` or \`.logging toggle <on|off>\` to update.*`,
        color: COLORS.primary,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "channel") {
      const cat = interaction.options.getString("category", true);
      const targetCh = interaction.options.getChannel("channel", true) as TextChannel;

      await updateGuildConfig(guildId, (c) => {
        const nextChannels = { ...c.channels };
        if (cat === "message") nextChannels.messageLogChannel = targetCh.id;
        else if (cat === "moderation") nextChannels.moderation = targetCh.id;
        else if (cat === "member") nextChannels.memberLogChannel = targetCh.id;
        else if (cat === "voice") nextChannels.vcLogChannel = targetCh.id;
        else if (cat === "role") nextChannels.roleLogChannel = targetCh.id;
        else if (cat === "channel") nextChannels.channelLogChannel = targetCh.id;

        return {
          ...c,
          modules: { ...c.modules, auditLog: true },
          channels: nextChannels,
        };
      });

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Logging Channel Configured`,
            description: `Audit logs for **${cat.toUpperCase()}** will now be routed to <#${targetCh.id}>.`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);

      await updateGuildConfig(guildId, (c) => ({
        ...c,
        modules: { ...c.modules, auditLog: enabled },
      }));

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Logging Category Updated`,
            description: `Audit logging has been **${enabled ? "ENABLED" : "DISABLED"}** for this server.`,
            color: enabled ? COLORS.success : COLORS.danger,
          }),
        ],
      });
      return;
    }
  },
};

export default command;
