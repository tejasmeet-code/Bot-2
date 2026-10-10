import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { updateGuildConfig } from "../storage/config";
import { type SlashCommand } from "../types";

export const autoroleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Configure autorole for new members.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addBooleanOption(o => o.setName("enabled").setDescription("Enable or disable autorole").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("The role to assign").setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;
    const enabled = interaction.options.getBoolean("enabled", true);
    const role = interaction.options.getRole("role");

    await updateGuildConfig(interaction.guildId, (cfg) => ({
      ...cfg,
      autorole: {
        enabled,
        roleIds: role ? [role.id] : (cfg.autorole?.roleIds || []),
      },
    }));

    await interaction.reply({ content: `Autorole has been ${enabled ? "enabled" : "disabled"}.${role ? ` Role set to <@&${role.id}>.` : ""}`, flags: 1 << 6 });
  },
};

export default autoroleCommand;
