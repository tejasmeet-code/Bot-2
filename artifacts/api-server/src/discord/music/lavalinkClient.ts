import { Shoukaku, Connectors, type NodeOption, type Node } from "shoukaku";
import type { Client } from "discord.js";
import { logger } from "../../lib/logger";

let shoukakuInstance: Shoukaku | null = null;
let isLavalinkNodeReady = false;

export function getShoukaku(): Shoukaku | null {
  return shoukakuInstance;
}

export function isLavalinkReady(): boolean {
  return isLavalinkNodeReady && Boolean(shoukakuInstance && shoukakuInstance.nodes.size > 0);
}

export function getLavalinkNode(): Node | null {
  if (!shoukakuInstance) return null;
  return shoukakuInstance.getIdealNode() || Array.from(shoukakuInstance.nodes.values())[0] || null;
}

export async function waitForLavalinkNode(maxWaitMs = 5000): Promise<Node | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const node = getLavalinkNode();
    if (node) return node;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

export function initLavalink(client: Client): Shoukaku {
  if (shoukakuInstance) return shoukakuInstance;

  const host = process.env.LAVALINK_HOST;
  const port = process.env.LAVALINK_PORT;
  const password = process.env.LAVALINK_PASSWORD;
  const secure = process.env.LAVALINK_SECURE === "true";

  const nodes: NodeOption[] = [];
  if (host && port && password && host !== "localhost" && host !== "127.0.0.1") {
    nodes.push({
      name: "Env-Lavalink-Node",
      url: `${host}:${port}`,
      auth: password,
      secure,
    });
  }

  // Active verified Lavalink v4 nodes
  nodes.push({
    name: "Serenetia-Lavalink-V4",
    url: "lavalink.serenetia.com:443",
    auth: "https://dsc.gg/ajidevserver",
    secure: true,
  });

  nodes.push({
    name: "MilloHost-Lavalink-V4",
    url: "lava-v4.millohost.my.id:443",
    auth: "https://discord.gg/mjS5J2K3ep",
    secure: true,
  });

  nodes.push({
    name: "DevamOp-Lavalink-V4",
    url: "lavalink.devamop.in:443",
    auth: "DevamOp",
    secure: true,
  });

  logger.info({ nodeCount: nodes.length }, "Initializing Lavalink Shoukaku client...");

  shoukakuInstance = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    resume: true,
    resumeTimeout: 60,
    reconnectTries: 30,
    reconnectInterval: 3000,
    restTimeout: 10000,
    moveOnDisconnect: true,
  });

  shoukakuInstance.on("ready", (name) => {
    isLavalinkNodeReady = true;
    logger.info({ nodeName: name }, "Lavalink Node connected and ready for audio playback!");

    import("./musicManager")
      .then((m) => m.init247Sessions(client))
      .catch(() => {});
  });

  shoukakuInstance.on("error", (name, error) => {
    logger.debug({ nodeName: name, err: error?.message }, "Lavalink Node warning/error");
  });

  shoukakuInstance.on("close", (name, code, reason) => {
    isLavalinkNodeReady = false;
    logger.debug({ nodeName: name, code, reason }, "Lavalink Node connection closed");
  });

  shoukakuInstance.on("disconnect", (name, count) => {
    isLavalinkNodeReady = false;
    logger.debug({ nodeName: name, count }, "Lavalink Node disconnected");
  });

  shoukakuInstance.on("reconnecting", (name) => {
    logger.debug({ nodeName: name }, "Reconnecting to Lavalink Node...");
  });

  return shoukakuInstance;
}

export async function resolveLavalinkTracks(query: string, searchPrefix = "ytsearch:"): Promise<any> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const isUrl = /^https?:\/\//i.test(trimmed);
  const prefixes = isUrl ? [""] : [searchPrefix, "scsearch:"];

  const shoukaku = getShoukaku();
  let node = getLavalinkNode();
  if (shoukaku && !node) {
    node = await waitForLavalinkNode(1500);
  }

  for (const p of prefixes) {
    const identifier = isUrl ? trimmed : `${p}${trimmed}`;

    if (node) {
      try {
        const res: any = await node.rest.resolve(identifier);
        if (res && res.data && (Array.isArray(res.data) ? res.data.length > 0 : (res.data as any).tracks?.length > 0 || (res.data as any).encoded)) {
          return res;
        }
      } catch (err) {
        logger.debug({ err, query: trimmed }, "Lavalink rest resolve via node error");
      }
    }

    // Direct REST API fallback across verified servers
    const publicEndpoints = [
      { url: "https://lavalink.serenetia.com/v4/loadtracks", auth: "https://dsc.gg/ajidevserver" },
      { url: "https://lava-v4.millohost.my.id/v4/loadtracks", auth: "https://discord.gg/mjS5J2K3ep" },
    ];

    for (const ep of publicEndpoints) {
      try {
        const fullUrl = `${ep.url}?identifier=${encodeURIComponent(identifier)}`;
        const resp = await fetch(fullUrl, {
          headers: { Authorization: ep.auth },
          signal: AbortSignal.timeout(3500),
        });
        if (resp.ok) {
          const json = (await resp.json()) as any;
          if (json && json.data && (Array.isArray(json.data) ? json.data.length > 0 : json.data.tracks?.length > 0 || json.data.encoded)) {
            return json;
          }
        }
      } catch {}
    }
  }

  return null;
}
