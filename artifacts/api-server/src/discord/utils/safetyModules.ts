import { Client, Message, Guild, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";
import { CE, COLORS, prettyEmbed } from "./embedStyle";
import { getAutomodConfig } from "../storage/automod";
import { scanTextWithGemini, scanMediaWithGemini } from "./geminiModerator";

/**
 * Anti-Scam: Detects malicious links using AI and pattern matching
 */
export async function runAntiScamCheck(message: Message, content: string): Promise<boolean> {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|net|org|io|gg|co|xyz|info|biz|ru|cn|top)(\/[^\s]*)?)/gi;
  const urls = content.match(urlRegex) ?? [];
  if (urls.length === 0) return false;

  const { scanScamDomains } = await import("./geminiModerator");
  const domains = urls.map(url => {
    try {
      return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return url.toLowerCase().replace(/https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]!;
    }
  });

  const am = await getAutomodConfig(message.guildId!);
  
  // 1. Check server-specific scam domains
  const serverScamDomains = am.links.scamDomains || [];
  for (const domain of domains) {
    if (serverScamDomains.includes(domain)) {
      await flagAutomodViolation(message, "Server-Blocked Scam Domain", `The domain \`${domain}\` is explicitly blocked by this server's administrators.`);
      return true;
    }
  }

  // 2. AI Internet Scan (if enabled)
  if (am.links.scanInternet) {
    const { scanScamDomains } = await import("./geminiModerator");
    const aiResult = await scanScamDomains(domains);
    if (aiResult?.flagged && aiResult.confidence >= 75) {
      await flagAutomodViolation(message, "AI Verified Scam/Malicious Link", aiResult.reason);
      return true;
    }
  }

  return false;
}

/**
 * Anti-NSFW: Detects explicit content in text, images, stickers
 */
export async function runAntiNsfwCheck(message: Message, content: string): Promise<boolean> {
  // 1. Check text with Gemini
  if (content.trim().length > 0) {
    const aiResult = await scanTextWithGemini(content, ["nsfw", "explicit", "csam"]);
    if (aiResult?.flagged && aiResult.confidence >= 80) {
      // CSAM detection: immediate escalation
      if (aiResult.category === "csam" || aiResult.reason.toLowerCase().includes("child")) {
        await flagAutomodViolation(message, "ILLEGAL CONTENT DETECTED (CSAM)", aiResult.reason, "ban");
        return true;
      }
      
      const isNsfwChannel = (message.channel as any).nsfw;
      if (!isNsfwChannel) {
        await flagAutomodViolation(message, `NSFW Content Detected (${aiResult.category})`, aiResult.reason);
        return true;
      }
    }
  }

  // 2. Check attachments
  if (message.attachments.size > 0 || message.stickers.size > 0) {
    const isNsfwChannel = (message.channel as any).nsfw;
    if (!isNsfwChannel) {
      const itemsToScan: { url: string; mimeType: string }[] = [];
      
      for (const att of message.attachments.values()) {
        if (att.contentType?.startsWith("image/") || att.contentType?.startsWith("video/")) {
          itemsToScan.push({ url: att.proxyURL, mimeType: att.contentType });
        }
      }
      
      for (const sticker of message.stickers.values()) {
        itemsToScan.push({ url: sticker.url, mimeType: "image/png" });
      }

      for (const item of itemsToScan) {
        const result = await scanMediaWithGemini(item.url, item.mimeType);
        if (result?.flagged && result.confidence >= 75) {
          if (result.category === "illegal" || result.reason.toLowerCase().includes("child")) {
             await flagAutomodViolation(message, "ILLEGAL MEDIA DETECTED (CSAM)", result.reason, "ban");
             return true;
          }
          await flagAutomodViolation(message, `NSFW Media Detected (${result.category})`, result.reason);
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Common handler for automod violations
 */
async function flagAutomodViolation(message: Message, reason: string, detail: string, forceAction?: "delete" | "warn" | "mute" | "kick" | "ban") {
  const am = await getAutomodConfig(message.guildId!);
  const member = message.member!;
  const action = forceAction || am.aiAutomod.action || "delete";
  const muteDuration = am.aiAutomod.muteDurationMinutes || 10;

  // Log violation
  logger.info({ guildId: message.guildId, userId: member.id, reason, detail, action }, "Automod Safety Violation");

  // Send DM
  const dmEmbed = new EmbedBuilder()
    .setTitle(`${CE.automod.str} Safety Violation`)
    .setColor(0xed4245)
    .setDescription(`Our AI safety systems detected a violation in **${message.guild?.name}**.`)
    .addFields(
      { name: "Violation", value: reason, inline: true },
      { name: "Detail", value: detail.slice(0, 500), inline: true },
      { name: "Action Taken", value: action.toUpperCase(), inline: true }
    )
    .setTimestamp();
  await message.author.send({ embeds: [dmEmbed] }).catch(() => null);

  // Delete message
  await message.delete().catch(() => {});

  // Execute action
  try {
    if (action === "warn") {
      await (message.channel as any).send({ content: `${CE.warning.str} ${member} — **Safety Warning**: ${reason}` })
        .then((m: any) => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
    } else if (action === "mute") {
      await member.timeout(muteDuration * 60_000, `Safety: ${reason}`).catch(() => {});
    } else if (action === "kick") {
      await member.kick(`Safety: ${reason}`).catch(() => {});
    } else if (action === "ban") {
      await member.ban({ reason: `Safety: ${reason}` }).catch(() => {});
    }
  } catch (err) {
    logger.warn({ err }, "Failed to execute automod safety action");
  }

  // Log to channel
  if (am.logChannelId) {
    const logCh = message.guild?.channels.cache.get(am.logChannelId) as any;
    if (logCh?.send) {
      const logEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`${CE.automod.str} Safety Filter Triggered`)
        .addFields(
          { name: "User", value: `${member} (${member.id})`, inline: true },
          { name: "Action", value: action, inline: true },
          { name: "Reason", value: reason, inline: true },
          { name: "Detail", value: detail.slice(0, 500), inline: false },
          { name: "Channel", value: `<#${message.channelId}>`, inline: true }
        )
        .setTimestamp();
      await logCh.send({ embeds: [logEmbed] }).catch(() => {});
    }
  }
}
