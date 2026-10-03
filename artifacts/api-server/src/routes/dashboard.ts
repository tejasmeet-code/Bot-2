import { Router, type IRouter, type Request, type Response } from "express";
import os from "os";
import * as fs from "fs";
import * as path from "path";
import { ActivityType, ChannelType, PermissionFlagsBits } from "discord.js";
import { getDiscordClient } from "../discord/client";
import { getCommands } from "../discord/registry";
import {
  getBotStaff,
  setBotStaffRole,
  removeBotStaffRole,
  BOT_STAFF_ROLES,
  type BotStaffRole,
} from "../discord/storage/botStaff";
import {
  listActivePremiums,
  grantDirectPremium,
  removeDirectPremium,
  PERMANENT_BOT_OWNER_ID,
  isPermanentOwner,
} from "../discord/storage/premium";
import {
  listPermWhitelist,
  addToPermWhitelist,
  removeFromPermWhitelist,
} from "../discord/storage/whitelist";
import { prettyEmbed, COLORS } from "../discord/utils/embedStyle";
import { getGatewayHealthReport } from "../discord/storage/gatewayHealth";
import { getGuildConfig, updateGuildConfig } from "../discord/storage/config";
import { DEFAULT_PREFIX } from "../discord/messageHandler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── GET /api/dashboard/overview ──────────────────────────────────────────────
router.get("/overview", async (_req: Request, res: Response): Promise<void> => {
  try {
    const client = getDiscordClient();
    const isReady = client?.isReady() ?? false;
    const botUser = client?.user;

    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const guilds = client?.guilds?.cache ? Array.from(client.guilds.cache.values()) : [];
    const totalUsers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    const totalChannels = client?.channels?.cache?.size || 0;
    const totalEmojis = client?.emojis?.cache?.size || 0;
    const commandsCount = getCommands().length;

    const wsPing = isReady ? Math.max(0, Math.round(client.ws.ping)) : 0;

    res.json({
      online: isReady,
      statusText: isReady ? "Bot is online and healthy!" : "Bot is starting up...",
      bot: {
        id: botUser?.id || process.env.DISCORD_CLIENT_ID || "Unknown",
        username: botUser?.username || "Zenith Bot",
        tag: botUser?.tag || "Zenith#0000",
        avatar: botUser?.displayAvatarURL({ size: 256 }) || null,
        verified: botUser?.verified || false,
        activity: botUser?.presence?.activities[0]?.name || "Online & Protecting Servers",
      },
      stats: {
        wsPing,
        uptimeSeconds: Math.floor(process.uptime()),
        hostUptimeSeconds: Math.floor(os.uptime()),
        guildsCount: guilds.length,
        usersCount: totalUsers,
        channelsCount: totalChannels,
        emojisCount: totalEmojis,
        commandsCount,
        shardId: 0,
        totalShards: 1,
      },
      system: {
        memory: {
          heapUsedMB: (mem.heapUsed / (1024 * 1024)).toFixed(1),
          heapTotalMB: (mem.heapTotal / (1024 * 1024)).toFixed(1),
          rssMB: (mem.rss / (1024 * 1024)).toFixed(1),
          totalMemGB: (totalMem / (1024 * 1024 * 1024)).toFixed(2),
          freeMemGB: (freeMem / (1024 * 1024 * 1024)).toFixed(2),
          usedMemGB: (usedMem / (1024 * 1024 * 1024)).toFixed(2),
          memPercent: Math.round((usedMem / totalMem) * 100),
        },
        cpu: {
          cores: os.cpus().length || 2,
          model: os.cpus()[0]?.model || "Cloud Compute vCPU",
          speed: os.cpus()[0]?.speed ? `${(os.cpus()[0].speed / 1000).toFixed(2)} GHz` : "2.80 GHz",
          loadAvg: os.loadavg().map((l) => l.toFixed(2)).join(", "),
        },
        nodeVersion: process.version,
        platform: `${os.type()} ${os.arch()}`,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching dashboard overview");
    res.status(500).json({ error: err.message || "Failed to load overview" });
  }
});

// ── GET /api/dashboard/guilds ────────────────────────────────────────────────
router.get("/guilds", (_req: Request, res: Response): void => {
  try {
    const client = getDiscordClient();
    if (!client?.isReady()) {
      res.json({ guilds: [] });
      return;
    }

    const guilds = Array.from(client.guilds.cache.values()).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ size: 128 }) || null,
      memberCount: g.memberCount,
      ownerId: g.ownerId,
      joinedAt: g.joinedTimestamp,
      channelsCount: g.channels.cache.size,
      rolesCount: g.roles.cache.size,
      partnered: g.partnered,
      verified: g.verified,
    }));

    guilds.sort((a, b) => b.memberCount - a.memberCount);

    res.json({ guilds, total: guilds.length });
  } catch (err: any) {
    logger.error({ err }, "Error fetching guilds");
    res.status(500).json({ error: err.message || "Failed to fetch guilds" });
  }
});

// ── POST /api/dashboard/guilds/leave ─────────────────────────────────────────
router.post("/guilds/leave", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.body;
    if (!guildId || typeof guildId !== "string") {
      res.status(400).json({ error: "guildId is required" });
      return;
    }

    const client = getDiscordClient();
    const guild = client?.guilds?.cache?.get(guildId.trim());
    if (!guild) {
      res.status(404).json({ error: "Guild not found or bot already left" });
      return;
    }

    const guildName = guild.name;
    await guild.leave();
    logger.info({ guildId, guildName }, "Bot left guild via web dashboard");

    res.json({
      success: true,
      message: `Successfully left server: ${guildName} (${guildId})`,
    });
  } catch (err: any) {
    logger.error({ err }, "Error leaving guild via dashboard");
    res.status(500).json({ error: err.message || "Failed to leave guild" });
  }
});

// ── GET /api/dashboard/staff ─────────────────────────────────────────────────
router.get("/staff", async (_req: Request, res: Response): Promise<void> => {
  try {
    const client = getDiscordClient();
    const staffRecord = await getBotStaff();

    const staffList = await Promise.all(
      Object.values(staffRecord).map(async (s) => {
        let username = "Discord User";
        let avatar: string | null = null;
        if (client) {
          try {
            const user = await client.users.fetch(s.userId).catch(() => null);
            if (user) {
              username = user.tag || user.username;
              avatar = user.displayAvatarURL({ size: 128 });
            }
          } catch {}
        }
        return {
          userId: s.userId,
          role: s.role,
          assignedAt: s.assignedAt,
          assignedBy: s.assignedBy,
          username,
          avatar,
          roleMeta: BOT_STAFF_ROLES[s.role] || null,
        };
      }),
    );

    const roleRank: Record<string, number> = {
      owner: 5,
      co_owner: 4,
      admin: 3,
      mod: 2,
      help: 1,
    };
    staffList.sort((a, b) => (roleRank[b.role] || 0) - (roleRank[a.role] || 0));

    res.json({
      staff: staffList,
      roles: BOT_STAFF_ROLES,
      permanentOwnerId: PERMANENT_BOT_OWNER_ID,
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching bot staff");
    res.status(500).json({ error: err.message || "Failed to fetch bot staff" });
  }
});

// ── POST /api/dashboard/staff/appoint ────────────────────────────────────────
router.post("/staff/appoint", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Valid userId string is required" });
      return;
    }
    const cleanId = userId.trim().replace(/[<@!>]/g, "");
    if (!/^\d{17,20}$/.test(cleanId)) {
      res.status(400).json({ error: "Invalid Discord Snowflake User ID format" });
      return;
    }

    const validRoles: BotStaffRole[] = ["owner", "co_owner", "admin", "mod", "help"];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      return;
    }

    const client = getDiscordClient();
    const result = await setBotStaffRole(cleanId, role, "Dashboard Admin", client);

    logger.info({ userId: cleanId, role }, "Appointed bot staff member via dashboard");

    res.json({
      success: true,
      message: `Successfully appointed <@${cleanId}> to ${role.toUpperCase()}`,
      dmSent: result.dmSent,
      member: result.member,
    });
  } catch (err: any) {
    logger.error({ err }, "Error appointing bot staff via dashboard");
    res.status(500).json({ error: err.message || "Failed to appoint staff" });
  }
});

// ── POST /api/dashboard/staff/remove ─────────────────────────────────────────
router.post("/staff/remove", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const cleanId = userId.trim().replace(/[<@!>]/g, "");

    const removed = await removeBotStaffRole(cleanId);
    if (!removed) {
      res.status(404).json({ error: "User is not currently an appointed staff member" });
      return;
    }

    logger.info({ userId: cleanId }, "Removed bot staff member via dashboard");
    res.json({ success: true, message: `Successfully removed staff member ${cleanId}` });
  } catch (err: any) {
    logger.error({ err }, "Error removing bot staff via dashboard");
    res.status(500).json({ error: err.message || "Failed to remove staff" });
  }
});

// ── GET /api/dashboard/premium ───────────────────────────────────────────────
router.get("/premium", async (_req: Request, res: Response): Promise<void> => {
  try {
    const client = getDiscordClient();
    const active = await listActivePremiums();

    const users = await Promise.all(
      active.users.map(async (u) => {
        let username = "Discord User";
        let avatar: string | null = null;
        if (client) {
          try {
            const user = await client.users.fetch(u.id).catch(() => null);
            if (user) {
              username = user.tag || user.username;
              avatar = user.displayAvatarURL({ size: 128 });
            }
          } catch {}
        }
        return {
          id: u.id,
          expiresAt: u.expiresAt,
          grantedBy: "Bot System",
          username,
          avatar,
          isPermanent: isPermanentOwner(u.id) || u.expiresAt > Date.now() + 1000 * 86400 * 1000,
        };
      }),
    );

    const guilds = active.guilds.map((g) => {
      const guild = client?.guilds?.cache?.get(g.id);
      return {
        id: g.id,
        expiresAt: g.expiresAt,
        grantedBy: "Bot System",
        name: guild?.name || "Unknown Server",
        icon: guild?.iconURL({ size: 128 }) || null,
        isPermanent: g.expiresAt > Date.now() + 1000 * 86400 * 1000,
      };
    });

    res.json({
      users,
      guilds,
      permanentOwnerId: PERMANENT_BOT_OWNER_ID,
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching premium list");
    res.status(500).json({ error: err.message || "Failed to fetch premium list" });
  }
});

// ── POST /api/dashboard/premium/grant ────────────────────────────────────────
router.post("/premium/grant", async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetId, targetType, days } = req.body;
    if (!targetId || typeof targetId !== "string") {
      res.status(400).json({ error: "targetId is required" });
      return;
    }
    const cleanId = targetId.trim().replace(/[<@!&#>]/g, "");
    if (!/^\d{17,20}$/.test(cleanId)) {
      res.status(400).json({ error: "Invalid Discord ID format" });
      return;
    }

    if (targetType !== "user" && targetType !== "guild" && targetType !== "server") {
      res.status(400).json({ error: "targetType must be 'user' or 'server'" });
      return;
    }

    const mappedType: "user" | "server" = targetType === "guild" ? "server" : (targetType as "user" | "server");
    const numDays = Math.max(1, parseInt(days || "365", 10));
    await grantDirectPremium(cleanId, mappedType, numDays);

    logger.info({ cleanId, mappedType, numDays }, "Granted direct premium via dashboard");

    res.json({
      success: true,
      message: `Granted ${numDays} days of Premium to ${mappedType.toUpperCase()} ${cleanId}`,
    });
  } catch (err: any) {
    logger.error({ err }, "Error granting premium via dashboard");
    res.status(500).json({ error: err.message || "Failed to grant premium" });
  }
});

// ── POST /api/dashboard/premium/revoke ───────────────────────────────────────
router.post("/premium/revoke", async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetId, targetType } = req.body;
    if (!targetId || typeof targetId !== "string") {
      res.status(400).json({ error: "targetId is required" });
      return;
    }
    const cleanId = targetId.trim().replace(/[<@!&#>]/g, "");

    if (targetType !== "user" && targetType !== "guild" && targetType !== "server") {
      res.status(400).json({ error: "targetType must be 'user' or 'server'" });
      return;
    }

    const mappedType: "user" | "server" = targetType === "guild" ? "server" : (targetType as "user" | "server");
    await removeDirectPremium(cleanId, mappedType);
    logger.info({ cleanId, mappedType }, "Revoked direct premium via dashboard");

    res.json({
      success: true,
      message: `Revoked Premium from ${mappedType.toUpperCase()} ${cleanId}`,
    });
  } catch (err: any) {
    logger.error({ err }, "Error revoking premium via dashboard");
    res.status(500).json({ error: err.message || "Failed to revoke premium" });
  }
});

// ── GET /api/dashboard/whitelist ─────────────────────────────────────────────
router.get("/whitelist", async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await listPermWhitelist();
    res.json({
      base: list.base,
      extras: list.extras,
      permanentOwnerId: PERMANENT_BOT_OWNER_ID,
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching whitelist");
    res.status(500).json({ error: err.message || "Failed to fetch whitelist" });
  }
});

// ── POST /api/dashboard/whitelist/add ────────────────────────────────────────
router.post("/whitelist/add", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const cleanId = userId.trim().replace(/[<@!>]/g, "");
    if (!/^\d{17,20}$/.test(cleanId)) {
      res.status(400).json({ error: "Invalid Discord Snowflake User ID" });
      return;
    }

    await addToPermWhitelist(cleanId);
    res.json({ success: true, message: `Added ${cleanId} to permanent bot whitelist` });
  } catch (err: any) {
    logger.error({ err }, "Error adding to whitelist");
    res.status(500).json({ error: err.message || "Failed to add to whitelist" });
  }
});

// ── POST /api/dashboard/whitelist/remove ─────────────────────────────────────
router.post("/whitelist/remove", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const cleanId = userId.trim().replace(/[<@!>]/g, "");

    const success = await removeFromPermWhitelist(cleanId);
    if (!success) {
      res.status(400).json({ error: "User is in base whitelist or not found" });
      return;
    }
    res.json({ success: true, message: `Removed ${cleanId} from permanent bot whitelist` });
  } catch (err: any) {
    logger.error({ err }, "Error removing from whitelist");
    res.status(500).json({ error: err.message || "Failed to remove from whitelist" });
  }
});

// ── POST /api/dashboard/broadcast ────────────────────────────────────────────
router.post("/broadcast", async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, title } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Broadcast message text is required" });
      return;
    }

    const client = getDiscordClient();
    if (!client?.isReady()) {
      res.status(503).json({ error: "Discord bot client is not connected" });
      return;
    }

    const guilds = Array.from(client.guilds.cache.values());
    let sentCount = 0;
    let failedCount = 0;

    const embed = prettyEmbed({
      title: title?.trim() || "Official Bot Broadcast Announcement",
      description: message.trim(),
      color: COLORS.primary,
      footer: "Zenith Central Operations Dashboard",
    });

    for (const guild of guilds) {
      try {
        let targetChannel = null;
        if (
          guild.systemChannel &&
          guild.systemChannel
            .permissionsFor(guild.members.me!)
            ?.has(PermissionFlagsBits.SendMessages)
        ) {
          targetChannel = guild.systemChannel;
        } else {
          targetChannel =
            (guild.channels.cache.find(
              (c) =>
                c.type === ChannelType.GuildText &&
                c.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.SendMessages),
            ) as any) ?? null;
        }

        if (targetChannel) {
          await targetChannel.send({ embeds: [embed] });
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    logger.info({ sentCount, failedCount }, "Global broadcast dispatched from web dashboard");
    res.json({
      success: true,
      message: `Broadcast delivered to ${sentCount} servers (${failedCount} failed or lacked permissions)`,
      sentCount,
      failedCount,
    });
  } catch (err: any) {
    logger.error({ err }, "Error broadcasting from dashboard");
    res.status(500).json({ error: err.message || "Failed to broadcast message" });
  }
});

// ── POST /api/dashboard/bot/activity ─────────────────────────────────────────
router.post("/bot/activity", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Activity name is required" });
      return;
    }

    const client = getDiscordClient();
    if (!client?.user) {
      res.status(503).json({ error: "Discord bot client user not available" });
      return;
    }

    let actType = ActivityType.Playing;
    if (type === "Watching") actType = ActivityType.Watching;
    else if (type === "Listening") actType = ActivityType.Listening;
    else if (type === "Competing") actType = ActivityType.Competing;

    client.user.setPresence({
      activities: [{ name: name.trim(), type: actType }],
      status: "online",
    });

    res.json({ success: true, message: `Presence updated to "${type || 'Playing'} ${name}"` });
  } catch (err: any) {
    logger.error({ err }, "Error setting activity");
    res.status(500).json({ error: err.message || "Failed to update activity" });
  }
});

// ── GET /api/dashboard/hosting-health ───────────────────────────────────────
router.get("/hosting-health", async (_req: Request, res: Response): Promise<void> => {
  try {
    const client = getDiscordClient();
    const isReady = client?.isReady() ?? false;
    const report = getGatewayHealthReport();

    res.json({
      online: isReady,
      report,
      guide: {
        cause: "When a Discord Bot Token is stored on old hosting providers (e.g. previous Replit instances, Render, Railway, Heroku, or an old local terminal process), both servers log in simultaneously.",
        symptoms: [
          "Discord Gateway rapidly disconnects and reconnects (Gateway 4004 / 4000 errors)",
          "Bot replies twice to single messages or commands",
          "Interactions fail with 'This interaction failed' on buttons or selects",
          "Random high latency and lost Gateway heartbeat sessions",
        ],
        solutionSteps: [
          "Go to Discord Developer Portal (https://discord.com/developers/applications)",
          "Select your bot application -> Navigate to 'Bot' tab",
          "Click 'Reset Token' and confirm",
          "Copy the newly generated token and update your active environment (DISCORD_BOT_TOKEN)",
          "Restart this server — all previous hostings will immediately lose access and stop interfering!",
        ],
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching hosting health report");
    res.status(500).json({ error: err.message || "Failed to fetch hosting report" });
  }
});

// ── GET /api/dashboard/settings ─────────────────────────────────────────────
router.get("/settings", async (_req: Request, res: Response): Promise<void> => {
  try {
    const client = getDiscordClient();
    const guilds = client?.guilds?.cache ? Array.from(client.guilds.cache.values()) : [];

    const guildPrefixes = await Promise.all(
      guilds.map(async (g) => {
        const cfg = await getGuildConfig(g.id);
        return {
          guildId: g.id,
          guildName: g.name,
          icon: g.iconURL({ size: 128 }) || null,
          prefix: cfg.guildPrefix || DEFAULT_PREFIX,
          noPrefixEnabled: cfg.modules?.noPrefix ?? true,
        };
      }),
    );

    res.json({
      defaultPrefix: DEFAULT_PREFIX,
      guilds: guildPrefixes,
    });
  } catch (err: any) {
    logger.error({ err }, "Error fetching dashboard settings");
    res.status(500).json({ error: err.message || "Failed to fetch settings" });
  }
});

// ── POST /api/dashboard/settings/prefix ──────────────────────────────────────
router.post("/settings/prefix", async (req: Request, res: Response): Promise<void> => {
  try {
    const { prefix, guildId } = req.body;

    if (!prefix || typeof prefix !== "string" || !prefix.trim()) {
      res.status(400).json({ error: "Valid non-empty prefix string is required" });
      return;
    }

    const cleanPrefix = prefix.trim();
    if (cleanPrefix.length > 10) {
      res.status(400).json({ error: "Command prefix cannot exceed 10 characters" });
      return;
    }

    const client = getDiscordClient();
    const guilds = client?.guilds?.cache ? Array.from(client.guilds.cache.values()) : [];

    if (guildId && guildId !== "global" && guildId !== "all") {
      // Update prefix for a specific server guild
      await updateGuildConfig(guildId.trim(), (c) => ({
        ...c,
        guildPrefix: cleanPrefix,
      }));

      const guild = guilds.find((g) => g.id === guildId.trim());
      logger.info({ guildId, cleanPrefix }, "Updated server command prefix via dashboard");

      res.json({
        success: true,
        message: `Updated command prefix to \`${cleanPrefix}\` for server ${guild?.name || guildId}`,
        prefix: cleanPrefix,
        guildId,
      });
      return;
    }

    // Global update: update prefix across all connected servers and save to database
    let updatedCount = 0;
    for (const guild of guilds) {
      await updateGuildConfig(guild.id, (c) => ({
        ...c,
        guildPrefix: cleanPrefix,
      }));
      updatedCount++;
    }

    logger.info({ cleanPrefix, updatedCount }, "Globally updated command prefix across all servers");

    res.json({
      success: true,
      message: `Globally updated command prefix to \`${cleanPrefix}\` across all ${updatedCount} connected servers and database!`,
      prefix: cleanPrefix,
      updatedCount,
    });
  } catch (err: any) {
    logger.error({ err }, "Error updating command prefix via dashboard");
    res.status(500).json({ error: err.message || "Failed to update command prefix" });
  }
});

// ── POST /api/dashboard/settings/token ───────────────────────────────────────
router.post("/settings/token", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, clientId } = req.body;

    if (!token || typeof token !== "string" || !token.trim()) {
      res.status(400).json({ error: "Valid non-empty Discord Bot Token is required" });
      return;
    }

    const cleanToken = token.trim();
    process.env.DISCORD_BOT_TOKEN = cleanToken;
    process.env.DISCORD_TOKEN = cleanToken;
    if (clientId && typeof clientId === "string") {
      process.env.DISCORD_CLIENT_ID = clientId.trim();
    }

    // Write to root .env and api-server .env
    const envContent =
      `DISCORD_BOT_TOKEN=${cleanToken}\n` +
      `DISCORD_CLIENT_ID=${process.env.DISCORD_CLIENT_ID || ""}\n` +
      `START_DISCORD_BOT=true\n` +
      `LAVALINK_HOST=${process.env.LAVALINK_HOST || "localhost"}\n` +
      `LAVALINK_PORT=${process.env.LAVALINK_PORT || "2333"}\n` +
      `LAVALINK_PASSWORD=${process.env.LAVALINK_PASSWORD || "youshallnotpass"}\n` +
      `LAVALINK_SECURE=false\n`;

    fs.writeFileSync(path.resolve(process.cwd(), ".env"), envContent, "utf-8");
    fs.writeFileSync(path.resolve(process.cwd(), "artifacts/api-server/.env"), envContent, "utf-8");

    // Attempt to start Discord bot
    const { startDiscordBot } = await import("../discord/client");
    startDiscordBot().catch((err) => {
      logger.error({ err }, "Failed to start Discord bot with newly provided token");
    });

    res.json({
      success: true,
      message: "Discord Bot Token successfully updated in .env! Starting bot gateway connection...",
    });
  } catch (err: any) {
    logger.error({ err }, "Error updating Discord Bot Token");
    res.status(500).json({ error: err.message || "Failed to update Discord Bot Token" });
  }
});

export default router;
