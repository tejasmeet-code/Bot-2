import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Load .env dynamically if it exists across workspace locations
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "artifacts/api-server/.env"),
  path.resolve(process.cwd(), "artifacts/api-server/src/discord/storage/.env"),
  path.resolve(process.cwd(), "../../.env"),
];
let loadedEnv = false;
for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedEnv = true;
    break;
  }
}
if (!loadedEnv) {
  dotenv.config();
}

import express from "express";
import app from "./app";
import { logger } from "./lib/logger";
import { startDiscordBot } from "./discord/client";
import { getDashboardHtml } from "./dashboardView";

process.stdout?.on?.("error", (err: any) => {
  if (err?.code === "EPIPE") return;
});

process.stderr?.on?.("error", (err: any) => {
  if (err?.code === "EPIPE") return;
});

process.on("uncaughtException", (err: any) => {
  if (err?.code === "EPIPE" || err?.message?.includes("EPIPE")) {
    return; // Ignore stream pipe errors silently
  }
  logger.error({ err }, "Uncaught Exception");
});

process.on("unhandledRejection", (reason: any) => {
  if (reason && typeof reason === "object" && Object.keys(reason).length === 0) {
    logger.debug("Unhandled Rejection: empty object");
    return;
  }
  const errorDetails = reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason;
  logger.error({ reason: errorDetails }, "Unhandled Rejection");
});

const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get(["/golden-zenith-avatar.png", "/assets/golden-zenith-avatar.png", "/avatar/premium.png"], (_req, res) => {
  const candidates = [
    path.resolve(process.cwd(), "artifacts/api-server/src/assets/golden-zenith-avatar.png"),
    path.resolve(process.cwd(), "artifacts/api-server/public/golden-zenith-avatar.png"),
    path.resolve(process.cwd(), "dist/golden-zenith-avatar.png"),
    path.resolve(process.cwd(), "public/golden-zenith-avatar.png"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(c);
    }
  }
  res.status(404).send("Avatar image not found");
});

app.get(["/golden-zenith-avatar.svg", "/assets/golden-zenith-avatar.svg"], (_req, res) => {
  const candidates = [
    path.resolve(process.cwd(), "artifacts/api-server/src/assets/golden-zenith-avatar.svg"),
    path.resolve(process.cwd(), "artifacts/api-server/public/golden-zenith-avatar.svg"),
    path.resolve(process.cwd(), "dist/golden-zenith-avatar.svg"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      res.setHeader("Content-Type", "image/svg+xml");
      return res.sendFile(c);
    }
  }
  res.status(404).send("Avatar vector not found");
});

app.get(["/health", "/healthz", "/_health"], (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get(["/", "/dashboard", "/admin", "/panel", "/dashboard.html"], (req, res) => {
  if (req.headers.accept?.includes("text/plain")) {
    res.send("Bot is online and healthy!");
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(getDashboardHtml());
});

import os from "os";
import { version as djsVersion } from "discord.js";

// Respect Pterodactyl's SERVER_PORT or Render's PORT environment variable, defaulting to 3000 for local dev
const PORT_STR = process.env.SERVER_PORT || process.env.PORT || "3000";
const port = parseInt(PORT_STR, 10);

const INSTANCE_ID = "INST_" + Math.random().toString(36).substring(2, 10).toUpperCase();
process.env.INSTANCE_ID = INSTANCE_ID;

const GIT_COMMIT_HASH = "cb19031ab1533a6b7866029e027790bee6dd3fcb";
logger.info({
  instanceId: INSTANCE_ID,
  pid: process.pid,
  hostname: os.hostname(),
  commitHash: GIT_COMMIT_HASH,
  branch: "main",
  djsVersion,
}, `[STARTUP] Zenith Bot starting from commit ${GIT_COMMIT_HASH}`);

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port, commitHash: GIT_COMMIT_HASH, instanceId: INSTANCE_ID }, `HTTP server listening on port ${port} (git commit ${GIT_COMMIT_HASH})`);
  
  // Print standard Pterodactyl startup strings to guarantee detection across all possible egg variations
  console.log(`Ready. Zenith Bot is fully online and listening on port ${port}`);
  console.log(`listening on port ${port}`);
  console.log(`listening on 0.0.0.0:${port}`);
  console.log(`Server listening on port ${port}`);
  console.log(`Server started on port ${port}`);
  console.log(`yolks nodejs startup`);
  console.log(`Ready`);
  console.log(`Ready.`);
  console.log(`Ready!`);
  console.log(`Online`);
  console.log(`Online.`);
  console.log(`Online!`);
  console.log(`Bot is online`);
  console.log(`Bot is online!`);
  console.log(`Server started`);
  console.log(`Server running`);
  console.log(`change this text 1`);
  console.log(`change this text 2`);
});

server.on("error", (err) => {
  logger.error({ err }, "Express server error");
});

// Discord bot hosting logic:
const isAiStudio = Boolean(
  process.env.K_SERVICE || 
  process.env.GOOGLE_RUNTIME || 
  process.env.APPLET_ID ||
  (process.env.APP_URL && process.env.APP_URL.includes("run.app"))
);

const isCloudHost = Boolean(
  (process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.PORT ||
    process.env.PTERODACTYL_SERVER ||
    process.env.HEAVEN_CLOUD_API ||
    process.env.START_DISCORD_BOT === "true") &&
    !isAiStudio
);
const envStartSetting = process.env.START_DISCORD_BOT;
const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const hasBotToken = Boolean(token && token.trim().length > 10);

const shouldStartBot = hasBotToken && (isCloudHost || envStartSetting === "true") && envStartSetting !== "false" && !isAiStudio;
if (shouldStartBot) {
  logger.info({ isCloudHost, envStartSetting }, "Starting Zenith Bot Discord gateway on cloud host...");
  startDiscordBot().then(() => {
    console.log("Ready. Zenith Bot is fully online.");
  }).catch((err) => {
    logger.error({ err }, "Discord bot failed to start — check DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID");
  });
} else if (!isCloudHost) {
  logger.info("Discord bot gateway connection disabled in local preview — configured to host on cloud exclusively.");
  console.log("Ready. Local bot is running.");
} else if (!hasBotToken) {
  logger.warn("Discord bot process skipped: DISCORD_BOT_TOKEN is missing or empty in environment variables.");
  console.log("Ready. Bot is running (web only).");
} else {
  logger.info("Discord bot process skipped: START_DISCORD_BOT is set to false.");
  console.log("Ready. Bot is running (web only).");
}

// ── 24/7 Keep-Alive Background Heartbeat System ──
// Self-pings the application health check endpoint periodically to maintain 100% active state & prevent hibernation
const KEEP_ALIVE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
setInterval(async () => {
  try {
    const localUrl = `http://127.0.0.1:${port}/health`;
    await fetch(localUrl, { signal: AbortSignal.timeout(4000) }).catch(() => {});
    
    // If an external deployment URL is configured, ping it as well to keep Cloud Run instance active
    const externalUrl = process.env.APP_URL || process.env.PUBLIC_URL || process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/health` : null;
    if (externalUrl) {
      await fetch(externalUrl, { signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
  } catch {}
}, KEEP_ALIVE_INTERVAL_MS);

// ── Self-Healing Low-Resource Pterodactyl Monitor ──
// Programmatically tracks memory limits and automatically garbage-collects or flushes caches when approaching limit
function getContainerMemoryLimitMb(): number {
  if (process.env.SERVER_MEMORY) {
    const parsed = parseInt(process.env.SERVER_MEMORY, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  try {
    if (fs.existsSync("/sys/fs/cgroup/memory.max")) {
      const content = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      if (content && content !== "max") {
        const bytes = parseInt(content, 10);
        if (bytes > 0) return Math.round(bytes / 1024 / 1024);
      }
    }
  } catch {}
  try {
    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      const content = fs.readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8").trim();
      const bytes = parseInt(content, 10);
      if (bytes > 0 && bytes < 9007199254740991) {
        return Math.round(bytes / 1024 / 1024);
      }
    }
  } catch {}
  return 512;
}

const SERVER_MEMORY_LIMIT_MB = getContainerMemoryLimitMb();
if (SERVER_MEMORY_LIMIT_MB > 0) {
  logger.info({ memoryLimitMb: SERVER_MEMORY_LIMIT_MB }, "Pterodactyl self-healing resource monitor active");
  
  setInterval(async () => {
    try {
      const usageBytes = process.memoryUsage().rss;
      const usageMb = Math.round(usageBytes / 1024 / 1024);
      
      // If memory exceeds 80% of limit, flush caches & trigger GC
      if (usageMb >= SERVER_MEMORY_LIMIT_MB * 0.80) {
        logger.warn({ usageMb, limitMb: SERVER_MEMORY_LIMIT_MB }, "Low resource alert: Approaching memory limits! Flushing caches programmatically.");
        
        try {
          const { searchResultCache, sourceOptionCache } = await import("./discord/music/musicManager");
          searchResultCache.clear();
          sourceOptionCache.clear();
          logger.info("Internal search result and source caches cleared successfully");
        } catch (err) {
          logger.debug({ err }, "Could not resolve musicManager caches for garbage collection");
        }
        
        // Force trigger V8 Garbage Collection if flag is enabled
        if (typeof (global as any).gc === "function") {
          logger.info("Triggering V8 Garbage Collection programmatically");
          (global as any).gc();
        }
      }
    } catch (monitorErr) {
      logger.debug({ monitorErr }, "Resource monitor check warning");
    }
  }, 45 * 1000); // Check memory every 45 seconds
}

// ── Graceful Shutdown ──
function handleShutdown(signal: string) {
  logger.info({ signal }, `[SHUTDOWN] Received ${signal}, closing HTTP server and terminating...`);
  server.close(() => {
    logger.info("[SHUTDOWN] HTTP server closed. Exiting process.");
    process.exit(0);
  });
  
  // Force exit after 3 seconds if handles remain open
  setTimeout(() => {
    logger.warn("[SHUTDOWN] Forced exit due to open handles.");
    process.exit(0);
  }, 3000);
}
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

