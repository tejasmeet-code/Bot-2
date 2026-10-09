import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getUserPlaylists,
  getPlaylist,
  createPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
} from "../storage/playlists";
import {
  getMusicPlayer,
  getOrCreateMusicPlayer,
  searchTracks,
  formatTime,
} from "../music/musicManager";
import { getMemberVoiceChannel, resolveTargetVoiceChannel } from "./music";
import { CE, COLORS } from "../utils/embedStyle";

export const playlistCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Create, manage, and play your personalized custom music playlists")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Load and play all songs from a custom playlist")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new personalized playlist")
        .addStringOption((o) => o.setName("name").setDescription("Name for your new playlist").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add current track or searched song to your playlist")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true))
        .addStringOption((o) => o.setName("song").setDescription("Song name or URL (optional, defaults to now playing)").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View all your created playlists and track counts"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("show")
        .setDescription("View tracks in a specific playlist")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a track from a playlist by its number")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true))
        .addIntegerOption((o) => o.setName("track_number").setDescription("Track number to remove").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a custom playlist permanently")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name to delete").setRequired(true)),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === "create") {
      const name = interaction.options.getString("name", true);
      const res = await createPlaylist(userId, name);
      if (res.success) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE.check.str} Playlist Created`)
              .setDescription(`Created playlist **${res.playlist?.name}**!\n\nUse \`/playlist add ${res.playlist?.name}\` while playing a song or \`/playlist add ${res.playlist?.name} <song>\` to add tracks.`)
              .setColor(0x57f287),
          ],
        });
      } else {
        await interaction.reply({ content: `${CE.failure.str} ${res.message}`, flags: 1 << 6 });
      }
      return;
    }

    if (sub === "list") {
      const playlists = await getUserPlaylists(userId);
      if (playlists.length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE.folder.str} Your Custom Playlists`)
              .setDescription("You haven't created any playlists yet!\n\nUse `/playlist create <name>` to start your first collection.")
              .setColor(COLORS.primary),
          ],
        });
        return;
      }

      const listStr = playlists
        .map((p, idx) => {
          const totalTime = p.tracks.reduce((a, t) => a + t.durationSeconds, 0);
          return `\`${idx + 1}.\` **${p.name}** — \`${p.tracks.length}\` track(s) • \`${formatTime(totalTime)}\``;
        })
        .join("\n");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.folder.str} Your Custom Playlists (${playlists.length}/25)`)
            .setDescription(listStr)
            .setFooter({ text: "Use /playlist play <name> to queue any playlist" })
            .setColor(COLORS.primary),
        ],
      });
      return;
    }

    if (sub === "show") {
      const name = interaction.options.getString("name", true);
      const pl = await getPlaylist(userId, name);
      if (!pl) {
        await interaction.reply({ content: `${CE.failure.str} Playlist **${name}** not found.`, flags: 1 << 6 });
        return;
      }

      if (pl.tracks.length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE.folder.str} Playlist: ${pl.name}`)
              .setDescription("This playlist is currently empty. Use `/playlist add` to save songs!")
              .setColor(COLORS.primary),
          ],
        });
        return;
      }

      const trackList = pl.tracks.slice(0, 15).map((t, idx) => {
        return `\`${idx + 1}.\` **${t.title}** - \`${t.artist}\` (${formatTime(t.durationSeconds)})`;
      });

      const totalDuration = pl.tracks.reduce((a, t) => a + t.durationSeconds, 0);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.folder.str} Playlist: ${pl.name}`)
            .setDescription(trackList.join("\n"))
            .addFields(
              { name: "Total Songs", value: `\`${pl.tracks.length}\``, inline: true },
              { name: "Total Duration", value: `\`${formatTime(totalDuration)}\``, inline: true },
            )
            .setFooter({ text: pl.tracks.length > 15 ? `...and ${pl.tracks.length - 15} more track(s)` : "Run /playlist play to start" })
            .setColor(COLORS.primary),
        ],
      });
      return;
    }

    if (sub === "add") {
      const name = interaction.options.getString("name", true);
      let songQuery = interaction.options.getString("song")?.trim();

      let targetTrack: any = null;
      if (!songQuery) {
        const player = interaction.guildId ? getMusicPlayer(interaction.guildId) : undefined;
        if (!player?.currentTrack) {
          await interaction.reply({
            content: `${CE.warning.str} No track currently playing. Please provide a song name: \`/playlist add ${name} <song>\`.`,
            flags: 1 << 6,
          });
          return;
        }
        targetTrack = player.currentTrack;
      } else {
        await interaction.deferReply();
        const results = await searchTracks(songQuery, {
          id: interaction.user.id,
          username: interaction.user.username,
          avatarUrl: interaction.user.displayAvatarURL(),
        }, 1);

        if (results.length === 0) {
          await interaction.editReply({ content: `${CE.failure.str} Could not find track \`${songQuery}\`.` });
          return;
        }
        targetTrack = results[0];
      }

      const res = await addTrackToPlaylist(userId, name, targetTrack);
      if (res.success) {
        const embed = new EmbedBuilder()
          .setTitle(`${CE.check.str} Track Added to Playlist`)
          .setDescription(`Added **${targetTrack.title}** by **${targetTrack.artist}** to playlist **${name}**!\nTotal songs: \`${res.count}\``)
          .setColor(0x57f287);

        if (interaction.deferred) await interaction.editReply({ embeds: [embed] });
        else await interaction.reply({ embeds: [embed] });
      } else {
        if (interaction.deferred) await interaction.editReply({ content: `${CE.failure.str} ${res.message}` });
        else await interaction.reply({ content: `${CE.failure.str} ${res.message}`, flags: 1 << 6 });
      }
      return;
    }

    if (sub === "remove") {
      const name = interaction.options.getString("name", true);
      const trackNum = interaction.options.getInteger("track_number", true);
      const res = await removeTrackFromPlaylist(userId, name, trackNum);
      if (res.success) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE.check.str} Track Removed`)
              .setDescription(res.message)
              .setColor(0x57f287),
          ],
        });
      } else {
        await interaction.reply({ content: `${CE.failure.str} ${res.message}`, flags: 1 << 6 });
      }
      return;
    }

    if (sub === "delete") {
      const name = interaction.options.getString("name", true);
      const res = await deletePlaylist(userId, name);
      if (res.success) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE.check.str} Playlist Deleted`)
              .setDescription(res.message)
              .setColor(0xed4245),
          ],
        });
      } else {
        await interaction.reply({ content: `${CE.failure.str} ${res.message}`, flags: 1 << 6 });
      }
      return;
    }

    if (sub === "play") {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: `${CE.failure.str} This command can only be used in a server.`, flags: 1 << 6 });
        return;
      }

      const name = interaction.options.getString("name", true);
      const pl = await getPlaylist(userId, name);
      if (!pl) {
        await interaction.reply({ content: `${CE.failure.str} Playlist **${name}** not found.`, flags: 1 << 6 });
        return;
      }

      if (pl.tracks.length === 0) {
        await interaction.reply({ content: `${CE.warning.str} Playlist **${name}** is empty. Add songs first with \`/playlist add\`!`, flags: 1 << 6 });
        return;
      }

      const callerVoice = await getMemberVoiceChannel(interaction.guild, interaction.user.id);
      if (!callerVoice) {
        await interaction.reply({ content: `${CE.failure.str} You must be connected to a voice channel to play playlists!`, flags: 1 << 6 });
        return;
      }

      await interaction.deferReply();

      const player = getOrCreateMusicPlayer(interaction.guildId, callerVoice, interaction.channel as any);
      const tracksToQueue = [...pl.tracks];

      if (!player.isPlaying) {
        const first = tracksToQueue.shift()!;
        for (const t of tracksToQueue) {
          player.queue.push(t);
        }
        await player.playTrack(first);
      } else {
        for (const t of tracksToQueue) {
          player.queue.push(t);
        }
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.music.str} Loaded Custom Playlist: ${pl.name}`)
            .setDescription(`Queued **${pl.tracks.length} track(s)** in <#${callerVoice.id}>!\n\nUse \`/queue\` to view your upcoming tracks.`)
            .setColor(COLORS.primary),
        ],
      });
      return;
    }
  },
};
