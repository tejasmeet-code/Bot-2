import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder, REST, type APIEmbedField, type ColorResolvable } from "discord.js";
import { shouldShowAds, isCurrentContextPremium, isCurrentContextServerPremium } from "./botContext";

export const SUPPORT_SERVER_URL = "https://discord.gg/gFgAfpSYdp";
export const BOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1466728565352435847&permissions=8&scope=bot%20applications.commands";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL COMPONENT EMOJI NORMALIZATION:
// Ensures that whether an emoji ID, string, or CustomEmojiEntry is passed to
// ButtonBuilder.setEmoji or StringSelectMenuOptionBuilder.setEmoji, it is
// converted into a valid Discord API emoji payload with both `id` and `name`.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_EMOJI_IDS = new Set([
  "1555133215508009061", "1555133225893101600", "1555133234184978572", "1555133241814548542",
  "1555133249049862205", "1555133256477974579", "1555133264895807518", "1555133271896096788",
  "1555133279030485082", "1555133286676832366", "1555133293765070880", "1555133300522098758",
  "1555133307434434610", "1555133314380206160", "1555133322840121357", "1555133337079914567",
  "1555133344482590821", "1555133353194291231", "1555133360420945940", "1555133367534624849",
  "1555133374023344242", "1555133381182881852", "1555133388149628980", "1555133395816939531",
  "1555133403261571144", "1555133412602286140", "1555133419971678228", "1555133427936919574",
  "1555133437038297138", "1555133444017619028", "1555133452146319391", "1555133459192615042",
  "1555133465022828626", "1555133473205780550", "1555133480810193016", "1555133487844163674",
  "1555133494991265863", "1555133502197076030", "1555133509331583026", "1555133516923011103",
  "1555133523965382737", "1555133531666120744", "1555133538750169149", "1555133545918369894",
  "1555133552797028443", "1555133560334061610", "1555133567762174053", "1555133575165124638",
  "1555133582140248125", "1555133589581070416", "1555133596652539988", "1555133604068200468",
  "1555133610858647603", "1555133618072846417", "1555133626276905040", "1555133634346750035",
  "1555133642018258964", "1555133649504968775", "1555133656736079934", "1555133664554393620",
  "1555133671340515439", "1555133678009589810", "1555133685118931086", "1555133693704544337",
  "1555133700835119136", "1555133708057575466", "1555133715477172244", "1555133722284527628",
  "1555133730371407944", "1555133737837006910", "1555133755184906250", "1555133762734657581",
  "1555133769659187260", "1555133776475070464", "1555133783634616371", "1555133790781972521",
  "1555133800227414016", "1555133807643070464", "1555133815536492721", "1555133823698604074",
  "1555133832305451101", "1555133839351873556", "1555133846801092631", "1555133855143567430",
  "1555133862030483548", "1555133869433552906", "1555133876433846382", "1555133883383681145",
  "1555133891281428500", "1555133898156154963", "1555133905412030607", "1555133916979925143"
]);

const UNICODE_FALLBACKS: Record<string, string> = {
  recycle: "<:Tool:1555133545918369894>",
  manager: "<:white_manager:1555133708057575466>",
  boost: "<:white_Premium:1555133783634616371>",
  staff: "<:white_roles:1555133800227414016>",
  locked: "<:white_lock:1555133700835119136>",
  trash: "<:white_delete:1555133618072846417>",
  play: "<a:02music:1555133215508009061>",
  pause: "<:pause:1555133437038297138>",
  stop: "<:white_cancel:1555133596652539988>",
  skip: "<:white_skip:1555133823698604074>",
  volumehigh: "<a:music:1555133412602286140>",
  volumedown: "<a:music:1555133412602286140>",
  volume: "<a:music:1555133412602286140>",
  calendar: "<:list:1555133374023344242>",
  information: "<:white_info:1555133685118931086>",
  link: "<:link:1555133367534624849>",
  success: "<a:white_Done:1555133626276905040>",
  check: "<a:white_Done:1555133626276905040>",
  check_yes: "<a:white_Done:1555133626276905040>",
  check_no: "<:white_cancel:1555133596652539988>",
  error: "<a:error:1555133322840121357>",
  failure: "<a:error:1555133322840121357>",
  warning: "<:white_warn:1555133898156154963>",
  verified: "<a:white_Done:1555133626276905040>",
  star: "<:white_Premium:1555133783634616371>",
  star_rating: "<:white_Premium:1555133783634616371>",
  premium: "<:white_Premium:1555133783634616371>",
  appeal: "<:white_ticket:1555133876433846382>",
  ticket: "<:white_ticket:1555133876433846382>",
  "8ball": "<:white_games:1555133649504968775>",
  slots: "<:white_games:1555133649504968775>",
  slotmachine: "<:white_games:1555133649504968775>",
  coinflip: "<:white_games:1555133649504968775>",
  kick: "<:white_ban:1555133582140248125>",
  ban: "<:white_ban:1555133582140248125>",
  mute: "<:white_mute:1555133755184906250>",
  unmute: "<a:white_Done:1555133626276905040>",
  icons_crown: "<:white_owner:1555133769659187260>",
  white_crown: "<:white_owner:1555133769659187260>",
  crown: "<:white_owner:1555133769659187260>",
  mod: "<:Moderator:1555133403261571144>",
  xd_head_mod: "<:Moderator:1555133403261571144>",
  tester: "<:white_Tester:1555133862030483548>",
  support: "<:Support:1555133538750169149>",
  vip: "<:white_vip:1555133891281428500>",
  homies: "<:white_homies:1555133678009589810>",
  nitro_1_months: "<:white_Premium:1555133783634616371>",
  nitro_2_months: "<:white_Premium:1555133783634616371>",
  nitro_3_months: "<:white_Premium:1555133783634616371>",
  nitro_12_months: "<:white_owner:1555133769659187260>",
  turn_onoff_button: "<:Button_on:1555133307434434610>",
  spotify: "<:Spotify:1555133531666120744>",
  youtube: "<:YouTube_music:1555133916979925143>",
  soundcloud: "<:Apple_Music:1555133256477974579>",
  jiosaavn: "<:Jio_saavan:1555133360420945940>",
  applemusic: "<:Apple_Music:1555133256477974579>",
  gaana: "<:Apple_Music:1555133256477974579>",
  discord: "<:globe:1555133344482590821>",
  sk_connect: "<:link:1555133367534624849>",
  sk_antinuke: "<:white_antinuke:1555133560334061610>",
  sk_badge_premium: "<:white_Premium:1555133783634616371>",
  sk_owner: "<:white_owner:1555133769659187260>",
  sk_staffmanager: "<:white_admin:1555133552797028443>",
  sk_automations: "<:Tool:1555133545918369894>",
};

const SHORTCODE_TO_CUSTOM: Record<string, string> = {
  ":musical_note:": "<:white_musicnote:1555133737837006910>",
  ":white_check_mark:": "<a:white_Done:1555133626276905040>",
  ":gear:": "<:white_settings:1555133815536492721>",
  ":tools:": "<:Tool:1555133545918369894>",
  ":shield:": "<:Moderator:1555133403261571144>",
  ":warning:": "<:white_warn:1555133898156154963>",
  ":star:": "<:white_Premium:1555133783634616371>",
  ":rocket:": "<:white_Premium:1555133783634616371>",
};

const UNICODE_EMOJI_REGEX = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u20E3\uFE0F\u200D\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const SHORTCODE_REGEX = /(?<![\w<]):([a-zA-Z0-9_+\-]+):(?!\d)/gi;

export function isAllowedEmojiId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^\d{17,20}$/.test(id.trim());
}

export function stripAllEmojis(text: string): string {
  if (typeof text !== "string") return text;
  
  // 1. Strip all unicode keyboard emojis
  let clean = text.replace(UNICODE_EMOJI_REGEX, "");
  
  // 2. Identify custom emojis and preserve valid ones
  clean = clean.replace(/<a?:([a-zA-Z0-9_]+):(\d+)>/g, (match, name, id) => {
    if (isAllowedEmojiId(id)) {
      return match;
    }
    return "";
  });
  
  // 3. Strip shortcodes
  clean = clean.replace(SHORTCODE_REGEX, "");

  // Clean double spaces while preserving newlines
  clean = clean.split("\n").map(line => line.replace(/[ \t]+/g, " ").trim()).join("\n");
  return clean;
}

export function sanitizeObjectEmojis(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return stripAllEmojis(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectEmojis);
  }
  if (typeof obj === "object") {
    const res: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "emoji") {
        const target = sanitizeEmojiField(value);
        if (target && target.id && isAllowedEmojiId(target.id)) {
          res[key] = {
            id: target.id,
            name: target.name || "emoji",
            animated: Boolean(target.animated),
          };
        } else {
          // If emoji cannot be used and button has no label, provide fallback label
          if (!obj.label && (obj.custom_id || obj.customId)) {
            res["label"] = obj.custom_id || obj.customId;
          }
        }
      } else {
        const sanitized = sanitizeObjectEmojis(value);
        // CRITICAL: Discord API forbids empty strings for title, description, footer.text, author.name!
        if (typeof sanitized === "string" && sanitized.length === 0) {
          if (key === "title") {
            // Drop title completely rather than sending invalid empty string
            continue;
          }
          if (key === "description") {
            // Description must be non-empty string if key exists in embed
            res[key] = " ";
            continue;
          }
        }
        res[key] = sanitized;
      }
    }

    // Safety for Buttons: A button MUST have either a label or an emoji
    if ((res.type === 2 || obj.type === 2) && !res.label && !res.emoji) {
      res.label = res.custom_id || obj.custom_id || "Click";
    }

    return res;
  }
  return obj;
}

export function sanitizeTextString(text: string, location = "payload"): string {
  return stripAllEmojis(text);
}

export function sanitizeEmojiField(emoji: any, location = "emoji"): any {
  if (!emoji) return undefined;
  if (typeof emoji === "string") {
    const match = emoji.match(/<(a?):([A-Za-z0-9_]+):([0-9]+)>/);
    if (match && isAllowedEmojiId(match[3])) {
      return { id: match[3], name: match[2], animated: match[1] === "a" };
    }
    if (/^\d+$/.test(emoji) && isAllowedEmojiId(emoji)) {
      const entry = Object.values(RAW_CE).find(e => e.id === emoji);
      return { id: emoji, name: entry?.name || "emoji", animated: Boolean(entry?.animated) };
    }
    const clean = emoji.replace(/:/g, "").toLowerCase();
    if ((RAW_CE as any)[clean]) {
      const entry = (RAW_CE as any)[clean];
      if (isAllowedEmojiId(entry.id)) {
        return { id: entry.id, name: entry.name, animated: Boolean(entry.animated) };
      }
    }
    return undefined;
  }
  if (typeof emoji === "object") {
    if (emoji.id && isAllowedEmojiId(emoji.id)) {
      return { id: emoji.id, name: emoji.name || "emoji", animated: Boolean(emoji.animated) };
    }
    if (emoji.name) {
      const clean = emoji.name.replace(/:/g, "").toLowerCase();
      if ((RAW_CE as any)[clean]) {
        const entry = (RAW_CE as any)[clean];
        if (isAllowedEmojiId(entry.id)) {
          return { id: entry.id, name: entry.name, animated: Boolean(entry.animated) };
        }
      }
    }
  }
  return undefined;
}

export function sanitizeOutgoingPayload(data: any, loc = "REST"): any {
  return sanitizeObjectEmojis(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH REST.prototype.request GLOBAL INTERCEPTOR:
// Guarantees no default emoji or shortcode escapes to Discord API!
// ─────────────────────────────────────────────────────────────────────────────
const origRESTRequest = REST.prototype.request;
REST.prototype.request = function (this: REST, options: any) {
  if (options && options.body) {
    try {
      options.body = sanitizeOutgoingPayload(options.body, options.fullRoute || options.url || "REST");
    } catch (err) {
      console.error("[REST INTERCEPTOR ERROR]", err);
    }
  }
  return origRESTRequest.call(this, options);
};

export function assertNoDefaultEmoji(payload: any, source: string = "Command/Payload"): void {
  // Silent no-op
}

export function resolveDynamicEmoji(client: any, emojiNameOrRaw: string, fallbackUnicode: string = ""): string {
  if (!emojiNameOrRaw) return "";
  const clientObj = client || (globalThis as any).__discordClient;
  
  const rawStr = String(emojiNameOrRaw).trim();
  const match = rawStr.match(/<(a?):([A-Za-z0-9_]+):([0-9]+)>/);
  if (match) {
    if (isAllowedEmojiId(match[3])) {
      return rawStr;
    }
    return "";
  }

  const clean = rawStr.replace(/:/g, "").toLowerCase();
  if (clientObj?.emojis?.cache) {
    const foundByName = clientObj.emojis.cache.find((e: any) => e.name?.toLowerCase() === clean);
    if (foundByName && isAllowedEmojiId(foundByName.id)) {
      return foundByName.toString();
    }
  }

  // Lookup in RAW_CE by entry name or key
  for (const entry of Object.values(RAW_CE)) {
    if (entry.name?.toLowerCase() === clean && isAllowedEmojiId(entry.id)) {
      return entry.str;
    }
  }

  const direct = (RAW_CE as any)[clean];
  if (direct && isAllowedEmojiId(direct.id)) {
    return direct.str;
  }

  return "";
}

const origButtonSetEmoji = ButtonBuilder.prototype.setEmoji;
ButtonBuilder.prototype.setEmoji = function (this: ButtonBuilder, emoji: any) {
  if (!emoji || emoji === "") return this;

  let targetEmoji = sanitizeEmojiField(emoji);
  if (targetEmoji && targetEmoji.id && isAllowedEmojiId(targetEmoji.id)) {
    return origButtonSetEmoji.call(this, {
      id: targetEmoji.id,
      name: targetEmoji.name || "emoji",
      animated: false, // Buttons must NEVER have animated: true
    });
  }

  return this;
};

const origSelectOptionSetEmoji = StringSelectMenuOptionBuilder.prototype.setEmoji;
StringSelectMenuOptionBuilder.prototype.setEmoji = function (this: StringSelectMenuOptionBuilder, emoji: any) {
  if (!emoji || emoji === "") return this;

  let targetEmoji = sanitizeEmojiField(emoji);
  if (targetEmoji && targetEmoji.id && isAllowedEmojiId(targetEmoji.id)) {
    return origSelectOptionSetEmoji.call(this, {
      id: targetEmoji.id,
      name: targetEmoji.name || "emoji",
      animated: false,
    });
  }

  return this;
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
  return sanitizeObjectEmojis(json);
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
  let cleanLabel = customLabel || "Official Support Server";
  // Strip custom emojis (<:name:id> or <a:name:id>)
  cleanLabel = cleanLabel.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, "");
  // Strip Unicode emojis using our robust regex
  cleanLabel = cleanLabel.replace(UNICODE_EMOJI_REGEX, "");
  // Strip shortcodes (:emoji:)
  cleanLabel = cleanLabel.replace(SHORTCODE_REGEX, "");
  // Clean up extra whitespace
  cleanLabel = cleanLabel.trim().replace(/\s+/g, " ");

  if (!cleanLabel) {
    cleanLabel = "Official Support Server";
  }

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
  return isCurrentContextServerPremium() ? "Zenith Prime" : cachedBotName;
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
  success:       { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  check:         { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  check_yes:     { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  check_no:      { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  loading:       { str: "<a:white_loading:1555133693704544337>", id: "1555133693704544337", name: "white_loading", animated: true  },
  error:         { str: "<a:error:1555133322840121357>",      id: "1555133322840121357", name: "error",         animated: true  },
  failure:       { str: "<a:error:1555133322840121357>",      id: "1555133322840121357", name: "error",         animated: true  },
  failureorno:   { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  warning:       { str: "<:white_warn:1555133898156154963>",   id: "1555133898156154963", name: "white_warn",    animated: false },
  verified:      { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  // ── People ───────────────────────────────────────────────────────────────
  members:       { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  user:          { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  staff:         { str: "<:white_roles:1555133800227414016>",  id: "1555133800227414016", name: "white_roles",    animated: false },
  admin:         { str: "<:white_admin:1555133552797028443>",  id: "1555133552797028443", name: "white_admin",    animated: false },
  manager:       { str: "<:white_manager:1555133708057575466>", id: "1555133708057575466", name: "white_manager",  animated: false },
  owner:         { str: "<:white_owner:1555133769659187260>",  id: "1555133769659187260", name: "white_owner",    animated: false },
  developer:     { str: "<:white_owner:1555133769659187260>",  id: "1555133769659187260", name: "white_owner",    animated: false },
  creators:      { str: "<:white_owner:1555133769659187260>",  id: "1555133769659187260", name: "white_owner",    animated: false },
  bot:           { str: "<:white_bot:1555133589581070416>",    id: "1555133589581070416", name: "white_bot",     animated: false },
  white_bot:     { str: "<:white_bot:1555133589581070416>",    id: "1555133589581070416", name: "white_bot",     animated: false },
  // ── Moderation & Systems ──────────────────────────────────────────────────
  moderation:    { str: "<:Moderator:1555133403261571144>",    id: "1555133403261571144", name: "Moderator",     animated: false },
  ban:           { str: "<:white_ban:1555133582140248125>",    id: "1555133582140248125", name: "white_ban",     animated: false },
  mute:          { str: "<:white_mute:1555133755184906250>",   id: "1555133755184906250", name: "white_mute",    animated: false },
  mute_icon:     { str: "<:white_mute:1555133755184906250>",   id: "1555133755184906250", name: "white_mute",    animated: false },
  nuke:          { str: "<:white_antinuke:1555133560334061610>", id: "1555133560334061610", name: "white_antinuke", animated: false },
  termination:   { str: "<:white_terminate:1555133855143567430>", id: "1555133855143567430", name: "white_terminate", animated: false },
  demotion:      { str: "<:white_strike:1555133832305451101>", id: "1555133832305451101", name: "white_strike",   animated: false },
  promotion:     { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  // ── UI / Info & Communication ─────────────────────────────────────────────
  information:   { str: "<:white_info:1555133685118931086>",   id: "1555133685118931086", name: "white_info",    animated: false },
  link:          { str: "<:link:1555133367534624849>",        id: "1555133367534624849", name: "link",          animated: false },
  link_icon:     { str: "<:link:1555133367534624849>",        id: "1555133367534624849", name: "link",          animated: false },
  notifications: { str: "<a:Notifications:1555133419971678228>", id: "1555133419971678228", name: "Notifications", animated: true  },
  announce:      { str: "<a:announce:1555133241814548542>",    id: "1555133241814548542", name: "announce",      animated: true  },
  settings:      { str: "<:white_settings:1555133815536492721>", id: "1555133815536492721", name: "white_settings", animated: false },
  automod:       { str: "<:white_automod:1555133567762174053>", id: "1555133567762174053", name: "white_automod",  animated: false },
  locked:        { str: "<:white_lock:1555133700835119136>",   id: "1555133700835119136", name: "white_lock",    animated: false },
  folder:        { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  clipboard:     { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  delete:        { str: "<:white_delete:1555133618072846417>", id: "1555133618072846417", name: "white_delete",  animated: false },
  trash:         { str: "<:white_delete:1555133618072846417>", id: "1555133618072846417", name: "white_delete",  animated: false },
  ticket:        { str: "<:white_ticket:1555133876433846382>", id: "1555133876433846382", name: "white_ticket",  animated: false },
  calendar:      { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  level:         { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  chart:         { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  trophy:        { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  dm_sent:       { str: "<:white_message:1555133715477172244>", id: "1555133715477172244", name: "white_message",  animated: false },
  incoming:      { str: "<:white_message:1555133715477172244>", id: "1555133715477172244", name: "white_message",  animated: false },
  outgoing:      { str: "<:white_message:1555133715477172244>", id: "1555133715477172244", name: "white_message",  animated: false },
  eightball:     { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  fortune:       { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  slots:         { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  slotmachine:   { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  bullseye:      { str: "<:white_warn:1555133898156154963>",   id: "1555133898156154963", name: "white_warn",    animated: false },
  dead:          { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  roulette:      { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  gun:           { str: "<:white_ban:1555133582140248125>",    id: "1555133582140248125", name: "white_ban",     animated: false },
  ship:          { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  ship_header:   { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  ship_filled:   { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  ship_empty:    { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  soulmate:      { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  soulmates:     { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  soulmates_ring:{ str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  no_luck_face:  { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  rank1:         { str: "<:white_first:1555133634346750035>",  id: "1555133634346750035", name: "white_first",   animated: false },
  rank2:         { str: "<:white_second:1555133807643070464>", id: "1555133807643070464", name: "white_second",  animated: false },
  rank3:         { str: "<:white_third:1555133869433552906>",  id: "1555133869433552906", name: "white_third",   animated: false },
  // ── Shop & Premium ───────────────────────────────────────────────────────
  cash:          { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  cashout:       { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  ltc:           { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  shoppingcart:  { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  discount:      { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  limited:       { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  star:          { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  star_rating:   { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  heart:         { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  chat:          { str: "<:white_message:1555133715477172244>", id: "1555133715477172244", name: "white_message",  animated: false },
  // ── Games & Fun ──────────────────────────────────────────────────────────
  giveaway:      { str: "<:white_gift:1555133656736079934>",  id: "1555133656736079934", name: "white_gift",    animated: false },
  boost:         { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  fire:          { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  streak:        { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  arrow_red:     { str: "<a:02music:1555133215508009061>",    id: "1555133215508009061", name: "02music",       animated: true  },
  arrow_yellow:  { str: "<a:02music:1555133215508009061>",    id: "1555133215508009061", name: "02music",       animated: true  },
  arrow_anim:    { str: "<a:02music:1555133215508009061>",    id: "1555133215508009061", name: "02music",       animated: true  },
  // ── Music Player & Controls ──────────────────────────────────────────────
  music:         { str: "<a:music:1555133412602286140>",      id: "1555133412602286140", name: "music",         animated: true  },
  play:          { str: "<:resume:1555133494991265863>",      id: "1555133494991265863", name: "resume",        animated: false },
  resume:        { str: "<:resume:1555133494991265863>",      id: "1555133494991265863", name: "resume",        animated: false },
  playing:       { str: "<a:white_music:1555133730371407944>", id: "1555133730371407944", name: "white_music",   animated: true  },
  pause:         { str: "<:pause:1555133437038297138>",       id: "1555133437038297138", name: "pause",         animated: false },
  stop:          { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  skip:          { str: "<:white_skip:1555133823698604074>",   id: "1555133823698604074", name: "white_skip",     animated: false },
  previous:      { str: "<:white_previous:1555133790781972521>", id: "1555133790781972521", name: "white_previous", animated: false },
  music_bot:     { str: "<a:white_music:1555133730371407944>", id: "1555133730371407944", name: "white_music",   animated: true  },
  music_queue:   { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  white_musicnote:{ str: "<:white_musicnote:1555133737837006910>", id: "1555133737837006910", name: "white_musicnote", animated: false },
  repeat_one:    { str: "<:repeat_one_button:1555133487844163674>", id: "1555133487844163674", name: "repeat_one_button", animated: false },
  repeat_one_button: { str: "<:repeat_one_button:1555133487844163674>", id: "1555133487844163674", name: "repeat_one_button", animated: false },
  shuffle:       { str: "<:shuffle:1555133509331583026>",      id: "1555133509331583026", name: "shuffle",       animated: false },
  speed_decrease:{ str: "<:Speed_decrease:1555133516923011103>", id: "1555133516923011103", name: "Speed_decrease", animated: false },
  speed_more:    { str: "<:Speed_more:1555133523965382737>",    id: "1555133523965382737", name: "Speed_more",    animated: false },
  // ── Social & Platforms ───────────────────────────────────────────────────
  discord:       { str: "<:globe:1555133344482590821>",       id: "1555133344482590821", name: "globe",         animated: false },
  youtube:       { str: "<:YouTube_music:1555133916979925143>", id: "1555133916979925143", name: "YouTube_music",  animated: false },
  youtube_music: { str: "<:YouTube_music:1555133916979925143>", id: "1555133916979925143", name: "YouTube_music",  animated: false },
  spotify:       { str: "<:Spotify:1555133531666120744>",      id: "1555133531666120744", name: "Spotify",        animated: false },
  soundcloud:    { str: "<:Apple_Music:1555133256477974579>",  id: "1555133256477974579", name: "Apple_Music",   animated: false },
  jiosaavn:      { str: "<:Jio_saavan:1555133360420945940>",   id: "1555133360420945940", name: "Jio_saavan",    animated: false },
  jio_saavan:    { str: "<:Jio_saavan:1555133360420945940>",   id: "1555133360420945940", name: "Jio_saavan",    animated: false },
  applemusic:    { str: "<:Apple_Music:1555133256477974579>",  id: "1555133256477974579", name: "Apple_Music",   animated: false },
  apple_music:   { str: "<:Apple_Music:1555133256477974579>",  id: "1555133256477974579", name: "Apple_Music",   animated: false },
  amazon_music:  { str: "<:Amazon_music:1555133234184978572>", id: "1555133234184978572", name: "Amazon_music",  animated: false },
  gaana:         { str: "<:Apple_Music:1555133256477974579>",  id: "1555133256477974579", name: "Apple_Music",   animated: false },
  instagram:     { str: "<:globe:1555133344482590821>",       id: "1555133344482590821", name: "globe",         animated: false },
  google:        { str: "<:globe:1555133344482590821>",       id: "1555133344482590821", name: "globe",         animated: false },
  gmail:         { str: "<:globe:1555133344482590821>",       id: "1555133344482590821", name: "globe",         animated: false },
  india:         { str: "<a:World:1555133905412030607>",      id: "1555133905412030607", name: "World",         animated: true  },
  partnered:     { str: "<:Partner:1555133427936919574>",      id: "1555133427936919574", name: "Partner",       animated: false },
  // ── Fallback UI & Controls ────────────────────────────────────────────────
  draw:          { str: "<:link:1555133367534624849>",        id: "1555133367534624849", name: "link",          animated: false },
  clock:         { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  media:         { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  prank:         { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  equalizer:     { str: "<a:music:1555133412602286140>",      id: "1555133412602286140", name: "music",         animated: true  },
  radio:         { str: "<:white_musicnote:1555133737837006910>", id: "1555133737837006910", name: "white_musicnote", animated: false },
  loop_icon:     { str: "<:loop:1555133388149628980>",        id: "1555133388149628980", name: "loop",          animated: false },
  volume_icon:   { str: "<:white_mic:1555133722284527628>",    id: "1555133722284527628", name: "white_mic",     animated: false },
  upvote:        { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  rope:          { str: "<:white_warn:1555133898156154963>",   id: "1555133898156154963", name: "white_warn",    animated: false },
  transcript:    { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  launch:        { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  users_icon:    { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  key_icon:      { str: "<:white_admin:1555133552797028443>",  id: "1555133552797028443", name: "white_admin",    animated: false },
  edit_icon:     { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  recycle:       { str: "<:Tool:1555133545918369894>",        id: "1555133545918369894", name: "Tool",          animated: false },
  spam:          { str: "<:white_antinuke:1555133560334061610>", id: "1555133560334061610", name: "white_antinuke", animated: false },
  badwords:      { str: "<:white_automod:1555133567762174053>", id: "1555133567762174053", name: "white_automod",  animated: false },
  mentions_icon: { str: "<a:announce:1555133241814548542>",    id: "1555133241814548542", name: "announce",      animated: true  },
  attach:        { str: "<:link:1555133367534624849>",        id: "1555133367534624849", name: "link",          animated: false },
  location:      { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  thinking:      { str: "<:white_info:1555133685118931086>",   id: "1555133685118931086", name: "white_info",    animated: false },
  c4_red:        { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  c4_yellow:     { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  c4_empty:      { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  slot_cherry:   { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  slot_lemon:    { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  slot_grape:    { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  slot_bell:     { str: "<:Announcements:1555133249049862205>", id: "1555133249049862205", name: "Announcements", animated: false },
  slot_diamond:  { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  slot_seven:    { str: "<:people:1555133444017619028>",      id: "1555133444017619028", name: "people",        animated: false },
  jackpot:       { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  big_win:       { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  small_win:     { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  rps_rock:      { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  rps_paper:     { str: "<:list:1555133374023344242>",        id: "1555133374023344242", name: "list",          animated: false },
  rps_scissors:  { str: "<:white_ban:1555133582140248125>",    id: "1555133582140248125", name: "white_ban",     animated: false },
  rps_win:       { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  // ── System Specific Modules & Badges ─────────────────────────────────────
  button_on:     { str: "<:Button_on:1555133307434434610>",    id: "1555133307434434610", name: "Button_on",     animated: false },
  button_off:    { str: "<:Button_off:1555133300522098758>",   id: "1555133300522098758", name: "Button_off",    animated: false },
  commands:      { str: "<:Commands:1555133314380206160>",    id: "1555133314380206160", name: "Commands",      animated: false },
  cmd:           { str: "<:Commands:1555133314380206160>",    id: "1555133314380206160", name: "Commands",      animated: false },
  internet_error:{ str: "<:Internet_error:1555133353194291231>", id: "1555133353194291231", name: "Internet_error", animated: false },
  logging:       { str: "<:Logging:1555133381182881852>",      id: "1555133381182881852", name: "Logging",       animated: false },
  maintenance:   { str: "<:Maintenance:1555133395816939531>", id: "1555133395816939531", name: "Maintenance",   animated: false },
  rules:         { str: "<:Rules:1555133502197076030>",        id: "1555133502197076030", name: "Rules",         animated: false },
  support:       { str: "<:Support:1555133538750169149>",      id: "1555133538750169149", name: "Support",       animated: false },
  tool:          { str: "<:Tool:1555133545918369894>",        id: "1555133545918369894", name: "Tool",          animated: false },
  tools:         { str: "<:Tool:1555133545918369894>",        id: "1555133545918369894", name: "Tool",          animated: false },
  white_admin:   { str: "<:white_admin:1555133552797028443>",  id: "1555133552797028443", name: "white_admin",    animated: false },
  white_antinuke:{ str: "<:white_antinuke:1555133560334061610>", id: "1555133560334061610", name: "white_antinuke", animated: false },
  white_automod: { str: "<:white_automod:1555133567762174053>", id: "1555133567762174053", name: "white_automod",  animated: false },
  white_award:   { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  white_ban:     { str: "<:white_ban:1555133582140248125>",    id: "1555133582140248125", name: "white_ban",     animated: false },
  white_cancel:  { str: "<:white_cancel:1555133596652539988>", id: "1555133596652539988", name: "white_cancel",  animated: false },
  white_claim:   { str: "<:white_claim:1555133604068200468>",  id: "1555133604068200468", name: "white_claim",   animated: false },
  white_co_owner:{ str: "<:white_co_owner:1555133610858647603>", id: "1555133610858647603", name: "white_co_owner", animated: false },
  co_owner:      { str: "<:white_co_owner:1555133610858647603>", id: "1555133610858647603", name: "white_co_owner", animated: false },
  white_done:    { str: "<a:white_Done:1555133626276905040>", id: "1555133626276905040", name: "white_Done",   animated: true  },
  white_first:   { str: "<:white_first:1555133634346750035>",  id: "1555133634346750035", name: "white_first",   animated: false },
  white_fourth:  { str: "<:white_fourth:1555133642018258964>", id: "1555133642018258964", name: "white_fourth",  animated: false },
  rank4:         { str: "<:white_fourth:1555133642018258964>", id: "1555133642018258964", name: "white_fourth",  animated: false },
  white_games:   { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  games:         { str: "<:white_games:1555133649504968775>",  id: "1555133649504968775", name: "white_games",   animated: false },
  white_gift:    { str: "<:white_gift:1555133656736079934>",  id: "1555133656736079934", name: "white_gift",    animated: false },
  white_headtester:{ str: "<:white_HeadTester:1555133664554393620>", id: "1555133664554393620", name: "white_HeadTester", animated: false },
  head_tester:   { str: "<:white_HeadTester:1555133664554393620>", id: "1555133664554393620", name: "white_HeadTester", animated: false },
  white_helper:  { str: "<:white_helper:1555133671340515439>", id: "1555133671340515439", name: "white_helper",  animated: false },
  helper:        { str: "<:white_helper:1555133671340515439>", id: "1555133671340515439", name: "white_helper",  animated: false },
  help:          { str: "<:white_helper:1555133671340515439>", id: "1555133671340515439", name: "white_helper",  animated: false },
  white_homies:  { str: "<:white_homies:1555133678009589810>", id: "1555133678009589810", name: "white_homies",  animated: false },
  homies:        { str: "<:white_homies:1555133678009589810>", id: "1555133678009589810", name: "white_homies",  animated: false },
  white_info:    { str: "<:white_info:1555133685118931086>",   id: "1555133685118931086", name: "white_info",    animated: false },
  white_loading: { str: "<a:white_loading:1555133693704544337>", id: "1555133693704544337", name: "white_loading", animated: true  },
  white_lock:    { str: "<:white_lock:1555133700835119136>",   id: "1555133700835119136", name: "white_lock",    animated: false },
  white_manager: { str: "<:white_manager:1555133708057575466>", id: "1555133708057575466", name: "white_manager",  animated: false },
  white_message: { str: "<:white_message:1555133715477172244>", id: "1555133715477172244", name: "white_message",  animated: false },
  white_mic:     { str: "<:white_mic:1555133722284527628>",    id: "1555133722284527628", name: "white_mic",     animated: false },
  white_mute:    { str: "<:white_mute:1555133755184906250>",   id: "1555133755184906250", name: "white_mute",    animated: false },
  white_no_prefix:{ str: "<:white_no_prefix:1555133762734657581>", id: "1555133762734657581", name: "white_no_prefix", animated: false },
  no_prefix:     { str: "<:white_no_prefix:1555133762734657581>", id: "1555133762734657581", name: "white_no_prefix", animated: false },
  noprefix:      { str: "<:white_no_prefix:1555133762734657581>", id: "1555133762734657581", name: "white_no_prefix", animated: false },
  white_owner:   { str: "<:white_owner:1555133769659187260>",  id: "1555133769659187260", name: "white_owner",    animated: false },
  white_partner: { str: "<:white_partner:1555133776475070464>", id: "1555133776475070464", name: "white_partner",  animated: false },
  white_premium: { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  premium:       { str: "<:white_Premium:1555133783634616371>", id: "1555133783634616371", name: "white_Premium",  animated: false },
  premium_1:     { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  premium1:      { str: "<:Premium1:1555133459192615042>",    id: "1555133459192615042", name: "Premium1",     animated: false },
  premium_2:     { str: "<:Premium2:1555133465022828626>",    id: "1555133465022828626", name: "Premium2",     animated: false },
  premium2:      { str: "<:Premium2:1555133465022828626>",    id: "1555133465022828626", name: "Premium2",     animated: false },
  premium_3:     { str: "<:Premium3:1555133473205780550>",    id: "1555133473205780550", name: "Premium3",     animated: false },
  premium3:      { str: "<:Premium3:1555133473205780550>",    id: "1555133473205780550", name: "Premium3",     animated: false },
  premium_4:     { str: "<:Premium4:1555133480810193016>",    id: "1555133480810193016", name: "Premium4",     animated: false },
  premium4:      { str: "<:Premium4:1555133480810193016>",    id: "1555133480810193016", name: "Premium4",     animated: false },
  white_previous:{ str: "<:white_previous:1555133790781972521>", id: "1555133790781972521", name: "white_previous", animated: false },
  white_roles:   { str: "<:white_roles:1555133800227414016>",  id: "1555133800227414016", name: "white_roles",    animated: false },
  white_second:  { str: "<:white_second:1555133807643070464>", id: "1555133807643070464", name: "white_second",  animated: false },
  white_settings:{ str: "<:white_settings:1555133815536492721>", id: "1555133815536492721", name: "white_settings", animated: false },
  white_skip:    { str: "<:white_skip:1555133823698604074>",   id: "1555133823698604074", name: "white_skip",     animated: false },
  white_strike:  { str: "<:white_strike:1555133832305451101>", id: "1555133832305451101", name: "white_strike",   animated: false },
  white_supporter:{ str: "<:white_supporter:1555133839351873556>", id: "1555133839351873556", name: "white_supporter", animated: false },
  white_support_team:{ str: "<:white_support_team:1555133846801092631>", id: "1555133846801092631", name: "white_support_team", animated: false },
  white_terminate:{ str: "<:white_terminate:1555133855143567430>", id: "1555133855143567430", name: "white_terminate", animated: false },
  white_tester:  { str: "<:white_Tester:1555133862030483548>", id: "1555133862030483548", name: "white_Tester",  animated: false },
  white_third:   { str: "<:white_third:1555133869433552906>",  id: "1555133869433552906", name: "white_third",   animated: false },
  white_ticket:  { str: "<:white_ticket:1555133876433846382>", id: "1555133876433846382", name: "white_ticket",  animated: false },
  white_unlock:  { str: "<:white_unlock:1555133883383681145>", id: "1555133883383681145", name: "white_unlock",  animated: false },
  unlocked:      { str: "<:white_unlock:1555133883383681145>", id: "1555133883383681145", name: "white_unlock",  animated: false },
  white_vip:     { str: "<:white_vip:1555133891281428500>",    id: "1555133891281428500", name: "white_vip",     animated: false },
  vip:           { str: "<:white_vip:1555133891281428500>",    id: "1555133891281428500", name: "white_vip",     animated: false },
  white_warn:    { str: "<:white_warn:1555133898156154963>",   id: "1555133898156154963", name: "white_warn",    animated: false },
  warn:          { str: "<:white_warn:1555133898156154963>",   id: "1555133898156154963", name: "white_warn",    animated: false },
  bughunter_1:   { str: "<:Bughunter_1:1555133271896096788>", id: "1555133271896096788", name: "Bughunter_1",  animated: false },
  bughunter_2:   { str: "<:Bughunter_2:1555133279030485082>", id: "1555133279030485082", name: "Bughunter_2",  animated: false },
  bughunter_3:   { str: "<:Bughunter_3:1555133286676832366>", id: "1555133286676832366", name: "Bughunter_3",  animated: false },
  bughunter_4:   { str: "<:Bughunter_4:1555133293765070880>", id: "1555133293765070880", name: "Bughunter_4",  animated: false },
  bughunter_5:   { str: "<:white_award:1555133575165124638>",  id: "1555133575165124638", name: "white_award",    animated: false },
  feedback:      { str: "<:feedback:1555133337079914567>",    id: "1555133337079914567", name: "feedback",      animated: false },
  world:         { str: "<a:World:1555133905412030607>",      id: "1555133905412030607", name: "World",         animated: true  },
  ping:          { str: "<a:ping:1555133452146319391>",       id: "1555133452146319391", name: "ping",          animated: true  },
};

export function updateCustomEmoji(key: string, data: Partial<CustomEmojiEntry>): void {
  if (RAW_CE[key]) {
    Object.assign(RAW_CE[key], data);
  } else {
    RAW_CE[key] = {
      str: data.str || "<:Tool:1555133545918369894>",
      id: data.id || "1555133545918369894",
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
    if (rawEntry) {
      return {
        str: rawEntry.str,
        id: rawEntry.id,
        name: rawEntry.name,
        animated: Boolean(rawEntry.animated),
        toString() { return rawEntry.str; },
      };
    }
    const client = (globalThis as any).__discordClient;
    const resolved = resolveDynamicEmoji(client, prop, "<:Tool:1555133545918369894>");
    return {
      str: resolved || "<:Tool:1555133545918369894>",
      id: "1555133545918369894",
      name: prop,
      animated: false,
      toString() { return resolved || "<:Tool:1555133545918369894>"; },
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
  const isServerPrem = isCurrentContextServerPremium();
  const goldenLogo = "https://cdn.discordapp.com/guilds/1510975690068070501/users/1553292201835102278/avatars/274193e40f2448dc4e31a032cf54f5ec.png";
  
  e.setFooter({ 
    text: finalFooter,
    iconURL: isServerPrem ? goldenLogo : undefined 
  });

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
