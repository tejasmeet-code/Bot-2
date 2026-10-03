import { ChannelType, PermissionFlagsBits, type GuildTextBasedChannel, type Message } from "discord.js";
import { getAFK, removeAFK } from "../storage/afk";
import { getGuildConfig, isSetupUnlocked } from "../storage/config";
import { hasPremiumAccess, isBotAdmin, isPermanentOwner } from "../storage/premium";
import { isNoPrefixEnabled } from "../storage/profile";
import { isBotStaff } from "../storage/botStaff";
import { getCommandMap } from "../registry";
import { handleGenericPrefixCommand } from "../messageHandler";
import { resolveCommandAndArgs, buildCommandInfoEmbed } from "./commandAliases";
import { CE } from "./embedStyle";
import { logger } from "../../lib/logger";

export async function handleAFKMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  // 1. If author was AFK, clear their AFK status
  const authorAfk = await getAFK(message.author.id);
  if (authorAfk) {
    if (authorAfk.scope === "global" || authorAfk.guildId === message.guildId) {
      await removeAFK(message.author.id);
      await message.reply({
        content: `${CE.success.str} Welcome back ${message.author}! I removed your AFK status (**Reason:** ${authorAfk.reason}).`,
      }).catch(() => {});
    }
  }

  // 2. Intercept pings to AFK users
  if (message.mentions.users.size > 0) {
    for (const [userId, user] of message.mentions.users.entries()) {
      if (userId === message.author.id) continue;
      const afk = await getAFK(userId);
      if (afk && (afk.scope === "global" || afk.guildId === message.guildId)) {
        await message.reply({
          content: `ℹ️ **${user.tag}** is currently AFK (${afk.scope === "global" ? "Global" : "Server-Only"}): \`${afk.reason}\` (since <t:${afk.timestamp}:R>)`,
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }
    }
  }
}

export async function handleAutoReactMessage(message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;

  try {
    // 1. Process Global Auto-React (Configured by Bot Owner & Co-Owner)
    try {
      const { getGlobalAutoReactStore } = await import("../storage/globalAutoReact");
      const globalStore = await getGlobalAutoReactStore();
      if (globalStore.enabled && globalStore.rules.length > 0) {
        for (const rule of globalStore.rules) {
          if (!rule.enabled) continue;
          let shouldReact = false;

          if (rule.targetType === "user" && message.author.id === rule.target) {
            shouldReact = true;
          } else if (
            rule.targetType === "channel" &&
            (message.channelId === rule.target ||
              (message.channel && "name" in message.channel && message.channel.name.toLowerCase() === rule.target.toLowerCase()))
          ) {
            shouldReact = true;
          } else if (rule.targetType === "role" && message.member?.roles?.cache?.has(rule.target)) {
            shouldReact = true;
          } else if (rule.targetType === "word") {
            const msgLower = (message.content || "").toLowerCase();
            const targetLower = rule.target.toLowerCase();
            if (msgLower.includes(targetLower)) {
              shouldReact = true;
            }
          }

          if (shouldReact) {
            const customMatch = rule.emoji.match(/<a?:(\w+):(\d+)>/);
            const reactionEmoji = customMatch ? customMatch[2] : rule.emoji;
            await message.react(reactionEmoji).catch(() => {});
          }
        }
      }
    } catch (globalErr) {
      logger.warn({ err: globalErr }, "Error evaluating global auto-reactions");
    }

    // 2. Process Local Guild Auto-React
    const cfg = await getGuildConfig(message.guildId);
    const mappings = cfg.autoReactMappings || [];
    if (mappings.length === 0) return;

    for (const m of mappings) {
      let shouldReact = false;
      if (m.targetType === "channel" && message.channelId === m.targetId) {
        shouldReact = true;
      } else if (m.targetType === "user" && message.author.id === m.targetId) {
        shouldReact = true;
      } else if (m.targetType === "category" && message.channel && (message.channel as any).parentId === m.targetId) {
        shouldReact = true;
      } else if (m.targetType === "role" && message.member?.roles?.cache?.has(m.targetId)) {
        shouldReact = true;
      } else if (m.targetType === "word") {
        const msgLower = (message.content || "").toLowerCase();
        const targetLower = m.targetId.toLowerCase();
        if (msgLower.includes(targetLower)) {
          shouldReact = true;
        }
      }

      if (shouldReact) {
        const customMatch = m.emoji.match(/<a?:(\w+):(\d+)>/);
        const reactionEmoji = customMatch ? customMatch[2] : m.emoji;
        await message.react(reactionEmoji).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in auto-react message interceptor");
  }
}

export async function handleNoPrefixNLPMessage(message: Message): Promise<boolean> {
  if (message.author.bot || !message.inGuild() || !message.guild) return false;

  // Deduplication check: if message was already handled by prefix router, do NOT re-run
  const { isMessageRecentlyProcessed } = await import("../messageHandler");
  if (isMessageRecentlyProcessed(message.id)) {
    return false;
  }

  const content = message.content.trim();
  if (!content) return false;

  const cfg = await getGuildConfig(message.guildId);
  const prefix = cfg.guildPrefix || ".";

  // Ignore if message starts with any standard prefix, slash, bp?, nk, or bot mention
  const lower = content.toLowerCase();
  const prefixes = [prefix, ".", "!", "?", ",", "/", "bp?", "nk.", "nk "];
  if (message.client.user) {
    prefixes.push(`<@${message.client.user.id}>`, `<@!${message.client.user.id}>`);
  }
  if (prefixes.some((p) => lower.startsWith(p.toLowerCase()))) {
    return false;
  }

  // Check noPrefix module setting
  const noPrefixModuleEnabled = cfg.modules.noPrefix !== false;

  // Permissions: Server Administrator or Guild Owner or Premium or Whitelisted Role/User or Bot Admin or User NoPrefix Mode
  const isOwner = message.guild.ownerId === message.author.id;
  const isServerAdmin =
    !!message.member &&
    typeof message.member.permissions !== "string" &&
    message.member.permissions.has(PermissionFlagsBits.Administrator);
  const isPremium = await hasPremiumAccess(message.author.id, message.guildId, message.member);
  const isWhitelistedUser = (cfg.noPrefixUserIds ?? []).includes(message.author.id);
  const exemptRoles = [...(cfg.noPrefixRoles ?? []), ...(cfg.moduleRoles?.noPrefix ?? [])];
  const isWhitelistedRole = message.member && exemptRoles.some((r) => message.member!.roles.cache.has(r));
  const isAdminUser = isBotAdmin(message.author.id);
  const userNoPrefixActive = await isNoPrefixEnabled(message.author.id, message.guildId);

  if (!noPrefixModuleEnabled && !userNoPrefixActive && !isOwner && !isServerAdmin && !isPremium && !isWhitelistedUser && !isWhitelistedRole && !isAdminUser) {
    return false;
  }

  const tokens = content.split(/\s+/);
  const firstWord = (tokens[0] || "").toLowerCase();
  const rawArgs = tokens.slice(1);

  // Resolve aliases (e.g. an -> antinuke, p -> play, st -> setup, etc.) and info flag
  const { canonicalName, resolvedArgs, isInfo } = resolveCommandAndArgs(firstWord, rawArgs);

  const commandMap = getCommandMap();
  let matchedCommand = canonicalName ? commandMap.get(canonicalName) : undefined;

  // Only allow exact word-boundary matches (no fuzzy startsWith substring matches) to eliminate duplicate/unwanted execution
  if (!matchedCommand) return false;

  // Handle command info request (e.g. `play -info`, `an -info`) — NEVER run the command
  const { isInfoFlag } = await import("./commandAliases");
  if (isInfo || rawArgs.some(isInfoFlag)) {
    const infoEmbed = buildCommandInfoEmbed(matchedCommand, canonicalName || matchedCommand.data.name);
    await (message.channel as GuildTextBasedChannel).send({ embeds: [infoEmbed] }).catch(() => {});
    return true;
  }

  try {
    await handleGenericPrefixCommand(message, message.guild, message.member, matchedCommand, resolvedArgs);
    return true;
  } catch (err) {
    logger.error({ err, commandName: matchedCommand.data.name }, "Error executing NLP No-Prefix command");
    return false;
  }
}
