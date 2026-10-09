import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getMusicPlayer } from "../music/musicManager";
import { fetchLyrics } from "../music/lyricsService";
import { CE, COLORS } from "../utils/embedStyle";

export const lyricsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Fetch and display formatted lyrics for current song or a search query")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song title and artist (optional, defaults to now playing)").setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    let query = interaction.options.getString("query")?.trim();
    const player = interaction.guildId ? getMusicPlayer(interaction.guildId) : undefined;

    let targetTitle = query;
    let targetArtist = "";
    let durationSeconds: number | undefined;

    if (!targetTitle) {
      if (!player?.currentTrack) {
        await interaction.reply({
          content: `${CE.warning.str} No track is currently playing. Provide a search query like \`/lyrics <song>\`!`,
          flags: 1 << 6,
        });
        return;
      }
      targetTitle = player.currentTrack.title;
      targetArtist = player.currentTrack.artist;
      durationSeconds = player.currentTrack.durationSeconds;
    }

    await interaction.deferReply();

    const result = await fetchLyrics(targetTitle, targetArtist, durationSeconds);

    if (!result || (!result.plainLyrics && !result.syncedLyrics)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.failure.str} Lyrics Not Found`)
            .setDescription(`Could not find lyrics for **${targetTitle}**${targetArtist ? ` by **${targetArtist}**` : ""}. Try specifying the exact artist name!`)
            .setColor(0xed4245),
        ],
      });
      return;
    }

    const lyricsContent = result.plainLyrics || result.syncedLyrics || "";
    const isSynced = Boolean(result.syncedLyrics && !result.plainLyrics);

    // Split into chunks if longer than 3900 chars
    const chunks: string[] = [];
    const lines = lyricsContent.split("\n");
    let currentChunk = "";

    for (const line of lines) {
      if ((currentChunk + "\n" + line).length > 3500) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Lyrics: ${result.title}`)
      .setAuthor({ name: result.artist })
      .setColor(COLORS.primary)
      .setDescription(chunks[0])
      .setFooter({ text: `Source: ${result.source} • ${isSynced ? "Synced Timestamps" : "Plain Lyrics"}` })
      .setTimestamp();

    if (player?.currentTrack?.thumbnailUrl) {
      embed.setThumbnail(player.currentTrack.thumbnailUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
