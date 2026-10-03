import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  type GuildChannel,
  type TextChannel,
  type VoiceChannel,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS, prettyEmbed, buildSupportRow } from "../utils/embedStyle";
import { ensureBotPermissions } from "../utils/ownerPermissionPrompt";

export const channelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("channel")
    .setDescription("Create, edit, delete, or list server channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new channel")
        .addStringOption((o) => o.setName("name").setDescription("Channel name").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("Channel type")
            .setRequired(false)
            .addChoices(
              { name: "Text Channel", value: "text" },
              { name: "Voice Channel", value: "voice" },
              { name: "Stage Channel", value: "stage" },
              { name: "Announcement Channel", value: "announcement" },
            ),
        )
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription("Category to place channel in")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        )
        .addStringOption((o) => o.setName("topic").setDescription("Channel topic").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to edit")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildStageVoice,
            )
            .setRequired(true),
        )
        .addStringOption((o) => o.setName("name").setDescription("New channel name").setRequired(false))
        .addStringOption((o) => o.setName("topic").setDescription("New topic description").setRequired(false))
        .addIntegerOption((o) =>
          o
            .setName("slowmode")
            .setDescription("Slowmode delay in seconds (0 to 21600)")
            .setMinValue(0)
            .setMaxValue(21600)
            .setRequired(false),
        )
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription("Move to category")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to delete")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildStageVoice,
            )
            .setRequired(true),
        )
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove / delete a channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to remove")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildStageVoice,
            )
            .setRequired(true),
        )
        .addStringOption((o) => o.setName("reason").setDescription("Reason for deletion").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all text and voice channels in this server")
        .addIntegerOption((o) => o.setName("page").setDescription("Page number").setRequired(false)),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command must be run inside a server.`, ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels) && interaction.guild.ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Permission Denied",
            description: `${CE.failure.str} You require the **Manage Channels** permission to use this command.`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const hasPerms = await ensureBotPermissions(
      interaction,
      [PermissionFlagsBits.ManageChannels],
      ["ManageChannels"],
      "create, edit, delete, or modify server channels",
    );
    if (!hasPerms) return;

    const sub = interaction.options.getSubcommand(false) || "list";

    // ── SUBCOMMAND: CREATE ──
    if (sub === "create") {
      const name = interaction.options.getString("name", true);
      const typeStr = interaction.options.getString("type") || "text";
      const category = interaction.options.getChannel("category");
      const topic = interaction.options.getString("topic");

      let channelType = ChannelType.GuildText;
      if (typeStr === "voice") channelType = ChannelType.GuildVoice;
      else if (typeStr === "stage") channelType = ChannelType.GuildStageVoice;
      else if (typeStr === "announcement") channelType = ChannelType.GuildAnnouncement;

      try {
        const created = await interaction.guild.channels.create({
          name,
          type: channelType as any,
          parent: category ? category.id : undefined,
          topic: topic || undefined,
          reason: `Created by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Channel Created Successfully",
              description:
                `### ${CE.check.str}  **Channel Created**\n\n` +
                `> **Channel:** <#${created.id}> (\`${created.name}\`)\n` +
                `> **Type:** \`${typeStr.toUpperCase()}\`\n` +
                `> **Category:** ${category ? `<#${category.id}>` : "*None*"}\n` +
                `> **Topic:** ${topic ? `\`${topic}\`` : "*None*"}\n\n` +
                `${CE.manager.str} **Upgrade to Zenith Premium** for infinite voice channels, auto-temp channels & instant anti-nuke restoration!`,
              color: COLORS.success,
              footer: "Zenith Channel Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
          components: [buildSupportRow("Zenith VIP Hub")] as any,
        });
      } catch (err: any) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Failed to Create Channel",
              description: `${CE.failure.str} Error creating channel: \`${err.message || err}\``,
              color: COLORS.danger,
            }),
          ],
          ephemeral: true,
        });
      }
      return;
    }

    // ── SUBCOMMAND: EDIT ──
    if (sub === "edit") {
      const targetChannel = interaction.options.getChannel("channel", true) as GuildChannel;
      const newName = interaction.options.getString("name");
      const newTopic = interaction.options.getString("topic");
      const slowmode = interaction.options.getInteger("slowmode");
      const newCategory = interaction.options.getChannel("category");

      const editData: any = {};
      if (newName) editData.name = newName;
      if (newTopic !== null && "setTopic" in targetChannel) editData.topic = newTopic;
      if (slowmode !== null && "setRateLimitPerUser" in targetChannel) editData.rateLimitPerUser = slowmode;
      if (newCategory) editData.parent = newCategory.id;

      if (Object.keys(editData).length === 0) {
        await interaction.reply({
          content: `${CE.failure.str} Please provide at least one option to edit (name, topic, slowmode, or category).`,
          ephemeral: true,
        });
        return;
      }

      try {
        await targetChannel.edit({
          ...editData,
          reason: `Edited by ${interaction.user.tag} (${interaction.user.id})`,
        });

        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Channel Updated",
              description:
                `### ${CE.check.str}  **Channel Modified**\n\n` +
                `> **Channel:** <#${targetChannel.id}>\n` +
                `> **Updated By:** <@${interaction.user.id}>\n` +
                (newName ? `> **New Name:** \`${newName}\`\n` : "") +
                (newTopic !== null ? `> **New Topic:** \`${newTopic || "Cleared"}\`\n` : "") +
                (slowmode !== null ? `> **Slowmode:** \`${slowmode}s\`\n` : "") +
                (newCategory ? `> **Category:** <#${newCategory.id}>\n` : ""),
              color: COLORS.success,
              footer: "Zenith Channel Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to edit channel: \`${err.message || err}\``,
          ephemeral: true,
        });
      }
      return;
    }

    // ── SUBCOMMAND: DELETE / REMOVE ──
    if (sub === "delete" || sub === "remove") {
      const targetChannel = interaction.options.getChannel("channel", true) as GuildChannel;
      const reason = interaction.options.getString("reason") || `Deleted by ${interaction.user.tag}`;

      const name = targetChannel.name;
      const id = targetChannel.id;

      try {
        await targetChannel.delete(reason);
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: "Channel Deleted",
              description:
                `### ${CE.delete.str}  **Channel Removed**\n\n` +
                `> **Channel:** \`#${name}\` (\`${id}\`)\n` +
                `> **Moderator:** <@${interaction.user.id}>\n` +
                `> **Reason:** ${reason}`,
              color: COLORS.danger,
              footer: "Zenith Channel Manager • discord.gg/gFgAfpSYdp",
            }),
          ],
        });
      } catch (err: any) {
        await interaction.reply({
          content: `${CE.failure.str} Failed to delete channel: \`${err.message || err}\``,
          ephemeral: true,
        });
      }
      return;
    }

    // ── SUBCOMMAND: LIST ──
    const channels = [...interaction.guild.channels.cache.values()]
      .filter((c) => c.type !== ChannelType.GuildCategory)
      .sort((a: any, b: any) => ((a.rawPosition ?? 0) as number) - ((b.rawPosition ?? 0) as number));

    const page = Math.max(1, interaction.options.getInteger("page") || 1);
    const pageSize = 15;
    const totalPages = Math.max(1, Math.ceil(channels.length / pageSize));
    const startIdx = (page - 1) * pageSize;
    const currentChannels = channels.slice(startIdx, startIdx + pageSize);

    const listLines = currentChannels.map((c, i) => {
      const idx = startIdx + i + 1;
      const typeIcon =
        c.type === ChannelType.GuildVoice
          ? CE.music.str
          : c.type === ChannelType.GuildStageVoice
            ? CE.music_bot.str
            : c.type === ChannelType.GuildAnnouncement
              ? CE.notifications.str
              : CE.clipboard.str;
      return `\`${idx}.\` ${typeIcon} <#${c.id}> (\`${c.name}\`)`;
    });

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: `Server Channels (${channels.length} Total)`,
          description:
            `### ${CE.clipboard.str}  **Channel Directory**\n\n` +
            (listLines.length > 0 ? listLines.join("\n") : "*No channels found on this page*") +
            `\n\n> ${CE.manager.str} **Protect your server:** Prevent mass-channel deletion raids with **Zenith God-Mode Anti-Nuke**.`,
          fields: [
            { name: "Total Channels", value: `\`${channels.length}\``, inline: true },
            { name: "Page", value: `\`${page} / ${totalPages}\``, inline: true },
          ],
          color: COLORS.primary,
          footer: `Page ${page} of ${totalPages} • Zenith Channel Manager • discord.gg/gFgAfpSYdp`,
        }),
      ],
      components: [buildSupportRow("Zenith VIP Hub")] as any,
    });
  },
};
