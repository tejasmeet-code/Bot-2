import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  User,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig, isTargetWhitelisted } from "../storage/config";
import { isBotAdmin } from "../storage/premium";
import { CE } from "../utils/embedStyle";

function isServerOwnerOrBotOwner(userId: string, guildOwnerId: string, cfg: any): boolean {
  if (userId === guildOwnerId) return true;
  if (isBotAdmin(userId)) return true;
  if (cfg.serverOwnerWhitelistUserIds?.includes(userId)) return true;
  return false;
}

function parseUserToken(interaction: ChatInputCommandInteraction): User | null {
  const user = interaction.options.getUser("user");
  if (user) return user;
  const raw = interaction.options.getString("target") || interaction.options.getString("user");
  if (raw) {
    const idMatch = raw.match(/\d{17,20}/);
    if (idMatch && interaction.guild) {
      return interaction.guild.members.cache.get(idMatch[0])?.user ?? null;
    }
  }
  return null;
}

/**
 * .serverowner (user): Gives Server Owner level whitelist
 */
export const serverOwnerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("serverowner")
    .setDescription("Give or manage Server Owner level whitelist (Server Owner & Bot Owner only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to grant or revoke server owner whitelist").setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(false)
        .addChoices(
          { name: "Grant / Toggle Whitelist", value: "toggle" },
          { name: "Add to Whitelist", value: "add" },
          { name: "Remove from Whitelist", value: "remove" },
          { name: "List Whitelisted Owners", value: "list" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.guildId) {
      await interaction.reply({ content: "This command can only be used inside a server.", flags: 1 << 6 });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId);
    if (!isServerOwnerOrBotOwner(interaction.user.id, interaction.guild.ownerId, cfg)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: Only the **Server Owner** and **Bot Owner** can grant Server Owner level whitelist.`,
        flags: 1 << 6,
      });
      return;
    }

    const action = interaction.options.getString("action") || "toggle";
    const targetUser = parseUserToken(interaction);

    if (action === "list" || (!targetUser && action !== "add" && action !== "remove")) {
      const owners = cfg.serverOwnerWhitelistUserIds ?? [];
      const embed = new EmbedBuilder()
        .setTitle(`${CE.owner.str} Server Owner Level Whitelist`)
        .setColor(0xF1C40F)
        .setDescription(
          `**Server Owner:** <@${interaction.guild.ownerId}> (\`${interaction.guild.ownerId}\`)\n\n` +
          `**Whitelisted Server Owners:**\n` +
          (owners.length > 0
            ? owners.map((id) => `• <@${id}> (\`${id}\`)`).join("\n")
            : "*No additional server owners whitelisted yet. Use `.serverowner @user` to add.*") +
          `\n\n*Users with this whitelist hold full authority over Anti-Nuke, server security, and are immune to all bot actions.*`
        )
        .setFooter({ text: "Server Owner Security Clearance" });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!targetUser) {
      await interaction.reply({
        content: `${CE.failure.str} Please mention a user or provide their ID. Example: \`.serverowner @user\``,
        flags: 1 << 6,
      });
      return;
    }

    const currentList = cfg.serverOwnerWhitelistUserIds ?? [];
    const isAlready = currentList.includes(targetUser.id);
    const shouldAdd = action === "add" ? true : action === "remove" ? false : !isAlready;

    let updatedList: string[];
    if (shouldAdd) {
      updatedList = Array.from(new Set([...currentList, targetUser.id]));
    } else {
      updatedList = currentList.filter((id) => id !== targetUser.id);
    }

    // Synchronize with Anti-Nuke global whitelist
    await updateGuildConfig(interaction.guildId, (c) => {
      const anGlobal = c.antiNukeConfig?.globalWhitelistUserIds ?? [];
      const updatedAn = shouldAdd
        ? Array.from(new Set([...anGlobal, targetUser.id]))
        : anGlobal;
      return {
        ...c,
        serverOwnerWhitelistUserIds: updatedList,
        antiNukeConfig: c.antiNukeConfig ? { ...c.antiNukeConfig, globalWhitelistUserIds: updatedAn } : undefined,
      };
    });

    const embed = new EmbedBuilder()
      .setTitle(`${shouldAdd ? CE.success.str : CE.failure.str} Server Owner Whitelist ${shouldAdd ? "Granted" : "Revoked"}`)
      .setColor(shouldAdd ? 0x57f287 : 0xed4245)
      .setDescription(
        shouldAdd
          ? `${CE.owner.str} Successfully granted **Server Owner Level Whitelist** to <@${targetUser.id}>!\n\n` +
            `• **Anti-Nuke Access**: Authorized to view, configure, and manage Anti-Nuke rules\n` +
            `• **Action Immunity**: The bot will never execute bans, kicks, mutes, or jail on this user\n` +
            `• **AutoMod Bypass**: Completely exempt from all chat filters and rate limits\n` +
            `• **Auto-React Access**: Authorized to configure server auto-reactions`
          : `Revoked **Server Owner Level Whitelist** from <@${targetUser.id}>.`
      )
      .setFooter({ text: `Action by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * .serveradmin (user): Gives Server Admin level whitelist
 */
export const serverAdminCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("serveradmin")
    .setDescription("Give or manage Server Admin level whitelist")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to grant or revoke server admin whitelist").setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(false)
        .addChoices(
          { name: "Grant / Toggle Whitelist", value: "toggle" },
          { name: "Add to Whitelist", value: "add" },
          { name: "Remove from Whitelist", value: "remove" },
          { name: "List Whitelisted Admins", value: "list" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.guildId) {
      await interaction.reply({ content: "This command can only be used inside a server.", flags: 1 << 6 });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId);
    if (!isServerOwnerOrBotOwner(interaction.user.id, interaction.guild.ownerId, cfg)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: Only the **Server Owner**, **Bot Owner**, or a **Whitelisted Server Owner** can grant Server Admin whitelist.`,
        flags: 1 << 6,
      });
      return;
    }

    const action = interaction.options.getString("action") || "toggle";
    const targetUser = parseUserToken(interaction);

    if (action === "list" || (!targetUser && action !== "add" && action !== "remove")) {
      const admins = cfg.serverAdminWhitelistUserIds ?? [];
      const embed = new EmbedBuilder()
        .setTitle(`${CE.admin.str} Server Admin Level Whitelist`)
        .setColor(0x5865F2)
        .setDescription(
          `**Whitelisted Server Admins:**\n` +
          (admins.length > 0
            ? admins.map((id) => `• <@${id}> (\`${id}\`)`).join("\n")
            : "*No server admins whitelisted yet. Use `.serveradmin @user` to add.*") +
          `\n\n*Whitelisted Admins are immune to bot moderation actions, bypass AutoMod, can configure AutoReact, and use No-Prefix commands.*`
        )
        .setFooter({ text: "Server Admin Security Clearance" });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!targetUser) {
      await interaction.reply({
        content: `${CE.failure.str} Please mention a user or provide their ID. Example: \`.serveradmin @user\``,
        flags: 1 << 6,
      });
      return;
    }

    const currentList = cfg.serverAdminWhitelistUserIds ?? [];
    const isAlready = currentList.includes(targetUser.id);
    const shouldAdd = action === "add" ? true : action === "remove" ? false : !isAlready;

    const updatedList = shouldAdd
      ? Array.from(new Set([...currentList, targetUser.id]))
      : currentList.filter((id) => id !== targetUser.id);

    await updateGuildConfig(interaction.guildId, (c) => ({
      ...c,
      serverAdminWhitelistUserIds: updatedList,
      noPrefixUserIds: shouldAdd ? Array.from(new Set([...(c.noPrefixUserIds ?? []), targetUser.id])) : c.noPrefixUserIds,
    }));

    const embed = new EmbedBuilder()
      .setTitle(`${shouldAdd ? CE.success.str : CE.failure.str} Server Admin Whitelist ${shouldAdd ? "Granted" : "Revoked"}`)
      .setColor(shouldAdd ? 0x5865F2 : 0xed4245)
      .setDescription(
        shouldAdd
          ? `${CE.admin.str} Successfully granted **Server Admin Level Whitelist** to <@${targetUser.id}>!\n\n` +
            `• **Action Immunity**: The bot will never execute moderation commands on this user\n` +
            `• **AutoMod Bypass**: Completely exempt from spam filters, links, and auto-moderation\n` +
            `• **Auto-React Access**: Authorized to configure word, channel, and role auto-reactions\n` +
            `• **No-Prefix Privileges**: Can run commands freely without prefix`
          : `Revoked **Server Admin Level Whitelist** from <@${targetUser.id}>.`
      )
      .setFooter({ text: `Action by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * .trusted (user): Gives Trusted level whitelist
 */
export const trustedCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("trusted")
    .setDescription("Give or manage Trusted level whitelist")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) =>
      o.setName("user").setDescription("User to grant or revoke trusted whitelist").setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(false)
        .addChoices(
          { name: "Grant / Toggle Whitelist", value: "toggle" },
          { name: "Add to Whitelist", value: "add" },
          { name: "Remove from Whitelist", value: "remove" },
          { name: "List Trusted Users", value: "list" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.guildId) {
      await interaction.reply({ content: "This command can only be used inside a server.", flags: 1 << 6 });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId);
    const isCallerAdminOrOwner =
      isServerOwnerOrBotOwner(interaction.user.id, interaction.guild.ownerId, cfg) ||
      cfg.serverAdminWhitelistUserIds?.includes(interaction.user.id);

    if (!isCallerAdminOrOwner) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: Only **Server Owners** and **Whitelisted Admins** can grant Trusted whitelist.`,
        flags: 1 << 6,
      });
      return;
    }

    const action = interaction.options.getString("action") || "toggle";
    const targetUser = parseUserToken(interaction);

    if (action === "list" || (!targetUser && action !== "add" && action !== "remove")) {
      const trusted = cfg.trustedWhitelistUserIds ?? [];
      const embed = new EmbedBuilder()
        .setTitle(`${CE.manager.str} Trusted Level Whitelist`)
        .setColor(0x57f287)
        .setDescription(
          `**Trusted Members:**\n` +
          (trusted.length > 0
            ? trusted.map((id) => `• <@${id}> (\`${id}\`)`).join("\n")
            : "*No members marked as trusted yet. Use `.trusted @user` to add.*") +
          `\n\n*Trusted members are immune to bot moderation actions, exempt from spam filters, and can setup auto-reactions.*`
        )
        .setFooter({ text: "Trusted Clearance Level" });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!targetUser) {
      await interaction.reply({
        content: `${CE.failure.str} Please mention a user or provide their ID. Example: \`.trusted @user\``,
        flags: 1 << 6,
      });
      return;
    }

    const currentList = cfg.trustedWhitelistUserIds ?? [];
    const isAlready = currentList.includes(targetUser.id);
    const shouldAdd = action === "add" ? true : action === "remove" ? false : !isAlready;

    const updatedList = shouldAdd
      ? Array.from(new Set([...currentList, targetUser.id]))
      : currentList.filter((id) => id !== targetUser.id);

    await updateGuildConfig(interaction.guildId, (c) => ({
      ...c,
      trustedWhitelistUserIds: updatedList,
      noPrefixUserIds: shouldAdd ? Array.from(new Set([...(c.noPrefixUserIds ?? []), targetUser.id])) : c.noPrefixUserIds,
    }));

    const embed = new EmbedBuilder()
      .setTitle(`${shouldAdd ? CE.success.str : CE.failure.str} Trusted Whitelist ${shouldAdd ? "Granted" : "Revoked"}`)
      .setColor(shouldAdd ? 0x57f287 : 0xed4245)
      .setDescription(
        shouldAdd
          ? `${CE.star.str} Successfully granted **Trusted Whitelist** to <@${targetUser.id}>!\n\n` +
            `• **Moderation Immunity**: The bot will never execute moderation commands against this user\n` +
            `• **Anti-Nuke Protection**: Immune to accidental Anti-Nuke triggers\n` +
            `• **Auto-React Access**: Can setup server auto-reactions\n` +
            `• **No-Prefix Mode**: Enabled for this member`
          : `Revoked **Trusted Whitelist** from <@${targetUser.id}>.`
      )
      .setFooter({ text: `Action by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
