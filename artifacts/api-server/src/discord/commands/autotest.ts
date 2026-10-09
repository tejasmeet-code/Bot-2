import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { isPermanentOwner } from "../storage/premium";
import {
  runFullCommandDiagnostics,
  getLastDiagnosticsReport,
  startAutoTesterDaemon,
} from "../utils/autoCommandTester";

export const autotestCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("autotest")
    .setDescription("Run automated diagnostic tests across all bot commands and report bugs to webhook")
    .addSubcommand((sub) =>
      sub
        .setName("run")
        .setDescription("Execute immediate live diagnostic testing cycle across all commands")
        .addStringOption((opt) =>
          opt
            .setName("guild")
            .setDescription("Target Guild ID to run tests in (optional)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View results and bug metrics from the most recent diagnostic cycle")
    )
    .addSubcommand((sub) =>
      sub
        .setName("schedule")
        .setDescription("Configure recurring automated diagnostics background schedule")
        .addIntegerOption((opt) =>
          opt
            .setName("interval")
            .setDescription("Interval in minutes (min: 5, default: 20)")
            .setRequired(true)
            .setMinValue(5)
            .setMaxValue(1440)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const isOwner = isPermanentOwner(interaction.user.id) || interaction.guild?.ownerId === interaction.user.id;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
      await interaction.reply({
        content: `${CE.failure.str} You must be a Server Administrator or Bot Developer to run automated diagnostics.`,
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand(false) || "run";

    if (subcommand === "status") {
      const last = getLastDiagnosticsReport();
      if (!last) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: `${CE.Bughunter_1.str} Automated Diagnostics Status`,
              description:
                `No diagnostic runs recorded in this session yet.\n\n` +
                `Run \`/autotest run\` or \`.autotest run\` to trigger an immediate full self-test cycle!`,
              color: COLORS.primary,
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      const failed = last.results.filter((r) => r.status === "failed");
      const statusEmbed = prettyEmbed({
        title: `${CE.Bughunter_1.str} Automated Diagnostics • Last Test Summary`,
        description:
          `**Last Run:** <t:${Math.floor(last.timestamp / 1000)}:F> (<t:${Math.floor(last.timestamp / 1000)}:R>)\n` +
          `**Target Environment:** \`${last.guildName || "Global"}\` (${last.guildId || "N/A"})\n` +
          `**Total Duration:** \`${(last.durationMs / 1000).toFixed(2)}s\`\n\n` +
          `> ${CE.check.str} **Passed:** \`${last.passedCount} / ${last.totalTested}\`\n` +
          `> ${CE.failure.str} **Failed:** \`${last.failedCount}\`\n` +
          `> ${CE.white_skip.str} **Skipped:** \`${last.skippedCount}\`\n\n` +
          (failed.length > 0
            ? `**Active Bugs Detected (${failed.length}):**\n` +
              failed.slice(0, 5).map((f) => `• \`/${f.commandName}\`: \`${f.error || "Error"}\``).join("\n") +
              `\n\n*Full details and stack traces have been dispatched to the configured diagnostics webhook.*`
            : `${CE.check.str} **All systems 100% operational with 0 bugs!**`),
        color: failed.length === 0 ? COLORS.success : COLORS.danger,
      });

      await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
      return;
    }

    if (subcommand === "schedule") {
      const interval = interaction.options.getInteger("interval", true);
      startAutoTesterDaemon(interaction.client, interval);

      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.settings.str} Automated Diagnostics Schedule Configured`,
            description:
              `Continuous automated command testing has been set to run every **${interval} minutes**.\n\n` +
              `• **Target Environment:** Live server registry & test sandbox\n` +
              `• **Bug Reporting:** Automated embeds dispatched to \`DISCORD_WEBHOOK_URL_1\`\n` +
              `• **Health Monitoring:** 24/7 self-healing and error logging active`,
            color: COLORS.success,
          }),
        ],
      });
      return;
    }

    // Default subcommand: run
    await interaction.deferReply();

    const targetGuildId = interaction.options.getString("guild") || interaction.guildId || undefined;
    const report = await runFullCommandDiagnostics(interaction.client, targetGuildId);

    const failed = report.results.filter((r) => r.status === "failed");
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL_1 || process.env.DISCORD_WEBHOOK_URL_3;

    const resultEmbed = prettyEmbed({
      title: failed.length === 0
        ? `${CE.Bughunter_1.str} Command Diagnostics Completed • All Systems Operational`
        : `${CE.error.str} Command Diagnostics Completed • ${failed.length} Bug${failed.length === 1 ? "" : "s"} Found`,
      description:
        `Executed non-destructive diagnostic simulation across **${report.totalTested}** registered commands.\n\n` +
        `> ${CE.check.str} **Passed Commands:** \`${report.passedCount}\`\n` +
        `> ${CE.failure.str} **Failed Commands:** \`${report.failedCount}\`\n` +
        `> ${CE.white_skip.str} **Skipped (Sensitive):** \`${report.skippedCount}\`\n` +
        `> ${CE.link.str} **Total Runtime:** \`${(report.durationMs / 1000).toFixed(2)}s\`\n\n` +
        `**Webhook Status:** ${webhookUrl ? `${CE.check.str} \`Delivered to Bug Webhook\`` : `${CE.white_warn.str} \`No Webhook Configured\``}\n\n` +
        (failed.length > 0
          ? `**Failing Commands:**\n` +
            failed.slice(0, 8).map((f) => `• \`/${f.commandName}\` (${f.durationMs}ms): \`${f.error || "Error"}\``).join("\n")
          : `${CE.check.str} **Zero bugs or broken commands detected in this environment!**`),
      color: failed.length === 0 ? COLORS.success : COLORS.danger,
    });

    await interaction.editReply({ embeds: [resultEmbed] });
  },
};

export default autotestCommand;
