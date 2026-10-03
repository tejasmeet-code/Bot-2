import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
  type VoiceBasedChannel,
  type GuildMember,
  type Guild,
  PermissionFlagsBits,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getMusicPlayer,
  getOrCreateMusicPlayer,
  searchTracks,
  searchArtistSongs,
  searchAlbumSongs,
  buildNowPlayingEmbed,
  buildPlayerActionRows,
  formatTime,
  EQUALIZER_PRESETS,
  searchResultCache,
  sourceOptionCache,
  type EqualizerPreset,
  type Track,
} from "../music/musicManager";
import { resolveAllAudioSources } from "../music/sourceResolver";
import { sendPaginatedEmbed } from "../utils/paginator";
import { CE, COLORS, prettyEmbed, buildSupportRow } from "../utils/embedStyle";
import { hasPremiumAccess } from "../storage/premium";
import { hasDjPermission } from "../storage/musicDj";

/**
 * Finds the voice channel a member is connected to in real time
 */
export async function getMemberVoiceChannel(
  guild: Guild,
  userId: string,
): Promise<VoiceBasedChannel | null> {
  if (!guild || !userId) return null;

  try {
    const member = (await guild.members.fetch(userId).catch(() => null)) ?? guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      return member.voice.channel as VoiceBasedChannel;
    }

    const vs = guild.voiceStates.cache.get(userId);
    if (vs?.channelId) {
      const ch = (await guild.channels.fetch(vs.channelId).catch(() => null)) ?? guild.channels.cache.get(vs.channelId);
      if (ch && ch.isVoiceBased()) return ch as VoiceBasedChannel;
    }

    const channels = await guild.channels.fetch().catch(() => null);
    if (channels) {
      for (const ch of channels.values()) {
        if (ch && ch.isVoiceBased() && ch.members.has(userId)) {
          return ch as VoiceBasedChannel;
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Resolves a target voice channel prioritizing the person who ran the command
 */
export async function resolveTargetVoiceChannel(
  guild: Guild,
  targetInput?: string | null,
  fallbackMember?: GuildMember | null,
): Promise<VoiceBasedChannel | null> {
  const callerId = fallbackMember?.id;

  if (targetInput && targetInput.trim().length > 0) {
    const raw = targetInput.trim();
    const idMatch = raw.match(/\d{17,20}/);
    if (idMatch) {
      const id = idMatch[0];
      const channel = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
      if (channel && channel.isVoiceBased()) {
        return channel as VoiceBasedChannel;
      }

      const memberVc = await getMemberVoiceChannel(guild, id);
      if (memberVc) {
        return memberVc;
      }
    }
  }

  if (callerId) {
    const callerVc = await getMemberVoiceChannel(guild, callerId);
    if (callerVc) {
      return callerVc;
    }
  }

  const activePlayer = getMusicPlayer(guild.id);
  if (activePlayer?.voiceChannel) {
    return activePlayer.voiceChannel;
  }

  return null;
}

/**
 * Verifies voice channel permissions and user limits for Zenith Bot
 */
export function checkVoicePermissionsAndLimit(
  voiceChannel: VoiceBasedChannel,
  guild: Guild,
): { ok: boolean; reason?: string } {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: "Could not resolve bot member permissions." };

  const perms = voiceChannel.permissionsFor(me);
  if (!perms) return { ok: false, reason: "Could not inspect voice channel permissions." };

  if (!perms.has(PermissionFlagsBits.ViewChannel)) {
    return { ok: false, reason: "Missing **View Channel** permission for the target voice channel." };
  }
  if (!perms.has(PermissionFlagsBits.Connect)) {
    return { ok: false, reason: "Missing **Connect** permission to join the target voice channel." };
  }
  if (!perms.has(PermissionFlagsBits.Speak)) {
    return { ok: false, reason: "Missing **Speak** permission in the target voice channel." };
  }

  if (voiceChannel.userLimit > 0 && voiceChannel.members.size >= voiceChannel.userLimit) {
    const canBypassLimit =
      perms.has(PermissionFlagsBits.MoveMembers) || perms.has(PermissionFlagsBits.Administrator);
    if (!canBypassLimit) {
      return {
        ok: false,
        reason: `Voice channel is full (${voiceChannel.members.size}/${voiceChannel.userLimit} members). Missing **Move Members** / **Administrator** permission to bypass channel limits.`,
      };
    }
  }

  return { ok: true };
}

/**
 * /play command
 */
export const playCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play any song, artist, album, direct URL, or web radio in your voice channel")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song title, artist name, or audio URL").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Voice Channel ID/mention or User ID/mention [Premium Remote Summon]")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    let query = interaction.options.getString("query", true).trim();
    let targetInput = interaction.options.getString("target")?.trim() || null;

    if (!targetInput) {
      const tokens = query.split(/\s+/);
      if (tokens.length > 1) {
        const firstToken = tokens[0];
        const lastToken = tokens[tokens.length - 1];
        if (/^(<#\d{17,20}>|<@!?\d{17,20}>)$/.test(firstToken)) {
          targetInput = firstToken;
          query = tokens.slice(1).join(" ").trim();
        } else if (/^(<#\d{17,20}>|<@!?\d{17,20}>)$/.test(lastToken)) {
          targetInput = lastToken;
          query = tokens.slice(0, -1).join(" ").trim();
        }
      }
    }

    const callerVoice = await getMemberVoiceChannel(interaction.guild, interaction.user.id);
    const existingPlayer = getMusicPlayer(interaction.guildId);

    const isRemote = Boolean(targetInput) || (!callerVoice && !existingPlayer?.voiceChannel);

    if (isRemote) {
      const isPremium = await hasPremiumAccess(interaction.user.id, interaction.guildId, interaction.member);
      if (!isPremium) {
        if (!targetInput) {
          await interaction.reply({
            content: `${CE.failure.str} You are not connected to a voice channel! Please join a voice channel first and run \`.play <song>\`.`,
            ephemeral: true,
          });
          return;
        }

        const premiumEmbed = prettyEmbed({
          title: "Zenith Premium Feature Required",
          color: 0xF1C40F,
          description:
            `### ${CE.star.str}  **VIP Remote Playback Mode**\n\n` +
            `Remotely summoning music into a voice channel using channel ID or user mention without being in the VC is an exclusive **Zenith Premium** feature!\n\n` +
            `• **Free Usage**: Connect to any voice channel yourself and run \`.play <song>\` for free.\n` +
            `• **Premium Perks**: Summon the bot to any VC using channel ID/mention or user ID/mention without joining it!\n\n` +
            `${CE.crown.str} **Unlock god-tier perks today:** [Claim VIP Access](https://discord.gg/gFgAfpSYdp)`,
          footer: "Zenith Audio VIP Engine • Upgrade: discord.gg/gFgAfpSYdp",
        });
        await interaction.reply({
          embeds: [premiumEmbed],
          components: [buildSupportRow("Get VIP Pass")] as any,
          ephemeral: true,
        });
        return;
      }
    }

    let voiceChannel = callerVoice;
    if (!voiceChannel) {
      voiceChannel = await resolveTargetVoiceChannel(interaction.guild, targetInput, member);
    }

    if (!voiceChannel) {
      await interaction.reply({
        content: `${CE.failure.str} Could not find a voice channel! Please join a voice channel or specify a valid voice channel ID or mention.`,
        ephemeral: true,
      });
      return;
    }

    // Verify Connect, Speak, ViewChannel permissions & channel limits
    const permCheck = checkVoicePermissionsAndLimit(voiceChannel, interaction.guild!);
    if (!permCheck.ok) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.failure.str} Cannot Join Voice Channel`,
            description: `**Reason:** ${permCheck.reason}\n\nPlease verify Zenith Bot has **View Channel**, **Connect**, and **Speak** permissions in <#${voiceChannel.id}>.`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (!query) {
      await interaction.reply({ content: `${CE.warning.str} Please provide a song name or search query.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const requester = {
      id: interaction.user.id,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL(),
    };

    const results = await searchTracks(query, requester);
    if (results.length === 0) {
      await interaction.editReply({
        embeds: [
          prettyEmbed({
            title: "No Results Found",
            description: `${CE.failure.str}  Could not find any tracks matching \`${query}\`.\n\nTry different keywords, artist name, or provide a direct link!`,
            color: 0xed4245,
          }),
        ],
      });
      return;
    }

    // Cache search results for other results picker
    searchResultCache.set(interaction.guildId, results);
    searchResultCache.set(interaction.user.id, results);

    const track = results[0];
    const player = getOrCreateMusicPlayer(interaction.guildId, voiceChannel, interaction.channel as any);
    player.lastSearchResults = results;
    player.lastSearchQuery = query;

    if (player.isPlaying) {
      if (player.currentTrack?.is247Radio) {
        await player.playTrack(track);
        const embed = buildNowPlayingEmbed(player);
        const rows = buildPlayerActionRows(player);
        await interaction.editReply({ embeds: [embed], components: rows as any });
      } else {
        player.queue.push(track);
        const queuedEmbed = prettyEmbed({
          title: "Track Added to Queue",
          description:
            `### ${CE.music.str}  **[${track.title}](${track.url})**\n\n` +
            `> **Artist:** \`${track.artist}\` • **Duration:** \`${formatTime(track.durationSeconds)}\`\n` +
            `> **Queue Position:** \`#${player.queue.length}\` • **Target Channel:** <#${voiceChannel.id}>\n` +
            `> **Requested By:** <@${interaction.user.id}>\n\n` +
            `${CE.crown.str} **Tired of random bot leaves and audio drops?**\n` +
            `Upgrade to **Zenith Premium** for dedicated 24/7 Voice nodes, zero queue delays, and instantaneous song buffering.\n\n` +
            `${CE.crown.str} **Join elite communities:** [Claim VIP Access](https://discord.gg/gFgAfpSYdp)`,
          thumbnail: track.thumbnailUrl,
          color: COLORS.primary,
          footer: "Zenith High-Fidelity Audio • Upgrade: discord.gg/gFgAfpSYdp",
        });

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("music:search_results")
            .setLabel("Other Results")
            .setEmoji(CE.search ? CE.search.str : CE.list.str)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("music:queue")
            .setLabel("View Queue")
            .setEmoji(CE.list.str)
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({
          embeds: [queuedEmbed],
          components: [actionRow as any],
        });
      }
    } else {
      player.textChannel = interaction.channel as any;
      await player.playTrack(track);
      const embed = buildNowPlayingEmbed(player);
      const rows = buildPlayerActionRows(player);
      await interaction.editReply({ embeds: [embed], components: rows as any });
    }
  },
};

/**
 * /skip command
 */
export const skipCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the currently playing track"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player || (!player.isPlaying && !player.currentTrack)) {
      await interaction.reply({ content: `${CE.failure.str} No track is currently playing.`, ephemeral: true });
      return;
    }

    const skipped = player.currentTrack;
    player.skip();

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: "Track Skipped",
          description:
            `### ${CE.music.str}  **Track Skipped**\n\n` +
            `Skipped **${skipped?.title || "Current Track"}**.\n\n` +
            (player.queue.length > 0
              ? `**Next up:** \`${player.queue[0].title}\` by \`${player.queue[0].artist}\``
              : player.twentyFourSeven.enabled
                ? `*Resuming 24/7 continuous stream in <#${player.voiceChannel.id}>...*`
                : `*Queue is now empty. Add more songs with \`/play\`!*`),
          color: COLORS.primary,
        }),
      ],
    });
  },
};

/**
 * /pause command
 */
export const pauseCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause audio playback"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player || !player.isPlaying) {
      await interaction.reply({ content: `${CE.failure.str} Nothing is playing right now.`, ephemeral: true });
      return;
    }

    if (player.isPaused) {
      await interaction.reply({ content: `${CE.warning.str} Playback is already paused! Use \`/resume\` to unpause.`, ephemeral: true });
      return;
    }

    player.pause();
    await interaction.reply({
      content: `${CE.settings.str} **Playback paused.** Use \`/resume\` or the interactive button to continue.`,
    });
  },
};

/**
 * /resume command
 */
export const resumeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume paused audio playback"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session in this server.`, ephemeral: true });
      return;
    }

    if (!player.isPaused) {
      await interaction.reply({ content: `${CE.warning.str} Playback is not paused!`, ephemeral: true });
      return;
    }

    player.resume();
    await interaction.reply({
      content: `${CE.play.str} **Playback resumed.**`,
    });
  },
};

/**
 * /stop command
 */
export const stopCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback, clear queue, and leave the voice channel"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} Bot is not active in any voice channel.`, ephemeral: true });
      return;
    }

    const vcName = player.voiceChannel.name;
    player.destroy();

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: "Music Session Stopped",
          description: `${CE.delete.str}  Disconnected from **${vcName}** and cleared the audio queue.`,
          color: 0xed4245,
        }),
      ],
    });
  },
};

/**
 * /seek command
 */
export const seekCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seek to a specific timestamp in the current track")
    .addStringOption((o) =>
      o.setName("timestamp").setDescription("Timestamp to seek to (e.g. 1:30 or 90 for seconds)").setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player || !player.currentTrack || !player.isPlaying) {
      await interaction.reply({ content: `${CE.failure.str} No track is currently playing.`, ephemeral: true });
      return;
    }

    const raw = interaction.options.getString("timestamp", true).trim();
    let seconds = 0;
    if (raw.includes(":")) {
      const parts = raw.split(":").map(Number);
      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    } else {
      seconds = Number(raw);
    }

    if (isNaN(seconds) || seconds < 0) {
      await interaction.reply({ content: `${CE.failure.str} Invalid timestamp format. Use \`1:30\` or seconds like \`90\`.`, ephemeral: true });
      return;
    }

    await player.seek(seconds);
    await interaction.reply({
      content: `⏩ **Seeked to \`${formatTime(seconds)}\`** in **${player.currentTrack.title}**.`,
    });
  },
};

/**
 * /skipto command
 */
export const skipToCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("skipto")
    .setDescription("Skip directly to a specific track number in the queue")
    .addIntegerOption((o) => o.setName("position").setDescription("Track position number in queue").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const pos = interaction.options.getInteger("position", true);
    const target = player.skipTo(pos);
    if (!target) {
      await interaction.reply({ content: `${CE.failure.str} Invalid position #${pos}. Queue has ${player.queue.length} tracks.`, ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `⏭️ **Skipped directly to track #${pos}:** **${target.title}** by **${target.artist}**!`,
    });
  },
};

/**
 * /shuffle command
 */
export const shuffleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Randomly shuffle all tracks in the queue"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player || player.queue.length < 2) {
      await interaction.reply({ content: `${CE.warning.str} Need at least 2 tracks in queue to shuffle.`, ephemeral: true });
      return;
    }

    const count = player.shuffle();
    await interaction.reply({
      content: `${CE.shuffle.str} **Shuffled \`${count}\` track(s) in the queue!**`,
    });
  },
};

/**
 * /remove command
 */
export const removeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a track from the queue by its number")
    .addIntegerOption((o) => o.setName("position").setDescription("Track position number in queue").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const pos = interaction.options.getInteger("position", true);
    const removed = player.removeTrack(pos);
    if (!removed) {
      await interaction.reply({ content: `${CE.failure.str} Invalid track number #${pos}. Queue has ${player.queue.length} tracks.`, ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `${CE.white_cancel.str} **Removed track #${pos}:** **${removed.title}** from the queue.`,
    });
  },
};

/**
 * /move command
 */
export const moveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("move")
    .setDescription("Move a track to a different position in the queue")
    .addIntegerOption((o) => o.setName("from").setDescription("Current position number").setRequired(true))
    .addIntegerOption((o) => o.setName("to").setDescription("New target position number").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const from = interaction.options.getInteger("from", true);
    const to = interaction.options.getInteger("to", true);

    const moved = player.moveTrack(from, to);
    if (!moved) {
      await interaction.reply({ content: `${CE.failure.str} Invalid position numbers. Queue length is ${player.queue.length}.`, ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `↔️ **Moved track:** **${moved.title}** from position **#${from}** to **#${to}**!`,
    });
  },
};

/**
 * /queue command (Interactive Multi-Page Embeds)
 */
export const queueCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("View the current music queue with interactive multi-page navigation")
    .addIntegerOption((o) => o.setName("page").setDescription("Initial page number").setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;
    const player = getMusicPlayer(interaction.guildId);
    if (!player || (!player.currentTrack && player.queue.length === 0)) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Music Queue Empty",
            description: `${CE.music.str}  The queue is currently empty.\n\nUse \`/play <song>\` or \`.play <song>\` to add tracks!`,
            color: COLORS.primary,
          }),
        ],
      });
      return;
    }

    const pageSize = 10;
    const totalDuration = player.queue.reduce((acc, t) => acc + t.durationSeconds, 0);
    const current = player.currentTrack;

    if (player.queue.length === 0) {
      const singleEmbed = prettyEmbed({
        title: `Music Queue • ${player.voiceChannel.name}`,
        color: COLORS.primary,
        description:
          current
            ? `### ${CE.play.str}  **Now Playing**\n` +
              `**[${current.title}](${current.url})** - \`${current.artist}\` (${formatTime(current.durationSeconds)})\n` +
              `**Source:** \`${current.sourceName || "YouTube / SoundCloud HQ Audio"}\` • Req by <@${current.requestedBy.id}>\n\n` +
              `*Queue is empty — add upcoming songs with \`/play\`!*`
            : "*No track currently playing*",
        fields: [
          { name: "Total Tracks", value: "`0`", inline: true },
          { name: "24/7 Mode", value: player.twentyFourSeven.enabled ? `\`Active (${player.twentyFourSeven.query || "Radio"})\`` : "`Disabled`", inline: true },
        ],
      });
      await interaction.reply({ embeds: [singleEmbed] });
      return;
    }

    const totalPages = Math.ceil(player.queue.length / pageSize);
    const pages: EmbedBuilder[] = [];

    for (let p = 0; p < totalPages; p++) {
      const startIdx = p * pageSize;
      const pageTracks = player.queue.slice(startIdx, startIdx + pageSize);
      const queueList = pageTracks.map((t, idx) => {
        const overallIndex = startIdx + idx + 1;
        return `\`${overallIndex}.\` **[${t.title}](${t.url})** - \`${t.artist}\` (\`${formatTime(t.durationSeconds)}\`) • Req by <@${t.requestedBy.id}>`;
      });

      pages.push(
        prettyEmbed({
          title: `Music Queue • ${player.voiceChannel.name}`,
          color: COLORS.primary,
          description:
            (current
              ? `### ${CE.play.str} **Now Playing**\n` +
                `**[${current.title}](${current.url})** - \`${current.artist}\` (\`${formatTime(current.durationSeconds)}\`)\n` +
                `**Active Source:** \`${current.sourceName || "YouTube / SoundCloud HQ Audio"}\` • Req by <@${current.requestedBy.id}>\n\n`
              : "") +
            `### ${CE.clipboard.str} **Up Next (${player.queue.length} Tracks)**\n` +
            queueList.join("\n"),
          fields: [
            { name: "Total Tracks", value: `\`${player.queue.length}\``, inline: true },
            { name: "Total Queue Time", value: `\`${formatTime(totalDuration)}\``, inline: true },
            { name: "24/7 Radio", value: player.twentyFourSeven.enabled ? `\`Active (${player.twentyFourSeven.query || "Radio"})\`` : "`Disabled`", inline: true },
          ],
        })
      );
    }

    await sendPaginatedEmbed(interaction, pages, {
      footerPrefix: "Zenith Audio VIP Engine",
    });
  },
};

/**
 * /source command - View and change audio stream source or mirror for the current track
 */
export const sourceCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("source")
    .setDescription("View available audio sources / mirrors and switch streams in real-time"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player || !player.currentTrack) {
      await interaction.reply({ content: `${CE.failure.str} No track is currently playing.`, ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const track = player.currentTrack;
    const sources = await resolveAllAudioSources(track.title, track.artist, track.streamUrl);
    if (sources.length === 0) {
      await interaction.editReply({ content: `${CE.failure.str} Could not fetch alternative audio sources.` });
      return;
    }

    sourceOptionCache.set(interaction.user.id, { track, options: sources });

    const selectOptions = sources.map((s, i) => {
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
        .setPlaceholder("Select audio source / mirror for current song...")
        .addOptions(selectOptions)
    );

    const embed = prettyEmbed({
      title: "Audio Source & Mirror Selector",
      description:
        `### ${CE.music.str} **[${track.title}](${track.url})**\n` +
        `**Artist:** \`${track.artist}\`\n` +
        `**Current Active Source:** \`${track.sourceName || "YouTube / SoundCloud HQ Audio"}\`\n\n` +
        `Select an alternative high-fidelity audio stream below to switch in real-time:`,
      color: COLORS.primary,
    });

    await interaction.editReply({ embeds: [embed], components: [row as any] as any });
  },
};

/**
 * /clearqueue command
 */
export const clearQueueCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("clearqueue")
    .setDescription("Clear all tracks from the music queue"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player || player.queue.length === 0) {
      await interaction.reply({ content: `${CE.warning.str} The queue is already empty.`, ephemeral: true });
      return;
    }

    const count = player.clearQueue();
    await interaction.reply({
      content: `${CE.check.str} **Cleared \`${count}\` track(s) from the queue.**`,
    });
  },
};

/**
 * /volume command
 */
export const volumeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Adjust the music playback volume (1% - 100%)")
    .addIntegerOption((o) =>
      o.setName("level").setDescription("Volume percentage between 1 and 100").setRequired(true).setMinValue(1).setMaxValue(100),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const vol = interaction.options.getInteger("level", true);
    player.setVolume(vol);

    await interaction.reply({
      content: `${CE.settings.str} **Volume set to \`${player.volume}%\`**`,
    });
  },
};

/**
 * /loop command
 */
export const loopCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode (off, track, queue)")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Loop mode to apply")
        .setRequired(false)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Current Track", value: "track" },
          { name: "Entire Queue", value: "queue" },
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const requestedMode = interaction.options.getString("mode") as "off" | "track" | "queue" | null;
    if (requestedMode) {
      player.loopMode = requestedMode;
    } else {
      player.toggleLoop();
    }

    await interaction.reply({
      content: `${CE.streak.str} **Loop mode set to: \`${player.loopMode.toUpperCase()}\`**`,
    });
  },
};

/**
 * /autoplay command
 */
export const autoplayCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle continuous intelligent music autoplay"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const isAutoplay = player.toggleAutoplay();
    await interaction.reply({
      content: `${CE.radio.str} **Autoplay is now: \`${isAutoplay ? "ENABLED (Recommended songs will auto-play)" : "DISABLED"}\`**`,
    });
  },
};

/**
 * /equalizer command
 */
export const equalizerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("equalizer")
    .setDescription("Apply studio equalizer & DSP audio filters in real-time")
    .addStringOption((o) =>
      o
        .setName("preset")
        .setDescription("Equalizer preset profile")
        .setRequired(true)
        .addChoices(
          ...Object.values(EQUALIZER_PRESETS).map((p) => ({
            name: `${p.label} - ${p.description.slice(0, 50)}`,
            value: p.id,
          })),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const preset = interaction.options.getString("preset", true) as EqualizerPreset;
    const info = await player.setEqualizer(preset);

    await interaction.reply({
      embeds: [
        prettyEmbed({
          title: `Equalizer Applied: ${info.label}`,
          description:
            `### ${CE.equalizer.str}  **Studio DSP Updated**\n\n` +
            `**Profile:** \`${info.label}\`\n` +
            `**Description:** ${info.description}\n\n` +
            `*Filter applied smoothly in real time without interrupting track position.*`,
          color: COLORS.primary,
        }),
      ],
    });
  },
};

/**
 * /bassboost command
 */
export const bassboostCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("Quickly toggle heavy bass boost filter")
    .addBooleanOption((o) => o.setName("enabled").setDescription("Enable or disable bass boost").setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const enabled = interaction.options.getBoolean("enabled");
    const targetPreset: EqualizerPreset =
      enabled === null ? (player.equalizer === "bassboost" ? "off" : "bassboost") : enabled ? "bassboost" : "off";

    await player.setEqualizer(targetPreset);
    await interaction.reply({
      content: `${CE.equalizer.str} **Bass Boost is now: \`${targetPreset !== "off" ? "ACTIVE (Heavy Bass Profile)" : "DISABLED (Flat Audio)"}\`**`,
    });
  },
};

/**
 * /nowplaying command
 */
export const nowPlayingCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Display currently playing track with interactive controls"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;
    const player = getMusicPlayer(interaction.guildId);
    if (!player || (!player.currentTrack && !player.twentyFourSeven.enabled)) {
      await interaction.reply({ content: `${CE.failure.str} No music is playing right now.`, ephemeral: true });
      return;
    }

    const embed = buildNowPlayingEmbed(player);
    const rows = buildPlayerActionRows(player);
    await interaction.reply({ embeds: [embed], components: rows as any });
  },
};

/**
 * /speed command
 */
export const speedCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("speed")
    .setDescription("Set playback tempo/speed multiplier (0.5x - 2.0x)")
    .addNumberOption((o) =>
      o.setName("speed").setDescription("Speed multiplier (e.g. 1.25, 0.8, 1.5)").setRequired(true).setMinValue(0.5).setMaxValue(2.0),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) return;

    const dj = await hasDjPermission(interaction.member as GuildMember, interaction.guild);
    if (!dj.allowed) {
      await interaction.reply({ content: dj.reason || `${CE.failure.str} DJ role required.`, ephemeral: true });
      return;
    }

    const player = getMusicPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ content: `${CE.failure.str} No active music session.`, ephemeral: true });
      return;
    }

    const spd = interaction.options.getNumber("speed", true);
    player.speed = Math.max(0.5, Math.min(2.0, spd));
    if (player.isPlaying && player.currentTrack) {
      await player.playTrack(player.currentTrack);
    }
    await interaction.reply({ content: `${CE.settings.str} **Playback speed set to \`${player.speed}x\`**` });
  },
};

/**
 * /twentyfourseven (or .24/7)
 */
export const twentyFourSevenCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("twentyfourseven")
    .setDescription("Premium Only: Enable 24/7 radio playback in voice channel (plays continuously even if empty)")
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Voice Channel ID/mention or User ID/mention [Premium]")
        .setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("query").setDescription("Singer name (plays all songs), album, or song to loop 24/7").setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, ephemeral: true });
      return;
    }

    const isPremium = await hasPremiumAccess(interaction.user.id, interaction.guildId, interaction.member);
    if (!isPremium) {
      const premiumEmbed = prettyEmbed({
        title: "Zenith Premium Feature Required",
        color: 0xF1C40F,
        description:
          `### ${CE.star.str}  **VIP 24/7 Voice Channel Radio Mode**\n\n` +
          `**24/7 Voice Channel Radio Mode** and remote VC connection are exclusive to **Zenith Premium**!\n\n` +
          `• **24/7 Mode Perks**: Bot stays anchored in your server's voice channel permanently even when everyone leaves, streaming non-stop high-fidelity audio.\n` +
          `• **Remote VC Summon**: Anchor into any VC using channel ID or user mention without needing to be in the voice channel yourself.\n\n` +
          `👑 **Upgrade to God-Mode Audio:** [Claim VIP Access](https://discord.gg/gFgAfpSYdp)`,
        footer: "👑 Zenith Audio VIP Engine • Upgrade: discord.gg/gFgAfpSYdp",
      });
      await interaction.reply({
        embeds: [premiumEmbed],
        components: [buildSupportRow("⚡ Upgrade to 24/7 VIP")] as any,
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    let targetInput = interaction.options.getString("target")?.trim() || null;
    let query = interaction.options.getString("query")?.trim() || null;

    if (targetInput && !/^(<#\d{17,20}>|<@!?\d{17,20}>|\d{17,20})$/.test(targetInput) && !query) {
      query = targetInput;
      targetInput = null;
    } else if (query && !targetInput && /^(<#\d{17,20}>|<@!?\d{17,20}>|\d{17,20})$/.test(query)) {
      targetInput = query;
      query = null;
    }

    const callerVoice = await getMemberVoiceChannel(interaction.guild, interaction.user.id);
    let voiceChannel = callerVoice;

    if (!voiceChannel && targetInput) {
      voiceChannel = await resolveTargetVoiceChannel(interaction.guild, targetInput, member);
    }

    let player = getMusicPlayer(interaction.guildId);
    if (!voiceChannel && player?.voiceChannel) {
      voiceChannel = player.voiceChannel;
    }

    if (!voiceChannel) {
      await interaction.reply({
        content: `${CE.failure.str} You are not connected to a voice channel! Please join a voice channel or provide a voice channel ID/mention.`,
        ephemeral: true,
      });
      return;
    }

    player = getOrCreateMusicPlayer(interaction.guildId, voiceChannel, interaction.channel as any);

    const willEnable = !player.twentyFourSeven.enabled || Boolean(query);

    if (willEnable) {
      let startingTrack: Track | null = null;
      let matchedType: "artist" | "album" | "song" | "radio" = "radio";
      let identifiedArtist: string | undefined;
      let identifiedAlbum: string | undefined;
      let loadedSongCount = 0;
      let requestedSongMode: "full" | "main" = "full";

      if (query && query.trim().length > 0) {
        let cleanQuery = query.trim();
        const lowerQ = cleanQuery.toLowerCase();
        if (lowerQ === "main" || lowerQ.endsWith(" main")) {
          requestedSongMode = "main";
          cleanQuery = cleanQuery.replace(/\bmain$/i, "").trim();
        } else if (lowerQ === "full" || lowerQ.endsWith(" full")) {
          requestedSongMode = "full";
          cleanQuery = cleanQuery.replace(/\bfull$/i, "").trim();
        }

        if (cleanQuery.length > 0) {
          const artistResults = await searchArtistSongs(cleanQuery, {
            id: interaction.user.id,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL(),
          }, 50);

          const cleanLower = cleanQuery.toLowerCase();
          const isSingerMatch =
            artistResults.length > 0 &&
            (artistResults[0].artist.toLowerCase().includes(cleanLower) ||
              cleanLower.includes(artistResults[0].artist.toLowerCase()) ||
              artistResults.filter((t) => t.artist.toLowerCase().includes(cleanLower)).length >= 2);

          if (isSingerMatch && artistResults.length > 0) {
            matchedType = "artist";
            identifiedArtist = artistResults[0].artist;
            startingTrack = artistResults[0];
            startingTrack.is247Radio = true;
            loadedSongCount = artistResults.length;

            player.queue = player.queue.filter((t) => !t.is247Radio);

            for (let i = 1; i < artistResults.length; i++) {
              const artistTrack = artistResults[i];
              artistTrack.is247Radio = true;
              player.queue.push(artistTrack);
            }

            await player.set247(true, cleanQuery, "artist", identifiedArtist, requestedSongMode);
            await player.playTrack(startingTrack);
          } else {
            const generalResults = await searchTracks(cleanQuery, {
              id: interaction.user.id,
              username: interaction.user.username,
              avatarUrl: interaction.user.displayAvatarURL(),
            }, 30);

            if (generalResults.length > 0) {
              startingTrack = generalResults[0];
              startingTrack.is247Radio = true;
              loadedSongCount = 1;

              const firstAlbum = startingTrack.album;
              const albumTracks = firstAlbum
                ? generalResults.filter((t) => t.album && t.album.toLowerCase() === firstAlbum.toLowerCase())
                : [];

              if (albumTracks.length >= 3) {
                matchedType = "album";
                identifiedAlbum = firstAlbum;
                identifiedArtist = startingTrack.artist;
                loadedSongCount = albumTracks.length;

                player.queue = player.queue.filter((t) => !t.is247Radio);
                for (let i = 1; i < albumTracks.length; i++) {
                  const albTrack = albumTracks[i];
                  albTrack.is247Radio = true;
                  player.queue.push(albTrack);
                }
                await player.set247(true, cleanQuery, "album", identifiedArtist, requestedSongMode);
              } else {
                matchedType = "song";
                identifiedArtist = startingTrack.artist;
                await player.set247(true, cleanQuery, "song", identifiedArtist, requestedSongMode);
              }

              await player.playTrack(startingTrack);
            }
          }
        } else {
          await player.set247(true, undefined, undefined, undefined, requestedSongMode);
        }
      } else {
        await player.set247(true, undefined, undefined, undefined, requestedSongMode);
      }

      if (!startingTrack && !player.isPlaying) {
        await player.resume247Stream();
      }

      const songModeBadge =
        requestedSongMode === "main"
          ? `${CE.fire.str} **MAIN (Famous Hook / Chorus Highlights)**`
          : `${CE.music.str} **FULL VERSION (Complete Tracks Non-Stop)**`;

      let desc = "";
      if (matchedType === "artist" && identifiedArtist) {
        desc =
          `**Zenith Bot** is now playing all songs by **${identifiedArtist}** 24/7!\n\n` +
          `• **Singer / Artist:** **${identifiedArtist}**\n` +
          `• **Discography Loaded:** \`${loadedSongCount}\` songs queued in 24/7 rotation\n` +
          `• **Audio Track Mode:** ${songModeBadge}\n` +
          `• **Now Playing:** **${startingTrack?.title}**\n` +
          `• **Target Channel:** <#${player.voiceChannel.id}>\n` +
          `• **VIP Tier:** Zenith Premium Active`;
      } else if (matchedType === "album" && identifiedAlbum) {
        desc =
          `**Zenith Bot** is now streaming the **${identifiedAlbum}** album 24/7!\n\n` +
          `• **Album:** **${identifiedAlbum}**\n` +
          `• **Artist:** **${identifiedArtist}**\n` +
          `• **Album Tracks:** \`${loadedSongCount}\` songs queued in sequence\n` +
          `• **Audio Track Mode:** ${songModeBadge}\n` +
          `• **Now Playing:** **${startingTrack?.title}**\n` +
          `• **Target Channel:** <#${player.voiceChannel.id}>\n` +
          `• **VIP Tier:** Zenith Premium Active`;
      } else if (startingTrack) {
        desc =
          `**Zenith Bot** is now streaming **${startingTrack.title}** and related 24/7 tracks!\n\n` +
          `• **Starting Track:** **${startingTrack.title}** by **${startingTrack.artist}**\n` +
          `• **Audio Track Mode:** ${songModeBadge}\n` +
          `• **24/7 Stream:** Continuous non-stop music seeded from \`${query}\`\n` +
          `• **Target Channel:** <#${player.voiceChannel.id}>\n` +
          `• **VIP Tier:** Zenith Premium Active`;
      } else {
        desc =
          `**Zenith Bot** is now permanently anchored in <#${player.voiceChannel.id}> 24/7!\n\n` +
          `• **Status:** ${CE.check.str} **Ready to play**\n` +
          `• **Mode:** Permanent 24/7 Connection (Idle)\n` +
          `• **Target Channel:** <#${player.voiceChannel.id}>\n` +
          `• **Auto-Reconnect:** Active\n\n` +
          `Use \`.play <song>\` or mention a song to start high-fidelity playback!`;
      }

      const embed = prettyEmbed({
        title:
          matchedType === "artist"
            ? `24/7 Singer Discography: ${identifiedArtist}`
            : matchedType === "album"
              ? `24/7 Album Mode: ${identifiedAlbum}`
              : startingTrack ? "24/7 Radio Mode ENABLED (VIP)" : "24/7 Connection Active (VIP)",
        color: 0x57f287,
        description:
          (startingTrack ? `### ${CE.music.str}  **24/7 High-Fidelity Radio Active**\n\n` : `### ${CE.voice.str}  **24/7 Voice Anchor Active**\n\n`) +
          desc +
          `\n\n> 👑 **VIP Audio Pass:** Continuous 24/7 connection with 0% downtime and dedicated streaming priority.`,
        thumbnail: startingTrack ? startingTrack.thumbnailUrl : "https://cdn-icons-png.flaticon.com/512/3233/3233483.png",
        image: startingTrack ? "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=1200&auto=format&fit=crop" : undefined,
        footer: "👑 Zenith 24/7 VIP Engine • Support: discord.gg/gFgAfpSYdp",
      });

      await interaction.reply({
        embeds: [embed],
        components: [buildSupportRow("⚡ Zenith VIP Hub")] as any,
      });
    } else {
      await player.set247(false);
      await interaction.reply({
        content: `${CE.check.str} **24/7 Mode DISABLED.** The bot will disconnect normally after inactivity when queue empties.`,
      });
    }
  },
};

/**
 * /musicpanel & /panel
 */
export const musicPanelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("musicpanel")
    .setDescription("Open the interactive music control studio and live audio dashboard"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, ephemeral: true });
      return;
    }

    const callerVoice = await getMemberVoiceChannel(interaction.guild, interaction.user.id);
    let player = getMusicPlayer(interaction.guildId);

    if (!player) {
      if (!callerVoice) {
        await interaction.reply({
          content: `${CE.warning.str} No music session is active in this server. Join a voice channel and run \`.play <song>\` or join VC first.`,
          ephemeral: true,
        });
        return;
      }
      player = getOrCreateMusicPlayer(interaction.guildId, callerVoice, interaction.channel as any);
    }

    const embed = buildNowPlayingEmbed(player);
    const rows = buildPlayerActionRows(player);

    await interaction.reply({ embeds: [embed], components: rows as any });
  },
};

export const panelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Open the interactive music control studio and live audio dashboard"),
  async execute(interaction: ChatInputCommandInteraction) {
    return musicPanelCommand.execute(interaction);
  },
};

/**
 * /search command - Performs multi-source search and presents Top 10 picker
 */
export const searchCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search top songs from YouTube, Spotify, SoundCloud, Apple Music and pick a track to play")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song name, artist, or keywords").setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: `${CE.failure.str} Command can only be used in a server.`, ephemeral: true });
      return;
    }

    const query = interaction.options.getString("query", true).trim();
    if (!query) return;

    await interaction.deferReply();

    const requester = {
      id: interaction.user.id,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL(),
    };

    const results = await searchTracks(query, requester, 10);
    if (results.length === 0) {
      await interaction.editReply({
        embeds: [
          prettyEmbed({
            title: "No Search Results",
            description: `${CE.failure.str} Could not find any songs matching \`${query}\`.`,
            color: 0xed4245,
          }),
        ],
      });
      return;
    }

    // Build top 10 search results list
    const searchList = results.map((t, idx) => {
      let sourceBadge = `${CE.youtube_music.str} YouTube Music`;
      if (t.url.includes("spotify")) sourceBadge = `${CE.spotify.str} Spotify`;
      else if (t.url.includes("apple") || t.url.includes("itunes")) sourceBadge = `${CE.apple_music.str} Apple Music`;
      else if (t.url.includes("amazon") || t.url.includes("prime")) sourceBadge = `${CE.amazon_music.str} Amazon Prime Music`;
      else if (t.url.includes("jio") || t.url.includes("saavn")) sourceBadge = `${CE.jio_saavan.str} JioSaavn`;

      return `\`${idx + 1}.\` ${sourceBadge} **[${t.title}](${t.url})**\n> **Artist:** \`${t.artist}\` • **Duration:** \`${formatTime(t.durationSeconds)}\``;
    });

    const embed = prettyEmbed({
      title: `Top Search Results for "${query}"`,
      description:
        `### ${CE.white_musicnote.str} **Select a track from top search results below**\n\n` +
        searchList.join("\n\n") +
        `\n\n*Choose an option from the dropdown menu below to play or queue the song immediately!*`,
      color: COLORS.primary,
      footer: "Zenith Search Picker • Select below within 60 seconds",
    });

    // Create StringSelectMenu options
    const selectOptions = results.slice(0, 10).map((t, idx) => {
      const opt = new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}. ${t.title.slice(0, 75)}`)
        .setValue(`search_pick:${idx}:${encodeURIComponent(t.title.slice(0, 30))}`)
        .setDescription(`by ${t.artist.slice(0, 45)} (${formatTime(t.durationSeconds)})`);

      let sourceEmoji = CE.youtube_music;
      if (t.url.includes("spotify")) sourceEmoji = CE.spotify;
      else if (t.url.includes("apple") || t.url.includes("itunes")) sourceEmoji = CE.apple_music;
      else if (t.url.includes("amazon") || t.url.includes("prime")) sourceEmoji = CE.amazon_music;
      else if (t.url.includes("jio") || t.url.includes("saavn")) sourceEmoji = CE.jio_saavan;

      opt.setEmoji(sourceEmoji.id);
      return opt;
    });

    // Cache the search results on global temp map for interaction handler
    searchResultCache.set(interaction.user.id, results);

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select:music:search_pick")
        .setPlaceholder("▼ Choose a track from the top search results...")
        .addOptions(selectOptions),
    );

    await interaction.editReply({ embeds: [embed], components: [row] as any });
  },
};
