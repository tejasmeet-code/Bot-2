import { logger } from "../../lib/logger";
import { CE } from "./embedStyle";
import type { User, MessageCreateOptions, MessagePayload } from "discord.js";

/**
 * Post a DM log entry to the MESSAGE_LOGS Discord webhook (if configured).
 *
 *   direction "in"  = a user sent a DM to the bot
 *   direction "out" = the bot sent a DM to a user (success or failure)
 */
export async function logDmToWebhook(opts: {
  direction: "in" | "out";
  userId: string;
  username: string;
  content: string;
  attachments?: string[];
  status?: "delivered" | "failed" | "received";
  errorReason?: string;
  context?: string;
}): Promise<void> {
  const webhookUrl = process.env.MESSAGE_LOGS;
  if (!webhookUrl) return;

  const isDelivered = opts.status === "delivered" || (!opts.status && opts.direction === "out");
  const isFailed = opts.status === "failed";
  const isIncoming = opts.direction === "in";

  let statusBadge = "";
  if (isIncoming) {
    statusBadge = `${CE.incoming.str} **Received DM**`;
  } else if (isDelivered) {
    statusBadge = `${CE.success.str} **Delivered (Success)**`;
  } else if (isFailed) {
    statusBadge = `${CE.failure.str} **Delivery Failed (DMs Closed / Blocked)**`;
  }

  const arrow = opts.direction === "in" ? CE.incoming.str : CE.outgoing.str;
  const label = opts.direction === "in" ? "User → Bot" : "Bot → User";

  const lines: string[] = [
    `**${arrow} DM System Log | ${label}** • ${statusBadge}`,
    `**User:** <@${opts.userId}> (\`${opts.username}\` • \`${opts.userId}\`)`,
  ];

  if (opts.context) {
    lines.push(`**Context / Trigger:** \`${opts.context}\``);
  }

  if (isFailed && opts.errorReason) {
    lines.push(`**Failure Cause:** \`${opts.errorReason}\``);
  }

  lines.push(`**Message Preview:**\n>>> ${opts.content || "*(Embed content or attachment)*"}`);

  if (opts.attachments?.length) {
    lines.push(`**Attachments:** ${opts.attachments.join("  ")}`);
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: lines.join("\n"),
        username: "Zenith DM Audit Sentinel",
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "MESSAGE_LOGS webhook post failed");
    }
  } catch (err) {
    logger.warn({ err }, "MESSAGE_LOGS webhook post error");
  }
}

/**
 * Safely send a DM to a user and automatically log both successful and
 * unsuccessful attempts to the MESSAGE_LOGS webhook.
 */
export async function safeSendUserDm(
  user: User | { id: string; username?: string; send: (p: any) => Promise<any> },
  payload: string | MessageCreateOptions | MessagePayload | any,
  context?: string,
): Promise<{ success: boolean; message?: any; error?: any }> {
  const username = (user as any).username || (user as any).tag || `User-${user.id}`;
  const userId = user.id;

  let textContent = "";
  if (typeof payload === "string") {
    textContent = payload;
  } else if (payload.content) {
    textContent = payload.content;
  } else if (payload.embeds && Array.isArray(payload.embeds) && payload.embeds.length > 0) {
    const firstEmbed = payload.embeds[0];
    const title = firstEmbed.data?.title || firstEmbed.title || "";
    const desc = firstEmbed.data?.description || firstEmbed.description || "";
    textContent = `[Embed: ${title}]\n${desc}`.slice(0, 800);
  }

  try {
    const sent = await (user as any).send(payload);
    // Log successful outgoing DM
    logDmToWebhook({
      direction: "out",
      userId,
      username,
      content: textContent,
      status: "delivered",
      context,
    }).catch(() => {});

    return { success: true, message: sent };
  } catch (err: any) {
    const errMsg = err?.message || "DiscordAPIError: Cannot send messages to this user";
    logger.warn({ err, userId, username, context }, "safeSendUserDm: Failed to deliver DM to user");

    // Log unsuccessful outgoing DM to webhook
    logDmToWebhook({
      direction: "out",
      userId,
      username,
      content: textContent,
      status: "failed",
      errorReason: errMsg,
      context,
    }).catch(() => {});

    return { success: false, error: err };
  }
}
