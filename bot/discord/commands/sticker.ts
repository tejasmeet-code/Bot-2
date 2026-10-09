import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed, buildSupportRow } from "../utils/embedStyle";

export const stickerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("sticker")
    .setDescription("Create, edit, delete, or list custom server stickers")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new custom sticker")
        .addStringOption((o) => o.setName("name").setDescription("Sticker name").setRequired(true))
        .addStringOption((o) => o.setName("tags").setDescription("Related emoji tag (e.g. tada or star)").setRequired(true))
        .addAttachmentOption((o) => o.setName("file").setDescription("Sticker image (PNG or APNG)").setRequired(false))
        .addStringOption((o) => o.setName("url").setDescription("Sticker image URL (PNG/APNG)").setRequired(false))
        .addStringOption((o) => o.setName("description").setDescription("Sticker description").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing custom sticker")
        .addStringOption((o) => o.setName("sticker").setDescription("Sticker name or ID").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("New sticker name").setRequired(false))
        .addStringOption((o) => o.setName("description").setDescription("New description").setRequired(false))
        .addStringOption((o) => o.setName("tags").setDescription("New emoji tags").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a custom sticker")
        .addStringOption((o) => o.setName("sticker").setDescription("Sticker name or ID").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove / delete a custom sticker")
        .addStringOption((o) => o.setName("sticker").setDescription("Sticker name or ID").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all custom stickers in this server"),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, flags: 1 << 6 });
      return;
    }

    const member = interaction.member as GuildMember;
    if (
      !member.permissions.has(PermissionFlagsBits.ManageGuildExpressions) &&
      !member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers) &&
      interaction.guild.ownerId !== interaction.user.id
    ) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Permission Denied",
            description: `${CE.failure.str} You require the **Manage Expressions** permission to manage stickers.`,
            color: COLORS.danger,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (
      !botMember ||
      (!botMember.permissions.has(PermissionFlagsBits.ManageGuildExpressions) &&
        !botMember.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers))
    ) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Bot Permission Required",
            description: `${CE.failure.str} I require the **Manage Expressions** permission to modify stickers in this server.`,
            color: COLORS.danger,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false) || "list";

    // ── SUBCOMMAND: CREATE ──
    if (sub === "create") {
      const name = interaction.options.getString("name", true);
      const tags = interaction.options.getString("tags", true);
      const attachment = interaction.options.getAttachment("file");
      const url = interaction.options.getString("url");
      const description = interaction.options.getString("description") || undefined;

      const fileSource = attachment?.url || url;
      if (!fileSource) {
        await interaction.reply({
          content: `${CE.failure.str} Please provide either a sticker file attachment or a direct URL.`,
          flags: 1 << 6,
        });
        return;
      }

      try {
        await interaction.deferReply();
        const created = await interaction.guild.stickers.create({
          file: fileSource,
          name,
          tags,
          description,
          reason: `Created by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.editReply({
          embeds: [
            prettyEmbed({
              title: "Sticker Created Successfully",
              description:
                `### ${CE.check.str}  **Sticker Added**\n\n` +
                `> **Name:** \`${created.name}\`\n` +
                `> **ID:** \`${created.id}\`\n` +
                `> **Tags:** \`${created.tags}\`\n` +
                `> **Description:** ${created.description ? `\`${created.description}\`` : "*None*"}\n` +
                `> **Added By:** <@${interaction.user.id}>\n\n` +
                `${CE.manager.str} **Upgrade to Zenith Premium** for unlimited sticker backups & expressions sync!`,
              thumbnail: created.url,
              color: COLORS.success,
              footer: "Zenith Sticker Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
          components: [buildSupportRow("Zenith VIP Hub")],
        });
      } catch (err: any) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `${CE.failure.str} Failed to create sticker: \`${err.message || err}\``,
          });
        } else {
          await interaction.reply({
            content: `${CE.failure.str} Failed to create sticker: \`${err.message || err}\``,
            flags: 1 << 6,
          });
        }
      }
      return;
    }

    // ── SUBCOMMAND: EDIT ──
    if (sub === "edit") {
      const stickerInput = interaction.options.getString("sticker", true).trim();
      const newName = interaction.options.getString("name");
      const newDesc = interaction.options.getString("description");
      const newTags = interaction.options.getString("tags");

      const targetSticker = interaction.guild.stickers.cache.find(
        (s) => s.id === stickerInput || s.name.toLowerCase() === stickerInput.toLowerCase(),
      );

      if (!targetSticker) {
        await interaction.reply({
          content: `${CE.failure.str} Could not find a sticker matching \`${stickerInput}\` in this server.`,
          flags: 1 << 6,
        });
        return;
      }

      const updateData: any = {};
      if (newName) updateData.name = newName;
      if (newDesc !== null) updateData.description = newDesc;
      if (newTags) updateData.tags = newTags;

      if (Object.keys(updateData).length === 0) {
        await interaction.reply({
          content: `${CE.failure.str} Please provide at least one option to edit (name, description, or tags).`,
          flags: 1 << 6,
        });
        return;
      }

      try {
        const updated = await targetSticker.edit({
          ...updateData,
          reason: `Edited by ${interaction.user.tag}`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Sticker Modified",
              description:
                `### ${CE.check.str}  **Sticker Updated**\n\n` +
                `> **Name:** \`${updated.name}\`\n` +
                `> **ID:** \`${updated.id}\`\n` +
                `> **Tags:** \`${updated.tags}\`\n` +
                `> **Description:** ${updated.description ? `\`${updated.description}\`` : "*None*"}`,
              thumbnail: updated.url,
              color: COLORS.success,
              footer: "Zenith Sticker Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to edit sticker: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: DELETE / REMOVE ──
    if (sub === "delete" || sub === "remove") {
      const stickerInput = interaction.options.getString("sticker", true).trim();
      const reason = interaction.options.getString("reason") || `Deleted by ${interaction.user.tag}`;

      const targetSticker = interaction.guild.stickers.cache.find(
        (s) => s.id === stickerInput || s.name.toLowerCase() === stickerInput.toLowerCase(),
      );

      if (!targetSticker) {
        await interaction.reply({
          content: `${CE.failure.str} Could not find a sticker matching \`${stickerInput}\` in this server.`,
          flags: 1 << 6,
        });
        return;
      }

      const name = targetSticker.name;
      const id = targetSticker.id;
      const url = targetSticker.url;

      try {
        await targetSticker.delete(reason);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Sticker Deleted",
              description:
                `### ${CE.delete.str}  **Sticker Removed**\n\n` +
                `> **Name:** \`${name}\`\n` +
                `> **ID:** \`${id}\`\n` +
                `> **Moderator:** <@${interaction.user.id}>\n` +
                `> **Reason:** ${reason}`,
              thumbnail: url,
              color: COLORS.danger,
              footer: "Zenith Sticker Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to delete sticker: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: LIST ──
    const stickers = [...interaction.guild.stickers.cache.values()];

    const stickerLines = stickers.map((s, i) => `\`${i + 1}.\` **${s.name}** (\`${s.id}\`) — Tag: \`${s.tags}\``);

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: `Server Stickers (${stickers.length} Total)`,
          description:
            `### ${CE.star.str}  **Custom Stickers**\n\n` +
            (stickerLines.length > 0 ? stickerLines.join("\n") : "*No stickers found in this server*") +
            `\n\n> ${CE.manager.str} **Backup Guarantee:** Keep server stickers safe from accidental deletes with Zenith VIP Cloud backups.`,
          fields: [{ name: "Total Stickers", value: `\`${stickers.length}\``, inline: true }],
          color: COLORS.primary,
          footer: "Zenith Sticker Manager • discord.gg/gFgAfpSYdp",
        }),
      ],
      components: [buildSupportRow("Zenith VIP Hub")],
    });
  },
};
