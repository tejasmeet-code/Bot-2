import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { isPermanentOwner } from "../storage/premium";
import { CE, prettyEmbed, errorEmbed, COLORS, buildSupportRow } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

export const gbotavatarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("gbotavatar")
    .setDescription("Bot Owner Feature: Customize the bot's global Avatar and Username across all servers.")
    .addAttachmentOption((o) =>
      o.setName("avatar").setDescription("Upload an image file to set as the bot's global avatar").setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("avatar_url").setDescription("Direct image URL to set as the bot's global avatar").setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("name").setDescription("New global username for the bot").setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const authorId = interaction.user.id;

    // ── 1. Bot Owner Gate ───────────────────────────────────────────────────────
    if (!isPermanentOwner(authorId)) {
      await interaction.reply({
        embeds: [errorEmbed("Access Denied", "Only the **absolute Bot Owner** is authorized to run `.gbotavatar`.")],
        flags: 1 << 6,
      });
      return;
    }

    await interaction.deferReply();

    // ── 2. Extract Options ──────────────────────────────────────────────────────
    const avatarAttachment = interaction.options.getAttachment("avatar");
    const avatarUrl = interaction.options.getString("avatar_url");
    const newName = interaction.options.getString("name");

    // Fallback parser for raw arguments if executed via prefix
    let targetImageUrl = avatarAttachment?.url || avatarUrl || null;
    let finalGlobalName = newName || null;

    if (!interaction.isChatInputCommand()) {
      // @ts-ignore
      const rawArgs = interaction.rawArgs || [];
      if (rawArgs.length > 0) {
        if (rawArgs[0].startsWith("http://") || rawArgs[0].startsWith("https://")) {
          targetImageUrl = rawArgs[0];
          if (rawArgs.slice(1).length > 0) {
            finalGlobalName = rawArgs.slice(1).join(" ");
          }
        } else {
          finalGlobalName = rawArgs.join(" ");
        }
      }
      // @ts-ignore
      const prefixAttachment = interaction.options.getAttachment("avatar");
      if (prefixAttachment) {
        targetImageUrl = prefixAttachment.url;
      }
    }

    if (!targetImageUrl && !finalGlobalName) {
      const usageEmbed = prettyEmbed({
        title: "Global Bot Identity Usage",
        color: COLORS.primary,
        description:
          `### 🛠️ **How to customize globally:**\n\n` +
          `• **Set Global Username:**\n` +
          `  \`\`\`.gbotavatar name Zenith Bot\`\`\`\n` +
          `• **Set Global Avatar:**\n` +
          `  \`\`\`.gbotavatar <image_url>\`\`\` *or upload an image with the message*\n` +
          `• **Set Both Username & Avatar:**\n` +
          `  \`\`\`.gbotavatar <image_url> Zenith Bot\`\`\`\n\n` +
          `> ${CE.star.str} *This customization applies **Globally** across every server the bot is joined to.*`,
        footer: "Zenith Global Config Engine",
      });

      await interaction.editReply({ embeds: [usageEmbed] });
      return;
    }

    let avatarUpdated = false;
    let nameUpdated = false;

    // ── 3. Apply Global Avatar ──────────────────────────────────────────────────
    if (targetImageUrl) {
      try {
        const res = await fetch(targetImageUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
        if (!res || !res.ok) {
          await interaction.editReply({
            embeds: [errorEmbed("Download Failed", `Could not download the provided avatar image (HTTP ${res?.status ?? "Error"}).`)],
          });
          return;
        }

        const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
        if (!ALLOWED_MIME.has(ct)) {
          await interaction.editReply({
            embeds: [errorEmbed("Invalid Image Format", `Supported formats are PNG, JPG, JPEG, GIF, or WebP.`)],
          });
          return;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 8 * 1024 * 1024) {
          await interaction.editReply({
            embeds: [errorEmbed("File Too Large", "The image file must be under 8MB in size.")],
          });
          return;
        }

        await interaction.client.user?.setAvatar(buf);
        avatarUpdated = true;
      } catch (err: any) {
        logger.error({ err }, "Error setting global avatar");
        await interaction.editReply({
          embeds: [errorEmbed("Global Avatar Error", `Failed to set global avatar: ${err?.message || "Discord API limit reached or invalid format."}`)],
        });
        return;
      }
    }

    // ── 4. Apply Global Username ───────────────────────────────────────────────
    if (finalGlobalName) {
      try {
        const trimmedName = finalGlobalName.slice(0, 32);
        await interaction.client.user?.setUsername(trimmedName);
        nameUpdated = true;
      } catch (nameErr: any) {
        logger.error({ nameErr }, "Error setting global username");
        const msg = nameErr?.message || "";
        const isVerifiedLock = msg.includes("verified") || msg.includes("50035") || msg.includes("APPLICATION_NAME");
        await interaction.editReply({
          embeds: [
            errorEmbed(
              "Verified App Name Protected",
              isVerifiedLock
                ? "This bot is a **Verified Discord Application**. Discord prevents changing global names via API for verified apps. Use `.botavatar name <nickname>` to set server nicknames."
                : `Failed to set global username: ${msg || "Rate limited or protected."}`
            )
          ],
        });
        return;
      }
    }

    // ── 5. Confirmation Embed ─────────────────────────────────────────────────
    const confirmEmbed = prettyEmbed({
      title: "Global Bot Identity Updated",
      color: COLORS.success,
      description:
        `### ${CE.check.str} **Global Custom Appearance Activated**\n\n` +
        `The bot's master credentials have been updated successfully!\n\n` +
        (nameUpdated ? `• **Global Username:** \`${finalGlobalName}\`\n` : "") +
        (avatarUpdated ? `• **Global Avatar:** [View New Master Avatar](${targetImageUrl})\n` : "") +
        `• **Server Scope:** Applied **Globally** across all server clusters\n` +
        `• **Status:** 👑 \`OWNER MASTER VIP\`\n\n` +
        `*Please note that global changes can take a minute to fully synchronize on Discord's side.*`,
      thumbnail: targetImageUrl || interaction.client.user?.displayAvatarURL(),
      footer: `Authorized by ${interaction.user.tag} • Bot Master Config`,
    });

    await interaction.editReply({ embeds: [confirmEmbed] });
  },
};

export default gbotavatarCommand;
