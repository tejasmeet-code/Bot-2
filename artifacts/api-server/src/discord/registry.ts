import type { SlashCommand } from "./types";
import { referralCommand } from "./commands/referral";
import afk from "./commands/afk";
import adduser from "./commands/adduser";
import aiAdmin from "./commands/ai-admin";
import botCheck from "./commands/bot-check";
import announce from "./commands/announce";
import automod from "./commands/automod";
import autorole from "./commands/autorole";
import stats from "./commands/stats";
import userstats from "./commands/userstats";
import rolestats from "./commands/rolestats";
import serverstats from "./commands/serverstats";
import flowstats from "./commands/flowstats";
import topstats from "./commands/topstats";
import channelstats from "./commands/channelstats";
import hourstats from "./commands/hourstats";
import botstats from "./commands/botstats";
import automations from "./commands/automations";
import appeal from "./commands/appeal";
import avatar from "./commands/avatar";
import banRequest from "./commands/ban-request";
import ban from "./commands/ban";
import blacklist from "./commands/blacklist";
import botAdmin from "./commands/bot-admin";
import botAnnounce from "./commands/bot-announce";
import botavatar from "./commands/botavatar";
import gbotavatar from "./commands/gbotavatar";
import botinfo from "./commands/botinfo";
import caseCommand from "./commands/case";
import channelGuess from "./commands/channelGuess";
import channelLock from "./commands/channelLock";
import channelShuffle from "./commands/channelShuffle";
import choice from "./commands/choice";
import closeTicket from "./commands/close-ticket";
import coinflip from "./commands/coinflip";
import config from "./commands/config";
import intro from "./commands/intro";
import connectServers from "./commands/connect-servers";
import connect4 from "./commands/connect4";
import cursedNicknames from "./commands/cursedNicknames";
import customerPoints from "./commands/customer-points";
import demote from "./commands/demote";
import dm from "./commands/dm";
import editCase from "./commands/edit-case";
import eightball from "./commands/eightball";
import emojiChannels from "./commands/emojiChannels";
import fortune from "./commands/fortune";
import globalBackup from "./commands/global-backup";
import hide from "./commands/hide";
import show from "./commands/show";
import guess from "./commands/guess";
import hangman from "./commands/hangman";
import help from "./commands/help";
import higherlower from "./commands/higherlower";
import highfi from "./commands/highfi";
import infraction from "./commands/infraction";
import infractions from "./commands/infractions";
import jail from "./commands/jail";
import kick from "./commands/kick";
import loa from "./commands/loa";
import lock from "./commands/lock";
import maintenance from "./commands/maintenance";
import meme from "./commands/meme";
import modhistory from "./commands/modhistory";
import modstats from "./commands/modstats";
import mute from "./commands/mute";
import nickname from "./commands/nickname";
import noprefix from "./commands/noprefix";
import note from "./commands/note";
import nuke from "./commands/nuke";
import nukeAntiWhitelist from "./commands/nukeAntiWhitelist";
import partnershipScore from "./commands/partnership-score";
import partnership from "./commands/partnership";
import ping from "./commands/ping";
import oping from "./commands/oping";
import poll from "./commands/poll";
import postProof from "./commands/post-proof";
import preset from "./commands/preset";
import privateTicket from "./commands/private-ticket";
import promote from "./commands/promote";
import pull from "./commands/pull";
import pullable from "./commands/pullable";
import purge from "./commands/purge";
import quota from "./commands/quota";
import randomcolor from "./commands/randomcolor";
import rate from "./commands/rate";
import roleMystery from "./commands/roleMystery";
import roleRainbow from "./commands/roleRainbow";
import rolegive from "./commands/rolegive";
import roleinfo from "./commands/roleinfo";
import roleremove from "./commands/roleremove";
import roll from "./commands/roll";
import rps from "./commands/rps";
import russianroulette from "./commands/russianroulette";
import say from "./commands/say";
import scrambleChannels from "./commands/scrambleChannels";
import scrambleRoles from "./commands/scrambleRoles";
import serverBackup from "./commands/server-backup";
import servercount from "./commands/servercount";
import serverinfo from "./commands/serverinfo";
import setavatar from "./commands/setavatar";
import ship from "./commands/ship";
import shopTopStaff from "./commands/shop-top-staff";
import slots from "./commands/slots";
import slowmode from "./commands/slowmode";
import spooky from "./commands/spooky";
import staffDatabase from "./commands/staff-database";
import staffHistory from "./commands/staff-history";
import staffProfile from "./commands/staff-profile";
import staffReport from "./commands/staff-report";
import staffRoleAdd, { removeCommand as staffRoleRemove } from "./commands/staff-role-add";
import staffRoles from "./commands/staff-roles";
import staffShopScore from "./commands/staff-shop-score";
import staffUpdateReport from "./commands/staff-update-report";
import tictactoe from "./commands/tictactoe";
import timeout from "./commands/timeout";
import trivia from "./commands/trivia";
import unbanAll from "./commands/unban-all";
import unban from "./commands/unban";
import unclaim from "./commands/unclaim";
import unjail from "./commands/unjail";
import unlock from "./commands/unlock";
import unmute from "./commands/unmute";
import untimeout from "./commands/untimeout";
import unwarn from "./commands/unwarn";
import upsideDown from "./commands/upsideDown";
import userinfo from "./commands/userinfo";
import vcdeafen from "./commands/vcdeafen";
import vckick from "./commands/vckick";
import vcmove from "./commands/vcmove";
import vcmute from "./commands/vcmute";
import verifyConfig from "./commands/verify-config";
import verifyOwnerCommands from "./commands/verify-owner-commands";
import antinuke from "./commands/antinuke";
import welcomerCommand from "./commands/welcomer";
import loggingCommand from "./commands/logging";
import prefixCommand from "./commands/prefix";
import setupWizardCommand from "./commands/setupWizard";
import autoReactCommand from "./commands/autoReact";
import autotestCommand from "./commands/autotest";
import { premiumCheckCommand } from "./commands/premiumCheck";
import verify from "./commands/verify";
import verifyOwner from "./commands/verifyOwner";
import warn from "./commands/warn";
import whitelistGlobal from "./commands/whitelist-global";
import whitelist from "./commands/whitelist";
import whitelistAll from "./commands/whitelistAll";
import wordscramble from "./commands/wordscramble";
import wouldyourather from "./commands/wouldyourather";
import giveaway from "./commands/giveaway";
import rank from "./commands/rank";
import leaderboard from "./commands/leaderboard";
import giveXp from "./commands/give-xp";
import responseChannel from "./commands/response-channel";
import supabasestatus from "./commands/supabasestatus";
import evalCmd from "./commands/eval";
import serverlist from "./commands/serverlist";
import leaveserver from "./commands/leaveserver";
import broadcast from "./commands/broadcast";
import {
  playCommand,
  searchCommand,
  skipCommand,
  pauseCommand,
  resumeCommand,
  stopCommand,
  queueCommand,
  clearQueueCommand,
  volumeCommand,
  loopCommand,
  autoplayCommand,
  equalizerCommand,
  bassboostCommand,
  nowPlayingCommand,
  speedCommand,
  twentyFourSevenCommand,
  musicPanelCommand,
  panelCommand,
  seekCommand,
  skipToCommand,
  shuffleCommand,
  removeCommand,
  moveCommand,
  sourceCommand,
} from "./commands/music";
import { lyricsCommand } from "./commands/lyrics";
import { playlistCommand } from "./commands/playlist";
import { djCommand } from "./commands/dj";
import { profileCommand, setbioCommand, noprefixCommand } from "./commands/profile";
import { ginfoCommand } from "./commands/ginfo";
import { checkstaffCommand } from "./commands/checkstaff";
import {
  badgesCommand,
  badgesListCommand,
  badgesAddCommand,
  badgesRemoveCommand,
  badgesAllCommand,
  badgesRemoveAllCommand,
} from "./commands/badges";
import { premiumCommand, premiumPanelCommand, premiumListCommand } from "./commands/premium";

import {
  serverOwnerCommand,
  serverAdminCommand,
  trustedCommand,
} from "./commands/serverWhitelist";
import { botStaffCommand } from "./commands/botStaff";
import { botWhitelistCommand } from "./commands/botWhitelist";
import hostingCommand from "./commands/hosting";
import { globalAutoReactCommand } from "./commands/globalAutoReact";
import { roleCommand } from "./commands/role";
import { channelCommand } from "./commands/channel";
import { categoryCommand } from "./commands/category";
import { emojiCommand } from "./commands/emoji";
import { stickerCommand } from "./commands/sticker";
import botStatusCommands from "./commands/botstatus";

const allCommands: SlashCommand[] = [
  ...botStatusCommands,
  premiumCommand,
  premiumPanelCommand,
  premiumListCommand,
  badgesRemoveAllCommand,
  premiumCheckCommand,
  // ── Critical & Newest Features (always top priority for slash commands) ──
  setupWizardCommand,
  welcomerCommand,
  loggingCommand,
  prefixCommand,
  roleCommand,
  channelCommand,
  categoryCommand,
  emojiCommand,
  stickerCommand,
  botStaffCommand,
  botWhitelistCommand,
  autotestCommand,
  hostingCommand,
  globalAutoReactCommand,
  autoReactCommand,
  serverOwnerCommand,
  serverAdminCommand,
  trustedCommand,
  oping,
  profileCommand,
  setbioCommand,
  noprefixCommand,
  ginfoCommand,
  checkstaffCommand,
  sourceCommand,
  responseChannel,
  config,
  hide,
  show,
  automod,
  antinuke,
  autorole,
  stats,
  userstats,
  rolestats,
  serverstats,
  flowstats,
  topstats,
  channelstats,
  hourstats,
  botstats,
  maintenance,
  giveaway,
  help,
  playCommand,
  searchCommand,
  twentyFourSevenCommand,
  panelCommand,
  musicPanelCommand,
  lyricsCommand,
  playlistCommand,
  djCommand,
  seekCommand,
  skipToCommand,
  shuffleCommand,
  removeCommand,
  moveCommand,
  stopCommand,
  queueCommand,
  skipCommand,
  pauseCommand,
  resumeCommand,
  clearQueueCommand,
  volumeCommand,
  loopCommand,
  autoplayCommand,
  equalizerCommand,
  bassboostCommand,
  nowPlayingCommand,
  speedCommand,
  whitelist,
  verifyOwner,
  verify,
  botAdmin,
  botAnnounce,
  announce,
  // ── Moderation & Server Administration ──
  ban,
  unban,
  kick,
  mute,
  unmute,
  timeout,
  untimeout,
  warn,
  unwarn,
  jail,
  unjail,
  lock,
  unlock,
  purge,
  slowmode,
  caseCommand,
  modhistory,
  modstats,
  infractions,
  infraction,
  appeal,
  blacklist,
  // ── Staff Management & Quota ──
  quota,
  promote,
  demote,
  partnership,
  loa,
  staffRoles,
  staffRoleAdd,
  staffRoleRemove,
  staffReport,
  staffProfile,
  // ── Economy, Levels & Utilities ──
  rank,
  leaderboard,
  giveXp,
  ping,
  botinfo,
  serverinfo,
  userinfo,
  botavatar,
  gbotavatar,
  avatar,
  dm,
  poll,
  rolegive,
  roleremove,
  roleinfo,
  note,
  nuke,
  connectServers,
  automations,
  globalBackup,
  serverBackup,
  // ── Remaining Commands (prefix accessible or lower priority slash) ──
  afk,
  adduser,
  aiAdmin,
  botCheck,
  banRequest,
  channelGuess,
  channelLock,
  channelShuffle,
  choice,
  closeTicket,
  coinflip,
  connect4,
  cursedNicknames,
  customerPoints,
  editCase,
  eightball,
  emojiChannels,
  fortune,
  guess,
  hangman,
  higherlower,
  highfi,
  intro,
  meme,
  nickname,
  noprefix,
  nukeAntiWhitelist,
  partnershipScore,
  postProof,
  preset,
  privateTicket,
  pull,
  pullable,
  randomcolor,
  rate,
  roleMystery,
  roleRainbow,
  roll,
  rps,
  russianroulette,
  say,
  scrambleChannels,
  scrambleRoles,
  servercount,
  setavatar,
  ship,
  shopTopStaff,
  slots,
  spooky,
  staffDatabase,
  staffHistory,
  staffShopScore,
  staffUpdateReport,
  tictactoe,
  trivia,
  unbanAll,
  unclaim,
  upsideDown,
  vcdeafen,
  vckick,
  vcmove,
  vcmute,
  verifyConfig,
  verifyOwnerCommands,
  whitelistGlobal,
  whitelistAll,
  wordscramble,
  wouldyourather,
  supabasestatus,
  evalCmd,
  serverlist,
  leaveserver,
  broadcast,
  badgesCommand,
  badgesListCommand,
  badgesAddCommand,
  badgesRemoveCommand,
  badgesAllCommand,
  referralCommand,
];

// Discord allows max 100 application commands per scope. The old registry was
// sending 140+ commands because it generated one /whitelist-<command> command
// for every moderation command. That makes Discord reject the entire bulk
// update, so nothing appears. Keep /whitelist as the single manager command and
// keep lower-priority prank/game commands out of slash registration.
const REGISTRATION_EXCLUDED_COMMAND_NAMES = new Set([
  // prank / chaos commands (keep handlers but hide from slash autocomplete)
  "channel-shuffle",
  "cursed-nicknames",
  "emoji-channels",
  "role-mystery",
  "role-rainbow",
  "russianroulette",
  "scramble-channels",
  "scramble-roles",
  "slots",
  "spooky",   // legacy name kept in case
  "theme",    // spooky.ts was renamed to "theme"
  "upside-down",
  "wordscramble",
  // trivia / quiz
  "trivia",
  // game commands
  "connect4",
  "hangman",
  "higherlower",
  "guess",
  "channel-guess",
  // pure fun / social commands
  "choice",
  "coinflip",
  "fortune",
  "meme",
  "randomcolor",
  "rate",
  "roll",
  "rps",
  "tictactoe",
  "wouldyourather",
  "8ball",
  "ship",
  // low-priority utility / prefix-only fallback commands
  "adduser",
  "server-backup",
  "global-backup",
  "afk",
  "intro",
  "setavatar",
  "say",
  "partnership-score",
  "shop-top-staff",
  "customer-points",
  "bot-check",
  "channel-lock",
  "close-ticket",
  "private-ticket",
  "edit-case",
  "nuke-anti-whitelist",
  "post-proof",
  "preset",
  "pullable",
  "staff-database",
  "staff-history",
  "staff-update-report",
  "vcdeafen",
  "vckick",
  "vcmove",
  "vcmute",
  "unban-all",
  "unclaim",
  "verify-config",
  "verify-owner-commands",
  "whitelist-all",
  "whitelist-global",
  // Superseded by comprehensive /role, /channel, /category, /emoji, /sticker commands (still usable via prefix)
  "rolegive",
  "roleremove",
  "roleinfo",
  "rolemystery",
  "rolerainbow",
  "emojichannels",
  "channelguess",
  "channelshuffle",
  "scramblechannels",
  "scrambleroles",
  "wordscramble",
  "guess",
  "hangman",
  "higherlower",
  "connect4",
  "trivia",
  "russianroulette",
  "slots",
  "spooky",
  "cursednicknames",
  "upsidedown",
  "staff-shop-score",
  "pull",
  "servercount",
  "ban-request",
  // Sub-music controls (available via prefix, no-prefix, and interactive UI buttons)
  "speed",
  "loop",
  "autoplay",
  "clearqueue",
  "nowplaying",
  "volume",
  "pause",
  "resume",
  "skip",
  // Badge subcommands (already fully accessible via /badges <view|list|add|remove|all>)
  "badgeslist",
  "badgesadd",
  "badgesremove",
  "badgesall",
  "staff-role-remove",
  "ai-admin",
  "highfi",
  "theme",
  "connect-servers",
  "bot-admins",
  "noprefix",
  // Owner diagnostic & management tools (prefix executable, excluded from 100 limit)
  "eval",
  "supabasestatus",
  "serverlist",
  "leaveserver",
  "broadcast",
  // Standalone prefix-executable stats suite (never inflate slash limit)
  "userstats",
  "rolestats",
  "serverstats",
  "flowstats",
  "topstats",
  "channelstats",
  "hourstats",
  "botstats",
  "hide",
  "show",
]);

// Dedupe by command name as a safety net: Discord rejects the entire bulk
// command payload if any two commands share a name, which silently breaks
// EVERY command registration. Keep the first occurrence and warn about dupes.
const seen = new Set<string>();
const commands: SlashCommand[] = [];
const startupErrors: string[] = [];

for (let i = 0; i < allCommands.length; i++) {
  const cmd = allCommands[i];
  if (!cmd) {
    console.error(`[registry] WARNING: Command at index ${i} is undefined. This is likely due to a circular import or missing default export in command files.`);
    continue;
  }
  if (!cmd.data || !cmd.data.name) {
    console.error(`[registry] WARNING: Command at index ${i} is missing cmd.data or cmd.data.name!`, cmd);
    continue;
  }
  const name = cmd.data.name.toLowerCase();
  if (seen.has(name)) {
    startupErrors.push(`Duplicate command name detected: "${name}"`);
    continue;
  }
  seen.add(name);
  commands.push(cmd);
}

// Check for duplicate or conflicting aliases at startup
import { COMMAND_ALIASES } from "./utils/commandAliases";
const seenAliases = new Set<string>();
for (const [alias, canonical] of Object.entries(COMMAND_ALIASES)) {
  const lowerAlias = alias.toLowerCase();
  if (seen.has(lowerAlias) && lowerAlias !== canonical.toLowerCase()) {
    console.warn(`[registry] Alias Conflict: alias "${lowerAlias}" overrides canonical command "${canonical}". This is an intentional override.`);
  }
  if (seenAliases.has(lowerAlias)) {
    console.warn(`[registry] Duplicate Alias: alias "${lowerAlias}" is registered multiple times.`);
  }
  seenAliases.add(lowerAlias);
}

export function getCommands(): SlashCommand[] {
  return commands;
}

export function getGlobalCommands(): SlashCommand[] {
  return commands.filter((cmd) => cmd.globalOnly && !cmd.globalWhitelistOnly);
}

export function getGuildCommands(): SlashCommand[] {
  const seenNames = new Set<string>();
  const filtered: SlashCommand[] = [];
  for (const cmd of commands) {
    if (cmd.globalOnly || cmd.globalWhitelistOnly) continue;
    const name = cmd.data.name.toLowerCase();
    if (REGISTRATION_EXCLUDED_COMMAND_NAMES.has(name) || REGISTRATION_EXCLUDED_COMMAND_NAMES.has(cmd.data.name)) continue;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    filtered.push(cmd);
  }
  if (filtered.length > 95) {
    return filtered.slice(0, 95);
  }
  return filtered;
}

export function getCommandMap(): Map<string, SlashCommand> {
  const map = new Map<string, SlashCommand>();
  for (const cmd of commands) {
    map.set(cmd.data.name, cmd);
  }
  return map;
}

