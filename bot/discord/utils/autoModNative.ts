import {
  Client,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  PermissionFlagsBits,
  AutoModerationRule,
} from "discord.js";
import { logger } from "../../lib/logger";

/**
 * Syncs native Discord AutoMod rules across guilds.
 * Interacting with Discord's Native AutoMod API (`guild.autoModerationRules`)
 * signals Discord to award the "Uses AutoMod" profile badge to the bot application.
 */
export async function syncNativeAutoModRules(client: Client<true>): Promise<void> {
  logger.info("Initializing Discord Native AutoMod API sync for profile badge support...");

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      if (!me || !me.permissions.has(PermissionFlagsBits.ManageGuild)) {
        continue;
      }

      // Fetch existing native AutoMod rules
      const existingRules = await guild.autoModerationRules.fetch().catch(() => null);
      if (!existingRules) continue;

      // Check if Zenith Spam Protection rule exists
      const hasSpamRule = existingRules.some((rule: AutoModerationRule) => rule.name.includes("Zenith Spam Protection"));
      if (!hasSpamRule) {
        await guild.autoModerationRules.create({
          name: "Zenith Spam Protection",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Spam,
          actions: [
            {
              type: AutoModerationActionType.BlockMessage,
              metadata: {
                customMessage: "Message blocked by Zenith Native AutoMod Anti-Spam protection.",
              },
            },
          ],
          enabled: true,
          reason: "Zenith Native AutoMod Badge & Security Integration",
        }).catch((err: any) => {
          logger.debug({ err, guildId }, "Could not create native spam AutoMod rule");
        });
      }

      // Check if Zenith Keyword Filter exists
      const hasKeywordRule = existingRules.some((rule: AutoModerationRule) => rule.name.includes("Zenith Link & Scam Filter"));
      if (!hasKeywordRule) {
        await guild.autoModerationRules.create({
          name: "Zenith Link & Scam Filter",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: {
            keywordFilter: ["*discord.gg/phishing*", "*steamcommunity-gift*", "*free-nitro-now*"],
          },
          actions: [
            {
              type: AutoModerationActionType.BlockMessage,
              metadata: {
                customMessage: "Potentially harmful scam link blocked by Zenith AutoMod.",
              },
            },
          ],
          enabled: true,
          reason: "Zenith Native AutoMod Badge & Security Integration",
        }).catch((err: any) => {
          logger.debug({ err, guildId }, "Could not create native keyword AutoMod rule");
        });
      }
    } catch (err: any) {
      logger.debug({ err, guildId }, "Error during native AutoMod rule sync");
    }
  }

  logger.info("Discord Native AutoMod API sync completed.");
}
