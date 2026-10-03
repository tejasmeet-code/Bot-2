import {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
  NoSubscriberBehavior,
  type VoiceConnection,
  type AudioPlayer,
  type AudioResource,
} from "@discordjs/voice";
import { spawn, type ChildProcess } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { PassThrough, Readable } from "stream";
import {
  type VoiceBasedChannel,
  type GuildTextBasedChannel,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
  PermissionFlagsBits,
  Routes,
  type Client,
} from "discord.js";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { logger } from "../../lib/logger";
import { set247Config, getAll247Configs } from "../storage/music247";
import { resolveSpotifyUrl, resolveYouTubeUrl, resolveFullStreamUrl, searchYouTubeCatalog, searchITunesCatalog, resolveAllAudioSources, type AudioSourceOption } from "./sourceResolver";
import { hasDjPermission } from "../storage/musicDj";

export interface Track {
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  url: string;
  streamUrl: string;
  thumbnailUrl: string;
  is247Radio?: boolean;
  sourceName?: string;
  requestedBy: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export type LoopMode = "off" | "track" | "queue";

export type EqualizerPreset =
  | "off"
  | "bassboost"
  | "superbass"
  | "treble"
  | "nightcore"
  | "vaporwave"
  | "karaoke"
  | "highpitch"
  | "lowpitch"
  | "pop"
  | "rock"
  | "electronic"
  | "soft"
  | "8d";

export interface EqualizerInfo {
  id: EqualizerPreset;
  label: string;
  filter: string | null;
  description: string;
}

export const EQUALIZER_PRESETS: Record<EqualizerPreset, EqualizerInfo> = {
  off: {
    id: "off",
    label: "Flat / Normal",
    filter: null,
    description: "Pure balanced studio output without filters",
  },
  bassboost: {
    id: "bassboost",
    label: "Heavy Bass Boost",
    filter: "bass=g=12:f=100:w=0.5,equalizer=f=60:width_type=h:width=50:g=10",
    description: "Punchy club bass and deep low-end kick",
  },
  superbass: {
    id: "superbass",
    label: "Super Sub-Bass",
    filter: "bass=g=18:f=80:w=0.4,equalizer=f=45:width_type=h:width=40:g=14",
    description: "Maximum vibrating sub-woofer bass rumble",
  },
  treble: {
    id: "treble",
    label: "Treble Boost",
    filter: "treble=g=10:f=8000:w=0.5,equalizer=f=12000:width_type=h:width=2000:g=8",
    description: "Crystal-clear high frequencies and vocals",
  },
  nightcore: {
    id: "nightcore",
    label: "Nightcore",
    filter: "aresample=48000,asetrate=48000*1.25",
    description: "1.25x tempo boost with pitched aesthetic vocals",
  },
  vaporwave: {
    id: "vaporwave",
    label: "Vaporwave (Slowed + Reverb)",
    filter: "aresample=48000,asetrate=48000*0.82,aecho=0.8:0.88:60:0.4",
    description: "Slowed aesthetic tempo with ambient reverb",
  },
  karaoke: {
    id: "karaoke",
    label: "Karaoke (Vocal Remover)",
    filter: "pan=stereo|c0=c0-c1|c1=c1-c0,equalizer=f=1000:t=q:w=1:g=-8",
    description: "Suppresses centered vocal channel for sing-along",
  },
  highpitch: {
    id: "highpitch",
    label: "High Pitch (Chipmunk)",
    filter: "asetrate=48000*1.3,aresample=48000,atempo=0.77",
    description: "Bright elevated pitch without altering playback speed",
  },
  lowpitch: {
    id: "lowpitch",
    label: "Low Pitch (Deep Voice)",
    filter: "asetrate=48000*0.78,aresample=48000,atempo=1.28",
    description: "Deepened acoustic timbre and lowered pitch",
  },
  pop: {
    id: "pop",
    label: "Pop Music Curve",
    filter: "equalizer=f=64:t=q:w=1:g=2,equalizer=f=250:t=q:w=1:g=4,equalizer=f=1000:t=q:w=1:g=2,equalizer=f=4000:t=q:w=1:g=-2,equalizer=f=12000:t=q:w=1:g=4",
    description: "Brightened vocals and rhythmic pop presence",
  },
  rock: {
    id: "rock",
    label: "Rock & Metal",
    filter: "equalizer=f=64:t=q:w=1:g=5,equalizer=f=250:t=q:w=1:g=3,equalizer=f=1000:t=q:w=1:g=-1,equalizer=f=4000:t=q:w=1:g=3,equalizer=f=12000:t=q:w=1:g=6",
    description: "Snappy drum transients and sharp guitars",
  },
  electronic: {
    id: "electronic",
    label: "EDM & Electronic",
    filter: "bass=g=10:f=90:w=0.5,treble=g=6:f=10000:w=0.5",
    description: "Thumping kicks with glistening synths",
  },
  soft: {
    id: "soft",
    label: "Acoustic / Soft",
    filter: "equalizer=f=250:t=q:w=1:g=1,equalizer=f=1000:t=q:w=1:g=2,equalizer=f=4000:t=q:w=1:g=1,equalizer=f=12000:t=q:w=1:g=-2",
    description: "Warm, gentle tone for acoustic & chill music",
  },
  "8d": {
    id: "8d",
    label: "8D Surround Audio",
    filter: "apulsator=hz=0.125",
    description: "360-degree dynamic spatial rotating audio",
  },
};

/**
 * Curated ultra-reliable 24/7 web radio fallback stations
 */
export const BACKUP_RADIO_STATIONS = [
  {
    title: "Lofi Chill & Study Beats (24/7 Live Stream)",
    artist: "Zenith Lofi Radio",
    url: "https://ice5.somafm.com/groovesalad-128-mp3",
    streamUrl: "https://ice5.somafm.com/groovesalad-128-mp3",
    durationSeconds: 0,
    thumbnailUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=600&auto=format&fit=crop",
    is247Radio: true,
  },
  {
    title: "Synthwave & Retrowave 24/7 Cyber Station",
    artist: "Zenith Synthwave Radio",
    url: "https://ice1.somafm.com/defcon-128-mp3",
    streamUrl: "https://ice1.somafm.com/defcon-128-mp3",
    durationSeconds: 0,
    thumbnailUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop",
    is247Radio: true,
  },
  {
    title: "Pop & Top Global Hits 24/7 Non-Stop",
    artist: "Zenith Pop Radio",
    url: "https://ice1.somafm.com/poptron-128-mp3",
    streamUrl: "https://ice1.somafm.com/poptron-128-mp3",
    durationSeconds: 0,
    thumbnailUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop",
    is247Radio: true,
  },
  {
    title: "Deep Chillout & Ambient Atmosphere",
    artist: "Zenith Ambient Radio",
    url: "https://ice1.somafm.com/secretagent-128-mp3",
    streamUrl: "https://ice1.somafm.com/secretagent-128-mp3",
    durationSeconds: 0,
    thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
    is247Radio: true,
  },
];

/**
 * Resolves full-length audio streams via yt-dlp to prevent 1:30 preview cutoffs
 */
export async function resolveFullTrackStream(searchQuery: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const proc = spawn("yt-dlp", [
        "-g",
        "--default-search",
        "scsearch",
        "-f",
        "bestaudio/best",
        "--no-warnings",
        `scsearch1:${searchQuery}`,
      ]);
      let stdout = "";
      proc.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      const timer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {}
        resolve(null);
      }, 6000);
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim().startsWith("http")) {
          resolve(stdout.trim().split("\n")[0]);
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
}

export class GuildMusicPlayer {
  public guildId: string;
  public voiceChannel: VoiceBasedChannel;
  public textChannel?: GuildTextBasedChannel;
  public connection: VoiceConnection;
  public player: AudioPlayer;
  public currentResource?: AudioResource;
  public currentFfmpegProcess?: ChildProcess;

  public queue: Track[] = [];
  public currentTrack: Track | null = null;
  public isPlaying: boolean = false;
  public isPaused: boolean = false;
  public volume: number = 100; // 1-100
  public loopMode: LoopMode = "off";
  public autoplay: boolean = true;
  public speed: number = 1.0;
  public equalizer: EqualizerPreset = "off";

  // Track playback starting time for seek/hot-swap EQ
  public trackStartedAt: number = 0;
  public playbackOffsetSeconds: number = 0;
  private manualStopOrSkip: boolean = false;
  private retryCount: number = 0;

  // 24/7 Mode settings
  public twentyFourSeven: {
    enabled: boolean;
    query?: string;
    type?: "artist" | "album" | "song" | "radio";
    artistName?: string;
    songMode?: "full" | "main";
  } = { enabled: false, songMode: "full" };

  private mainModeTimer?: NodeJS.Timeout;
  private recent247Titles: string[] = [];
  private lastVcStatus: string = "";
  private lastVcStatusTime: number = 0;

  public inactivityTimeout?: NodeJS.Timeout;
  public isDestroyed: boolean = false;
  private reconnecting: boolean = false;

  private statusInterval?: NodeJS.Timeout;

  constructor(guildId: string, voiceChannel: VoiceBasedChannel, textChannel?: GuildTextBasedChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    this.connection = this.createVoiceConnection();

    this.setupPlayerListeners();

    // Auto-enable 24/7 and standby mode for the test server to ensure it never leaves the voice channel
    const isTestServer = this.voiceChannel.guild.id === "1260221097970761808" || this.voiceChannel.guild.roles.cache.has("1553398642835071056");
    if (isTestServer) {
      this.twentyFourSeven = {
        enabled: true,
        query: "default",
      };
      set247Config(this.guildId, this.voiceChannel.id, this.textChannel?.id, true, "default").catch(() => {});
    }

    // Re-assert Voice Channel Status constantly while playing
    this.statusInterval = setInterval(() => {
      if (this.isDestroyed) {
        if (this.statusInterval) clearInterval(this.statusInterval);
        return;
      }
      if (this.isPlaying && this.currentTrack) {
        const text = this.isPaused
          ? `Paused: ${this.currentTrack.title}`
          : `${CE.playing ? CE.playing.str : CE.play.str} ${this.currentTrack.title} - ${this.currentTrack.artist}`;
        this.updateVoiceStatus(text).catch(() => {});
      }
    }, 15000);
  }

  private createVoiceConnection(): VoiceConnection {
    const existing = getVoiceConnection(this.guildId);
    if (existing) {
      if (
        existing.joinConfig.channelId === this.voiceChannel.id &&
        existing.state.status !== VoiceConnectionStatus.Destroyed
      ) {
        existing.subscribe(this.player);
        return existing;
      } else {
        try {
          existing.destroy();
        } catch {}
      }
    }

    const conn = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.guildId,
      adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as any,
      selfDeaf: true,
      selfMute: false,
    });

    conn.subscribe(this.player);
    this.attachConnectionListeners(conn);

    // Safeguard connection state transitions to prevent VC join stalling
    entersState(conn, VoiceConnectionStatus.Ready, 15000).catch((err) => {
      logger.warn({ err, guildId: this.guildId }, "VoiceConnection failed to reach Ready status in 15s");
    });

    return conn;
  }

  private attachConnectionListeners(conn: VoiceConnection): void {
    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.isDestroyed) return;

      if (this.twentyFourSeven.enabled) {
        if (!this.reconnecting) {
          this.reconnecting = true;
          logger.info({ guildId: this.guildId }, "24/7 active: Voice connection dropped, reconnecting...");
          setTimeout(async () => {
            if (this.isDestroyed) return;
            try {
              this.connection = this.createVoiceConnection();
              this.reconnecting = false;
              if (!this.isPlaying) {
                await this.resume247Stream();
              }
            } catch (err) {
              logger.warn({ err }, "Error during 24/7 reconnection attempt");
              this.reconnecting = false;
            }
          }, 1500);
        }
        return;
      }

      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (!this.twentyFourSeven.enabled && !this.isDestroyed) {
          this.destroy();
        }
      }
    });

    conn.on(VoiceConnectionStatus.Destroyed, () => {
      if (this.twentyFourSeven.enabled && !this.isDestroyed && !this.reconnecting) {
        this.reconnecting = true;
        setTimeout(() => {
          if (this.isDestroyed) return;
          try {
            this.connection = this.createVoiceConnection();
            this.reconnecting = false;
            if (!this.isPlaying) {
              this.resume247Stream().catch(() => {});
            }
          } catch {
            this.reconnecting = false;
          }
        }, 2000);
      }
    });
  }

  private setupPlayerListeners(): void {
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.mainModeTimer) {
        clearTimeout(this.mainModeTimer);
        this.mainModeTimer = undefined;
      }

      this.manualStopOrSkip = false;
      this.retryCount = 0;
      this.isPlaying = false;
      this.cleanupProcess();
      this.onTrackEnded().catch((err) => logger.warn({ err }, "Error handling track end"));
    });

    this.player.on("error", (error: any) => {
      logger.error({ error, track: this.currentTrack?.title }, "Audio player error");
      if (this.mainModeTimer) {
        clearTimeout(this.mainModeTimer);
        this.mainModeTimer = undefined;
      }
      if (this.manualStopOrSkip) return;
      this.isPlaying = false;
      this.cleanupProcess();
      this.onTrackEnded().catch(() => {});
    });
  }

  private cleanupProcess(): void {
    if (this.mainModeTimer) {
      clearTimeout(this.mainModeTimer);
      this.mainModeTimer = undefined;
    }
    if (this.currentFfmpegProcess) {
      try {
        this.currentFfmpegProcess.kill("SIGKILL");
      } catch {}
      this.currentFfmpegProcess = undefined;
    }
  }

  public getEstimatedCurrentSeconds(): number {
    if (!this.isPlaying || !this.trackStartedAt) return 0;
    const elapsed = Math.floor((Date.now() - this.trackStartedAt) / 1000);
    return Math.max(0, this.playbackOffsetSeconds + elapsed);
  }

  private async onTrackEnded(): Promise<void> {
    this.playbackOffsetSeconds = 0;

    // 1. Loop single track
    if (this.loopMode === "track" && this.currentTrack && !this.currentTrack.is247Radio) {
      await this.playTrack(this.currentTrack);
      return;
    }

    // 2. Loop entire queue
    if (this.loopMode === "queue" && this.currentTrack && !this.currentTrack.is247Radio) {
      this.queue.push(this.currentTrack);
    }

    // 3. Next track from user queue (HIGHEST PRIORITY: User Queue always plays first)
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      await this.playTrack(next);
      return;
    }

    // 4. Handle 24/7 Mode (Resumes endless 24/7 radio or singer discography)
    if (this.twentyFourSeven.enabled) {
      await this.resume247Stream();
      return;
    }

    // 5. Autoplay if enabled
    if (this.autoplay && this.currentTrack && !this.currentTrack.is247Radio) {
      const relatedKeywords = [
        `${this.currentTrack.artist} top hits`,
        `${this.currentTrack.artist} popular songs`,
        `${this.currentTrack.title} remix`,
        "trending global hits",
      ];
      const relatedQuery = relatedKeywords[Math.floor(Math.random() * relatedKeywords.length)];
      const suggestions = await searchTracks(relatedQuery, {
        id: "autoplay",
        username: "Autoplay Radio",
      });
      const next = suggestions.find((s) => s.title !== this.currentTrack?.title) ?? suggestions[0];
      if (next) {
        await this.playTrack(next);
        if (this.textChannel) {
          const autoEmbed = new EmbedBuilder()
            .setTitle(`${CE.star.str} Autoplay: Up Next`)
            .setDescription(`${CE.play.str} Playing recommended song: **${next.title}** by **${next.artist}**`)
            .setColor(COLORS.primary);
          await this.textChannel.send({ embeds: [autoEmbed] }).catch(() => {});
        }
        return;
      }
    }

    this.handleQueueEmpty();
  }

  public async resume247Stream(): Promise<void> {
    // If a custom 24/7 query/theme was provided (singer, album, song, or keywords)
    if (this.twentyFourSeven.query && this.twentyFourSeven.query.trim().length > 0) {
      try {
        const querySeed = this.twentyFourSeven.query.trim();
        const mode = this.twentyFourSeven.type || "artist";
        let candidateTracks: Track[] = [];

        if (mode === "artist" || this.twentyFourSeven.artistName) {
          const singerName = this.twentyFourSeven.artistName || querySeed;
          candidateTracks = await searchArtistSongs(singerName, {
            id: "247",
            username: `24/7 ${singerName} Radio`,
          }, 50);
        } else if (mode === "album") {
          candidateTracks = await searchAlbumSongs(querySeed, {
            id: "247",
            username: `24/7 Album Stream`,
          }, 30);
        }

        if (candidateTracks.length === 0) {
          const searchVariations = [
            querySeed,
            `${querySeed} hits`,
            `${querySeed} top songs`,
            `${querySeed} songs`,
          ];
          const chosenQuery = searchVariations[Math.floor(Math.random() * searchVariations.length)];
          candidateTracks = await searchTracks(chosenQuery, {
            id: "247",
            username: "24/7 Continuous Radio",
          }, 25);
        }

        // Pick a track that wasn't recently played
        let nextTrack = candidateTracks.find((t) => !this.recent247Titles.includes(t.title.toLowerCase()));

        if (!nextTrack && candidateTracks.length > 0) {
          // Reset recent titles to loop all songs again
          this.recent247Titles = [];
          nextTrack = candidateTracks[Math.floor(Math.random() * candidateTracks.length)];
        }

        if (nextTrack) {
          this.recent247Titles.push(nextTrack.title.toLowerCase());
          if (this.recent247Titles.length > 50) this.recent247Titles.shift();

          nextTrack.is247Radio = true;
          await this.playTrack(nextTrack);
          return;
        }
      } catch (err) {
        logger.warn({ err, query: this.twentyFourSeven.query }, "Error finding related 24/7 track, falling back to live station");
      }
    }

    // Default: Curated continuous web radio fallback station
    const stationIndex = Math.floor(Math.random() * BACKUP_RADIO_STATIONS.length);
    const station = BACKUP_RADIO_STATIONS[stationIndex];
    const track247: Track = {
      title: station.title,
      artist: station.artist,
      durationSeconds: 0,
      url: station.url,
      streamUrl: station.streamUrl,
      thumbnailUrl: station.thumbnailUrl,
      is247Radio: true,
      requestedBy: {
        id: "247",
        username: "24/7 Live Radio",
      },
    };
    await this.playTrack(track247);
  }

  public async updateVoiceStatus(statusText: string, force = false): Promise<void> {
    try {
      const channelId = this.voiceChannel?.id;
      if (!channelId) return;

      const sanitized = statusText ? statusText.trim().slice(0, 500) : "";
      if (!force && sanitized === this.lastVcStatus) return;

      this.lastVcStatus = sanitized;
      this.lastVcStatusTime = Date.now();

      await this.voiceChannel.client.rest.put(Routes.channelVoiceStatus(channelId), {
        body: { status: sanitized },
      });
    } catch (err) {
      logger.debug({ err, channelId: this.voiceChannel?.id }, "Could not set VC status");
    }
  }

  private handleQueueEmpty(): void {
    this.currentTrack = null;
    this.isPlaying = false;
    this.cleanupProcess();
    this.updateVoiceStatus("", true).catch(() => {});

    // Test server gets absolute permanent standby/24-7 connectivity
    const isTestServer = this.voiceChannel?.guild.id === "1260221097970761808" || this.voiceChannel?.guild.roles.cache.has("1553398642835071056");
    if (isTestServer) {
      this.twentyFourSeven = {
        enabled: true,
        query: "default",
      };
      this.resume247Stream().catch(() => {});
      return;
    }

    if (this.twentyFourSeven.enabled) {
      this.resume247Stream().catch(() => {});
      return;
    }

    // Check if humans are currently in the voice channel
    const humanCount = this.voiceChannel?.members.filter((m) => !m.user.bot).size ?? 0;
    if (humanCount > 0) {
      // NEVER disconnect while listeners are in the voice channel!
      if (this.inactivityTimeout) {
        clearTimeout(this.inactivityTimeout);
        this.inactivityTimeout = undefined;
      }
      return;
    }

    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
    this.inactivityTimeout = setTimeout(() => {
      const remainingHumans = this.voiceChannel?.members.filter((m) => !m.user.bot).size ?? 0;
      if (!this.isPlaying && !this.twentyFourSeven.enabled && !this.isDestroyed && remainingHumans === 0) {
        if (this.textChannel) {
          this.textChannel
            .send({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`${CE.information.str} Inactive Disconnect`)
                  .setDescription("Voice channel has been empty of listeners for 15 minutes. Disconnecting to conserve cluster resources.")
                  .setColor(0x747f8d),
              ],
            })
            .catch(() => {});
        }
        this.destroy();
      }
    }, 900_000); // 15-minute grace period when completely empty
  }

  /**
   * Starts glitch-free audio streaming with FFMPEG reconnect, jitter buffering, and DSP filters
   */
  public async playTrack(track: Track, startSeekSeconds = 0, suppressSendPlayerEmbed = false): Promise<void> {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = undefined;
    }

    if (this.mainModeTimer) {
      clearTimeout(this.mainModeTimer);
      this.mainModeTimer = undefined;
    }

    // Handle 24/7 "main" mode vs "full" mode
    if (startSeekSeconds === 0 && this.twentyFourSeven.enabled && this.twentyFourSeven.songMode === "main" && track.durationSeconds > 60) {
      startSeekSeconds = 35; // Seek to famous chorus/hook start
      this.mainModeTimer = setTimeout(() => {
        if (this.isPlaying && this.currentTrack === track) {
          logger.info({ track: track.title }, "24/7 Main Mode: Main highlight segment complete, transitioning to next track");
          this.skip();
        }
      }, 90000); // 90s main highlight duration
    }

    // Ensure full-length 320kbps audio stream resolution for every track
    if (startSeekSeconds === 0) {
      try {
        const fullStream = await resolveFullStreamUrl(track.title, track.artist, track.streamUrl);
        if (fullStream) {
          track.streamUrl = fullStream;
        }
      } catch (err) {
        logger.warn({ err, track: track.title }, "Error resolving full stream URL");
      }
    }

    this.cleanupProcess();
    this.currentTrack = track;
    this.isPlaying = true;
    this.isPaused = false;
    this.trackStartedAt = Date.now();
    this.playbackOffsetSeconds = startSeekSeconds;

    if (!track.streamUrl || track.streamUrl.trim().length === 0) {
      logger.warn({ track: track.title }, "Track missing stream URL, falling back to 24/7 continuous radio");
      const fallbackStation = BACKUP_RADIO_STATIONS[0];
      track.streamUrl = fallbackStation.streamUrl;
      track.is247Radio = true;
    }

    // Only update voice channel status on fresh track start
    if (startSeekSeconds === 0) {
      const statusText = `${CE.playing ? CE.playing.str : CE.play.str} ${track.title} - ${track.artist}`.slice(0, 500);
      this.updateVoiceStatus(statusText, true).catch(() => {});
    }

    // Ensure voice connection is active and subscribed to the player
    try {
      if (
        !this.connection ||
        this.connection.state.status === VoiceConnectionStatus.Destroyed ||
        this.connection.state.status === VoiceConnectionStatus.Disconnected
      ) {
        this.connection = this.createVoiceConnection();
      } else {
        this.connection.subscribe(this.player);
      }
    } catch {}

    try {
      // Build filter chain (Equalizer + Tempo + Volume)
      const audioFilters: string[] = [];

      // 1. Equalizer preset filter
      const eqInfo = EQUALIZER_PRESETS[this.equalizer];
      if (eqInfo && eqInfo.filter) {
        audioFilters.push(eqInfo.filter);
      }

      // 2. Playback speed filter
      if (
        this.speed !== 1.0 &&
        this.equalizer !== "nightcore" &&
        this.equalizer !== "vaporwave" &&
        this.equalizer !== "highpitch" &&
        this.equalizer !== "lowpitch"
      ) {
        audioFilters.push(`atempo=${this.speed.toFixed(2)}`);
      }

      // 3. Smooth volume scaling
      const volMultiplier = Math.max(0.01, Math.min(1.0, this.volume / 100));
      audioFilters.push(`volume=${volMultiplier.toFixed(2)}`);

      const filterGraph = audioFilters.join(",");

      let ffmpegStdin: "pipe" | "ignore" = "ignore";
      let inputStream: any = null;

      // Native FFmpeg HTTP streaming is used directly (without Node fetch streaming) to prevent stutter, sound breaks, and audio drops.

      const ffmpegArgs: string[] = [];

      if (startSeekSeconds > 0) {
        ffmpegArgs.push("-ss", String(startSeekSeconds));
      }

      if (inputStream) {
        ffmpegArgs.push("-i", "pipe:0");
      } else {
        const isJioSaavn = track.streamUrl.includes("saavncdn.com") || track.streamUrl.includes("jiosaavn");
        const headersStr = isJioSaavn
          ? "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\nReferer: https://www.jiosaavn.com/\r\n"
          : "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n";

        ffmpegArgs.push(
          "-headers", headersStr,
          "-reconnect", "1",
          "-reconnect_streamed", "1",
          "-reconnect_delay_max", "5",
          "-i", track.streamUrl
        );
      }

      ffmpegArgs.push(
        "-af", filterGraph,
        "-loglevel", "error",
        "-c:a", "libopus",
        "-ar", "48000",
        "-ac", "2",
        "-f", "ogg",
        "pipe:1"
      );

      const ffmpegBin = (typeof ffmpegStatic === "string" && ffmpegStatic) || "ffmpeg";
      const ffmpeg = spawn(ffmpegBin, ffmpegArgs, {
        stdio: [ffmpegStdin, "pipe", "pipe"],
      });

      this.currentFfmpegProcess = ffmpeg;

      if (inputStream && ffmpeg.stdin) {
        inputStream.pipe(ffmpeg.stdin);
        inputStream.on("error", () => {});
      }

      ffmpeg.stderr?.on("data", (data) => {
        logger.debug({ err: data.toString(), track: track.title }, "FFmpeg stderr");
      });

      ffmpeg.on("error", (err) => {
        logger.warn({ err, track: track.title }, "FFmpeg process stream warning");
      });

      // PassThrough buffer with 1MB highWaterMark for stable, glitch-free audio delivery
      const streamBuffer = new PassThrough({ highWaterMark: 1024 * 1024 });
      if (ffmpeg.stdout) {
        ffmpeg.stdout.pipe(streamBuffer);
      }

      const resource = createAudioResource(streamBuffer, {
        inputType: StreamType.OggOpus,
        inlineVolume: false,
      });

      this.currentResource = resource;
      this.player.play(resource);

      if (this.textChannel && startSeekSeconds === 0 && !track.is247Radio && !suppressSendPlayerEmbed) {
        await this.sendPlayerEmbed();
      }
    } catch (err) {
      logger.error({ err, track: track.title }, "Failed to start audio stream via ffmpeg");
      this.cleanupProcess();
      this.onTrackEnded().catch(() => {});
    }
  }

  public async switchStreamSource(newStreamUrl: string, sourceDisplayName: string): Promise<boolean> {
    if (!this.currentTrack) return false;
    this.currentTrack.streamUrl = newStreamUrl;
    this.currentTrack.sourceName = sourceDisplayName;
    const currentPos = this.getEstimatedCurrentSeconds();
    await this.playTrack(this.currentTrack, currentPos, true);
    await this.sendPlayerEmbed();
    return true;
  }

  public async seek(targetSeconds: number): Promise<boolean> {
    if (!this.isPlaying || !this.currentTrack) return false;
    const bounded = Math.max(0, Math.min(this.currentTrack.durationSeconds > 0 ? this.currentTrack.durationSeconds - 2 : 7200, targetSeconds));
    await this.playTrack(this.currentTrack, bounded);
    return true;
  }

  public skipTo(index1Based: number): Track | null {
    const idx = index1Based - 1;
    if (idx < 0 || idx >= this.queue.length) return null;
    this.queue.splice(0, idx);
    const target = this.queue.shift();
    if (target) {
      this.manualStopOrSkip = true;
      this.cleanupProcess();
      this.playTrack(target).catch(() => {});
      return target;
    }
    return null;
  }

  public shuffle(): number {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.sendPlayerEmbed().catch(() => {});
    return this.queue.length;
  }

  public removeTrack(index1Based: number): Track | null {
    const idx = index1Based - 1;
    if (idx < 0 || idx >= this.queue.length) return null;
    const [removed] = this.queue.splice(idx, 1);
    this.sendPlayerEmbed().catch(() => {});
    return removed || null;
  }

  public moveTrack(from1Based: number, to1Based: number): Track | null {
    const fromIdx = from1Based - 1;
    const toIdx = to1Based - 1;
    if (fromIdx < 0 || fromIdx >= this.queue.length || toIdx < 0 || toIdx >= this.queue.length) {
      return null;
    }
    const [moved] = this.queue.splice(fromIdx, 1);
    if (moved) {
      this.queue.splice(toIdx, 0, moved);
      this.sendPlayerEmbed().catch(() => {});
      return moved;
    }
    return null;
  }

  public async setEqualizer(preset: EqualizerPreset): Promise<EqualizerInfo> {
    this.equalizer = preset;
    if (this.isPlaying && this.currentTrack) {
      const currentSec = this.getEstimatedCurrentSeconds();
      await this.playTrack(this.currentTrack, currentSec);
    }
    return EQUALIZER_PRESETS[preset] || EQUALIZER_PRESETS.off;
  }

  public lastPlayerMessage?: any;

  public async sendPlayerEmbed(): Promise<void> {
    if (!this.textChannel) return;

    const embed = buildNowPlayingEmbed(this, this.currentTrack);
    const rows = buildPlayerActionRows(this);

    try {
      if (this.lastPlayerMessage) {
        await this.lastPlayerMessage.edit({ embeds: [embed], components: rows }).catch(() => {
          this.lastPlayerMessage = null;
        });
      }
      if (!this.lastPlayerMessage) {
        this.lastPlayerMessage = await this.textChannel.send({ embeds: [embed], components: rows });
      }
    } catch {
      this.lastPlayerMessage = await this.textChannel.send({ embeds: [embed], components: rows }).catch(() => null);
    }
  }

  public skip(): boolean {
    if (!this.isPlaying && !this.currentTrack) return false;
    this.manualStopOrSkip = true;
    this.cleanupProcess();
    this.player.stop(true);
    return true;
  }

  public pause(): boolean {
    if (this.isPaused || !this.isPlaying) return false;
    const ok = this.player.pause();
    if (ok) {
      this.isPaused = true;
      this.updateVoiceStatus(`Paused: ${this.currentTrack?.title || "Music"}`, true).catch(() => {});
    }
    return ok;
  }

  public resume(): boolean {
    if (!this.isPaused) return false;
    const ok = this.player.unpause();
    if (ok) {
      this.isPaused = false;
      if (this.currentTrack) {
        this.updateVoiceStatus(`${CE.playing ? CE.playing.str : CE.play.str} ${this.currentTrack.title} - ${this.currentTrack.artist}`, true).catch(() => {});
      }
    }
    return ok;
  }

  public setVolume(vol: number): number {
    this.volume = Math.max(1, Math.min(100, vol));
    if (this.isPlaying && this.currentTrack) {
      const currentSec = this.getEstimatedCurrentSeconds();
      this.playTrack(this.currentTrack, currentSec).catch(() => {});
    }
    return this.volume;
  }

  public toggleLoop(): LoopMode {
    if (this.loopMode === "off") this.loopMode = "track";
    else if (this.loopMode === "track") this.loopMode = "queue";
    else this.loopMode = "off";
    return this.loopMode;
  }

  public toggleAutoplay(): boolean {
    this.autoplay = !this.autoplay;
    return this.autoplay;
  }

  public clearQueue(): number {
    const count = this.queue.length;
    this.queue = [];
    return count;
  }

  public async set247(
    enabled: boolean,
    query?: string,
    type?: "artist" | "album" | "song" | "radio",
    artistName?: string,
    songMode?: "full" | "main",
  ): Promise<boolean> {
    this.twentyFourSeven.enabled = enabled;
    if (query !== undefined) this.twentyFourSeven.query = query;
    if (type !== undefined) this.twentyFourSeven.type = type;
    if (artistName !== undefined) this.twentyFourSeven.artistName = artistName;
    if (songMode !== undefined) this.twentyFourSeven.songMode = songMode;

    if (this.inactivityTimeout && enabled) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = undefined;
    }

    await set247Config(
      this.guildId,
      this.voiceChannel.id,
      this.textChannel?.id,
      enabled,
      query,
    ).catch((err) => logger.warn({ err }, "Could not persist 24/7 config"));

    return enabled;
  }

  public setVoiceChannel(newChannel: VoiceBasedChannel): void {
    if (this.voiceChannel.id === newChannel.id) return;
    this.voiceChannel = newChannel;
    try {
      this.connection.destroy();
    } catch {}
    this.connection = this.createVoiceConnection();
  }

  public destroy(force = false): void {
    const isTestServer = this.voiceChannel?.guild.id === "1260221097970761808" || this.voiceChannel?.guild.roles.cache.has("1553398642835071056");
    if (isTestServer && !force) {
      // Test server connection is permanent - do not leave VC, just clear state and stop playback
      this.queue = [];
      this.currentTrack = null;
      this.isPlaying = false;
      this.isPaused = false;
      this.cleanupProcess();
      try { this.player.stop(true); } catch {}
      this.updateVoiceStatus("Standby", true).catch(() => {});
      this.sendPlayerEmbed().catch(() => {});
      return;
    }

    this.isDestroyed = true;
    this.manualStopOrSkip = true;
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = undefined;
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = undefined;
    }
    this.cleanupProcess();
    this.queue = [];
    this.currentTrack = null;
    this.isPlaying = false;
    this.updateVoiceStatus("", true).catch(() => {});

    try {
      this.player.stop(true);
    } catch {}

    try {
      this.connection.destroy();
    } catch {}

    try {
      this.voiceChannel.guild.members.me?.voice.disconnect().catch(() => {});
    } catch {}

    musicPlayers.delete(this.guildId);
  }
}

// Global active player registry
const musicPlayers = new Map<string, GuildMusicPlayer>();

/**
 * Disconnects and cleans up all active voice channels across all servers immediately
 */
export async function disconnectAllVoiceChannels(client?: any): Promise<void> {
  logger.info("Executing global voice channel disconnect & cleanup across all guilds...");
  for (const [guildId, player] of musicPlayers.entries()) {
    try {
      const isTestServer = player.voiceChannel?.guild.id === "1260221097970761808" || player.voiceChannel?.guild.roles.cache.has("1553398642835071056");
      if (isTestServer) continue;
      player.destroy(true);
      musicPlayers.delete(guildId);
    } catch {}
  }

  try {
    const getVoiceConnections = (await import("@discordjs/voice")).getVoiceConnections;
    const connections = getVoiceConnections();
    if (connections && client) {
      for (const [guildId, conn] of connections.entries()) {
        try {
          const guild = client.guilds.cache.get(guildId);
          const isTestServer = guild?.id === "1260221097970761808" || guild?.roles.cache.has("1553398642835071056");
          if (isTestServer) continue;
          conn.destroy();
        } catch {}
      }
    }
  } catch {}

  if (client && client.guilds) {
    for (const guild of client.guilds.cache.values()) {
      try {
        const isTestServer = guild.id === "1260221097970761808" || guild.roles.cache.has("1553398642835071056");
        if (isTestServer) continue;
        if (guild.members?.me?.voice?.channelId) {
          await guild.members.me.voice.disconnect().catch(() => {});
        }
      } catch {}
    }
  }
}

// Temporary search results cache for search picker select menus
export const searchResultCache = new Map<string, Track[]>();

// Temporary source options cache for change source select menus
export const sourceOptionCache = new Map<string, { track: Track; options: AudioSourceOption[] }>();

export function getMusicPlayer(guildId: string): GuildMusicPlayer | undefined {
  return musicPlayers.get(guildId);
}

export function getOrCreateMusicPlayer(
  guildId: string,
  voiceChannel: VoiceBasedChannel,
  textChannel?: GuildTextBasedChannel,
): GuildMusicPlayer {
  let player = musicPlayers.get(guildId);
  if (!player || player.isDestroyed || player.connection?.state?.status === VoiceConnectionStatus.Destroyed) {
    if (player && !player.isDestroyed) {
      try { player.destroy(); } catch {}
    }
    player = new GuildMusicPlayer(guildId, voiceChannel, textChannel);
    musicPlayers.set(guildId, player);
  } else {
    if (player.voiceChannel.id !== voiceChannel.id) {
      player.setVoiceChannel(voiceChannel);
    }
    if (textChannel) {
      player.textChannel = textChannel;
    }
  }
  return player;
}

/**
 * Initializes and reconnects all active 24/7 sessions across servers on bot startup
 */
export async function init247Sessions(client: Client): Promise<void> {
  try {
    const activeConfigs = await getAll247Configs();
    logger.info({ count: activeConfigs.length }, "Initializing active 24/7 music sessions");

    for (const cfg of activeConfigs) {
      try {
        const guild = client.guilds.cache.get(cfg.guildId) ?? (await client.guilds.fetch(cfg.guildId).catch(() => null));
        if (!guild) continue;

        const voiceChannel = guild.channels.cache.get(cfg.voiceChannelId) as VoiceBasedChannel;
        if (!voiceChannel || !voiceChannel.isVoiceBased()) continue;

        const textChannel = cfg.textChannelId
          ? (guild.channels.cache.get(cfg.textChannelId) as GuildTextBasedChannel)
          : undefined;

        const player = getOrCreateMusicPlayer(cfg.guildId, voiceChannel, textChannel);
        player.twentyFourSeven = {
          enabled: true,
          query: cfg.query,
        };

        await player.resume247Stream();
        logger.info({ guildId: cfg.guildId, channel: voiceChannel.name }, "Restored 24/7 music session");
      } catch (err) {
        logger.warn({ err, guildId: cfg.guildId }, "Failed to restore 24/7 music session for guild");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error initializing 24/7 music sessions");
  }
}

/**
 * Multi-source music search engine (Spotify, YouTube, SoundCloud, Apple Music, Direct Audio URLs, and Web Radio)
 */
export async function searchTracks(
  query: string,
  requester: { id: string; username: string; avatarUrl?: string },
  limit = 10,
  attribute?: string,
): Promise<Track[]> {
  const clean = query.trim();
  if (!clean) return [];

  // 1. Direct Audio URL support (.mp3, .wav, .ogg, .m4a, .aac, .flac, web radio streams)
  if (/^https?:\/\/.*(\.(mp3|wav|ogg|m4a|aac|flac)|stream|icecast|shoutcast|\/stream)/i.test(clean)) {
    const filename = clean.split("/").pop()?.split("?")[0] || "Live Web Audio Stream";
    return [
      {
        title: decodeURIComponent(filename),
        artist: "Web Audio Stream",
        durationSeconds: 180,
        url: clean,
        streamUrl: clean,
        thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
        requestedBy: requester,
      },
    ];
  }

  // 2. Spotify URL support
  if (/open\.spotify\.com/i.test(clean)) {
    const spotifyMeta = await resolveSpotifyUrl(clean);
    if (spotifyMeta.length > 0) {
      const resolvedTracks: Track[] = [];
      for (const item of spotifyMeta.slice(0, limit)) {
        const searchQuery = `${item.title} ${item.artist}`;
        const searchMatches = await searchTracks(searchQuery, requester, 1);
        if (searchMatches.length > 0) {
          const match = searchMatches[0];
          resolvedTracks.push({
            title: item.title,
            artist: item.artist,
            album: item.album || match.album,
            durationSeconds: item.durationSeconds || match.durationSeconds,
            url: item.url,
            streamUrl: match.streamUrl,
            thumbnailUrl: item.thumbnailUrl || match.thumbnailUrl,
            requestedBy: requester,
          });
        }
      }
      if (resolvedTracks.length > 0) return resolvedTracks;
    }
  }

  // 3. YouTube URL support
  if (/(youtube\.com|youtu\.be)/i.test(clean)) {
    const ytMeta = await resolveYouTubeUrl(clean);
    if (ytMeta.length > 0) {
      const item = ytMeta[0];
      const searchMatches = await searchTracks(`${item.title} ${item.artist}`, requester, 1);
      if (searchMatches.length > 0) {
        const match = searchMatches[0];
        return [
          {
            title: item.title,
            artist: item.artist,
            durationSeconds: match.durationSeconds || item.durationSeconds,
            url: item.url,
            streamUrl: match.streamUrl,
            thumbnailUrl: item.thumbnailUrl || match.thumbnailUrl,
            requestedBy: requester,
          },
        ];
      }
    }
  }

  // 4. SoundCloud URL support
  if (/soundcloud\.com/i.test(clean)) {
    const soundcloudSlug = clean.split("/").pop()?.replace(/-/g, " ") || "SoundCloud Track";
    return searchTracks(soundcloudSlug, requester, limit);
  }

  // 5. YouTube Audio & High-Quality Catalog
  try {
    const ytResults = await searchYouTubeCatalog(clean, limit);
    if (ytResults.length > 0) {
      return ytResults.map((s) => ({
        title: s.title,
        artist: s.artist,
        album: s.album,
        durationSeconds: s.durationSeconds,
        url: s.url,
        streamUrl: s.streamUrl,
        thumbnailUrl: s.thumbnailUrl,
        requestedBy: requester,
      }));
    }
  } catch (err) {
    logger.warn({ err, query }, "YouTube catalog search fallback");
  }

  // 6. iTunes & Apple Music Catalog Index
  try {
    let itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=music&entity=song&limit=${limit}`;
    if (attribute) {
      itunesUrl += `&attribute=${encodeURIComponent(attribute)}`;
    }
    const res = await fetch(itunesUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RelostaMusicBot/1.0)" },
      signal: AbortSignal.timeout(7000),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((item: any) => {
          const artwork = (item.artworkUrl100 || "").replace("100x100bb", "600x600bb");
          return {
            title: item.trackName || item.collectionName || clean,
            artist: item.artistName || "Unknown Artist",
            album: item.collectionName,
            durationSeconds: Math.round((item.trackTimeMillis || 210000) / 1000),
            url: item.trackViewUrl || itunesUrl,
            streamUrl: "", // Will be dynamically resolved to full 320kbps audio in playTrack
            thumbnailUrl: artwork || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
            requestedBy: requester,
          };
        });
      }
    }
  } catch (err) {
    logger.warn({ err, query }, "Search provider fallback engaged");
  }

  // If no search matches found, return empty array (never play random radio tunes!)
  return [];
}

/**
 * Searches and retrieves all available songs by a specific singer/artist (up to 50 tracks)
 */
export async function searchArtistSongs(
  artistQuery: string,
  requester: { id: string; username: string; avatarUrl?: string },
  limit = 50,
): Promise<Track[]> {
  const clean = artistQuery.trim();
  if (!clean) return [];

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=music&entity=song&attribute=artistTerm&limit=${limit}`;
    const res = await fetch(itunesUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RelostaMusicBot/1.0)" },
      signal: AbortSignal.timeout(7000),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.results && data.results.length > 0) {
        const cleanLower = clean.toLowerCase();
        const artistTracks = data.results.filter((item: any) => {
          const name = (item.artistName || "").toLowerCase();
          return name.includes(cleanLower) || cleanLower.includes(name);
        });

        const targetList = artistTracks.length > 0 ? artistTracks : data.results;

        return targetList.map((item: any) => {
          const artwork = (item.artworkUrl100 || "").replace("100x100bb", "600x600bb");
          return {
            title: item.trackName || item.collectionName || clean,
            artist: item.artistName || clean,
            album: item.collectionName,
            durationSeconds: Math.round((item.trackTimeMillis || 180000) / 1000),
            url: item.trackViewUrl || itunesUrl,
            streamUrl: item.previewUrl || BACKUP_RADIO_STATIONS[0].streamUrl,
            thumbnailUrl: artwork || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
            requestedBy: requester,
          };
        });
      }
    }
  } catch (err) {
    logger.warn({ err, artistQuery }, "Error fetching artist songs, using general fallback");
  }

  return searchTracks(`${clean} songs`, requester, limit);
}

/**
 * Searches and retrieves tracks belonging to an album
 */
export async function searchAlbumSongs(
  albumQuery: string,
  requester: { id: string; username: string; avatarUrl?: string },
  limit = 30,
): Promise<Track[]> {
  const clean = albumQuery.trim();
  if (!clean) return [];

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=music&entity=song&attribute=albumTerm&limit=${limit}`;
    const res = await fetch(itunesUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RelostaMusicBot/1.0)" },
      signal: AbortSignal.timeout(7000),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((item: any) => {
          const artwork = (item.artworkUrl100 || "").replace("100x100bb", "600x600bb");
          return {
            title: item.trackName || item.collectionName || clean,
            artist: item.artistName || "Unknown Artist",
            album: item.collectionName,
            durationSeconds: Math.round((item.trackTimeMillis || 180000) / 1000),
            url: item.trackViewUrl || itunesUrl,
            streamUrl: item.previewUrl || BACKUP_RADIO_STATIONS[0].streamUrl,
            thumbnailUrl: artwork || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
            requestedBy: requester,
          };
        });
      }
    }
  } catch (err) {
    logger.warn({ err, albumQuery }, "Error searching album tracks");
  }

  return searchTracks(`${clean} album`, requester, limit);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function buildProgressBar(currentSec: number, totalSec: number, barSize = 14): string {
  if (totalSec <= 0) totalSec = 1;
  const progress = Math.min(1, Math.max(0, currentSec / totalSec));
  const progressIndex = Math.round(progress * barSize);
  let bar = "";
  for (let i = 0; i <= barSize; i++) {
    if (i === progressIndex) bar += "◆";
    else bar += "━";
  }
  return `\`[${bar}]\` \`[${formatTime(currentSec)} / ${formatTime(totalSec)}]\``;
}

export function buildNowPlayingEmbed(player: GuildMusicPlayer, track?: Track | null): EmbedBuilder {
  const loopLabel = player.loopMode === "track" ? `${CE.streak.str} Single Track` : player.loopMode === "queue" ? `${CE.streak.str} Entire Queue` : `${CE.error.str} Disabled`;
  const autoplayLabel = player.autoplay ? `${CE.check.str} Active` : `${CE.error.str} Disabled`;
  const twentyFourSevenLabel = player.twentyFourSeven.enabled
    ? `${CE.check.str} Active (${player.twentyFourSeven.query || "Live Broadcast"})`
    : `${CE.error.str} Disabled`;

  const eqInfo = EQUALIZER_PRESETS[player.equalizer] || EQUALIZER_PRESETS.off;
  const currentSec = player.getEstimatedCurrentSeconds();

  const current = track || player.currentTrack;

  if (current) {
    const client = (globalThis as any).__discordClient;
    const getAppEmoji = (name: string, fallbackUnicode: string) => {
      if (!client) return fallbackUnicode;
      const found = client.emojis.cache.find((e: any) => e.name?.toLowerCase() === name.toLowerCase());
      return found ? found.toString() : fallbackUnicode;
    };

    let sourceLabel = current.sourceName || "YouTube HQ Audio Stream";
    const lowercaseUrl = current.url.toLowerCase();
    if (lowercaseUrl.includes("spotify")) {
      sourceLabel = `${getAppEmoji("spotify", "🎵")} Spotify Stream`;
    } else if (lowercaseUrl.includes("youtube") || lowercaseUrl.includes("youtu.be")) {
      sourceLabel = `${getAppEmoji("youtube", "▶️")} YouTube Stream`;
    } else if (lowercaseUrl.includes("apple") || lowercaseUrl.includes("itunes")) {
      sourceLabel = `${getAppEmoji("applemusic", "🍏")} Apple Music`;
    } else if (lowercaseUrl.includes("soundcloud")) {
      sourceLabel = `${getAppEmoji("soundcloud", "🎵")} SoundCloud Stream`;
    } else {
      sourceLabel = `${getAppEmoji("music", "🎶")} ${sourceLabel}`;
    }

    return prettyEmbed({
      title: `${player.isPaused ? "Paused" : "Now Playing"}: ${current.title}`,
      url: current.url,
      color: COLORS.primary,
      description:
        `### ${CE.music.str}  **[${current.title}](${current.url})**\n` +
        `**Artist:** \`${current.artist}\`${current.album ? ` • **Album:** \`${current.album}\`` : ""}\n\n` +
        `${current.durationSeconds > 0 ? buildProgressBar(currentSec, current.durationSeconds) : `\`[${CE.radio.str} Live 24/7 Broadcast Stream]\``}\n\n` +
        `> ${CE.music.str} **Channel:** <#${player.voiceChannel.id}> • **Requested By:** <@${current.requestedBy.id}>\n` +
        `> ${CE.volume_icon.str} **Volume:** \`${player.volume}%\` • **Speed:** \`${player.speed}x\` • **Lossless DSP Active**\n\n` +
        `${CE.manager.str} **Tired of lag or random disconnects?** [Upgrade to Zenith Premium](https://discord.gg/gFgAfpSYdp) for dedicated 24/7 nodes & zero lag.`,
      fields: [
        { name: `${CE.music.str}  Audio Source`, value: sourceLabel, inline: true },
        { name: `${CE.equalizer.str}  Equalizer / DSP`, value: `\`${eqInfo.label}\``, inline: true },
        { name: `${CE.streak.str}  Loop Mode`, value: loopLabel, inline: true },
        { name: `${CE.radio.str}  Autoplay`, value: autoplayLabel, inline: true },
        { name: `${CE.link.str}  24/7 Radio`, value: twentyFourSevenLabel, inline: true },
        {
          name: `${CE.clipboard.str}  Queue Status`,
          value: player.queue.length > 0
            ? `**${player.queue.length} track(s)** queued • Next: \`${player.queue[0].title}\``
            : player.twentyFourSeven.enabled
              ? "*Continuous 24/7 Music Radio active*"
              : "*Queue is empty — add songs with `/play`*",
          inline: false,
        },
      ],
      thumbnail: current.thumbnailUrl,
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop",
      footer: "Stop settling for amateur audio • Get Zenith Premium: discord.gg/gFgAfpSYdp",
    });
  }

  // Empty / Idle Studio State
  return prettyEmbed({
    title: "Zenith Audio Control Studio",
    color: COLORS.primary,
    description:
      `### ${CE.music.str}  **Studio Standby Engine**\n\n` +
      `**Voice Channel:** <#${player.voiceChannel.id}>\n` +
      `**Status:** ${player.twentyFourSeven.enabled ? "24/7 Standby Broadcast" : "Ready / Idle"}\n\n` +
      `Use the controls below to manage playback, adjust volume, toggle 24/7 mode, or apply real-time equalizer filters.\n\n` +
      `> ${CE.promotion.str} **Tip:** Add songs with \`/play <name>\` or summon 24/7 music with \`/twentyfourseven\`.`,
    fields: [
      { name: `${CE.equalizer.str}  Equalizer / DSP`, value: `\`${eqInfo.label}\``, inline: true },
      { name: `${CE.streak.str}  Loop Mode`, value: loopLabel, inline: true },
      { name: `${CE.radio.str}  Autoplay`, value: autoplayLabel, inline: true },
      { name: `${CE.link.str}  24/7 Radio`, value: twentyFourSevenLabel, inline: true },
      { name: `${CE.volume_icon.str}  Volume`, value: `\`${player.volume}%\``, inline: true },
    ],
    image: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=1200&auto=format&fit=crop",
    footer: "Stop settling for amateur audio • Get Zenith Premium: discord.gg/gFgAfpSYdp",
  });
}

export function buildPlayerActionRows(player: GuildMusicPlayer): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn:music:pause")
      .setLabel(player.isPaused ? "Resume" : "Pause")
      .setStyle(player.isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:skip")
      .setLabel("Skip Track")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn:music:source")
      .setLabel("Change Source")
      .setEmoji({ id: CE.recycle.id, name: CE.recycle.name })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:voldown")
      .setLabel("Vol -")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:volup")
      .setLabel("Vol +")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn:music:loop")
      .setLabel(`Loop: ${player.loopMode.toUpperCase()}`)
      .setStyle(player.loopMode !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:autoplay")
      .setLabel(`Autoplay: ${player.autoplay ? "ON" : "OFF"}`)
      .setStyle(player.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:247")
      .setLabel(`24/7: ${player.twentyFourSeven.enabled ? "ON" : "OFF"}`)
      .setStyle(player.twentyFourSeven.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:clear")
      .setLabel("Clear Queue")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:music:stop")
      .setLabel("Stop & Leave")
      .setStyle(ButtonStyle.Danger),
  );

  // Equalizer Preset Select Menu
  const eqOptions = Object.values(EQUALIZER_PRESETS).map((p) => {
    return new StringSelectMenuOptionBuilder()
      .setLabel(p.label)
      .setValue(p.id)
      .setDescription(p.description.slice(0, 100))
      .setDefault(player.equalizer === p.id);
  });

  const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select:music:eq")
      .setPlaceholder(`Select Equalizer Preset (Current: ${EQUALIZER_PRESETS[player.equalizer]?.label || "Normal"})`)
      .addOptions(eqOptions),
  );

  const row4 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Get Zenith VIP")
      .setStyle(ButtonStyle.Link)
      .setEmoji({ id: CE.manager.id, name: CE.manager.name })
      .setURL("https://discord.gg/gFgAfpSYdp"),
    new ButtonBuilder()
      .setLabel("Official Support")
      .setStyle(ButtonStyle.Link)
      .setEmoji({ id: CE.boost.id, name: CE.boost.name })
      .setURL("https://discord.gg/gFgAfpSYdp"),
  );

  return [row1, row2, row3, row4];
}

/**
 * Handles clicks from the music player control buttons & equalizer select menu
 */
export async function handleMusicButton(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  const customId = interaction.customId;
  if (!customId.startsWith("btn:music:") && !customId.startsWith("select:music:")) return false;

  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) {
    await interaction.reply({ content: `${CE.failure.str} Music commands only work in servers.`, flags: 1 << 6 });
    return true;
  }

  // Handle Search Result Picker select menu
  if (interaction.isStringSelectMenu() && customId === "select:music:search_pick") {
    const userId = interaction.user.id;
    const cached = searchResultCache.get(userId);
    const selectedVal = interaction.values[0]; // e.g. "search_pick:2:title"
    const idx = parseInt(selectedVal.split(":")[1], 10);

    const chosenTrack = cached?.[idx];
    if (!chosenTrack) {
      await interaction.reply({ content: `${CE.failure.str} Search selection expired. Please run search again.`, flags: 1 << 6 });
      return true;
    }

    const member = interaction.member as any;
    const memberVc = member?.voice?.channel;
    if (!memberVc) {
      await interaction.reply({ content: `${CE.failure.str} You must be connected to a voice channel to play the selected song!`, flags: 1 << 6 });
      return true;
    }

    const activePlayer = getOrCreateMusicPlayer(guildId, memberVc, interaction.channel as any);

    if (activePlayer.isPlaying) {
      activePlayer.queue.push(chosenTrack);
      await interaction.update({
        embeds: [
          prettyEmbed({
            title: "Track Added to Queue",
            description:
              `### ${CE.music.str}  **[${chosenTrack.title}](${chosenTrack.url})**\n\n` +
              `> **Artist:** \`${chosenTrack.artist}\` • **Duration:** \`${formatTime(chosenTrack.durationSeconds)}\`\n` +
              `> **Queue Position:** \`#${activePlayer.queue.length}\``,
            thumbnail: chosenTrack.thumbnailUrl,
            color: COLORS.primary,
          }),
        ],
        components: [],
      });
      await activePlayer.sendPlayerEmbed().catch(() => {});
    } else {
      await interaction.deferUpdate();
      await activePlayer.playTrack(chosenTrack);
      const embed = buildNowPlayingEmbed(activePlayer, chosenTrack);
      const rows = buildPlayerActionRows(activePlayer);
      await interaction.editReply({ embeds: [embed], components: rows });
    }
    return true;
  }

  // Handle Audio Source Changer select menu
  if (interaction.isStringSelectMenu() && customId === "select:music:change_source") {
    const player = getMusicPlayer(guildId);
    if (!player || !player.currentTrack) {
      await interaction.reply({ content: `${CE.failure.str} No song is currently playing.`, flags: 1 << 6 });
      return true;
    }

    const cached = sourceOptionCache.get(interaction.user.id);
    const selectedVal = interaction.values[0]; // e.g. "change_source:0"
    const idx = parseInt(selectedVal.split(":")[1], 10);
    const chosenOption = cached?.options?.[idx];

    if (!chosenOption) {
      await interaction.reply({ content: `${CE.failure.str} Source selection expired. Please try again.`, flags: 1 << 6 });
      return true;
    }

    await player.switchStreamSource(chosenOption.streamUrl, `${chosenOption.icon} ${chosenOption.sourceName}`);

    await interaction.update({
      embeds: [
        prettyEmbed({
          title: "Audio Source Switched",
          description:
            `### ${CE.check.str} **Successfully changed audio source!**\n\n` +
            `**Track:** [${player.currentTrack.title}](${player.currentTrack.url})\n` +
            `**New Source:** ${chosenOption.icon} **${chosenOption.sourceName}** (\`${chosenOption.quality}\`)`,
          color: COLORS.primary,
        }),
      ],
      components: [],
    });
    return true;
  }

  const player = getMusicPlayer(guildId);
  if (!player) {
    await interaction.reply({ content: `${CE.failure.str} No active music session in this server.`, flags: 1 << 6 });
    return true;
  }

  const member = interaction.member as any;

  // DJ role verification check for button actions
  const djCheck = await hasDjPermission(member, interaction.guild);
  if (!djCheck.allowed) {
    await interaction.reply({ content: djCheck.reason || `${CE.failure.str} DJ permission required.`, flags: 1 << 6 });
    return true;
  }

  const isElevated = member?.permissions?.has?.(PermissionFlagsBits.ManageGuild) ||
    member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has?.(PermissionFlagsBits.MuteMembers);

  const memberVoiceChannelId = member?.voice?.channel?.id;
  if (!isElevated && (!memberVoiceChannelId || memberVoiceChannelId !== player.voiceChannel.id)) {
    await interaction.reply({
      content: `${CE.failure.str} You must be in the same voice channel (<#${player.voiceChannel.id}>) to use player controls.`,
      flags: 1 << 6,
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && customId === "select:music:eq") {
    const selected = interaction.values[0] as EqualizerPreset;
    const preset = await player.setEqualizer(selected);
    const embed = buildNowPlayingEmbed(player, player.currentTrack);
    const rows = buildPlayerActionRows(player);
    await interaction.update({ embeds: [embed], components: rows }).catch(() => {});
    return true;
  }

  const action = customId.replace("btn:music:", "");

  if (action === "pause") {
    if (player.isPaused) player.resume();
    else player.pause();
  } else if (action === "skip") {
    player.skip();
  } else if (action === "shuffle") {
    player.shuffle();
  } else if (action === "source") {
    if (!player.currentTrack) {
      await interaction.reply({ content: `${CE.failure.str} No track is currently playing.`, flags: 1 << 6 });
      return true;
    }
    await interaction.deferReply({ flags: 1 << 6 });
    const sources = await resolveAllAudioSources(player.currentTrack.title, player.currentTrack.artist, player.currentTrack.streamUrl);
    if (sources.length === 0) {
      await interaction.editReply({ content: `${CE.failure.str} No alternative audio sources found for this song.` });
      return true;
    }

    sourceOptionCache.set(interaction.user.id, { track: player.currentTrack, options: sources });

    const selectOptions = sources.map((s, i) => {
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${s.icon} ${s.sourceName}`)
        .setValue(`change_source:${i}`)
        .setDescription(s.quality)
        .setDefault(player.currentTrack?.sourceName === `${s.icon} ${s.sourceName}`);
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select:music:change_source")
        .setPlaceholder("Select audio source / mirror for current song...")
        .addOptions(selectOptions)
    );

    const embed = prettyEmbed({
      title: "Audio Source & Mirror Selector",
      description:
        `### ${CE.music.str} **[${player.currentTrack.title}](${player.currentTrack.url})**\n` +
        `**Artist:** \`${player.currentTrack.artist}\`\n` +
        `**Active Source:** \`${player.currentTrack.sourceName || "YouTube / SoundCloud HQ Audio"}\`\n\n` +
        `Select an alternative source from the dropdown menu to instantly switch streams:`,
      color: COLORS.primary,
    });

    await interaction.editReply({ embeds: [embed], components: [row as any] });
    return true;
  } else if (action === "volup") {
    player.setVolume(player.volume + 15);
  } else if (action === "voldown") {
    player.setVolume(player.volume - 15);
  } else if (action === "loop") {
    player.toggleLoop();
  } else if (action === "autoplay") {
    player.toggleAutoplay();
  } else if (action === "247") {
    const newState = !player.twentyFourSeven.enabled;
    await player.set247(newState);
    if (newState && !player.isPlaying) {
      await player.resume247Stream();
    }
  } else if (action === "clear") {
    player.clearQueue();
  } else if (action === "stop") {
    player.destroy();
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE.music.str} Music Session Stopped`)
          .setDescription(`Disconnected from <#${player.voiceChannel.id}> by ${interaction.user}.`)
          .setColor(0xed4245),
      ],
      components: [],
    });
    return true;
  }

  // Update original player embed with new button states
  const embed = buildNowPlayingEmbed(player, player.currentTrack);
  const rows = buildPlayerActionRows(player);
  await interaction.update({ embeds: [embed], components: rows }).catch(() => {});

  return true;
}
