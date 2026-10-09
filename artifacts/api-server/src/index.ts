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

// Respect Render's PORT environment variable, defaulting to 3000 for local dev
const PORT_STR = process.env.PORT || "3000";
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
});

server.on("error", (err) => {
  logger.error({ err }, "Express server error");
});

// Discord bot hosting logic:
const isRenderHost = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_INSTANCE_ID);
const envStartSetting = process.env.START_DISCORD_BOT;
const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const hasBotToken = Boolean(token && token.trim().length > 10);

const shouldStartBot = hasBotToken && isRenderHost && envStartSetting !== "false";
if (shouldStartBot) {
  logger.info({ isRenderHost, envStartSetting }, "Starting Zenith Bot Discord gateway on Render host...");
  startDiscordBot().catch((err) => {
    logger.error({ err }, "Discord bot failed to start on Render — check DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID");
  });
} else if (!isRenderHost) {
  logger.info("Discord bot gateway connection disabled in local preview — configured to host on Render exclusively.");
} else if (!hasBotToken) {
  logger.warn("Discord bot process skipped on Render: DISCORD_BOT_TOKEN is missing or empty in environment variables.");
} else {
  logger.info("Discord bot process skipped on Render: START_DISCORD_BOT is set to false.");
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

