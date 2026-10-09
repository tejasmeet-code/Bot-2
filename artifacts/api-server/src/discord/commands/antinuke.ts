import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig, getAntiNukeConfig } from "../storage/config";
import { CE } from "../utils/embedStyle";
import { isBotAdmin } from "../storage/premium";

function canAccessAntiNuke(interaction: ChatInputCommandInteraction, cfg: any): boolean {
  if (!interaction.guild) return false;
  const uid = interaction.user.id;
  if (interaction.guild.ownerId === uid) return true;
  if (isBotAdmin(uid)) return true;
  if (cfg.serverOwnerWhitelistUserIds?.includes(uid)) return true;
  if (cfg.antiNukeConfig?.globalWhitelistUserIds?.includes(uid)) return true;
  if (cfg.antiNukeConfig?.ownerWhitelistedUserIds?.includes(uid)) return true;
  const member = interaction.member as import("discord.js").GuildMember | null;
  if (member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  return false;
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Manage Anti-Nuke rules and whitelists")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName("whitelist")
        .setDescription("Manage global Anti-Nuke whitelists")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a user, role, channel, or category to Anti-Nuke whitelist")
            .addUserOption((o) => o.setName("user").setDescription("User to whitelist").setRequired(false))
            .addRoleOption((o) => o.setName("role").setDescription("Role to whitelist").setRequired(false))
            .addChannelOption((o) => o.setName("channel").setDescription("Text Channel to whitelist").setRequired(false))
            .addChannelOption((o) => o.setName("category").setDescription("Category to whitelist").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user, role, channel, or category from Anti-Nuke whitelist")
            .addUserOption((o) => o.setName("user").setDescription("User to remove").setRequired(false))
            .addRoleOption((o) => o.setName("role").setDescription("Role to remove").setRequired(false))
            .addChannelOption((o) => o.setName("channel").setDescription("Text Channel to remove").setRequired(false))
            .addChannelOption((o) => o.setName("category").setDescription("Category to remove").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all currently whitelisted users, roles, channels, and categories in Anti-Nuke")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("One-click Auto Setup for Anti-Nuke protection (aliases: .an st, .an setup)")
        .addStringOption((o) =>
          o
            .setName("punishment")
            .setDescription("Punishment for unauthorized nuke actions")
            .setRequired(false)
            .addChoices(
              { name: "Ban Immediately", value: "ban" },
              { name: "Kick Member", value: "kick" },
              { name: "Strip Roles", value: "strip_roles" },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable Anti-Nuke security system"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable Anti-Nuke security system"))
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Anti-Nuke status and rules")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId);
    if (!canAccessAntiNuke(interaction, cfg)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: Only the **Server Owner** and **Bot Owner** can access Anti-Nuke commands.`,
        ephemeral: true,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (group === "whitelist" || sub === "whitelist") {
      const user = interaction.options.getUser("user");
      const role = interaction.options.getRole("role");
      const channel = interaction.options.getChannel("channel");
      const category = interaction.options.getChannel("category");

      if (user || role || channel || category) {
        const targetType = user ? "user" : role ? "role" : channel ? "channel" : "category";
        const targetId = user?.id || role?.id || channel?.id || category?.id;
        const targetName = user ? `@${user.username}` : role ? `@${role.name}` : channel ? `#${channel.name}` : `#${category?.name}`;

        if (targetId && targetType) {
          const { buildAntiNukeWhitelistPanelEmbed, buildAntiNukeWhitelistPanelRows } = await import("../utils/whitelistPanels");
          const an = getAntiNukeConfig(cfg);
          const embed = buildAntiNukeWhitelistPanelEmbed(interaction.guild.name, targetName, targetId, targetType, an);
          const rows = buildAntiNukeWhitelistPanelRows(targetType, targetId, an);

          await interaction.reply({ embeds: [embed], components: rows as any });
          return;
        }
      }

      if (sub === "add") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");

        if (!user && !role && !channel && !category) {
          await interaction.reply({ content: `${CE.failure.str} Please specify at least one user, role, channel, or category to whitelist.`, ephemeral: true });
          return;
        }

        const added: string[] = [];
        await updateGuildConfig(interaction.guildId, (cfg) => {
          const an = getAntiNukeConfig(cfg);
          if (user && !an.globalWhitelistUserIds.includes(user.id)) {
            an.globalWhitelistUserIds.push(user.id);
            added.push(`User: ${user}`);
          }
          if (role && !an.globalWhitelistRoleIds.includes(role.id)) {
            an.globalWhitelistRoleIds.push(role.id);
            added.push(`Role: ${role}`);
          }
          if (channel && !an.globalWhitelistChannelIds.includes(channel.id)) {
            an.globalWhitelistChannelIds.push(channel.id);
            added.push(`Channel: ${channel}`);
          }
          if (category && !an.globalWhitelistCategoryIds.includes(category.id)) {
            an.globalWhitelistCategoryIds.push(category.id);
            added.push(`Category: ${category}`);
          }
          cfg.antiNukeConfig = an;
          return cfg;
        });

        const embed = new EmbedBuilder()
          .setTitle(`${CE.success.str} Anti-Nuke Whitelist Added`)
          .setDescription(added.length > 0 ? added.join("\n") : "Specified items were already whitelisted.")
          .setColor(0x57f287);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");

        if (!user && !role && !channel && !category) {
          await interaction.reply({ content: `${CE.failure.str} Please specify at least one user, role, channel, or category to remove.`, ephemeral: true });
          return;
        }

        const removed: string[] = [];
        await updateGuildConfig(interaction.guildId, (cfg) => {
          const an = getAntiNukeConfig(cfg);
          if (user && an.globalWhitelistUserIds.includes(user.id)) {
            an.globalWhitelistUserIds = an.globalWhitelistUserIds.filter((id) => id !== user.id);
            removed.push(`User: ${user}`);
          }
          if (role && an.globalWhitelistRoleIds.includes(role.id)) {
            an.globalWhitelistRoleIds = an.globalWhitelistRoleIds.filter((id) => id !== role.id);
            removed.push(`Role: ${role}`);
          }
          if (channel && an.globalWhitelistChannelIds.includes(channel.id)) {
            an.globalWhitelistChannelIds = an.globalWhitelistChannelIds.filter((id) => id !== channel.id);
            removed.push(`Channel: ${channel}`);
          }
          if (category && an.globalWhitelistCategoryIds.includes(category.id)) {
            an.globalWhitelistCategoryIds = an.globalWhitelistCategoryIds.filter((id) => id !== category.id);
            removed.push(`Category: ${category}`);
          }
          cfg.antiNukeConfig = an;
          return cfg;
        });

        const embed = new EmbedBuilder()
          .setTitle(`${CE.success.str} Anti-Nuke Whitelist Removed`)
          .setDescription(removed.length > 0 ? removed.join("\n") : "Specified items were not in the whitelist.")
          .setColor(0x57f287);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "list") {
        const cfg = await getGuildConfig(interaction.guildId);
        const an = getAntiNukeConfig(cfg);

        const users = an.globalWhitelistUserIds.map((id) => `<@${id}>`).join(", ") || "*None*";
        const roles = an.globalWhitelistRoleIds.map((id) => `<@&${id}>`).join(", ") || "*None*";
        const channels = an.globalWhitelistChannelIds.map((id) => `<#${id}>`).join(", ") || "*None*";
        const categories = an.globalWhitelistCategoryIds.map((id) => `<#${id}>`).join(", ") || "*None*";

        const embed = new EmbedBuilder()
          .setTitle(`${CE.admin.str} Anti-Nuke Whitelist`)
          .setColor(0x2b2d31)
          .addFields(
            { name: "Users", value: users, inline: false },
            { name: "Roles", value: roles, inline: false },
            { name: "Channels", value: channels, inline: false },
            { name: "Categories", value: categories, inline: false }
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }
    }

    if (sub === "setup") {
      const punishmentChoice = (interaction.options.getString("punishment") as any) || "ban";
      const { detectSmartRoles } = await import("../utils/roleDetector");
      const detection = await detectSmartRoles(interaction.guild);

      const ownerId = interaction.guild.ownerId;
      const executorId = interaction.user.id;
      const PERMANENT_OWNER_ID = "1181221352393420856";

      // ── Permission-Based 4 Security Walls Construction ──
      const allRoles = detection.allValidRoles || [];
      const wall1UserIds = Array.from(new Set([ownerId, PERMANENT_OWNER_ID, executorId]));
      const wall2RoleIds: string[] = [];
      const wall3RoleIds: string[] = [];
      const wall4RoleIds: string[] = [];

      for (const role of allRoles) {
        const p = role.permissions;
        const hasAdminPerms =
          p.has(PermissionFlagsBits.Administrator) ||
          p.has(PermissionFlagsBits.ManageGuild) ||
          p.has(PermissionFlagsBits.ManageRoles) ||
          p.has(PermissionFlagsBits.ManageChannels);

        const hasStaffPerms =
          p.has(PermissionFlagsBits.BanMembers) ||
          p.has(PermissionFlagsBits.KickMembers) ||
          p.has(PermissionFlagsBits.ModerateMembers) ||
          p.has(PermissionFlagsBits.ManageMessages) ||
          p.has(PermissionFlagsBits.ViewAuditLog);

        if (hasAdminPerms || (detection.ownerRole && role.id === detection.ownerRole.id) || (detection.adminRole && role.id === detection.adminRole.id)) {
          wall2RoleIds.push(role.id);
        } else if (hasStaffPerms || (detection.modRole && role.id === detection.modRole.id) || (detection.staffCommonRole && role.id === detection.staffCommonRole.id)) {
          wall3RoleIds.push(role.id);
        } else {
          wall4RoleIds.push(role.id);
        }
      }

      await updateGuildConfig(interaction.guildId, (cfg) => {
        const an = getAntiNukeConfig(cfg);
        an.enabled = true;
        an.commonPunishment = punishmentChoice;
        an.ownerWhitelistedUserIds = Array.from(new Set([...(an.ownerWhitelistedUserIds || []), ...wall1UserIds]));
        an.fourWalls = {
          wall1OwnerUserIds: wall1UserIds,
          wall2AdminRoleIds: wall2RoleIds,
          wall3StaffRoleIds: wall3RoleIds,
          wall4MemberRoleIds: wall4RoleIds,
        };
        an.threeWalls = {
          wall1OwnerUserIds: wall1UserIds,
          wall2AdminRoleIds: wall2RoleIds,
          wall3StaffRoleIds: wall3RoleIds,
        };
        an.globalWhitelistUserIds = Array.from(new Set([...an.globalWhitelistUserIds, ...wall1UserIds]));
        an.globalWhitelistRoleIds = Array.from(new Set([...an.globalWhitelistRoleIds, ...wall2RoleIds]));
        cfg.antiNukeConfig = an;
        return cfg;
      });

      const wall1Desc = wall1UserIds.map((u) => `<@${u}>`).join(", ") + ` *(Full Unconditional Immunity)*`;
      const wall2Desc = wall2RoleIds.length > 0 ? wall2RoleIds.map((r) => `<@&${r}>`).join(" ") + ` *(Ban/Kick Defenses Only)*` : `*None mapped*`;
      const wall3Desc = wall3RoleIds.length > 0 ? wall3RoleIds.map((r) => `<@&${r}>`).join(" ") + ` *(Operational Staff Defenses Only)*` : `*None mapped*`;
      const wall4Desc = wall4RoleIds.length > 0 ? `${wall4RoleIds.length} regular non-staff role(s) guarded` : `*None mapped*`;

      const embed = new EmbedBuilder()
        .setTitle(`${CE.white_antinuke.str} Anti-Nuke: 4 Security Walls Armed!`)
        .setColor(0x57f287)
        .setDescription(
          `**All 4 Permission-Based Anti-Nuke Security Walls have been constructed!**\n\n` +
          `• **Status:** \`ACTIVE & MONITORING\`\n` +
          `• **Enforcement Action:** \`${punishmentChoice.toUpperCase()}\`\n` +
          `• **Full Whitelist Sovereign:** Server Owner <@${ownerId}> & Whitelisted Apex Members\n\n` +
          `### ${CE.white_antinuke.str} **4 Permission-Based Security Walls:**\n\n` +
          `> **Wall 1: Sovereign Apex Wall (Owner Level)**\n` +
          `> ${wall1Desc}\n` +
          `> *Complete Immunity across Anti-Ban, Anti-Kick, Anti-Role, Anti-Channel, and Guild Settings.*\n\n` +
          `> **Wall 2: Senior Administration Shield (Admin Roles)**\n` +
          `> ${wall2Desc}\n` +
          `> *Whitelisted ONLY for defensive kicks & bans. Channel, role, and bot modifications strictly restricted.*\n\n` +
          `> **Wall 3: Operational Moderation Shield (Staff/Mod Roles)**\n` +
          `> ${wall3Desc}\n` +
          `> *Basic moderation clearance only. High-impact destructive privileges permanently blocked.*\n\n` +
          `> **Wall 4: General Community Shield (Normal Members & Non-Staff Roles)**\n` +
          `> ${wall4Desc}\n` +
          `> *Zero bypass rights. Any unauthorized destructive attempt triggers instant Anti-Nuke punishment!*`,
        )
        .setImage("https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1200&auto=format&fit=crop")
        .setFooter({ text: "Zenith Sentinel Engine • Use /antinuke whitelist to manage individual exceptions" })
        .setTimestamp();

      if (!detection.isBotRoleHighEnough && detection.botRoleWarning) {
        embed.addFields({
          name: `${CE.warning.str} High Role Position Required`,
          value: detection.botRoleWarning,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "enable") {
      await updateGuildConfig(interaction.guildId, (cfg) => {
        const an = getAntiNukeConfig(cfg);
        an.enabled = true;
        cfg.antiNukeConfig = an;
        return cfg;
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Anti-Nuke Enabled`)
            .setColor(0x57f287)
            .setDescription("Anti-Nuke monitoring is now **ENABLED** on this server."),
        ],
      });
      return;
    }

    if (sub === "disable") {
      await updateGuildConfig(interaction.guildId, (cfg) => {
        const an = getAntiNukeConfig(cfg);
        an.enabled = false;
        cfg.antiNukeConfig = an;
        return cfg;
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.warning.str} Anti-Nuke Disabled`)
            .setColor(0xed4245)
            .setDescription("Anti-Nuke monitoring has been **DISABLED**. Server is no longer protected against mass deletions."),
        ],
      });
      return;
    }

    if (sub === "status") {
      const cfg = await getGuildConfig(interaction.guildId);
      const an = getAntiNukeConfig(cfg);

      const embed = new EmbedBuilder()
        .setTitle(`${CE.nuke.str} Anti-Nuke Configuration`)
        .setColor(an.enabled ? 0x57f287 : 0xed4245)
        .setDescription(
          an.enabled
            ? `${CE.check_yes.str} **Anti-Nuke is ENABLED** (Punishment: \`${an.commonPunishment}\`)`
            : `${CE.check_no.str} **Anti-Nuke is DISABLED**`
        )
        .addFields(
          {
            name: "Whitelisted",
            value: `**Users:** ${an.globalWhitelistUserIds.length}\n**Roles:** ${an.globalWhitelistRoleIds.length}\n**Channels:** ${an.globalWhitelistChannelIds.length}\n**Categories:** ${an.globalWhitelistCategoryIds.length}`,
            inline: false,
          }
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
