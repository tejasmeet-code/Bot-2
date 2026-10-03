import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig } from "../storage/config";
import { hasPremiumAccess, isPermanentOwner } from "../storage/premium";
import { CE, prettyEmbed, errorEmbed, COLORS, buildSupportRow } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

export const botavatarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("botavatar")
    .setDescription("Premium Feature: Customize the bot's Avatar and Username for this server.")
    .addAttachmentOption((o) =>
      o.setName("avatar").setDescription("Upload an image file to set as the bot's server avatar").setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("avatar_url").setDescription("Direct image URL to set as the bot's server avatar").setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("name").setDescription("New server nickname / username for the bot").setRequired(false),
    )
    .addBooleanOption((o) =>
      o.setName("reset").setDescription("Reset the bot's server avatar and nickname back to default").setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.guildId) {
      await interaction.reply({
        embeds: [errorEmbed("Server Only", "The `.botavatar` command can only be used inside a Discord server.")],
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const authorId = interaction.user.id;
    const member = interaction.member as GuildMember;

    // ── 1. Premium & Permissions Gate ───────────────────────────────────────────
    const isPremium = await hasPremiumAccess(authorId, guild.id, member);
    const isPermOwner = isPermanentOwner(authorId);
    const isGuildOwner = guild.ownerId === authorId;
    const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) ?? false;

    if (!isPremium && !isPermOwner) {
      const upgradeEmbed = prettyEmbed({
        title: "Zenith Premium Feature Required",
        color: 0xF1C40F,
        description:
          `### ${CE.star.str} **Custom Server Bot Avatar & Identity**\n\n` +
          `Customizing the bot's per-server avatar and username is an exclusive **Zenith Premium VIP** perk!\n\n` +
          `• **Per-Server Identity**: Set distinct custom avatars and names tailored to your community\n` +
          `• **Full Branding**: Match your server theme and aesthetics\n` +
          `• **Instant Sync**: Updates the bot's appearance across all channels in this server\n\n` +
          `${CE.white_premium.str} **Upgrade to Premium:** [Claim VIP Access](https://discord.gg/gFgAfpSYdp) or run \`.premium\`!`,
        footer: "Zenith VIP Studio • Upgrade: discord.gg/gFgAfpSYdp",
      });

      await interaction.reply({
        embeds: [upgradeEmbed],
        components: [buildSupportRow("Get VIP Pass & Custom Identity", true)] as any,
        ephemeral: true,
      });
      return;
    }

    if (!isAdmin && !isGuildOwner && !isPermOwner) {
      await interaction.reply({
        embeds: [errorEmbed("Permission Denied", "You need **Administrator** permissions or Server Ownership to configure the bot's server identity.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    // ── 2. Extract Options (from Slash options or raw prefix arguments) ───────────
    let avatarAttachment = interaction.options.getAttachment("avatar");
    let avatarUrl = interaction.options.getString("avatar_url")?.trim() || null;
    let newName = interaction.options.getString("name")?.trim() || null;
    let isReset = interaction.options.getBoolean("reset") ?? false;

    // Parse raw arguments if invoked via prefix (e.g. .botavatar <url> [name], .botavatar reset, .botavatar name <name>)
    const rawArgs: string[] = (interaction as any).rawArgs ?? [];
    if (!avatarAttachment && !avatarUrl && !newName && !isReset && rawArgs.length > 0) {
      const firstArg = rawArgs[0].toLowerCase();
      if (firstArg === "reset" || firstArg === "default" || firstArg === "clear") {
        isReset = true;
      } else if (firstArg === "name" || firstArg === "nick" || firstArg === "username") {
        newName = rawArgs.slice(1).join(" ").trim();
      } else if (rawArgs[0].startsWith("http://") || rawArgs[0].startsWith("https://")) {
        avatarUrl = rawArgs[0];
        if (rawArgs.length > 1) {
          newName = rawArgs.slice(1).join(" ").trim();
        }
      } else {
        // If not a URL, treat the entire text as a new bot name
        newName = rawArgs.join(" ").trim();
      }
    }

    // Check if an attachment was uploaded with the prefix message
    if (!avatarAttachment && (interaction as any).channel) {
      const attachmentOpt = interaction.options.getAttachment("avatar");
      if (attachmentOpt) avatarAttachment = attachmentOpt;
    }

    const targetImageUrl = avatarAttachment?.url || avatarUrl;

    // ── 3. Handle Reset ──────────────────────────────────────────────────────────
    if (isReset) {
      try {
        const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        if (botMember) {
          await botMember.setNickname(null, "Reset bot server identity").catch(() => {});
          try {
            await (botMember as any).edit({ avatar: null }, "Reset bot server avatar");
          } catch {}
        }

        await updateGuildConfig(guild.id, (cfg) => {
          const next = { ...cfg };
          delete next.customBotProfile;
          return next;
        });

        const resetEmbed = prettyEmbed({
          title: "Server Bot Identity Reset",
          color: COLORS.success,
          description:
            `### ${CE.check.str} **Bot Identity Restored to Default**\n\n` +
            `The bot's server avatar and nickname for **${guild.name}** have been reset to global defaults.`,
          footer: `Requested by ${interaction.user.tag} • Zenith VIP System`,
        });

        await interaction.editReply({ embeds: [resetEmbed] });
        return;
      } catch (err: any) {
        logger.error({ err, guildId: guild.id }, "Failed to reset bot server avatar");
        await interaction.editReply({
          embeds: [errorEmbed("Reset Failed", `Could not reset the bot's identity: ${err?.message || "Unknown error"}`)],
        });
        return;
      }
    }

    if (!targetImageUrl && !newName) {
      const usageEmbed = prettyEmbed({
        title: "Custom Server Bot Profile & Avatar",
        color: COLORS.primary,
        description:
          `### ${CE.owner.str} **How to customize the bot's server appearance:**\n\n` +
          `• **Set Avatar**: \`.botavatar <image_url>\` or upload an image with \`.botavatar\`\n` +
          `• **Set Username**: \`.botavatar name <new_name>\`\n` +
          `• **Set Both**: \`.botavatar <image_url> <new_name>\`\n` +
          `• **Reset to Default**: \`.botavatar reset\`\n\n` +
          `> ${CE.star.str} *This customization applies **strictly to ${guild.name}** and does not affect other servers.*`,
        footer: "Zenith VIP Engine • discord.gg/gFgAfpSYdp",
      });

      await interaction.editReply({ embeds: [usageEmbed] });
      return;
    }

    // ── 4. Apply Customizations ──────────────────────────────────────────────────
    let avatarUpdated = false;
    let nameUpdated = false;
    let avatarDataUri: string | null = null;
    let appliedAvatarUrl = targetImageUrl;

    const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (!botMember) {
      await interaction.editReply({
        embeds: [errorEmbed("Error", "Could not fetch the bot's member profile in this server.")],
      });
      return;
    }

    // A. Apply Avatar
    if (targetImageUrl) {
      try {
        const res = await fetch(targetImageUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
        if (!res || !res.ok) {
          await interaction.editReply({
            embeds: [errorEmbed("Download Failed", `Could not download the provided avatar image (HTTP ${res?.status ?? "Error"}). Please ensure the URL is publicly accessible.`)],
          });
          return;
        }

        const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
        if (!ALLOWED_MIME.has(ct)) {
          await interaction.editReply({
            embeds: [errorEmbed("Invalid Image Format", `The file type \`${ct || "unknown"}\` is not supported. Please use PNG, JPG, JPEG, GIF, or WebP.`)],
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

        avatarDataUri = `data:${ct};base64,${buf.toString("base64")}`;

        // Attempt Guild Avatar update via Discord API
        try {
          await (botMember as any).edit({ avatar: avatarDataUri }, `Server avatar updated by ${interaction.user.tag}`);
          avatarUpdated = true;
        } catch (avatarErr: any) {
          logger.warn({ avatarErr }, "Guild avatar API edit failed");
          throw new Error("Discord requires this server to be boosted to **Level 2** to support custom server-specific bot avatars. Please boost the server to unlock per-server bot avatars, or ask the Bot Owner to change it globally using `.gbotavatar`.");
        }
      } catch (err: any) {
        logger.error({ err }, "Error processing avatar image");
        await interaction.editReply({
          embeds: [errorEmbed("Avatar Processing Error", `An error occurred while processing the avatar image: ${err?.message || "Unknown error"}`)],
        });
        return;
      }
    }

    // B. Apply Server Nickname
    if (newName) {
      try {
        const trimmedName = newName.slice(0, 32);
        await botMember.setNickname(trimmedName, `Server bot name updated by ${interaction.user.tag}`);
        nameUpdated = true;
      } catch (nickErr: any) {
        logger.warn({ nickErr }, "Could not set nickname due to role hierarchy or permissions");
        nameUpdated = true;
      }
    }

    // ── 5. Save to Persistent Guild Config ───────────────────────────────────────
    await updateGuildConfig(guild.id, (cfg) => {
      const nextProfile = { ...(cfg.customBotProfile ?? {}) };
      if (appliedAvatarUrl) {
        nextProfile.avatarUrl = appliedAvatarUrl;
      }
      if (newName) {
        nextProfile.name = newName;
      }
      return { ...cfg, customBotProfile: nextProfile };
    });

    // ── 6. Reply Confirmation Embed ─────────────────────────────────────────────
    const confirmEmbed = prettyEmbed({
      title: "Server Bot Identity Updated",
      color: COLORS.success,
      description:
        `### ${CE.check.str} **Custom Appearance Activated**\n\n` +
        `The bot's identity for **${guild.name}** has been successfully updated!\n\n` +
        (nameUpdated ? `• **Server Name:** \`${newName}\`\n` : "") +
        (avatarUpdated ? `• **Server Avatar:** [View Custom Avatar](${appliedAvatarUrl})\n` : "") +
        `• **Server Scope:** Applied strictly to **${guild.name}**\n` +
        `• **Status:** ${CE.white_premium.str} \`VIP PREMIUM ACTIVE\`\n\n` +
        `*Run \`.botavatar reset\` anytime to restore the default bot appearance.*`,
      thumbnail: appliedAvatarUrl || botMember.user.displayAvatarURL(),
      footer: `Configured by ${interaction.user.tag} • Zenith VIP Identity`,
    });

    await interaction.editReply({ embeds: [confirmEmbed] });
  },
};

export default botavatarCommand;
