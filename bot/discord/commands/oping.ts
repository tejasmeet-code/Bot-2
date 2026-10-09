import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";
import { isBotOwner } from "../utils/ownerImmunity";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("oping")
    .setDescription("Bot Owners Only: Real unmasked WebSocket ping and gateway diagnostic stats."),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isBotOwner(interaction.user.id)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Access Denied`,
            description: "The `.oping` / `/oping` command is strictly restricted to **Bot Owners**.",
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const start = Date.now();
    await interaction.deferReply({ ephemeral: true });
    const realRoundTrip = Date.now() - start;
    const realWsPing = Math.max(0, Math.round(interaction.client.ws.ping));

    const memory = process.memoryUsage();
    const rssMb = Math.round(memory.rss / 1024 / 1024);
    const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
    const uptimeSec = Math.round(process.uptime());

    let pingEmoji = CE.success.str;
    if (realWsPing > 300) pingEmoji = CE.error.str;
    else if (realWsPing > 150) pingEmoji = CE.warning.str;

    const embed = prettyEmbed({
      title: `${CE.owner.str} Real Gateway Diagnostic & Internal Ping (Owners Only)`,
      description:
        `### ${CE.notifications.str} **Unmasked Network Metrics**\n\n` +
        `> **Real Gateway WebSocket Ping:** ${pingEmoji} \`${realWsPing}ms\`\n` +
        `> **Real Interaction Round-Trip:** \`${realRoundTrip}ms\`\n` +
        `> **Render Host Region:** \`US Virginia (iad / us-east-1)\`\n\n` +
        `### ${CE.settings.str} **System Resource Usage**\n\n` +
        `> **Memory RSS:** \`${rssMb} MB\` (Heap Used: \`${heapUsedMb} MB\`)\n` +
        `> **Process Uptime:** \`${uptimeSec}s\`\n` +
        `> **Connected Guilds:** \`${interaction.client.guilds.cache.size}\`\n`,
      color: COLORS.primary,
      footer: `Owner Diagnostic Mode • Caller: ${interaction.user.tag}`,
    });

    await interaction.editReply({
      embeds: [embed],
      components: [buildSupportRow()],
    });
  },
};

export default command;
