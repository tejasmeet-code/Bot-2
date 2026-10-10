import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig, getAutoRoleConfig } from "../storage/config";
import { CE, prettyEmbed, COLORS } from "../utils/embedStyle";

export function buildAutoRoleEmbed(guildName: string, arc: { enabled: boolean; memberRoleIds: string[]; botRoleIds: string[] }): any {
  const statusStr = arc.enabled
    ? `${CE.button_on.str} **ENABLED**`
    : `${CE.button_off.str} **DISABLED**`;

  const memberRolesStr =
    arc.memberRoleIds.length > 0
      ? arc.memberRoleIds.map((rId) => `<@&${rId}>`).join(", ")
      : "*No member roles assigned*";

  const botRolesStr =
    arc.botRoleIds.length > 0
      ? arc.botRoleIds.map((rId) => `<@&${rId}>`).join(", ")
      : "*No bot roles assigned*";

  return prettyEmbed({
    title: `${CE.staff.str} AutoRole Configuration — ${guildName}`,
    description:
      `Automatically grant specific roles when new **members** or **bots** join the server.\n\n` +
      `> **AutoRole Status:** ${statusStr}\n` +
      `> **Human Member Roles:** ${memberRolesStr}\n` +
      `> **Bot Roles:** ${botRolesStr}\n\n` +
      `*Use the selection menus and toggle button below to configure:*`,
    color: arc.enabled ? COLORS.success : COLORS.neutral,
    footer: "Zenith Community Management • AutoRole Module",
  });
}

export function buildAutoRoleRows(arc: { enabled: boolean; memberRoleIds: string[]; botRoleIds: string[] }): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rowToggle = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("cfg:autorole:toggle")
      .setLabel(arc.enabled ? "AutoRole: Active" : "AutoRole: Inactive")
      .setEmoji(arc.enabled ? CE.button_on.id : CE.button_off.id)
      .setStyle(arc.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cfg:autorole:clearMembers")
      .setLabel("Clear Member Roles")
      .setEmoji(CE.trash.id)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("cfg:autorole:clearBots")
      .setLabel("Clear Bot Roles")
      .setEmoji(CE.trash.id)
      .setStyle(ButtonStyle.Danger)
  );

  const rowMemberRoles = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("cfg:autorole:setMemberRoles")
      .setPlaceholder("Select Role(s) for Human Members (Max 5)")
      .setMinValues(1)
      .setMaxValues(5)
  );

  const rowBotRoles = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("cfg:autorole:setBotRoles")
      .setPlaceholder("Select Role(s) for Joined Bots (Max 5)")
      .setMinValues(1)
      .setMaxValues(5)
  );

  return [rowToggle, rowMemberRoles, rowBotRoles];
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Configure roles automatically granted to new human members and bots upon joining.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View current AutoRole configuration for members and bots.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable the AutoRole module.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("member")
        .setDescription("Add or replace autorole for human members.")
        .addRoleOption((o) => o.setName("role").setDescription("Role to assign to human members").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("bot")
        .setDescription("Add or replace autorole for joined bots.")
        .addRoleOption((o) => o.setName("role").setDescription("Role to assign to joined bots").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear member or bot autoroles.")
        .addStringOption((o) =>
          o
            .setName("target")
            .setDescription("Which autoroles to clear")
            .setRequired(true)
            .addChoices(
              { name: "Members Only", value: "members" },
              { name: "Bots Only", value: "bots" },
              { name: "Both (All)", value: "all" }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand(false) || "status";

    if (sub === "status") {
      const cfg = await getGuildConfig(guildId);
      const arc = getAutoRoleConfig(cfg);
      const embed = buildAutoRoleEmbed(interaction.guild.name, arc);
      const rows = buildAutoRoleRows(arc);
      await interaction.reply({ embeds: [embed], components: rows as any });
      return;
    }

    if (sub === "toggle") {
      const updated = await updateGuildConfig(guildId, (c) => {
        const arc = getAutoRoleConfig(c);
        c.autoRoleConfig = {
          ...arc,
          enabled: !arc.enabled,
        };
        return c;
      });
      const arc = getAutoRoleConfig(updated);
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.success.str} AutoRole Updated`,
            description: `AutoRole is now ${arc.enabled ? `${CE.button_on.str} **ENABLED**` : `${CE.button_off.str} **DISABLED**`}.`,
            color: arc.enabled ? COLORS.success : COLORS.neutral,
          }),
        ],
      });
      return;
    }

    if (sub === "member") {
      const role = interaction.options.getRole("role", true);
      const updated = await updateGuildConfig(guildId, (c) => {
        const arc = getAutoRoleConfig(c);
        const roles = Array.from(new Set([...arc.memberRoleIds, role.id]));
        c.autoRoleConfig = {
          ...arc,
          enabled: true,
          memberRoleIds: roles,
        };
        return c;
      });
      const arc = getAutoRoleConfig(updated);
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.success.str} Member AutoRole Added`,
            description: `Added <@&${role.id}> to member autoroles!\nAutoRole is currently **${arc.enabled ? "ENABLED" : "DISABLED"}**.`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "bot") {
      const role = interaction.options.getRole("role", true);
      const updated = await updateGuildConfig(guildId, (c) => {
        const arc = getAutoRoleConfig(c);
        const roles = Array.from(new Set([...arc.botRoleIds, role.id]));
        c.autoRoleConfig = {
          ...arc,
          enabled: true,
          botRoleIds: roles,
        };
        return c;
      });
      const arc = getAutoRoleConfig(updated);
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.success.str} Bot AutoRole Added`,
            description: `Added <@&${role.id}> to bot autoroles!\nAutoRole is currently **${arc.enabled ? "ENABLED" : "DISABLED"}**.`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    if (sub === "clear") {
      const target = interaction.options.getString("target", true);
      await updateGuildConfig(guildId, (c) => {
        const arc = getAutoRoleConfig(c);
        if (target === "members" || target === "all") arc.memberRoleIds = [];
        if (target === "bots" || target === "all") arc.botRoleIds = [];
        c.autoRoleConfig = arc;
        return c;
      });
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.trash.str} AutoRole Cleared`,
            description: `Successfully cleared autorole entries for **${target}**.`,
            color: COLORS.danger,
          }),
        ],
      });
      return;
    }
  },
};

export default command;
