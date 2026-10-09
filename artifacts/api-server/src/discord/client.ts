import { Client, Events, ChannelType, Partials, type GuildTextBasedChannel, type ButtonInteraction, AuditLogEvent, IntentsBitField, REST, Routes, PermissionFlagsBits, ActivityType } from "discord.js";
import { takeBackup, startAutoBackupScheduler } from "./storage/serverBackup";
import { cancelGuildDeletion } from "./storage/guildRetention";
import { ensureJailRole } from "./storage/jail";
import { registerGuildCommands } from "./registry/registerGuildCommands";
import { incrementGuildCount } from "./storage/guild-counter";
import { sendWebhookList, logCommandExecution } from "./utils/webhooks";
import { CE, setCachedBotName } from "./utils/embedStyle";
import { logger } from "../lib/logger";
import { getCommands, getCommandMap, getGuildCommands } from "./registry";
import { handlePrefixMessage, isMessageRecentlyProcessed } from "./messageHandler";
import { isServerBlacklisted } from "./storage/blacklist";
import { getGuildConfig } from "./storage/config";
import { listStaffRoles } from "./storage/staff";
import { bumpMessage } from "./storage/quota";

import { getTicketsConfig, createOpenTicket, closeOpenTicket, claimTicket, getOpenTicketsByUser, getOpenTicketByChannel, getNextTicketNumber } from "./storage/tickets";
import { getAutomodConfig, recordSpam, recordDuplicate } from "./storage/automod";
import { containsProhibitedLanguage } from "./utils/profanityDetector";
import { getActiveGiveaways, updateGiveaway } from "./storage/giveaways";
import { logDmToWebhook } from "./utils/dmWebhook";
import { initPermWhitelist } from "./storage/whitelist";
import {
  recordGatewayConnect,
  recordGatewayDisconnect,
  recordGatewayReconnect,
  recordInvalidSession,
  recordWsPing,
} from "./storage/gatewayHealth";

export function getDiscordClient(): Client {
  return (globalThis as any).__discordClient;
}

import fs from "fs";

const BOT_PID_LOCK_FILE = "/tmp/zenith_bot.pid";

function acquireBotProcessLock(): boolean {
  try {
    if ((globalThis as any).__discordClient?.isReady()) {
      logger.warn("Discord client is already ready in this process instance. Skipping duplicate initialization.");
      return false;
    }
    if (fs.existsSync(BOT_PID_LOCK_FILE)) {
      const rawPid = fs.readFileSync(BOT_PID_LOCK_FILE, "utf8").trim();
      const existingPid = parseInt(rawPid, 10);
      if (!isNaN(existingPid) && existingPid !== process.pid) {
        try {
          // Signal 0 checks if the PID is currently running
          process.kill(existingPid, 0);
          // If the lock file was created more than 2 minutes ago, assume stale container lock
          const stats = fs.statSync(BOT_PID_LOCK_FILE);
          const ageMs = Date.now() - stats.mtimeMs;
          if (ageMs > 120000) {
            logger.info({ existingPid, ageMs }, "Cleaning up stale bot PID lock file.");
            fs.unlinkSync(BOT_PID_LOCK_FILE);
          } else {
            logger.warn({ existingPid, currentPid: process.pid }, "Another active bot process detected. Overriding stale lock for gateway connection.");
          }
        } catch {
          // Stale PID lock, safe to claim
        }
      }
    }
    fs.writeFileSync(BOT_PID_LOCK_FILE, String(process.pid), "utf8");
    return true;
  } catch {
    return true;
  }
}

let isBotStartingOrStarted = false;

export async function startDiscordBot(): Promise<void> {
  console.log("[boot] startDiscordBot called");
  if (!acquireBotProcessLock()) {
    return;
  }

  if (isBotStartingOrStarted && (globalThis as any).__discordClient?.isReady()) {
    logger.warn("startDiscordBot called but Discord bot is already started and ready. Skipping duplicate start.");
    return;
  }

  // Destroy previous client if present
  if ((globalThis as any).__discordClient) {
    try {
      (globalThis as any).__discordClient.destroy();
    } catch {}
    (globalThis as any).__discordClient = null;
  }

  isBotStartingOrStarted = true;

  try {
    console.log("[boot] importing and loading devServerEmojiSync");
    const { loadSavedCustomEmojis } = await import("./utils/devServerEmojiSync");
    loadSavedCustomEmojis();
    console.log("[boot] calling initPermWhitelist");
    await initPermWhitelist();
    console.log("[boot] completed initPermWhitelist");

    const token = process.env.DISCORD_BOT_TOKEN?.trim();
    const clientId = process.env.DISCORD_CLIENT_ID?.trim();
    if (!token) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is not set");
    }
    if (!clientId) {
      throw new Error("DISCORD_CLIENT_ID environment variable is not set");
    }

    // ── Audio Stability: Initialize libsodium-wrappers ───────────────────────
    try {
      const libsodium = await import("libsodium-wrappers");
      await libsodium.default.ready;
      logger.info("libsodium-wrappers initialized for secure voice processing");
    } catch (err) {
      logger.warn({ err }, "Could not initialize libsodium-wrappers — audio may be unstable or non-functional");
    }

    console.log("[boot] Creating Discord.js Client...");
    const client = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildModeration,
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    client.on(Events.Debug, (info) => {
      console.log(`[discord-debug] ${info}`);
    });

    client.on(Events.Warn, (info) => {
      console.warn(`[discord-warn] ${info}`);
    });

    client.on(Events.Error, (err) => {
      console.error(`[discord-error] ${err.message}`);
    });

    (globalThis as any).__discordClient = client;

    console.log("[boot] Setting up REST...");
    const rest = new REST({ version: "10" }).setToken(token);
    
    console.log("[boot] Skipping module cache warm-up to conserve memory...");

    console.log("[boot] Skipping REST token validation to speed up boot...");

    console.log("[boot] Fetching registrableCommands...");
    const registrableCommands = getGuildCommands();
    console.log("[boot] Mapping commands to JSON...");
    const commandPayload = registrableCommands.map((c) => c.data.toJSON());

    console.log("[boot] Starting auto-backup scheduler...");
    startAutoBackupScheduler();
    console.log("[boot] Getting command map...");
    const commandMap = getCommandMap();

    client.once(Events.ClientReady, async (readyClient: Client<true>) => {
      console.log(`[boot] Client READY! Logged in as ${readyClient.user.tag}`);
      recordGatewayConnect();
      setCachedBotName(readyClient.user.username);
      logger.info({ tag: readyClient.user.tag, instanceId: process.env.INSTANCE_ID }, "Discord bot ready");

      // Print event listener count
      const events = Object.keys((readyClient as any)._events || {});
      const counts = events.map(e => `${e}: ${readyClient.listenerCount(e)}`).join(", ");
      logger.info({ counts, instanceId: process.env.INSTANCE_ID }, `[EVENT LISTENERS] Active listeners count at startup`);

      // ── Shard / Gateway Events Logging ──
      readyClient.on(Events.ShardReady, (shardId) => {
        logger.info({ instanceId: process.env.INSTANCE_ID, shardId }, `[GATEWAY EVENT] Shard ready`);
      });
      readyClient.on(Events.ShardResume, (shardId, replayedEvents) => {
        recordGatewayReconnect();
        logger.info({ instanceId: process.env.INSTANCE_ID, shardId, replayedEvents }, `[GATEWAY EVENT] Shard resumed`);
      });
      readyClient.on(Events.ShardDisconnect, (event, shardId) => {
        recordGatewayDisconnect();
        logger.warn({ instanceId: process.env.INSTANCE_ID, shardId, code: event.code, reason: event.reason }, `[GATEWAY EVENT] Shard disconnected`);
      });
      readyClient.on(Events.ShardReconnecting, (shardId) => {
        logger.info({ instanceId: process.env.INSTANCE_ID, shardId }, `[GATEWAY EVENT] Shard reconnecting`);
      });
      readyClient.on(Events.Invalidated, () => {
        recordInvalidSession();
        logger.error({ instanceId: process.env.INSTANCE_ID }, `[GATEWAY EVENT] Shard session invalidated`);
      });

      // ── Event Loop Lag & Health Snapshot Monitor (Every 30 seconds) ──
      try {
        const { monitorEventLoopDelay } = require("perf_hooks");
        const histogram = monitorEventLoopDelay({ resolution: 10 });
        histogram.enable();

        setInterval(() => {
          const lag = histogram.mean / 1e6; // ns to ms
          histogram.reset();
          const ping = readyClient.ws?.ping ?? -1;
          const memory = process.memoryUsage();
          logger.info({
            instanceId: process.env.INSTANCE_ID,
            pid: process.pid,
            lagMs: lag.toFixed(2),
            pingMs: ping,
            memoryRssMb: (memory.rss / 1024 / 1024).toFixed(2),
            memoryHeapMb: (memory.heapUsed / 1024 / 1024).toFixed(2),
          }, "[HEALTH MONITOR] Performance snapshot");
        }, 30000);
      } catch (err) {
        logger.error({ err }, "Failed to initialize event loop lag performance monitor");
      }


    // ── Update Global Application Description ─────────────────────────────
    try {
      const globalDesc = "Zenith Bot - The ultimate high-performance Discord management, moderation, music, and AI operations system.\n\nEquipped with advanced Anti-Nuke security, 24/7 High-Fidelity Music streaming, AutoMod, and AI Admin capabilities.\n\nSupport Server: https://discord.gg/gFgAfpSYdp\nMade by demonXtejas";
      await readyClient.application.edit({ description: globalDesc });
    } catch (err) {
      logger.warn({ err }, "Could not update bot application description");
    }

    // ── Persistent Bot Status / Mode Restore ─────────────────────────────
    try {
      const { getBotStatusMode, updateOriginalAvatarUrl } = await import("./storage/botStatusState");
      const mode = await getBotStatusMode();
      if (mode !== "normal") {
        logger.info({ mode }, "Restoring locked bot status state from storage...");
        const { executeBotStatusUpdate } = await import("./commands/botstatus");
        await executeBotStatusUpdate(readyClient, mode);
      } else {
        const currentUrl = readyClient.user.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
        if (currentUrl) {
          await updateOriginalAvatarUrl(currentUrl);
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to load/restore persistent bot status on startup");
    }

    // Monitor WebSocket Heartbeat Ping
    setInterval(() => {
      if (readyClient.ws) {
        recordWsPing(Math.round(readyClient.ws.ping));
      }
    }, 15000);

    // ── Permanent Bot Activity (".help | Server Guard") ─────────────────
    const setPermanentActivity = () => {
      try {
        readyClient.user.setPresence({
          activities: [
            {
              name: ".help | Server Guard",
              type: ActivityType.Custom,
              state: ".help | Server Guard",
            },
          ],
          status: "online",
        });
      } catch (err) {
        logger.warn({ err }, "Could not update bot presence activity");
      }
    };
    setPermanentActivity();
    // Re-apply every 15 minutes to guarantee status persistence
    setInterval(setPermanentActivity, 15 * 60 * 1000);

    // Sync per-server branding and register slash commands for all guilds
    const { applyServerPremiumBranding } = await import("./utils/premiumBranding");
    const { registerGuildCommands } = await import("./registry/registerGuildCommands");
    for (const [_, g] of readyClient.guilds.cache) {
      applyServerPremiumBranding(g).catch(() => {});
      registerGuildCommands(readyClient, g.id).catch(() => {});
    }

    // Register global application slash commands
    try {
      const { getGuildCommands } = await import("./registry");
      const registrableCommands = getGuildCommands();
      const commandPayload = registrableCommands.map((c) => c.data.toJSON());
      const token = process.env.DISCORD_BOT_TOKEN;
      const clientId = process.env.DISCORD_CLIENT_ID || readyClient.user.id;
      if (token && clientId) {
        const rest = new REST({ version: "10" }).setToken(token);
        await rest.put(Routes.applicationCommands(clientId), { body: commandPayload }).catch(() => {});
        logger.info(`Registered ${commandPayload.length} global application slash commands`);
      }
    } catch (regErr) {
      logger.warn({ regErr }, "Failed to register global application slash commands");
    }

    // Register full server audit event logger (VC, roles, emojis, stickers, channels, members, messages)
    try {
      const { registerEventLogger } = await import("./services/eventLogger");
      registerEventLogger(readyClient);
    } catch (err) {
      logger.warn({ err }, "Could not register server event logger");
    }

    // ── Auto-restore 24/7 Voice Sessions & Initialize Lavalink across all servers ──────────────
    try {
      const { initLavalink } = await import("./music/lavalinkClient");
      initLavalink(readyClient);

      const { init247Sessions } = await import("./music/musicManager");
      await init247Sessions(readyClient);
    } catch (err) {
      logger.warn({ err }, "Could not initialize music audio sessions");
    }

    // ── Bulk Upload Emojis to God's Eye server ──────────────────────────
    try {
      const { uploadAllEmojisToGodsEye } = await import("./utils/tempEmojiUpload");
      uploadAllEmojisToGodsEye(readyClient).catch((err) => {
        logger.warn({ err }, "Background bulk emoji upload error");
      });
    } catch (err) {
      logger.warn({ err }, "Could not trigger bulk emoji upload");
    }

    // ── Synchronize custom emojis with Relosta Bot Dev Server ───────────
    try {
      const { syncDevServerEmojis } = await import("./utils/devServerEmojiSync");
      syncDevServerEmojis(readyClient).catch((err) => {
        logger.warn({ err }, "Background dev server emoji sync error");
      });
    } catch (err) {
      logger.warn({ err }, "Could not trigger Dev server emoji sync");
    }

    // ── Giveaway auto-end scheduler (check every 60s) ──────────────────────
    setInterval(async () => {
      try {
        const active = await getActiveGiveaways();
        const now = Date.now();
        for (const g of active) {
          if (g.endsAt > now) continue;
          const guild = readyClient.guilds.cache.get(g.guildId);
          if (!guild) continue;
          const channel = guild.channels.cache.get(g.channelId) as any;
          if (!channel?.messages) continue;
          const msg = await channel.messages.fetch(g.messageId).catch(() => null);
          if (!msg) {
            await updateGiveaway(g.giveawayId, (gw) => ({ ...gw, ended: true, winnerIds: [] }));
            continue;
          }
          const reaction = msg.reactions.cache.get(CE.giveaway.id) ?? msg.reactions.cache.first();
          let winners: string[] = [];
          if (reaction) {
            const users = await reaction.users.fetch().catch(() => null);
            if (users) {
              let pool = [...users.values()].filter((u: any) => !u.bot);
              if (g.requiredRoleId) {
                const rm = guild.roles.cache.get(g.requiredRoleId)?.members;
                if (rm) pool = pool.filter((u: any) => rm.has(u.id));
              }
              if (g.bonusRoleId) {
                const bm = guild.roles.cache.get(g.bonusRoleId)?.members;
                const ex = g.bonusEntries ?? 2;
                if (bm) {
                  const exp: typeof pool = [];
                  for (const u of pool) { exp.push(u); if (bm.has(u.id)) for (let x = 1; x < ex; x++) exp.push(u); }
                  pool = exp;
                }
              }
              const seen = new Set<string>();
              for (const u of pool.sort(() => Math.random() - 0.5)) {
                if (seen.has(u.id)) continue;
                seen.add(u.id);
                winners.push(u.id);
                if (winners.length >= g.winnerCount) break;
              }
            }
          }
          const updated = await updateGiveaway(g.giveawayId, (gw) => ({ ...gw, ended: true, winnerIds: winners }));
          if (!updated) continue;
          const { buildGiveawayEmbed } = await import("./commands/giveaway");
          await msg.edit({ embeds: [buildGiveawayEmbed(updated)], components: [] }).catch(() => {});
          await msg.reply(winners.length > 0
            ? `${CE.giveaway.str} Congratulations ${winners.map((id) => `<@${id}>`).join(", ")}! You won **${g.prize}**!`
            : `No valid entries — no winner for **${g.prize}**.`,
          ).catch(() => {});
        }
      } catch (err) {
        logger.warn({ err }, "Giveaway scheduler error");
      }
    }, 60_000);

    // ── Non-blocking background registration of Global Slash Commands & Guild Commands ──
    (async () => {
      try {
        await rest.put(Routes.applicationCommands(clientId), { body: commandPayload });
        logger.info({ commandCount: registrableCommands.length }, "Global application commands registered (Supports Commands badge enabled)");
      } catch (err) {
        logger.warn({ err }, "Could not register global application commands");
      }

      try {
        const { syncNativeAutoModRules } = await import("./utils/autoModNative");
        syncNativeAutoModRules(readyClient).catch((err) => {
          logger.warn({ err }, "Background native AutoMod sync error");
        });
      } catch (err) {
        logger.warn({ err }, "Could not trigger native AutoMod sync");
      }

      const guildIds = [...readyClient.guilds.cache.keys()];
      let guildOk = 0;
      let guildFail = 0;
      const { clearGuildCommands } = await import("./registry/registerGuildCommands");

      for (const guildId of guildIds) {
        try {
          // Clear guild-specific commands to prevent duplication with global commands
          await clearGuildCommands(readyClient, guildId);
          guildOk++;

          const guildObj = readyClient.guilds.cache.get(guildId);
          if (guildObj) {
            const { applyServerPremiumBranding } = await import("./utils/premiumBranding");
            applyServerPremiumBranding(guildObj).catch(() => {});
          }
        } catch (err) {
          guildFail++;
          logger.warn({ err, guildId }, "Failed to clear guild commands or apply branding");
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      logger.info(
        { guildOk, guildFail, total: guildIds.length },
        "Cleared guild-specific commands and updated branding across all servers",
      );
    })().catch((err) => {
      logger.error({ err }, "Error in background command registration queue");
    });

    // Initialize Automated Command Testing & Webhook Bug Diagnostics Daemon (Only if explicitly enabled via ENABLE_AUTO_TESTER=true)
    if (process.env.ENABLE_AUTO_TESTER === "true") {
      setTimeout(async () => {
        try {
          const { startAutoTesterDaemon } = await import("./utils/autoCommandTester");
          startAutoTesterDaemon(readyClient, 30);
        } catch (err) {
          logger.warn({ err }, "Error starting auto tester daemon");
        }
      }, 10000);
    }
  });

  client.on(Events.ShardDisconnect, async (event, shardId) => {
    recordGatewayDisconnect(`Shard ${shardId} disconnected: ${event.reason || "Close Code " + event.code}`);
    logger.warn({ event, shardId }, "Discord Gateway Shard Disconnected — ensuring all voice channels are cleanly vacated");
    try {
      const { disconnectAllVoiceChannels } = await import("./music/musicManager");
      await disconnectAllVoiceChannels(client);
    } catch {}
  });

  const handleProcessShutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down bot process — vacating all voice channels");
    try {
      const { disconnectAllVoiceChannels } = await import("./music/musicManager");
      await disconnectAllVoiceChannels(client);
    } catch {}
    try {
      client.destroy();
    } catch {}
  };

  process.once("SIGINT", () => handleProcessShutdown("SIGINT"));
  process.once("SIGTERM", () => handleProcessShutdown("SIGTERM"));
  process.once("beforeExit", () => handleProcessShutdown("beforeExit"));

  client.on(Events.ShardReconnecting, (shardId) => {
    recordGatewayReconnect();
    logger.info({ shardId }, "Discord Gateway Shard Reconnecting");
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "Discord Client WebSocket Error encountered");
  });

  client.on(Events.Invalidated, async () => {
    recordInvalidSession();
    logger.error("Discord Gateway Session Invalidated — Attempting automatic reconnect in 5s...");
    try {
      client.destroy();
      setTimeout(async () => {
        try {
          logger.info("Re-authenticating Discord Bot with Gateway...");
          await client.login(token);
          logger.info("Bot successfully re-connected to Discord Gateway!");
        } catch (err) {
          logger.error({ err }, "Auto-reconnect login attempt failed");
        }
      }, 5000);
    } catch (err) {
      logger.error({ err }, "Error during auto-reconnect cleanup");
    }
  });

  client.on(Events.GuildCreate, async (guild) => {
    try {
      if (isServerBlacklisted(guild.id)) {
        logger.info({ guildId: guild.id, guildName: guild.name }, "Leaving blacklisted server");
        await guild.leave();
        return;
      }

      cancelGuildDeletion(guild.id).catch(() => {});
      await takeBackup(guild, "join");
      ensureJailRole(guild).catch(() => {});
      const { applyServerPremiumBranding } = await import("./utils/premiumBranding");
      const { clearGuildCommands } = await import("./registry/registerGuildCommands");
      await applyServerPremiumBranding(guild).catch(() => {});
      await clearGuildCommands(client, guild.id).catch(() => {});
      const guildNum = await incrementGuildCount();
      await new Promise((r) => setTimeout(r, 1000));

      const { prettyEmbed, buildSupportRow, CE, COLORS } = await import("./utils/embedStyle");
      const { safeSendUserDm } = await import("./utils/dmWebhook");

      // 1. Fetch Audit Logs for bot inviter
      let inviterId: string | null = null;
      try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
        const entry = logs.entries.find((e) => (e.target as { id?: string } | null)?.id === client.user?.id);
        if (entry?.executor) inviterId = entry.executor.id;
      } catch {}

      // 2. Build Thank You Embed & Support Server Action Row
      const welcomeEmbed = prettyEmbed({
        title: `${CE.star.str} Thank You for Adding Zenith Bot!`,
        description:
          `### Welcome to **${guild.name}**!\n\n` +
          `Thank you for adding **Zenith Bot** to your server. All modules and features are **100% active and ready to use**!\n\n` +
          `• **Commands & Help:** Type \`.help\` or \`/help\` to view the full command list.\n` +
          `• **Quick Configuration:** Type \`.setup\` or \`.wizard\` to configure roles, logging & anti-nuke.\n` +
          `• **Support Server:** Need help or custom setup? Click below to join our official support community!\n\n` +
          `*Server Registered as Guild #${guildNum}*`,
        color: COLORS.primary,
        footer: "Zenith Bot • Type .help to view all commands",
      });

      const supportRow = buildSupportRow("Official Support Server", true);

      // 3. Find First Text Channel in server
      const fetchedChannels = await guild.channels.fetch().catch(() => null);
      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      let firstChannel: any = guild.systemChannel;

      if (fetchedChannels && me) {
        const textChannels = [...fetchedChannels.values()].filter(
          (c: any) => c && c.type === ChannelType.GuildText && c.permissionsFor(me)?.has("SendMessages")
        );
        textChannels.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
        if (textChannels.length > 0) {
          firstChannel = textChannels[0];
        }
      }

      // Send message in first accessible text channel
      if (firstChannel) {
        await firstChannel.send({ embeds: [welcomeEmbed], components: [supportRow as any] }).catch(() => {});
      }

      // 4. Send DM to Server Owner
      if (guild.ownerId) {
        const ownerUser = await client.users.fetch(guild.ownerId).catch(() => null);
        if (ownerUser) {
          await safeSendUserDm(
            ownerUser,
            { embeds: [welcomeEmbed], components: [supportRow as any] },
            `Server Owner Welcome: ${guild.name}`
          ).catch(() => {});
        }
      }

      // 5. Send DM to Person Who Added Bot (if different from Owner)
      if (inviterId && inviterId !== guild.ownerId) {
        const inviterUser = await client.users.fetch(inviterId).catch(() => null);
        if (inviterUser) {
          await safeSendUserDm(
            inviterUser,
            { embeds: [welcomeEmbed], components: [supportRow as any] },
            `Bot Inviter Welcome: ${guild.name}`
          ).catch(() => {});
        }
      }
      } catch (err) {
      logger.warn({ err, guildId: guild.id }, "GuildCreate handling failed");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Handle button and slash command interactions
  // ────────────────────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    if (
      interaction.isRoleSelectMenu() &&
      interaction.customId.startsWith("ref:")
    ) {
      const { handleReferralRoleSelect } = await import("./commands/referral");
      await handleReferralRoleSelect(interaction);
      return;
    }
    if (
      (interaction.isButton() || interaction.isAnySelectMenu()) &&
      interaction.customId.startsWith("wiz:")
    ) {
      const { handleWizardButton, handleWizardSelect } = await import("./commands/setupWizard");
      if (interaction.isButton()) await handleWizardButton(interaction);
      else if (interaction.isAnySelectMenu()) await handleWizardSelect(interaction as any);
      return;
    }
    if (
      interaction.isButton() &&
      (interaction.customId.startsWith("btn:music:") || interaction.customId.startsWith("music:"))
    ) {
      const { handleMusicButton } = await import("./music/musicManager");
      await handleMusicButton(interaction);
      return;
    }
    if (
      interaction.isAnySelectMenu() &&
      (interaction.customId.startsWith("select:music:") || interaction.customId.startsWith("music:"))
    ) {
      const { handleMusicSelectMenu } = await import("./music/musicManager");
      await handleMusicSelectMenu(interaction as any);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith("afk:")) {
      const { handleAfkButton } = await import("./commands/afk");
      await handleAfkButton(interaction);
      return;
    }
    if (
      (interaction.isButton() || interaction.isModalSubmit()) &&
      interaction.customId.startsWith("prem:")
    ) {
      const { handlePremiumInteraction } = await import("./commands/premium");
      await handlePremiumInteraction(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("btn:bsp:")) {
      const { handleBotStaffButton } = await import("./commands/botStaff");
      await handleBotStaffButton(interaction as ButtonInteraction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("btn:bw:")) {
      const { handleBotWhitelistButton } = await import("./commands/botWhitelist");
      await handleBotWhitelistButton(interaction as ButtonInteraction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("btn:gar:")) {
      const { handleGlobalAutoReactButton } = await import("./commands/globalAutoReact");
      await handleGlobalAutoReactButton(interaction as ButtonInteraction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("btn:anwl:")) {
      const { handleAntiNukeWhitelistButton } = await import("./utils/whitelistPanels");
      await handleAntiNukeWhitelistButton(interaction as ButtonInteraction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("btn:amwl:")) {
      const { handleAutomodWhitelistButton } = await import("./utils/whitelistPanels");
      await handleAutomodWhitelistButton(interaction as ButtonInteraction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal:bsp:")) {
      const { handleBotStaffModal } = await import("./commands/botStaff");
      await handleBotStaffModal(interaction as import("discord.js").ModalSubmitInteraction);
      return;
    }

    if (
      (interaction.isMessageComponent() || interaction.isModalSubmit()) &&
      (interaction.customId.startsWith("staff_dir_") ||
        interaction.customId.startsWith("staff_modal_") ||
        interaction.customId.startsWith("staff_portal_"))
    ) {
      const { handlePortalInteraction } = await import("./handlers/portalHandler");
      try {
        await handlePortalInteraction(interaction);
      } catch (err) {
        logger.error({ err }, "Error handling portal interaction");
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("appeal:")) {
        const { handleAppealButton, handleAppealReviewButton } = await import("./utils/appealHandler");
        try {
          if (interaction.customId.startsWith("appeal:dm:")) {
            await handleAppealButton(interaction as ButtonInteraction);
          } else {
            await handleAppealReviewButton(interaction as ButtonInteraction);
          }
        } catch (err) {
          logger.error({ err }, "Error handling appeal button");
          await interaction.reply({ content: "There was an error handling the appeal action.", flags: 1 << 6 }).catch(() => {});
        }
      } else if (interaction.customId === "verify_prompt") {
        const { handleVerifyPromptButton } = await import("./commands/verify");
        try {
          await handleVerifyPromptButton(interaction as ButtonInteraction);
        } catch (err) {
          logger.error({ err }, "Error handling verify prompt button");
          await interaction.reply({ content: "There was an error handling the verify prompt.", flags: 1 << 6 }).catch(() => {});
        }
      } else if (interaction.customId === "verify_authorized" || interaction.customId === "verify_cancel") {
        await interaction.reply({
          content: interaction.customId === "verify_cancel"
            ? "Verification was already cancelled."
            : "This verification session has expired. Please click the verify button again to start a new session.",
          flags: 1 << 6,
        }).catch(() => {});
      } else if (interaction.customId.startsWith("partnership_")) {
        const { handlePartnershipButton } = await import("./commands/partnership");
        try {
          await handlePartnershipButton(interaction as ButtonInteraction);
        } catch (err) {
          logger.error({ err }, "Error handling partnership button");
          await interaction.reply({ content: "There was an error handling the partnership action.", flags: 1 << 6 }).catch(() => {});
        }
      } else if (interaction.customId.startsWith("maintenance:")) {
        const { handleMaintenanceButton } = await import("./commands/maintenance");
        try {
          await handleMaintenanceButton(interaction as ButtonInteraction);
        } catch (err) {
          logger.error({ err }, "Error handling maintenance button");
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Something went wrong with maintenance.", flags: 1 << 6 }).catch(() => {});
          }
        }
      } else if (interaction.customId.startsWith("shop:")) {
        const { handleShopInteraction } = await import("./handlers/shopHandler");
        try {
          await handleShopInteraction(interaction, client);
        } catch (err) {
          logger.error({ err }, "Error handling shop button");
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Something went wrong.", flags: 1 << 6 }).catch(() => {});
          }
        }
      } else if (interaction.customId.startsWith("banreq:")) {
        const { handleBanRequestButton } = await import("./commands/ban-request");
        try {
          await handleBanRequestButton(interaction as ButtonInteraction);
        } catch (err) {
          logger.error({ err }, "Error handling ban-request button");
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Something went wrong.", flags: 1 << 6 }).catch(() => {});
          }
        }
      } else if (interaction.customId.startsWith("bug_approve:") || interaction.customId.startsWith("bug_reject:")) {
        const { handleBugReportButton } = await import("./handlers/bugReportHandler");
        try {
          await handleBugReportButton(interaction as ButtonInteraction);
        } catch (err) {
          logger.error({ err }, "Error handling bug report button interaction");
        }
      } else if (interaction.customId.startsWith("ticket:open:")) {
        // Format: ticket:open:{panelId}:{guildId}
        const parts = interaction.customId.split(":");
        const panelId = parts[2];
        const guildId = parts[3];
        if (!panelId || !guildId || !interaction.guild || !interaction.guildId) {
          await interaction.reply({ content: "Invalid ticket button.", flags: 1 << 6 }).catch(() => {}); return;
        }
        try {
          const tc = await getTicketsConfig(guildId);
          if (!tc.enabled) {
            await interaction.reply({ content: "The ticket system is currently disabled.", flags: 1 << 6 }); return;
          }
          const panel = tc.panels[panelId];
          if (!panel) {
            await interaction.reply({ content: "This ticket panel no longer exists.", flags: 1 << 6 }); return;
          }
          const existing = await getOpenTicketsByUser(guildId, interaction.user.id, panelId);
          if (existing.length > 0) {
            const ch = interaction.guild.channels.cache.get(existing[0]!.channelId);
            await interaction.reply({ content: ch ? `You already have an open ticket: ${ch}` : "You already have an open ticket.", flags: 1 << 6 }); return;
          }

          // If panel has questions, show a modal for the user to answer first
          if (panel.questions && panel.questions.length > 0) {
            const { ModalBuilder, ActionRowBuilder: MARB, TextInputBuilder, TextInputStyle } = await import("discord.js");
            const modal = new ModalBuilder()
              .setCustomId(`ticket:questions:${panelId}:${guildId}`)
              .setTitle(panel.embedTitle?.slice(0, 45) || "Open a Ticket");
            for (const [idx, q] of panel.questions.slice(0, 5).entries()) {
              modal.addComponents(
                (new MARB() as any).addComponents(
                  new TextInputBuilder()
                    .setCustomId(`q${idx}`)
                    .setLabel(q.label.slice(0, 45))
                    .setStyle(q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setRequired(q.required),
                ),
              );
            }
            await interaction.showModal(modal as any);
            return;
          }

          // No questions — defer and create the ticket immediately
          await interaction.deferReply({ ephemeral: true });
          const supportRoleId = panel.supportRoleId ?? tc.supportRoleId;
          const { ChannelType: CT, PermissionFlagsBits: PFB, EmbedBuilder: EB, ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = await import("discord.js");
          const num = await getNextTicketNumber(guildId, panelId);
          const ticketId = `${panel.name}-${String(num).padStart(3, "0")}`;
          const botMe = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
          if (!botMe) {
            await interaction.editReply("Could not resolve my member object — please try again."); return;
          }
          const overwrites: any[] = [
            { id: interaction.guild.id, deny: [PFB.ViewChannel] },
            { id: interaction.user.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] },
            { id: botMe.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ManageChannels, PFB.ReadMessageHistory] },
          ];
          if (supportRoleId) overwrites.push({ id: supportRoleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });
          if (tc.adminRoleId) overwrites.push({ id: tc.adminRoleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });
          const channel = await interaction.guild.channels.create({
            name: ticketId, type: CT.GuildText, parent: panel.categoryId ?? undefined, permissionOverwrites: overwrites, reason: `Ticket by ${interaction.user.tag}`,
          });
          await createOpenTicket({ ticketId, panelId, channelId: channel.id, guildId, userId: interaction.user.id, createdAt: Date.now(), status: "open" });
          const welcomeEmbed = new EB().setTitle(`${CE.ticket.str} ${ticketId}`).setColor(panel.embedColor || 0x2b2d31)
            .setDescription(`Welcome, <@${interaction.user.id}>!\n\nSupport will be with you shortly.`)
            .setFooter({ text: "Use the buttons below to manage this ticket." }).setTimestamp();
          const ticketRow = new ARB().addComponents(
            new BB().setCustomId(`ticket:claim:${channel.id}:${guildId}`).setLabel("Claim").setStyle(BS.Primary).setEmoji({ id: CE.staff.id, name: CE.staff.name }),
            new BB().setCustomId(`ticket:close:${channel.id}:${guildId}`).setLabel("Close Ticket").setStyle(BS.Danger).setEmoji({ id: CE.locked.id, name: CE.locked.name }),
          );
          const ping = supportRoleId ? `<@&${supportRoleId}>` : "";
          await channel.send({ content: `${ping} ${interaction.user}`.trim(), embeds: [welcomeEmbed], components: [ticketRow as any] });
          if (tc.logChannelId) {
            const logCh = interaction.guild.channels.cache.get(tc.logChannelId) as any;
            if (logCh?.send) await logCh.send({ embeds: [new EB().setColor(0x57f287).setTitle("Ticket Opened")
              .addFields({ name: "Ticket", value: `${channel} (\`${ticketId}\`)`, inline: true }, { name: "Opened by", value: `<@${interaction.user.id}>`, inline: true }, { name: "Panel", value: panel.name, inline: true })
              .setTimestamp()] }).catch(() => {});
          }
          await interaction.editReply(`Your ticket has been created: ${channel}`);
        } catch (err) {
          logger.error({ err }, "Error handling ticket:open button");
          if ((interaction as any).deferred || (interaction as any).replied) {
            await (interaction as any).editReply("Failed to create ticket. Check my permissions.").catch(() => {});
          } else {
            await interaction.reply({ content: "Failed to create ticket. Check my permissions.", flags: 1 << 6 }).catch(() => {});
          }
        }
      } else if (interaction.customId.startsWith("ticket:claim:")) {
        // Format: ticket:claim:{channelId}:{guildId}
        const parts = interaction.customId.split(":");
        const channelId = parts[2];
        const guildId = parts[3];
        if (!channelId || !guildId || !interaction.guild || !interaction.guildId) {
          await interaction.reply({ content: "Invalid claim button.", ephemeral: true }).catch(() => {}); return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const tc = await getTicketsConfig(guildId);
          const ticket = await getOpenTicketByChannel(guildId, channelId);
          if (!ticket) {
            await interaction.editReply("This ticket no longer exists."); return;
          }
          if (ticket.claimedBy) {
            await interaction.editReply(`This ticket is already claimed by <@${ticket.claimedBy}>.`); return;
          }
          const member = interaction.member as any;
          const hasSupportRole = tc.supportRoleId && member?.roles?.cache?.has(tc.supportRoleId);
          const hasAdminRole = tc.adminRoleId && member?.roles?.cache?.has(tc.adminRoleId);
          const isAdmin = member?.permissions?.has?.("Administrator");
          const isOwner = interaction.guild.ownerId === interaction.user.id;
          if (!hasSupportRole && !hasAdminRole && !isAdmin && !isOwner) {
            await interaction.editReply("Only support staff can claim tickets."); return;
          }

          const { PermissionFlagsBits: PFB, EmbedBuilder: EB, ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = await import("discord.js");
          const ch = interaction.guild.channels.cache.get(channelId) as any;
          if (!ch) {
            await interaction.editReply("Could not find the ticket channel."); return;
          }

          // Remove the support role's access (so only the claimer + ticket opener + admins can see it)
          if (tc.supportRoleId) {
            await ch.permissionOverwrites.edit(tc.supportRoleId, { ViewChannel: false }).catch(() => {});
          }
          // Grant the claiming staff member exclusive view access
          await ch.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          }).catch(() => {});

          // Update the ticket in storage
          await claimTicket(guildId, channelId, interaction.user.id);

          // Try to update the welcome message: disable the Claim button and show claimed label
          try {
            const messages = await ch.messages.fetch({ limit: 10 }).catch(() => null);
            if (messages) {
              const botMsg = [...messages.values()].find((m: any) => m.author?.id === interaction.client.user?.id && m.components?.length > 0);
              if (botMsg) {
                const updatedRow = new ARB().addComponents(
                  new BB().setCustomId(`ticket:claim:${channelId}:${guildId}`).setLabel(`Claimed by ${interaction.user.username}`).setStyle(BS.Primary).setEmoji({ id: CE.staff.id, name: CE.staff.name }).setDisabled(true),
                  new BB().setCustomId(`ticket:close:${channelId}:${guildId}`).setLabel("Close Ticket").setStyle(BS.Danger).setEmoji({ id: CE.locked.id, name: CE.locked.name }),
                );
                await (botMsg as any).edit({ components: [updatedRow] }).catch(() => {});
              }
            }
          } catch { /* non-critical */ }

          // Announce claim in-channel
          await ch.send({ embeds: [new EB().setColor(0x2b2d31).setDescription(`${CE.staff.str} <@${interaction.user.id}> has **claimed** this ticket and will be handling your request.`).setTimestamp()] }).catch(() => {});

          // Log to log channel
          if (tc.logChannelId) {
            const logCh = interaction.guild.channels.cache.get(tc.logChannelId) as any;
            if (logCh?.send) await logCh.send({ embeds: [new EB().setColor(0x2b2d31).setTitle("Ticket Claimed")
              .addFields(
                { name: "Ticket", value: `${ch} (\`${ticket.ticketId}\`)`, inline: true },
                { name: "Claimed by", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Opened by", value: `<@${ticket.userId}>`, inline: true },
              ).setTimestamp()] }).catch(() => {});
          }

          await interaction.editReply(`You have claimed **${ticket.ticketId}**. Other support staff no longer have access.`);
        } catch (err) {
          logger.error({ err }, "Error handling ticket:claim button");
          await interaction.editReply("Failed to claim ticket.").catch(() => {});
        }
      } else if (interaction.customId.startsWith("ticket:close:")) {
        const parts = interaction.customId.split(":");
        const channelId = parts[2];
        const guildId = parts[3];
        if (!channelId || !guildId || !interaction.guild) {
          await interaction.reply({ content: "Invalid close button.", ephemeral: true }).catch(() => {}); return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const tc = await getTicketsConfig(guildId);
          const ticket = await getOpenTicketByChannel(guildId, channelId);
          const member = interaction.member as any;
          const isOpener = ticket?.userId === interaction.user.id;
          const hasSupportRole = tc.supportRoleId && member?.roles?.cache?.has(tc.supportRoleId);
          const hasAdminRole = tc.adminRoleId && member?.roles?.cache?.has(tc.adminRoleId);
          const isAdmin = member?.permissions?.has?.("Administrator");
          if (!isOpener && !hasSupportRole && !hasAdminRole && !isAdmin) {
            await interaction.editReply("You don't have permission to close this ticket."); return;
          }
          if (tc.transcriptChannelId && ticket) {
            const ch = interaction.guild.channels.cache.get(channelId) as any;
            if (ch) {
              const messages = await ch.messages.fetch({ limit: 100 }).catch(() => null);
              if (messages) {
                const { EmbedBuilder: EB } = await import("discord.js");
                const lines = [...messages.values()].reverse().map((m: any) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || "(no text)"}`);
                const tCh = interaction.guild.channels.cache.get(tc.transcriptChannelId) as any;
                if (tCh?.send) await tCh.send({ embeds: [new EB().setTitle(`${CE.transcript.str} Transcript — ${ticket.ticketId}`).setColor(0x2b2d31)
                  .addFields({ name: "Opened by", value: `<@${ticket.userId}>`, inline: true }, { name: "Closed by", value: `<@${interaction.user.id}>`, inline: true }).setTimestamp()],
                  files: [{ attachment: Buffer.from(lines.join("\n")), name: `${ticket.ticketId}.txt` }] }).catch(() => {});
              }
            }
          }
          if (tc.logChannelId && ticket) {
            const { EmbedBuilder: EB } = await import("discord.js");
            const logCh = interaction.guild.channels.cache.get(tc.logChannelId) as any;
            if (logCh?.send) await logCh.send({ embeds: [new EB().setColor(0xed4245).setTitle("Ticket Closed")
              .addFields({ name: "Ticket", value: ticket.ticketId, inline: true }, { name: "Closed by", value: `<@${interaction.user.id}>`, inline: true }).setTimestamp()] }).catch(() => {});
          }
          await closeOpenTicket(guildId, channelId);
          await interaction.editReply("Ticket closing in 5 seconds...");
          setTimeout(() => { interaction.guild?.channels.cache.get(channelId)?.delete("Ticket closed").catch(() => {}); }, 5000);
        } catch (err) {
          logger.error({ err }, "Error handling ticket:close button");
          await interaction.editReply("Failed to close ticket.").catch(() => {});
        }
      }
      return;
    }

    // Handle dropdown multi-panel selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("ticket:multipanel:select:")) {
      const guildId = interaction.customId.split(":")[3];
      if (!guildId || !interaction.guild || !interaction.guildId) {
        await interaction.reply({ content: "Could not process selection.", flags: 1 << 6 }).catch(() => {}); return;
      }
      const panelId = interaction.values[0];
      if (!panelId) { await interaction.reply({ content: "No panel selected.", flags: 1 << 6 }); return; }
      try {
        const tc = await getTicketsConfig(guildId);
        if (!tc.enabled) { await interaction.reply({ content: "The ticket system is currently disabled.", flags: 1 << 6 }); return; }
        const panel = tc.panels[panelId];
        if (!panel) { await interaction.reply({ content: "That ticket panel no longer exists.", flags: 1 << 6 }); return; }
        const existing = await getOpenTicketsByUser(guildId, interaction.user.id, panelId);
        if (existing.length > 0) {
          const ch = interaction.guild.channels.cache.get(existing[0]!.channelId);
          await interaction.reply({ content: ch ? `You already have an open ticket: ${ch}` : "You already have an open ticket.", flags: 1 << 6 }); return;
        }

        // If panel has questions, show modal
        if (panel.questions && panel.questions.length > 0) {
          const { ModalBuilder, ActionRowBuilder: MARB, TextInputBuilder, TextInputStyle } = await import("discord.js");
          const modal = new ModalBuilder()
            .setCustomId(`ticket:questions:${panelId}:${guildId}`)
            .setTitle(panel.embedTitle?.slice(0, 45) || "Open a Ticket");
          for (const [idx, q] of panel.questions.slice(0, 5).entries()) {
            modal.addComponents((new MARB() as any).addComponents(
              new TextInputBuilder()
                .setCustomId(`q${idx}`)
                .setLabel(q.label.slice(0, 45))
                .setStyle(q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(q.required),
            ));
          }
          await interaction.showModal(modal as any);
          return;
        }

        // No questions — defer and create immediately
        await interaction.deferReply({ ephemeral: true });
        const supportRoleId = panel.supportRoleId ?? tc.supportRoleId;
        const { ChannelType: CT, PermissionFlagsBits: PFB, EmbedBuilder: EB, ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = await import("discord.js");
        const num = await getNextTicketNumber(guildId, panelId);
        const ticketId = `${panel.name}-${String(num).padStart(3, "0")}`;
        const botMe = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMe) { await interaction.editReply("Could not resolve my member object — please try again."); return; }
        const overwrites: any[] = [
          { id: interaction.guild.id, deny: [PFB.ViewChannel] },
          { id: interaction.user.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] },
          { id: botMe.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ManageChannels, PFB.ReadMessageHistory] },
        ];
        if (supportRoleId) overwrites.push({ id: supportRoleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });
        if (tc.adminRoleId) overwrites.push({ id: tc.adminRoleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });
        const channel = await interaction.guild.channels.create({
          name: ticketId, type: CT.GuildText, parent: panel.categoryId ?? undefined, permissionOverwrites: overwrites, reason: `Ticket by ${interaction.user.tag}`,
        });
        await createOpenTicket({ ticketId, panelId, channelId: channel.id, guildId, userId: interaction.user.id, createdAt: Date.now(), status: "open" });
        const welcomeEmbed = new EB().setTitle(`${CE.ticket.str} ${ticketId}`).setColor(panel.embedColor || 0x2b2d31)
          .setDescription(`Welcome, <@${interaction.user.id}>!\n\nSupport will be with you shortly.`)
          .setFooter({ text: "Use the buttons below to manage this ticket." }).setTimestamp();
        const ticketRow = new ARB().addComponents(
          new BB().setCustomId(`ticket:claim:${channel.id}:${guildId}`).setLabel("Claim").setStyle(BS.Primary).setEmoji({ id: CE.staff.id, name: CE.staff.name }),
          new BB().setCustomId(`ticket:close:${channel.id}:${guildId}`).setLabel("Close Ticket").setStyle(BS.Danger).setEmoji({ id: CE.locked.id, name: CE.locked.name }),
        );
        const ping = supportRoleId ? `<@&${supportRoleId}>` : "";
        await channel.send({ content: `${ping} ${interaction.user}`.trim(), embeds: [welcomeEmbed], components: [ticketRow as any] });
        if (tc.logChannelId) {
          const logCh = interaction.guild.channels.cache.get(tc.logChannelId) as any;
          if (logCh?.send) await logCh.send({ embeds: [new EB().setColor(0x57f287).setTitle("Ticket Opened")
            .addFields({ name: "Ticket", value: `${channel} (\`${ticketId}\`)`, inline: true }, { name: "Opened by", value: `<@${interaction.user.id}>`, inline: true }, { name: "Panel", value: panel.name, inline: true })
            .setTimestamp()] }).catch(() => {});
        }
        await interaction.editReply(`Your ticket has been created: ${channel}`);
      } catch (err) {
        logger.error({ err }, "Error handling ticket:multipanel:select");
        if ((interaction as any).deferred || (interaction as any).replied) {
          await (interaction as any).editReply("Failed to create ticket.").catch(() => {});
        } else {
          await interaction.reply({ content: "Failed to create ticket. Check my permissions.", flags: 1 << 6 }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("appeal:submit:")) {
        const { handleAppealModalSubmit } = await import("./utils/appealHandler");
        try {
          await handleAppealModalSubmit(interaction);
        } catch (err) {
          logger.error({ err }, "Error handling appeal modal submit");
          await interaction.reply({ content: "There was an error submitting your appeal.", flags: 1 << 6 }).catch(() => {});
        }
        return;
      }

      if (interaction.customId === "server_backup_take") {
        const { handleServerBackupTakeModalSubmit } = await import("./commands/server-backup");
        try {
          await handleServerBackupTakeModalSubmit(interaction);
        } catch (err) {
          logger.error({ err }, "Error handling server backup modal submit");
          await interaction.reply({ content: "There was an error taking the backup.", flags: 1 << 6 }).catch(() => {});
        }
        return;
      }

      if (interaction.customId.startsWith("dm-message|")) {
        const { handleDmModalSubmit } = await import("./commands/dm");
        try {
          await handleDmModalSubmit(interaction);
        } catch (err) {
          logger.error({ err }, "Error handling DM modal submit");
          const reply = { content: "There was an error sending the DM.", flags: 1 << 6 };
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(reply).catch(() => {});
          } else {
            await interaction.reply(reply).catch(() => {});
          }
        }
        return;
      }

      // Ticket questions modal submit — user filled in pre-ticket form
      if (interaction.customId.startsWith("ticket:questions:")) {
        if (!interaction.guild || !interaction.guildId) {
          await interaction.reply({ content: "Could not process ticket.", flags: 1 << 6 }).catch(() => {}); return;
        }
        const parts = interaction.customId.split(":");
        const panelId = parts[2];
        const guildId = parts[3];
        await interaction.deferReply({ ephemeral: true });
        try {
          const tc = await getTicketsConfig(guildId!);
          if (!tc.enabled) { await interaction.editReply("The ticket system is currently disabled."); return; }
          const panel = tc.panels[panelId!];
          if (!panel) { await interaction.editReply("This ticket panel no longer exists."); return; }
          const existing = await getOpenTicketsByUser(guildId!, interaction.user.id, panelId!);
          if (existing.length > 0) {
            const ch = interaction.guild.channels.cache.get(existing[0]!.channelId);
            await interaction.editReply(ch ? `You already have an open ticket: ${ch}` : "You already have an open ticket."); return;
          }

          // Collect the answers from the modal fields
          const answers: { label: string; answer: string }[] = [];
          for (const [idx, q] of (panel.questions ?? []).slice(0, 5).entries()) {
            const val = interaction.fields.getTextInputValue(`q${idx}`);
            answers.push({ label: q.label, answer: val });
          }

          const supportRoleId = panel.supportRoleId ?? tc.supportRoleId;
          const { ChannelType: CT, PermissionFlagsBits: PFB, EmbedBuilder: EB, ActionRowBuilder: ARB, ButtonBuilder: BB, ButtonStyle: BS } = await import("discord.js");
          const num = await getNextTicketNumber(guildId!, panelId!);
          const ticketId = `${panel.name}-${String(num).padStart(3, "0")}`;
          const botMe = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
          if (!botMe) { await interaction.editReply("Could not resolve my member object — please try again."); return; }

          const overwrites: any[] = [
            { id: interaction.guild.id, deny: [PFB.ViewChannel] },
            { id: interaction.user.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] },
            { id: botMe.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ManageChannels, PFB.ReadMessageHistory] },
          ];
          if (supportRoleId) overwrites.push({ id: supportRoleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });
          if (tc.adminRoleId) overwrites.push({ id: tc.adminRoleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });

          const channel = await interaction.guild.channels.create({
            name: ticketId, type: CT.GuildText, parent: panel.categoryId ?? undefined, permissionOverwrites: overwrites, reason: `Ticket by ${interaction.user.tag}`,
          });
          await createOpenTicket({ ticketId, panelId: panelId!, channelId: channel.id, guildId: guildId!, userId: interaction.user.id, createdAt: Date.now(), status: "open" });

          // Build welcome embed with answers included
          const welcomeEmbed = new EB()
            .setTitle(`${CE.ticket.str} ${ticketId}`)
            .setColor(panel.embedColor || 0x2b2d31)
            .setDescription(`Welcome, <@${interaction.user.id}>!\n\nSupport will be with you shortly.`)
            .setFooter({ text: "Use the buttons below to manage this ticket." })
            .setTimestamp();
          if (answers.length > 0) {
            welcomeEmbed.addFields(
              answers.map((a) => ({ name: a.label, value: a.answer.slice(0, 1024) || "*No answer*", inline: false })),
            );
          }

          const ticketRow = new ARB().addComponents(
            new BB().setCustomId(`ticket:claim:${channel.id}:${guildId}`).setLabel("Claim").setStyle(BS.Primary).setEmoji({ id: CE.staff.id, name: CE.staff.name }),
            new BB().setCustomId(`ticket:close:${channel.id}:${guildId}`).setLabel("Close Ticket").setStyle(BS.Danger).setEmoji({ id: CE.locked.id, name: CE.locked.name }),
          );
          const ping = supportRoleId ? `<@&${supportRoleId}>` : "";
          await channel.send({ content: `${ping} ${interaction.user}`.trim(), embeds: [welcomeEmbed], components: [ticketRow as any] });
          if (tc.logChannelId) {
            const logCh = interaction.guild.channels.cache.get(tc.logChannelId) as any;
            if (logCh?.send) await logCh.send({ embeds: [new EB().setColor(0x57f287).setTitle("Ticket Opened")
              .addFields(
                { name: "Ticket", value: `${channel} (\`${ticketId}\`)`, inline: true },
                { name: "Opened by", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Panel", value: panel.name, inline: true },
              ).setTimestamp()] }).catch(() => {});
          }
          await interaction.editReply(`Your ticket has been created: ${channel}`);
        } catch (err) {
          logger.error({ err }, "Error handling ticket:questions modal submit");
          await interaction.editReply("Failed to create ticket. Check my permissions.").catch(() => {});
        }
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    // Defer immediately so Discord receives a Gateway acknowledgment in <100ms
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply().catch(() => {});
      }
    } catch {}

    // Grant full Administrator memberPermissions bitfield to Server Owners, Bot Owners, and Bot Staff
    const { isPermanentOwner, isBotAdmin } = await import("./storage/premium");
    const { PERM_WHITELIST } = await import("./storage/whitelist");
    const { PermissionsBitField } = await import("discord.js");

    const isSovereignOwner =
      (interaction.guild && interaction.guild.ownerId === interaction.user.id) ||
      isPermanentOwner(interaction.user.id) ||
      isBotAdmin(interaction.user.id) ||
      PERM_WHITELIST.has(interaction.user.id);

    if (isSovereignOwner) {
      Object.defineProperty(interaction, "memberPermissions", {
        value: new PermissionsBitField(PermissionFlagsBits.Administrator),
        configurable: true,
        writable: true,
      });
    }

    // Patch interaction.reply so calling reply on a deferred/replied interaction cleanly edits or follows up without throwing 40060
    const origReply = interaction.reply.bind(interaction);
    (interaction as any).reply = async (options: any) => {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(options);
      }
      return await origReply(options);
    };

    if (interaction.guildId && interaction.guild) {
      const cfg = await getGuildConfig(interaction.guildId);
      const isConfigured = Boolean(cfg.setupWizardCompleted || cfg.commandsUnlocked);
      const allowedSetupCmds = new Set([
        "setup", "wizard", "setupwizard", "eval", "botstatus", "supabasestatus", "referral", "ref", "refral", "referal", "redeem"
      ]);

      const cmdNameLower = interaction.commandName.toLowerCase();
      if (!isConfigured && !allowedSetupCmds.has(cmdNameLower)) {
        const { prettyEmbed, buildSupportRow, COLORS, CE } = await import("./utils/embedStyle");
        const unconfiguredEmbed = prettyEmbed({
          title: `${CE.warning.str} Server Setup Required`,
          description:
            `### Mandatory Setup Required for **${interaction.guild.name}**\n\n` +
            `No command can be run in this server without running **\`.setup\`** for manual setup or **\`.wizard setup\`** for auto setup!\n\n` +
            `• **Automatic Setup:** Run **\`.wizard setup\`**\n` +
            `• **Manual Setup:** Run **\`.setup\`**\n\n` +
            `*Run \`.wizard setup\` or \`.setup\` now to configure your server and unlock all commands!*`,
          color: COLORS.warning,
          footer: "Zenith Onboarding • Run .wizard setup or .setup to unlock",
        });
        const supportRow = buildSupportRow("Official Support", true);
        await interaction.reply({
          embeds: [unconfiguredEmbed],
          components: [supportRow as any],
          flags: 1 << 6,
        }).catch(() => {});
        return;
      }
    }

    const { checkBotStatusCommandAccess, checkSingleCommandAccess } = await import("./storage/botStatusState");
    const access = await checkBotStatusCommandAccess(interaction.user.id);
    if (!access.allowed) {
      await interaction.reply({ embeds: [access.embed], flags: 1 << 6 }).catch(() => {});
      return;
    }

    const cmdAccess = await checkSingleCommandAccess(interaction.commandName, interaction.user.id);
    if (!cmdAccess.allowed) {
      await interaction.reply({ embeds: [cmdAccess.embed], flags: 1 << 6 }).catch(() => {});
      return;
    }

    const commandMap = getCommandMap();
    const command = commandMap.get(interaction.commandName);
    if (!command) {
      logger.warn({ commandName: interaction.commandName }, "Command not found");
      await interaction.reply({ content: "That command is not recognized.", flags: 1 << 6 }).catch(() => {});
      return;
    }
    const { isGloballyBlacklisted } = await import("./storage/blacklist");
    if (isGloballyBlacklisted(interaction.user.id)) {
      await interaction.reply({ content: "You are blacklisted from using bot commands.", flags: 1 << 6 }).catch(() => {});
      return;
    }
    const { hasPremiumAccess, isGuildPremium } = await import("./storage/premium");
    const isPremium = await hasPremiumAccess(interaction.user.id, interaction.guildId, interaction.member);
    const isServerPremium = interaction.guildId ? await isGuildPremium(interaction.guildId) : false;
    const { runWithBotContext } = await import("./utils/botContext");
    let hasSucceeded = false;
    try {
      await runWithBotContext({ isPremium, isServerPremium, userId: interaction.user.id, guildId: interaction.guildId ?? undefined, showAds: !isPremium }, async () => {
        await command.execute(interaction);
      });
      hasSucceeded = true;

      // Best-effort post-command webhook logging isolated in its own try/catch block so logging failures never trigger command error replies
      try {
        await logCommandExecution({
          commandName: interaction.commandName,
          userId: interaction.user.id,
          username: interaction.user.username,
          guildId: interaction.guildId,
          guildName: interaction.guild?.name ?? null,
          channelId: interaction.channelId,
          channelName: interaction.channel && "name" in interaction.channel ? interaction.channel.name : null,
        });
      } catch (logErr) {
        logger.warn({ logErr, commandName: interaction.commandName }, "Non-fatal error in logCommandExecution webhook");
      }
    } catch (err: any) {
      const errCode = err?.code || err?.status || err?.statusCode;
      const isHarmlessDiscordError = [10062, 40060, 10008, 50007, 50013].includes(errCode);

      logger.error(
        {
          err: {
            name: err?.name || "Error",
            message: err?.message || String(err),
            code: errCode,
            stack: err?.stack,
          },
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          interactionId: interaction.id,
          replied: interaction.replied,
          deferred: interaction.deferred,
          hasSucceeded,
          pid: process.pid,
          instanceId: process.env.CONTAINER_ID || process.env.HOSTNAME || "localhost",
        },
        `[COMMAND ERROR] Slash command "${interaction.commandName}" error`
      );

      // Send failure reply ONLY if command actually failed before responding AND not a harmless error
      if (!hasSucceeded && !interaction.replied && !isHarmlessDiscordError) {
        const reply = { content: "There was an error executing this command.", flags: 1 << 6 };
        try {
          if (interaction.deferred) {
            await interaction.editReply(reply).catch(() => {});
          } else {
            await interaction.reply(reply).catch(() => {});
          }
        } catch {}
      }
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Handle messages: quota tracking, prefix commands, DM forwarding
  // ────────────────────────────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (isMessageRecentlyProcessed(message.id)) return;

    // ── Premium Branding ─────────────────────────────────────
    if (message.guild && message.inGuild()) {
      try {
        const { applyServerPremiumBranding } = await import("./utils/premiumBranding");
        await applyServerPremiumBranding(message.guild);
      } catch {}
    }

    // Handle AFK and Auto-React functionality
    try {
      const { handleAFKMessage, handleAutoReactMessage } = await import("./utils/messageInterceptors");
      await handleAFKMessage(message);
      await handleAutoReactMessage(message);
    } catch (err) {
      logger.error({ err }, "Error in message interceptors");
    }

    // ── Automod ─────────────────────────────────────────────────────────────
    if (message.guild && message.inGuild() && message.member) {
      try {
        const { isBotOwner } = await import("./utils/ownerImmunity");
        if (isBotOwner(message.author.id)) {
          // Absolute owner immunity: bypass all automod systems unconditionally
        } else {
        const am = await getAutomodConfig(message.guildId);
        if (am.enabled) {
          const member = message.member;
          const content = message.content || "";
          const exempted = (r: { exemptRoleIds?: string[]; exemptChannelIds?: string[] }) => {
            if (am.whitelistUserIds?.includes(member.id)) return true;
            if (am.whitelistChannelIds?.includes(message.channelId)) return true;
            if (message.channel && "parentId" in message.channel && message.channel.parentId && am.whitelistCategoryIds?.includes(message.channel.parentId)) return true;
            if (am.whitelistRoleIds?.some((id) => member.roles.cache.has(id))) return true;
            return (
              (r.exemptRoleIds?.some((id) => member.roles.cache.has(id)) ?? false) ||
              (r.exemptChannelIds?.includes(message.channelId) ?? false)
            );
          };
          const doAction = async (action: string, reason: string, muteDuration: number) => {
            const { EmbedBuilder: EB } = await import("discord.js");
            const dmEmbed = new EB()
              .setTitle(`${CE.automod.str} Automod Violation & Action`)
              .setColor(0xed4245)
              .setDescription(`Automod triggered on your message in **${message.guild?.name || "the server"}**.`)
              .addFields(
                { name: "Violation / Reason", value: reason, inline: true },
                { name: "Punishment / Action", value: action.toUpperCase() + (action === "mute" ? ` (${muteDuration} mins)` : ""), inline: true }
              )
              .setTimestamp();
            await message.author.send({ embeds: [dmEmbed] }).catch(() => null);

            await message.delete().catch(() => {});
            if (action === "warn") {
              await message.channel.send({ content: `${CE.warning.str} ${member} — **Automod Warning**: ${reason}` }).then((m) => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
            } else if (action === "mute") {
              await member.timeout(muteDuration * 60_000, reason).catch(() => {});
              await message.channel.send({ content: `${CE.mute.str} Muted ${member} (${muteDuration}m): ${reason}` }).then((m) => setTimeout(() => m.delete().catch(() => {}), 10000)).catch(() => {});
            } else if (action === "kick") {
              await member.kick(reason).catch(() => {});
              await message.channel.send({ content: `${CE.automod.str} Kicked ${member}: ${reason}` }).then((m) => setTimeout(() => m.delete().catch(() => {}), 10000)).catch(() => {});
            } else if (action === "ban") {
              await member.ban({ reason }).catch(() => {});
              await message.channel.send({ content: `${CE.automod.str} Banned ${member}: ${reason}` }).then((m) => setTimeout(() => m.delete().catch(() => {}), 10000)).catch(() => {});
            } else {
              await message.channel.send({ content: `${CE.automod.str} ${member} — Your message was removed by **Automod** (${reason}).` }).then((m) => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
            }
            if (am.logChannelId) {
              const logCh = message.guild?.channels.cache.get(am.logChannelId) as any;
              if (logCh?.send) {
                await logCh.send({ embeds: [new EB().setColor(0xed4245).setTitle(`${CE.automod.str} Automod`).addFields(
                  { name: "User", value: `${member} (${member.id})`, inline: true }, { name: "Action", value: action, inline: true },
                  { name: "Reason", value: reason, inline: true }, { name: "Channel", value: `<#${message.channelId}>`, inline: true },
                  { name: "Content", value: content.slice(0, 500) || "*(empty)*", inline: false },
                ).setTimestamp()] }).catch(() => {});
              }
            }
          };
          // Spam
          if ((am.spam.enabled || am.enabled) && !exempted(am.spam)) {
            if (recordSpam(message.guildId, message.author.id) >= (am.spam.threshold || 4)) { await doAction(am.spam.action || "delete", "Spam rate limit exceeded", am.spam.muteDurationMinutes || 10); return; }
          }
          // Duplicates
          if ((am.duplicates.enabled || am.enabled) && !exempted(am.duplicates)) {
            if (recordDuplicate(message.guildId, message.author.id, content)) { await doAction(am.duplicates.action || "delete", "Duplicate message", am.duplicates.muteDurationMinutes || 10); return; }
          }
          // Bad words (multi-language profanity, sensitive terms, masking attempts + custom words)
          if ((am.badWords.enabled || am.enabled) && !exempted(am.badWords)) {
            const check = containsProhibitedLanguage(content, am.badWords.words || []);
            if (check.prohibited) {
              await doAction(am.badWords.action || "delete", `Prohibited language detected (${check.word || "bad word"})`, am.badWords.muteDurationMinutes || 10);
              return;
            }
          }
          // Invites
          if ((am.invites.enabled || am.enabled) && !exempted(am.invites) && /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\//i.test(content)) {
            await doAction(am.invites.action || "delete", "Discord invites not allowed", am.invites.muteDurationMinutes || 10);
            return;
          }
          // Links & Anti-Scam (AI Powered)
          if (am.links.enabled && !exempted(am.links)) {
            const { runAntiScamCheck } = await import("./utils/safetyModules");
            const handled = await runAntiScamCheck(message, content);
            if (handled) return;
          }
          // AI Content Moderation (NSFW, Explicit, CSAM)
          if ((am.aiAutomod.enabled || am.enabled) && !exempted(am.aiAutomod)) {
            const { runAntiNsfwCheck } = await import("./utils/safetyModules");
            const handled = await runAntiNsfwCheck(message, content);
            if (handled) return;
          }
          // Caps
          if ((am.caps.enabled || am.enabled) && !exempted(am.caps) && content.length >= 6) {
            const caps = [...content].filter((c) => c>="A"&&c<="Z").length;
            const letters = [...content].filter((c) => (c>="A"&&c<="Z")||(c>="a"&&c<="z")).length;
            if (letters >= 4 && (caps/letters)*100 >= (am.caps.percent || 70)) { await doAction(am.caps.action || "delete", "Excessive caps detected", am.caps.muteDurationMinutes || 10); return; }
          }
          // Mentions / Pings
          if ((am.mentions.enabled || am.enabled) && !exempted(am.mentions)) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 3 : 0);
            if (mentionCount >= (am.mentions.threshold || 3)) {
              await doAction(am.mentions.action || "delete", "Mass mentions / pings detected", am.mentions.muteDurationMinutes || 10); return;
            }
          }
          // Newlines / Multilines
          if ((am.newlines.enabled || am.enabled) && !exempted(am.newlines)) {
            const newlineCount = (content.match(/\n/g) ?? []).length;
            const consecutiveNewlines = /[\r\n]{4,}/.test(content);
            if (newlineCount >= (am.newlines.threshold || 5) || consecutiveNewlines) {
              await doAction(am.newlines.action || "delete", "Excessive newlines / multiline flooding", am.newlines.muteDurationMinutes || 10); return;
            }
          }
          // AI Automod (Text + Media scanning with Gemini)
          if ((am.aiAutomod.enabled || am.enabled) && !exempted(am.aiAutomod)) {
            const isNsfwChannel = Boolean((message.channel as any).nsfw);
            
            // 1. Scan Attachments & Stickers if enabled
            if (!isNsfwChannel && (am.aiAutomod.scanImages || am.aiAutomod.scanStickers)) {
              const itemsToScan: { url: string; mimeType: string }[] = [];
              
              if (am.aiAutomod.scanImages) {
                for (const att of message.attachments.values()) {
                  if (att.contentType?.startsWith("image/") || att.contentType?.startsWith("video/")) {
                    itemsToScan.push({ url: att.proxyURL, mimeType: att.contentType });
                  }
                }
              }
              
              if (am.aiAutomod.scanStickers) {
                for (const sticker of message.stickers.values()) {
                  // Sticker proxy URLs usually work with vision models if they are PNG/APNG
                  itemsToScan.push({ url: sticker.url, mimeType: "image/png" });
                }
              }

              if (itemsToScan.length > 0) {
                const { scanMediaWithGemini } = await import("./utils/geminiModerator");
                for (const item of itemsToScan) {
                  const result = await scanMediaWithGemini(item.url, item.mimeType);
                  if (result?.flagged && result.confidence >= (am.aiAutomod.minConfidence || 75)) {
                    await doAction(am.aiAutomod.action || "delete", `AI Media Moderation: ${result.category} detected (${result.reason})`, am.aiAutomod.muteDurationMinutes || 10);
                    return;
                  }
                }
              }
            }

            // 2. Scan Text with Gemini (fallback to local patterns if Gemini fails or is disabled)
            if (content.trim().length > 0) {
              const { scanTextWithGemini } = await import("./utils/geminiModerator");
              const cats = am.aiAutomod.categories.length > 0 ? am.aiAutomod.categories : ["scam", "phishing", "threat", "nsfw", "explicit"];
              
              const aiResult = await scanTextWithGemini(content, cats);
              if (aiResult?.flagged && aiResult.confidence >= (am.aiAutomod.minConfidence || 75)) {
                 if (aiResult.category === "nsfw" && isNsfwChannel) {
                   // allowed
                 } else {
                   await doAction(am.aiAutomod.action || "delete", `AI Content Moderation: ${aiResult.category} detected (${aiResult.reason})`, am.aiAutomod.muteDurationMinutes || 10);
                   return;
                 }
              } else {
                // Fallback to local heuristic classifier
                const { classifyContent, categoryLabel } = await import("./utils/aiAutomod");
                const result = classifyContent(content, am.aiAutomod.whitelist ?? []);
                if (result.flagged && (cats.includes(result.category) || result.category === "nsfw") && result.confidence >= (am.aiAutomod.minConfidence || 70)) {
                  if (!(result.category === "nsfw" && isNsfwChannel)) {
                    const reason = `AI Pattern Match: ${categoryLabel(result.category)} detected (${result.confidence}% confidence)`;
                    await doAction(am.aiAutomod.action || "delete", reason, am.aiAutomod.muteDurationMinutes || 10);
                    return;
                  }
                }
              }
            }
          }
        }
        }
      } catch (err) { logger.warn({ err }, "Automod error"); }
    }

    // ── Forward incoming DMs to the MESSAGE_LOGS webhook & process DM commands ──
    if (!message.guild) {
      logDmToWebhook({
        direction: "in",
        userId: message.author.id,
        username: message.author.username,
        content: message.content,
        attachments: message.attachments.size > 0
          ? [...message.attachments.values()].map((a) => a.url)
          : undefined,
      }).catch(() => {});

      try {
        await handlePrefixMessage(message);
      } catch (err) {
        logger.error({ err }, "Error handling DM prefix command");
      }
      return;
    }

    // ── Guild messages: quota + prefix commands ──────────────────────
    try {
      if (message.inGuild() && message.guildId && message.member) {
        const cfg = await getGuildConfig(message.guildId);
        if (cfg.quotaConfig) {
          const staffRoles = await listStaffRoles(message.guildId);
          const isStaff = staffRoles.some((role) => message.member!.roles.cache.has(role.roleId));
          if (isStaff) {
            await bumpMessage(
              message.guildId,
              message.author.id,
              cfg.quotaConfig.weekStartDay,
            ).catch(() => {});
          }
        }
      }

      const prefixHandled = await handlePrefixMessage(message);
      if (!prefixHandled) {
        try {
          const { handleNoPrefixNLPMessage } = await import("./utils/messageInterceptors");
          await handleNoPrefixNLPMessage(message);
        } catch (err) {
          logger.error({ err }, "Error in No-Prefix NLP router");
        }
      }

      // ── Levels XP (message) ──────────────────────────────────────────────
      if (message.inGuild() && message.guildId && message.member && !message.author.bot) {
        try {
          const { getLevelConfig, getMemberLevel, setMemberLevel } = await import("./storage/levels");
          const { levelFromTotalXp, totalXpForLevel, xpToNextLevel } = await import("./utils/levelCalc");
          const { getGuildConfig } = await import("./storage/config");
          const [lc, gCfg] = await Promise.all([
            getLevelConfig(message.guildId),
            getGuildConfig(message.guildId),
          ]);
          const isEnabled = lc.enabled || Boolean(gCfg.modules?.levels);
          if (isEnabled) {
            const mem = message.member;
            if (!lc.ignoredChannels.includes(message.channelId) &&
                (lc.allowedChannels.length === 0 || lc.allowedChannels.includes(message.channelId)) &&
                !lc.ignoredRoles.some((r) => mem.roles.cache.has(r))) {
              const md = await getMemberLevel(message.guildId, message.author.id);
              const now = Date.now();
              if (now - md.lastMessageXp >= lc.xpCooldownSeconds * 1000) {
                const gain = Math.floor(Math.random() * (lc.xpPerMessageMax - lc.xpPerMessageMin + 1)) + lc.xpPerMessageMin;
                const oldLevel = md.level;
                const rawTotal = md.totalXp + gain;
                const rawLevel = levelFromTotalXp(rawTotal);
                const newLevel = lc.levelLimit !== null ? Math.min(lc.levelLimit, rawLevel) : rawLevel;
                const newTotalXp = (lc.levelLimit !== null && newLevel >= lc.levelLimit) ? totalXpForLevel(lc.levelLimit) : rawTotal;
                const newData = { xp: newTotalXp - totalXpForLevel(newLevel), level: newLevel, totalXp: newTotalXp, lastMessageXp: now };
                await setMemberLevel(message.guildId, message.author.id, newData);
                if (newLevel > oldLevel && lc.levelUpAnnounce) {
                  const { EmbedBuilder: LEB } = await import("discord.js");
                  const lvMsg = lc.embedMessage.replace("{user}", `${mem}`).replace("{level}", String(newLevel));
                  const ch: any = lc.levelUpChannel
                    ? (message.guild?.channels.cache.get(lc.levelUpChannel) ?? message.channel)
                    : message.channel;
                  if (ch?.send) await ch.send({ embeds: [new LEB().setColor(lc.embedColor ?? 0x2b2d31).setDescription(`${CE.trophy.str} ${lvMsg}`).setThumbnail(mem.displayAvatarURL()).setFooter({ text: `Level ${newLevel}` })] }).catch(() => {});
                  if (lc.levelRoles.length > 0) {
                    const eligible = lc.levelRoles.filter((lr) => lr.level <= newLevel).map((lr) => lr.roleId);
                    if (!lc.stackRoles) {
                      const old = lc.levelRoles.filter((lr) => lr.level < newLevel).map((lr) => lr.roleId).filter((id) => mem.roles.cache.has(id));
                      if (old.length) await mem.roles.remove(old, "Level role update").catch(() => {});
                    }
                    const toAdd = eligible.filter((id) => !mem.roles.cache.has(id));
                    if (toAdd.length) await mem.roles.add(toAdd, `Level ${newLevel} reward`).catch(() => {});
                  }
                }
              }
            }
          }
        } catch (lvErr) { logger.warn({ lvErr }, "Levels XP error (message)"); }
      }
    } catch (err) {
      logger.error({ err }, "Error handling prefix message");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Role memory + Anti-Join
  // ────────────────────────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const am = await getAutomodConfig(member.guild.id);
      if (am.raid.enabled) {
        const { recordRaidJoin } = await import("./utils/raidTracker");
        const joinCount = recordRaidJoin(member.guild.id, am.raid.joinWindowSeconds || 15);
        
        if (joinCount >= (am.raid.joinThreshold || 10)) {
          // Raid detected!
          const { handleRaidBurst } = await import("./utils/raidTracker");
          await handleRaidBurst(member, am.raid);
          
          if (am.logChannelId) {
            const logCh = member.guild.channels.cache.get(am.logChannelId) as any;
            if (logCh?.send) {
              const { EmbedBuilder: EB } = await import("discord.js");
              logCh.send({ 
                embeds: [new EB()
                  .setTitle(`${CE.warning.str} RAID DETECTED`)
                  .setColor(0xed4245)
                  .setDescription(`Extreme join burst detected (**${joinCount}** joins within **${am.raid.joinWindowSeconds}s**). 
Executing automated raid defenses: **${am.raid.action.toUpperCase()}**.`)
                  .addFields({ name: "Recent Joiner", value: `${member} (${member.id})`, inline: true })
                  .setTimestamp()] 
              }).catch(() => {});
            }
          }
          // Note: we continue execution so other handlers can run if needed, 
          // but usually handleRaidBurst might kick/ban the member.
        }
      }
    } catch (err) {
      logger.warn({ err, guildId: member.guild.id }, "Raid check failed");
    }

    try {
      const { handleAntiJoin } = await import("./utils/antiNuke");
      await handleAntiJoin(member.guild, member);
    } catch (err) {
      logger.error({ err, guildId: member.guild.id, userId: member.id }, "Error handling anti-join");
    }

    // Bot Staff / QA Tester Auto-Role in Testing Server
    try {
      if (member.guild.roles.cache.has("1553398642835071056")) {
        const { isBotStaff } = await import("./storage/botStaff");
        const isStaff = await isBotStaff(member.id);
        if (isStaff && !member.roles.cache.has("1553398642835071056")) {
          await member.roles.add("1553398642835071056", "Auto-granted Bot Staff & QA Tester role on join").catch(() => {});
          logger.info({ userId: member.id, guildId: member.guild.id }, "Auto-granted tester role to bot staff member on join");
        }
      }
    } catch (err) {
      logger.warn({ err, userId: member.id }, "Error checking tester role on guild join");
    }

    try {
      const { getGuildConfig: getCfg } = await import("./storage/config");
      const { getMemberRoles } = await import("./storage/memberRoles");

      const config = await getCfg(member.guild.id);
      if (config.modules.roleMemory) {
        const savedRoleIds = await getMemberRoles(member.guild.id, member.id);
        if (savedRoleIds && savedRoleIds.length > 0) {
          const rolesToAdd: string[] = [];
          for (const roleId of savedRoleIds) {
            const role = member.guild.roles.cache.get(roleId);
            if (role && !member.roles.cache.has(roleId)) {
              rolesToAdd.push(roleId);
            }
          }

          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, "Role Memory: restoring on rejoin").catch((err) => {
              logger.warn({ err, guildId: member.guild.id, userId: member.id }, "Failed to restore member roles");
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err, guildId: member.guild.id, userId: member.id }, "Error handling role memory restore");
    }

    // Welcomer
    try {
      const { getWelcomerConfig } = await import("./storage/welcomer");
      // const { generateWelcomeImage }
      const { buildWelcomerEmbed, buildWelcomerText, applyWelcomerPlaceholders } = await import("./utils/welcomeSender");
      const { AttachmentBuilder, ChannelType } = await import("discord.js");

      const wc = await getWelcomerConfig(member.guild.id);
      if (wc.enabled) {
        const user = member.user;
        const guild = member.guild;
        const count = guild.memberCount;

        // Channel welcome
        if (wc.channel.enabled && wc.channel.channelId) {
          const ch = await guild.channels.fetch(wc.channel.channelId).catch(() => null);
          if (ch && ch.type === ChannelType.GuildText) {
            const textCh = ch as import("discord.js").TextChannel;
            const chAbove = wc.channel.aboveText
              ? applyWelcomerPlaceholders(wc.channel.aboveText, user, guild, count)
              : undefined;
            if (wc.channel.mode === "embed") {
              const embed = buildWelcomerEmbed(wc.channel.embed ?? {}, user, guild, count);
              if (wc.channel.embed?.showAvatar !== false) embed.setThumbnail(user.displayAvatarURL({ size: 256 }));
              await textCh.send({ content: chAbove, embeds: [embed] });
            } else if (wc.channel.mode === "image") {
              const embed = buildWelcomerEmbed(wc.channel.embed ?? {}, user, guild, count);
              if (wc.channel.embed?.showAvatar !== false) embed.setThumbnail(user.displayAvatarURL({ size: 256 }));
              await textCh.send({ content: chAbove, embeds: [embed] });
            } else {
              const text = applyWelcomerPlaceholders(wc.channel.message ?? "Welcome {user} to **{server}**!", user, guild, count);
              await textCh.send({ content: text });
            }
          }
        }

        // DM welcome
        if (wc.dm.enabled) {
          const dmAbove = wc.dm.aboveText
            ? applyWelcomerPlaceholders(wc.dm.aboveText, user, guild, count)
            : undefined;
          if (wc.dm.mode === "embed") {
            const embed = buildWelcomerEmbed(wc.dm.embed ?? {}, user, guild, count);
            await user.send({ content: dmAbove, embeds: [embed] }).catch(() => {});
          } else {
            const text = applyWelcomerPlaceholders(wc.dm.message ?? "Welcome to **{server}**, {username}!", user, guild, count);
            await user.send({ content: dmAbove ? `${dmAbove}\n${text}` : text }).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error({ err, guildId: member.guild.id, userId: member.id }, "Error handling welcomer");
    }

    try {
      const { safeDispatchMemberJoin } = await import("./utils/automations");
      safeDispatchMemberJoin(member);
    } catch (err) {
      logger.error({ err, guildId: member.guild.id, userId: member.id }, "Error handling automations on join");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Bot joined new guild: register commands, set nickname, mark setup pending
  // ────────────────────────────────────────────────────────────────────
  client.on(Events.GuildCreate, async (guild) => {
    try {
      logger.info({ guildId: guild.id, name: guild.name }, "Bot joined new guild");

      // Apply server branding immediately (Zenith Prime + Golden 3D Z logo if premium, Zenith Bot if non-premium)
      const { applyServerPremiumBranding } = await import("./utils/premiumBranding");
      await applyServerPremiumBranding(guild, true).catch(() => {});

      // Register commands
      const { registerGuildCommands } = await import("./registry/registerGuildCommands");
      await registerGuildCommands(client, guild.id).catch(() => {});

      // Mark setup pending
      const { updateGuildConfig } = await import("./storage/config");
      await updateGuildConfig(guild.id, (cfg) => ({
        ...cfg,
        setupWizardCompleted: false,
        commandsUnlocked: false,
      }));

      // Send welcome / setup prompt to first text channel of server
      const { prettyEmbed, buildSupportRow, COLORS, resolveDynamicEmoji, SUPPORT_SERVER_URL } = await import("./utils/embedStyle");
      const botEmoji = resolveDynamicEmoji(client, "bots", CE.bot.str);
      const supportRow = buildSupportRow("Join Support Server", true);

      const sendableChannels = guild.channels.cache.filter(
        (c: any) => c.isTextBased() && c.permissionsFor(guild.members.me)?.has("SendMessages")
      );
      const sortedChs = Array.from(sendableChannels.values()).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      const targetCh = guild.systemChannel ?? sortedChs[0];

      if (targetCh && "send" in targetCh) {
        await (targetCh as any).send({
          embeds: [
            prettyEmbed({
              title: `${botEmoji} Thank You for Adding Zenith Bot!`,
              description:
                `Thank you for adding **Zenith Bot** to **${guild.name}**!\n\n` +
                `• **Commands List:** Run **\`.help\`** or **\`/help\`** to view all commands.\n` +
                `• **Support Server:** [Join Official Support Server](${SUPPORT_SERVER_URL})\n` +
                `• **Mandatory Setup:** An administrator must run **\`.wizard setup\`** (automatic setup) or **\`.setup\`** (manual setup) to configure server roles before commands can be used.`,
              color: COLORS.primary,
              footer: "Zenith Bot • Run .help for commands | .wizard setup to configure",
            }),
          ],
          components: [supportRow as any],
        }).catch(() => {});
      }

      // DM to Server Owner
      const owner = await guild.fetchOwner().catch(() => null);
      if (owner) {
        await owner.send({
          embeds: [
            prettyEmbed({
              title: `${botEmoji} Thank You for Adding Zenith Bot!`,
              description:
                `Hello **${owner.user.username}**! Thank you for adding **Zenith Bot** to **${guild.name}**!\n\n` +
                `• **Commands:** Type **\`.help\`** in your server to view all available commands.\n` +
                `• **Support Server:** [Join Official Support Server](${SUPPORT_SERVER_URL})\n` +
                `• **Onboarding Setup:** Please run **\`.wizard setup\`** (automatic setup) or **\`.setup\`** (manual setup) in **${guild.name}** to configure roles & security walls.`,
              color: COLORS.primary,
              footer: "Zenith Bot • Run .help for commands",
            }),
          ],
          components: [supportRow as any],
        }).catch(() => {});
      }

      // DM to Who Added the Bot (Audit Log lookup)
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).catch(() => null);
        const entry = auditLogs?.entries.first();
        if (entry && entry.executor && entry.executor.id !== owner?.id) {
          const adder = entry.executor;
          await adder.send({
            embeds: [
              prettyEmbed({
                title: `${botEmoji} Thank You for Adding Zenith Bot!`,
                description:
                  `Hello **${adder.username}**! Thank you for adding **Zenith Bot** to **${guild.name}**!\n\n` +
                  `• **Commands:** Type **\`.help\`** in your server to view all available commands.\n` +
                  `• **Support Server:** [Join Official Support Server](${SUPPORT_SERVER_URL})\n` +
                  `• **Onboarding Setup:** Please run **\`.wizard setup\`** (automatic setup) or **\`.setup\`** (manual setup) in **${guild.name}** to unlock all features.`,
                color: COLORS.primary,
                footer: "Zenith Bot • Run .help for commands",
              }),
            ],
            components: [supportRow as any],
          }).catch(() => {});
        }
      } catch {}
    } catch (err) {
      logger.error({ err, guildId: guild.id }, "Error handling GuildCreate event");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Track role changes + Anti-Role
  // ────────────────────────────────────────────────────────────────────
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const { getGuildConfig: getCfg } = await import("./storage/config");
      const { saveMemberRoles } = await import("./storage/memberRoles");

      const config = await getCfg(newMember.guild.id);
      if (!config.modules.roleMemory) return;

      if (oldMember.roles.cache.size === newMember.roles.cache.size &&
          oldMember.roles.cache.every((r) => newMember.roles.cache.has(r.id))) {
        return;
      }

      const roleIds = Array.from(newMember.roles.cache.values())
        .map((r) => r.id)
        .filter((id) => id !== newMember.guild.id);

      await saveMemberRoles(newMember.guild.id, newMember.id, roleIds);
    } catch (err) {
      logger.error({ err, guildId: newMember.guild.id, userId: newMember.id }, "Error updating member role memory");
    }

    try {
      const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
      if (addedRoles.size === 0) return;
      const { isDangerousRole, handleAntiRole } = await import("./utils/antiNuke");
      const hasDangerous = addedRoles.some((r) => isDangerousRole(r.permissions.bitfield));
      if (!hasDangerous) return;
      const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 }).catch(() => null);
      const entry = logs?.entries.find((e) => (e.target as { id?: string } | null)?.id === newMember.id);
      const executorId = entry?.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      await handleAntiRole(newMember.guild, executorId, "Dangerous role assigned");
    } catch (err) {
      logger.error({ err, guildId: newMember.guild.id, userId: newMember.id }, "Error handling anti-role (member update)");
    }

    try {
      const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id)).map(r => r.id);
      const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id)).map(r => r.id);
      if (addedRoles.length > 0 || removedRoles.length > 0) {
        const { safeDispatchRoleChange } = await import("./utils/automations");
        safeDispatchRoleChange(newMember, addedRoles, removedRoles);

        // Check if any added role is a configured Premium Role
        if (addedRoles.length > 0) {
          const { listPremiumRoles, sendPremiumRoleAssignedDM } = await import("./storage/premium");
          const pRoles = await listPremiumRoles();
          for (const roleId of addedRoles) {
            const isPRole = pRoles.some(pr => pr.guildId === newMember.guild.id && pr.roleId === roleId);
            if (isPRole) {
              const roleObj = newMember.guild.roles.cache.get(roleId);
              if (roleObj) {
                await sendPremiumRoleAssignedDM(newMember, roleObj, newMember.guild);
              }
            }
          }
        }

        // Check if any removed role was a configured Premium Role
        if (removedRoles.length > 0) {
          const { listPremiumRoles, sendPremiumRoleRemovedDM } = await import("./storage/premium");
          const pRoles = await listPremiumRoles();
          for (const roleId of removedRoles) {
            const wasPRole = pRoles.some(pr => pr.guildId === newMember.guild.id && pr.roleId === roleId);
            if (wasPRole) {
              const roleObj = newMember.guild.roles.cache.get(roleId) ?? { name: "Premium Role", id: roleId };
              await sendPremiumRoleRemovedDM(newMember, roleObj, newMember.guild);
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, guildId: newMember.guild.id, userId: newMember.id }, "Error handling automations/premium on role change");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Anti-Nuke: ban / kick / role / channel detection
  // ────────────────────────────────────────────────────────────────────
  client.on(Events.GuildBanAdd, async (ban) => {
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 }).catch(() => null);
      const entry = logs?.entries.find((e) => (e.target as { id?: string } | null)?.id === ban.user.id);
      const executorId = entry?.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      const { handleAntiBan } = await import("./utils/antiNuke");
      await handleAntiBan(ban.guild, executorId);
    } catch (err) {
      logger.error({ err, guildId: ban.guild.id }, "Error handling anti-ban");
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }).catch(() => null);
      const entry = logs?.entries.find(
        (e) =>
          (e.target as { id?: string } | null)?.id === member.id &&
          Date.now() - e.createdTimestamp < 10_000,
      );
      if (!entry) return;
      const executorId = entry.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      const { handleAntiKick } = await import("./utils/antiNuke");
      await handleAntiKick(member.guild, executorId);
    } catch (err) {
      logger.error({ err, guildId: member.guild.id }, "Error handling anti-kick");
    }

    try {
      const { safeDispatchMemberLeave } = await import("./utils/automations");
      safeDispatchMemberLeave(member.guild, member.user);
    } catch (err) {
      logger.error({ err, guildId: member.guild.id, userId: member.id }, "Error handling automations on leave");
    }
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 5 }).catch(() => null);
      const entry = logs?.entries.first();
      const executorId = entry?.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      const { handleAntiRole } = await import("./utils/antiNuke");
      await handleAntiRole(role.guild, executorId, "Unauthorized role created");
    } catch (err) {
      logger.error({ err, guildId: role.guild.id }, "Error handling anti-role (create)");
    }
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 5 }).catch(() => null);
      const entry = logs?.entries.first();
      const executorId = entry?.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      const { handleAntiRole } = await import("./utils/antiNuke");
      await handleAntiRole(role.guild, executorId, "Unauthorized role deleted");

      // Check Partner Staff Role Integrity Watchdog
      const { checkPartnerRolesIntegrity } = await import("./storage/referrals");
      const integrity = await checkPartnerRolesIntegrity(role.guild);
      if (integrity.isPartnerGuild && !integrity.rolesValid) {
        const { prettyEmbed, COLORS, CE } = await import("./utils/embedStyle");
        const sysCh = role.guild.systemChannel || role.guild.channels.cache.find((c: any) => c.isTextBased() && c.permissionsFor(role.guild.members.me)?.has("SendMessages"));
        if (sysCh && "send" in sysCh) {
          const alertEmbed = prettyEmbed({
            title: `${CE.warning.str} Partner Staff Role Action Required!`,
            description:
              `A configured **Partner Staff Role** was deleted from **${role.guild.name}**!\n\n` +
              `• **Missing Role(s):** ${integrity.missingRoles.join(", ")}\n\n` +
              `*Please run **\`.ref partner\`** or **\`/referral partner-setup\`** to re-select your Junior and Higher Staff Roles so staff members retain their premium perks!*`,
            color: COLORS.warning,
          });
          await (sysCh as any).send({ embeds: [alertEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err, guildId: role.guild.id }, "Error handling anti-role (delete)");
    }
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 5 }).catch(() => null);
      const entry = logs?.entries.first();
      const executorId = entry?.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      const { handleAntiChannel } = await import("./utils/antiNuke");
      await handleAntiChannel(channel.guild, executorId, "Unauthorized channel created");
    } catch (err) {
      logger.error({ err, guildId: channel.guild?.id }, "Error handling anti-channel (create)");
    }
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 5 }).catch(() => null);
      const entry = logs?.entries.first();
      const executorId = entry?.executor?.id ?? null;
      if (executorId === client.user?.id) return;
      const { handleAntiChannel } = await import("./utils/antiNuke");
      await handleAntiChannel(channel.guild, executorId, "Unauthorized channel deleted");
    } catch (err) {
      logger.error({ err, guildId: (channel as any).guild?.id }, "Error handling anti-channel (delete)");
    }
  });

  // ── Levels XP (VC tracking) ──────────────────────────────────────────────
  const vcJoinMap = new Map<string, number>(); // key: guildId:userId → join timestamp

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const guildId = newState.guild.id;
    const userId = newState.member?.id ?? newState.id;
    const key = `${guildId}:${userId}`;
    const isBot = newState.member?.user.bot ?? false;
    if (isBot) return;

    // Handle music player presence & 24/7 logic on voice state change
    try {
      const { getMusicPlayer } = await import("./music/musicManager");
      const musicPlayer = getMusicPlayer(guildId);
      if (musicPlayer && musicPlayer.voiceChannel) {
        // Absolute test server VC permanency safeguard
        const isTestServer = musicPlayer.voiceChannel.guild.roles.cache.has("1553398642835071056");
        if (isTestServer) return;

        const botChannelId = musicPlayer.voiceChannel.id;
        if (oldState.channelId === botChannelId || newState.channelId === botChannelId) {
          const nonBotMembers = musicPlayer.voiceChannel.members.filter((m) => !m.user.bot).size;
          if (nonBotMembers === 0) {
            // Channel is empty of humans
            if (!musicPlayer.twentyFourSeven.enabled) {
              if (!musicPlayer.inactivityTimeout) {
                musicPlayer.inactivityTimeout = setTimeout(() => {
                  if (
                    musicPlayer &&
                    !musicPlayer.isDestroyed &&
                    !musicPlayer.twentyFourSeven.enabled &&
                    musicPlayer.voiceChannel &&
                    musicPlayer.voiceChannel.members.filter((m) => !m.user.bot).size === 0
                  ) {
                    musicPlayer.destroy();
                  }
                }, 900_000); // 15-minute grace period before leaving empty channel
              }
            } else {
              // 24/7 mode is active, but channel is empty of humans. Let's pause/stop streaming to save bandwidth!
              logger.info({ guildId }, "Conserving bandwidth: Pausing 24/7 playback as voice channel is empty");
              musicPlayer.pauseForInactivity().catch(() => {});
            }
          } else {
            // Someone joined/is in the voice channel, cancel inactivity timer
            if (musicPlayer.inactivityTimeout) {
              clearTimeout(musicPlayer.inactivityTimeout);
              musicPlayer.inactivityTimeout = undefined;
            }
            if (musicPlayer.twentyFourSeven.enabled && musicPlayer.is247PausedDueToInactivity) {
              logger.info({ guildId }, "Resuming 24/7 playback as listeners returned");
              musicPlayer.resumeFromInactivity().catch(() => {});
            }
          }
        }
      }
    } catch {}

    // User joined a voice channel (or switched channels)
    if (newState.channelId && (!oldState.channelId || newState.channelId !== oldState.channelId)) {
      vcJoinMap.set(key, Date.now());
    }

    // User left a voice channel
    if (!newState.channelId && oldState.channelId) {
      const joinTime = vcJoinMap.get(key);
      vcJoinMap.delete(key);
      if (!joinTime) return;
      try {
        const { getLevelConfig, addMemberXp, getMemberLevel, setMemberLevel } = await import("./storage/levels");
        const { levelFromTotalXp, totalXpForLevel } = await import("./utils/levelCalc");
        const lc = await getLevelConfig(guildId);
        if (!lc.enabled || lc.xpPerVcMinute <= 0) return;
        const minutesInVc = Math.floor((Date.now() - joinTime) / 60_000);
        if (minutesInVc < 1) return;
        const xpGain = minutesInVc * lc.xpPerVcMinute;
        const md = await getMemberLevel(guildId, userId);
        const oldLevel = md.level;
        const rawTotal = md.totalXp + xpGain;
        const rawLevel = levelFromTotalXp(rawTotal);
        const newLevel = lc.levelLimit !== null ? Math.min(lc.levelLimit, rawLevel) : rawLevel;
        const newTotalXp = (lc.levelLimit !== null && newLevel >= lc.levelLimit) ? totalXpForLevel(lc.levelLimit) : rawTotal;
        await setMemberLevel(guildId, userId, { xp: newTotalXp - totalXpForLevel(newLevel), level: newLevel, totalXp: newTotalXp, lastMessageXp: md.lastMessageXp });
        if (newLevel > oldLevel && lc.levelUpAnnounce && lc.levelUpChannel) {
          const { EmbedBuilder: LEB } = await import("discord.js");
          const mem = newState.guild.members.cache.get(userId);
          const ch: any = lc.levelUpChannel ? (newState.guild.channels.cache.get(lc.levelUpChannel) ?? null) : null;
          if (ch?.send && mem) {
            const lvMsg = lc.embedMessage.replace("{user}", `${mem}`).replace("{level}", String(newLevel));
            await ch.send({ embeds: [new LEB().setColor(lc.embedColor ?? 0x2b2d31).setDescription(`${CE.trophy.str} ${lvMsg}`).setThumbnail(mem.displayAvatarURL()).setFooter({ text: `Level ${newLevel} (VC)` })] }).catch(() => {});
          }
        }
      } catch (err) { logger.warn({ err }, "Levels XP error (VC)"); }
    }
  });

    let loginSuccess = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (!loginSuccess && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        logger.info({ attempt: attempts }, "Logging into Discord Gateway...");
        console.log(`[boot] [${new Date().toISOString()}] Attempting client.login() (Attempt ${attempts}/${MAX_ATTEMPTS})`);
        
        // Wait up to 3 minutes for the login to resolve
        const loginPromise = client.login(token);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Discord login TIMED OUT after 180 seconds")), 180000)
        );
        
        await Promise.race([loginPromise, timeoutPromise]);
        console.log(`[boot] [${new Date().toISOString()}] client.login() resolved`);
        loginSuccess = true;
      } catch (err: any) {
        console.error(`[boot] [${new Date().toISOString()}] Attempt ${attempts} failed:`, err.message || err);
        if (attempts >= MAX_ATTEMPTS) {
          isBotStartingOrStarted = false;
          try { client.destroy(); } catch {}
          (globalThis as any).__discordClient = null;
          logger.error({ err: err?.message || String(err), attempts }, "Discord bot login failed after max attempts");
          throw err;
        }
        
        const delay = Math.min(30000 * Math.pow(2, attempts - 1), 300000); // Exponential backoff up to 5 mins
        console.log(`[boot] Waiting ${delay / 1000}s before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } catch (outerErr: any) {
    isBotStartingOrStarted = false;
    (globalThis as any).__discordClient = null;
    throw outerErr;
  }
}


