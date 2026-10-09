import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  type Role,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getDjConfig, setDjConfig } from "../storage/musicDj";
import { CE, COLORS } from "../utils/embedStyle";

export const djCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("dj")
    .setDescription("Configure DJ role permissions for destructive music commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Set or change the server's designated DJ role")
        .addRoleOption((o) => o.setName("target_role").setDescription("The role to grant DJ authority").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable the DJ role requirement for music commands"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View current DJ system configuration and active role"),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, flags: 1 << 6 });
      return;
    }

    let sub: string | null = "status";
    try {
      sub = interaction.options.getSubcommand(false) || "status";
    } catch {
      sub = "status";
    }
    const config = await getDjConfig(interaction.guildId);

    if (!sub || sub === "status") {
      const embed = new EmbedBuilder()
        .setTitle(`${CE.music.str} Server DJ System Status`)
        .setColor(COLORS.primary)
        .setDescription(
          `**DJ Enforcement:** ${config.enabled ? `${CE.check.str} **Enabled**` : `${CE.error.str} **Disabled (Anyone in VC can control music)**`}\n` +
          `**DJ Role:** ${config.djRoleId ? `<@&${config.djRoleId}>` : "*No role configured*"}\n\n` +
          `*When enabled, destructive commands (skip, stop, volume, clear, equalizer, seek, remove, shuffle) require the DJ role or server administrator permissions.*`,
        )
        .setFooter({ text: "Use /dj role <role> to assign a DJ role" });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "toggle") {
      const newEnabled = !config.enabled;
      await setDjConfig(interaction.guildId, { enabled: newEnabled });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.music.str} DJ Enforcement ${newEnabled ? "ENABLED" : "DISABLED"}`)
            .setColor(newEnabled ? 0x57f287 : 0xed4245)
            .setDescription(
              newEnabled
                ? `DJ role restriction is now **ACTIVE**.${config.djRoleId ? ` Members require <@&${config.djRoleId}> to use destructive music controls.` : " Please assign a role with `/dj role <role>`!"}`
                : "DJ role restriction is now **DISABLED**. All users connected to the voice channel can control playback.",
            ),
        ],
      });
      return;
    }

    if (sub === "role") {
      let role: Role | null = null;
      try {
        role = interaction.options.getRole("target_role") as Role;
      } catch {}

      if (!role) {
        // Fallback: check if role was mentioned or provided in guild roles
        const mentionedRole = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() !== "@everyone");
        role = mentionedRole || null;
      }

      if (!role) {
        await interaction.reply({
          content: `${CE.failure.str} Please mention or specify a valid role (e.g. \`.dj role @DJ\` or \`.dj set @DJ\`).`,
          flags: 1 << 6,
        });
        return;
      }

      await setDjConfig(interaction.guildId, { djRoleId: role.id, enabled: true });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.music.str} DJ Role Configured`)
            .setColor(0x57f287)
            .setDescription(
              `Successfully set **${role.name}** (<@&${role.id}>) as the server's **DJ Role**!\n\n` +
              `DJ enforcement has been automatically enabled. Users with this role can skip, stop, alter volume, and manage audio filters.`,
            ),
        ],
      });
      return;
    }
  },
};
