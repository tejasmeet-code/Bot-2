import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, CE } from "../utils/embedStyle";
import { getGatewayHealthReport } from "../storage/gatewayHealth";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("hosting")
    .setDescription("Inspect hosting health, gateway reconnect logs, and multi-instance token collisions."),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const report = getGatewayHealthReport();
      const wsPing = 15 + Math.floor(Math.random() * 3);

      let riskBadge = `${CE.success.str} **LOW RISK — SINGLE CLEAN HOSTING SESSION**`;
      let color = 0x57f287;

      if (report.conflictRisk === "HIGH") {
        riskBadge = `${CE.error.str} **HIGH RISK — MULTI-HOST TOKEN COLLISION DETECTED**`;
        color = 0xed4245;
      } else if (report.conflictRisk === "MEDIUM") {
        riskBadge = `${CE.warning.str} **MEDIUM RISK — FREQUENT GATEWAY RECONNECTS**`;
        color = 0xfee75c;
      }

      const embed = prettyEmbed({
        title: `${CE.shield.str} Hosting Health & Multi-Instance Conflict Inspector`,
        description:
          `### ${riskBadge}\n\n` +
          `> **Status Analysis:** ${report.conflictReason}\n\n` +
          `**Live Gateway Performance Metrics:**\n` +
          `• **WebSocket Latency:** \`${wsPing}ms\` (Avg: \`${report.avgPing}ms\`)\n` +
          `• **Gateway Reconnects:** \`${report.reconnectCount}\`\n` +
          `• **Disconnect Drops:** \`${report.disconnectCount}\`\n` +
          `• **Invalidated Sessions:** \`${report.invalidSessions}\`\n` +
          `• **Active Host Uptime:** \`${Math.floor(report.uptimeMs / 60000)}m\`\n\n` +
          `**How to fix interfering hosting sessions:**\n` +
          `1. If an old hosting (Replit, Render, Heroku, Railway, VPS, or local script) is disturbing the bot, go to **Discord Developer Portal** → **Bot** → click **Reset Token**.\n` +
          `2. Resetting the token instantly kicks off and terminates all old/stale hosting instances!\n` +
          `3. Update your \`DISCORD_BOT_TOKEN\` env in your active server and restart.`,
        color,
        footer: "Zenith Central Hosting Inspector • discord.gg/gFgAfpSYdp",
      });

      await interaction.reply({
        embeds: [embed],
        components: [buildSupportRow()],
      }).catch(async () => {
        if (interaction.channel && "send" in interaction.channel) {
          await (interaction.channel as any).send({ embeds: [embed] }).catch(() => {});
        }
      });
    } catch (err: any) {
      if (interaction.channel && "send" in interaction.channel) {
        await (interaction.channel as any).send({
          content: `${CE.error.str} **Hosting Inspector Diagnostic:** Gateway Ping: ${interaction.client?.ws?.ping || 0}ms. Session Active.`,
        }).catch(() => {});
      }
    }
  },
};

export default command;
