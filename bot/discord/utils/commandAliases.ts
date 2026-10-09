import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Message,
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import type { SlashCommand } from "../types";
import { CE, COLORS } from "./embedStyle";

/**
 * Global map of command aliases to canonical command names.
 * Supports prefix commands (.b, .m, .an) and no-prefix commands (b, m, an).
 */
export const COMMAND_ALIASES: Record<string, string> = {
  // ── Moderation ─────────────────────────────────────────────────────────────
  "b": "ban",
  "ban": "ban",
  "shooter": "ban",
  "shooters": "ban",
  "shoot": "ban",
  "shot": "ban",
  "massban": "ban",
  "mb": "ban",
  "ub": "unban",
  "unban": "unban",
  "unbanall": "unban-all",
  "unban-all": "unban-all",
  "k": "kick",
  "kick": "kick",
  "m": "mute",
  "mute": "mute",
  "to": "mute",
  "timeout": "mute",
  "um": "unmute",
  "unmute": "unmute",
  "uto": "unmute",
  "untimeout": "unmute",
  "w": "warn",
  "warn": "warn",
  "uw": "unwarn",
  "unwarn": "unwarn",
  "clear": "purge",
  "prune": "purge",
  "clean": "purge",
  "purge": "purge",
  "l": "lock",
  "lock": "lock",
  "ul": "unlock",
  "unlock": "unlock",
  "sm": "slowmode",
  "slowmode": "slowmode",
  "j": "jail",
  "jail": "jail",
  "uj": "unjail",
  "unjail": "unjail",
  "case": "case",
  "modhistory": "modhistory",
  "modlogs": "modhistory",
  "modstats": "modstats",

  // ── Anti-Nuke & Security ──────────────────────────────────────────────────
  "an": "antinuke",
  "antinuke": "antinuke",
  "antink": "antinuke",
  "antinuker": "antinuke",
  "am": "automod",
  "automod": "automod",
  "wl": "whitelist",
  "whitelist": "whitelist",
  "globalbackup": "global-backup",

  // ── Setup & Configuration ─────────────────────────────────────────────────
  "st": "setup",
  "setup": "setup",
  "wizard": "setup",
  "cfg": "config",
  "config": "config",
  "settings": "config",
  "pref": "config",
  "preferences": "config",
  "botmaintenance": "botmaintenance",
  "botmaintainence": "botmaintenance",
  "botdown": "botdown",
  "botnormal": "botnormal",

  // ── Info & Utility ────────────────────────────────────────────────────────
  "h": "help",
  "help": "help",
  "cmds": "help",
  "commands": "help",
  "ping": "ping",
  "latency": "ping",
  "oping": "oping",
  "ownerping": "oping",
  "checkstaff": "checkstaff",
  "cstaff": "checkstaff",
  "isstaff": "checkstaff",
  "staffcheck": "checkstaff",
  "bi": "botinfo",
  "botinfo": "botinfo",
  "stats": "botinfo",
  "info": "botinfo",
  "ginfo": "ginfo",
  "gi": "ginfo",
  "globalinfo": "ginfo",
  "auditinfo": "ginfo",
  "si": "serverinfo",
  "serverinfo": "serverinfo",
  "guildinfo": "serverinfo",
  "ui": "userinfo",
  "userinfo": "userinfo",
  "whois": "userinfo",
  "av": "avatar",
  "avatar": "avatar",
  "pfp": "avatar",
  "ann": "announce",
  "announce": "announce",
  "gw": "giveaway",
  "giveaway": "giveaway",
  "gstart": "giveaway",
  "maint": "maintenance",
  "maintenance": "maintenance",
  "poll": "poll",
  "afk": "afk",
  "rank": "rank",
  "leaderboard": "leaderboard",
  "lb": "leaderboard",

  // ── Bot Owner & Diagnostics ───────────────────────────────────────────────
  "db": "supabasestatus",
  "database": "supabasestatus",
  "supabase": "supabasestatus",
  "supabasestatus": "supabasestatus",
  "eval": "eval",
  "e": "eval",
  "serverlist": "serverlist",
  "servers": "serverlist",
  "guilds": "serverlist",
  "leaveserver": "leaveserver",
  "broadcast": "broadcast",
  "bc": "broadcast",
  "hosting": "hosting",
  "conflicts": "hosting",
  "checkhost": "hosting",
  "host": "hosting",
  "hosting-health": "hosting",

  // ── Music ─────────────────────────────────────────────────────────────────
  "play": "play",
  "p": "play",
  "skip": "skip",
  "s": "skip",
  "fs": "skip",
  "pause": "pause",
  "resume": "resume",
  "stop": "stop",
  "dc": "stop",
  "leave": "stop",
  "q": "queue",
  "queue": "queue",
  "vol": "volume",
  "v": "volume",
  "volume": "volume",
  "lp": "loop",
  "loop": "loop",
  "repeat": "loop",
  "ap": "autoplay",
  "autoplay": "autoplay",
  "cq": "clearqueue",
  "clearq": "clearqueue",
  "clearqueue": "clearqueue",
  "eq": "equalizer",
  "equalizer": "equalizer",
  "filter": "equalizer",
  "filters": "equalizer",
  "bass": "bassboost",
  "bassboost": "bassboost",
  "bb": "bassboost",
  "nightcore": "equalizer",
  "vaporwave": "equalizer",
  "8d": "equalizer",
  "np": "nowplaying",
  "song": "nowplaying",
  "nowplaying": "nowplaying",
  "lyrics": "lyrics",
  "ly": "lyrics",
  "lyric": "lyrics",
  "pl": "playlist",
  "playlist": "playlist",
  "playlists": "playlist",
  "dj": "dj",
  "247": "twentyfourseven",
  "24/7": "twentyfourseven",
  "24-7": "twentyfourseven",
  "twentyfourseven": "twentyfourseven",
  "radio": "twentyfourseven",
  "seek": "seek",
  "ff": "seek",
  "skipto": "skipto",
  "spto": "skipto",
  "jump": "skipto",
  "shuffle": "shuffle",
  "sh": "shuffle",
  "shuff": "shuffle",
  "rm": "remove",
  "remove": "remove",
  "del": "remove",
  "mv": "move",
  "move": "move",
  "speed": "speed",
  "tempo": "speed",
  "stay": "twentyfourseven",
  "panel": "panel",
  "source": "source",
  "src": "source",
  "changesource": "source",
  "mirrors": "source",
  "musicpanel": "panel",
  "music": "panel",
  "mcontrol": "panel",
  "mplayer": "panel",
  "player": "panel",
  "music-panel": "panel",

  // ── Profile & Customization ─────────────────────────────────────────────
  "profile": "profile",
  "prof": "profile",
  "pcard": "profile",
  "setbio": "setbio",
  "bio": "setbio",
  "noprefix": "noprefix",
  "npf": "noprefix",
  "botavatar": "botavatar",
  "bot-avatar": "botavatar",
  "botname": "botavatar",
  "bot-name": "botavatar",
  "serverbotavatar": "botavatar",
  "serverbotname": "botavatar",
  "botprofile": "botavatar",

  // ── Premium ───────────────────────────────────────────────────────────────
  "prem": "premium",
  "premium": "premium",
  "vip": "premium",
  "prempanel": "premium-panel",
  "premiumpanel": "premium-panel",
  "prem-panel": "premium-panel",
  "premgive": "premium-give",
  "premiumgive": "premium-give",
  "giveprem": "premium-give",
  "givepremium": "premium-give",
  "premiumcheck": "premiumcheck",
  "premcheck": "premiumcheck",
  "pcheck": "premiumcheck",
  "checkpremium": "premiumcheck",
  "checkprem": "premiumcheck",

  // ── Server Whitelist & Auto-React ──────────────────────────────────────────
  "serverowner": "serverowner",
  "so": "serverowner",
  "server-owner": "serverowner",
  "serveradmin": "serveradmin",
  "sa": "serveradmin",
  "server-admin": "serveradmin",
  "trusted": "trusted",
  "trust": "trusted",
  "autoreact": "auto-react",
  "auto-react": "auto-react",
  "ar": "auto-react",

  // ── Global Auto-React (Owner & Co-Owner) ───────────────────────────────────
  "globalautoreact": "globalautoreact",
  "global-autoreact": "globalautoreact",
  "globalauto-react": "globalautoreact",
  "globalreact": "globalautoreact",
  "gar": "globalautoreact",
  "gautoreact": "globalautoreact",
  "gareact": "globalautoreact",

  // ── Bot Staff Management ───────────────────────────────────────────────────
  "botstaff": "botstaff",
  "bot-staff": "botstaff",
  "botstaffpanel": "botstaff",
  "bot-staff-panel": "botstaff",
  "staffpanel": "botstaff",
  "bspanel": "botstaff",
  "bsp": "botstaff",

  // ── Specialized Bot & Role Whitelists ──────────────────────────────────────
  "botwhitelist": "botwhitelist",
  "botwl": "botwhitelist",
  "bw": "botwhitelist",
  "adminbots": "botwhitelist",
  "adminbot": "botwhitelist",
  "commonbots": "botwhitelist",
  "commonbot": "botwhitelist",
  "ticketbot": "botwhitelist",
  "ticketbots": "botwhitelist",
  "staffmanagement": "botwhitelist",
  "staffmangement": "botwhitelist",
  "staffmanagementbot": "botwhitelist",
  "staffbot": "botwhitelist",
  "musicbot": "botwhitelist",
  "musicbots": "botwhitelist",
  "welcomerbot": "botwhitelist",
  "welcomer": "botwhitelist",
  "welcomebot": "botwhitelist",
  "loggingbot": "botwhitelist",
  "logbot": "botwhitelist",
  "loggerbot": "botwhitelist",
  "moderationbot": "botwhitelist",
  "modbot": "botwhitelist",
  "antinukebot": "botwhitelist",
  "securitybot": "botwhitelist",

  // ── Role, Channel, Category, Emoji, Sticker Management ────────────────────
  "role": "role",
  "roles": "role",
  "r": "role",
  "channel": "channel",
  "channels": "channel",
  "channela": "channel",
  "ch": "channel",
  "category": "category",
  "categories": "category",
  "cat": "category",
  "emoji": "emoji",
  "emojis": "emoji",
  "emote": "emoji",
  "emotes": "emoji",
  "sticker": "sticker",
  "stickers": "sticker",
};

/**
 * Subcommand aliases for specific parent commands.
 * Allows .an st to translate to antinuke setup, etc.
 */
export const SUBCOMMAND_ALIASES: Record<string, Record<string, string>> = {
  "antinuke": {
    "st": "setup",
    "set": "setup",
    "setup": "setup",
    "init": "setup",
    "stat": "status",
    "status": "status",
    "info": "status",
    "wl": "whitelist",
    "whitelist": "whitelist",
    "on": "enable",
    "enable": "enable",
    "off": "disable",
    "disable": "disable",
  },
  "automod": {
    "st": "setup",
    "setup": "setup",
    "stat": "status",
    "status": "status",
    "cfg": "config",
    "config": "config",
  },
  "config": {
    "wiz": "wizard",
    "st": "wizard",
    "setup": "wizard",
  },
  "dj": {
    "st": "status",
    "status": "status",
    "info": "status",
    "view": "status",
    "set": "role",
    "role": "role",
    "add": "role",
    "grant": "role",
    "tog": "toggle",
    "toggle": "toggle",
    "on": "toggle",
    "off": "toggle",
    "enable": "toggle",
    "disable": "toggle",
  },
  "giveaway": {
    "s": "start",
    "st": "start",
    "start": "start",
    "end": "end",
    "reroll": "reroll",
  },
  "globalautoreact": {
    "st": "panel",
    "panel": "panel",
    "list": "list",
    "show": "list",
    "add": "add",
    "create": "add",
    "new": "add",
    "del": "remove",
    "delete": "remove",
    "remove": "remove",
    "rm": "remove",
    "toggle": "toggle",
    "tog": "toggle",
    "on": "enable",
    "enable": "enable",
    "off": "disable",
    "disable": "disable",
    "clear": "clear",
    "reset": "clear",
  },
  "botstaff": {
    "panel": "panel",
    "p": "panel",
    "view": "panel",
    "show": "panel",
    "st": "panel",
    "set": "set",
    "add": "set",
    "appoint": "set",
    "give": "set",
    "remove": "remove",
    "rem": "remove",
    "del": "remove",
    "delete": "remove",
    "rm": "remove",
    "list": "list",
    "ls": "list",
    "all": "list",
  },
  "role": {
    "c": "create",
    "create": "create",
    "new": "create",
    "make": "create",
    "e": "edit",
    "edit": "edit",
    "mod": "edit",
    "update": "edit",
    "d": "delete",
    "del": "delete",
    "delete": "delete",
    "add": "add",
    "give": "add",
    "rm": "remove",
    "remove": "remove",
    "take": "remove",
    "ls": "list",
    "list": "list",
    "all": "list",
  },
  "channel": {
    "c": "create",
    "create": "create",
    "new": "create",
    "make": "create",
    "e": "edit",
    "edit": "edit",
    "mod": "edit",
    "update": "edit",
    "d": "delete",
    "del": "delete",
    "delete": "delete",
    "rm": "remove",
    "remove": "remove",
    "ls": "list",
    "list": "list",
    "all": "list",
  },
  "category": {
    "c": "create",
    "create": "create",
    "new": "create",
    "make": "create",
    "e": "edit",
    "edit": "edit",
    "update": "edit",
    "d": "delete",
    "del": "delete",
    "delete": "delete",
    "rm": "remove",
    "remove": "remove",
    "ls": "list",
    "list": "list",
    "all": "list",
  },
  "emoji": {
    "c": "create",
    "create": "create",
    "new": "create",
    "upload": "create",
    "add": "create",
    "e": "edit",
    "edit": "edit",
    "rename": "edit",
    "d": "delete",
    "del": "delete",
    "delete": "delete",
    "rm": "remove",
    "remove": "remove",
    "ls": "list",
    "list": "list",
    "all": "list",
  },
  "sticker": {
    "c": "create",
    "create": "create",
    "new": "create",
    "upload": "create",
    "add": "create",
    "e": "edit",
    "edit": "edit",
    "update": "edit",
    "d": "delete",
    "del": "delete",
    "delete": "delete",
    "rm": "remove",
    "remove": "remove",
    "ls": "list",
    "list": "list",
    "all": "list",
  },
};

/**
 * Checks if a token is a command info request flag (-info, --info, -help, etc.)
 */
export function isInfoFlag(token?: string): boolean {
  if (!token) return false;
  const lower = token.toLowerCase().trim();
  return (
    lower === "-info" ||
    lower === "--info" ||
    lower === "-i" ||
    lower === "-help" ||
    lower === "--help" ||
    lower === "—info" ||
    lower === "–info" ||
    lower === "-information" ||
    lower === "--information" ||
    lower.endsWith("-info") ||
    lower.endsWith("—info") ||
    lower.endsWith("–info")
  );
}

/**
 * Resolve a command token and its arguments, handling aliases, subcommand shortcuts, and info flags.
 */
export function resolveCommandAndArgs(
  rawCmd: string,
  rawArgs: string[],
): {
  canonicalName: string | null;
  resolvedArgs: string[];
  isInfo: boolean;
} {
  let isInfo = false;
  let cleanCmd = rawCmd.toLowerCase();

  // Check if command ends with -info (e.g. .ban-info, .an-info, .help-info)
  if (cleanCmd.endsWith("-info") || cleanCmd.endsWith("—info") || cleanCmd.endsWith("–info")) {
    isInfo = true;
    cleanCmd = cleanCmd.replace(/[-—–]info$/, "");
  }

  // Check if any argument is -info / --info or variations
  const infoMatches = rawArgs.filter(isInfoFlag);
  if (infoMatches.length > 0) {
    isInfo = true;
    rawArgs = rawArgs.filter((a) => !isInfoFlag(a));
  }

  let canonicalName = COMMAND_ALIASES[cleanCmd] || cleanCmd;
  let resolvedArgs = [...rawArgs];

  // Specific routing for composite commands like .premium panel / .prem panel
  if (canonicalName === "premium" && resolvedArgs.length > 0) {
    const sub = resolvedArgs[0].toLowerCase();
    if (sub === "panel" || sub === "p") {
      canonicalName = "premium-panel";
      resolvedArgs = resolvedArgs.slice(1);
    } else if (sub === "give" || sub === "g") {
      canonicalName = "premium-give";
      resolvedArgs = resolvedArgs.slice(1);
    } else if (sub === "user" || sub === "u") {
      canonicalName = "premium-user";
      resolvedArgs = resolvedArgs.slice(1);
    } else if (sub === "server" || sub === "guild" || sub === "s") {
      canonicalName = "premium-server";
      resolvedArgs = resolvedArgs.slice(1);
    } else if (sub === "generate" || sub === "gen") {
      canonicalName = "premium-generate";
      resolvedArgs = resolvedArgs.slice(1);
    } else if (sub === "check" || sub === "status" || sub === "c") {
      canonicalName = "premiumcheck";
      resolvedArgs = resolvedArgs.slice(1);
    }
  }

  // Check subcommand alias mapping for this canonical command
  const subAliases = SUBCOMMAND_ALIASES[canonicalName];
  if (subAliases && resolvedArgs.length > 0) {
    const firstArg = resolvedArgs[0].toLowerCase();
    if (subAliases[firstArg]) {
      resolvedArgs[0] = subAliases[firstArg];
    }
  }

  return {
    canonicalName,
    resolvedArgs,
    isInfo,
  };
}

/**
 * Find all aliases that point to a given canonical command name.
 */
export function getAliasesForCommand(canonicalName: string): string[] {
  const aliases: string[] = [];
  for (const [alias, target] of Object.entries(COMMAND_ALIASES)) {
    if (target === canonicalName && alias !== canonicalName) {
      aliases.push(alias);
    }
  }
  return [...new Set(aliases)];
}

/**
 * Build a Command Info Embed for .(command) -info
 */
export function buildCommandInfoEmbed(command: SlashCommand, requestedName: string): EmbedBuilder {
  const canonical = command.data.name;
  const desc = command.data.description || "No description provided.";
  const aliases = getAliasesForCommand(canonical);

  const aliasText = aliases.length > 0 ? aliases.map((a) => `\`${a}\``).join(", ") : "*None*";

  // Check permissions
  const permValue = (command.data as any).default_member_permissions;
  let permText = "Everyone";
  if (permValue) {
    try {
      const bitfield = BigInt(permValue);
      const permNames: string[] = [];
      if (bitfield & PermissionFlagsBits.Administrator) permNames.push("Administrator");
      if (bitfield & PermissionFlagsBits.ManageGuild) permNames.push("Manage Server");
      if (bitfield & PermissionFlagsBits.ModerateMembers) permNames.push("Moderate Members / Timeout");
      if (bitfield & PermissionFlagsBits.BanMembers) permNames.push("Ban Members");
      if (bitfield & PermissionFlagsBits.KickMembers) permNames.push("Kick Members");
      if (bitfield & PermissionFlagsBits.ManageMessages) permNames.push("Manage Messages");
      if (bitfield & PermissionFlagsBits.ManageRoles) permNames.push("Manage Roles");
      if (bitfield & PermissionFlagsBits.ManageChannels) permNames.push("Manage Channels");
      permText = permNames.length > 0 ? permNames.join(", ") : `Permission Bitfield: ${permValue}`;
    } catch {
      permText = "Staff / Admin Permissions Required";
    }
  }

  // Syntax and shortcuts
  const prefixSyntax = `\`\`\`css\n.${canonical} [options]\n\`\`\``;
  let shortcuts = `• Prefix: \`.${canonical}\`\n• No-Prefix: \`${canonical}\`\n• Slash: \`/${canonical}\``;
  if (aliases.length > 0) {
    shortcuts += `\n• Aliases: ${aliases.map((a) => `\`.${a}\``).join(", ")}`;
  }
  if (canonical === "antinuke") {
    shortcuts += `\n• Subcommand Shortcut: \`.an st\` (Auto Setup & Enable)`;
  } else if (canonical === "setup") {
    shortcuts += `\n• Subcommand Shortcut: \`.st\` / \`.wizard\``;
  } else if (canonical === "play") {
    shortcuts += `\n• Music Shortcut: \`.p <song/query>\``;
  }

  return new EmbedBuilder()
    .setTitle(`${CE.information.str} Command Details: \`${canonical}\``)
    .setColor(COLORS.primary)
    .setDescription(`### ${desc}\n\n${shortcuts}`)
    .addFields(
      { name: "Aliases", value: aliasText, inline: true },
      { name: "Required Permission", value: `\`${permText}\``, inline: true },
      { name: "Syntax", value: prefixSyntax, inline: false },
      {
        name: "Quick Info Flag",
        value: `You can view this info panel at any time by running:\n\`\`\`fix\n.${canonical} -info\n\`\`\``,
        inline: false,
      },
    )
    .setThumbnail("https://cdn-icons-png.flaticon.com/512/4712/4712035.png")
    .setFooter({ text: "Zenith Command Engine • Use .help for full command catalog" })
    .setTimestamp();
}
