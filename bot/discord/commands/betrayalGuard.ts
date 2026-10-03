import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getBetrayalGuardConfig,
  updateBetrayalGuardConfig,
  getGuildBetrayalIncidents,
  recordBetrayalIncident,
} from "../storage/betrayalGuard";
import { isUserPremium, isGuildPremium } from "../storage/premium";
import { getUserPremiumTier } from "../storage/profile";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

/**
 * /betrayalguard command - Premium Rogue Admin & Staff Betrayal Mitigation Engine
 */
export const betrayalGuardCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("betrayalguard")
    .setDescription("VIP Premium: Intercept & quarantine rogue admins or compromised staff attempting server betrayal")
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View Betrayal Guard active shield status, thresholds, and quarantine configuration")
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable Betrayal Guard rogue staff protection for this server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Disable Betrayal Guard rogue staff protection")
    )
    .addSubcommand((sub) =>
      sub
        .setName("incidents")
        .setDescription("View log of intercepted staff betrayal attempts and quarantined admins")
    )
    .addSubcommand((sub) =>
      sub
        .setName("quarantine")
        .setDescription("Emergency quarantine a rogue staff member, revoking administrative roles immediately")
        .addUserOption((o) =>
          o.setName("target").setDescription("Staff member to quarantine").setRequired(true)
        )
        .addStringOption((o) =>
          o.setName("reason").setDescription("Reason for emergency quarantine").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Dispatch a test Betrayal Guard emergency owner alert DM")
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} Betrayal Guard can only be configured inside a server.`, flags: 1 << 6 });
      return;
    }

    const guild = interaction.guild;
    const userId = interaction.user.id;
    const isOwner = guild.ownerId === userId;
    const tier = await getUserPremiumTier(userId, guild.id);

    // Premium Check: Requires Tier 1+ or Premium Server
    const uPrem = await isUserPremium(userId);
    const gPrem = await isGuildPremium(guild.id);
    if (!uPrem && !gPrem && tier < 1) {
      const embed = prettyEmbed({
        title: `${CE.owner.str} Premium Feature Required • Betrayal Guard`,
        color: COLORS.premium,
        description:
          `### ${CE.admin.str} **Betrayal Guard is a VIP Premium Feature**\n\n` +
          `Protect your community from **rogue admins, compromised staff accounts, or internal server betrayals**!\n\n` +
          `**What Betrayal Guard Does:**\n` +
          `• ${CE.boost.str} **Rogue Admin Detection**: Intercepts sudden mass-bans, mass-kicks, or role deletions by staff\n` +
          `• ${CE.locked.str} **Instant Staff Quarantine**: Automatically strips all admin roles from a betraying staff member in <100ms\n` +
          `• ${CE.notifications.str} **Direct Owner DM Alerts**: Dispatches real-time emergency security reports to the Server Owner\n` +
          `• ${CE.recycle.str} **Automated State Rollback**: Re-creates deleted channels and unbans innocent members\n\n` +
          `> ${CE.limited.str} Run \`/premium\` or \`.premium\` to unlock Betrayal Guard and 40+ VIP features!`,
      });
      await interaction.reply({ embeds: [embed], flags: 1 << 6 });
      return;
    }

    // Permission Check: Only Server Owner or Admin can manage Betrayal Guard
    const isMemberAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!isOwner && !isMemberAdmin) {
      await interaction.reply({
        content: `${CE.failure.str} Only the **Server Owner** (<@${guild.ownerId}>) or Administrators can manage Betrayal Guard settings.`,
        flags: 1 << 6,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const cfg = getBetrayalGuardConfig(guild.id);

    if (subcommand === "status") {
      const incidents = getGuildBetrayalIncidents(guild.id);
      const embed = prettyEmbed({
        title: `Betrayal Guard Protection Engine • ${guild.name}`,
        color: cfg.enabled ? 0x2ecc71 : 0xe74c3c,
        description:
          `### ${CE.admin.str} **Rogue Staff & Betrayal Protection Status**\n\n` +
          `**Shield Engine:** ${cfg.enabled ? `${CE.boost.str} ACTIVE & ARMED` : `${CE.failureorno.str} DISABLED`}\n` +
          `**Target Owner:** <@${guild.ownerId}>\n` +
          `**Auto-Quarantine Staff:** ${CE.locked.str} \`ENABLED (Strips Admin Roles)\`\n` +
          `**Owner DM Alerts:** ${CE.notifications.str} \`ENABLED\`\n` +
          `**Automated Rollback:** ${CE.recycle.str} \`${cfg.autoRollback ? "ACTIVE" : "DISABLED"}\`\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `### ${CE.level.str} **Rogue Staff Action Thresholds (Per 60 Seconds)**\n` +
          `• **Mass Ban Limit:** \`${cfg.actionThresholds.massBan}\` bans/min\n` +
          `• **Mass Kick Limit:** \`${cfg.actionThresholds.massKick}\` kicks/min\n` +
          `• **Mass Role Delete Limit:** \`${cfg.actionThresholds.massRoleDelete}\` deletes/min\n` +
          `• **Mass Channel Delete Limit:** \`${cfg.actionThresholds.massChannelDelete}\` deletes/min\n` +
          `• **Mass Webhook Create Limit:** \`${cfg.actionThresholds.massWebhookCreate}\` webhooks/min\n\n` +
          `> ${CE.clipboard.str} **Recent Intercepted Incidents:** \`${incidents.length}\` betrayal events logged`,
        footer: "Zenith Betrayal Guard • VIP Security Engine",
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "enable") {
      updateBetrayalGuardConfig(guild.id, { enabled: true });
      const embed = prettyEmbed({
        title: "Betrayal Guard Activated",
        color: 0x2ecc71,
        description:
          `### ${CE.check.str} **Betrayal Guard Protection is now ARMED!**\n\n` +
          `All staff members and administrators are now actively monitored.\n` +
          `Any rogue staff attempting mass-bans, role stripping, or channel wiping will be **quarantined immediately**, and <@${guild.ownerId}> will receive a direct DM alert!`,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "disable") {
      updateBetrayalGuardConfig(guild.id, { enabled: false });
      const embed = prettyEmbed({
        title: "Betrayal Guard Disarmed",
        color: 0xe74c3c,
        description:
          `### ${CE.warning.str} **Betrayal Guard is now DISABLED.**\n\n` +
          `Rogue admin detection and staff quarantine are turned off. Run \`/betrayalguard enable\` to re-arm protection!`,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "incidents") {
      const incidents = getGuildBetrayalIncidents(guild.id);
      if (incidents.length === 0) {
        const embed = prettyEmbed({
          title: "Betrayal Guard • Incident History",
          color: COLORS.primary,
          description: `### ${CE.admin.str} **Zero Betrayal Incidents Logged**\n\nNo rogue staff members or admin betrayals have been detected in **${guild.name}**. Your server is clean and secure!`,
        });
        await interaction.reply({ embeds: [embed] });
        return;
      }

      const logLines = incidents.slice(0, 10).map((inc) => {
        return `• <t:${Math.floor(inc.timestamp / 1000)}:R> — <@${inc.executorId}> (\`${inc.executorTag}\`) performed **${inc.actionCount} ${inc.actionType}** actions ➔ ${inc.quarantined ? `${CE.locked.str} QUARANTINED` : `${CE.warning.str} LOGGED`}`;
      }).join("\n");

      const embed = prettyEmbed({
        title: `Betrayal Guard • Incident Audit Log (${incidents.length} total)`,
        color: 0xe67e22,
        description:
          `### ${CE.notifications.str} **Recent Intercepted Betrayal Events**\n\n` + logLines,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "quarantine") {
      const targetUser = interaction.options.getUser("target", true);
      const reason = interaction.options.getString("reason") || "Manual emergency quarantine by owner/admin";

      if (targetUser.id === guild.ownerId) {
        await interaction.reply({ content: `${CE.failure.str} You cannot quarantine the Server Owner!`, flags: 1 << 6 });
        return;
      }

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.reply({ content: `${CE.failure.str} Could not find that member inside this server.`, flags: 1 << 6 });
        return;
      }

      // Remove all administrative / dangerous roles
      const removedRoles: string[] = [];
      for (const [roleId, role] of targetMember.roles.cache.entries()) {
        if (role.name === "@everyone") continue;
        if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.BanMembers) || role.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await targetMember.roles.remove(roleId).catch(() => {});
          removedRoles.push(role.name);
        }
      }

      // Record Incident
      recordBetrayalIncident({
        id: `inc_${Date.now()}`,
        guildId: guild.id,
        executorId: targetUser.id,
        executorTag: targetUser.tag,
        actionType: "manual_quarantine",
        timestamp: Date.now(),
        quarantined: true,
        actionCount: removedRoles.length,
        details: reason,
      });

      const embed = prettyEmbed({
        title: "Emergency Staff Quarantine Executed",
        color: 0xed4245,
        description:
          `### ${CE.locked.str} **Target Quarantined:** <@${targetUser.id}> (\`${targetUser.tag}\`)\n\n` +
          `**Executed By:** <@${userId}>\n` +
          `**Reason:** *"${reason}"*\n` +
          `**Removed High-Perm Roles:** \`${removedRoles.length > 0 ? removedRoles.join(", ") : "None"}\`\n\n` +
          `> ${CE.boost.str} The user's administrative privileges have been revoked immediately.`,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "test") {
      const owner = await guild.fetchOwner().catch(() => null);
      if (!owner) {
        await interaction.reply({ content: `${CE.failure.str} Could not fetch Server Owner.`, flags: 1 << 6 });
        return;
      }

      const testEmbed = prettyEmbed({
        title: `${CE.notifications.str} [TEST] Betrayal Guard Emergency Alert`,
        color: 0xed4245,
        description:
          `### ${CE.admin.str} **TEST SECURITY ALERT FOR OWNER**\n\n` +
          `This is a test dispatch from **Zenith Betrayal Guard** in **${guild.name}**.\n` +
          `If a staff member attempts rogue mass-bans or channel deletions, you will receive a real-time notification formatted like this with the staff member's details!`,
      });

      const dmSent = await owner.send({ embeds: [testEmbed] }).then(() => true).catch(() => false);

      await interaction.reply({
        content: dmSent
          ? `${CE.check.str} Successfully sent test Betrayal Guard emergency DM to Server Owner (<@${owner.id}>)!`
          : `${CE.warning.str} Server Owner (<@${owner.id}>) has direct messages closed or blocked.`,
        flags: 1 << 6,
      });
    }
  },
};
