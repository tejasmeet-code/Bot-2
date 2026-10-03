import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Client,
  type Guild,
  PermissionFlagsBits,
} from "discord.js";
import { logger } from "../../lib/logger";
import { dataFile } from "../../lib/paths";
import { CE, updateCustomEmoji } from "./embedStyle";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EmojiAssetSpec {
  key: string;
  file: string;
  name: string;
}

export const ATTACHED_EMOJI_SPECS: EmojiAssetSpec[] = [
  { key: "rank1", file: "rank1.png", name: "rank1" },
  { key: "rank2", file: "rank2.png", name: "rank2" },
  { key: "automod", file: "automod.png", name: "automod" },
  { key: "ban", file: "ban.png", name: "ban" },
  { key: "bullseye", file: "bullseye.png", name: "bullseye" },
  { key: "cashout", file: "cashout.png", name: "cashout" },
  { key: "chart", file: "chart.png", name: "chart" },
  { key: "check_no", file: "check_no.png", name: "check_no" },
  { key: "check_yes", file: "check_yes.png", name: "check_yes" },
  { key: "dead", file: "dead.png", name: "dead" },
  { key: "delete", file: "delete.png", name: "delete" },
  { key: "dm_sent", file: "dm_sent.png", name: "dm_sent" },
  { key: "eightball", file: "eightball.png", name: "eightball" },
  { key: "error", file: "error.png", name: "error" },
  { key: "failure", file: "failure.png", name: "failure" },
  { key: "fortune", file: "fortune.png", name: "fortune" },
  { key: "giveaway", file: "giveaway.png", name: "giveaway" },
  { key: "locked", file: "locked.png", name: "locked" },
  { key: "mute_icon", file: "mute_icon.png", name: "mute_icon" },
  { key: "nuke", file: "nuke.png", name: "nuke" },
  { key: "roulette", file: "roulette.png", name: "roulette" },
  { key: "scramble", file: "scramble.png", name: "scramble" },
  { key: "ship", file: "ship.png", name: "ship" },
  { key: "soulmates", file: "soulmates.png", name: "soulmates" },
  { key: "streak", file: "streak.png", name: "streak" },
  { key: "success", file: "success.png", name: "success" },
  { key: "thinking", file: "thinking.png", name: "thinking" },
  { key: "ticket", file: "ticket.png", name: "ticket" },
  { key: "trophy", file: "trophy.png", name: "trophy" },
  { key: "warning", file: "warning.png", name: "warning" },
];

/** Resolve the location of attached_assets */
export function findAssetsDir(): string | null {
  const candidateDirs = [
    path.resolve(process.cwd(), "attached_assets"),
    path.resolve(process.cwd(), "../attached_assets"),
    path.resolve(process.cwd(), "../../attached_assets"),
    "/attached_assets",
    path.resolve(__dirname, "../../../../../attached_assets"),
    path.resolve(__dirname, "../../../../attached_assets"),
  ];

  for (const dir of candidateDirs) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/** Find the target Dev Server guild */
export function findDevGuild(client: Client): Guild | null {
  // Priority: Relosta bot dev, Relosta Media, God’s eye
  const targetNames = [/relosta\s+bot\s+dev/i, /relosta\s+media/i, /god'?s\s+eye/i];
  for (const regex of targetNames) {
    const found = client.guilds.cache.find((g) => regex.test(g.name));
    if (found) return found;
  }

  // 1. Explicit target: name matches "zenith" + "dev"
  const zenithDev = client.guilds.cache.find(
    (g) => /zenith/i.test(g.name) && /dev/i.test(g.name),
  );
  if (zenithDev) return zenithDev;

  // 2. Name matches "dev"
  const devGuild = client.guilds.cache.find((g) => /\bdev\b/i.test(g.name));
  if (devGuild) return devGuild;

  // 3. Name matches "zenith"
  const zenithGuild = client.guilds.cache.find((g) => /zenith/i.test(g.name));
  if (zenithGuild) return zenithGuild;

  // 4. Any guild where bot has ManageGuildExpressions or Administrator permissions
  const permGuild = client.guilds.cache.find((g) => {
    const me = g.members.me;
    return (
      me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions) ||
      me?.permissions.has(PermissionFlagsBits.Administrator)
    );
  });
  if (permGuild) return permGuild;

  return client.guilds.cache.first() || null;
}

const CUSTOM_EMOJIS_FILE = dataFile("custom_emojis.json");

/** Load previously saved custom emojis into the CE object */
export function loadSavedCustomEmojis(): void {
  try {
    if (fs.existsSync(CUSTOM_EMOJIS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_EMOJIS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [k, val] of Object.entries(parsed)) {
          if (val && typeof val === "object" && "str" in val) {
            updateCustomEmoji(k, val as any);
          }
        }
        logger.info(
          { count: Object.keys(parsed).length },
          "Loaded persistent custom emojis into CE registry",
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not load saved custom emojis");
  }
}

/**
 * Upload all old emojis from attached_assets to the Zenith Bot Dev Server,
 * then update the CE registry and persist the mapping so bots always use
 * pure custom emojis.
 */
export async function syncDevServerEmojis(client: Client<true>): Promise<{
  synced: number;
  existing: number;
  uploaded: number;
  failed: number;
  targetGuildName: string;
}> {
  loadSavedCustomEmojis();

  const devGuild = findDevGuild(client);
  if (!devGuild) {
    logger.warn("No Dev server found in bot guild cache for emoji sync");
    return { synced: 0, existing: 0, uploaded: 0, failed: 0, targetGuildName: "None" };
  }

  logger.info(
    { guildId: devGuild.id, guildName: devGuild.name },
    "Found Dev server for custom emoji synchronization",
  );

  const assetsDir = findAssetsDir();
  if (!assetsDir) {
    logger.warn("attached_assets directory not found for emoji synchronization");
  }

  // Fetch current emojis from target guild
  try {
    await devGuild.emojis.fetch();
  } catch (err) {
    logger.warn({ err }, "Failed to fetch guild emojis from dev server");
  }

  let existing = 0;
  let uploaded = 0;
  let failed = 0;
  const emojiMap: Record<string, { str: string; id: string; name: string; animated: boolean }> = {};

  // Check bot permissions and emoji slot limits on target guild
  const me = devGuild.members.me;
  const canManageEmojis = me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions) || me?.permissions.has(PermissionFlagsBits.Administrator);
  const isEmojiLimitReached = devGuild.emojis.cache.size >= 50;

  for (const spec of ATTACHED_EMOJI_SPECS) {
    try {
      // 1. Check if the emoji already exists on the dev guild
      let targetEmoji = devGuild.emojis.cache.find(
        (e) => e.name?.toLowerCase() === spec.name.toLowerCase(),
      );

      // Also check if any guild the bot is in has this emoji
      if (!targetEmoji) {
        targetEmoji = client.emojis.cache.find(
          (e) => e.name?.toLowerCase() === spec.name.toLowerCase(),
        );
      }

      if (targetEmoji) {
        existing++;
        const data = {
          str: targetEmoji.toString(),
          id: targetEmoji.id,
          name: targetEmoji.name || spec.name,
          animated: Boolean(targetEmoji.animated),
        };
        updateCustomEmoji(spec.key, data);
        emojiMap[spec.key] = data;
        continue;
      }

      // 2. Not found, upload it to the Dev server if bot has permissions and slots available
      if (assetsDir && canManageEmojis && !isEmojiLimitReached) {
        const filePath = path.join(assetsDir, spec.file);
        if (fs.existsSync(filePath)) {
          let buffer = await fsp.readFile(filePath);
          try {
            const sharp = (await import("sharp" as any)).default;
            buffer = await sharp(buffer)
              .resize(128, 128, { fit: "inside" })
              .png({ quality: 90, compressionLevel: 9 })
              .toBuffer();
          } catch (sharpErr) {
            logger.debug({ sharpErr }, "Sharp resizing skipped, using raw buffer");
          }

          const created = await devGuild.emojis.create({
            attachment: buffer,
            name: spec.name,
            reason: "Zenith bot Dev server emoji sync",
          }).catch(() => null);

          if (created) {
            uploaded++;
            const data = {
              str: created.toString(),
              id: created.id,
              name: created.name || spec.name,
              animated: Boolean(created.animated),
            };
            updateCustomEmoji(spec.key, data);
            emojiMap[spec.key] = data;
            logger.info({ name: spec.name, id: created.id }, "Uploaded custom emoji to Dev server");
            continue;
          }
        }
      }

      // Fallback: if not found and cannot upload, ensure CE has a custom emoji (never default)
      if (CE[spec.key as keyof typeof CE]) {
        emojiMap[spec.key] = CE[spec.key as keyof typeof CE] as any;
      }
    } catch (err: any) {
      failed++;
      logger.debug(
        { err: err?.message || err, name: spec.name },
        "Custom emoji upload skipped or unavailable",
      );
    }
  }

  // Persist updated emoji map to disk
  try {
    const parentDir = path.dirname(CUSTOM_EMOJIS_FILE);
    await fsp.mkdir(parentDir, { recursive: true });
    let existingMap = {};
    if (fs.existsSync(CUSTOM_EMOJIS_FILE)) {
      try {
        existingMap = JSON.parse(fs.readFileSync(CUSTOM_EMOJIS_FILE, "utf8"));
      } catch {
        // ignore
      }
    }
    const merged = { ...existingMap, ...emojiMap };
    await fsp.writeFile(CUSTOM_EMOJIS_FILE, JSON.stringify(merged, null, 2), "utf8");
    logger.info(
      { total: Object.keys(merged).length, file: CUSTOM_EMOJIS_FILE },
      "Saved synchronized custom emojis to disk",
    );
  } catch (err) {
    logger.warn({ err }, "Failed to write custom_emojis.json");
  }

  return {
    synced: existing + uploaded,
    existing,
    uploaded,
    failed,
    targetGuildName: devGuild.name,
  };
}
