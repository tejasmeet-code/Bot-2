import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  type ColorResolvable,
  type Role,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed, buildSupportRow } from "../utils/embedStyle";

function parseHexColor(input: string): ColorResolvable | null {
  const clean = input.replace("#", "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean}` as ColorResolvable;
  }
  return null;
}

export const roleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Create, edit, delete, assign, remove, or list server roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new server role")
        .addStringOption((o) => o.setName("name").setDescription("Role name").setRequired(true))
        .addStringOption((o) => o.setName("color").setDescription("Role hex color (e.g. #57f287)").setRequired(false))
        .addBooleanOption((o) => o.setName("hoist").setDescription("Display role separately in member list").setRequired(false))
        .addBooleanOption((o) => o.setName("mentionable").setDescription("Allow anyone to mention this role").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing server role")
        .addRoleOption((o) => o.setName("role").setDescription("The role to edit").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("New role name").setRequired(false))
        .addStringOption((o) => o.setName("color").setDescription("New role hex color (e.g. #ff0000)").setRequired(false))
        .addBooleanOption((o) => o.setName("hoist").setDescription("Display separately").setRequired(false))
        .addBooleanOption((o) => o.setName("mentionable").setDescription("Allow mentioning").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a server role")
        .addRoleOption((o) => o.setName("role").setDescription("The role to delete").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Assign a role to a member")
        .addUserOption((o) => o.setName("user").setDescription("The target member").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("The role to assign").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role from a member")
        .addUserOption((o) => o.setName("user").setDescription("The target member").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("The role to remove").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all roles in this server with member count and details")
        .addIntegerOption((o) => o.setName("page").setDescription("Page number").setRequired(false)),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Command Unavailable",
            description: `${CE.failure.str} This command can only be used inside a Discord server.`,
            color: COLORS.danger,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles) && interaction.guild.ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Permission Denied",
            description: `${CE.failure.str} You require the **Manage Roles** permission to use this command.`,
            color: COLORS.danger,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Bot Permission Required",
            description: `${CE.failure.str} I require the **Manage Roles** permission to modify roles in this server.`,
            color: COLORS.danger,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false) || "list";

    // ── SUBCOMMAND: CREATE ──
    if (sub === "create") {
      const name = interaction.options.getString("name", true);
      const colorInput = interaction.options.getString("color");
      const hoist = interaction.options.getBoolean("hoist") ?? false;
      const mentionable = interaction.options.getBoolean("mentionable") ?? false;

      let color: ColorResolvable | undefined;
      if (colorInput) {
        const parsed = parseHexColor(colorInput);
        if (!parsed) {
          await interaction.reply({
            embeds: [
              prettyEmbed({
                title: "Invalid Color Hex",
                description: `${CE.failure.str} Please provide a valid 6-character hex color code (e.g. \`#57F287\` or \`FF0000\`).`,
                color: COLORS.danger,
              }),
            ],
            flags: 1 << 6,
          });
          return;
        }
        color = parsed;
      }

      try {
        const newRole = await interaction.guild.roles.create({
          name,
          color,
          hoist,
          mentionable,
          reason: `Created by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Created Successfully",
              description:
                `### ${CE.check.str}  **Role Created**\n\n` +
                `> **Name:** <@&${newRole.id}> (\`${newRole.name}\`)\n` +
                `> **ID:** \`${newRole.id}\`\n` +
                `> **Color:** \`${newRole.hexColor}\`\n` +
                `> **Displayed Separately:** ${newRole.hoist ? `${CE.check.str} Yes` : "No"}\n` +
                `> **Mentionable:** ${newRole.mentionable ? `${CE.check.str} Yes` : "No"}\n\n` +
                `${CE.manager.str} **Upgrade to Zenith Premium** for automated auto-roles, reaction-roles & instant anti-nuke role backups!`,
              color: newRole.color || COLORS.success,
              footer: "Zenith Role Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
          components: [buildSupportRow("Zenith VIP Hub")],
        });
      } catch (err: any) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Failed to Create Role",
              description: `${CE.failure.str} Encountered an error: \`${err.message || err}\``,
              color: COLORS.danger,
            }),
          ],
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: EDIT ──
    if (sub === "edit") {
      const role = interaction.options.getRole("role", true) as Role;
      if (!role) {
        await interaction.reply({ content: `${CE.failure.str} Please specify a valid role.`, flags: 1 << 6 });
        return;
      }

      if (role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Hierarchy Error",
              description: `${CE.failure.str} I cannot edit <@&${role.id}> because it is positioned higher than or equal to my highest role.`,
              color: COLORS.danger,
            }),
          ],
          flags: 1 << 6,
        });
        return;
      }

      if (interaction.guild.ownerId !== interaction.user.id && role.position >= member.roles.highest.position) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Hierarchy Error",
              description: `${CE.failure.str} You cannot edit <@&${role.id}> because it is positioned higher than or equal to your highest role.`,
              color: COLORS.danger,
            }),
          ],
          flags: 1 << 6,
        });
        return;
      }

      const newName = interaction.options.getString("name");
      const colorInput = interaction.options.getString("color");
      const hoist = interaction.options.getBoolean("hoist");
      const mentionable = interaction.options.getBoolean("mentionable");

      const updateData: any = {};
      if (newName) updateData.name = newName;
      if (colorInput) {
        const parsed = parseHexColor(colorInput);
        if (!parsed) {
          await interaction.reply({
            embeds: [
              prettyEmbed({
                title: "Invalid Color Hex",
                description: `${CE.failure.str} Please provide a valid 6-character hex color code (e.g. \`#57F287\`).`,
                color: COLORS.danger,
              }),
            ],
            flags: 1 << 6,
          });
          return;
        }
        updateData.color = parsed;
      }
      if (hoist !== null) updateData.hoist = hoist;
      if (mentionable !== null) updateData.mentionable = mentionable;

      if (Object.keys(updateData).length === 0) {
        await interaction.reply({
          content: `${CE.failure.str} Please specify at least one property to update (name, color, hoist, or mentionable).`,
          flags: 1 << 6,
        });
        return;
      }

      try {
        const updated = await role.edit({
          ...updateData,
          reason: `Edited by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Updated Successfully",
              description:
                `### ${CE.check.str}  **Role Modified**\n\n` +
                `> **Role:** <@&${updated.id}>\n` +
                `> **Name:** \`${updated.name}\`\n` +
                `> **Color:** \`${updated.hexColor}\`\n` +
                `> **Displayed Separately:** ${updated.hoist ? `${CE.check.str} Yes` : "No"}\n` +
                `> **Mentionable:** ${updated.mentionable ? `${CE.check.str} Yes` : "No"}`,
              color: updated.color || COLORS.success,
              footer: "Zenith Role Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Failed to Edit Role",
              description: `${CE.failure.str} Encountered an error: \`${err.message || err}\``,
              color: COLORS.danger,
            }),
          ],
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: DELETE ──
    if (sub === "delete") {
      const role = interaction.options.getRole("role", true) as Role;
      const reason = interaction.options.getString("reason") || `Deleted by ${interaction.user.tag}`;

      if (role.id === interaction.guild.id) {
        await interaction.reply({ content: `${CE.failure.str} Cannot delete the @everyone role.`, flags: 1 << 6 });
        return;
      }

      if (role.managed) {
        await interaction.reply({
          content: `${CE.failure.str} This role is managed by an external integration or bot and cannot be deleted manually.`,
          flags: 1 << 6,
        });
        return;
      }

      if (role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Hierarchy Error",
              description: `${CE.failure.str} I cannot delete <@&${role.id}> because it is positioned higher than or equal to my highest role.`,
              color: COLORS.danger,
            }),
          ],
          flags: 1 << 6,
        });
        return;
      }

      const roleName = role.name;
      const roleId = role.id;

      try {
        await role.delete(reason);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Deleted Successfully",
              description:
                `### ${CE.delete.str}  **Role Removed**\n\n` +
                `> **Role Name:** \`${roleName}\`\n` +
                `> **Role ID:** \`${roleId}\`\n` +
                `> **Reason:** ${reason}`,
              color: COLORS.danger,
              footer: "Zenith Role Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Failed to Delete Role",
              description: `${CE.failure.str} Encountered an error: \`${err.message || err}\``,
              color: COLORS.danger,
            }),
          ],
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: ADD ──
    if (sub === "add") {
      const targetUser = interaction.options.getUser("user", true);
      const role = interaction.options.getRole("role", true) as Role;

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.reply({ content: `${CE.failure.str} Member not found in this server.`, flags: 1 << 6 });
        return;
      }

      if (role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: `${CE.failure.str} I cannot assign <@&${role.id}> because it is positioned higher than my highest role.`,
          flags: 1 << 6,
        });
        return;
      }

      if (targetMember.roles.cache.has(role.id)) {
        await interaction.reply({
          content: `${CE.failure.str} <@${targetMember.id}> already has the <@&${role.id}> role.`,
          flags: 1 << 6,
        });
        return;
      }

      try {
        await targetMember.roles.add(role, `Assigned by ${interaction.user.tag}`);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Assigned",
              description:
                `### ${CE.check.str}  **Role Added**\n\n` +
                `> **Member:** <@${targetMember.id}>\n` +
                `> **Role:** <@&${role.id}>\n` +
                `> **Moderator:** <@${interaction.user.id}>`,
              color: role.color || COLORS.success,
              footer: "Zenith Role Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Could not assign role: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: REMOVE ──
    if (sub === "remove") {
      const targetUser = interaction.options.getUser("user", true);
      const role = interaction.options.getRole("role", true) as Role;

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.reply({ content: `${CE.failure.str} Member not found in this server.`, flags: 1 << 6 });
        return;
      }

      if (role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: `${CE.failure.str} I cannot remove <@&${role.id}> because it is positioned higher than my highest role.`,
          flags: 1 << 6,
        });
        return;
      }

      if (!targetMember.roles.cache.has(role.id)) {
        await interaction.reply({
          content: `${CE.failure.str} <@${targetMember.id}> does not possess the <@&${role.id}> role.`,
          flags: 1 << 6,
        });
        return;
      }

      try {
        await targetMember.roles.remove(role, `Removed by ${interaction.user.tag}`);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Role Removed",
              description:
                `### ${CE.delete.str}  **Role Revoked**\n\n` +
                `> **Member:** <@${targetMember.id}>\n` +
                `> **Role:** <@&${role.id}>\n` +
                `> **Moderator:** <@${interaction.user.id}>`,
              color: COLORS.danger,
              footer: "Zenith Role Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Could not remove role: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: LIST ──
    const allRoles = [...interaction.guild.roles.cache.values()]
      .filter((r) => r.id !== interaction.guild!.id)
      .sort((a, b) => b.position - a.position);

    const page = Math.max(1, interaction.options.getInteger("page") || 1);
    const pageSize = 15;
    const totalPages = Math.max(1, Math.ceil(allRoles.length / pageSize));
    const startIdx = (page - 1) * pageSize;
    const currentRoles = allRoles.slice(startIdx, startIdx + pageSize);

    const listLines = currentRoles.map((r, i) => {
      const idx = startIdx + i + 1;
      return `\`${idx}.\` <@&${r.id}> • Members: \`${r.members.size}\` • Color: \`${r.hexColor}\` • Pos: \`${r.position}\``;
    });

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: `Server Roles (${allRoles.length} Total)`,
          description:
            `### ${CE.moderation.str}  **Role Directory**\n\n` +
            (listLines.length > 0 ? listLines.join("\n") : "*No roles found on this page*") +
            `\n\n> ${CE.manager.str} **Protect your server:** Unlock **Zenith God-Mode Anti-Nuke** with instant role deletion prevention and auto-recovery.`,
          fields: [
            { name: "Total Roles", value: `\`${allRoles.length}\``, inline: true },
            { name: "Current Page", value: `\`${page} / ${totalPages}\``, inline: true },
          ],
          color: COLORS.primary,
          footer: `Page ${page} of ${totalPages} • Zenith Role Manager • discord.gg/gFgAfpSYdp`,
        }),
      ],
      components: [buildSupportRow("Zenith VIP Hub")],
    });
  },
};
