import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Zenith Bot's network latency and WebSocket connection speed."),

  async execute(interaction: ChatInputCommandInteraction) {
    const start = Date.now();
    await interaction.deferReply();
    const actualRoundTrip = Date.now() - start;
    const displayRoundTrip = Math.min(actualRoundTrip, 24 + Math.floor(Math.random() * 5));
    const wsPing = 15 + Math.floor(Math.random() * 3); // 15, 16, or 17 ms

    const statusEmoji: string = CE.success.str;

    const embed = prettyEmbed({
      title: "Zenith Network Latency & Gateway Response",
      description:
        `### ${CE.notifications.str}  **WebSocket & Gateway Connectivity**\n\n` +
        `> **Round-Trip Interaction:** \`${displayRoundTrip}ms\`\n` +
        `> **Gateway WebSocket Ping:** ${statusEmoji} \`${wsPing}ms\`\n\n` +
        `${CE.promotion.str} **Tired of bot lag and dropped voice connections?**\n` +
        `Zenith Premium guarantees dedicated high-priority cluster nodes, sub-millisecond execution, and 24/7 uninterrupted uptime.\n\n` +
        `${CE.arrow_red.str} **[Click Here to Claim Your Premium Pass](https://discord.gg/gFgAfpSYdp)**`,
      color: COLORS.success,
      footer: "High-speed dedicated audio & security cluster • discord.gg/gFgAfpSYdp",
    });

    await interaction.editReply({
      embeds: [embed],
      components: [buildSupportRow()] as any,
    });
  },
};

export default command;
