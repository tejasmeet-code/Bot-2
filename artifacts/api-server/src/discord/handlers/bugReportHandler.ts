import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type Role } from "discord.js";
import { getBugReport, updateBugReportStatus, addBugPoints, getUserBugPoints, getBugHunterTier, BUG_HUNTER_TIERS } from "../storage/bugReports";
import { getBotStaffMember } from "../storage/botStaff";
import { isBotAdmin } from "../storage/premium";
import { logger } from "../../lib/logger";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

export async function handleBugReportButton(interaction: ButtonInteraction): Promise<void> {
  const isApprovedAction = interaction.customId.startsWith("bug_approve:");
  const isRejectedAction = interaction.customId.startsWith("bug_reject:");

  if (!isApprovedAction && !isRejectedAction) return;

  // 1. Staff authentication
  const staffMember = await getBotStaffMember(interaction.user.id);
  const isAdmin = isBotAdmin(interaction.user.id) || staffMember?.role === "owner" || staffMember?.role === "admin";
  const isReviewer = !!staffMember || isAdmin;

  if (!isReviewer) {
    await interaction.reply({
      content: `${CE.error.str} You do not have permission to review bug reports. Only official bot staff can perform this action.`,
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  // 2. Parse payload
  const parts = interaction.customId.split(":");
  let reportId = "";
  let pointsToAward = 0;

  if (isApprovedAction) {
    // Format: bug_approve:points:reportId
    pointsToAward = parseInt(parts[1] || "1", 10);
    reportId = parts[2] || "";
  } else {
    // Format: bug_reject:reportId
    reportId = parts[1] || "";
  }

  // 3. Retrieve report
  const report = await getBugReport(reportId);
  if (!report) {
    await interaction.followUp({
      content: `${CE.error.str} Could not locate bug report **${reportId}** in storage.`,
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  if (report.status !== "pending") {
    await interaction.followUp({
      content: `${CE.error.str} Bug report **${reportId}** has already been reviewed and is marked as \`${report.status.toUpperCase()}\`.`,
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  const reporterId = report.userId;
  const message = interaction.message;
  const originalEmbed = message.embeds[0];
  if (!originalEmbed) return;

  const updatedEmbed = EmbedBuilder.from(originalEmbed);

  if (isApprovedAction) {
    // Mark as approved and award points
    await updateBugReportStatus(reportId, "approved", interaction.user.id);
    const newPoints = await addBugPoints(reporterId, pointsToAward);
    const currentTier = await getBugHunterTier(newPoints);

    updatedEmbed
      .setColor(0x2ecc71)
      .setTitle(`Bug Report: ${reportId} [APPROVED]`)
      .addFields([
        { name: `${CE.settings.str} Review Status`, value: `Approved by ${interaction.user} (\`+${pointsToAward} Pt${pointsToAward > 1 ? "s" : ""}\`)`, inline: true },
        { name: `${CE.trophy.str} Reporter Total Points`, value: `\`${newPoints}\` Bug Points`, inline: true },
        { name: `${CE.star.str} Current Badge / Tier`, value: currentTier ? `${currentTier.emojiStr} **${currentTier.name}**` : "*None yet*", inline: true }
      ]);

    // Handle role synchronization in the approval server if reporter is present
    if (interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(reporterId).catch(() => null);
        if (member) {
          // Sync appropriate role
          for (const tier of BUG_HUNTER_TIERS) {
            let role: Role | null | undefined = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() === tier.name.toLowerCase());
            if (!role) {
              // Create role with appropriate color if it's missing
              role = await interaction.guild.roles.create({
                name: tier.name,
                color: tier.color as any,
                reason: "Auto-created bug hunter tier role",
              }).catch(() => null);
            }

            if (role) {
              if (newPoints >= tier.minPoints) {
                // Member has unlocked this tier role
                if (!member.roles.cache.has(role.id)) {
                  await member.roles.add(role, `Unlocked Bug Hunter level ${tier.tier}`).catch(() => {});
                }
              } else {
                // Demote/cleanup higher roles if points drop or not reached yet
                if (member.roles.cache.has(role.id)) {
                  await member.roles.remove(role, `Demoted or not qualified for Bug Hunter level ${tier.tier}`).catch(() => {});
                }
              }
            }
          }
        }
      } catch (err) {
        logger.warn({ err, reporterId }, "Failed to auto-manage bug hunter role assignment");
      }
    }

    // Try to DM the reporter
    try {
      const reporterUser = await interaction.client.users.fetch(reporterId).catch(() => null);
      if (reporterUser) {
        const dmEmbed = prettyEmbed({
          title: "Bug Report Approved!",
          color: 0x2ecc71,
          description:
            `### ${CE.check.str} **Congratulations! Your bug report was approved!**\n\n` +
            `Your bug report **${reportId}** has been approved by the QA team.\n` +
            `- **Awarded:** \`+${pointsToAward}\` Bug Points\n` +
            `- **Total Balance:** \`${newPoints}\` Bug Points\n` +
            (currentTier ? `- **Unlocked Badge:** ${currentTier.emojiStr} **${currentTier.name}**\n` : "") +
            `\n> *Thank you for keeping Zenith clean and stable! Run \`/badges\` or \`/profile\` to see your new badges.*`,
        });
        await reporterUser.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    } catch (err) {
      logger.debug({ err, reporterId }, "Could not send approval DM to user");
    }

  } else {
    // Mark as rejected
    await updateBugReportStatus(reportId, "rejected", interaction.user.id);

    updatedEmbed
      .setColor(0xe74c3c)
      .setTitle(`Bug Report: ${reportId} [REJECTED]`)
      .addFields([
        { name: `${CE.settings.str} Review Status`, value: `Rejected by ${interaction.user}`, inline: false }
      ]);

    // Try to DM the reporter
    try {
      const reporterUser = await interaction.client.users.fetch(reporterId).catch(() => null);
      if (reporterUser) {
        const dmEmbed = prettyEmbed({
          title: "Bug Report Reviewed",
          color: 0xe74c3c,
          description:
            `### **Bug Report Update: ${reportId}**\n\n` +
            `Your bug report **${reportId}** was reviewed by our development QA team and marked as **Rejected**.\n` +
            `- This could be due to a duplicate submission, an invalid description, or a bug that is not reproducible.\n\n` +
            `*If you believe this was an error, please reach out to us in the support server.*`,
        });
        await reporterUser.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    } catch (err) {
      logger.debug({ err, reporterId }, "Could not send rejection DM to user");
    }
  }

  // Update original message and disable buttons
  await message.edit({
    embeds: [updatedEmbed],
    components: [] as any, // Remove components to lock interaction
  }).catch((err) => {
    logger.error({ err }, "Failed to update reviewed bug report embed");
  });
}
