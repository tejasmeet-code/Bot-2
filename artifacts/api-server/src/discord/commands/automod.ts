import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getAutomodConfig, updateAutomodConfig } from "../storage/automod";
import { CE } from "../utils/embedStyle";
import { isAdminOrOwner } from "../utils/staffPerms";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage Automod rules and whitelists")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName("whitelist")
        .setDescription("Manage global Automod whitelists")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a user, role, channel, or category to Automod whitelist")
            .addUserOption((o) => o.setName("user").setDescription("User to whitelist").setRequired(false))
            .addRoleOption((o) => o.setName("role").setDescription("Role to whitelist").setRequired(false))
            .addChannelOption((o) => o.setName("channel").setDescription("Text Channel to whitelist").setRequired(false))
            .addChannelOption((o) => o.setName("category").setDescription("Category to whitelist").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user, role, channel, or category from Automod whitelist")
            .addUserOption((o) => o.setName("user").setDescription("User to remove").setRequired(false))
            .addRoleOption((o) => o.setName("role").setDescription("Role to remove").setRequired(false))
            .addChannelOption((o) => o.setName("channel").setDescription("Text Channel to remove").setRequired(false))
            .addChannelOption((o) => o.setName("category").setDescription("Category to remove").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all currently whitelisted users, roles, channels, and categories")
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("scam")
        .setDescription("Manage Scam domain blocking and AI scanning")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Mark a domain as a known scam for this server")
            .addStringOption((o) => o.setName("domain").setDescription("Domain to block (e.g. discord-nitro.com)").setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a domain from the local scam list")
            .addStringOption((o) => o.setName("domain").setDescription("Domain to remove").setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName("scan")
            .setDescription("Toggle AI internet-wide scam scanning")
            .addBooleanOption((o) => o.setName("enabled").setDescription("Whether to use AI to scan unknown domains").setRequired(true))
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List locally marked scam domains")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Automod status and rules")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    if (!isAdminOrOwner(interaction)) {
      await interaction.reply({ content: `${CE.failure.str} You need Administrator permissions to manage Automod.`, ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (group === "scam") {
      if (sub === "add") {
        const domain = interaction.options.getString("domain", true).toLowerCase().replace(/^https?:\/\//i, "").split("/")[0];
        await updateAutomodConfig(interaction.guildId, (c) => ({
          ...c,
          links: { ...c.links, scamDomains: Array.from(new Set([...(c.links.scamDomains || []), domain])) }
        }));
        await interaction.reply({ content: `${CE.check_yes.str} Domain \`${domain}\` has been marked as a **SCAM** for this server.`, ephemeral: true });
        return;
      }
      if (sub === "remove") {
        const domain = interaction.options.getString("domain", true).toLowerCase();
        await updateAutomodConfig(interaction.guildId, (c) => ({
          ...c,
          links: { ...c.links, scamDomains: (c.links.scamDomains || []).filter(d => d !== domain) }
        }));
        await interaction.reply({ content: `${CE.check_yes.str} Domain \`${domain}\` has been removed from the local scam list.`, ephemeral: true });
        return;
      }
      if (sub === "scan") {
        const enabled = interaction.options.getBoolean("enabled", true);
        await updateAutomodConfig(interaction.guildId, (c) => ({
          ...c,
          links: { ...c.links, scanInternet: enabled }
        }));
        await interaction.reply({ content: `${CE.check_yes.str} AI Internet-wide scam scanning is now **${enabled ? "ENABLED" : "DISABLED"}**.`, ephemeral: true });
        return;
      }
      if (sub === "list") {
        const am = await getAutomodConfig(interaction.guildId);
        const list = am.links.scamDomains || [];
        const embed = new EmbedBuilder()
          .setTitle(`${CE.automod.str} Locally Marked Scam Domains`)
          .setColor(0x2b2d31)
          .setDescription(list.length > 0 ? list.map(d => `• \`${d}\``).join("\n") : "No domains marked yet.")
          .addFields({ name: "AI Internet Scan", value: am.links.scanInternet ? "Enabled" : "Disabled", inline: true });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
    }

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
          const { buildAutomodWhitelistPanelEmbed, buildAutomodWhitelistPanelRows } = await import("../utils/whitelistPanels");
          const am = await getAutomodConfig(interaction.guildId);
          const embed = buildAutomodWhitelistPanelEmbed(interaction.guild.name, targetName, targetId, targetType, am);
          const rows = buildAutomodWhitelistPanelRows(targetType, targetId, am);

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

        const am = await updateAutomodConfig(interaction.guildId, (c) => {
          const uIds = new Set(c.whitelistUserIds ?? []);
          const rIds = new Set(c.whitelistRoleIds ?? []);
          const chIds = new Set(c.whitelistChannelIds ?? []);
          const catIds = new Set(c.whitelistCategoryIds ?? []);

          if (user) uIds.add(user.id);
          if (role) rIds.add(role.id);
          if (channel) chIds.add(channel.id);
          if (category) catIds.add(category.id);

          return {
            ...c,
            whitelistUserIds: Array.from(uIds),
            whitelistRoleIds: Array.from(rIds),
            whitelistChannelIds: Array.from(chIds),
            whitelistCategoryIds: Array.from(catIds),
          };
        });

        const added: string[] = [];
        if (user) added.push(`User <@${user.id}>`);
        if (role) added.push(`Role <@&${role.id}>`);
        if (channel) added.push(`Channel <#${channel.id}>`);
        if (category) added.push(`Category <#${category.id}>`);

        await interaction.reply({
          content: `${CE.check_yes.str} Added to Automod Whitelist:\n${added.map((a) => `• ${a}`).join("\n")}`,
          ephemeral: true,
        });
        return;
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");

        if (!user && !role && !channel && !category) {
          await interaction.reply({ content: `${CE.failure.str} Please specify at least one user, role, channel, or category to remove from whitelist.`, ephemeral: true });
          return;
        }

        await updateAutomodConfig(interaction.guildId, (c) => ({
          ...c,
          whitelistUserIds: (c.whitelistUserIds ?? []).filter((id) => id !== user?.id),
          whitelistRoleIds: (c.whitelistRoleIds ?? []).filter((id) => id !== role?.id),
          whitelistChannelIds: (c.whitelistChannelIds ?? []).filter((id) => id !== channel?.id),
          whitelistCategoryIds: (c.whitelistCategoryIds ?? []).filter((id) => id !== category?.id),
        }));

        const removed: string[] = [];
        if (user) removed.push(`User <@${user.id}>`);
        if (role) removed.push(`Role <@&${role.id}>`);
        if (channel) removed.push(`Channel <#${channel.id}>`);
        if (category) removed.push(`Category <#${category.id}>`);

        await interaction.reply({
          content: `${CE.check_yes.str} Removed from Automod Whitelist:\n${removed.map((a) => `• ${a}`).join("\n")}`,
          ephemeral: true,
        });
        return;
      }

      if (sub === "list") {
        const am = await getAutomodConfig(interaction.guildId);
        const embed = new EmbedBuilder()
          .setTitle(`${CE.automod.str} Automod Whitelist`)
          .setColor(0x2b2d31)
          .addFields(
            { name: "Users", value: (am.whitelistUserIds ?? []).map((id) => `<@${id}>`).join(", ") || "None", inline: false },
            { name: "Roles", value: (am.whitelistRoleIds ?? []).map((id) => `<@&${id}>`).join(", ") || "None", inline: false },
            { name: "Channels", value: (am.whitelistChannelIds ?? []).map((id) => `<#${id}>`).join(", ") || "None", inline: false },
            { name: "Categories", value: (am.whitelistCategoryIds ?? []).map((id) => `<#${id}>`).join(", ") || "None", inline: false }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
    }

    if (sub === "status") {
      const am = await getAutomodConfig(interaction.guildId);
      const embed = new EmbedBuilder()
        .setTitle(`${CE.automod.str} Automod Status`)
        .setColor(am.enabled ? 0x57f287 : 0xed4245)
        .setDescription(am.enabled ? `${CE.check_yes.str} **Automod is currently ENABLED**` : `${CE.check_no.str} **Automod is currently DISABLED**`)
        .addFields(
          { name: "Log Channel", value: am.logChannelId ? `<#${am.logChannelId}>` : "*Not set*", inline: true },
          { name: "Whitelists", value: `${(am.whitelistUserIds ?? []).length} users, ${(am.whitelistRoleIds ?? []).length} roles, ${(am.whitelistChannelIds ?? []).length} channels, ${(am.whitelistCategoryIds ?? []).length} categories`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};

export default command;
