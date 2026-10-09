import {
  type Client,
  Events,
  EmbedBuilder,
  type TextChannel,
  type VoiceState,
  type Role,
  type GuildEmoji,
  type Sticker,
  type GuildChannel,
  type DMChannel,
  type GuildMember,
  type PartialGuildMember,
  type Message,
  type PartialMessage,
} from "discord.js";
import { getGuildConfig, getLoggingConfig } from "../storage/config";
import { CE, COLORS } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

async function sendLogEmbed(
  client: Client,
  guildId: string,
  targetChannelId: string,
  generalChannelId: string,
  embed: EmbedBuilder,
): Promise<void> {
  const channelId = targetChannelId || generalChannelId;
  if (!channelId) return;

  try {
    const ch = (client.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null))) as TextChannel | null;
    if (ch && "send" in ch) {
      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    logger.debug({ err, guildId, channelId }, "Failed to send event log embed");
  }
}

export function registerEventLogger(client: Client): void {
  // 1. Voice State Updates (VC Join / Leave / Move)
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const cfg = await getGuildConfig(guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logVc) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    // Join VC
    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${CE.white_mic.str} Voice Channel Joined`)
        .setColor(COLORS.success)
        .setDescription(`Member <@${member.id}> (\`${member.user.tag}\`) joined <#${newState.channelId}>`)
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
      await sendLogEmbed(client, guild.id, lc.vcLogChannelId, lc.generalLogChannelId, embed);
    }
    // Leave VC
    else if (oldState.channelId && !newState.channelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${CE.white_mic.str} Voice Channel Left`)
        .setColor(COLORS.danger)
        .setDescription(`Member <@${member.id}> (\`${member.user.tag}\`) left <#${oldState.channelId}>`)
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
      await sendLogEmbed(client, guild.id, lc.vcLogChannelId, lc.generalLogChannelId, embed);
    }
    // Move VC
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${CE.white_mic.str} Voice Channel Moved`)
        .setColor(COLORS.info)
        .setDescription(`Member <@${member.id}> (\`${member.user.tag}\`) moved from <#${oldState.channelId}> to <#${newState.channelId}>`)
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
      await sendLogEmbed(client, guild.id, lc.vcLogChannelId, lc.generalLogChannelId, embed);
    }
  });

  // 2. Role Events (Create, Update, Delete)
  client.on(Events.GuildRoleCreate, async (role: Role) => {
    const cfg = await getGuildConfig(role.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logRoles) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.staff.str} Role Created`)
      .setColor(COLORS.success)
      .setDescription(`Role **${role.name}** (<@&${role.id}>) was created.\n**Color:** \`${role.hexColor}\` • **Hoist:** \`${role.hoist}\``)
      .setFooter({ text: `Role ID: ${role.id}` })
      .setTimestamp();
    await sendLogEmbed(client, role.guild.id, lc.roleLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildRoleUpdate, async (oldRole: Role, newRole: Role) => {
    const cfg = await getGuildConfig(newRole.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logRoles) return;

    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Color:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoisted:** \`${oldRole.hoist}\` → \`${newRole.hoist}\``);

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.staff.str} Role Updated`)
      .setColor(COLORS.info)
      .setDescription(`Role <@&${newRole.id}> was updated:\n` + changes.join("\n"))
      .setFooter({ text: `Role ID: ${newRole.id}` })
      .setTimestamp();
    await sendLogEmbed(client, newRole.guild.id, lc.roleLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildRoleDelete, async (role: Role) => {
    const cfg = await getGuildConfig(role.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logRoles) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.trash.str} Role Deleted`)
      .setColor(COLORS.danger)
      .setDescription(`Role **${role.name}** (\`${role.id}\`) was deleted.`)
      .setFooter({ text: `Role ID: ${role.id}` })
      .setTimestamp();
    await sendLogEmbed(client, role.guild.id, lc.roleLogChannelId, lc.generalLogChannelId, embed);
  });

  // 3. Emoji Events (Create, Update, Delete)
  client.on(Events.GuildEmojiCreate, async (emoji: GuildEmoji) => {
    const cfg = await getGuildConfig(emoji.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logEmojis) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.star.str} Emoji Created`)
      .setColor(COLORS.success)
      .setDescription(`Emoji ${emoji} (\`${emoji.name}\`) was created.`)
      .setFooter({ text: `Emoji ID: ${emoji.id}` })
      .setTimestamp();
    await sendLogEmbed(client, emoji.guild.id, lc.emojiLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildEmojiUpdate, async (oldEmoji: GuildEmoji, newEmoji: GuildEmoji) => {
    const cfg = await getGuildConfig(newEmoji.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logEmojis) return;

    if (oldEmoji.name === newEmoji.name) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.star.str} Emoji Updated`)
      .setColor(COLORS.info)
      .setDescription(`Emoji ${newEmoji} was renamed from \`${oldEmoji.name}\` to \`${newEmoji.name}\`.`)
      .setFooter({ text: `Emoji ID: ${newEmoji.id}` })
      .setTimestamp();
    await sendLogEmbed(client, newEmoji.guild.id, lc.emojiLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildEmojiDelete, async (emoji: GuildEmoji) => {
    const cfg = await getGuildConfig(emoji.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logEmojis) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.trash.str} Emoji Deleted`)
      .setColor(COLORS.danger)
      .setDescription(`Emoji \`${emoji.name}\` (\`${emoji.id}\`) was removed.`)
      .setFooter({ text: `Emoji ID: ${emoji.id}` })
      .setTimestamp();
    await sendLogEmbed(client, emoji.guild.id, lc.emojiLogChannelId, lc.generalLogChannelId, embed);
  });

  // 4. Sticker Events (Create, Delete)
  client.on(Events.GuildStickerCreate, async (sticker: Sticker) => {
    if (!sticker.guild) return;
    const cfg = await getGuildConfig(sticker.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logStickers) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.star.str} Sticker Created`)
      .setColor(COLORS.success)
      .setDescription(`Sticker **${sticker.name}** was created.`)
      .setFooter({ text: `Sticker ID: ${sticker.id}` })
      .setTimestamp();
    await sendLogEmbed(client, sticker.guild.id, lc.stickerLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildStickerDelete, async (sticker: Sticker) => {
    if (!sticker.guild) return;
    const cfg = await getGuildConfig(sticker.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logStickers) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.trash.str} Sticker Deleted`)
      .setColor(COLORS.danger)
      .setDescription(`Sticker **${sticker.name}** (\`${sticker.id}\`) was deleted.`)
      .setFooter({ text: `Sticker ID: ${sticker.id}` })
      .setTimestamp();
    await sendLogEmbed(client, sticker.guild.id, lc.stickerLogChannelId, lc.generalLogChannelId, embed);
  });

  // 5. Channel Events (Create, Delete)
  client.on(Events.ChannelCreate, async (channel: GuildChannel | DMChannel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const cfg = await getGuildConfig(channel.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logChannels) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.folder.str} Channel Created`)
      .setColor(COLORS.success)
      .setDescription(`Channel <#${channel.id}> (\`${channel.name}\`) was created.`)
      .setFooter({ text: `Channel ID: ${channel.id}` })
      .setTimestamp();
    await sendLogEmbed(client, channel.guild.id, lc.channelLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.ChannelDelete, async (channel: GuildChannel | DMChannel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const cfg = await getGuildConfig(channel.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logChannels) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.trash.str} Channel Deleted`)
      .setColor(COLORS.danger)
      .setDescription(`Channel **#${channel.name}** (\`${channel.id}\`) was deleted.`)
      .setFooter({ text: `Channel ID: ${channel.id}` })
      .setTimestamp();
    await sendLogEmbed(client, channel.guild.id, lc.channelLogChannelId, lc.generalLogChannelId, embed);
  });

  // 6. Member Events (Join, Leave, Role Update)
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    const cfg = await getGuildConfig(member.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logMembers) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.members.str} Member Joined`)
      .setColor(COLORS.success)
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`Member <@${member.id}> (\`${member.user.tag}\`) joined the server.`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
    await sendLogEmbed(client, member.guild.id, lc.memberLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    const cfg = await getGuildConfig(member.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logMembers) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.members.str} Member Left`)
      .setColor(COLORS.danger)
      .setDescription(`Member <@${member.id}> (\`${member.user?.tag || member.id}\`) left the server.`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();
    await sendLogEmbed(client, member.guild.id, lc.memberLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    const cfg = await getGuildConfig(newMember.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logMembers) return;

    const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const roleChanges: string[] = [];
    if (addedRoles.size > 0) {
      roleChanges.push(`**Added:** ${addedRoles.map((r) => `<@&${r.id}>`).join(", ")}`);
    }
    if (removedRoles.size > 0) {
      roleChanges.push(`**Removed:** ${removedRoles.map((r) => `<@&${r.id}>`).join(", ")}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CE.staff.str} Member Roles Updated`)
      .setColor(COLORS.info)
      .setDescription(`Roles updated for <@${newMember.id}>:\n` + roleChanges.join("\n"))
      .setFooter({ text: `User ID: ${newMember.id}` })
      .setTimestamp();
    await sendLogEmbed(client, newMember.guild.id, lc.memberLogChannelId, lc.generalLogChannelId, embed);
  });

  // 7. Message Delete & Edit
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    if (!message.guild || message.author?.bot) return;
    const cfg = await getGuildConfig(message.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logMessages) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.trash.str} Message Deleted`)
      .setColor(COLORS.danger)
      .setDescription(
        `**Author:** <@${message.author?.id}> (\`${message.author?.tag}\`)\n` +
        `**Channel:** <#${message.channelId}>\n` +
        `**Content:** ${message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : "*No text content*"}`
      )
      .setFooter({ text: `Message ID: ${message.id}` })
      .setTimestamp();
    await sendLogEmbed(client, message.guild.id, lc.messageLogChannelId, lc.generalLogChannelId, embed);
  });

  client.on(Events.MessageUpdate, async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const cfg = await getGuildConfig(newMsg.guild.id);
    const lc = getLoggingConfig(cfg);
    if (!lc.enabled || !lc.logMessages) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.settings.str} Message Edited`)
      .setColor(COLORS.info)
      .setDescription(
        `**Author:** <@${newMsg.author?.id}> (\`${newMsg.author?.tag}\`)\n` +
        `**Channel:** <#${newMsg.channelId}>\n\n` +
        `**Before:**\n\`\`\`${oldMsg.content?.slice(0, 450) || "*Empty*"}\`\`\`\n` +
        `**After:**\n\`\`\`${newMsg.content?.slice(0, 450) || "*Empty*"}\`\`\``
      )
      .setFooter({ text: `Message ID: ${newMsg.id}` })
      .setTimestamp();
    await sendLogEmbed(client, newMsg.guild.id, lc.messageLogChannelId, lc.generalLogChannelId, embed);
  });
}
