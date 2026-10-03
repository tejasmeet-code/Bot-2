import { logger } from "../../lib/logger";

export interface LyricsResult {
  title: string;
  artist: string;
  plainLyrics?: string;
  syncedLyrics?: string;
  source: string;
}

/**
 * Fetches lyrics from LRCLIB (public, high accuracy synchronized & plain lyrics database)
 */
export async function fetchLyrics(trackTitle: string, artistName?: string, durationSeconds?: number): Promise<LyricsResult | null> {
  try {
    const cleanTitle = trackTitle
      .replace(/[\(\[](official\s*(music\s*)?video|audio|lyrics|4k|hd|visualizer|remastered|feat\.?.*)[\)\]]/gi, "")
      .trim();

    let queryParams = `track_name=${encodeURIComponent(cleanTitle)}`;
    if (artistName && !artistName.toLowerCase().includes("various") && !artistName.toLowerCase().includes("unknown")) {
      queryParams += `&artist_name=${encodeURIComponent(artistName)}`;
    }
    if (durationSeconds && durationSeconds > 0) {
      queryParams += `&duration=${Math.round(durationSeconds)}`;
    }

    // 1. Exact match attempt via lrclib.net API
    const exactUrl = `https://lrclib.net/api/get?${queryParams}`;
    const exactRes = await fetch(exactUrl, {
      headers: { "User-Agent": "RelostaMusicBot/1.0 (contact@relosta.io)" },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (exactRes && exactRes.ok) {
      const data: any = await exactRes.json().catch(() => null);
      if (data && (data.plainLyrics || data.syncedLyrics)) {
        return {
          title: data.trackName || trackTitle,
          artist: data.artistName || artistName || "Unknown Artist",
          plainLyrics: data.plainLyrics,
          syncedLyrics: data.syncedLyrics,
          source: "LRCLIB Database",
        };
      }
    }

    // 2. Fuzzy search attempt
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${artistName || ""}`.trim())}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "RelostaMusicBot/1.0 (contact@relosta.io)" },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (searchRes && searchRes.ok) {
      const list = ((await searchRes.json().catch(() => [])) || []) as any[];
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((item) => item.plainLyrics || item.syncedLyrics) || list[0];
        if (best && (best.plainLyrics || best.syncedLyrics)) {
          return {
            title: best.trackName || trackTitle,
            artist: best.artistName || artistName || "Unknown Artist",
            plainLyrics: best.plainLyrics,
            syncedLyrics: best.syncedLyrics,
            source: "LRCLIB Global Search",
          };
        }
      }
    }
  } catch (err) {
    logger.warn({ err, trackTitle }, "Error fetching lyrics");
  }

  return null;
}
