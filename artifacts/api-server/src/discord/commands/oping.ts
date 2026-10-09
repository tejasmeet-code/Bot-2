import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";
import { isBotOwner } from "../utils/ownerImmunity";
import { getSupabaseStatus } from "../storage/persistentJson";
import os from "os";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("oping")
    .setDescription("Bot Owner Only: Real unmasked WebSocket ping, DB latency, and gateway diagnostic stats."),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isBotOwner(interaction.user.id)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Owner Access Required`,
            description: "The `.oping` / `/oping` command provides raw internal diagnostic metrics and is strictly restricted to the **Bot Owner**.",
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const startRest = Date.now();
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const realRoundTrip = Date.now() - startRest;

    // Database / Supabase round-trip latency
    const startDb = Date.now();
    const dbStatus = await getSupabaseStatus().catch(() => null);
    const dbPing = Date.now() - startDb;

    const realWsPing = Math.max(0, Math.round(interaction.client.ws.ping));

    const memory = process.memoryUsage();
    const rssMb = Math.round(memory.rss / 1024 / 1024);
    const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
    const uptimeSec = Math.round(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = uptimeSec % 60;
    const formattedUptime = `${hours > 0 ? `${hours}h ` : ""}${mins > 0 ? `${mins}m ` : ""}${secs}s`;

    let pingEmoji = CE.success.str;
    if (realWsPing > 300) pingEmoji = CE.error.str;
    else if (realWsPing > 150) pingEmoji = CE.warning.str;

    const embed = prettyEmbed({
      title: `${CE.owner.str} Real Network & Gateway Diagnostics (Owner Only)`,
      description:
        `### ${CE.notifications.str} **Unmasked Live Metrics**\n\n` +
        `> **Real Gateway WebSocket Ping:** ${pingEmoji} \`${realWsPing}ms\`\n` +
        `> **Real Interaction REST Round-Trip:** \`${realRoundTrip}ms\`\n` +
        `> **Database (Supabase) Query Latency:** \`${dbPing}ms\` (${dbStatus?.connected ? "Connected" : "Local Disk Fallback"})\n` +
        `> **Hosting Environment:** \`Render Cloud Node (${os.platform()} ${os.arch()})\`\n\n` +
        `### ${CE.settings.str} **Process & System Resources**\n\n` +
        `> **Node.js Runtime:** \`${process.version}\`\n` +
        `> **Memory Usage (RSS):** \`${rssMb} MB\` (Heap: \`${heapUsedMb} MB\`)\n` +
        `> **Process Uptime:** \`${formattedUptime}\`\n` +
        `> **Connected Guilds:** \`${interaction.client.guilds.cache.size}\` server(s)\n`,
      color: COLORS.primary,
      footer: `Owner Real Latency Diagnostic • Invoked by ${interaction.user.tag}`,
    });

    await interaction.editReply({
      embeds: [embed],
      components: [buildSupportRow()] as any,
    });
  },
};

export default command;
