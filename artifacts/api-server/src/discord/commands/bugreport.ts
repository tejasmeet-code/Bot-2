import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import type { SlashCommand } from "../types";
import { addBugReport } from "../storage/bugReports";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

const APPROVAL_CHANNEL_ID = "1553617415131107508";

export const bugreportCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("bugreport")
    .setDescription("Report a bot bug with description and optional image proof")
    .addStringOption((o) =>
      o.setName("description")
        .setDescription("Detailed description of the bug and how to reproduce it")
        .setRequired(true)
    )
    .addAttachmentOption((o) =>
      o.setName("proof")
        .setDescription("Image/screenshot proof of the bug")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const description = interaction.options.getString("description", true);
    const proofAttachment = interaction.options.getAttachment("proof");

    const reportId = `BUG-${Math.floor(100000 + Math.random() * 900000)}`;

    const reportData = {
      id: reportId,
      userId: interaction.user.id,
      description,
      imageUrl: proofAttachment?.url || undefined,
      status: "pending" as const,
      timestamp: Date.now(),
    };

    // Save to persistent storage
    await addBugReport(reportData);

    // Send to Zenith Media Server approval channel
    const client = interaction.client;
    const approvalChannel = (await client.channels.fetch(APPROVAL_CHANNEL_ID).catch(() => null)) as TextChannel | null;

    if (!approvalChannel) {
      await interaction.editReply({
        content: `${CE.failure.str} Could not route bug report to the Zenith Quality Assurance channel. Please contact our developers in the support server!`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`New Bug Report: ${reportId}`)
      .setDescription(
        `**Reporter:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
        `**Server:** \`${interaction.guild?.name || "DMs"}\` (\`${interaction.guildId || "N/A"}\`)\n\n` +
        `**Description:**\n${description}`
      )
      .setColor(0xe74c3c)
      .setTimestamp();

    if (proofAttachment) {
      embed.setImage(proofAttachment.url);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bug_approve:1:${reportId}`)
        .setLabel("Approve (+1 Pt)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bug_approve:5:${reportId}`)
        .setLabel("Approve (+5 Pts)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bug_approve:10:${reportId}`)
        .setLabel("Approve (+10 Pts)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bug_reject:${reportId}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger)
    );

    await approvalChannel.send({ embeds: [embed], components: [row] as any }).catch((err) => {
      logger.error({ err }, "Failed to send bug report to approval channel");
    });

    const userEmbed = prettyEmbed({
      title: "Bug Report Submitted!",
      description:
        `### ${CE.check.str} **Thank you for helping us improve Zenith!**\n\n` +
        `Your bug report **${reportId}** has been successfully dispatched to the QA review team.\n` +
        `- If approved, you will earn **Bug Points** to unlock rare badges & Bug Hunter roles!\n\n` +
        `> **Your Description:** *"${description.slice(0, 100)}${description.length > 100 ? "..." : ""}"*`,
      color: COLORS.primary,
    });

    await interaction.editReply({ embeds: [userEmbed] });
  },
};

export default bugreportCommand;
