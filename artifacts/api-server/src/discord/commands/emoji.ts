import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  type GuildEmoji,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed, buildSupportRow } from "../utils/embedStyle";

function parseEmojiIdentifier(input: string): { name?: string; id?: string } {
  const match = input.match(/<a?:([a-zA-Z0-9_]+):(\d+)>/);
  if (match) {
    return { name: match[1], id: match[2] };
  }
  if (/^\d{17,20}$/.test(input.trim())) {
    return { id: input.trim() };
  }
  return { name: input.trim() };
}

export const emojiCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("Create, edit, delete, or list custom server emojis")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Add a new custom emoji to the server")
        .addStringOption((o) => o.setName("name").setDescription("Name for the emoji").setRequired(true))
        .addAttachmentOption((o) => o.setName("file").setDescription("Image file for the emoji").setRequired(false))
        .addStringOption((o) => o.setName("url").setDescription("Image URL for the emoji").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Rename an existing custom emoji")
        .addStringOption((o) => o.setName("emoji").setDescription("The emoji, name, or ID to edit").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("New name for the emoji").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a custom emoji from the server")
        .addStringOption((o) => o.setName("emoji").setDescription("The emoji, name, or ID to delete").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove / delete a custom emoji from the server")
        .addStringOption((o) => o.setName("emoji").setDescription("The emoji, name, or ID to remove").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all custom emojis in this server with IDs and preview")
        .addIntegerOption((o) => o.setName("page").setDescription("Page number").setRequired(false)),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command must be run inside a server.`, ephemeral: true });
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
            description: `${CE.failure.str} You require the **Manage Expressions** permission to manage emojis.`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
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
            description: `${CE.failure.str} I require the **Manage Expressions** permission to modify emojis in this server.`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false) || "list";

    // ── SUBCOMMAND: CREATE ──
    if (sub === "create") {
      const name = interaction.options.getString("name", true).replace(/[^a-zA-Z0-9_]/g, "_");
      const attachment = interaction.options.getAttachment("file");
      const url = interaction.options.getString("url");

      const imageSource = attachment?.url || url;
      if (!imageSource) {
        await interaction.reply({
          content: `${CE.failure.str} Please provide either an image attachment or an image URL.`,
          ephemeral: true,
        });
        return;
      }

      try {
        await interaction.deferReply();
        const created = await interaction.guild.emojis.create({
          attachment: imageSource,
          name,
          reason: `Created by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.editReply({
          embeds: [
            prettyEmbed({
              title: "Emoji Created Successfully",
              description:
                `### ${CE.check.str}  **Emoji Added**\n\n` +
                `> **Preview:** ${created.toString()}\n` +
                `> **Name:** \`:${created.name}:\`\n` +
                `> **ID:** \`${created.id}\`\n` +
                `> **Animated:** ${created.animated ? "Yes" : "No"}\n` +
                `> **Added By:** <@${interaction.user.id}>\n\n` +
                `${CE.manager.str} **Upgrade to Zenith Premium** for unlimited emoji slots, global steal & instant sync across servers!`,
              thumbnail: created.url,
              color: COLORS.success,
              footer: "Zenith Expression Engine • discord.gg/gFgAfpSYdp",
            }),
          ],
          components: [buildSupportRow("Zenith VIP Hub")] as any,
        });
      } catch (err: any) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `${CE.failure.str} Failed to create emoji: \`${err.message || err}\``,
          });
        } else {
          await interaction.reply({
            content: `${CE.failure.str} Failed to create emoji: \`${err.message || err}\``,
            ephemeral: true,
          });
        }
      }
      return;
    }

    // ── SUBCOMMAND: EDIT ──
    if (sub === "edit") {
      const emojiInput = interaction.options.getString("emoji", true);
      const newName = interaction.options.getString("name", true).replace(/[^a-zA-Z0-9_]/g, "_");

      const { id, name } = parseEmojiIdentifier(emojiInput);
      const targetEmoji = interaction.guild.emojis.cache.find(
        (e) => (id && e.id === id) || (name && e.name?.toLowerCase() === name.toLowerCase()),
      );

      if (!targetEmoji) {
        await interaction.reply({
          content: `${CE.failure.str} Could not find an emoji matching \`${emojiInput}\` in this server.`,
          ephemeral: true,
        });
        return;
      }

      try {
        const oldName = targetEmoji.name;
        const updated = await targetEmoji.edit({
          name: newName,
          reason: `Edited by ${interaction.user.tag}`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Emoji Renamed",
              description:
                `### ${CE.check.str}  **Emoji Modified**\n\n` +
                `> **Emoji:** ${updated.toString()}\n` +
                `> **Old Name:** \`:${oldName}:\`\n` +
                `> **New Name:** \`:${updated.name}:\`\n` +
                `> **ID:** \`${updated.id}\``,
              color: COLORS.success,
              thumbnail: updated.url,
              footer: "Zenith Expression Engine • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to rename emoji: \`${err.message || err}\``,
          ephemeral: true,
        });
      }
      return;
    }

    // ── SUBCOMMAND: DELETE / REMOVE ──
    if (sub === "delete" || sub === "remove") {
      const emojiInput = interaction.options.getString("emoji", true);
      const reason = interaction.options.getString("reason") || `Deleted by ${interaction.user.tag}`;

      const { id, name } = parseEmojiIdentifier(emojiInput);
      const targetEmoji = interaction.guild.emojis.cache.find(
        (e) => (id && e.id === id) || (name && e.name?.toLowerCase() === name.toLowerCase()),
      );

      if (!targetEmoji) {
        await interaction.reply({
          content: `${CE.failure.str} Could not find an emoji matching \`${emojiInput}\` in this server.`,
          ephemeral: true,
        });
        return;
      }

      const emojiName = targetEmoji.name;
      const emojiId = targetEmoji.id;
      const emojiUrl = targetEmoji.url;

      try {
        await targetEmoji.delete(reason);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Emoji Deleted",
              description:
                `### ${CE.delete.str}  **Emoji Removed**\n\n` +
                `> **Emoji Name:** \`:${emojiName}:\`\n` +
                `> **ID:** \`${emojiId}\`\n` +
                `> **Moderator:** <@${interaction.user.id}>\n` +
                `> **Reason:** ${reason}`,
              thumbnail: emojiUrl,
              color: COLORS.danger,
              footer: "Zenith Expression Engine • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to delete emoji: \`${err.message || err}\``,
          ephemeral: true,
        });
      }
      return;
    }

    // ── SUBCOMMAND: LIST ──
    const emojis = [...interaction.guild.emojis.cache.values()];
    const staticCount = emojis.filter((e) => !e.animated).length;
    const animatedCount = emojis.filter((e) => e.animated).length;

    const page = Math.max(1, interaction.options.getInteger("page") || 1);
    const pageSize = 20;
    const totalPages = Math.max(1, Math.ceil(emojis.length / pageSize));
    const startIdx = (page - 1) * pageSize;
    const currentEmojis = emojis.slice(startIdx, startIdx + pageSize);

    const emojiLines = currentEmojis.map((e) => `${e.toString()} \`:${e.name}:\` (\`${e.id}\`)`);

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: `Server Emojis (${emojis.length} Total)`,
          description:
            `### ${CE.star.str}  **Custom Expressions**\n\n` +
            (emojiLines.length > 0 ? emojiLines.join("\n") : "*No emojis found on this page*") +
            `\n\n> ${CE.manager.str} **Emoji Anti-Raid:** Guard against mass-emoji deletions with Zenith God-Mode Anti-Nuke.`,
          fields: [
            { name: "Static Emojis", value: `\`${staticCount}\``, inline: true },
            { name: "Animated Emojis", value: `\`${animatedCount}\``, inline: true },
            { name: "Page", value: `\`${page} / ${totalPages}\``, inline: true },
          ],
          color: COLORS.primary,
          footer: `Page ${page} of ${totalPages} • Zenith Expression Engine • discord.gg/gFgAfpSYdp`,
        }),
      ],
      components: [buildSupportRow("Zenith VIP Hub")] as any,
    });
  },
};
