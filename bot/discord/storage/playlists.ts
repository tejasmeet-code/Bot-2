import { dataFile } from "../../lib/paths";
import { logger } from "../../lib/logger";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import type { Track } from "../music/musicManager";

export interface CustomPlaylist {
  name: string;
  userId: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistStore {
  // key: `${userId}:${normalizedPlaylistName}`
  playlists: Record<string, CustomPlaylist>;
}

const STORE = "playlist_store";
const FILE = () => dataFile("playlist_store.json");

let cache: PlaylistStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function getStore(): Promise<PlaylistStore> {
  if (cache) return cache;
  try {
    const raw = await loadPersistentJson<PlaylistStore>(STORE, FILE(), { playlists: {} });
    cache = raw;
  } catch (err) {
    logger.warn({ err }, "Failed to load playlist store, initializing empty");
    cache = { playlists: {} };
  }
  return cache!;
}

async function saveStore(): Promise<void> {
  if (!cache) return;
  const snapshot = JSON.parse(JSON.stringify(cache));
  writeQueue = writeQueue.then(async () => {
    try {
      await persistPersistentJson(STORE, FILE(), snapshot);
    } catch (err) {
      logger.error({ err }, "Failed to persist playlist store");
    }
  });
  await writeQueue;
}

export async function getUserPlaylists(userId: string): Promise<CustomPlaylist[]> {
  const store = await getStore();
  return Object.values(store.playlists).filter((p) => p.userId === userId);
}

export async function getPlaylist(userId: string, name: string): Promise<CustomPlaylist | null> {
  const store = await getStore();
  const key = `${userId}:${name.trim().toLowerCase()}`;
  return store.playlists[key] || null;
}

export async function createPlaylist(userId: string, name: string): Promise<{ success: boolean; message: string; playlist?: CustomPlaylist }> {
  const store = await getStore();
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 40) {
    return { success: false, message: "Playlist name must be between 1 and 40 characters." };
  }

  const userLists = await getUserPlaylists(userId);
  if (userLists.length >= 25) {
    return { success: false, message: "You have reached the maximum limit of 25 playlists." };
  }

  const key = `${userId}:${cleanName.toLowerCase()}`;
  if (store.playlists[key]) {
    return { success: false, message: `A playlist named **${cleanName}** already exists!` };
  }

  const playlist: CustomPlaylist = {
    name: cleanName,
    userId,
    tracks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  store.playlists[key] = playlist;
  await saveStore();
  return { success: true, message: `Playlist **${cleanName}** created successfully!`, playlist };
}

export async function addTrackToPlaylist(userId: string, name: string, track: Track): Promise<{ success: boolean; message: string; count: number }> {
  const store = await getStore();
  const key = `${userId}:${name.trim().toLowerCase()}`;
  const playlist = store.playlists[key];
  if (!playlist) {
    return { success: false, message: `Playlist **${name}** was not found. Create it first with \`/playlist create <name>\`!`, count: 0 };
  }

  if (playlist.tracks.length >= 150) {
    return { success: false, message: "This playlist is full (maximum 150 tracks).", count: playlist.tracks.length };
  }

  playlist.tracks.push(track);
  playlist.updatedAt = Date.now();
  await saveStore();

  return {
    success: true,
    message: `Added **${track.title}** by **${track.artist}** to playlist **${playlist.name}**!`,
    count: playlist.tracks.length,
  };
}

export async function removeTrackFromPlaylist(userId: string, name: string, index1Based: number): Promise<{ success: boolean; message: string; removedTrack?: Track }> {
  const store = await getStore();
  const key = `${userId}:${name.trim().toLowerCase()}`;
  const playlist = store.playlists[key];
  if (!playlist) {
    return { success: false, message: `Playlist **${name}** not found.` };
  }

  const idx = index1Based - 1;
  if (idx < 0 || idx >= playlist.tracks.length) {
    return { success: false, message: `Invalid track number #${index1Based}. Playlist has ${playlist.tracks.length} tracks.` };
  }

  const [removed] = playlist.tracks.splice(idx, 1);
  playlist.updatedAt = Date.now();
  await saveStore();

  return {
    success: true,
    message: `Removed **${removed.title}** (#${index1Based}) from playlist **${playlist.name}**.`,
    removedTrack: removed,
  };
}

export async function deletePlaylist(userId: string, name: string): Promise<{ success: boolean; message: string }> {
  const store = await getStore();
  const key = `${userId}:${name.trim().toLowerCase()}`;
  if (!store.playlists[key]) {
    return { success: false, message: `Playlist **${name}** not found.` };
  }

  delete store.playlists[key];
  await saveStore();
  return { success: true, message: `Playlist **${name}** has been deleted.` };
}
