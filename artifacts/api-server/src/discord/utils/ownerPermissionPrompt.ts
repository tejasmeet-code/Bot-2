import {
  type Guild,
  type ChatInputCommandInteraction,
  type Message,
  type GuildTextBasedChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  type PermissionResolvable,
} from "discord.js";
import { CE, COLORS, prettyEmbed, BOT_INVITE_URL, SUPPORT_SERVER_URL } from "./embedStyle";
import { logger } from "../../lib/logger";

// Cache to avoid spamming server owners with multiple DMs within a short interval (15 minutes per guild + perm)
const ownerDmCooldowns = new Map<string, number>();

/**
 * Friendly display names for common Discord permissions
 */
export const PERMISSION_NAMES: Record<string, string> = {
  ManageRoles: "Manage Roles",
  ManageChannels: "Manage Channels",
  BanMembers: "Ban Members",
  KickMembers: "Kick Members",
  ModerateMembers: "Timeout / Moderate Members",
  Administrator: "Administrator",
  ManageGuild: "Manage Server",
  ViewAuditLog: "View Audit Log",
  ManageMessages: "Manage Messages",
  ManageNicknames: "Manage Nicknames",
  ManageWebhooks: "Manage Webhooks",
  ManageEmojisAndStickers: "Manage Emojis & Stickers",
  ManageGuildExpressions: "Manage Expressions",
  SendMessages: "Send Messages",
  EmbedLinks: "Embed Links",
  AttachFiles: "Attach Files",
  ReadMessageHistory: "Read Message History",
  Connect: "Connect to Voice",
  Speak: "Speak in Voice",
  MoveMembers: "Move Members in Voice",
  MuteMembers: "Mute Members in Voice",
  DeafenMembers: "Deafen Members in Voice",
};

/**
 * Builds the interactive buttons allowing the Server Owner to update bot permissions or seek support
 */
export function buildOwnerPermissionActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Grant Permissions / Re-authorize")
      .setURL(BOT_INVITE_URL),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Official Support Server")
      .setURL(SUPPORT_SERVER_URL),
  );
}

/**
 * Generates an embed requesting the Server Owner to grant the required Discord permissions
 */
export function buildOwnerPermissionEmbed(
  guild: Guild,
  requiredPerms: string[] | string,
  actionContext?: string,
) {
  const permList = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
  const formattedPerms = permList
    .map((p) => `• ${CE.settings.str} **${PERMISSION_NAMES[p] || p}**`)
    .join("\n");

  const ownerMention = guild.ownerId ? `<@${guild.ownerId}>` : "Server Owner";

  return prettyEmbed({
    title: `${CE.warning.str} Bot Permission Required • Action for Server Owner`,
    description:
      `### Attention ${ownerMention} (Server Owner)\n` +
      `Zenith Bot was requested to execute **${actionContext || "a server action"}** in **${guild.name}**, but is currently missing required Discord permissions.\n\n` +
      `**Required Discord Permission(s):**\n` +
      `${formattedPerms}\n\n` +
      `### ${CE.admin.str} How to resolve:\n` +
      `1. Open **Server Settings** > **Roles** in **${guild.name}**.\n` +
      `2. Select the **Zenith Bot** role.\n` +
      `3. Enable the required permission(s) above (or grant **Administrator**).\n` +
      `4. Ensure the **Zenith Bot** role is placed **above** the roles/members it manages in the role hierarchy.\n\n` +
      `*Click the button below to re-authorize the bot with full administrator permissions.*`,
    color: COLORS.warning,
    footer: `${guild.name} • Server Owner Permission Request`,
  });
}

/**
 * Direct messages the server owner to notify them that the bot requires a permission to execute actions
 */
export async function notifyOwnerMissingPermission(
  guild: Guild,
  requiredPerms: string[] | string,
  actionContext?: string,
): Promise<boolean> {
  if (!guild || !guild.ownerId) return false;

  const permKey = `${guild.id}:${Array.isArray(requiredPerms) ? requiredPerms.sort().join(",") : requiredPerms}`;
  const now = Date.now();
  const lastSent = ownerDmCooldowns.get(permKey) || 0;

  // 15-minute cooldown per permission per server to prevent spamming the owner
  if (now - lastSent < 15 * 60 * 1000) {
    return false;
  }

  ownerDmCooldowns.set(permKey, now);

  try {
    const ownerMember = await guild.members.fetch(guild.ownerId).catch(() => null);
    if (!ownerMember) return false;

    const embed = buildOwnerPermissionEmbed(guild, requiredPerms, actionContext);
    const row = buildOwnerPermissionActionRow();

    await ownerMember.send({
      content: `${CE.warning.str} **Action Required in your server: ${guild.name}**`,
      embeds: [embed],
      components: [row as any],
    });
    return true;
  } catch (err) {
    logger.debug({ err, guildId: guild.id, ownerId: guild.ownerId }, "Could not DM server owner regarding missing permissions");
    return false;
  }
}

/**
 * Checks if the bot possesses the given permissions in the guild, and if not, responds asking the server owner
 */
export async function ensureBotPermissions(
  context: ChatInputCommandInteraction | Message,
  requiredPerms: PermissionResolvable[],
  permDisplayNames: string[] | string,
  actionContext?: string,
): Promise<boolean> {
  const guild = context.guild;
  if (!guild) return true;

  const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!botMember) return false;

  const missing: string[] = [];
  const displayList = Array.isArray(permDisplayNames) ? permDisplayNames : [permDisplayNames];

  for (let i = 0; i < requiredPerms.length; i++) {
    const perm = requiredPerms[i];
    if (!botMember.permissions.has(perm)) {
      missing.push(displayList[i] || String(perm));
    }
  }

  if (missing.length === 0) {
    return true;
  }

  // Missing permissions detected — notify owner & respond in channel
  notifyOwnerMissingPermission(guild, missing, actionContext).catch(() => {});

  const embed = buildOwnerPermissionEmbed(guild, missing, actionContext);
  const row = buildOwnerPermissionActionRow();

  if ("isChatInputCommand" in context && typeof (context as any).isChatInputCommand === "function") {
    const interaction = context as ChatInputCommandInteraction;
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [embed], components: [row as any] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], components: [row as any] }).catch(() => {});
    }
  } else {
    const msg = context as Message;
    await msg.reply({ embeds: [embed], components: [row as any] }).catch(async () => {
      await (msg.channel as GuildTextBasedChannel).send({ embeds: [embed], components: [row as any] }).catch(() => {});
    });
  }

  return false;
}
