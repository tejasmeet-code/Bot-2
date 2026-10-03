import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { DATA_DIR } from "../../lib/paths";
import { logger } from "../../lib/logger";

let cachedSupabase: SupabaseClient | null = null;
let lastTestedUrl: string | undefined;
let lastTestedKey: string | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env["SUPABASE_URL"];
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_ANON_KEY"] ||
    process.env["SUPABASE_KEY"] ||
    process.env["SUPABASE_SERVICE_KEY"];

  if (!url || !key) {
    cachedSupabase = null;
    return null;
  }

  if (cachedSupabase && lastTestedUrl === url && lastTestedKey === key) {
    return cachedSupabase;
  }

  try {
    cachedSupabase = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { transport: ws as any },
    });
    lastTestedUrl = url;
    lastTestedKey = key;
    return cachedSupabase;
  } catch (err) {
    logger.warn({ err }, "Failed to initialize Supabase client");
    return null;
  }
}

export function hasPersistentSupabaseStore(): boolean {
  return Boolean(getSupabaseClient());
}

export async function getSupabaseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  tableReady: boolean;
  urlHost: string | null;
  storeCount: number;
  error?: string;
}> {
  const client = getSupabaseClient();
  const url = process.env["SUPABASE_URL"];
  if (!client || !url) {
    return {
      configured: false,
      connected: false,
      tableReady: false,
      urlHost: null,
      storeCount: 0,
      error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment",
    };
  }

  let urlHost = "unknown";
  try {
    urlHost = new URL(url).host;
  } catch {}

  try {
    const { data, error, count } = await client
      .from("bot_json_store")
      .select("store_name", { count: "exact" })
      .limit(10);

    if (error) {
      return {
        configured: true,
        connected: true,
        tableReady: false,
        urlHost,
        storeCount: 0,
        error: error.message,
      };
    }

    return {
      configured: true,
      connected: true,
      tableReady: true,
      urlHost,
      storeCount: count ?? data?.length ?? 0,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      tableReady: false,
      urlHost,
      storeCount: 0,
      error: err?.message || String(err),
    };
  }
}

async function readLocalJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      return parsed as T;
    }
    return parsed as T;
  } catch {
    // If not found in primary path, check /tmp/.data
    try {
      const altPath = path.join("/tmp/.data", path.basename(filePath));
      if (altPath !== filePath) {
        const altRaw = await fs.readFile(altPath, "utf8");
        return JSON.parse(altRaw) as T;
      }
    } catch {}
    return fallback;
  }
}

async function writeLocalJson<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

  // Mirror to /tmp/.data for maximum resilience
  try {
    const altDir = "/tmp/.data";
    const altPath = path.join(altDir, path.basename(filePath));
    if (altPath !== filePath) {
      await fs.mkdir(altDir, { recursive: true });
      await fs.writeFile(altPath, JSON.stringify(data, null, 2), "utf8");
    }
  } catch {}
}

async function writeSupabaseJson<T>(storeName: string, data: T): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client
    .from("bot_json_store")
    .upsert(
      {
        store_name: storeName,
        payload: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_name" },
    );

  if (error) {
    logger.warn({ error, storeName }, "Persistent JSON store write failed");
    throw error;
  }
}

function withTimeout<T>(promise: PromiseLike<T> | any, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout of ${timeoutMs}ms exceeded for ${label}`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((res) => {
        clearTimeout(timer);
        resolve(res as T);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function loadPersistentJson<T>(
  storeName: string,
  filePath: string,
  fallback: T,
): Promise<T> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("bot_json_store")
        .select("payload")
        .eq("store_name", storeName)
        .maybeSingle();

      if (!error && data?.payload != null) {
        // Cache to local file for fallback
        await writeLocalJson(filePath, data.payload).catch(() => {});
        return data.payload as T;
      }
    } catch (err) {
      logger.warn({ err, storeName }, "Failed to query Supabase store, falling back to local file");
    }
  }

  // Fallback to reading local JSON file
  const local = await readLocalJson(filePath, fallback);

  // If Supabase is connected but has no entry yet, backfill Supabase with non-empty local data
  if (client && local && typeof local === "object" && Object.keys(local).length > 0) {
    writeSupabaseJson(storeName, local).catch(() => {});
  }

  return local;
}

export async function persistPersistentJson<T>(
  storeName: string,
  filePath: string,
  data: T,
): Promise<void> {
  // Write locally instantly to guarantee <1ms responsiveness
  await writeLocalJson(filePath, data);

  // Write to Supabase asynchronously in the background
  const client = getSupabaseClient();
  if (client) {
    Promise.resolve(writeSupabaseJson(storeName, data)).catch((err) => {
      logger.warn({ err: err?.message || String(err), storeName }, "Background Supabase persistent sync failed");
    });
  }
}

/**
 * Scans all local JSON stores in DATA_DIR and /tmp/.data and upserts them into
 * Supabase bot_json_store. This is especially useful after unpausing a Supabase project.
 */
export async function syncAllLocalStoresToSupabase(): Promise<{
  synced: number;
  failed: number;
  stores: string[];
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { synced: 0, failed: 0, stores: [], error: "Supabase client not configured in environment" };
  }

  const dirsToScan = [DATA_DIR, "/tmp/.data"];
  const seenStores = new Set<string>();
  const syncedStores: string[] = [];
  let failed = 0;

  for (const dir of dirsToScan) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const storeName = file;
        if (seenStores.has(storeName)) continue;
        seenStores.add(storeName);

        try {
          const filePath = path.join(dir, file);
          const raw = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            await writeSupabaseJson(storeName, parsed);
            syncedStores.push(storeName);
          }
        } catch {
          failed++;
        }
      }
    } catch {}
  }

  return { synced: syncedStores.length, failed, stores: syncedStores };
}