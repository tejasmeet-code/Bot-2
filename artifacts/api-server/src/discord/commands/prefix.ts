import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { getGuildConfig, updateGuildConfig, DEFAULT_PREFIX } from "../storage/config";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("prefix")
    .setDescription("View or update Zenith Bot's custom command prefix for this server.")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a new custom command prefix")
        .addStringOption((opt) =>
          opt
            .setName("prefix")
            .setDescription("New command prefix (e.g. !, ?, z!, .)")
            .setRequired(true)
            .setMaxLength(5)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View the current active prefix for this server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Reset prefix back to default (.)")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    const sub = interaction.options.getSubcommand(false) || "view";
    const cfg = await getGuildConfig(guildId);
    const currentPrefix = cfg.prefix || cfg.guildPrefix || DEFAULT_PREFIX;

    if (sub === "view") {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.settings.str} Active Command Prefix`,
            description:
              `Zenith Bot's active command prefix in **${interaction.guild.name}** is:\n\n` +
              `> **\`${currentPrefix}\`**\n\n` +
              `*Example:* \`${currentPrefix}help\`, \`${currentPrefix}ping\`, \`${currentPrefix}config\`\n` +
              `*Note: Users with VIP No-Prefix privilege can execute commands without any prefix!*`,
            color: COLORS.primary,
          }),
        ],
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Permission Denied`,
            description: "You require the **Manage Server** permission to change the bot prefix.",
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "reset") {
      await updateGuildConfig(guildId, (c) => ({
        ...c,
        prefix: DEFAULT_PREFIX,
        guildPrefix: DEFAULT_PREFIX,
      }));
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Command Prefix Reset`,
            description: `Command prefix has been reset to default **\`${DEFAULT_PREFIX}\`**.`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "set") {
      const newPrefix = interaction.options.getString("prefix", true).trim();
      if (!newPrefix) return;

      await updateGuildConfig(guildId, (c) => ({
        ...c,
        prefix: newPrefix,
        guildPrefix: newPrefix,
      }));

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.check.str} Command Prefix Updated`,
            description: `Command prefix successfully set to **\`${newPrefix}\`** for **${interaction.guild.name}**.\n\n*Example:* \`${newPrefix}help\`, \`${newPrefix}config\``,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }
  },
};

export default command;
