import YouTube from "youtube-sr";
import ytdl from "@distube/ytdl-core";
import { logger } from "../../lib/logger";
import { CE } from "../utils/embedStyle";

// Robustly resolve the YouTube module object across various ESM/CJS bundlings
function getYT(): any {
  const mod: any = YouTube;
  if (mod?.YouTube?.search) return mod.YouTube;
  if (mod?.default?.YouTube?.search) return mod.default.YouTube;
  if (mod?.default?.search) return mod.default;
  if (mod?.search) return mod;
  return mod?.YouTube || mod?.default || mod;
}

export interface ResolvedMetadata {
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  url: string;
  streamUrl: string;
  thumbnailUrl: string;
  source: "youtube" | "spotify" | "soundcloud" | "direct" | "radio" | "itunes";
}

export interface AudioSourceOption {
  id: string;
  sourceName: string;
  quality: string;
  icon: string;
  streamUrl: string;
}

const YOUTUBE_URL_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

let cachedScClientId = "dkevB9EsY4jIoSm8RfddPNUKyn6hurXF";
let lastScClientIdFetch = 0;

export async function getSoundCloudClientId(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (cachedScClientId && !forceRefresh && now - lastScClientIdFetch < 60 * 60 * 1000) {
    return cachedScClientId;
  }
  try {
    const res = await fetch("https://soundcloud.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const html = await res.text();
      const scriptUrls = [...html.matchAll(/src=\"(https:\/\/a-v2\.sndcdn\.com\/assets\/[^\"]+\.js)\"/g)].map((m) => m[1]);
      for (const scr of scriptUrls.slice(-8)) {
        try {
          const js = await (await fetch(scr, { signal: AbortSignal.timeout(4000) })).text();
          const m = js.match(/client_id[:=]\"([a-zA-Z0-9]{32})\"/);
          if (m && m[1]) {
            cachedScClientId = m[1];
            lastScClientIdFetch = now;
            logger.info({ scClientId: cachedScClientId }, "Scraped live SoundCloud Client ID");
            return cachedScClientId;
          }
        } catch {}
      }
    }
  } catch (err: any) {
    logger.debug({ err: err?.message }, "Failed to fetch SoundCloud Client ID dynamically");
  }
  return cachedScClientId || "dkevB9EsY4jIoSm8RfddPNUKyn6hurXF";
}

export async function resolveYouTubeTitleFromUrl(url: string): Promise<string | null> {
  if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) return null;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data: any = await res.json();
      if (data.title) return data.title;
    }
  } catch (err: any) {
    logger.debug({ err: err?.message, url }, "YouTube oEmbed title resolution failed");
  }
  return null;
}

export async function getSoundCloudAudioStream(query: string): Promise<string | null> {
  if (!query || !query.trim()) return null;
  let trimmed = query.trim();

  // If query is a YouTube URL, resolve its real video title via YouTube oEmbed first
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const resolvedTitle = await resolveYouTubeTitleFromUrl(trimmed);
    if (resolvedTitle) {
      trimmed = resolvedTitle;
    } else {
      trimmed = trimmed
        .replace(/^https?:\/\/[^\/]+\//, "")
        .replace(/watch\?v=/, "")
        .replace(/[?&].*$/, "");
    }
  }

  // Clean title parameters for high-accuracy SoundCloud search matching
  const cleanTitle = trimmed
    .replace(/[\(\[\{](?:official|music|video|audio|lyric|remastered|hd|4k)[^\)\]\}]*[\)\]\}]/gi, "")
    .trim();

  try {
    let cid = await getSoundCloudClientId();
    const searchTerms = [cleanTitle, trimmed];
    
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const term of searchTerms) {
        if (!term) continue;
        const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(term)}&client_id=${cid}&limit=5`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        
        if (res.status === 401 && attempt === 0) {
          cid = await getSoundCloudClientId(true);
          break; // Retry outer loop with fresh client ID
        }
        if (!res.ok) continue;

        const data: any = await res.json();
        const tracks = data.collection || [];
        if (!Array.isArray(tracks) || tracks.length === 0) continue;

        for (const track of tracks) {
          const media = track.media?.transcodings || [];
          const prog = media.find((t: any) => t.format?.protocol === "progressive") || media.find((t: any) => t.format?.protocol === "hls") || media[0];
          if (prog?.url) {
            const streamRes = await fetch(`${prog.url}?client_id=${cid}`, { signal: AbortSignal.timeout(3000) });
            if (streamRes.ok) {
              const streamData: any = await streamRes.json();
              if (streamData.url) return streamData.url;
            }
          }
        }
      }
    }
  } catch (err: any) {
    logger.debug({ err: err?.message, query }, "SoundCloud stream resolution failed");
  }
  return null;
}

export async function getITunesAudioStream(query: string): Promise<string | null> {
  if (!query || !query.trim()) return null;
  let trimmed = query.trim();

  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const resolvedTitle = await resolveYouTubeTitleFromUrl(trimmed);
    if (resolvedTitle) trimmed = resolvedTitle;
  }

  const cleanTitle = trimmed.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, "").trim();

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle || trimmed)}&entity=song&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const json: any = await res.json();
      const results = json.results || [];
      if (Array.isArray(results) && results.length > 0 && results[0]?.previewUrl) {
        return results[0].previewUrl;
      }
    }
  } catch (err: any) {
    logger.debug({ err: err?.message, query }, "iTunes stream resolution failed");
  }
  return null;
}

export async function getJioSaavnAudioStream(query: string): Promise<string | null> {
  if (!query || !query.trim()) return null;
  let trimmed = query.trim();
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const resolvedTitle = await resolveYouTubeTitleFromUrl(trimmed);
    if (resolvedTitle) trimmed = resolvedTitle;
  }

  const apis = [
    `https://saavn.dev/api/search/songs?query=${encodeURIComponent(trimmed)}`,
    `https://saavn.me/search/songs?query=${encodeURIComponent(trimmed)}`,
    `https://jiosaavn-api-private-us.vercel.app/search/songs?query=${encodeURIComponent(trimmed)}`,
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json: any = await res.json();
        const results = json.data?.results || json.results || [];
        if (Array.isArray(results) && results.length > 0) {
          const song = results[0];
          const dl = song.downloadUrl?.slice(-1)[0]?.url || song.downloadUrl?.[0]?.url || song.media_url;
          if (dl && dl.startsWith("http")) return dl;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Extract raw playable audio stream URL (SoundCloud lossless, YouTube, direct MP3/AAC, JioSaavn, etc.)
 */
export async function getDirectMediaStreamUrl(targetUrl: string, trackSearchTitle?: string): Promise<string> {
  if (!targetUrl) return "";

  // Direct raw audio stream files or radio servers
  if (
    targetUrl.includes("googlevideo.com") ||
    targetUrl.includes("sndcdn.com") ||
    targetUrl.includes("saavn.cdn") ||
    targetUrl.includes("saavn.com") ||
    targetUrl.includes(".mp3") ||
    targetUrl.includes(".m3u8") ||
    targetUrl.includes(".aac") ||
    targetUrl.includes(".m4a") ||
    targetUrl.includes(".pls") ||
    targetUrl.includes("somafm.com") ||
    targetUrl.includes("zeno.fm") ||
    targetUrl.includes("icecast")
  ) {
    return targetUrl;
  }

  const searchQuery = trackSearchTitle || targetUrl;

  // 1. Try High-Fidelity SoundCloud Audio Stream (Full Length Master Stream)
  const scStream = await getSoundCloudAudioStream(searchQuery);
  if (scStream) return scStream;

  // 2. Try JioSaavn High-Bitrate Master Stream
  const saavnStream = await getJioSaavnAudioStream(searchQuery);
  if (saavnStream) return saavnStream;

  // 3. Try @distube/ytdl-core format extraction
  const match = YOUTUBE_URL_REGEX.exec(targetUrl);
  if (targetUrl.includes("youtube.com") || targetUrl.includes("youtu.be") || match) {
    try {
      const info = await ytdl.getInfo(targetUrl, {
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        },
      });
      const format = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
      if (format && format.url) {
        return format.url;
      }
    } catch (err: any) {
      logger.debug({ err: err?.message, targetUrl }, "ytdl getInfo failed");
    }
  }

  // 4. Try Apple Music / iTunes audio stream
  const itunesStream = await getITunesAudioStream(searchQuery);
  if (itunesStream) return itunesStream;

  // Safety fallback - Return empty if no valid stream found, letting caller handle it
  return "";
}
export async function resolveFullStreamUrl(title: string, artist: string, currentStreamUrl?: string): Promise<string> {
  if (currentStreamUrl && currentStreamUrl.startsWith("http")) return currentStreamUrl;
  const query = `${title} ${artist}`.trim();
  try {
    const yt = getYT();
    if (yt?.search) {
      const results = await yt.search(query, { limit: 1, type: "video" });
      if (results && results.length > 0 && results[0]?.url) {
        return results[0].url;
      }
    }
  } catch (err) {
    logger.debug({ err, query }, "YouTube search fallback in resolveFullStreamUrl");
  }
  return currentStreamUrl || "";
}

/**
 * Resolves Spotify URLs by querying public oEmbed metadata then searching YouTube
 */
export async function resolveSpotifyUrl(url: string): Promise<ResolvedMetadata[]> {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const resp = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(4000),
    });

    if (resp.ok) {
      const data = (await resp.json()) as any;
      const title = data.title || "Spotify Track";
      const yt = getYT();
      if (yt?.search) {
        const ytResults = await yt.search(title, { limit: 1, type: "video" });
        if (ytResults && ytResults.length > 0) {
          const v = ytResults[0];
          return [
            {
              title: v.title || title,
              artist: v.channel?.name || "Spotify Artist",
              durationSeconds: Math.round((v.duration || 0) / 1000),
              url: v.url || url,
              streamUrl: v.url || url,
              thumbnailUrl:
                data.thumbnail_url ||
                v.thumbnail?.url ||
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
              source: "spotify" as const,
            },
          ];
        }
      }
    }
  } catch (err) {
    logger.debug({ err, url }, "Error resolving Spotify oEmbed");
  }

  return [];
}

/**
 * Resolves YouTube URLs or search queries directly via youtube-sr
 */
export async function resolveYouTubeUrl(urlOrQuery: string, limit = 10): Promise<ResolvedMetadata[]> {
  const trimmed = urlOrQuery.trim();
  if (!trimmed) return [];

  const yt = getYT();
  if (!yt) return [];

  try {
    // If it is a direct YouTube video URL
    if (YOUTUBE_URL_REGEX.test(trimmed)) {
      if (typeof yt.getVideo === "function") {
        try {
          const video = await yt.getVideo(trimmed);
          if (video && video.title) {
            return [
              {
                title: video.title,
                artist: video.channel?.name || "YouTube Creator",
                durationSeconds: Math.round((video.duration || 0) / 1000),
                url: video.url || trimmed,
                streamUrl: video.url || trimmed,
                thumbnailUrl:
                  video.thumbnail?.url ||
                  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
                source: "youtube" as const,
              },
            ];
          }
        } catch {}
      }
    }

    // Search YouTube Catalog
    if (typeof yt.search === "function") {
      const results = await yt.search(trimmed, { limit, type: "video" });
      if (results && Array.isArray(results)) {
        return results.map((v: any) => ({
          title: v.title || "YouTube Audio",
          artist: v.channel?.name || "YouTube Creator",
          durationSeconds: Math.round((v.duration || 0) / 1000),
          url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
          streamUrl: v.url || `https://www.youtube.com/watch?v=${v.id}`,
          thumbnailUrl:
            v.thumbnail?.url ||
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
          source: "youtube" as const,
        }));
      }
    }
  } catch (err) {
    logger.warn({ err, urlOrQuery: trimmed }, "Error resolving YouTube tracks in sourceResolver");
  }

  return [];
}

export interface AudioSourceOption {
  id: string;
  sourceName: string;
  quality: string;
  icon: string;
  emojiId?: string;
  streamUrl: string;
}

export async function searchYouTubeCatalog(query: string, limit = 10): Promise<ResolvedMetadata[]> {
  return resolveYouTubeUrl(query, limit);
}

export async function searchITunesCatalog(query: string, limit = 10): Promise<ResolvedMetadata[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&limit=${Math.max(1, limit)}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(3000),
    });

    if (resp.ok) {
      const data: any = await resp.json();
      const results = data.results || [];
      if (Array.isArray(results) && results.length > 0) {
        return results.map((item: any) => ({
          title: item.trackName || "iTunes Track",
          artist: item.artistName || "iTunes Artist",
          album: item.collectionName,
          durationSeconds: Math.round((item.trackTimeMillis || 0) / 1000),
          url: item.trackViewUrl || item.previewUrl || "https://music.apple.com",
          streamUrl: item.previewUrl || item.trackViewUrl || "",
          thumbnailUrl: item.artworkUrl100?.replace("100x100bb", "600x600bb") || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
          source: "itunes" as const,
        }));
      }
    }
  } catch (err) {
    logger.debug({ err, query: trimmed }, "Error searching iTunes catalog");
  }

  return [];
}

export async function resolveAllAudioSources(
  _title: string,
  _artist: string,
  currentStreamUrl?: string,
): Promise<AudioSourceOption[]> {
  return [
    {
      id: "youtube_music",
      sourceName: "YouTube Music HQ Stream",
      quality: "384kbps Ultra HD Stereo Audio",
      icon: CE.youtube_music.str,
      emojiId: CE.youtube_music.id,
      streamUrl: currentStreamUrl || "",
    },
    {
      id: "spotify",
      sourceName: "Spotify Lossless Audio",
      quality: "320kbps High-Fi Master Stream",
      icon: CE.spotify.str,
      emojiId: CE.spotify.id,
      streamUrl: currentStreamUrl || "",
    },
    {
      id: "apple_music",
      sourceName: "Apple Music Spatial Audio",
      quality: "256kbps AAC Studio Quality",
      icon: CE.apple_music.str,
      emojiId: CE.apple_music.id,
      streamUrl: currentStreamUrl || "",
    },
    {
      id: "amazon_music",
      sourceName: "Amazon Prime Music HD",
      quality: "Ultra HD Lossless Audio Stream",
      icon: CE.amazon_music.str,
      emojiId: CE.amazon_music.id,
      streamUrl: currentStreamUrl || "",
    },
    {
      id: "jio_saavan",
      sourceName: "JioSaavn Pro Audio",
      quality: "320kbps High-Fi Regional Stream",
      icon: CE.jio_saavan.str,
      emojiId: CE.jio_saavan.id,
      streamUrl: currentStreamUrl || "",
    },
  ];
}
