import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { isPermanentOwner } from "./premium";
import { isBotStaff, getBotStaffMember } from "./botStaff";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

const STORE = "bot_status_state_store";
const FILE = () => dataFile("bot_status_state_store.json");

export type BotStatusMode = "normal" | "maintenance" | "down" | "lockdown" | "dev_only" | "vip_only";

export interface BotStatusState {
  mode: BotStatusMode;
  updatedAt: number;
  updatedBy: string;
  originalAvatarUrl?: string | null;
  commandModes?: Record<string, BotStatusMode>;
}

let cache: BotStatusState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<BotStatusState> {
  if (cache) return cache;
  cache = await loadPersistentJson<BotStatusState>(STORE, FILE(), {
    mode: "normal",
    updatedAt: Date.now(),
    updatedBy: "system",
    originalAvatarUrl: null,
    commandModes: {},
  });
  return cache;
}

async function save(state: BotStatusState): Promise<void> {
  cache = state;
  writeQueue = writeQueue.then(() => persistPersistentJson(STORE, FILE(), state));
  return writeQueue;
}

export async function getBotStatusMode(): Promise<BotStatusMode> {
  const state = await load();
  return state.mode;
}

export async function setBotStatusMode(mode: BotStatusMode, updatedBy: string, originalAvatarUrl?: string | null): Promise<void> {
  const state = await load();
  await save({
    mode,
    updatedAt: Date.now(),
    updatedBy,
    originalAvatarUrl: originalAvatarUrl !== undefined ? originalAvatarUrl : state.originalAvatarUrl,
  });
}

export async function updateOriginalAvatarUrl(url: string | null): Promise<void> {
  const state = await load();
  await save({
    ...state,
    originalAvatarUrl: url,
    updatedAt: Date.now(),
  });
}

export async function getOriginalAvatarUrl(): Promise<string | null | undefined> {
  const state = await load();
  return state.originalAvatarUrl;
}

/**
 * Checks if a user is permitted to execute commands under the current bot status mode.
 * Returns { allowed: true } or { allowed: false, message: string }
 */
export async function checkBotStatusCommandAccess(userId: string): Promise<{ allowed: boolean; embed?: any }> {
  const mode = await getBotStatusMode();
  if (mode === "normal") {
    return { allowed: true };
  }

  // 1. Bot Permanent Owners bypass ALL status restrictions
  const isOwner = isPermanentOwner(userId);
  if (isOwner) {
    return { allowed: true };
  }

  // 2. Fetch staff registry
  const staffMember = await getBotStaffMember(userId);
  const isStaff = await isBotStaff(userId);

  // Mode: dev_only (Only absolute owner & co-owner can run commands)
  if (mode === "dev_only") {
    const isDev = isOwner || (staffMember && (staffMember.role === "owner" || staffMember.role === "co_owner" || staffMember.role === "admin"));
    if (isDev) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Developer-Only Access Mode",
        description: `Zenith Bot is currently locked in **Developer-Only Access Mode** for direct system debugging.\n\n• Only bot developers and system administrators are allowed to execute operations.\n• Please join our [Official Support Server](https://discord.gg/gFgAfpSYdp) for live status updates.`,
        color: COLORS.neutral,
      }),
    };
  }

  // Mode: lockdown (Only Bot Staff and Owners)
  if (mode === "lockdown") {
    if (isStaff) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "System Lockdown Active",
        description: `Zenith Bot is currently in **Emergency Lockdown Mode**.\n\n• Command execution is globally restricted to verified **Bot Staff** until further notice.\n• This is usually initiated during global security threats or server incidents.`,
        color: COLORS.danger,
      }),
    };
  }

  // Mode: maintenance (Only Bot Staff and Owners)
  if (mode === "maintenance") {
    if (isStaff) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Undergoing Scheduled Maintenance",
        description: `Zenith Bot is currently undergoing **Scheduled Core Maintenance**.\n\n• All standard commands are locked to prevent data conflicts.\n• Normal services will resume shortly. Thank you for your patience!`,
        color: COLORS.warning,
      }),
    };
  }

  // Mode: down (Only Bot Staff and Owners)
  if (mode === "down") {
    if (isStaff) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Service Temporarily Offline",
        description: `Zenith Bot is currently **Service Offline** due to system or database issues.\n\n• Our core developers are already investigating the issue and working on a hotfix.\n• Commands will remain locked for non-staff to protect server states. See you soon!`,
        color: COLORS.danger,
      }),
    };
  }

  // Mode: vip_only (Only Owners, Staff, and VIP / Homies)
  if (mode === "vip_only") {
    const hasVipAccess = isStaff || (staffMember && (staffMember.role === "vip" || staffMember.role === "homies"));
    if (hasVipAccess) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "VIP-Only Access Mode",
        description: `Zenith Bot is currently operating in **VIP-Only Access Mode**.\n\n• Command execution is restricted to **Official Bot Staff**, **VIP Lifetime Members**, and **Homies**.\n• Upgrade your account using \`.premium\` or join our support community to unlock VIP clearance!`,
        color: COLORS.premium,
      }),
    };
  }

  return { allowed: true };
}

export async function getBotCommandMode(commandName: string): Promise<BotStatusMode> {
  const state = await load();
  const commandModes = state.commandModes ?? {};
  return commandModes[commandName.toLowerCase()] ?? "normal";
}

export async function getCommandModesMap(): Promise<Record<string, BotStatusMode>> {
  const state = await load();
  return state.commandModes ?? {};
}

export async function setBotCommandMode(commandName: string, mode: BotStatusMode, updatedBy: string): Promise<void> {
  const state = await load();
  const commandModes = { ...(state.commandModes ?? {}) };
  if (mode === "normal") {
    delete commandModes[commandName.toLowerCase()];
  } else {
    commandModes[commandName.toLowerCase()] = mode;
  }
  await save({
    ...state,
    commandModes,
    updatedAt: Date.now(),
    updatedBy,
  });
}

/**
 * Checks if a user has access to a specific single command name based on its custom mode.
 */
export async function checkSingleCommandAccess(commandName: string, userId: string): Promise<{ allowed: boolean; embed?: any }> {
  const state = await load();
  const commandModes = state.commandModes ?? {};
  const mode = commandModes[commandName.toLowerCase()] ?? "normal";

  if (mode === "normal") {
    return { allowed: true };
  }

  // Owners bypass everything
  const isOwner = isPermanentOwner(userId);
  if (isOwner) {
    return { allowed: true };
  }

  const staffMember = await getBotStaffMember(userId);
  const isStaff = await isBotStaff(userId);

  if (mode === "dev_only") {
    const isDev = isOwner || (staffMember && (staffMember.role === "owner" || staffMember.role === "co_owner" || staffMember.role === "admin"));
    if (isDev) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Developer-Only Command Access",
        description: `The command \`/${commandName}\` is currently locked in **Developer-Only Access Mode**.\n\n• Only bot developers and system administrators are allowed to execute this command at this time.`,
        color: COLORS.neutral,
      }),
    };
  }

  if (mode === "lockdown") {
    if (isStaff) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Command Locked Down",
        description: `The command \`/${commandName}\` is currently in **Emergency Lockdown Mode**.\n\n• Usage of this command is restricted to verified **Bot Staff** only.`,
        color: COLORS.danger,
      }),
    };
  }

  if (mode === "maintenance") {
    if (isStaff) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Command Under Maintenance",
        description: `The command \`/${commandName}\` is currently undergoing **Scheduled Maintenance**.\n\n• Usage of this command is temporarily gated to prevent system errors.`,
        color: COLORS.warning,
      }),
    };
  }

  if (mode === "down") {
    if (isStaff) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "Command Temporarily Offline",
        description: `The command \`/${commandName}\` is currently **Offline** due to an active service outage.\n\n• Our core developers are currently patching this command's underlying features.`,
        color: COLORS.danger,
      }),
    };
  }

  if (mode === "vip_only") {
    const hasVipAccess = isStaff || (staffMember && (staffMember.role === "vip" || staffMember.role === "homies"));
    if (hasVipAccess) {
      return { allowed: true };
    }
    return {
      allowed: false,
      embed: prettyEmbed({
        title: "VIP-Only Command",
        description: `The command \`/${commandName}\` is currently restricted to **VIP & Staff Only**.\n\n• You must be a **Lifetime VIP Member**, **Homie**, or **Bot Staff** to use this feature.`,
        color: COLORS.premium,
      }),
    };
  }

  return { allowed: true };
}
