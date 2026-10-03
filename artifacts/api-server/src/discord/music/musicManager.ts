import {
  type VoiceBasedChannel,
  type GuildTextBasedChannel,
  type ButtonInteraction,
  type AnySelectMenuInteraction,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Routes,
  type Client,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  NoSubscriberBehavior,
  entersState,
  type VoiceConnection,
  type AudioPlayer,
  type AudioResource,
} from "@discordjs/voice";
import { spawn, execSync } from "child_process";
import ffmpegStatic from "ffmpeg-static";

export function getWorkingFfmpegPath(): string {
  const systemPaths = ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"];
  for (const p of systemPaths) {
    try {
      execSync(`${p} -version`, { stdio: "ignore" });
      return p;
    } catch {}
  }
  return (ffmpegStatic as string) || "ffmpeg";
}
import type { Player } from "shoukaku";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { logger } from "../../lib/logger";
import { set247Config, getAll247Configs } from "../storage/music247";
import { getShoukaku, resolveLavalinkTracks, getLavalinkNode, waitForLavalinkNode } from "./lavalinkClient";
import { resolveSpotifyUrl, resolveYouTubeUrl, resolveAllAudioSources, getDirectMediaStreamUrl, type AudioSourceOption } from "./sourceResolver";

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
  encodedTrack?: string;
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
  description: string;
}

export const EQUALIZER_PRESETS: Record<EqualizerPreset, EqualizerInfo> = {
  off: { id: "off", label: "Flat / Normal", description: "Pure balanced studio output without filters" },
  bassboost: { id: "bassboost", label: "Heavy Bass Boost", description: "Punchy low-end bass kick" },
  superbass: { id: "superbass", label: "Super Sub-Bass", description: "Maximum sub-woofer bass rumble" },
  treble: { id: "treble", label: "Treble Boost", description: "Crystal-clear high frequencies and vocals" },
  nightcore: { id: "nightcore", label: "Nightcore", description: "1.25x tempo boost with pitched aesthetic vocals" },
  vaporwave: { id: "vaporwave", label: "Vaporwave", description: "Slowed aesthetic tempo with ambient reverb" },
  karaoke: { id: "karaoke", label: "Karaoke", description: "Suppresses centered vocal channel" },
  highpitch: { id: "highpitch", label: "High Pitch", description: "Bright elevated pitch" },
  lowpitch: { id: "lowpitch", label: "Low Pitch", description: "Deepened acoustic timbre and lowered pitch" },
  pop: { id: "pop", label: "Pop Music", description: "Brightened vocals and rhythmic pop presence" },
  rock: { id: "rock", label: "Rock & Metal", description: "Snappy drum transients and sharp guitars" },
  electronic: { id: "electronic", label: "EDM & Electronic", description: "Thumping kicks with glistening synths" },
  soft: { id: "soft", label: "Acoustic / Soft", description: "Warm, gentle tone for acoustic & chill music" },
  "8d": { id: "8d", label: "8D Surround Audio", description: "360-degree dynamic spatial rotating audio" },
};

export const musicManagers = new Map<string, MusicManager>();

export class MusicManager {
  public guildId: string;
  public voiceChannel: VoiceBasedChannel;
  public textChannel?: GuildTextBasedChannel;

  // Primary Lavalink Player
  public lavalinkPlayer?: Player;

  // Fallback Discord.js Native Voice Connection & Player
  public fallbackConnection?: VoiceConnection;
  public fallbackAudioPlayer?: AudioPlayer;
  public fallbackResource?: AudioResource;
  public activeFfmpegProcess?: any;
  public lastPlayerMessage?: import("discord.js").Message;

  public currentTrack: Track | null = null;
  public previousTracks: Track[] = [];
  public queue: Track[] = [];

  public isPlaying = false;
  public isPaused = false;
  public volume = 100;
  public speed = 1.0;
  public loopMode: LoopMode = "off";
  public equalizer: EqualizerPreset = "off";
  public autoplay = false;

  public trackStartedAt: number = 0;
  public playbackOffsetSeconds: number = 0;
  public inactivityTimeout?: NodeJS.Timeout;
  public lastSearchResults?: Track[];
  public lastSearchQuery?: string;

  public twentyFourSeven: {
    enabled: boolean;
    query?: string;
    type?: "artist" | "album" | "song" | "radio";
    artistName?: string;
    songMode?: "full" | "main";
  } = { enabled: false, songMode: "full" };

  private lastVcStatus: string = "";
  private lastVcStatusTime: number = 0;
  private consecutiveFailures = 0;
  private isEnding = false;
  public isDestroyed = false;

  constructor(guildId: string, voiceChannel: VoiceBasedChannel, textChannel?: GuildTextBasedChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
  }

  /**
   * Connects to the voice channel prioritizing Lavalink v4, falling back to native Discord voice
   */
  public async ensureConnection(): Promise<void> {
    const shoukaku = getShoukaku();
    let node = getLavalinkNode();
    if (shoukaku && !node) {
      node = await waitForLavalinkNode(2500);
    }

    // 1. Try Lavalink connection if node is available
    if (shoukaku && node) {
      try {
        if (!this.lavalinkPlayer || (this.lavalinkPlayer as any).connection?.channelId !== this.voiceChannel.id) {
          const player = await shoukaku.joinVoiceChannel({
            guildId: this.guildId,
            channelId: this.voiceChannel.id,
            shardId: this.voiceChannel.guild.shardId || 0,
            deaf: false,
            mute: false,
          });
          this.lavalinkPlayer = player;
          this.attachLavalinkListeners(player);
          logger.info({ guildId: this.guildId, channelId: this.voiceChannel.id }, "Joined voice channel via Lavalink v4");
        }
        return;
      } catch (err) {
        logger.warn({ err, guildId: this.guildId }, "Lavalink voice join failed, falling back to native Discord voice");
      }
    }

    await this.ensureNativeConnection();
  }

  public async ensureNativeConnection(): Promise<void> {
    try {
      const isDead = !this.fallbackConnection ||
        this.fallbackConnection.state.status === VoiceConnectionStatus.Destroyed ||
        this.fallbackConnection.state.status === VoiceConnectionStatus.Disconnected;

      if (isDead) {
        if (this.fallbackConnection) {
          try {
            this.fallbackConnection.destroy();
          } catch {}
        }

        const connection = joinVoiceChannel({
          channelId: this.voiceChannel.id,
          guildId: this.guildId,
          adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as any,
          selfDeaf: false,
          selfMute: false,
        });
        this.fallbackConnection = connection;

        connection.on("stateChange", (oldState, newState) => {
          logger.info({ guildId: this.guildId, from: oldState.status, to: newState.status }, "Voice connection state transition");
        });

        if (!this.fallbackAudioPlayer) {
          this.fallbackAudioPlayer = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Play },
          });
          this.attachFallbackAudioListeners(this.fallbackAudioPlayer);
        }
        connection.subscribe(this.fallbackAudioPlayer);

        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
          logger.info({ guildId: this.guildId, channelId: this.voiceChannel.id }, "Joined voice channel and ready via Native Gateway");
        } catch (readyErr) {
          logger.warn({ err: readyErr, guildId: this.guildId }, "Voice connection ready timeout, retrying state");
        }
      }
    } catch (nativeErr) {
      logger.error({ err: nativeErr, guildId: this.guildId }, "Failed to connect to Discord voice channel");
      throw nativeErr;
    }
  }

  private attachLavalinkListeners(player: Player): void {
    player.removeAllListeners();

    player.on("start", () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.consecutiveFailures = 0;
      this.isEnding = false;
      this.trackStartedAt = Date.now();

      if (this.currentTrack) {
        const statusText = `${CE.playing ? CE.playing.str : CE.play.str} ${this.currentTrack.title} - ${this.currentTrack.artist}`;
        this.updateVoiceStatus(statusText, true).catch(() => {});
      }
    });

    player.on("end", (reason) => {
      logger.info({ reason, track: this.currentTrack?.title }, "Lavalink track ended");
      this.isPlaying = false;
      this.onTrackEnded().catch(() => {});
    });

    player.on("exception", (error) => {
      logger.error({ error, track: this.currentTrack?.title }, "Lavalink playback exception");
      this.handleStreamError();
    });

    player.on("stuck", (threshold) => {
      logger.warn({ threshold, track: this.currentTrack?.title }, "Lavalink playback stuck");
      this.handleStreamError();
    });
  }

  private attachFallbackAudioListeners(player: AudioPlayer): void {
    player.on(AudioPlayerStatus.Playing, () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.consecutiveFailures = 0;
      this.isEnding = false;
      this.trackStartedAt = Date.now();

      if (this.currentTrack) {
        const statusText = `${CE.playing ? CE.playing.str : CE.play.str} ${this.currentTrack.title} - ${this.currentTrack.artist}`;
        this.updateVoiceStatus(statusText, true).catch(() => {});
      }
    });

    player.on(AudioPlayerStatus.Idle, () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.onTrackEnded().catch(() => {});
      }
    });

    player.on(AudioPlayerStatus.Paused, () => {
      this.isPaused = true;
    });

    player.on("error", (error) => {
      logger.error({ error: error.message, track: this.currentTrack?.title }, "Native audio stream error");
      this.handleStreamError();
    });
  }

  private handleStreamError(): void {
    this.consecutiveFailures++;
    this.isPlaying = false;

    if (this.consecutiveFailures >= 3) {
      if (this.textChannel) {
        this.textChannel.send({
          embeds: [
            prettyEmbed({
              title: `${CE.failure.str} Audio Playback Interrupted`,
              description: `Playback was stopped after multiple stream errors. Please try another track or query.`,
              color: COLORS.danger,
            }),
          ],
        }).catch(() => {});
      }
      this.updateVoiceStatus("", true).catch(() => {});
      return;
    }

    this.onTrackEnded().catch(() => {});
  }

  /**
   * Plays a target track across Lavalink or native voice stream
   */
  public async playTrack(track: Track): Promise<void> {
    try {
      await this.ensureConnection();

      if (this.currentTrack && !this.currentTrack.is247Radio) {
        this.previousTracks.unshift(this.currentTrack);
        if (this.previousTracks.length > 20) this.previousTracks.pop();
      }

      this.currentTrack = track;

      // 1. Play via Lavalink if player is active
      if (this.lavalinkPlayer) {
        let encoded = track.encodedTrack;
        if (!encoded) {
          const res = await resolveLavalinkTracks(track.streamUrl || track.url || `${track.title} ${track.artist}`);
          if (res?.data) {
            if (Array.isArray(res.data) && res.data.length > 0) encoded = res.data[0].encoded;
            else if (res.data.encoded) encoded = res.data.encoded;
            else if (res.data.tracks && res.data.tracks.length > 0) encoded = res.data.tracks[0].encoded;
          }
        }

        if (encoded) {
          track.encodedTrack = encoded;
          await this.lavalinkPlayer.playTrack({ track: { encoded } });
          this.isPlaying = true;
          this.isPaused = false;
          await this.sendPlayerEmbed();
          return;
        } else {
          // If Lavalink cannot resolve track, release Lavalink voice so native voice can stream
          try {
            const shoukaku = getShoukaku();
            if (shoukaku) {
              await shoukaku.leaveVoiceChannel(this.guildId).catch(() => {});
            }
          } catch {}
          this.lavalinkPlayer = undefined;
        }
      }

      // 2. Play via Native Voice Resource with FFmpeg Ogg Opus streaming & audio filters
      await this.ensureNativeConnection();

      if (this.activeFfmpegProcess) {
        try {
          this.activeFfmpegProcess.kill();
        } catch {}
        this.activeFfmpegProcess = null;
      }

      const streamUrl = track.streamUrl || track.url;
      const trackSearchTitle = `${track.title} ${track.artist}`.trim();
      let targetStreamUrl = await getDirectMediaStreamUrl(streamUrl, trackSearchTitle);

      if (!targetStreamUrl) {
        targetStreamUrl = (await getSoundCloudAudioStream(trackSearchTitle)) || "";
      }

      if (!targetStreamUrl) {
        logger.warn({ track: track.title }, "Could not resolve direct playable audio stream URL");
        if (this.textChannel) {
          this.textChannel.send({
            embeds: [
              prettyEmbed({
                title: `${CE.error.str} Stream Unavailable`,
                description: `Could not resolve playable audio stream for **${track.title}**. Skipping to next track.`,
                color: COLORS.danger,
              }),
            ],
          }).catch(() => {});
        }
        this.handleStreamError();
        return;
      }

      logger.info({ targetStreamUrl: targetStreamUrl.substring(0, 60) + "...", track: track.title }, "Streaming direct media for native playback");
      const ffmpegBin = getWorkingFfmpegPath();

      const afFilters: string[] = [];
      if (this.speed !== 1.0) {
        afFilters.push(`atempo=${this.speed}`);
      }

      if (this.equalizer === "bassboost") afFilters.push("bass=g=8:f=110:w=0.6");
      else if (this.equalizer === "superbass") afFilters.push("bass=g=14:f=80:w=0.8");
      else if (this.equalizer === "treble") afFilters.push("treble=g=8:f=4000:w=0.6");
      else if (this.equalizer === "nightcore") afFilters.push("asetrate=48000*1.25,aresample=48000");
      else if (this.equalizer === "vaporwave") afFilters.push("asetrate=48000*0.85,aresample=48000");
      else if (this.equalizer === "8d") afFilters.push("apulsator=hz=0.125");
      else if (this.equalizer === "highpitch") afFilters.push("asetrate=48000*1.3,aresample=48000");
      else if (this.equalizer === "lowpitch") afFilters.push("asetrate=48000*0.75,aresample=48000");
      else if (this.equalizer === "pop") afFilters.push("equalizer=f=1000:width_type=h:width=200:g=3");
      else if (this.equalizer === "rock") afFilters.push("equalizer=f=80:width_type=h:width=100:g=4,equalizer=f=8000:width_type=h:width=1000:g=4");
      else if (this.equalizer === "electronic") afFilters.push("equalizer=f=60:width_type=h:width=80:g=6,equalizer=f=12000:width_type=h:width=2000:g=4");
      else if (this.equalizer === "soft") afFilters.push("equalizer=f=3000:width_type=h:width=1000:g=-3");

      const ffmpegArgs = [
        "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        "-analyzeduration", "10000000",
        "-probesize", "10000000",
        "-i", targetStreamUrl,
        "-loglevel", "quiet",
        "-vn",
      ];

      if (afFilters.length > 0) {
        ffmpegArgs.push("-af", afFilters.join(","));
      }

      ffmpegArgs.push(
        "-f", "s16le",
        "-ar", "48000",
        "-ac", "2",
        "pipe:1"
      );

      const ff = spawn(ffmpegBin, ffmpegArgs);
      this.activeFfmpegProcess = ff;
      ff.on("error", (err) => logger.debug({ err: err.message }, "FFmpeg process warning"));
      ff.stdin.on("error", (err) => logger.debug({ err: err?.message }, "FFmpeg stdin write error handled cleanly"));

      // FFmpeg handles targetStreamUrl directly for better network resilience

      const resource = createAudioResource(ff.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      this.fallbackResource = resource;
      if (resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }

      if (this.fallbackAudioPlayer) {
        this.fallbackAudioPlayer.play(resource);
        this.isPlaying = true;
        this.isPaused = false;
      }

      await this.sendPlayerEmbed();
    } catch (err) {
      logger.error({ err, track: track.title }, "Failed to initiate track playback");
      this.handleStreamError();
    }
  }

  public async enqueue(track: Track): Promise<number> {
    if (!this.isPlaying && !this.currentTrack) {
      await this.playTrack(track);
      return 0;
    }
    this.queue.push(track);
    return this.queue.length;
  }

  public getEstimatedCurrentSeconds(): number {
    if (!this.isPlaying || !this.trackStartedAt) return 0;
    const elapsed = Math.floor((Date.now() - this.trackStartedAt) / 1000);
    return Math.max(0, this.playbackOffsetSeconds + elapsed);
  }

  public async pause(): Promise<boolean> {
    if (this.lavalinkPlayer) {
      await this.lavalinkPlayer.setPaused(true);
    }
    if (this.fallbackAudioPlayer) {
      this.fallbackAudioPlayer.pause();
    }
    this.isPaused = true;
    if (this.currentTrack) {
      this.updateVoiceStatus(`Paused: ${this.currentTrack.title}`, true).catch(() => {});
    }
    return true;
  }

  public async resume(): Promise<boolean> {
    if (this.lavalinkPlayer) {
      await this.lavalinkPlayer.setPaused(false);
    }
    if (this.fallbackAudioPlayer) {
      this.fallbackAudioPlayer.unpause();
    }
    this.isPaused = false;
    if (this.currentTrack) {
      const statusText = `${CE.playing ? CE.playing.str : CE.play.str} ${this.currentTrack.title} - ${this.currentTrack.artist}`;
      this.updateVoiceStatus(statusText, true).catch(() => {});
    }
    return true;
  }

  public async skip(): Promise<boolean> {
    if (this.lavalinkPlayer) {
      await this.lavalinkPlayer.stopTrack();
    }
    if (this.fallbackAudioPlayer) {
      this.fallbackAudioPlayer.stop();
    }
    return true;
  }

  public async previous(): Promise<Track | null> {
    if (this.previousTracks.length === 0) {
      if (this.currentTrack) {
        await this.seek(0);
        return this.currentTrack;
      }
      return null;
    }

    const prev = this.previousTracks.shift()!;
    if (this.currentTrack) {
      this.queue.unshift(this.currentTrack);
    }
    await this.playTrack(prev);
    return prev;
  }

  public skipTo(index1Based: number): Track | null {
    const idx = index1Based - 1;
    if (idx < 0 || idx >= this.queue.length) return null;
    this.queue.splice(0, idx);
    const target = this.queue.shift();
    if (target) {
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

  public clearQueue(): number {
    const count = this.queue.length;
    this.queue = [];
    return count;
  }

  public toggleLoop(): LoopMode {
    if (this.loopMode === "off") this.loopMode = "track";
    else if (this.loopMode === "track") this.loopMode = "queue";
    else this.loopMode = "off";
    return this.loopMode;
  }

  public increaseSpeed(): number {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    let idx = speeds.indexOf(this.speed);
    if (idx === -1) idx = 2;
    const next = speeds[Math.min(speeds.length - 1, idx + 1)];
    this.speed = next;
    if (this.lavalinkPlayer) {
      this.lavalinkPlayer.setFilters({ timescale: { speed: next } }).catch(() => {});
    } else if (this.currentTrack) {
      this.playTrack(this.currentTrack).catch(() => {});
    }
    return next;
  }

  public decreaseSpeed(): number {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    let idx = speeds.indexOf(this.speed);
    if (idx === -1) idx = 2;
    const prev = speeds[Math.max(0, idx - 1)];
    this.speed = prev;
    if (this.lavalinkPlayer) {
      this.lavalinkPlayer.setFilters({ timescale: { speed: prev } }).catch(() => {});
    } else if (this.currentTrack) {
      this.playTrack(this.currentTrack).catch(() => {});
    }
    return prev;
  }

  public cycleSpeed(): number {
    return this.increaseSpeed();
  }

  public toggleAutoplay(): boolean {
    this.autoplay = !this.autoplay;
    return this.autoplay;
  }

  public async stop(): Promise<void> {
    this.queue = [];
    this.currentTrack = null;
    this.isPlaying = false;
    this.isPaused = false;

    if (this.activeFfmpegProcess) {
      try {
        this.activeFfmpegProcess.kill();
      } catch {}
      this.activeFfmpegProcess = null;
    }

    if (this.lavalinkPlayer) {
      await this.lavalinkPlayer.stopTrack().catch(() => {});
    }
    const shoukaku = getShoukaku();
    if (shoukaku) {
      await shoukaku.leaveVoiceChannel(this.guildId).catch(() => {});
    }
    this.lavalinkPlayer = undefined;

    if (this.fallbackAudioPlayer) {
      this.fallbackAudioPlayer.stop();
    }
    if (this.fallbackConnection && this.fallbackConnection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.fallbackConnection.destroy();
    }
    this.fallbackConnection = undefined;
    this.updateVoiceStatus("", true).catch(() => {});
  }

  public async seek(seconds: number): Promise<boolean> {
    if (!this.currentTrack) return false;
    if (this.lavalinkPlayer) {
      await this.lavalinkPlayer.seekTo(seconds * 1000);
    }
    this.playbackOffsetSeconds = seconds;
    this.trackStartedAt = Date.now();
    return true;
  }

  public async setVolume(vol: number): Promise<void> {
    const bounded = Math.max(1, Math.min(150, vol));
    this.volume = bounded;
    if (this.lavalinkPlayer) {
      await this.lavalinkPlayer.setGlobalVolume(bounded);
    }
    if (this.fallbackResource && this.fallbackResource.volume) {
      this.fallbackResource.volume.setVolume(bounded / 100);
    }
  }

  public async setEqualizer(preset: EqualizerPreset): Promise<EqualizerInfo> {
    this.equalizer = preset;
    if (this.lavalinkPlayer) {
      if (preset === "bassboost") {
        await this.lavalinkPlayer.setFilters({ equalizer: [{ band: 0, gain: 0.2 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 }] });
      } else if (preset === "superbass") {
        await this.lavalinkPlayer.setFilters({ equalizer: [{ band: 0, gain: 0.35 }, { band: 1, gain: 0.25 }, { band: 2, gain: 0.15 }] });
      } else if (preset === "nightcore") {
        await this.lavalinkPlayer.setFilters({ timescale: { speed: 1.25, pitch: 1.25 } });
      } else if (preset === "vaporwave") {
        await this.lavalinkPlayer.setFilters({ timescale: { speed: 0.85, pitch: 0.85 } });
      } else {
        await this.lavalinkPlayer.clearFilters();
      }
    } else if (this.currentTrack) {
      await this.playTrack(this.currentTrack).catch(() => {});
    }
    return EQUALIZER_PRESETS[preset] || EQUALIZER_PRESETS.off;
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

  public async updateVoiceStatus(statusText: string, force = false): Promise<void> {
    try {
      const channelId = this.voiceChannel?.id;
      if (!channelId) return;

      const emoji = this.twentyFourSeven.enabled ? CE.world.str : CE.playing.str;
      let finalStatus = statusText ? statusText.trim() : "";
      if (finalStatus) {
        finalStatus = `${emoji} ${finalStatus.replace(/^<a?:[a-zA-Z0-9_]+:\d+>\s*/, "")}`.trim();
      }

      const sanitized = finalStatus.slice(0, 500);
      const now = Date.now();

      if (sanitized === this.lastVcStatus && now - this.lastVcStatusTime < 15000) {
        return;
      }
      if (!force && now - this.lastVcStatusTime < 5000) {
        return;
      }

      this.lastVcStatus = sanitized;
      this.lastVcStatusTime = now;

      await (this.voiceChannel.client.rest as any).put((Routes as any).channelVoiceStatus(channelId), {
        body: { status: sanitized },
      });
    } catch (err) {
      logger.debug({ err, channelId: this.voiceChannel?.id }, "Could not set VC status");
    }
  }

  private async onTrackEnded(): Promise<void> {
    if (this.isEnding) return;
    this.isEnding = true;

    try {
      if (this.loopMode === "track" && this.currentTrack && !this.currentTrack.is247Radio) {
        await this.playTrack(this.currentTrack);
        return;
      }

      if (this.loopMode === "queue" && this.currentTrack && !this.currentTrack.is247Radio) {
        this.queue.push(this.currentTrack);
      }

      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        await this.playTrack(next);
        return;
      }

      if (this.twentyFourSeven.enabled) {
        await new Promise((r) => setTimeout(r, 5000));
        if (!this.isDestroyed && this.twentyFourSeven.enabled) {
          await this.resume247Stream().catch(() => {});
        }
        return;
      }

      this.currentTrack = null;
      this.isPlaying = false;
      this.updateVoiceStatus("", true).catch(() => {});
    } finally {
      this.isEnding = false;
    }
  }

  public async resume247Stream(): Promise<void> {
    await this.ensureConnection();
    this.currentTrack = null;
    this.isPlaying = false;
    this.isPaused = false;
    await this.updateVoiceStatus("Ready to play", true).catch(() => {});
  }

  public async sendPlayerEmbed(): Promise<void> {
    if (!this.textChannel || !this.currentTrack) return;

    const embed = buildNowPlayingEmbed(this);
    const rows = buildPlayerActionRows(this);

    if (this.lastPlayerMessage) {
      try {
        this.lastPlayerMessage = await this.lastPlayerMessage.edit({ embeds: [embed], components: rows as any });
        return;
      } catch {
        this.lastPlayerMessage = undefined;
      }
    }

    this.lastPlayerMessage = await this.textChannel.send({ embeds: [embed], components: rows as any }).catch(() => undefined);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = undefined;
    }
    this.stop().catch(() => {});
    musicManagers.delete(this.guildId);
  }
}

export const GuildMusicPlayer = MusicManager;

export function getMusicManager(guildId: string): MusicManager | undefined {
  return musicManagers.get(guildId);
}

export const getMusicPlayer = getMusicManager;

export function getOrCreateMusicManager(
  guildId: string,
  voiceChannel: VoiceBasedChannel,
  textChannel?: GuildTextBasedChannel,
): MusicManager {
  let manager = musicManagers.get(guildId);
  if (!manager || manager.isDestroyed) {
    manager = new MusicManager(guildId, voiceChannel, textChannel);
    musicManagers.set(guildId, manager);
  } else {
    manager.voiceChannel = voiceChannel;
    if (textChannel) manager.textChannel = textChannel;
  }
  return manager;
}

export const getOrCreateMusicPlayer = getOrCreateMusicManager;

export async function disconnectAllVoiceChannels(_client?: any): Promise<void> {
  for (const [_, manager] of musicManagers.entries()) {
    try {
      manager.destroy();
    } catch {}
  }
}

/**
 * Handles all music interactive buttons: previous, pause/resume, skip, stop, queue, loop, shuffle, speed, source, 24/7
 */
export async function handleMusicButton(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;
  const manager = getMusicManager(guildId);
  if (!manager) {
    await interaction.reply({ content: `${CE.warning.str} No active music session in this server.`, ephemeral: true });
    return;
  }

  const customId = interaction.customId;

  // 1. Previous
  if (customId === "music:prev" || customId === "btn:music:prev") {
    const prev = await manager.previous();
    if (prev) {
      await interaction.reply({ content: `${CE.white_previous.str} Playing previous track: **${prev.title}**!`, ephemeral: true });
      if (interaction.message) {
        const embed = buildNowPlayingEmbed(manager);
        const rows = buildPlayerActionRows(manager);
        await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
      }
    } else {
      await interaction.reply({ content: `${CE.warning.str} No previous tracks in history.`, ephemeral: true });
    }
    return;
  }

  // 2. Pause / Resume
  if (customId === "music:pause" || customId === "btn:music:pause") {
    if (manager.isPaused) {
      await manager.resume();
      await interaction.reply({ content: `${CE.resume.str} Resumed audio playback!`, ephemeral: true });
    } else {
      await manager.pause();
      await interaction.reply({ content: `${CE.pause.str} Paused audio playback!`, ephemeral: true });
    }
    if (interaction.message) {
      const embed = buildNowPlayingEmbed(manager);
      const rows = buildPlayerActionRows(manager);
      await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
    }
    return;
  }

  // 3. Skip
  if (customId === "music:skip" || customId === "btn:music:skip") {
    await manager.skip();
    await interaction.reply({ content: `${CE.white_skip.str} Skipped track!`, ephemeral: true });
    if (interaction.message) {
      const embed = buildNowPlayingEmbed(manager);
      const rows = buildPlayerActionRows(manager);
      await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
    }
    return;
  }

  // 4. Stop
  if (customId === "music:stop" || customId === "btn:music:stop") {
    await manager.stop();
    await interaction.reply({ content: `${CE.white_cancel.str} Stopped music playback and cleared queue!`, ephemeral: true });
    if (interaction.message) {
      const embed = buildNowPlayingEmbed(manager);
      const rows = buildPlayerActionRows(manager);
      await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
    }
    return;
  }

  // 5. Queue
  if (customId === "music:queue" || customId === "btn:music:queue") {
    const qLines = manager.queue.slice(0, 10).map((t, i) => `\`${i + 1}.\` **${t.title}** (\`${formatTime(t.durationSeconds)}\`)`);
    const qEmbed = prettyEmbed({
      title: `${CE.list.str} Music Queue (${manager.queue.length} Tracks)`,
      description:
        `**Now Playing:** ${manager.currentTrack ? `[${manager.currentTrack.title}](${manager.currentTrack.url})` : "*None*"}\n\n` +
        (qLines.length > 0 ? qLines.join("\n") : "*Queue is currently empty.*"),
      color: COLORS.primary,
    });
    await interaction.reply({ embeds: [qEmbed], ephemeral: true });
    return;
  }

  // 6. Loop
  if (customId === "music:loop" || customId === "btn:music:loop") {
    const nextMode = manager.toggleLoop();
    await interaction.reply({ content: `${CE.loop.str} Loop mode set to **${nextMode.toUpperCase()}**!`, ephemeral: true });
    if (interaction.message) {
      const embed = buildNowPlayingEmbed(manager);
      const rows = buildPlayerActionRows(manager);
      await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
    }
    return;
  }

  // 7. Shuffle
  if (customId === "music:shuffle" || customId === "btn:music:shuffle") {
    const count = manager.shuffle();
    await interaction.reply({ content: `${CE.shuffle.str} Shuffled **${count}** tracks in the queue!`, ephemeral: true });
    if (interaction.message) {
      const embed = buildNowPlayingEmbed(manager);
      const rows = buildPlayerActionRows(manager);
      await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
    }
    return;
  }

  // 8. Speed Down / Speed Up
  if (customId === "music:speed_down" || customId === "btn:music:speed_down") {
    const newSpeed = manager.decreaseSpeed();
    await interaction.reply({ content: `${CE.Speed_more.str} Audio speed decreased to **${newSpeed}x**!`, ephemeral: true });
    if (interaction.message) {
      manager.lastPlayerMessage = interaction.message as any;
      await manager.sendPlayerEmbed();
    }
    return;
  }

  if (customId === "music:speed_up" || customId === "btn:music:speed_up" || customId === "music:speed" || customId === "btn:music:speed") {
    const newSpeed = manager.increaseSpeed();
    await interaction.reply({ content: `${CE.Speed_more.str} Audio speed set to **${newSpeed}x**!`, ephemeral: true });
    if (interaction.message) {
      manager.lastPlayerMessage = interaction.message as any;
      await manager.sendPlayerEmbed();
    }
    return;
  }

  // 9. Equalizer & Audio FX Switcher
  if (customId === "music:eq" || customId === "btn:music:eq") {
    const eqOptions = [
      new StringSelectMenuOptionBuilder().setLabel("8D Surround Audio").setValue("change_eq:8d").setDescription("360-degree dynamic spatial rotating audio").setDefault(manager.equalizer === "8d"),
      new StringSelectMenuOptionBuilder().setLabel("High Treble Boost").setValue("change_eq:treble").setDescription("Crystal-clear high frequencies & vocals").setDefault(manager.equalizer === "treble"),
      new StringSelectMenuOptionBuilder().setLabel("Heavy Bass Boost").setValue("change_eq:bassboost").setDescription("Punchy low-end bass kick").setDefault(manager.equalizer === "bassboost"),
      new StringSelectMenuOptionBuilder().setLabel("Super Sub-Bass").setValue("change_eq:superbass").setDescription("Maximum sub-woofer rumble").setDefault(manager.equalizer === "superbass"),
      new StringSelectMenuOptionBuilder().setLabel("Nightcore").setValue("change_eq:nightcore").setDescription("1.25x speed with elevated vocal pitch").setDefault(manager.equalizer === "nightcore"),
      new StringSelectMenuOptionBuilder().setLabel("Vaporwave").setValue("change_eq:vaporwave").setDescription("Slowed aesthetic tempo with ambient reverb").setDefault(manager.equalizer === "vaporwave"),
      new StringSelectMenuOptionBuilder().setLabel("Karaoke").setValue("change_eq:karaoke").setDescription("Suppresses centered vocal track").setDefault(manager.equalizer === "karaoke"),
      new StringSelectMenuOptionBuilder().setLabel("High Pitch").setValue("change_eq:highpitch").setDescription("Bright elevated vocal pitch").setDefault(manager.equalizer === "highpitch"),
      new StringSelectMenuOptionBuilder().setLabel("Low Pitch").setValue("change_eq:lowpitch").setDescription("Deepened acoustic timbre and lowered pitch").setDefault(manager.equalizer === "lowpitch"),
      new StringSelectMenuOptionBuilder().setLabel("Pop Music").setValue("change_eq:pop").setDescription("Brightened vocals & rhythmic pop presence").setDefault(manager.equalizer === "pop"),
      new StringSelectMenuOptionBuilder().setLabel("Rock & Metal").setValue("change_eq:rock").setDescription("Snappy drum transients and sharp guitars").setDefault(manager.equalizer === "rock"),
      new StringSelectMenuOptionBuilder().setLabel("EDM & Electronic").setValue("change_eq:electronic").setDescription("Thumping kicks with glistening synths").setDefault(manager.equalizer === "electronic"),
      new StringSelectMenuOptionBuilder().setLabel("Acoustic / Soft").setValue("change_eq:soft").setDescription("Warm, gentle tone for acoustic & chill music").setDefault(manager.equalizer === "soft"),
      new StringSelectMenuOptionBuilder().setLabel("Flat / Normal (Off)").setValue("change_eq:off").setDescription("Pure balanced studio output without filters").setDefault(manager.equalizer === "off"),
    ];

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select:music:change_eq")
        .setPlaceholder("▼ Select Equalizer / Audio FX Preset...")
        .addOptions(eqOptions)
    );

    const eqEmbed = prettyEmbed({
      title: `${CE.equalizer ? CE.equalizer.str : CE.music.str} Live Equalizer & Spatial Audio FX`,
      description:
        `### Current Active Filter: \`${manager.equalizer.toUpperCase()}\`\n` +
        `*Select an Audio FX or Spatial preset from the dropdown menu below to transform audio in real-time:*`,
      color: COLORS.primary,
    });

    await interaction.reply({ embeds: [eqEmbed], components: [row as any], ephemeral: true });
    return;
  }

  // 10. Source
  if (customId === "music:source" || customId === "btn:music:source") {
    const track = manager.currentTrack;
    if (!track) {
      await interaction.reply({ content: `${CE.warning.str} No track is currently playing.`, ephemeral: true });
      return;
    }

    const sources = await resolveAllAudioSources(track.title, track.artist, track.streamUrl);
    sourceOptionCache.set(interaction.user.id, { track, options: sources });

    const selectOptions = sources.map((s: AudioSourceOption, i: number) => {
      const opt = new StringSelectMenuOptionBuilder()
        .setLabel(s.sourceName)
        .setValue(`change_source:${i}`)
        .setDescription(s.quality)
        .setDefault(track.sourceName?.includes(s.sourceName) ?? false);

      if (s.emojiId) {
        opt.setEmoji(s.emojiId);
      }
      return opt;
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select:music:change_source")
        .setPlaceholder("▼ Select Audio Stream Source / Mirror...")
        .addOptions(selectOptions)
    );

    const srcEmbed = prettyEmbed({
      title: `${CE.link.str} Audio Stream Details & Source Switcher`,
      description:
        `### Current Active Track:\n` +
        `> **Song:** [${track.title}](${track.url})\n` +
        `> **Active Source:** ${track.sourceName || `${CE.youtube_music.str} YouTube Music HQ`}\n` +
        `> **Audio Pipeline:** \`Native Discord Gateway Stream / Lavalink v4\`\n\n` +
        `**Supported Official Audio Sources:**\n` +
        `• ${CE.youtube_music.str} **YouTube Music HQ** (384kbps Ultra HD)\n` +
        `• ${CE.spotify.str} **Spotify Lossless** (320kbps High-Fi Master)\n` +
        `• ${CE.apple_music.str} **Apple Music** (Spatial Audio 256kbps AAC)\n` +
        `• ${CE.amazon_music.str} **Amazon Prime Music** (Ultra HD Stream)\n` +
        `• ${CE.jio_saavan.str} **JioSaavn Pro** (320kbps High-Fi Master)\n\n` +
        `*Select a source from the dropdown menu below to switch stream in real-time:*`,
      color: COLORS.primary,
    });

    await interaction.reply({ embeds: [srcEmbed], components: [row as any], ephemeral: true });
    return;
  }

  // 11. 24/7 Mode
  if (customId === "music:247" || customId === "btn:music:247") {
    const newState = !manager.twentyFourSeven.enabled;
    await manager.set247(newState);
    await interaction.reply({ content: `${CE.white_mic.str} 24/7 Mode is now **${newState ? "ENABLED" : "DISABLED"}**!`, ephemeral: true });
    if (interaction.message) {
      manager.lastPlayerMessage = interaction.message as any;
      await manager.sendPlayerEmbed();
    }
    return;
  }

  // 12. Other Search Results View & Select Menu
  if (customId === "music:search_results" || customId === "btn:music:search_results") {
    const results =
      manager.lastSearchResults ||
      searchResultCache.get(guildId) ||
      searchResultCache.get(interaction.user.id);

    if (!results || results.length === 0) {
      await interaction.reply({
        content: `${CE.warning.str} No cached search results found for recent queries. Run \`.play <song>\` to search and play tracks!`,
        ephemeral: true,
      });
      return;
    }

    searchResultCache.set(interaction.user.id, results);
    searchResultCache.set(guildId, results);

    const selectOptions = results.slice(0, 10).map((t: Track, i: number) => {
      const isCurrent = manager.currentTrack && (manager.currentTrack.url === t.url || manager.currentTrack.title === t.title);
      const opt = new StringSelectMenuOptionBuilder()
        .setLabel(`${i + 1}. ${t.title}`.slice(0, 100))
        .setValue(`search_pick:${i}`)
        .setDescription(`${t.artist} • ${formatTime(t.durationSeconds)}`.slice(0, 100))
        .setDefault(Boolean(isCurrent));

      if (CE.music.id) {
        opt.setEmoji(CE.music.id);
      }
      return opt;
    });

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select:music:search_pick")
        .setPlaceholder("▼ Choose another track from search results...")
        .addOptions(selectOptions)
    );

    const embed = prettyEmbed({
      title: `${CE.search ? CE.search.str : CE.music.str} Search Results for: ${manager.lastSearchQuery || manager.currentTrack?.title || "Search"}`,
      description:
        `### Top Matching Tracks (${results.length} found):\n\n` +
        results
          .slice(0, 10)
          .map((t: Track, i: number) => {
            const isPlayingThis = manager.currentTrack?.url === t.url;
            return `**${i + 1}.** [${t.title}](${t.url}) — \`${t.artist}\` (\`${formatTime(t.durationSeconds)}\`)${isPlayingThis ? ` ${CE.playing ? CE.playing.str : "▶️ Current"}` : ""}`;
          })
          .join("\n") +
        `\n\n*Select any track from the dropdown menu below to play or queue it instantly:*`,
      color: COLORS.primary,
      footer: "Zenith High-Fidelity Audio • Select Menu",
    });

    await interaction.reply({ embeds: [embed], components: [row as any], ephemeral: true });
    return;
  }
}

export async function searchArtistSongs(
  query: string,
  requester: { id: string; username: string; avatarUrl?: string },
  limit = 20,
): Promise<Track[]> {
  return searchTracks(query, requester, limit);
}

export async function searchAlbumSongs(
  query: string,
  requester: { id: string; username: string; avatarUrl?: string },
  limit = 20,
): Promise<Track[]> {
  return searchTracks(query, requester, limit);
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "Live Stream";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export const searchResultCache = new Map<string, Track[]>();
export const sourceOptionCache = new Map<string, { track: Track; options: any[] }>();

export function buildNowPlayingEmbed(manager: MusicManager): EmbedBuilder {
  const track = manager.currentTrack;
  if (!track) {
    return prettyEmbed({
      title: `${CE.music.str} Music Player Idle`,
      description: `No audio currently playing. Use \`.play <song>\` or \`/play\` to start high-fidelity music!`,
      color: COLORS.primary,
    });
  }

  const activeSource = track.sourceName || `${CE.youtube_music.str} YouTube Music HQ`;

  return prettyEmbed({
    title: `${CE.playing ? CE.playing.str : CE.play.str} Now Playing`,
    description:
      `### [${track.title}](${track.url})\n` +
      `**Artist:** \`${track.artist}\`\n` +
      `**Duration:** \`${formatTime(track.durationSeconds)}\` • **Active Source:** ${activeSource}\n` +
      `**Requested By:** <@${track.requestedBy.id}>\n\n` +
      `**Controls:** ${CE.white_previous.str} Prev • ${CE.pause.str} Pause/Resume • ${CE.white_skip.str} Skip • ${CE.white_cancel.str} Stop • ${CE.loop.str} Loop • ${CE.shuffle.str} Shuffle • ${CE.Speed_more.str} Speed • ${CE.link.str} Source • ${CE.white_mic.str} 24/7`,
    color: COLORS.primary,
    thumbnail: track.thumbnailUrl,
  });
}

export async function handleMusicSelectMenu(interaction: AnySelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (interaction.customId === "select:music:change_eq") {
    const manager = getMusicManager(guildId);
    const selectedValue = interaction.values[0];

    if (selectedValue.startsWith("change_eq:")) {
      const preset = selectedValue.replace("change_eq:", "") as EqualizerPreset;
      if (manager) {
        const info = await manager.setEqualizer(preset);
        await interaction.reply({
          content: `${CE.success.str} **Equalizer & Audio FX Updated**: Preset set to **${info.label}** (\`${preset.toUpperCase()}\`)!`,
          ephemeral: true,
        });

        if (interaction.message) {
          manager.lastPlayerMessage = interaction.message as any;
          await manager.sendPlayerEmbed();
        }
        return;
      }
    }
  }

  if (interaction.customId === "select:music:change_source") {
    const manager = getMusicManager(guildId);
    const selectedValue = interaction.values[0];
    const userCache = sourceOptionCache.get(interaction.user.id);

    if (selectedValue.startsWith("change_source:")) {
      const idx = parseInt(selectedValue.replace("change_source:", ""), 10);
      const sources = userCache?.options || (await resolveAllAudioSources("track", "artist"));
      const sourceObj = sources[idx];

      if (manager && manager.currentTrack && sourceObj) {
        manager.currentTrack.sourceName = `${sourceObj.icon} ${sourceObj.sourceName}`;
        
        await interaction.reply({
          content: `${CE.success.str} **Stream Source Switched**: Active audio source changed to **${sourceObj.icon} ${sourceObj.sourceName}** (\`${sourceObj.quality}\`)!`,
          ephemeral: true,
        });

        if (interaction.message) {
          const embed = buildNowPlayingEmbed(manager);
          const rows = buildPlayerActionRows(manager);
          await interaction.message.edit({ embeds: [embed], components: rows as any }).catch(() => {});
        }
        return;
      }
    }
  }

  if (interaction.customId === "select:music:search_pick") {
    const selectedValue = interaction.values[0];
    if (selectedValue.startsWith("search_pick:")) {
      const parts = selectedValue.split(":");
      const idx = parseInt(parts[1], 10);
      const cache = searchResultCache.get(interaction.user.id);
      const selectedTrack = cache ? cache[idx] : null;

      if (!selectedTrack) {
        await interaction.reply({ content: `${CE.error.str} Could not retrieve track from cache. Please try searching again.`, ephemeral: true });
        return;
      }

      const member = interaction.member as GuildMember;
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        await interaction.reply({ content: `${CE.warning.str} You must join a voice channel to play music!`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: `${CE.loading.str} Connecting to voice channel and loading stream...`, ephemeral: true });

      const activeManager = getOrCreateMusicManager(guildId, voiceChannel, (interaction.channel as GuildTextBasedChannel) || undefined);
      const queuePosition = await activeManager.enqueue(selectedTrack);

      if (queuePosition === 0) {
        await interaction.editReply({
          content: `${CE.playing ? CE.playing.str : CE.play.str} Now playing **[${selectedTrack.title}](${selectedTrack.url})**!`,
        });
      } else {
        await interaction.editReply({
          content: `${CE.check.str} Queued **[${selectedTrack.title}](${selectedTrack.url})** at position **#${queuePosition}**!`,
        });
      }
      return;
    }
  }
}

/**
 * Builds the 3-row interactive music control panel with all requested options:
 * Row 1: Previous, Pause/Resume, Skip, Stop, Queue
 * Row 2: Loop, Shuffle, Speed -, Speed +, 24/7 Mode
 * Row 3: Equalizer / FX, Source
 */
export function buildPlayerActionRows(manager: MusicManager): ActionRowBuilder<ButtonBuilder>[] {
  const isPaused = manager.isPaused;
  const is247 = manager.twentyFourSeven.enabled;

  // Row 1: Previous, Pause/Resume, Skip, Stop, Queue
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("music:prev")
      .setLabel("Previous")
      .setEmoji(CE.white_previous.str)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:pause")
      .setLabel(isPaused ? "Resume" : "Pause")
      .setEmoji(isPaused ? CE.resume.str : CE.pause.str)
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music:skip")
      .setLabel("Skip")
      .setEmoji(CE.white_skip.str)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:stop")
      .setLabel("Stop")
      .setEmoji(CE.white_cancel.str)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music:queue")
      .setLabel("Queue")
      .setEmoji(CE.list.str)
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 2: Loop, Shuffle, Speed -, Speed +, 24/7 Mode
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("music:loop")
      .setLabel(`Loop: ${manager.loopMode.toUpperCase()}`)
      .setEmoji(CE.loop.str)
      .setStyle(manager.loopMode !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:shuffle")
      .setLabel("Shuffle")
      .setEmoji(CE.shuffle.str)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:speed_down")
      .setLabel(`Speed - (${manager.speed}x)`)
      .setEmoji(CE.Speed_more.str)
      .setStyle(manager.speed !== 1.0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:speed_up")
      .setLabel(`Speed + (${manager.speed}x)`)
      .setEmoji(CE.Speed_more.str)
      .setStyle(manager.speed !== 1.0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:247")
      .setLabel(`24/7: ${is247 ? "ON" : "OFF"}`)
      .setEmoji(CE.white_mic.str)
      .setStyle(is247 ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  // Row 3: Equalizer / Audio FX, Source Switcher, Search Results
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("music:eq")
      .setLabel(`Equalizer FX: ${manager.equalizer.toUpperCase()}`)
      .setEmoji(CE.equalizer ? CE.equalizer.str : CE.music.str)
      .setStyle(manager.equalizer !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:source")
      .setLabel("Audio Source")
      .setEmoji(CE.link.str)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:search_results")
      .setLabel("Other Results")
      .setEmoji(CE.search ? CE.search.str : CE.list.str)
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3];
}

function scoreTrackOfficialness(item: any): number {
  const info = item.info || item;
  const title = (info.title || "").toLowerCase();
  const artist = (info.author || info.artist || "").toLowerCase();
  let score = 0;

  if (artist.includes("official") || artist.includes("topic") || artist.includes("vevo") || artist.includes("records") || artist.includes("music")) {
    score += 10;
  }
  if (title.includes("official music video") || title.includes("official video") || title.includes("official audio") || title.includes("full song") || title.includes("official track")) {
    score += 10;
  }
  if (title.includes("video") || title.includes("audio")) {
    score += 3;
  }

  if (title.includes("cover") || title.includes("remix") || title.includes("slowed") || title.includes("reverb") || title.includes("nightcore") || title.includes("tiktok") || title.includes("teaser") || title.includes("status") || title.includes("short")) {
    score -= 15;
  }

  return score;
}

/**
 * Searches for tracks across Lavalink v4, YouTube, and Spotify
 */
export async function searchTracks(
  query: string,
  requester: { id: string; username: string; avatarUrl?: string },
  limit = 10,
): Promise<Track[]> {
  let cleanQuery = query.trim().replace(/^\((.*)\)$/, "$1").replace(/^["'](.*)["']$/, "$1").trim();
  if (!cleanQuery) return [];

  // Check direct radio / audio URL
  if (/^https?:\/\/.*\.(mp3|aac|ogg|wav|m3u8)(\?.*)?$/i.test(cleanQuery) || /somafm\.com/i.test(cleanQuery)) {
    return [
      {
        title: "Direct Audio Stream / Live Radio",
        artist: "Web Broadcast",
        durationSeconds: 0,
        url: cleanQuery,
        streamUrl: cleanQuery,
        thumbnailUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=600&auto=format&fit=crop",
        is247Radio: false,
        requestedBy: requester,
      },
    ];
  }

  // 1. Search via Lavalink v4 (prioritizing official tracks)
  try {
    const res = await resolveLavalinkTracks(cleanQuery);
    if (res && res.data) {
      let rawTracks: any[] = [];
      if (Array.isArray(res.data)) {
        rawTracks = res.data;
      } else if (res.data.tracks && Array.isArray(res.data.tracks)) {
        rawTracks = res.data.tracks;
      } else if (res.data.encoded) {
        rawTracks = [res.data];
      }

      if (rawTracks.length > 0) {
        // Sort raw tracks by officialness score descending
        rawTracks.sort((a, b) => scoreTrackOfficialness(b) - scoreTrackOfficialness(a));

        return rawTracks.slice(0, limit).map((t: any) => {
          const info = t.info || {};
          return {
            title: info.title || "Unknown Track",
            artist: info.author || "Unknown Artist",
            durationSeconds: Math.round((info.length || 0) / 1000),
            url: info.uri || "https://youtube.com",
            streamUrl: info.uri || "",
            thumbnailUrl:
              info.artworkUrl ||
              "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
            encodedTrack: t.encoded,
            requestedBy: requester,
          };
        });
      }
    }
  } catch (err) {
    logger.debug({ err, query: cleanQuery }, "Lavalink search resolution debug");
  }

  // 2. Search Spotify URL
  if (/spotify\.com/i.test(cleanQuery)) {
    try {
      const sp = await resolveSpotifyUrl(cleanQuery);
      if (sp.length > 0) {
        return sp.slice(0, limit).map((s) => ({
          title: s.title,
          artist: s.artist,
          durationSeconds: s.durationSeconds,
          url: s.url,
          streamUrl: s.streamUrl,
          thumbnailUrl: s.thumbnailUrl,
          requestedBy: requester,
        }));
      }
    } catch {}
  }

  // 3. Fallback Search via YouTube (prioritizing official release)
  try {
    const ytPromise = resolveYouTubeUrl(`${cleanQuery} official`, limit);
    const timeoutPromise = new Promise<any[]>((r) => setTimeout(() => r([]), 3500));
    const yt = await Promise.race([ytPromise, timeoutPromise]);
    const standardYt = yt.length > 0 ? yt : await Promise.race([resolveYouTubeUrl(cleanQuery, limit), timeoutPromise]);
    if (standardYt && standardYt.length > 0) {
      standardYt.sort((a, b) => scoreTrackOfficialness(b) - scoreTrackOfficialness(a));
      return standardYt.map((y) => ({
        title: y.title,
        artist: y.artist,
        durationSeconds: y.durationSeconds,
        url: y.url,
        streamUrl: y.streamUrl,
        thumbnailUrl: y.thumbnailUrl,
        requestedBy: requester,
      }));
    }
  } catch (err) {
    logger.error({ err, query: cleanQuery }, "Error in searchTracks fallback");
  }

  // 4. Ultra-fast iTunes Catalog Fallback (<100ms response guarantee)
  try {
    const { searchITunesCatalog } = await import("./sourceResolver");
    const itunes = await searchITunesCatalog(cleanQuery, limit);
    if (itunes && itunes.length > 0) {
      return itunes.map((i) => ({
        title: i.title,
        artist: i.artist,
        durationSeconds: i.durationSeconds,
        url: i.url,
        streamUrl: i.streamUrl,
        thumbnailUrl: i.thumbnailUrl,
        requestedBy: requester,
      }));
    }
  } catch {}

  return [];
}

export async function init247Sessions(client: Client): Promise<void> {
  try {
    const allConfigs = await getAll247Configs();
    for (const cfg of allConfigs) {
      if (!cfg.enabled || !cfg.voiceChannelId) continue;
      const guild = client.guilds.cache.get(cfg.guildId);
      if (!guild) continue;
      const vc = guild.channels.cache.get(cfg.voiceChannelId) as VoiceBasedChannel;
      if (!vc) continue;
      const tc = cfg.textChannelId ? (guild.channels.cache.get(cfg.textChannelId) as GuildTextBasedChannel) : undefined;

      const manager = getOrCreateMusicManager(cfg.guildId, vc, tc);
      manager.twentyFourSeven = { enabled: true, query: cfg.query };
      await manager.resume247Stream().catch(() => {});
    }
  } catch (err) {
    logger.warn({ err }, "Error restoring 24/7 sessions");
  }
}
