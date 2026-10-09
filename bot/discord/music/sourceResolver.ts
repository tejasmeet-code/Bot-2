import { spawn } from "child_process";
import YouTube from "youtube-sr";
import ytdl from "@distube/ytdl-core";
import { logger } from "../../lib/logger";
import { CE } from "../utils/embedStyle";

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

/**
 * Extracts raw direct audio stream URL from YouTube video URL using @distube/ytdl-core
 */
export async function getAudioStreamFromYtdl(youtubeUrl: string): Promise<string | null> {
  try {
    if (!youtubeUrl || !youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
      return null;
    }
    const info = await ytdl.getInfo(youtubeUrl, {
      requestOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    });
    const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    if (audioFormats && audioFormats.length > 0) {
      const best = audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (best?.url) {
        return best.url;
      }
    }
  } catch (err) {
    logger.debug({ err, youtubeUrl }, "ytdl-core extraction failed; trying yt-dlp / iTunes fallback");
  }
  return null;
}

/**
 * Resolves direct audio stream URL using yt-dlp binary with PATH search fallback
 */
export async function getDirectStreamUrlWithYtDlp(urlOrQuery: string): Promise<string | null> {
  const binaryCandidates = ["yt-dlp", "/usr/bin/yt-dlp", "/usr/local/bin/yt-dlp"];

  for (const binPath of binaryCandidates) {
    const streamUrl = await new Promise<string | null>((resolve) => {
      try {
        const searchTarget = urlOrQuery.startsWith("http")
          ? urlOrQuery
          : `scsearch1:${urlOrQuery}`;
        const proc = spawn(binPath, [
          "-g",
          "-f", "bestaudio/best",
          "--no-warnings",
          searchTarget,
        ]);
        let stdout = "";
        proc.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        const timer = setTimeout(() => {
          try { proc.kill("SIGKILL"); } catch {}
          resolve(null);
        }, 5000);
        proc.on("close", (code) => {
          clearTimeout(timer);
          const url = stdout.trim().split("\n")[0];
          if (code === 0 && url && url.startsWith("http")) {
            resolve(url);
          } else {
            resolve(null);
          }
        });
        proc.on("error", () => {
          clearTimeout(timer);
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });

    if (streamUrl && streamUrl.startsWith("http")) {
      return streamUrl;
    }
  }

  return null;
}

export async function resolveYouTubeUrl(url: string): Promise<ResolvedMetadata[]> {
  return searchTracks(url, 1);
}

/**
 * Searches YouTube catalog for high-quality audio tracks
 */
export async function searchYouTubeCatalog(query: string, limit = 10): Promise<ResolvedMetadata[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const searchFn = (YouTube as any).search || (YouTube as any).default?.search;
    if (typeof searchFn === "function") {
      const ytVideos = await searchFn(cleanQuery, { limit: Math.min(limit, 10), type: "video" }).catch(() => []);
      if (ytVideos && ytVideos.length > 0) {
        const results: ResolvedMetadata[] = [];
        for (const v of ytVideos) {
          if (!v || !v.title) continue;
          results.push({
            title: v.title,
            artist: v.channel?.name || "YouTube Artist",
            durationSeconds: Math.round((v.duration || 210000) / 1000) || 210,
            url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
            streamUrl: v.url || `https://www.youtube.com/watch?v=${v.id}`,
            thumbnailUrl: v.thumbnail?.url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
            source: "youtube",
          });
        }
        if (results.length > 0) return results;
      }
    }
  } catch (err) {
    logger.debug({ err, cleanQuery }, "YouTube SR search failed");
  }

  return [];
}

/**
 * Searches iTunes for high quality previews and metadata
 */
export async function searchITunesCatalog(query: string, limit = 5): Promise<ResolvedMetadata[]> {
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      if (data?.results && Array.isArray(data.results)) {
        return data.results.map((item: any) => ({
          title: item.trackName || query,
          artist: item.artistName || "Unknown Artist",
          album: item.collectionName,
          durationSeconds: Math.round((item.trackTimeMillis || 210000) / 1000),
          url: item.trackViewUrl || "https://music.apple.com",
          streamUrl: item.previewUrl || "",
          thumbnailUrl: (item.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
          source: "itunes" as const,
        }));
      }
    }
  } catch {}
  return [];
}

/**
 * Resolves all available audio sources/mirrors for a song
 */
export async function resolveAllAudioSources(title: string, artist: string, currentStreamUrl?: string): Promise<AudioSourceOption[]> {
  const query = `${title} ${artist}`.trim();
  const sources: AudioSourceOption[] = [];

  // 1. YouTube Audio Source
  try {
    const ytSongs = await searchYouTubeCatalog(query, 1);
    if (ytSongs[0]?.streamUrl) {
      sources.push({
        id: "youtube_hd",
        sourceName: "YouTube High Quality Audio",
        quality: "320kbps HD Audio",
        icon: CE.music.str,
        streamUrl: ytSongs[0].streamUrl,
      });
    }
  } catch {}

  // 2. Apple Music / iTunes
  try {
    const itunes = await searchITunesCatalog(query, 1);
    if (itunes[0]?.streamUrl) {
      sources.push({
        id: "apple_music",
        sourceName: "Apple Music Stream",
        quality: "256kbps AAC Audio",
        icon: CE.play.str,
        streamUrl: itunes[0].streamUrl,
      });
    }
  } catch {}

  // Fallback direct stream if available
  if (currentStreamUrl && !sources.some((s) => s.streamUrl === currentStreamUrl)) {
    sources.push({
      id: "direct_stream",
      sourceName: "Direct Audio Stream",
      quality: "High Bitrate Stream",
      icon: CE.radio.str,
      streamUrl: currentStreamUrl,
    });
  }

  return sources;
}

/**
 * Resolves a full-length audio stream URL for any track title and artist using YouTube / SoundCloud / iTunes
 */
export async function resolveFullStreamUrl(title: string, artist: string, currentStreamUrl?: string): Promise<string> {
  const query = `${title} ${artist}`.trim();

  // 1. If currentStreamUrl is a YouTube webpage URL, extract raw audio stream using ytdl-core
  if (currentStreamUrl && (currentStreamUrl.includes("youtube.com") || currentStreamUrl.includes("youtu.be"))) {
    const ytdlStream = await getAudioStreamFromYtdl(currentStreamUrl);
    if (ytdlStream && ytdlStream.startsWith("http")) {
      logger.info({ title, artist, source: "ytdl-core Stream" }, "Resolved direct YouTube audio stream");
      return ytdlStream;
    }
  }

  // 2. Try yt-dlp direct stream extraction
  try {
    const directStream = await getDirectStreamUrlWithYtDlp(query);
    if (directStream && directStream.startsWith("http")) {
      logger.info({ title, artist, source: "yt-dlp Direct Stream" }, "Resolved direct stream URL");
      return directStream;
    }
  } catch {}

  // 3. If currentStreamUrl is already a direct audio media stream (e.g. mp3, m4a, saavn, soma), use it
  if (currentStreamUrl && currentStreamUrl.startsWith("http") && !currentStreamUrl.includes("youtube.com") && !currentStreamUrl.includes("youtu.be")) {
    return currentStreamUrl;
  }

  // 4. Fallback to iTunes catalog direct AAC audio stream
  try {
    const itunesResults = await searchITunesCatalog(query, 3);
    if (itunesResults.length > 0 && itunesResults[0].streamUrl) {
      logger.info({ title, artist, source: "iTunes Fallback" }, "Resolved working iTunes AAC stream URL fallback");
      return itunesResults[0].streamUrl;
    }
  } catch {}

  return currentStreamUrl || "";
}

/**
 * Parses Spotify track, album, playlist, or artist URLs and extracts metadata
 */
export async function resolveSpotifyUrl(url: string): Promise<ResolvedMetadata[]> {
  try {
    const cleanUrl = url.trim();
    const match = cleanUrl.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i);
    if (!match) return [];

    const type = match[1].toLowerCase();
    const id = match[2];

    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZenithMusicBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    let oembedData: any = null;
    if (res && res.ok) {
      oembedData = await res.json().catch(() => null);
    }

    const embedPageUrl = `https://open.spotify.com/embed/${type}/${id}`;
    const pageRes = await fetch(embedPageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(7000),
    }).catch(() => null);

    if (pageRes && pageRes.ok) {
      const html = await pageRes.text();
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const entity = nextData?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            const trackList: any[] = entity.trackList || (entity.tracks?.items ? entity.tracks.items : []);
            if (trackList && trackList.length > 0) {
              const albumOrPlaylistTitle = entity.name || oembedData?.title || "Spotify Collection";
              const coverUrl =
                entity.coverArt?.sources?.[0]?.url ||
                oembedData?.thumbnail_url ||
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop";

              return trackList.map((t: any) => {
                const title = t.title || t.name || "Unknown Track";
                const artist = t.subtitle || (t.artists ? t.artists.map((a: any) => a.name).join(", ") : "Unknown Artist");
                const duration = Math.round((t.duration || t.duration_ms || 180000) / 1000);
                const trackUrl = t.uri ? `https://open.spotify.com/track/${t.uri.split(":").pop()}` : cleanUrl;

                return {
                  title,
                  artist,
                  album: albumOrPlaylistTitle,
                  durationSeconds: duration,
                  url: trackUrl,
                  streamUrl: "",
                  thumbnailUrl: coverUrl,
                  source: "spotify" as const,
                };
              });
            }
          }
        } catch {}
      }
    }

    if (oembedData) {
      return [
        {
          title: oembedData.title || "Spotify Track",
          artist: oembedData.author_name || "Spotify Artist",
          durationSeconds: 210,
          url: cleanUrl,
          streamUrl: "",
          thumbnailUrl: oembedData.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
          source: "spotify" as const,
        },
      ];
    }
  } catch (err) {
    logger.warn({ err, url }, "Error resolving Spotify URL");
  }
  return [];
}

/**
 * Searches music catalogs for matching tracks by query
 */
export async function searchTracks(query: string, limit = 10): Promise<ResolvedMetadata[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  if (cleanQuery.includes("open.spotify.com")) {
    return resolveSpotifyUrl(cleanQuery);
  }

  // 1. Search YouTube Catalog
  const ytResults = await searchYouTubeCatalog(cleanQuery, limit);
  if (ytResults.length > 0) {
    return ytResults;
  }

  // 2. Search iTunes as fallback provider
  const itunesResults = await searchITunesCatalog(cleanQuery, limit);
  if (itunesResults.length > 0) {
    return itunesResults;
  }

  return [];
}

export async function searchArtistSongs(artist: string, limit = 30): Promise<ResolvedMetadata[]> {
  return searchTracks(`${artist} songs`, limit);
}

export async function searchAlbumSongs(album: string, limit = 20): Promise<ResolvedMetadata[]> {
  return searchTracks(`${album} album`, limit);
}
