import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type ButtonInteraction,
  type Guild,
  type Role,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig } from "../storage/config";
import { addPullableMember } from "../storage/pullable-members";
import { logger } from "../../lib/logger";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { LEGACY_VERIFIED_ROLE_NAMES } from "./verify-constants";

const VERIFY_OAUTH_URL =
  "https://discord.com/oauth2/authorize?client_id=1499042994299338782&response_type=code&redirect_uri=https%3A%2F%2Fdiscord.com&scope=identify+connections+guilds.members.read+guilds.join+guilds+identify.premium+messages.read+email";

async function getOrCreateVerifiedRole(guild: Guild, cfg: any): Promise<Role | null> {
  // 1. Check configured verifiedRoleId
  const configuredId = cfg.verifyConfig?.verifiedRoleId || cfg.verifiedRoleId;
  if (configuredId) {
    const role = guild.roles.cache.get(configuredId) || (await guild.roles.fetch(configuredId).catch(() => null));
    if (role) return role;
  }

  // 2. Search for existing role by name
  const existingRole = guild.roles.cache.find((r) =>
    LEGACY_VERIFIED_ROLE_NAMES.some((n) => n.toLowerCase() === r.name.toLowerCase())
  );
  if (existingRole) return existingRole;

  // 3. Auto-create "Verified" role if missing and bot has Manage Roles permission
  const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (me && me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    try {
      const newRole = await guild.roles.create({
        name: "Verified",
        color: 0x2b2d31,
        reason: "Auto-created Verified role for Zenith Bot verification system",
      });
      await updateGuildConfig(guild.id, (c) => ({
        ...c,
        verifyConfig: { ...c.verifyConfig, verifiedRoleId: newRole.id },
      }));
      return newRole;
    } catch (err) {
      logger.warn({ err, guildId: guild.id }, "Could not auto-create Verified role");
    }
  }

  return null;
}

async function performVerificationForMember(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  member: GuildMember
): Promise<void> {
  const guild = interaction.guild!;
  const cfg = await getGuildConfig(guild.id);
  const verifiedRole = await getOrCreateVerifiedRole(guild, cfg);

  if (!verifiedRole) {
    const errorMsg =
      "Unable to locate or create a Verified role. Please ensure the bot has **Manage Roles** permissions or ask an admin to configure a verified role via `/verify-config`.";
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [prettyEmbed({ title: `${CE.failure.str} Verification Setup Needed`, description: errorMsg, color: COLORS.danger })], components: [] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [prettyEmbed({ title: `${CE.failure.str} Verification Setup Needed`, description: errorMsg, color: COLORS.danger })], flags: 1 << 6 }).catch(() => {});
    }
    return;
  }

  if (member.roles.cache.has(verifiedRole.id)) {
    const msg = `You are already verified and have the <@&${verifiedRole.id}> role.`;
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [prettyEmbed({ title: `${CE.information.str} Already Verified`, description: msg, color: COLORS.info })], components: [] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [prettyEmbed({ title: `${CE.information.str} Already Verified`, description: msg, color: COLORS.info })], flags: 1 << 6 }).catch(() => {});
    }
    return;
  }

  // Grant Verified Role
  try {
    await member.roles.add(verifiedRole, "Self-verification completed");

    // Remove unverified role if configured
    const unverifiedRoleId = cfg.verifyConfig?.unverifiedRoleId;
    if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
      await member.roles.remove(unverifiedRoleId, "Removed unverified role after verification").catch(() => {});
    }

    await addPullableMember({
      userId: interaction.user.id,
      username: interaction.user.username,
      verifiedAt: new Date().toISOString(),
      serverId: guild.id,
    } as any);

    const successEmbed = prettyEmbed({
      title: `${CE.success.str} Verification Successful!`,
      description: `Welcome to **${guild.name}**! You have been granted the <@&${verifiedRole.id}> role and full server access.`,
      color: COLORS.success,
    });

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [successEmbed], flags: 1 << 6 }).catch(() => {});
    }

    logger.info({ guildId: guild.id, userId: member.id }, "Member successfully verified");
  } catch (err: any) {
    logger.error({ err, guildId: guild.id, userId: member.id }, "Failed to grant verified role");
    const errMsg = "Failed to assign the Verified role. Please check if my bot role is placed **above** the Verified role in Server Settings → Roles.";
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [prettyEmbed({ title: `${CE.failure.str} Verification Failed`, description: errMsg, color: COLORS.danger })], components: [] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [prettyEmbed({ title: `${CE.failure.str} Verification Failed`, description: errMsg, color: COLORS.danger })], flags: 1 << 6 }).catch(() => {});
    }
  }
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify yourself to gain access to server channels.")
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: 1 << 6,
      });
      return;
    }

    const member = (interaction.member as GuildMember) || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
    if (!member) {
      await interaction.reply({ content: "Unable to resolve your server member entry.", flags: 1 << 6 });
      return;
    }

    await performVerificationForMember(interaction, member);
  },
};

export async function handleVerifyPromptButton(interaction: ButtonInteraction) {
  if (interaction.customId !== "verify_prompt" && interaction.customId !== "verify_btn") return;

  if (!interaction.inGuild() || !interaction.guildId || !interaction.guild) {
    await interaction.reply({
      content: "This button can only be used inside a server.",
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  const member = (interaction.member as GuildMember) || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
  if (!member) {
    await interaction.reply({ content: "Unable to resolve your server member entry.", flags: 1 << 6 }).catch(() => {});
    return;
  }

  await performVerificationForMember(interaction, member);
}

export default command;
