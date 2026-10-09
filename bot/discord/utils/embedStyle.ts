import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder, type APIEmbedField, type ColorResolvable } from "discord.js";
import { shouldShowAds, isCurrentContextPremium } from "./botContext";

export const SUPPORT_SERVER_URL = "https://discord.gg/gFgAfpSYdp";
export const BOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1466728565352435847&permissions=8&scope=bot%20applications.commands";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL COMPONENT EMOJI NORMALIZATION:
// Ensures that whether an emoji ID, string, or CustomEmojiEntry is passed to
// ButtonBuilder.setEmoji or StringSelectMenuOptionBuilder.setEmoji, it is
// converted into a valid Discord API emoji payload with both `id` and `name`.
// If the custom emoji is not found in the client's cache, it falls back to a 
// standard Unicode emoji to prevent Discord API "400 Bad Request: Unknown Emoji" crashes.
// ─────────────────────────────────────────────────────────────────────────────
const UNICODE_FALLBACKS: Record<string, string> = {
  recycle: "🔄",
  manager: "🛡️",
  boost: "⚡",
  staff: "👤",
  locked: "🔒",
  trash: "🗑️",
  play: "▶️",
  pause: "⏸️",
  stop: "⏹️",
  skip: "⏭️",
  volumehigh: "🔊",
  volumedown: "🔉",
  volume: "🔊",
  calendar: "📅",
  information: "ℹ️",
  link: "🔗",
  success: "✅",
  check: "✅",
  check_yes: "✅",
  check_no: "❌",
  error: "❌",
  failure: "❌",
  warning: "⚠️",
  verified: "✅",
  star: "⭐",
  star_rating: "⭐",
  premium: "👑",
  appeal: "🎫",
  ticket: "🎫",
  "8ball": "🎱",
  slots: "🎰",
  slotmachine: "🎰",
  coinflip: "🪙",
  kick: "👢",
  ban: "🔨",
  mute: "🔇",
  unmute: "🔊",
  icons_crown: "👑",
  white_crown: "👑",
  crown: "👑",
  mod: "🛡️",
  xd_head_mod: "🛡️",
  tester: "🧪",
  support: "🎧",
  vip: "💎",
  homies: "🤝",
  nitro_1_months: "💎",
  nitro_2_months: "💎",
  nitro_3_months: "💎",
  nitro_12_months: "👑",
  turn_onoff_button: "⚡",
  spotify: "🎧",
  youtube: "▶️",
  soundcloud: "☁️",
  jiosaavn: "🎵",
  applemusic: "🍎",
  gaana: "🎶",
  discord: "💬",
  sk_connect: "🔗",
  sk_antinuke: "🛡️",
  sk_badge_premium: "💎",
  sk_owner: "👑",
  sk_staffmanager: "🛡️",
  sk_automations: "⚙️",
};

/**
 * Resolves an emoji dynamically from client cache, or returns a pristine Unicode fallback
 * so no raw `:emoji_name:` or `<:name:id>` text ever appears in embeds or messages!
 */
export function resolveDynamicEmoji(client: any, emojiNameOrRaw: string, fallbackUnicode: string = "✨"): string {
  if (!emojiNameOrRaw) return fallbackUnicode;
  const clientObj = client || (globalThis as any).__discordClient;
  
  let searchName = "";
  let searchId = "";

  const rawStr = String(emojiNameOrRaw).trim();
  const match = rawStr.match(/<(a?):([A-Za-z0-9_]+):([0-9]+)>/);
  if (match) {
    searchName = match[2];
    searchId = match[3];
  } else {
    searchName = rawStr.toLowerCase();
  }

  if (clientObj?.emojis?.cache) {
    if (searchId) {
      const foundById = clientObj.emojis.cache.get(searchId);
      if (foundById) return foundById.toString();
    }
    if (searchName) {
      const foundByName = clientObj.emojis.cache.find((e: any) => e.name?.toLowerCase() === searchName.toLowerCase());
      if (foundByName) return foundByName.toString();
    }
  }

  // Check RAW_CE entry for searchName
  const ceEntry = (RAW_CE as any)[searchName.toLowerCase()];
  if (ceEntry && clientObj?.emojis?.cache) {
    const found = clientObj.emojis.cache.get(ceEntry.id) || clientObj.emojis.cache.find((e: any) => e.name?.toLowerCase() === ceEntry.name?.toLowerCase());
    if (found) return found.toString();
  }

  // Fallback to Unicode mapping to prevent raw Discord emoji markup text display
  return UNICODE_FALLBACKS[searchName.toLowerCase()] || fallbackUnicode;
}

const origButtonSetEmoji = ButtonBuilder.prototype.setEmoji;
ButtonBuilder.prototype.setEmoji = function (this: ButtonBuilder, emoji: any) {
  if (!emoji) return origButtonSetEmoji.call(this, emoji);

  let targetEmoji: { id?: string; name: string; animated?: boolean } | null = null;
  const client = (globalThis as any).__discordClient;

  if (typeof emoji === "object" && emoji.id && emoji.name) {
    targetEmoji = { id: emoji.id, name: emoji.name, animated: Boolean(emoji.animated) };
  } else if (typeof emoji === "string" && /^\d{17,20}$/.test(emoji)) {
    const found = Object.values(CE).find((e) => e.id === emoji);
    if (found) {
      targetEmoji = { id: found.id, name: found.name, animated: Boolean(found.animated) };
    } else {
      targetEmoji = { id: emoji, name: "emoji" };
    }
  } else if (typeof emoji === "string") {
    const match = emoji.match(/<(a?):([A-Za-z0-9_]+):([0-9]+)>/);
    if (match) {
      targetEmoji = { id: match[3], name: match[2], animated: match[1] === "a" };
    }
  }

  if (targetEmoji && targetEmoji.id) {
    if (client) {
      let cached = client.emojis.cache.get(targetEmoji.id);
      if (!cached && targetEmoji.name) {
        cached = client.emojis.cache.find(
          (e: any) => e.name?.toLowerCase() === targetEmoji!.name.toLowerCase()
        );
      }

      if (cached) {
        return origButtonSetEmoji.call(this, {
          id: cached.id,
          name: cached.name || targetEmoji.name,
          animated: Boolean(cached.animated),
        });
      } else {
        const fallback = UNICODE_FALLBACKS[targetEmoji.name.toLowerCase()];
        if (fallback) {
          return origButtonSetEmoji.call(this, fallback);
        }
        return this; // Skip setting custom emoji to prevent 400 Bad Request
      }
    }
  }

  return origButtonSetEmoji.call(this, emoji);
};

const origSelectOptionSetEmoji = StringSelectMenuOptionBuilder.prototype.setEmoji;
StringSelectMenuOptionBuilder.prototype.setEmoji = function (this: StringSelectMenuOptionBuilder, emoji: any) {
  if (!emoji) return origSelectOptionSetEmoji.call(this, emoji);

  let targetEmoji: { id?: string; name: string; animated?: boolean } | null = null;
  const client = (globalThis as any).__discordClient;

  if (typeof emoji === "object" && emoji.id && emoji.name) {
    targetEmoji = { id: emoji.id, name: emoji.name, animated: Boolean(emoji.animated) };
  } else if (typeof emoji === "string" && /^\d{17,20}$/.test(emoji)) {
    const found = Object.values(CE).find((e) => e.id === emoji);
    if (found) {
      targetEmoji = { id: found.id, name: found.name, animated: Boolean(found.animated) };
    } else {
      targetEmoji = { id: emoji, name: "emoji" };
    }
  } else if (typeof emoji === "string") {
    const match = emoji.match(/<(a?):([A-Za-z0-9_]+):([0-9]+)>/);
    if (match) {
      targetEmoji = { id: match[3], name: match[2], animated: match[1] === "a" };
    }
  }

  if (targetEmoji && targetEmoji.id) {
    if (client) {
      let cached = client.emojis.cache.get(targetEmoji.id);
      if (!cached && targetEmoji.name) {
        cached = client.emojis.cache.find(
          (e: any) => e.name?.toLowerCase() === targetEmoji!.name.toLowerCase()
        );
      }

      if (cached) {
        return origSelectOptionSetEmoji.call(this, {
          id: cached.id,
          name: cached.name || targetEmoji.name,
          animated: Boolean(cached.animated),
        });
      } else {
        const fallback = UNICODE_FALLBACKS[targetEmoji.name.toLowerCase()];
        if (fallback) {
          return origSelectOptionSetEmoji.call(this, fallback);
        }
        return this; // Skip setting custom emoji to prevent 400 Bad Request
      }
    }
  }

  return origSelectOptionSetEmoji.call(this, emoji);
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL EMBED SANITIZATION:
// Discord DOES NOT render custom emojis (<:name:id> or <a:name:id>) in embed
// titles, author names, or footer text. They render as ugly raw text.
// We sanitize these globally so every embed across the entire bot is pristine.
// ─────────────────────────────────────────────────────────────────────────────
const origSetTitle = EmbedBuilder.prototype.setTitle;
EmbedBuilder.prototype.setTitle = function (this: EmbedBuilder, title: string | null) {
  if (!title) return origSetTitle.call(this, title);
  const cleaned = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  return origSetTitle.call(this, cleaned || " ");
};

const origSetFooter = EmbedBuilder.prototype.setFooter;
EmbedBuilder.prototype.setFooter = function (this: EmbedBuilder, options: any) {
  if (!options) return origSetFooter.call(this, options);
  if (typeof options.text === "string") {
    options.text = options.text.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  return origSetFooter.call(this, options);
};

const origSetAuthor = EmbedBuilder.prototype.setAuthor;
EmbedBuilder.prototype.setAuthor = function (this: EmbedBuilder, options: any) {
  if (!options) return origSetAuthor.call(this, options);
  if (typeof options.name === "string") {
    options.name = options.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  return origSetAuthor.call(this, options);
};

const origToJSON = EmbedBuilder.prototype.toJSON;
EmbedBuilder.prototype.toJSON = function (this: EmbedBuilder) {
  const json: any = origToJSON.call(this);
  if (!json.color) {
    json.color = 0x2b2d31;
  }
  const showAds = shouldShowAds();
  if (showAds) {
    if (!json.footer?.text || json.footer.text === "Zenith High-Fidelity Audio" || json.footer.text === "Zenith Audio VIP Engine") {
      json.footer = {
        text: getRandomMarketingFooter(json.footer?.text),
        icon_url: json.footer?.icon_url,
      };
    } else if (!json.footer.text.includes("discord.gg/gFgAfpSYdp") && !json.footer.text.startsWith("Page ")) {
      json.footer.text = getRandomMarketingFooter(json.footer.text);
    }
  } else {
    // Premium users: Strip any promotional marketing ads from footers
    if (json.footer?.text) {
      json.footer.text = json.footer.text
        .replace(/•?\s*discord\.gg\/\S+/g, "")
        .replace(/•?\s*Tired of lag.*$/i, "")
        .replace(/•?\s*Don't let raiders.*$/i, "")
        .replace(/•?\s*Elevate your server.*$/i, "")
        .replace(/•?\s*Crystal-clear.*$/i, "")
        .replace(/•?\s*Stop settling.*$/i, "")
        .replace(/•?\s*Enterprise Protection.*$/i, "")
        .replace(/•?\s*Your community deserves.*$/i, "")
        .trim();
      if (!json.footer.text) {
        json.footer.text = `${getBotName()} • VIP Engine`;
      }
    }
  }
  if (json.title) {
    json.title = json.title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  if (json.author?.name) {
    json.author.name = json.author.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  if (json.footer?.text) {
    json.footer.text = json.footer.text.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  return json;
};

export const MARKETING_PITCHES = [
  "Tired of lag & downtime? Unlock 24/7 High-Fi Voice & VIP Perks • discord.gg/gFgAfpSYdp",
  "Don't let raiders ruin your hard work. Get God-Mode Anti-Nuke with Premium • discord.gg/gFgAfpSYdp",
  "Elevate your server to VIP status • Instant No-Prefix Commands: discord.gg/gFgAfpSYdp",
  "Crystal-clear 384kbps audio & 24/7 dedicated voice node • Join: discord.gg/gFgAfpSYdp",
  "Stop settling for basic bots. Transform your community with Premium • discord.gg/gFgAfpSYdp",
  "Enterprise Protection & Unmatched Reliability • Claim your VIP Pass: discord.gg/gFgAfpSYdp",
  "Your community deserves the best. Upgrade to Zenith Premium today • discord.gg/gFgAfpSYdp",
];

export function getRandomMarketingFooter(fallback?: string): string {
  if (!shouldShowAds()) {
    if (fallback) {
      return fallback
        .replace(/•?\s*discord\.gg\/\S+/g, "")
        .replace(/•?\s*Tired of lag.*$/i, "")
        .replace(/•?\s*Don't let raiders.*$/i, "")
        .replace(/•?\s*Elevate your server.*$/i, "")
        .replace(/•?\s*Crystal-clear.*$/i, "")
        .replace(/•?\s*Stop settling.*$/i, "")
        .replace(/•?\s*Enterprise Protection.*$/i, "")
        .replace(/•?\s*Your community deserves.*$/i, "")
        .replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "")
        .trim() || `${getBotName()} • VIP Engine`;
    }
    return `${getBotName()} • VIP Engine`;
  }
  if (fallback && (fallback.includes("discord.gg") || fallback.includes("Zenith Premium"))) {
    return fallback.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  const pitch = MARKETING_PITCHES[Math.floor(Math.random() * MARKETING_PITCHES.length)];
  return fallback 
    ? `${fallback.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim()} • ${pitch}` 
    : pitch;
}

export function buildSupportRow(customLabel?: string, forceNonPremium = false): ActionRowBuilder<ButtonBuilder> {
  const cleanLabel = (customLabel || "Official Support Server")
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu, "")
    .trim();

  // If user is premium and not forced, do NOT show ad buttons (Get Premium / Invite)
  if (!shouldShowAds() && !forceNonPremium) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel(cleanLabel || "Support Server")
        .setEmoji(CE.chat.id)
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_SERVER_URL)
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Get Zenith Premium")
      .setEmoji(CE.boost.id)
      .setStyle(ButtonStyle.Link)
      .setURL(SUPPORT_SERVER_URL),
    new ButtonBuilder()
      .setLabel(cleanLabel || "Official Support Server")
      .setEmoji(CE.chat.id)
      .setStyle(ButtonStyle.Link)
      .setURL(SUPPORT_SERVER_URL),
    new ButtonBuilder()
      .setLabel("Invite Zenith Bot")
      .setEmoji(CE.promotion.id)
      .setStyle(ButtonStyle.Link)
      .setURL(BOT_INVITE_URL)
  );
}

let cachedBotName = "Zenith";

export function setCachedBotName(name: string | null | undefined): void {
  if (name && name.trim()) {
    cachedBotName = name.trim();
  }
}

export function getBotName(): string {
  return cachedBotName;
}

export const COLORS = {
  primary: 0x2b2d31,
  success: 0x57f287,
  warning: 0xfee75c,
  danger:  0xed4245,
  info:    0x5dade2,
  neutral: 0x99aab5,
  staff:   0x9b59b6,
  premium: 0xffd700,
} as const;

export interface CustomEmojiEntry {
  str: string;
  id: string;
  name: string;
  animated: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM EMOJI REGISTRY — All from the Zenith Bot emoji server & Dev server
// Update IDs here and every command/embed updates automatically.
// Static:   <:name:id>   |   Animated: <a:name:id>
// ─────────────────────────────────────────────────────────────────────────────
const RAW_CE: Record<string, CustomEmojiEntry> = {
  // ── Status ───────────────────────────────────────────────────────────────
  success:       { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  check:         { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  check_yes:     { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  check_no:      { str: "<:sk_autono:1551170184478724126>",    id: "1551170184478724126", name: "sk_autono",     animated: false },
  loading:       { str: "<a:white:1551170067058786309>",      id: "1551170067058786309", name: "white",         animated: true  },
  error:         { str: "<:sk_autono:1551170184478724126>",    id: "1551170184478724126", name: "sk_autono",     animated: false },
  failure:       { str: "<:sk_autono:1551170184478724126>",    id: "1551170184478724126", name: "sk_autono",     animated: false },
  failureorno:   { str: "<:sk_autono:1551170184478724126>",    id: "1551170184478724126", name: "sk_autono",     animated: false },
  warning:       { str: "<:sk_warn:1551170088995389440>",      id: "1551170088995389440", name: "sk_warn",       animated: false },
  verified:      { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  // ── People ───────────────────────────────────────────────────────────────
  members:       { str: "<:botuser:1551170035773481070>",     id: "1551170035773481070", name: "botuser",       animated: false },
  user:          { str: "<:botuser:1551170035773481070>",     id: "1551170035773481070", name: "botuser",       animated: false },
  staff:         { str: "<:sk_checkstaff:1551170200844763167>",id: "1551170200844763167", name: "sk_checkstaff", animated: false },
  admin:         { str: "<:sk_staffmanager:1551170224164900895>",id: "1551170224164900895", name: "sk_staffmanager",animated: false },
  manager:       { str: "<:sk_staffmanager:1551170224164900895>",id: "1551170224164900895", name: "sk_staffmanager",animated: false },
  owner:         { str: "<:sk_owner:1551170126786199653>",    id: "1551170126786199653", name: "sk_owner",      animated: false },
  developer:     { str: "<a:red_developer:1551170144574115930>",id: "1551170144574115930", name: "red_developer",  animated: true  },
  creators:      { str: "<a:red_developer:1551170144574115930>",id: "1551170144574115930", name: "red_developer",  animated: true  },
  bot:           { str: "<:bots:1551170028517335140>",        id: "1551170028517335140", name: "bots",          animated: false },
  white_bot:     { str: "<:bots:1551170028517335140>",        id: "1551170028517335140", name: "bots",          animated: false },
  // ── Moderation & Systems ──────────────────────────────────────────────────
  moderation:    { str: "<:sk_staffmanager:1551170224164900895>",id: "1551170224164900895", name: "sk_staffmanager",animated: false },
  ban:           { str: "<:sk_ban:1551170098042372179>",      id: "1551170098042372179", name: "sk_ban",        animated: false },
  mute:          { str: "<:sk_mute:1551170104443015181>",     id: "1551170104443015181", name: "sk_mute",       animated: false },
  mute_icon:     { str: "<:sk_mute:1551170104443015181>",     id: "1551170104443015181", name: "sk_mute",       animated: false },
  nuke:          { str: "<:sk_antinuke:1551170217982496841>",  id: "1551170217982496841", name: "sk_antinuke",   animated: false },
  termination:   { str: "<:sk_punishment:1551170233778540605>",id: "1551170233778540605", name: "sk_punishment", animated: false },
  demotion:      { str: "<:sk_demote:1551170117097361498>",    id: "1551170117097361498", name: "sk_demote",     animated: false },
  promotion:     { str: "<:sk_promote:1551170113271791771>",   id: "1551170113271791771", name: "sk_promote",    animated: false },
  // ── UI / Info & Communication ─────────────────────────────────────────────
  information:   { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  link:          { str: "<:sk_connect:1551170269559951381>",   id: "1551170269559951381", name: "sk_connect",    animated: false },
  link_icon:     { str: "<:sk_connect:1551170269559951381>",   id: "1551170269559951381", name: "sk_connect",    animated: false },
  notifications: { str: "<:sk_broad:1551170272906874941>",    id: "1551170272906874941", name: "sk_broad",      animated: false },
  announce:      { str: "<:sk_broad:1551170272906874941>",    id: "1551170272906874941", name: "sk_broad",      animated: false },
  settings:      { str: "<:sk_automations:1551170176882835497>",id: "1551170176882835497", name: "sk_automations",animated: false },
  automod:       { str: "<:sk_automod:1551170230678818816>",   id: "1551170230678818816", name: "sk_automod",    animated: false },
  locked:        { str: "<:sk_lock:1551170070384742410>",     id: "1551170070384742410", name: "sk_lock",       animated: false },
  folder:        { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  clipboard:     { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  delete:        { str: "<:sk_ban:1551170098042372179>",      id: "1551170098042372179", name: "sk_ban",        animated: false },
  trash:         { str: "<:sk_ban:1551170098042372179>",      id: "1551170098042372179", name: "sk_ban",        animated: false },
  ticket:        { str: "<:sk_appeal:1551170214220337162>",    id: "1551170214220337162", name: "sk_appeal",     animated: false },
  calendar:      { str: "<:botCalendarLight:1551170019226947625>",id: "1551170019226947625", name: "botCalendarLight",animated: false},
  level:         { str: "<:sk_promote:1551170113271791771>",   id: "1551170113271791771", name: "sk_promote",    animated: false },
  chart:         { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  trophy:        { str: "<:sk_badge_owner:1551170151322746971>",id: "1551170151322746971", name: "sk_badge_owner", animated: false },
  dm_sent:       { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  incoming:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  outgoing:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  eightball:     { str: "<:sk_8ball:1551170130091315354>",     id: "1551170130091315354", name: "sk_8ball",       animated: false },
  fortune:       { str: "<:sk_badge_premium:1551170158407188490>",id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  slots:         { str: "<:sk_slots:1551170136869179503>",    id: "1551170136869179503", name: "sk_slots",      animated: false },
  slotmachine:   { str: "<:sk_slots:1551170136869179503>",    id: "1551170136869179503", name: "sk_slots",      animated: false },
  bullseye:      { str: "<:sk_warn:1551170088995389440>",      id: "1551170088995389440", name: "sk_warn",       animated: false },
  dead:          { str: "<:sk_autono:1551170184478724126>",    id: "1551170184478724126", name: "sk_autono",     animated: false },
  roulette:      { str: "<:sk_coinflip:1551170133270335558>",  id: "1551170133270335558", name: "sk_coinflip",   animated: false },
  gun:           { str: "<:sk_kick:1551170107299336336>",      id: "1551170107299336336", name: "sk_kick",       animated: false },
  ship:          { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  ship_header:   { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  ship_filled:   { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  ship_empty:    { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  soulmate:      { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  soulmates:     { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  soulmates_ring:{ str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  no_luck_face:  { str: "<:sk_autono:1551170184478724126>",    id: "1551170184478724126", name: "sk_autono",     animated: false },
  rank1:         { str: "<:sk_badge_owner:1551170151322746971>",id: "1551170151322746971", name: "sk_badge_owner", animated: false },
  rank2:         { str: "<:sk_badge_premium:1551170158407188490>",id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  rank3:         { str: "<:botuser:1551170035773481070>",     id: "1551170035773481070", name: "botuser",       animated: false },
  // ── Shop & Premium ───────────────────────────────────────────────────────
  cash:          { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  cashout:       { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  ltc:           { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  shoppingcart:  { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  discount:      { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  limited:       { str: "<:sk_badge_premium:1551170158407188490>",id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  star:          { str: "<:sk_badge_premium:1551170158407188490>",id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  star_rating:   { str: "<:sk_badge_premium:1551170158407188490>",id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  heart:         { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  chat:          { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  // ── Games & Fun ──────────────────────────────────────────────────────────
  giveaway:      { str: "<:sk_games:1551170140228816916>",    id: "1551170140228816916", name: "sk_games",      animated: false },
  boost:         { str: "<:sk_badge_premium:1551170158407188490>",id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  fire:          { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  streak:        { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  arrow_red:     { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  arrow_yellow:  { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  arrow_anim:    { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  // ── Music Player & Controls ──────────────────────────────────────────────
  music:         { str: "<a:music:1551170042346082397>",      id: "1551170042346082397", name: "music",         animated: true  },
  play:          { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  playing:       { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  pause:         { str: "<:001_music:1551170011899371642>",   id: "1551170011899371642", name: "001_music",     animated: false },
  stop:          { str: "<:001_music:1551170011899371642>",   id: "1551170011899371642", name: "001_music",     animated: false },
  skip:          { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  music_bot:     { str: "<:001_music:1551170011899371642>",   id: "1551170011899371642", name: "001_music",     animated: false },
  music_queue:   { str: "<:sk_playlist:1551170051280081036>",  id: "1551170051280081036", name: "sk_playlist",   animated: false },
  white_musicnote:{ str: "<:001_music:1551170011899371642>",   id: "1551170011899371642", name: "001_music",     animated: false },
  // ── Social & Platforms ───────────────────────────────────────────────────
  discord:       { str: "<:Discord:1472116340939554900>",     id: "1472116340939554900", name: "Discord",       animated: false },
  youtube:       { str: "<:YOUTUBE:1514591262962090085>",     id: "1514591262962090085", name: "YOUTUBE",       animated: false },
  spotify:       { str: "<:spotify:1514591262962090085>",     id: "1514591262962090085", name: "spotify",       animated: false },
  soundcloud:    { str: "<:soundcloud:1514591262962090085>",  id: "1514591262962090085", name: "soundcloud",    animated: false },
  jiosaavn:      { str: "<:jiosaavn:1514591262962090085>",    id: "1514591262962090085", name: "jiosaavn",      animated: false },
  applemusic:    { str: "<:applemusic:1514591262962090085>",  id: "1514591262962090085", name: "applemusic",    animated: false },
  gaana:         { str: "<:gaana:1514591262962090085>",       id: "1514591262962090085", name: "gaana",         animated: false },
  instagram:     { str: "<:Instagram:1471456550408159253>",  id: "1471456550408159253", name: "Instagram",     animated: false },
  google:        { str: "<:google:1514592158403923979>",      id: "1514592158403923979", name: "google",        animated: false },
  gmail:         { str: "<:gmail:1472115964395913247>",       id: "1472115964395913247", name: "gmail",         animated: false },
  india:         { str: "<:India:1514592784093417593>",       id: "1514592784093417593", name: "India",         animated: false },
  partnered:     { str: "<:sk_connect:1551170269559951381>",   id: "1551170269559951381", name: "sk_connect",    animated: false },
  // ── Fallback UI ──────────────────────────────────────────────────────────
  draw:          { str: "<:sk_connect:1551170269559951381>",   id: "1551170269559951381", name: "sk_connect",    animated: false },
  clock:         { str: "<:botCalendarLight:1551170019226947625>",id: "1551170019226947625", name: "botCalendarLight",animated: false},
  media:         { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  prank:         { str: "<:sk_games:1551170140228816916>",    id: "1551170140228816916", name: "sk_games",      animated: false },
  equalizer:     { str: "<a:music:1551170042346082397>",      id: "1551170042346082397", name: "music",         animated: true  },
  radio:         { str: "<:sk_broad:1551170272906874941>",    id: "1551170272906874941", name: "sk_broad",      animated: false },
  loop_icon:     { str: "<:sk_autoheal:1551170188048207902>",  id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  volume_icon:   { str: "<a:sk_volumehigh:1551170045617639535>",id: "1551170045617639535", name: "sk_volumehigh", animated: true  },
  upvote:        { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  rope:          { str: "<:sk_warn:1551170088995389440>",      id: "1551170088995389440", name: "sk_warn",       animated: false },
  transcript:    { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  launch:        { str: "<:sk_promote:1551170113271791771>",   id: "1551170113271791771", name: "sk_promote",    animated: false },
  users_icon:    { str: "<:botuser:1551170035773481070>",     id: "1551170035773481070", name: "botuser",       animated: false },
  key_icon:      { str: "<:sk_staffmanager:1551170224164900895>",id: "1551170224164900895", name: "sk_staffmanager",animated: false },
  edit_icon:     { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  recycle:       { str: "<:sk_automations:1551170176882835497>",id: "1551170176882835497", name: "sk_automations",animated: false },
  spam:          { str: "<:sk_antinuke:1551170217982496841>",  id: "1551170217982496841", name: "sk_antinuke",   animated: false },
  badwords:      { str: "<:sk_ban:1551170098042372179>",      id: "1551170098042372179", name: "sk_ban",        animated: false },
  mentions_icon: { str: "<:sk_broad:1551170272906874941>",    id: "1551170272906874941", name: "sk_broad",      animated: false },
  attach:        { str: "<:sk_connect:1551170269559951381>",   id: "1551170269559951381", name: "sk_connect",    animated: false },
  location:      { str: "<:botuser:1551170035773481070>",     id: "1551170035773481070", name: "botuser",       animated: false },
  thinking:      { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  c4_red:        { str: "<:sk_promote:1551170113271791771>",   id: "1551170113271791771", name: "sk_promote",    animated: false },
  c4_yellow:     { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  c4_empty:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  slot_cherry:   { str: "<notused:1551170113271791771>",      id: "1551170113271791771", name: "sk_promote",    animated: false },
  slot_lemon:    { str: "<notused:1551170052806541323>",      id: "1551170052806541323", name: "playing",       animated: true  },
  slot_grape:    { str: "<notused:1551170158407188490>",      id: "1551170158407188490", name: "sk_badge_premium",animated: false },
  slot_bell:     { str: "<notused:1551170272906874941>",      id: "1551170272906874941", name: "sk_broad",      animated: false },
  slot_diamond:  { str: "<notused:1551170151322746971>",      id: "1551170151322746971", name: "sk_badge_owner", animated: false },
  slot_seven:    { str: "<notused:1551170188048207902>",      id: "1551170188048207902", name: "sk_autoheal",   animated: false },
  jackpot:       { str: "<:sk_slots:1551170136869179503>",    id: "1551170136869179503", name: "sk_slots",      animated: false },
  big_win:       { str: "<:sk_badge_owner:1551170151322746971>",id: "1551170151322746971", name: "sk_badge_owner", animated: false },
  small_win:     { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  rps_rock:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  rps_paper:     { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  rps_scissors:  { str: "<:sk_ban:1551170098042372179>",      id: "1551170098042372179", name: "sk_ban",        animated: false },
  rps_win:       { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
};

export function updateCustomEmoji(key: string, data: Partial<CustomEmojiEntry>): void {
  if (RAW_CE[key]) {
    Object.assign(RAW_CE[key], data);
  } else {
    RAW_CE[key] = {
      str: data.str || "✨",
      id: data.id || "",
      name: data.name || key,
      animated: Boolean(data.animated),
    };
  }
}

export const CE: Record<string, CustomEmojiEntry> = new Proxy(RAW_CE, {
  get(target, prop: string) {
    if (typeof prop !== "string") return (target as any)[prop];
    const key = prop.toLowerCase();
    const rawEntry = target[key] || target[prop];
    const client = (globalThis as any).__discordClient;
    const name = rawEntry?.name || prop;
    const resolved = resolveDynamicEmoji(
      client,
      rawEntry?.str || name,
      UNICODE_FALLBACKS[key] || UNICODE_FALLBACKS[name.toLowerCase()] || "✨"
    );
    
    return {
      str: resolved,
      id: rawEntry?.id || "",
      name: name,
      animated: Boolean(rawEntry?.animated),
      toString() { return resolved; },
    };
  }
});

/** Semantic aliases — all resolve to CE custom emojis. */
export const EMOJI = {
  ok:        CE.success.str,
  fail:      CE.error.str,
  warn:      CE.warning.str,
  info:      CE.information.str,
  loading:   CE.loading.str,
  shield:    CE.admin.str,
  crown:     CE.owner.str,
  star:      CE.staff.str,
  fire:      CE.streak.str,
  bomb:      CE.nuke.str,
  rocket:    CE.promotion.str,
  user:      CE.members.str,
  users:     CE.members.str,
  role:      CE.staff.str,
  channel:   CE.settings.str,
  ping:      CE.notifications.str,
  list:      CE.clipboard.str,
  clock:     CE.information.str,
  cal:       CE.information.str,
  msg:       CE.dm_sent.str,
  hammer:    CE.ban.str,
  tools:     CE.settings.str,
  gear:      CE.settings.str,
  ban:       CE.ban.str,
  mute:      CE.mute.str,
  unmute:    CE.check.str,
  kick:      CE.gun.str,
  bell:      CE.notifications.str,
  lock:      CE.locked.str,
  unlock:    CE.check.str,
  bot:       CE.settings.str,
  server:    CE.admin.str,
  globe:     CE.link.str,
  link:      CE.link.str,
  arrowUp:   CE.promotion.str,
  arrowDown: CE.demotion.str,
  bullet:    "•",
  dot:       "·",
  spark:     CE.success.str,
  trophy:    CE.trophy.str,
  graph:     CE.level.str,
  party:     CE.giveaway.str,
} as const;

export function buildBullets(items: { label: string; value: string }[]): string {
  return items.map(f => `> **${f.label}:** ${f.value}`).join("\n");
}

export interface PrettyEmbedOpts {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: APIEmbedField[];
  footer?: string;
  thumbnail?: string;
  author?: { name: string; iconURL?: string };
  timestamp?: boolean;
  url?: string;
  image?: string;
}

export function prettyEmbed(opts: PrettyEmbedOpts): EmbedBuilder {
  const e = new EmbedBuilder().setColor(opts.color ?? COLORS.primary);
  if (opts.title) {
    const cleanTitle = opts.title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
    if (cleanTitle) e.setTitle(cleanTitle);
  }
  if (opts.description) e.setDescription(opts.description);
  if (opts.fields && opts.fields.length > 0) e.addFields(opts.fields);
  
  // Marketing-driven emotionally resonant footer
  const finalFooter = getRandomMarketingFooter(opts.footer);
  e.setFooter({ text: finalFooter });

  if (opts.thumbnail) e.setThumbnail(opts.thumbnail);
  if (opts.author) {
    e.setAuthor({
      name: opts.author.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim(),
      iconURL: opts.author.iconURL,
    });
  }
  if (opts.url) e.setURL(opts.url);
  if (opts.image) e.setImage(opts.image);
  if (opts.timestamp !== false) e.setTimestamp(new Date());
  return e;
}

function formatBlockquote(text?: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith(">") || trimmed.startsWith("```")) return trimmed;
  return trimmed
    .split("\n")
    .map(l => l.trim() ? `> ${l.trim()}` : ">")
    .join("\n");
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.success.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.success.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.success,
  });
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.error.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.error.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.danger,
  });
}

export function warnEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.warning.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.warning.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.warning,
  });
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.information.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.information.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.info,
  });
}

export interface ModActionOpts {
  action: string;
  target: { tag: string; id: string; displayAvatarURL: (opts?: any) => string };
  moderator?: { tag: string; id: string };
  reason?: string;
  duration?: string;
  color?: ColorResolvable;
  emoji?: string;
  extraFields?: { label: string; value: string }[];
}

export function modActionEmbed(opts: ModActionOpts): EmbedBuilder {
  const cleanAction = opts.action.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const e = new EmbedBuilder()
    .setAuthor({ name: `${cleanAction} | ${opts.target.tag}`, iconURL: opts.target.displayAvatarURL({ size: 128 }) })
    .setColor(opts.color ?? COLORS.danger)
    .setDescription(
      (opts.emoji ? `${opts.emoji}  **Action Executed: ${cleanAction}**\n\n` : `**Action Executed: ${cleanAction}**\n\n`) +
      buildBullets([
        { label: "Target", value: `<@${opts.target.id}> (\`${opts.target.id}\`)` },
        ...(opts.moderator ? [{ label: "Moderator", value: `<@${opts.moderator.id}>` }] : []),
        ...(opts.duration ? [{ label: "Duration", value: opts.duration }] : []),
        { label: "Reason", value: opts.reason || "No reason provided." },
        ...(opts.extraFields || [])
      ])
    )
    .setFooter({ text: getRandomMarketingFooter(`${getBotName()} • Moderation`) })
    .setTimestamp(new Date());
    
  return e;
}

export interface UserActionOpts {
  title: string;
  target: { tag: string; id: string; displayAvatarURL: (opts?: any) => string };
  description?: string;
  fields?: { label: string; value: string }[];
  color?: ColorResolvable;
  emoji?: string;
  footer?: string;
}

export function userActionEmbed(opts: UserActionOpts): EmbedBuilder {
  const cleanTitle = opts.title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const e = new EmbedBuilder()
    .setAuthor({ name: opts.target.tag, iconURL: opts.target.displayAvatarURL({ size: 128 }) })
    .setTitle(cleanTitle)
    .setColor(opts.color ?? COLORS.primary);
    
  let desc = "";
  if (opts.emoji) desc += `${opts.emoji}  **${cleanTitle}**\n\n`;
  if (opts.description) desc += opts.description + "\n\n";
  if (opts.fields && opts.fields.length > 0) {
    desc += buildBullets(opts.fields);
  }
  if (desc) e.setDescription(desc.trim());
  
  e.setFooter({ text: getRandomMarketingFooter(opts.footer) });
  e.setTimestamp(new Date());
  return e;
}
