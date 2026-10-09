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

  const isUrl = /^https?:\/\//i.test(trimmed);
  const isYtId = trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

  // If query is a YouTube URL, resolve its real video title via YouTube oEmbed first
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const resolvedTitle = await resolveYouTubeTitleFromUrl(trimmed);
    if (resolvedTitle) {
      trimmed = resolvedTitle;
    } else {
      return null;
    }
  } else if (isUrl || isYtId) {
    return null;
  }

  // Clean title parameters for high-accuracy SoundCloud search matching
  const cleanTitle = trimmed
    .replace(/[\(\[\{](?:official|music|video|audio|lyric|remastered|hd|4k)[^\)\]\}]*[\)\]\}]/gi, "")
    .trim();

  const userWantsRemix = /(?:remix|slowed|reverb|sped|speed|funk|edit|mashup|hardtekk|tek|bootleg|nightcore|cover|instrumental)/i.test(trimmed);

  try {
    let cid = await getSoundCloudClientId();
    const searchTerms = [cleanTitle, trimmed];
    
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const term of searchTerms) {
        if (!term) continue;
        const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(term)}&client_id=${cid}&limit=10`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        
        if (res.status === 401 && attempt === 0) {
          cid = await getSoundCloudClientId(true);
          break; // Retry outer loop with fresh client ID
        }
        if (!res.ok) continue;

        const data: any = await res.json();
        const tracks = data.collection || [];
        if (!Array.isArray(tracks) || tracks.length === 0) continue;

        // Filter out short preview clips (< 45s duration) or items with preview media
        const validTracks = tracks.filter((t: any) => {
          if (!t.duration || t.duration <= 45000) return false;
          const trans = t.media?.transcodings || [];
          return trans.some((m: any) => m.url && m.url.includes("/stream/"));
        });

        // Filter out unwanted remixes/covers unless user explicitly searched for them
        const originalTracks = validTracks.filter((t: any) => {
          if (userWantsRemix) return true;
          const title = t.title || "";
          return !/(?:remix|tik\s*tok|slowed|reverb|sped\s*up|speed\s*up|funk|edit|mashup|1\s*hour|nightcore|hardtekk|tek|bootleg|cover|instrumental)/i.test(title);
        });

        const candidateTracks = originalTracks.length > 0 ? originalTracks : validTracks.length > 0 ? validTracks : tracks;

        for (const track of candidateTracks) {
          // Double-check track duration isn't a 30s preview clip
          if (track.duration && track.duration <= 45000) continue;

          const media = track.media?.transcodings || [];
          // Prefer full stream progressive or HLS transcoding over preview
          const fullMedia = media.filter((m: any) => m.url && m.url.includes("/stream/"));
          const prog = fullMedia.find((t: any) => t.format?.protocol === "progressive") ||
                     fullMedia.find((t: any) => t.format?.protocol === "hls") ||
                     fullMedia[0] ||
                     media.find((t: any) => t.format?.protocol === "progressive") ||
                     media[0];

          if (prog?.url && !prog.url.includes("/preview/")) {
            const streamRes = await fetch(`${prog.url}?client_id=${cid}`, { signal: AbortSignal.timeout(3000) });
            if (streamRes.ok) {
              const streamData: any = await streamRes.json();
              if (streamData.url && !streamData.url.includes("cf-preview-media")) {
                return streamData.url;
              }
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
    else return null;
  } else if (/^https?:\/\//i.test(trimmed) || (trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed))) {
    return null;
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
    else return null;
  } else if (/^https?:\/\//i.test(trimmed) || (trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed))) {
    return null;
  }

  const queryWords = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 2);

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
          // Filter results to ensure title matches at least one word from the query
          const match = results.find((song: any) => {
            const title = (song.name || song.title || "").toLowerCase();
            const artist = (song.primaryArtists || song.artist || "").toLowerCase();
            if (queryWords.length === 0) return true;
            return queryWords.some(w => title.includes(w) || artist.includes(w));
          }) || results[0];

          // If queryWords is non-empty and match doesn't contain any word, don't use wrong song
          const matchTitle = (match.name || match.title || "").toLowerCase();
          const matchArtist = (match.primaryArtists || match.artist || "").toLowerCase();
          const hasKeywordMatch = queryWords.length === 0 || queryWords.some(w => matchTitle.includes(w) || matchArtist.includes(w));

          if (hasKeywordMatch) {
            const dl = match.downloadUrl?.slice(-1)[0]?.url || match.downloadUrl?.[0]?.url || match.media_url;
            if (dl && dl.startsWith("http")) return dl;
          }
        }
      }
    } catch {}
  }
  return null;
}

export async function getYouTubeAudioStreamFromApi(videoId: string): Promise<string | null> {
  const cobaltApis = [
    "https://api.cobalt.tools/api/json",
    "https://cobalt.api.ryb.red/api/json",
    "https://api.cobalt.sh/api/json",
  ];

  for (const api of cobaltApis) {
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
          audioBitrate: "128",
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.url) {
          logger.info({ videoId, api }, "Successfully extracted YouTube stream using Cobalt API");
          return data.url;
        }
      }
    } catch {}
  }

  const endpoints = [
    `https://pipedapi.kavin.rocks/streams/${videoId}`,
    `https://piped-api.lunar.icu/streams/${videoId}`,
    `https://api.piped.privacydev.net/streams/${videoId}`,
    `https://inv.tux.pizza/api/v1/videos/${videoId}`,
    `https://invidious.nerdvpn.de/api/v1/videos/${videoId}`,
    `https://invidious.flokinet.to/api/v1/videos/${videoId}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          const stream = data.audioStreams.find((s: any) => s.mimeType?.includes("audio") || s.quality === "high") || data.audioStreams[0];
          if (stream?.url) return stream.url;
        }
        if (Array.isArray(data.adaptiveFormats)) {
          const audio = data.adaptiveFormats.find((f: any) => f.type?.includes("audio") || f.mimeType?.includes("audio"));
          if (audio?.url) return audio.url;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Extract raw playable audio stream URL (YouTube direct first, SoundCloud original, JioSaavn matching, etc.)
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

  const ytMatch = YOUTUBE_URL_REGEX.exec(targetUrl);
  const isYouTubeUrl = Boolean(targetUrl.includes("youtube.com") || targetUrl.includes("youtu.be") || ytMatch);

  // 1. If targetUrl is a YouTube URL, extract YouTube audio stream FIRST
  if (isYouTubeUrl) {
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
      logger.debug({ err: err?.message, targetUrl }, "ytdl getInfo failed, trying YouTube API fallback");
    }

    if (ytMatch && ytMatch[1]) {
      const apiStream = await getYouTubeAudioStreamFromApi(ytMatch[1]);
      if (apiStream) return apiStream;
    }
  }

  const searchQuery = trackSearchTitle || targetUrl;

  // 2. Try High-Fidelity SoundCloud Audio Stream with original track matching
  const scStream = await getSoundCloudAudioStream(searchQuery);
  if (scStream) return scStream;

  // 3. Try JioSaavn Studio Stream with keyword verification
  const saavnStream = await getJioSaavnAudioStream(searchQuery);
  if (saavnStream) return saavnStream;

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
