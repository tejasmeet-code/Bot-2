import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  type CategoryChannel,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed, buildSupportRow } from "../utils/embedStyle";

export const categoryCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("category")
    .setDescription("Create, edit, delete, or list server categories")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new channel category")
        .addStringOption((o) => o.setName("name").setDescription("Category name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Rename an existing channel category")
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription("The category to edit")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addStringOption((o) => o.setName("name").setDescription("New category name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a category (does not delete child channels)")
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription("The category to delete")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove / delete a category (does not delete child channels)")
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription("The category to remove")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all categories and child channel counts in this server"),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, flags: 1 << 6 });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels) && interaction.guild.ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Permission Denied",
            description: `${CE.failure.str} You require the **Manage Channels** permission to manage categories.`,
            color: COLORS.danger,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Bot Permission Required",
            description: `${CE.failure.str} I require the **Manage Channels** permission to manage categories.`,
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

      try {
        const created = await interaction.guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          reason: `Created by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Category Created Successfully",
              description:
                `### ${CE.check.str}  **Category Created**\n\n` +
                `> **Name:** \`${created.name}\`\n` +
                `> **ID:** \`${created.id}\`\n` +
                `> **Created By:** <@${interaction.user.id}>\n\n` +
                `${CE.manager.str} **Upgrade to Zenith Premium** for automated category templates and server backup cloning!`,
              color: COLORS.success,
              footer: "Zenith Category Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
          components: [buildSupportRow("Zenith VIP Hub")],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to create category: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: EDIT ──
    if (sub === "edit") {
      const category = interaction.options.getChannel("category", true) as CategoryChannel;
      const newName = interaction.options.getString("name", true);

      try {
        const oldName = category.name;
        await category.setName(newName, `Edited by ${interaction.user.tag}`);

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Category Renamed",
              description:
                `### ${CE.check.str}  **Category Modified**\n\n` +
                `> **Previous Name:** \`${oldName}\`\n` +
                `> **New Name:** \`${newName}\`\n` +
                `> **Category ID:** \`${category.id}\``,
              color: COLORS.success,
              footer: "Zenith Category Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to rename category: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: DELETE / REMOVE ──
    if (sub === "delete" || sub === "remove") {
      const category = interaction.options.getChannel("category", true) as CategoryChannel;
      const reason = interaction.options.getString("reason") || `Deleted by ${interaction.user.tag}`;

      const name = category.name;
      const id = category.id;
      const childCount = category.children.cache.size;

      try {
        await category.delete(reason);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Category Deleted",
              description:
                `### ${CE.delete.str}  **Category Removed**\n\n` +
                `> **Category:** \`${name}\` (\`${id}\`)\n` +
                `> **Child Channels Preserved:** \`${childCount}\` channels\n` +
                `> **Reason:** ${reason}`,
              color: COLORS.danger,
              footer: "Zenith Category Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to delete category: \`${err.message || err}\``,
          flags: 1 << 6,
        });
      }
      return;
    }

    // ── SUBCOMMAND: LIST ──
    const categories = [...interaction.guild.channels.cache.values()]
      .filter((c) => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.rawPosition - b.rawPosition) as CategoryChannel[];

    const catLines = categories.map((cat, i) => {
      const children = cat.children.cache.size;
      return `\`${i + 1}.\` **${cat.name}** (\`${cat.id}\`) — \`${children}\` channels`;
    });

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: `Server Categories (${categories.length} Total)`,
          description:
            `### ${CE.folder.str}  **Category Directory**\n\n` +
            (catLines.length > 0 ? catLines.join("\n") : "*No categories found in this server*") +
            `\n\n> ${CE.manager.str} **Auto-Nuke Shield:** Upgrade to Zenith Premium for full server architecture snapshots.`,
          fields: [{ name: "Total Categories", value: `\`${categories.length}\``, inline: true }],
          color: COLORS.primary,
          footer: "Zenith Category Manager • discord.gg/gFgAfpSYdp",
        }),
      ],
      components: [buildSupportRow("Zenith VIP Hub")],
    });
  },
};
