import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { getWelcomerConfig, updateWelcomerConfig } from "../storage/welcomer";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("welcomer")
    .setDescription("Configure welcome messages, join channel, and welcome display mode.")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set the welcome announcements channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The text channel to send welcome messages")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable welcome announcements")
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("True to enable, False to disable")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription("Customize the welcome message text")
        .addStringOption((opt) =>
          opt
            .setName("text")
            .setDescription("Welcome message (Variables: {user}, {username}, {server}, {count}, {ordinal})")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("mode")
        .setDescription("Set welcome message display format")
        .addStringOption((opt) =>
          opt
            .setName("format")
            .setDescription("Welcome format mode")
            .setRequired(true)
            .addChoices(
              { name: "Rich Embed Card", value: "embed" },
              { name: "Generated Image Card", value: "image" },
              { name: "Plain Text Message", value: "text" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View current welcomer module configuration")
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Send a simulated test welcome message")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Permission Denied`,
            description: "You require the **Manage Server** permission to configure the Welcomer module.",
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false) || "status";
    const cfg = await getWelcomerConfig(guildId);

    if (sub === "status") {
      const channelMention = cfg.channel.channelId ? `<#${cfg.channel.channelId}>` : "`Not Configured`";
      const embed = prettyEmbed({
        title: `${CE.members.str} Welcomer Module Configuration`,
        description:
          `### ${CE.settings.str} **Current Settings**\n\n` +
          `> **Module Status:** ${cfg.enabled && cfg.channel.enabled ? `${CE.success.str} \`ENABLED\`` : `${CE.failure.str} \`DISABLED\``}\n` +
          `> **Welcome Channel:** ${channelMention}\n` +
          `> **Display Mode:** \`${cfg.channel.mode.toUpperCase()}\`\n` +
          `> **Message Format:** \`${cfg.channel.embed?.description || cfg.channel.message || "Default Welcome"}\`\n\n` +
          `*Use \`.welcomer channel <#channel>\`, \`.welcomer toggle <on|off>\`, or \`.welcomer test\` to configure.*`,
        color: COLORS.primary,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await updateWelcomerConfig(guildId, (c) => {
        c.enabled = enabled;
        c.channel.enabled = enabled;
      });
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Welcomer Module Updated`,
            description: `Welcome announcements have been **${enabled ? "ENABLED" : "DISABLED"}**.`,
            color: enabled ? COLORS.success : COLORS.danger,
          }),
        ],
      });
      return;
    }

    if (sub === "channel") {
      const ch = interaction.options.getChannel("channel", true) as TextChannel;
      await updateWelcomerConfig(guildId, (c) => {
        c.enabled = true;
        c.channel.enabled = true;
        c.channel.channelId = ch.id;
      });
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Welcome Channel Configured`,
            description: `Welcome announcements will now be delivered to <#${ch.id}>.`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "message") {
      const text = interaction.options.getString("text", true);
      await updateWelcomerConfig(guildId, (c) => {
        c.channel.message = text;
        if (c.channel.embed) {
          c.channel.embed.description = text;
        }
      });
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Welcome Message Updated`,
            description: `Welcome message template updated to:\n\n> ${text}`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "mode") {
      const format = interaction.options.getString("format", true) as "embed" | "image" | "text";
      await updateWelcomerConfig(guildId, (c) => {
        c.channel.mode = format;
      });
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Welcome Display Mode Updated`,
            description: `Welcome display format set to **\`${format.toUpperCase()}\`**.`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "test") {
      if (!cfg.channel.channelId) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: `${CE.error.str} Welcome Channel Missing`,
              description: "Please set a welcome channel first using `/welcomer channel` or `.welcomer channel <#channel>`.",
              color: COLORS.danger,
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      const targetChannel = interaction.guild.channels.cache.get(cfg.channel.channelId) as TextChannel;
      if (!targetChannel) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: `${CE.error.str} Channel Not Found`,
              description: "The configured welcome channel could not be found or fetched.",
              color: COLORS.danger,
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      const testEmbed = prettyEmbed({
        title: `Welcome to ${interaction.guild.name}!`,
        description: `Hey ${interaction.user}, welcome to **${interaction.guild.name}**! You are our **#${interaction.guild.memberCount}** member.`,
        color: COLORS.primary,
        footer: `[TEST PREVIEW] • ${interaction.guild.name}`,
      });

      await targetChannel.send({ embeds: [testEmbed] }).catch(() => {});

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Test Welcome Message Dispatched`,
            description: `Sent test welcome preview to <#${targetChannel.id}>.`,
            color: COLORS.success,
          }),
        ],
        ephemeral: true,
      });
      return;
    }
  },
};

export default command;
