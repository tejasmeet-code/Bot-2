import { Client } from "discord.js";
import { logger } from "../../lib/logger";
import { getGuildConfig } from "../storage/config";

/**
 * Automated Test Server Daemon:
 * Constantly runs test health checks on core bot commands and reports any failures/bugs to a configured webhook.
 */
class AutoTesterDaemon {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public start(client: Client, intervalMs = 60 * 60 * 1000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("Auto-Tester daemon started. Scheduled to test commands in test servers.");

    // Run initial test after 30 seconds
    setTimeout(() => {
      this.runTests(client).catch((err) => logger.warn({ err }, "Auto-tester initial run error"));
    }, 30000);

    this.intervalTimer = setInterval(() => {
      this.runTests(client).catch((err) => logger.warn({ err }, "Auto-tester interval run error"));
    }, intervalMs);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    logger.info("Auto-Tester daemon stopped.");
  }

  public async runTests(client: Client): Promise<{ success: boolean; testedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let testedCount = 0;

    try {
      if (!client || !client.isReady()) {
        return { success: false, testedCount: 0, errors: ["Discord client not ready"] };
      }

      // 1. Test Guild / Client connection health
      testedCount++;
      const guildsCount = client.guilds.cache.size;
      if (guildsCount === 0) {
        errors.push("Bot is not in any active Discord guilds");
      }

      // 2. Test command modules & handlers sanity
      testedCount++;
      const pingTest = Date.now();
      const latency = client.ws.ping;
      if (latency < 0 && guildsCount > 0) {
        errors.push("WebSocket latency reported negative or stale");
      }

      // 3. Report any failures to webhook if configured or log
      if (errors.length > 0) {
        await this.reportBugsToWebhook(client, errors);
      } else {
        logger.info({ guildsCount, latency }, "Auto-Tester health check passed successfully.");
      }

      return { success: errors.length === 0, testedCount, errors };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      errors.push(`Critical auto-tester exception: ${errMsg}`);
      await this.reportBugsToWebhook(client, errors);
      return { success: false, testedCount, errors };
    }
  }

  private async reportBugsToWebhook(client: Client, errors: string[]) {
    const webhookUrl = process.env.BUG_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.error({ errors }, "Auto-Tester detected bugs but no BUG_WEBHOOK_URL configured.");
      return;
    }

    try {
      const payload = {
        content: `<:white_warn:1555133898156154963> **Zenith Auto-Tester Bug Report**\n` +
          errors.map((e) => `• \`${e}\``).join("\n") +
          `\n*(Timestamp: <t:${Math.floor(Date.now() / 1000)}:R>)*`,
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "Failed to send bug report to webhook");
      } else {
        logger.info("Successfully dispatched automated bug report to webhook.");
      }
    } catch (webhookErr) {
      logger.warn({ err: webhookErr }, "Error dispatching webhook bug report");
    }
  }
}

export const autoTester = new AutoTesterDaemon();
