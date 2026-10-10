import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";

export interface TicketPanel {
  id: string;
  name: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  buttonLabel: string;
  buttonEmoji?: string;
  supportRoleId?: string;
  categoryId?: string;
  panelChannelId?: string;
  panelMessageId?: string;
  questions?: TicketQuestion[];
}

export interface MultiPanelConfig {
  channelId?: string;
  messageId?: string;
  panelIds: string[];
  embedTitle: string;
  embedDescription: string;
  useButtons: boolean;
}

export interface TicketsModuleConfig {
  enabled: boolean;
  supportRoleId?: string;
  adminRoleId?: string;
  logChannelId?: string;
  transcriptChannelId?: string;
  panels: Record<string, TicketPanel>;
  multiPanel?: MultiPanelConfig;
}

export interface TicketQuestion {
  label: string;
  style: "short" | "paragraph";
  required: boolean;
}

export interface OpenTicket {
  ticketId: string;
  panelId: string;
  channelId: string;
  guildId: string;
  userId: string;
  createdAt: number;
  status: "open" | "closed";
  claimedBy?: string;
}

interface GuildTickets {
  config: TicketsModuleConfig;
  counters: Record<string, number>;
  openTickets: Record<string, OpenTicket>;
}

const FILE_PATH = dataFile("tickets.json");
let cache: Record<string, GuildTickets> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<Record<string, GuildTickets>> {
  if (cache) return cache;
  cache = await loadPersistentJson("tickets.json", FILE_PATH, {});
  return cache;
}

async function persist(data: Record<string, GuildTickets>): Promise<void> {
  await persistPersistentJson("tickets.json", FILE_PATH, data);
}

function queueWrite(data: Record<string, GuildTickets>): void {
  writeQueue = writeQueue.then(() => persist(data)).catch(() => {});
}

function emptyGuild(): GuildTickets {
  return {
    config: {
      enabled: false,
      panels: {},
    },
    counters: {},
    openTickets: {},
  };
}

export async function getTicketsConfig(guildId: string): Promise<TicketsModuleConfig> {
  let data = await load();
  let conf = data[guildId]?.config;
  if (!conf || !conf.panels || Object.keys(conf.panels).length === 0) {
    if (guildId === "1554479885760856076") {
      conf = {
        enabled: true,
        supportRoleId: "1558447523855728731",
        adminRoleId: "1558447522500841613",
        logChannelId: "1558447596467650651",
        transcriptChannelId: "1558447565366628402",
        panels: {
          panel_general: {
            id: "panel_general",
            name: "general-support",
            embedTitle: "<:white_ticket:1555133876433846382> General Support Ticket",
            embedDescription: "Need help with Zenith Bot commands, configuration, or general questions?\nSupport will be with you shortly.",
            embedColor: 5793266,
            buttonLabel: "General Support",
            buttonEmoji: "<:white_ticket:1555133876433846382>",
            supportRoleId: "1558447523855728731",
            panelChannelId: "1558447563529785416",
            categoryId: "1558459182464761971",
            panelMessageId: "1558449145042178122",
          },
          panel_premium: {
            id: "panel_premium",
            name: "premium-inquiries",
            embedTitle: "<:white_Premium:1555133783634616371> Premium & Billing Inquiries",
            embedDescription: "Questions regarding Zenith Premium, license key redemption, or custom bot branding?\nSupport will be with you shortly.",
            embedColor: 16705372,
            buttonLabel: "Premium & Billing",
            buttonEmoji: "<:Premium1:1555133459192615042>",
            supportRoleId: "1558447523855728731",
            panelChannelId: "1558447563529785416",
            categoryId: "1558459184071049246",
            panelMessageId: "1558449145042178122",
          },
          panel_bug: {
            id: "panel_bug",
            name: "bug-reports",
            embedTitle: "<:Bughunter_1:1555133271896096788> Bug Report Ticket",
            embedDescription: "Found an error or broken bot command? Report it directly to our development engineers.\nSupport will be with you shortly.",
            embedColor: 15548997,
            buttonLabel: "Bug Reports",
            buttonEmoji: "<:Bughunter_1:1555133271896096788>",
            supportRoleId: "1558447523855728731",
            panelChannelId: "1558447563529785416",
            categoryId: "1558459186172526592",
            panelMessageId: "1558449145042178122",
          },
          panel_security: {
            id: "panel_security",
            name: "security-antinuke",
            embedTitle: "<:white_antinuke:1555133560334061610> Anti-Nuke & Security Setup",
            embedDescription: "Need urgent help with Anti-Nuke whitelisting, AutoMod rules, or raid protection?\nSupport will be with you shortly.",
            embedColor: 5763719,
            buttonLabel: "Anti-Nuke & Security",
            buttonEmoji: "<:white_antinuke:1555133560334061610>",
            supportRoleId: "1558447523855728731",
            panelChannelId: "1558447563529785416",
            categoryId: "1558459188638916771",
            panelMessageId: "1558449145042178122",
          },
        },
        multiPanel: {
          channelId: "1558447563529785416",
          messageId: "1558449145042178122",
          panelIds: ["panel_general", "panel_premium", "panel_bug", "panel_security"],
          embedTitle: "<:white_ticket:1555133876433846382> Zenith Support Desk ━━ Official Help Portal",
          embedDescription: "Welcome to **Zenith Support**! Please select the category below that best describes your inquiry. Our support team is available to assist you.\n\n**Available Support Categories:**\n• <:white_ticket:1555133876433846382> **General Support** ◦ Command help, permissions, and server setup\n• <:Premium1:1555133459192615042> **Premium & Billing** ◦ Key redemption, tiers, and invoice assistance\n• <:Bughunter_1:1555133271896096788> **Bug Reports** ◦ Error reports and bot malfunctions\n• <:white_antinuke:1555133560334061610> **Anti-Nuke & Security** ◦ Raid recovery, whitelist setup, and bypasses\n\n*Select a category from the dropdown menu below to open your ticket.*",
          useButtons: false,
        },
      };
      if (!data[guildId]) data[guildId] = emptyGuild();
      data[guildId]!.config = conf;
      queueWrite(data);
    }
  }
  return conf ?? emptyGuild().config;
}

export async function updateTicketsConfig(
  guildId: string,
  fn: (c: TicketsModuleConfig) => TicketsModuleConfig,
): Promise<TicketsModuleConfig> {
  const data = await load();
  if (!data[guildId]) data[guildId] = emptyGuild();
  data[guildId]!.config = fn(data[guildId]!.config);
  queueWrite(data);
  return data[guildId]!.config;
}

export async function getNextTicketNumber(guildId: string, panelId: string): Promise<number> {
  const data = await load();
  if (!data[guildId]) data[guildId] = emptyGuild();
  const g = data[guildId]!;
  g.counters[panelId] = (g.counters[panelId] ?? 0) + 1;
  queueWrite(data);
  return g.counters[panelId]!;
}

export async function createOpenTicket(ticket: OpenTicket): Promise<void> {
  const data = await load();
  if (!data[ticket.guildId]) data[ticket.guildId] = emptyGuild();
  data[ticket.guildId]!.openTickets[ticket.channelId] = ticket;
  queueWrite(data);
}

export async function getOpenTicketByChannel(
  guildId: string,
  channelId: string,
): Promise<OpenTicket | null> {
  const data = await load();
  return data[guildId]?.openTickets[channelId] ?? null;
}

export async function getOpenTicketsByUser(
  guildId: string,
  userId: string,
  panelId: string,
): Promise<OpenTicket[]> {
  const data = await load();
  return Object.values(data[guildId]?.openTickets ?? {}).filter(
    (t) => t.userId === userId && t.panelId === panelId && t.status === "open",
  );
}

export async function closeOpenTicket(guildId: string, channelId: string): Promise<void> {
  const data = await load();
  const t = data[guildId]?.openTickets[channelId];
  if (t) {
    t.status = "closed";
    delete data[guildId]!.openTickets[channelId];
    queueWrite(data);
  }
}

export async function claimTicket(
  guildId: string,
  channelId: string,
  claimedBy: string,
): Promise<OpenTicket | null> {
  const data = await load();
  const t = data[guildId]?.openTickets[channelId];
  if (!t) return null;
  t.claimedBy = claimedBy;
  queueWrite(data);
  return t;
}
