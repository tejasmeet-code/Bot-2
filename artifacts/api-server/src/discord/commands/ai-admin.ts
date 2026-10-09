import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildChannel,
} from "discord.js";
import type { SlashCommand } from "../types";
import { COLORS, CE, errorEmbed, prettyEmbed } from "../utils/embedStyle";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../../lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AdminAction {
  type: string;
  description: string;
  params: Record<string, unknown>;
}

interface AdminPlan {
  summary: string;
  warning?: string;
  actions: AdminAction[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini API Call via `@google/genai` TypeScript SDK
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<AdminPlan> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  let lastError: Error | null = null;

  if (apiKey) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const modelsToTry = [
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-pro-preview",
    ];

    for (const modelName of modelsToTry) {
      try {
        logger.info({ model: modelName }, "Attempting AI Admin plan generation via Gemini...");
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.15,
          }
        });

        const text = response.text;
        if (!text) throw new Error("Received empty text response");
        if (text.includes('"error"') && text.includes('"message"')) throw new Error(`API error payload: ${text}`);

        const parsed = JSON.parse(text) as any;
        if (parsed.error || !parsed.actions) throw new Error(parsed.error?.message || "Invalid payload structure - missing actions");

        logger.info({ model: modelName }, "AI Admin plan generation via Gemini succeeded!");
        return parsed as AdminPlan;
      } catch (err: any) {
        logger.warn({ model: modelName, err: err.message || String(err) }, "Gemini model call failed, trying next...");
        lastError = err;
      }
    }
  }

  // Fallback to OpenRouter if Gemini fails or is unavailable
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const openRouterModels = [
      "deepseek/deepseek-chat",
      "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-small-24b-instruct-2501",
    ];

    for (const modelName of openRouterModels) {
      try {
        logger.info({ model: modelName }, "Attempting AI Admin plan generation via OpenRouter...");
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          const rawContent = data.choices?.[0]?.message?.content;
          if (rawContent) {
            const cleanJson = rawContent.replace(/```json\n?|\n?```/g, "").trim();
            const parsed = JSON.parse(cleanJson) as any;
            if (parsed.actions && Array.isArray(parsed.actions)) {
              logger.info({ model: modelName }, "AI Admin plan generation via OpenRouter succeeded!");
              return parsed as AdminPlan;
            }
          }
        }
      } catch (err: any) {
        logger.warn({ model: modelName, err: err.message || String(err) }, "OpenRouter model call failed...");
        lastError = err;
      }
    }
  }

  throw new Error(`All AI models failed. Last error: ${lastError?.message || String(lastError)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Executor Engine & Helper Resolvers
// ─────────────────────────────────────────────────────────────────────────────

interface ExecutionContextState {
  lastCreatedCategoryId: string | null;
  lastCreatedChannelId: string | null;
  lastCreatedRoleId: string | null;
  createdChannelsByRef: Map<string, any>;
  createdRolesByRef: Map<string, any>;
  createdCategoriesList: any[];
  createdChannelsList: any[];
  createdRolesList: any[];
}

const PERM_MAP: Record<string, string> = {
  // View / Read
  viewchannel: "ViewChannel",
  view_channel: "ViewChannel",
  viewchannels: "ViewChannel",
  view: "ViewChannel",
  readmessages: "ViewChannel",
  read_messages: "ViewChannel",
  readchannel: "ViewChannel",
  read_channel: "ViewChannel",

  // Send Messages
  sendmessages: "SendMessages",
  send_messages: "SendMessages",
  sendmessage: "SendMessages",
  send_message: "SendMessages",
  send: "SendMessages",
  write: "SendMessages",
  writemessages: "SendMessages",
  write_messages: "SendMessages",

  // Message History
  readmessagehistory: "ReadMessageHistory",
  read_message_history: "ReadMessageHistory",
  readhistory: "ReadMessageHistory",
  read_history: "ReadMessageHistory",

  // Voice
  connect: "Connect",
  join: "Connect",
  connectvoice: "Connect",
  connect_voice: "Connect",
  speak: "Speak",
  talk: "Speak",
  speakvoice: "Speak",
  speak_voice: "Speak",
  usevad: "UseVAD",
  use_vad: "UseVAD",

  // Media & Attachments
  attachfiles: "AttachFiles",
  attach_files: "AttachFiles",
  attachfile: "AttachFiles",
  attach_file: "AttachFiles",
  embedlinks: "EmbedLinks",
  embed_links: "EmbedLinks",
  embedlink: "EmbedLinks",
  embed_link: "EmbedLinks",
  addreactions: "AddReactions",
  add_reactions: "AddReactions",
  addreaction: "AddReactions",
  add_reaction: "AddReactions",
  useexternalemojis: "UseExternalEmojis",
  use_external_emojis: "UseExternalEmojis",
  useexternalstickers: "UseExternalStickers",
  use_external_stickers: "UseExternalStickers",

  // Management
  managemessages: "ManageMessages",
  manage_messages: "ManageMessages",
  managemessage: "ManageMessages",
  manage_message: "ManageMessages",
  managechannels: "ManageChannels",
  manage_channels: "ManageChannels",
  managechannel: "ManageChannels",
  manage_channel: "ManageChannels",
  manageroles: "ManageRoles",
  manage_roles: "ManageRoles",
  managerole: "ManageRoles",
  manage_role: "ManageRoles",
  managewebhooks: "ManageWebhooks",
  manage_webhooks: "ManageWebhooks",
  managethreads: "ManageThreads",
  manage_threads: "ManageThreads",

  // Moderation & Server
  administrator: "Administrator",
  admin: "Administrator",
  manageguild: "ManageGuild",
  manage_guild: "ManageGuild",
  manageserver: "ManageGuild",
  manage_server: "ManageGuild",
  kickmembers: "KickMembers",
  kick_members: "KickMembers",
  kick: "KickMembers",
  banmembers: "BanMembers",
  ban_members: "BanMembers",
  ban: "BanMembers",
  mutemembers: "MuteMembers",
  mute_members: "MuteMembers",
  mute: "MuteMembers",
  deafenmembers: "DeafenMembers",
  deafen_members: "DeafenMembers",
  deafen: "DeafenMembers",
  movemembers: "MoveMembers",
  move_members: "MoveMembers",
  move: "MoveMembers",

  // Invites & Commands
  useapplicationcommands: "UseApplicationCommands",
  use_application_commands: "UseApplicationCommands",
  useslashcommands: "UseApplicationCommands",
  use_slash_commands: "UseApplicationCommands",
  mentioneveryone: "MentionEveryone",
  mention_everyone: "MentionEveryone",
  createinstantinvite: "CreateInstantInvite",
  create_instant_invite: "CreateInstantInvite",
  createinvite: "CreateInstantInvite",
  create_invite: "CreateInstantInvite",
};

function normalizePermissionKey(raw: string): string {
  const clean = String(raw).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (PERM_MAP[clean]) return PERM_MAP[clean];
  const pascal = String(raw)
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return pascal;
}

function parseColorInput(colorStr: string): any {
  if (!colorStr) return undefined;
  const s = String(colorStr).trim().toLowerCase();
  const COLOR_NAMES: Record<string, string> = {
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    gold: "#ffaa00",
    purple: "#aa00ff",
    cyan: "#00ffff",
    teal: "#00ffcc",
    magenta: "#ff00ff",
    orange: "#ff6600",
    white: "#ffffff",
    black: "#000000",
    gray: "#808080",
  };
  if (COLOR_NAMES[s]) return COLOR_NAMES[s];
  const hexClean = s.replace("#", "");
  if (/^[0-9a-f]{6}$/.test(hexClean)) return `#${hexClean}`;
  return undefined;
}

function resolveChannel(guild: Guild, idOrName: string, state: ExecutionContextState): any {
  if (!idOrName) return null;
  const s = String(idOrName).trim();
  const lower = s.toLowerCase();

  // Check ID mention format <#123456> or direct ID
  const idMatch = s.match(/<#?(\d+)>/) || s.match(/^(\d+)$/);
  if (idMatch) {
    const directId = idMatch[1];
    const found = state.createdChannelsByRef?.get(directId) || guild.channels.cache.get(directId);
    if (found) return found;
  }

  if (state.createdChannelsByRef?.has(lower)) {
    return state.createdChannelsByRef.get(lower);
  }

  if (s === "last_category" || s === "last_created_category" || s === "temp_category") {
    if (state.lastCreatedCategoryId) {
      return state.createdChannelsByRef?.get(state.lastCreatedCategoryId) || guild.channels.cache.get(state.lastCreatedCategoryId) || null;
    }
  }
  if (s === "last_channel" || s === "last_created_channel" || s === "temp_channel") {
    if (state.lastCreatedChannelId) {
      return state.createdChannelsByRef?.get(state.lastCreatedChannelId) || guild.channels.cache.get(state.lastCreatedChannelId) || null;
    }
  }

  const direct = guild.channels.cache.get(s);
  if (direct) return direct;

  const cleanSearch = lower.replace(/^[^\w]+/, "").trim();

  if (state.createdChannelsByRef) {
    for (const ch of state.createdChannelsByRef.values()) {
      if (!ch || !ch.name) continue;
      const cName = ch.name.toLowerCase();
      const cClean = cName.replace(/^[^\w]+/, "").trim();
      if (cName === lower || cClean === cleanSearch || cName.includes(lower) || lower.includes(cName)) {
        return ch;
      }
    }
  }

  const byName = guild.channels.cache.find((c) => {
    const cName = c.name.toLowerCase();
    const cClean = cName.replace(/^[^\w]+/, "").trim();
    return cName === lower || cClean === cleanSearch || cName.includes(lower) || lower.includes(cName);
  });

  return byName ?? null;
}

function resolveRole(guild: Guild, idOrName: string, state: ExecutionContextState): any {
  if (!idOrName) return null;
  const s = String(idOrName).trim();
  const lower = s.toLowerCase();

  if (lower.includes("everyone") || s === guild.id) {
    return guild.roles.everyone;
  }

  const roleMention = s.match(/<@&?(\d+)>/) || s.match(/^(\d+)$/);
  if (roleMention) {
    const directId = roleMention[1];
    const found = state.createdRolesByRef?.get(directId) || guild.roles.cache.get(directId);
    if (found) return found;
  }

  if (s === "last_role" || s === "last_created_role" || s === "temp_role") {
    if (state.lastCreatedRoleId) {
      return state.createdRolesByRef?.get(state.lastCreatedRoleId) || guild.roles.cache.get(state.lastCreatedRoleId) || null;
    }
  }

  if (state.createdRolesByRef?.has(lower)) {
    return state.createdRolesByRef.get(lower);
  }

  const direct = guild.roles.cache.get(s);
  if (direct) return direct;

  if (state.createdRolesByRef) {
    for (const r of state.createdRolesByRef.values()) {
      if (!r || !r.name) continue;
      if (r.name.toLowerCase() === lower || r.name.toLowerCase().includes(lower)) {
        return r;
      }
    }
  }

  const byName = guild.roles.cache.find((r) => r.name.toLowerCase() === lower || r.name.toLowerCase().includes(lower));
  return byName ?? null;
}

async function resolveMember(guild: Guild, idOrMention: string): Promise<any> {
  if (!idOrMention) return null;
  const raw = String(idOrMention).trim();
  const match = raw.match(/<@!?(\d+)>/);
  const userId = match ? match[1] : (raw.match(/^\d+$/) ? raw : null);
  if (userId) {
    const m = await guild.members.fetch(userId).catch(() => null);
    if (m) return m;
  }
  const clean = raw.toLowerCase().replace("@", "");
  const cached = guild.members.cache.find((m) =>
    m.user.username.toLowerCase() === clean ||
    m.displayName.toLowerCase() === clean ||
    m.user.tag.toLowerCase() === clean
  );
  if (cached) return cached;

  const fetched = await guild.members.fetch({ query: clean, limit: 1 }).catch(() => null);
  return fetched?.first() ?? null;
}

async function executeAction(
  guild: Guild,
  action: AdminAction,
  state: ExecutionContextState,
): Promise<{ success: boolean; message: string }> {
  try {
    const p = action.params as Record<string, any>;
    const type = String(action.type || "").toLowerCase();

    switch (type) {
      // ── Categories & Channels ──────────────────────────────────────────────
      case "create_category":
      case "create_channel": {
        const isCat = type === "create_category" || p.type === "category";
        const channelType =
          isCat ? ChannelType.GuildCategory
          : p.type === "voice" ? ChannelType.GuildVoice
          : ChannelType.GuildText;

        let parentCategory: string | undefined = undefined;
        if (!isCat && (p.parent_id || p.parent || p.category || p.parent_category)) {
          const parentRef = String(p.parent_id || p.parent || p.category || p.parent_category);
          const parentCh = resolveChannel(guild, parentRef, state);
          if (parentCh && parentCh.type === ChannelType.GuildCategory) {
            parentCategory = parentCh.id;
          }
        }

        const chName = String(p.name || p.channel_name || p.title || p.category_name || "new-channel");
        const ch = await guild.channels.create({
          name: chName,
          type: channelType,
          topic: p.topic ? String(p.topic) : undefined,
          rateLimitPerUser: p.slowmode ? Number(p.slowmode) : 0,
          parent: parentCategory,
          reason: "Created by AI Admin Directive",
        });

        // Register in instant cache & execution state maps
        guild.channels.cache.set(ch.id, ch as any);
        state.lastCreatedChannelId = ch.id;
        state.createdChannelsByRef.set(ch.id, ch);
        state.createdChannelsByRef.set(ch.name.toLowerCase(), ch);
        state.createdChannelsByRef.set(ch.name.toLowerCase().replace(/^[^\w]+/, "").trim(), ch);
        state.createdChannelsByRef.set("last_channel", ch);
        state.createdChannelsByRef.set("last_created_channel", ch);

        if (channelType === ChannelType.GuildCategory) {
          state.createdCategoriesList.push(ch);
          const catIndex = state.createdCategoriesList.length;
          state.lastCreatedCategoryId = ch.id;
          state.createdChannelsByRef.set("last_category", ch);
          state.createdChannelsByRef.set("last_created_category", ch);
          state.createdChannelsByRef.set(`category_${catIndex}`, ch);
          state.createdChannelsByRef.set(`category${catIndex}`, ch);
          state.createdChannelsByRef.set(`cat_${catIndex}`, ch);
          state.createdChannelsByRef.set(`cat${catIndex}`, ch);
          state.createdChannelsByRef.set(`parent_${catIndex}`, ch);
          state.createdChannelsByRef.set(`parent${catIndex}`, ch);
          state.createdChannelsByRef.set(`${catIndex}`, ch);
        } else {
          state.createdChannelsList.push(ch);
          const chanIndex = state.createdChannelsList.length;
          state.createdChannelsByRef.set(`channel_${chanIndex}`, ch);
          state.createdChannelsByRef.set(`channel${chanIndex}`, ch);
          state.createdChannelsByRef.set(`chan_${chanIndex}`, ch);
          state.createdChannelsByRef.set(`chan${chanIndex}`, ch);
          state.createdChannelsByRef.set(`ch_${chanIndex}`, ch);
          state.createdChannelsByRef.set(`ch${chanIndex}`, ch);
        }

        return { success: true, message: `Created ${isCat ? "category" : "channel"} <#${ch.id}> (\`${p.type || (isCat ? "category" : "text")}\`)` };
      }

      case "delete_channel": {
        const ch = resolveChannel(guild, String(p.channel_id || p.channel || p.channel_name || p.name), state);
        if (!ch) return { success: false, message: `Channel \`${p.channel_id || p.channel || p.name}\` not found` };
        const name = ch.name;
        await ch.delete(p.reason ? String(p.reason) : "Deleted by AI Admin Directive");
        return { success: true, message: `Deleted channel \`#${name}\`` };
      }

      case "edit_channel": {
        const ch = resolveChannel(guild, String(p.channel_id || p.channel || p.channel_name || p.name), state);
        if (!ch) return { success: false, message: `Channel \`${p.channel_id || p.channel}\` not found` };

        let parentCat: string | null | undefined = undefined;
        if (p.parent_id !== undefined || p.parent !== undefined || p.category !== undefined) {
          const pref = p.parent_id ?? p.parent ?? p.category;
          if (!pref) {
            parentCat = null;
          } else {
            const catCh = resolveChannel(guild, String(pref), state);
            if (catCh && catCh.type === ChannelType.GuildCategory) {
              parentCat = catCh.id;
            }
          }
        }

        await (ch as any).edit({
          ...(p.name ? { name: String(p.name) } : {}),
          ...(p.topic !== undefined ? { topic: String(p.topic) } : {}),
          ...(p.slowmode !== undefined ? { rateLimitPerUser: Number(p.slowmode) } : {}),
          ...(parentCat !== undefined ? { parent: parentCat } : {}),
        });
        return { success: true, message: `Edited channel <#${ch.id}>` };
      }

      case "lock":
      case "lock_channel":
      case "lockdown": {
        const ch = resolveChannel(guild, String(p.channel_id || p.channel || p.channel_name || "last_channel"), state);
        if (!ch) return { success: false, message: `Channel not found for lockdown` };
        await (ch as any).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return { success: true, message: `Locked sending messages in <#${ch.id}>` };
      }

      case "unlock":
      case "unlock_channel": {
        const ch = resolveChannel(guild, String(p.channel_id || p.channel || p.channel_name || "last_channel"), state);
        if (!ch) return { success: false, message: `Channel not found for unlock` };
        await (ch as any).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        return { success: true, message: `Unlocked sending messages in <#${ch.id}>` };
      }

      case "set_slowmode": {
        const ch = resolveChannel(guild, String(p.channel_id || p.channel || p.channel_name), state);
        if (!ch) return { success: false, message: `Channel not found for slowmode` };
        await (ch as any).setRateLimitPerUser(Number(p.seconds || 0));
        return { success: true, message: `Set slowmode to ${p.seconds || 0}s in <#${ch.id}>` };
      }

      case "set_channel_permissions":
      case "manage_permissions":
      case "set_permissions":
      case "edit_permissions":
      case "manage_perms": {
        const channelRef = p.channel_id || p.channel || p.channel_name || p.target_channel || p.name || p.id || "last_channel";
        const ch = resolveChannel(guild, String(channelRef), state);
        if (!ch) return { success: false, message: `Channel \`${channelRef}\` not found` };

        const targetRef = p.target_id || p.target || p.role_id || p.role || p.role_name || p.user_id || p.user || p.member || p.target_role || "everyone";
        let target = resolveRole(guild, String(targetRef), state);
        if (!target) {
          target = await resolveMember(guild, String(targetRef));
        }
        if (!target) return { success: false, message: `Target entity \`${targetRef}\` not found` };

        const allow: string[] = Array.isArray(p.allow) ? p.allow : (typeof p.allow === "string" ? p.allow.split(",").map((s) => s.trim()) : []);
        const deny: string[] = Array.isArray(p.deny) ? p.deny : (typeof p.deny === "string" ? p.deny.split(",").map((s) => s.trim()) : []);
        const overwrite: Record<string, boolean | null> = {};

        for (const perm of allow) {
          if (!perm) continue;
          const normKey = normalizePermissionKey(perm);
          overwrite[normKey] = true;
        }
        for (const perm of deny) {
          if (!perm) continue;
          const normKey = normalizePermissionKey(perm);
          overwrite[normKey] = false;
        }

        try {
          await (ch as any).permissionOverwrites.edit(target, overwrite);
          return { success: true, message: `Updated permissions for **${target.name || target.user?.tag || "Target"}** in <#${ch.id}>` };
        } catch (err: any) {
          return { success: false, message: `Permission update in <#${ch.id}>: ${err.message || String(err)}` };
        }
      }

      // ── Roles ─────────────────────────────────────────────────────────────
      case "create_role": {
        const roleColor = parseColorInput(p.color);
        const role = await guild.roles.create({
          name: String(p.name || p.role_name || p.title || "New Role"),
          color: roleColor,
          hoist: Boolean(p.hoist),
          mentionable: Boolean(p.mentionable),
          reason: "Created by AI Admin Directive",
        });

        guild.roles.cache.set(role.id, role);
        state.lastCreatedRoleId = role.id;
        state.createdRolesByRef.set(role.id, role);
        state.createdRolesByRef.set(role.name.toLowerCase(), role);
        state.createdRolesByRef.set("last_role", role);
        state.createdRolesByRef.set("last_created_role", role);

        state.createdRolesList.push(role);
        const roleIndex = state.createdRolesList.length;
        state.createdRolesByRef.set(`role_${roleIndex}`, role);
        state.createdRolesByRef.set(`role${roleIndex}`, role);
        state.createdRolesByRef.set(`r_${roleIndex}`, role);
        state.createdRolesByRef.set(`r${roleIndex}`, role);

        return { success: true, message: `Created role <@&${role.id}> with color \`${p.color || "Default"}\`` };
      }

      case "delete_role": {
        const role = resolveRole(guild, String(p.role_id || p.role || p.name), state);
        if (!role) return { success: false, message: `Role \`${p.role_id || p.role}\` not found` };
        const name = role.name;
        await role.delete(p.reason ? String(p.reason) : "Deleted by AI Admin Directive");
        return { success: true, message: `Deleted role \`${name}\`` };
      }

      case "edit_role": {
        const role = resolveRole(guild, String(p.role_id || p.role), state);
        if (!role) return { success: false, message: `Role \`${p.role_id || p.role}\` not found` };
        await role.edit({
          ...(p.name ? { name: String(p.name) } : {}),
          ...(p.color ? { color: String(p.color) as any } : {}),
          ...(p.hoist !== undefined ? { hoist: Boolean(p.hoist) } : {}),
          ...(p.mentionable !== undefined ? { mentionable: Boolean(p.mentionable) } : {}),
        });
        return { success: true, message: `Edited role <@&${role.id}>` };
      }

      case "set_role_position":
      case "organize_roles":
      case "organize_role":
      case "move_role": {
        const roleRef = p.role_id || p.role || p.name || "last_role";
        const role = resolveRole(guild, String(roleRef), state);
        if (!role) return { success: false, message: `Role \`${roleRef}\` not found` };
        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        const maxPos = botMember ? Math.max(1, botMember.roles.highest.position - 1) : 10;
        const targetPos = Math.max(1, Math.min(Number(p.position || 1), maxPos));
        try {
          await role.setPosition(targetPos);
          return { success: true, message: `Set position of role <@&${role.id}> to \`${targetPos}\`` };
        } catch (err: any) {
          return { success: false, message: `Positioned role <@&${role.id}> within allowed height limit` };
        }
      }

      case "add_role":
      case "give_role":
      case "assign_role": {
        const member = await resolveMember(guild, String(p.user_id || p.user || p.member));
        if (!member) return { success: false, message: `Member \`${p.user_id || p.user}\` not found` };
        const role = resolveRole(guild, String(p.role_id || p.role), state);
        if (!role) return { success: false, message: `Role \`${p.role_id || p.role}\` not found` };
        await member.roles.add(role.id, p.reason ? String(p.reason) : "AI Admin Directive");
        return { success: true, message: `Assigned role <@&${role.id}> to <@${member.id}>` };
      }

      case "remove_role":
      case "take_role": {
        const member = await resolveMember(guild, String(p.user_id || p.user || p.member));
        if (!member) return { success: false, message: `Member \`${p.user_id || p.user}\` not found` };
        const role = resolveRole(guild, String(p.role_id || p.role), state);
        if (!role) return { success: false, message: `Role \`${p.role_id || p.role}\` not found` };
        await member.roles.remove(role.id, p.reason ? String(p.reason) : "AI Admin Directive");
        return { success: true, message: `Removed role <@&${role.id}> from <@${member.id}>` };
      }

      // ── Moderation & Safety ───────────────────────────────────────────────
      case "kick_member": {
        const member = await guild.members.fetch(String(p.user_id)).catch(() => null);
        if (!member) return { success: false, message: `Member \`${p.user_id}\` not found` };
        if (!member.kickable) return { success: false, message: `Cannot kick <@${p.user_id}> due to role hierarchy.` };
        await member.kick(p.reason ? String(p.reason) : "Kicked by AI Admin Directive");
        return { success: true, message: `Successfully kicked member <@${p.user_id}>` };
      }

      case "ban_member": {
        const member = await guild.members.fetch(String(p.user_id)).catch(() => null);
        if (member && !member.bannable) return { success: false, message: `Cannot ban <@${p.user_id}> due to role hierarchy.` };
        await guild.members.ban(String(p.user_id), { reason: p.reason ? String(p.reason) : "Banned by AI Admin Directive" });
        return { success: true, message: `Successfully banned user ID \`${p.user_id}\`` };
      }

      case "timeout_member": {
        const member = await guild.members.fetch(String(p.user_id)).catch(() => null);
        if (!member) return { success: false, message: `Member \`${p.user_id}\` not found` };
        const ms = Number(p.duration_minutes) * 60 * 1000;
        await member.timeout(ms, p.reason ? String(p.reason) : "Timed out by AI Admin Directive");
        return { success: true, message: `Timed out <@${p.user_id}> for ${p.duration_minutes} minutes` };
      }

      // ── Intelligence Enhanced Messaging & Announcements ───────────────────
      case "send_message": {
        const ch = resolveChannel(guild, String(p.channel_id), state);
        if (!ch || !ch.isTextBased()) return { success: false, message: `Channel \`${p.channel_id}\` not found or not text-based` };
        
        let messagePayload: any = { content: String(p.content) };
        if (typeof p.content === "string" && p.content.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(p.content);
            if (parsed.embeds || parsed.content) {
              messagePayload = parsed;
            }
          } catch {}
        } else if (p.embed) {
          const emb = new EmbedBuilder();
          if (p.embed.title) emb.setTitle(p.embed.title);
          if (p.embed.description) emb.setDescription(p.embed.description);
          if (p.embed.color) emb.setColor(p.embed.color);
          if (p.embed.fields && Array.isArray(p.embed.fields)) {
            emb.addFields(p.embed.fields);
          }
          if (p.embed.thumbnail) emb.setThumbnail(p.embed.thumbnail);
          if (p.embed.footer) emb.setFooter({ text: p.embed.footer });
          messagePayload = { embeds: [emb] };
        }
        
        await (ch as any).send(messagePayload);
        return { success: true, message: `Sent customized announcement message in <#${p.channel_id}>` };
      }

      case "execute_command": {
        const cmdName = String(p.command || "").trim().toLowerCase();
        const cmdArgsStr = String(p.args || "").trim();
        const { getCommandMap } = await import("../registry");
        const commandMap = getCommandMap();
        const command = commandMap.get(cmdName);
        if (!command) return { success: false, message: `Command \`/${cmdName}\` not found in bot commands registry` };

        const argParts = cmdArgsStr ? cmdArgsStr.split(/\s+/) : [];
        const targetChannel = guild.channels.cache.get(String(p.channel_id)) || guild.systemChannel || guild.channels.cache.find((c: any) => c.isTextBased());
        const mockExecInteraction: any = {
          isButton: () => false,
          isModalSubmit: () => false,
          isAnySelectMenu: () => false,
          isStringSelectMenu: () => false,
          isMessageComponent: () => false,
          isChatInputCommand: () => true,
          isCommand: () => true,
          inGuild: () => true,
          guildId: guild.id,
          guild,
          user: (guild.client as any).user || guild.members.me?.user,
          member: guild.members.me,
          memberPermissions: guild.members.me?.permissions,
          channel: targetChannel,
          client: guild.client,
          replied: false,
          deferred: false,
          options: {
            getUser: () => null,
            getString: (name: string) => (name === "query" || name === "instruction" || name === "name" || name === "reason") ? cmdArgsStr : (argParts[0] || "Default"),
            getInteger: () => Number(argParts[0]) || null,
            getNumber: () => Number(argParts[0]) || null,
            getBoolean: () => true,
            getRole: () => null,
            getChannel: () => null,
            getMentionable: () => null,
            getAttachment: () => null,
            getMember: () => null,
            getSubcommand: () => argParts[0] || null,
            getSubcommandGroup: () => null,
          },
          deferReply: async () => {},
          editReply: async () => {},
          reply: async () => {},
          followUp: async () => {},
          rawArgs: argParts,
        };

        try {
          await command.execute(mockExecInteraction);
          return { success: true, message: `Successfully executed command \`/${cmdName} ${cmdArgsStr}\`` };
        } catch (err: any) {
          return { success: false, message: `Command execution \`/${cmdName}\` returned: ${err.message || String(err)}` };
        }
      }

      case "set_bot_nickname": {
        const nick = String(p.nickname || "Zenith Bot").trim();
        const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!me) return { success: false, message: "Could not resolve bot member object" };
        await me.setNickname(nick);
        return { success: true, message: `Set bot server nickname to **${nick}**` };
      }

      default:
        return { success: false, message: `Unknown server instruction action: \`${action.type}\`` };
    }
  } catch (err: any) {
    const msg = err.message || String(err);
    logger.error({ err, action: action.type }, "Failed to execute AI Admin sub-task");
    return { success: false, message: `Failed: ${msg.slice(0, 150)}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Definition
// ─────────────────────────────────────────────────────────────────────────────

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ai-admin")
    .setDescription("Use AI to design, customize, and execute server setup tasks safely.")
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName("instruction")
        .setDescription("Describe what you want to setup, e.g. 'Create a full announcements space with read-only rules'")
        .setRequired(true)
        .setMaxLength(1000),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    const guild = interaction.guild;

    await interaction.deferReply();

    let instruction = interaction.options.getString("instruction");
    if (!instruction) {
      // @ts-ignore (Support prefix fallback parsing)
      const rawArgs = interaction.rawArgs || [];
      instruction = rawArgs.join(" ");
    }

    if (!instruction || instruction.trim().length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed("Missing Instruction", "Please provide what you want the AI Admin to do! (e.g. `.ai-admin Create rules channel and staff logs`)")]
      });
      return;
    }

    // Capture channels and roles mapping for smart references
    const channelCtx = [...guild.channels.cache.values()]
      .slice(0, 60)
      .map((c) => `${c.name} (id:${c.id}, type:${ChannelType[c.type]})`)
      .join(", ");

    const roleCtx = [...guild.roles.cache.values()]
      .filter((r) => r.name !== "@everyone")
      .slice(0, 30)
      .map((r) => `${r.name} (id:${r.id})`)
      .join(", ");

    // System prompt trained heavily on Discord mechanics & design standards
    const systemPrompt = `You are an elite Discord Server Architect and AI Administrator.
Given a server instruction, create an intelligent, aesthetically polished, and safe plan of actions.

DESIGN STANDARDS (Trained on Discord best practices):
1. CHANNEL STYLING:
   - For public, chat, or informational channels, always prepend relevant, expressive custom symbols/emojis.
     Examples:
     - Announcements: 📢-announcements, 📢-updates
     - Rules: 📜-rules-and-info, 📖-guidelines
     - General: 💬-lounge, 💬-general-chat
     - Commands/Media: 🤖-bot-commands, 🖼-media-share
     - Staff Logs: 🛠-staff-logs, 🛡-audit-trail
   - Always use lowercase and hyphens to replace spaces for text channels.
2. CATEGORY GROUPINGS:
   - Use uppercase with clean decorative sidebars to split server sections:
     Examples: "━━ INFORMATION ━━", "━━ SOCIAL SPACE ━━", "━━ STAFF ONLY ━━"
   - Category creation should always be scheduled first, then channels created inside them by passing parent_id.
3. SECURITY & PERMISSIONS:
   - Announcements and Rules spaces should be read-only for "@everyone" (deny: ["SendMessages"], allow: ["ViewChannel", "ReadMessageHistory"]) but fully writeable for Admins/Staff.
   - Staff rooms must be completely invisible to "@everyone" (deny: ["ViewChannel"]) but visible to staff.
4. ENHANCED ANNOUNCEMENTS:
   - If the user asks for announcements, rules, or greetings, use "send_message" with a highly aesthetic "embed" payload inside the params.
   - Embed colors should be premium-matching (Hex: #00ffcc, #ff3366, #ffaa00). Format with structured fields, bold subheaders, and decorative dividing lines.

SERVER CONTEXT:
- Guild Name: "${guild.name}"
- Active Channels: ${channelCtx || "(none)"}
- Existing Roles: ${roleCtx || "(none)"}

RULES & GUARDRAILS:
- NEVER delete more than 2 channels or roles in a single plan.
- NEVER execute mass bans, kicks, or server nukes.
- If the instruction is dangerous or completely nonsense, output an empty action list with a warning.
- Always use the exact role IDs or channel IDs from context when referencing existing things.

AVAILABLE ACTIONS SCHEMA:
execute_command  → { command: string, args: string, channel_id?: string } // Execute ANY bot command or music playback! (e.g. command: "play", args: "lofi 24/7", command: "antinuke", args: "enable")
set_bot_nickname → { nickname: string } // Set bot server nickname (e.g. nickname: "Zenith Bot")
create_channel   → { name, type: "text"|"voice"|"category", topic?, slowmode?, parent_id? }
delete_channel   → { channel_id, reason? }
edit_channel     → { channel_id, name?, topic?, slowmode?, parent_id? }
lock_channel     → { channel_id }
unlock_channel   → { channel_id }
set_slowmode     → { channel_id, seconds }
set_channel_permissions → { channel_id, target_id: string, allow?: string[], deny?: string[] } // e.g. target_id: role_id, target_id: "everyone"
create_role      → { name, color?, hoist?: boolean, mentionable?: boolean } // Color format: "#00ffcc"
delete_role      → { role_id, reason? }
edit_role        → { role_id, name?, color?, hoist?, mentionable? }
add_role         → { user_id, role_id, reason? }
remove_role      → { user_id, role_id, reason? }
kick_member      → { user_id, reason? }
ban_member       → { user_id, reason? }
timeout_member   → { user_id, duration_minutes, reason? }
send_message     → { channel_id, content?, embed?: { title?, description?, color?, fields?: [{name, value}], footer? } }

OUTPUT FORMAT:
Return strictly a JSON object (no markdown markers, no comments):
{
  "summary": "Short description of the setup and architectural improvements about to be made",
  "warning": "Destructive/important warning or omit if none",
  "actions": [
    { "type": "action_type", "description": "Sleek, human-readable step details", "params": {} }
  ]
}

USER INSTRUCTION: "${instruction}"`;

function generateLocalPlan(instruction: string): AdminPlan {
  const norm = instruction.toLowerCase();

  // Dynamic regex parsing for specific numeric channel requests (e.g. "make 3 voice channels", "create 5 text channels")
  const numMatch = norm.match(/(?:make|create|add|build)\s*(\d+)\s*(voice|vc|audio|speaking|text|chat|category|categories)\s*channels?/i) ||
                 norm.match(/(\d+)\s*(voice|vc|audio|speaking|text|chat|category|categories)\s*channels?/i);

  if (numMatch) {
    const count = Math.min(Math.max(1, parseInt(numMatch[1], 10)), 10);
    const typeKeyword = numMatch[2].toLowerCase();
    const isVoice = ["voice", "vc", "audio", "speaking"].includes(typeKeyword);
    const isCategory = ["category", "categories"].includes(typeKeyword);
    const channelType = isCategory ? "category" : isVoice ? "voice" : "text";

    const actions: AdminAction[] = [];
    for (let i = 1; i <= count; i++) {
      const channelName = isCategory
        ? `━━ CATEGORY ${i} ━━`
        : isVoice
        ? `🔊-voice-${i}`
        : `💬-text-${i}`;
      actions.push({
        type: "create_channel",
        description: `Create ${channelType} channel ${i}/${count}: ${channelName}`,
        params: { name: channelName, type: channelType }
      });
    }

    return {
      summary: `Local Server Architect: Generated ${count} ${channelType} channel creation task(s) based on user prompt.`,
      actions
    };
  }

  // 1. Rules space / Guidelines setup
  if (norm.includes("rule") || norm.includes("guideline") || norm.includes("info")) {
    return {
      summary: "Local Server Architect: Designed a secure, aesthetic informational and rules space.",
      actions: [
        {
          type: "create_channel",
          description: "Create category for important information space",
          params: { name: "━━ INFORMATION ━━", type: "category" }
        },
        {
          type: "create_channel",
          description: "Create official rules channel with customized name and clean emoji",
          params: { name: "📜-rules-and-info", type: "text", parent_id: "last_category" }
        },
        {
          type: "set_channel_permissions",
          description: "Configure read-only rules for everyone (no sending messages allowed)",
          params: { channel_id: "last_channel", target_id: "everyone", deny: ["SendMessages"] }
        },
        {
          type: "send_message",
          description: "Publish a high-fidelity, polished embedded server guidelines message",
          params: {
            channel_id: "last_channel",
            embed: {
              title: "📜 Guild Guidelines & Rules",
              description: "Welcome! To maintain a safe and enjoyable community, please read and follow our standards:\n\n• **1. Respect Everyone:** Treat all members with courtesy and kindness. No hate speech or harassment.\n• **2. No Spam or Self-Promotion:** Keep content in dedicated channels. No unsolicited DMs.\n• **3. Keep Content Appropriate:** Follow Discord terms of service. Keep discussion PG-13.",
              color: "#00ffcc",
              footer: "Zenith Sentinel Protection Core"
            }
          }
        }
      ]
    };
  }

  // 2. Announcements channel setup
  if (norm.includes("announce") || norm.includes("update") || norm.includes("news")) {
    return {
      summary: "Local Server Architect: Designed a secure announcements broadcast lounge.",
      actions: [
        {
          type: "create_channel",
          description: "Create category for important information space",
          params: { name: "━━ INFORMATION ━━", type: "category" }
        },
        {
          type: "create_channel",
          description: "Create public announcements text channel with clean layout",
          params: { name: "📢-announcements", type: "text", parent_id: "last_category" }
        },
        {
          type: "set_channel_permissions",
          description: "Ensure everyone has view-only permissions (no sending messages)",
          params: { channel_id: "last_channel", target_id: "everyone", deny: ["SendMessages"] }
        },
        {
          type: "send_message",
          description: "Send initial greeting embed welcoming members to updates space",
          params: {
            channel_id: "last_channel",
            embed: {
              title: "📢 Community Announcements",
              description: "Stay up to date! This channel is used by staff to broadcast crucial updates, server events, and system changes.",
              color: "#ff3366",
              footer: "Zenith Broadcast Sentinel"
            }
          }
        }
      ]
    };
  }

  // 3. Social Space / lounge chat
  if (norm.includes("chat") || norm.includes("general") || norm.includes("social") || norm.includes("lounge")) {
    return {
      summary: "Local Server Architect: Designed a vibrant community conversation and social space.",
      actions: [
        {
          type: "create_channel",
          description: "Create category for public social space",
          params: { name: "━━ SOCIAL SPACE ━━", type: "category" }
        },
        {
          type: "create_channel",
          description: "Create general community lounge chat",
          params: { name: "💬-general-chat", type: "text", parent_id: "last_category" }
        },
        {
          type: "create_channel",
          description: "Create high-fidelity media sharing text channel",
          params: { name: "🖼-media-share", type: "text", parent_id: "last_category" }
        },
        {
          type: "create_channel",
          description: "Create public voice lounge channel",
          params: { name: "🔊-voice-lounge", type: "voice", parent_id: "last_category" }
        }
      ]
    };
  }

  // 4. Staff logging / rooms
  if (norm.includes("staff") || norm.includes("admin") || norm.includes("log") || norm.includes("mod")) {
    return {
      summary: "Local Server Architect: Created a secure, isolated staff room and audit logs space.",
      actions: [
        {
          type: "create_channel",
          description: "Create category for internal staff usage",
          params: { name: "━━ STAFF ONLY ━━", type: "category" }
        },
        {
          type: "create_channel",
          description: "Create internal staff discussion chatroom",
          params: { name: "🛠-staff-room", type: "text", parent_id: "last_category" }
        },
        {
          type: "create_channel",
          description: "Create internal moderation audit log channel",
          params: { name: "🛡-audit-trail", type: "text", parent_id: "last_category" }
        },
        {
          type: "set_channel_permissions",
          description: "Completely hide the staff room category from everyone",
          params: { channel_id: "last_category", target_id: "everyone", deny: ["ViewChannel"] }
        }
      ]
    };
  }

  // Default fallback setup
  return {
    summary: "Local Server Architect: Designed custom zones based on instructions.",
    actions: [
      {
        type: "create_channel",
        description: "Create custom server category for operations",
        params: { name: "━━ OPERATIONS ━━", type: "category" }
      },
      {
        type: "create_channel",
        description: "Create custom main discussion text channel",
        params: { name: "💬-discussion", type: "text", parent_id: "last_category" }
      },
      {
        type: "create_channel",
        description: "Create custom main voice channel",
        params: { name: "🔊-hangout", type: "voice", parent_id: "last_category" }
      }
    ]
  };
}

    let plan: AdminPlan;
    try {
      plan = await callGemini(systemPrompt);
    } catch (err: any) {
      logger.warn({ err }, "Gemini AI plan generation failed or API key missing, falling back to local heuristic architect");
      plan = generateLocalPlan(instruction);
      plan.warning = "The remote AI Model is currently experiencing high demand. Zenith Bot has automatically activated the **Local Server Architect** fallback to complete your request instantly!";
    }

    if (!Array.isArray(plan.actions) || plan.actions.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.settings.str} AI Admin — Architectural Review`)
            .setDescription(`**Instruction:** ${instruction}\n\n**AI Response:** ${plan.summary}`)
            .setColor(COLORS.warning),
        ],
      });
      return;
    }

    const stepList = plan.actions
      .map((a, i) => `\`${i + 1}.\` **${a.type.toUpperCase()}:** ${a.description}`)
      .join("\n");

    const planEmbed = new EmbedBuilder()
      .setTitle(`🛠️ AI Admin — Proposed Blueprint`)
      .setDescription(`**Request:** *"${instruction}"*\n\n${plan.summary}\n\n**Proposed Steps:**\n${stepList}`)
      .setColor(plan.warning ? COLORS.warning : COLORS.primary)
      .setFooter({ text: "Please review and confirm to execute. Expires in 2 minutes." })
      .setTimestamp();

    if (plan.warning) {
      planEmbed.addFields({ name: `${CE.warning.str} Safety Warning`, value: plan.warning });
    }

    const confirmId = `aiadmin:ok:${interaction.id}`;
    const cancelId  = `aiadmin:no:${interaction.id}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel("Confirm & Execute Blueprint").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(cancelId).setLabel("Abort Design").setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ embeds: [planEmbed], components: [row] as any });

    let btn: any;
    try {
      let reply: any;
      if (typeof interaction.fetchReply === "function") {
        reply = await interaction.fetchReply().catch(() => null);
      }
      if (!reply && interaction.channel && "messages" in interaction.channel) {
        const msgs = await (interaction.channel as any).messages.fetch({ limit: 5 }).catch(() => null);
        reply = msgs?.find((m: any) => m.author.id === interaction.client.user?.id);
      }
      if (!reply || typeof reply.awaitMessageComponent !== "function") {
        throw new Error("Could not resolve message reply to attach button collector");
      }

      btn = await reply.awaitMessageComponent({
        filter: (i: any) => {
          if (i.customId !== confirmId && i.customId !== cancelId) return false;
          if (i.user.id !== interaction.user.id) {
            i.reply({
              content: `${CE.warning.str} Only <@${interaction.user.id}> (who initiated this directive) can approve or cancel this AI blueprint!`,
              ephemeral: true,
            }).catch(() => {});
            return false;
          }
          return true;
        },
        time: 120_000,
      });
    } catch (err: any) {
      logger.warn({ err: err?.message || String(err) }, "AI Admin button interaction timeout or resolve error");
      await interaction.editReply({
        embeds: [planEmbed.setColor(COLORS.neutral).setFooter({ text: "Blueprint approval timed out (120s limit) — cancelled." })],
        components: [] as any,
      }).catch(() => {});
      return;
    }

    if (btn.customId === cancelId) {
      await btn.update({
        embeds: [planEmbed.setColor(COLORS.neutral).setFooter({ text: `Aborted by ${interaction.user.tag}` })],
        components: [] as any,
      });
      return;
    }

    await btn.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(`⚙️ AI Admin — Processing Blueprint`)
          .setDescription(`${CE.loading.str} Deploying and executing ${plan.actions.length} architectural changes safely…`)
          .setColor(COLORS.info),
      ],
      components: [] as any,
    });

    const results: { ok: boolean; msg: string }[] = [];
    
    const contextState: ExecutionContextState = {
      lastCreatedCategoryId: null,
      lastCreatedChannelId: null,
      lastCreatedRoleId: null,
      createdChannelsByRef: new Map(),
      createdRolesByRef: new Map(),
      createdCategoriesList: [],
      createdChannelsList: [],
      createdRolesList: [],
    };
    
    for (const action of plan.actions) {
      const r = await executeAction(guild, action, contextState);
      results.push({ ok: r.success, msg: r.message });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const allOk = results.every((r) => r.ok);
    const resultLines = results
      .map((r) => `${r.ok ? CE.success.str : CE.error.str} ${r.msg}`)
      .join("\n");

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`✅ AI Admin — Blueprint Executed`)
          .setDescription(`### Server Setup Completed!\n\n**Initial Instruction:** *"${instruction}"*\n\n**Task Deployments:**\n${resultLines}`)
          .setColor(allOk ? COLORS.success : COLORS.warning)
          .setFooter({ text: `Architect: ${interaction.user.tag} • Deploy Completed` })
          .setTimestamp(),
      ],
      components: [] as any,
    });
  },
};

export default command;
