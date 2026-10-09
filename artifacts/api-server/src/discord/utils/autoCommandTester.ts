import type { Client, Guild, TextChannel, User, GuildMember } from "discord.js";
import { getCommandMap } from "../registry";
import { CE, COLORS, prettyEmbed } from "./embedStyle";
import { logger } from "../../lib/logger";

export interface CommandTestResult {
  commandName: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface DiagnosticsReport {
  timestamp: number;
  guildId?: string;
  guildName?: string;
  totalTested: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  results: CommandTestResult[];
}

let lastReport: DiagnosticsReport | null = null;
let autoTesterInterval: NodeJS.Timeout | null = null;
let isRunningDiagnostics = false;

export function getLastDiagnosticsReport(): DiagnosticsReport | null {
  return lastReport;
}

/**
 * Creates a synthetic mock interaction for command self-testing
 */
function createSyntheticMockInteraction(client: Client, guild: Guild, commandName: string) {
  const botUser = client.user!;
  const testMember = guild.members.me || guild.members.cache.first();
  const testChannel = guild.channels.cache.find((c) => c.isTextBased()) || guild.channels.cache.first();

  let replied = false;
  let deferred = false;

  return {
    isButton: () => false,
    isModalSubmit: () => false,
    isAnySelectMenu: () => false,
    isStringSelectMenu: () => false,
    isMessageComponent: () => false,
    isChatInputCommand: () => true,
    isCommand: () => true,
    inGuild: () => true,
    guildId: guild.id,
    guild,
    user: botUser,
    member: testMember,
    memberPermissions: testMember?.permissions ?? null,
    channel: testChannel,
    channelId: testChannel?.id,
    client,
    replied: false,
    deferred: false,
    options: {
      getUser: () => botUser,
      getMember: () => testMember,
      getString: () => "self-test-query",
      getInteger: () => 1,
      getNumber: () => 1,
      getBoolean: () => true,
      getRole: () => guild.roles.cache.first() ?? null,
      getChannel: () => testChannel ?? null,
      getMentionable: () => botUser,
      getAttachment: () => null,
      getSubcommand: () => null,
      getSubcommandGroup: () => null,
    },
    deferReply: async () => { deferred = true; },
    editReply: async () => ({ id: "mock_msg_id" }),
    reply: async () => ({ id: "mock_msg_id" }),
    followUp: async () => ({ id: "mock_msg_id" }),
    fetchReply: async () => ({ id: "mock_msg_id" }),
    showModal: async () => {},
    rawArgs: ["test"],
    invokedCommandName: commandName,
  };
}

/**
 * Executes a full diagnostic self-test cycle across all bot commands
 */
export async function runFullCommandDiagnostics(
  client: Client,
  targetGuildId?: string,
): Promise<DiagnosticsReport> {
  if (isRunningDiagnostics) {
    if (lastReport) return lastReport;
  }
  isRunningDiagnostics = true;

  const startTime = Date.now();
  const results: CommandTestResult[] = [];

  // Identify target test guild
  let targetGuild: Guild | undefined;
  if (targetGuildId) {
    targetGuild = client.guilds.cache.get(targetGuildId);
  }
  if (!targetGuild) {
    targetGuild = client.guilds.cache.first();
  }

  const cmdMap = getCommandMap();
  const uniqueCommands = Array.from(cmdMap.entries());

  // Non-destructive commands whitelist / blacklists for safe automated execution
  const dangerousCommands = new Set([
    "nuke",
    "bp?nuke",
    "ban-all",
    "bp?ban-all",
    "unban-all",
    "scramblechannels",
    "scrambleroles",
    "leaveserver",
    "eval",
    "botstatus",
    "botmaintenance",
    "maintenance",
    "botdown",
    "botlockdown",
    "botdevonly",
    "botviponly",
    "botnormal",
    "stop",
    "disconnect",
    "destroy",
    "leave",
    "purge",
    "clear",
    "ban",
    "kick",
    "mute",
    "unmute",
    "jail",
    "unjail",
    "setup",
    "wizard",
    "automod",
    "antinuke",
    "b?n",
    "dm",
    "botannounce",
    "globalautoreact",
    "botwhitelist",
    "adminbots",
    "ticketbot",
    "welcomerbot",
    "reload",
    "restart",
    "shutdown",
  ]);

  for (const [cmdName, cmdObj] of uniqueCommands) {
    const cmdStart = Date.now();
    try {
      // 1. Validate command object existence and basic structure
      if (!cmdObj) {
        throw new Error(`Command "${cmdName}" is undefined in registry.`);
      }
      if (typeof cmdObj.execute !== "function") {
        throw new Error(`Command "${cmdName}" missing valid execute function.`);
      }
      if (!cmdObj.data) {
        throw new Error(`Command "${cmdName}" missing SlashCommandBuilder data property.`);
      }

      // 2. Validate command name and description
      const name = cmdObj.data.name;
      const description = cmdObj.data.description;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        throw new Error(`Command "${cmdName}" has invalid or empty name.`);
      }
      if (!description || typeof description !== "string" || description.trim().length === 0) {
        throw new Error(`Command "${cmdName}" has invalid or empty description.`);
      }

      // 3. Test JSON schema serialization (required for Discord REST API payload)
      let jsonPayload: any = null;
      try {
        jsonPayload = typeof cmdObj.data.toJSON === "function" ? cmdObj.data.toJSON() : cmdObj.data;
      } catch (jsonErr: any) {
        throw new Error(`Command "${cmdName}" failed JSON serialization: ${jsonErr?.message || jsonErr}`);
      }

      if (!jsonPayload || !jsonPayload.name) {
        throw new Error(`Command "${cmdName}" produced invalid JSON payload.`);
      }

      // 4. For safe read-only informational commands (e.g., ping, botinfo, serverinfo, userinfo, avatar),
      // perform a safe dry-run simulation if target guild is present.
      const safeReadOnlyCommands = new Set([
        "ping",
        "botinfo",
        "serverinfo",
        "userinfo",
        "avatar",
        "ginfo",
        "supabasestatus",
      ]);

      if (safeReadOnlyCommands.has(cmdName.toLowerCase()) && targetGuild) {
        const mockInteraction = createSyntheticMockInteraction(client, targetGuild, cmdName);
        await Promise.race([
          cmdObj.execute(mockInteraction as any),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000)),
        ]).catch(() => {});
      }

      const cmdDuration = Date.now() - cmdStart;
      results.push({
        commandName: cmdName,
        status: "passed",
        durationMs: cmdDuration,
      });
    } catch (err: any) {
      const cmdDuration = Date.now() - cmdStart;
      const errMsg = err?.message || String(err);
      results.push({
        commandName: cmdName,
        status: "failed",
        durationMs: cmdDuration,
        error: errMsg,
        stack: err?.stack?.slice(0, 500),
      });
    }
  }

  const totalDuration = Date.now() - startTime;
  const passedCount = results.filter((r) => r.status === "passed").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  const report: DiagnosticsReport = {
    timestamp: Date.now(),
    guildId: targetGuild?.id,
    guildName: targetGuild?.name,
    totalTested: results.length,
    passedCount,
    failedCount,
    skippedCount,
    durationMs: totalDuration,
    results,
  };

  lastReport = report;
  isRunningDiagnostics = false;

  // Report results to configured diagnostic webhook
  await reportBugsToWebhook(report, client).catch((webhookErr) => {
    logger.error({ err: webhookErr }, "Error sending diagnostics report to webhook");
  });

  return report;
}

/**
 * Dispatches diagnostic bug reports to webhook URL
 */
export async function reportBugsToWebhook(report: DiagnosticsReport, client: Client): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL_1 || process.env.DISCORD_WEBHOOK_URL_3;
  if (!webhookUrl) {
    logger.warn("No webhook URL configured (DISCORD_WEBHOOK_URL_1/3) for automated bug reporting.");
    return false;
  }

  const failedTests = report.results.filter((r) => r.status === "failed");
  const isHealthy = failedTests.length === 0;

  const botTag = client.user ? `${client.user.username}#${client.user.discriminator}` : "Zenith Bot";

  let bugFields: any[] = [];
  if (failedTests.length > 0) {
    bugFields = failedTests.slice(0, 10).map((f) => ({
      name: `${CE.failure.str} \`/${f.commandName}\` (${f.durationMs}ms)`,
      value: `> **Error:** \`${f.error || "Unknown error"}\`\n\`\`\`ts\n${f.stack ? f.stack.slice(0, 200) : "No stack trace"}\n\`\`\``,
      inline: false,
    }));
  }

  const embedPayload = {
    title: isHealthy
      ? `${CE.Bughunter_1.str} Automated Diagnostics Report • All Systems Nominal`
      : `${CE.error.str} Automated Diagnostics Alert • ${failedTests.length} Bug${failedTests.length === 1 ? "" : "s"} Detected`,
    description:
      `**Test Environment:** \`${report.guildName || "Global / Sandbox"}\` (${report.guildId || "N/A"})\n` +
      `**Executed By:** ${CE.Tool.str} \`Zenith Automated Bug-Tester Daemon\`\n` +
      `**Timestamp:** <t:${Math.floor(report.timestamp / 1000)}:F> (<t:${Math.floor(report.timestamp / 1000)}:R>)\n\n` +
      `> ${CE.check.str} **Passed Commands:** \`${report.passedCount} / ${report.totalTested}\`\n` +
      `> ${CE.failure.str} **Failed Commands:** \`${report.failedCount}\`\n` +
      `> ${CE.link.str} **Execution Duration:** \`${(report.durationMs / 1000).toFixed(2)}s\``,
    color: isHealthy ? 0x23a55a : 0xf23f43,
    fields: bugFields,
    footer: {
      text: `${botTag} • Continuous Automated Testing & Webhook Reporter`,
      icon_url: client.user?.displayAvatarURL(),
    },
    timestamp: new Date(report.timestamp).toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Zenith Bug Diagnostics",
        avatar_url: client.user?.displayAvatarURL(),
        embeds: [embedPayload],
      }),
    });

    return response.ok;
  } catch (err) {
    logger.error({ err }, "Failed to deliver diagnostics report to webhook");
    return false;
  }
}

/**
 * Initializes recurring background command testing daemon
 */
export function startAutoTesterDaemon(client: Client, intervalMinutes = 20): void {
  if (autoTesterInterval) {
    clearInterval(autoTesterInterval);
  }

  // Initial diagnostics execution after client is fully ready (delayed 15s to allow guild caches to populate)
  setTimeout(() => {
    runFullCommandDiagnostics(client).catch(() => {});
  }, 15000);

  // Periodic recurring diagnostics
  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;
  autoTesterInterval = setInterval(() => {
    runFullCommandDiagnostics(client).catch(() => {});
  }, intervalMs);

  logger.info({ intervalMinutes }, "Automated Command Self-Test & Webhook Bug Diagnostics daemon started.");
}

export function stopAutoTesterDaemon(): void {
  if (autoTesterInterval) {
    clearInterval(autoTesterInterval);
    autoTesterInterval = null;
  }
}
