import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder
} from "discord.js";
import type { SlashCommand } from "../types";
import { COLORS, CE, EMOJI, prettyEmbed, buildSupportRow } from "../utils/embedStyle";
import { getGuildConfig } from "../storage/config";

const SUPPORT_SERVER_URL = "https://discord.gg/gFgAfpSYdp";

interface HelpCategory {
  id: string;
  label: string;
  emojiId: string;
  emojiStr: string;
  desc: string;
  commands: string[];
}

const CATEGORIES: HelpCategory[] = [
  {
    id: "overview",
    label: "Overview & Help",
    emojiId: CE.white_info.id,
    emojiStr: CE.white_info.str,
    desc: "Main menu and system overview",
    commands: [],
  },
  {
    id: "premium",
    label: "Premium Tier & Features",
    emojiId: CE.white_premium.id,
    emojiStr: CE.white_premium.str,
    desc: "Premium perks, 24/7 VC, and No-Prefix routing",
    commands: [
      "premium",
      "premiumpanel",
      "premiumcheck",
      "premiumgive",
      "premium-user",
      "premium-server",
      "noprefix",
      "auto-react",
      "afk",
    ],
  },
  {
    id: "setup",
    label: "Setup & Configurations",
    emojiId: CE.white_settings.id,
    emojiStr: CE.white_settings.str,
    desc: "Role setup, security wizard, presets & templates",
    commands: [
      "setup",
      "config",
      "setupwizard",
      "autorole",
      "stats",
      "logging",
      "preset",
      "template",
      "verify-config",
      "autoheal",
      "autoreact",
      "globalautoreact",
      "emojichannels",
      "scramblechannels",
      "scrambleroles",
      "response-channel",
      "theme",
      "role",
      "channel",
      "category",
      "emoji",
      "sticker",
    ],
  },
  {
    id: "antinuke",
    label: "Anti-Nuke & Protection",
    emojiId: CE.white_antinuke.id,
    emojiStr: CE.white_antinuke.str,
    desc: "Anti-Nuke, AutoMod, and security whitelists",
    commands: [
      "antinuke",
      "automod",
      "ai-admin",
      "automations",
      "betrayalguard",
      "nuke-anti-whitelist",
      "whitelist",
      "whitelistall",
      "whitelist-all",
      "whitelistfactory",
      "whitelist-global",
      "serverwhitelist",
      "serverowner",
      "serveradmin",
      "trusted",
      "blacklist",
      "botwhitelist",
      "bot-admins",
    ],
  },
  {
    id: "mod",
    label: "Moderation & Appeals",
    emojiId: CE.Moderator.id,
    emojiStr: CE.Moderator.str,
    desc: "Ban, kick, mute, timeout, jail, cases & appeals",
    commands: [
      "ban",
      "unban",
      "unban-all",
      "kick",
      "mute",
      "unmute",
      "warn",
      "unwarn",
      "timeout",
      "untimeout",
      "jail",
      "unjail",
      "case",
      "edit-case",
      "modhistory",
      "modstats",
      "purge",
      "lock",
      "unlock",
      "channellock",
      "channel-lock",
      "slowmode",
      "nuke",
      "appeal",
      "close-ticket",
      "private-ticket",
      "infraction",
      "infractions",
      "ban-request",
      "unclaim",
    ],
  },
  {
    id: "staff",
    label: "Staff Operations & Admin",
    emojiId: CE.white_admin.id,
    emojiStr: CE.white_admin.str,
    desc: "Staff management, LOA, reports and system modes",
    commands: [
      "bot-admin",
      "botstaff",
      "checkstaff",
      "loa",
      "staff-report",
      "staff-profile",
      "sprofile",
      "staff-history",
      "staff-database",
      "staff-role-add",
      "staff-role-remove",
      "staff-roles",
      "staff-shop-score",
      "staff-update-report",
      "shop-top-staff",
      "promote",
      "demote",
      "quota",
      "bot-check",
      "maintenance",
      "botmaintenance",
      "botmaintainence",
      "botdown",
      "botlockdown",
      "botdevonly",
      "botviponly",
      "botnormal",
      "botcmd",
      "syncpfp",
      "hosting",
      "verify-owner",
      "verifyowner",
      "verify-owner-commands",
      "eval",
      "global-backup",
      "server-backup",
      "bot-announce",
      "connect-servers",
      "botstatus",
      "broadcast",
    ],
  },
  {
    id: "music",
    label: "Music & Voice Audio",
    emojiId: CE.white_musicnote.id,
    emojiStr: CE.white_musicnote.str,
    desc: "High-Fi audio streaming, 24/7 radio and voice control",
    commands: [
      "music",
      "play",
      "search",
      "twentyfourseven",
      "panel",
      "musicpanel",
      "seek",
      "skipto",
      "shuffle",
      "remove",
      "move",
      "stop",
      "queue",
      "skip",
      "pause",
      "resume",
      "clearqueue",
      "volume",
      "loop",
      "autoplay",
      "equalizer",
      "bassboost",
      "nowplaying",
      "speed",
      "source",
      "playlist",
      "lyrics",
      "dj",
      "highfi",
      "quantumaudio",
      "vcmute",
      "vcdeafen",
      "vckick",
      "vcmove",
    ],
  },
  {
    id: "economy",
    label: "Economy & Leveling",
    emojiId: CE.white_award.id,
    emojiStr: CE.white_award.str,
    desc: "Ranks, leaderboards, shop, and rewards",
    commands: [
      "rank",
      "leaderboard",
      "give-xp",
      "slots",
      "customer-points",
      "partnership-score",
      "partnership",
    ],
  },
  {
    id: "fun",
    label: "Games & Entertainment",
    emojiId: CE.white_games.id,
    emojiStr: CE.white_games.str,
    desc: "Mini-games, trivia, gambling, and fun tools",
    commands: [
      "8ball",
      "eightball",
      "coinflip",
      "roll",
      "rps",
      "tictactoe",
      "connect4",
      "hangman",
      "trivia",
      "wouldyourather",
      "wordscramble",
      "meme",
      "ship",
      "spooky",
      "guess",
      "higherlower",
      "russianroulette",
      "channelguess",
      "channel-guess",
      "channelshuffle",
      "cursednicknames",
      "ghostradar",
      "rolemystery",
      "rolerainbow",
      "upsidedown",
      "fortune",
    ],
  },
  {
    id: "utility",
    label: "Utility, Roles & Info",
    emojiId: CE.Tool.id,
    emojiStr: CE.Tool.str,
    desc: "Server, user & role info, giveaways, and utilities",
    commands: [
      "help",
      "ping",
      "oping",
      "serverinfo",
      "userinfo",
      "botinfo",
      "ginfo",
      "roleinfo",
      "avatar",
      "botavatar",
      "gbotavatar",
      "setavatar",
      "setbio",
      "servercount",
      "serverlist",
      "poll",
      "announce",
      "dm",
      "note",
      "pull",
      "pullable",
      "giveaway",
      "rolegive",
      "roleremove",
      "adduser",
      "intro",
      "badges",
      "badgeslist",
      "badgesadd",
      "badgesremove",
      "badgesall",
      "profile",
      "rate",
      "randomcolor",
      "say",
      "choice",
      "webhook-send",
      "post-proof",
      "bugreport",
      "leaveserver",
      "supabasestatus",
      "verify",
      "nickname",
    ],
  },
  {
    id: "faq",
    label: "FAQ & Solutions",
    emojiId: CE.list.id,
    emojiStr: CE.list.str,
    desc: "Frequently Asked Questions and troubleshooting",
    commands: [],
  },
];

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all available slash commands with premium categories."),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const { getCommandModesMap } = await import("../storage/botStatusState");
    const commandModes = await getCommandModesMap();

    const { getGuildCommands } = await import("../registry");
    const allCommands = getGuildCommands();
    
    // Map commands to categories
    const categoryMap = new Map<string, SlashCommand[]>();
    const uncategorized: SlashCommand[] = [];

    CATEGORIES.forEach(c => categoryMap.set(c.id, []));

    const localCategories = [...CATEGORIES];

    for (const cmd of allCommands) {
      let found = false;
      const lowerName = cmd.data.name.toLowerCase();
      for (const cat of localCategories) {
        if (cat.commands.some((c) => c.toLowerCase() === lowerName)) {
          categoryMap.get(cat.id)?.push(cmd);
          found = true;
          break;
        }
      }
      if (!found) {
        // Smart fallback so NO command is ever omitted
        if (lowerName.includes("music") || lowerName.includes("audio") || lowerName.includes("vc") || lowerName.includes("song") || lowerName.includes("track")) {
          categoryMap.get("music")?.push(cmd);
        } else if (lowerName.includes("ban") || lowerName.includes("kick") || lowerName.includes("mute") || lowerName.includes("mod") || lowerName.includes("warn")) {
          categoryMap.get("mod")?.push(cmd);
        } else if (lowerName.includes("nuke") || lowerName.includes("white")) {
          categoryMap.get("antinuke")?.push(cmd);
        } else if (lowerName.includes("staff") || lowerName.includes("admin") || lowerName.includes("owner")) {
          categoryMap.get("staff")?.push(cmd);
        } else {
          categoryMap.get("utility")?.push(cmd);
        }
      }
    }

    const buildEmbed = (categoryId: string) => {
      const cat = localCategories.find(c => c.id === categoryId);
      
      if (categoryId === "overview") {
        return prettyEmbed({
          title: "Zenith Tester • Feature Staging & Systems Hub",
          description:
            `### ${CE.white_bot.str}  **Official Testing & Staging Environment**\n\n` +
            `This instance is used to test and refine the Zenith Bot ecosystem before production deployment.\n\n` +
            `**${CE.list.str}  Command Categories**\n` +
            `> Browse through Zenith's feature categories in the dropdown below to explore commands.\n\n` +
            `**${CE.white_info.str}  Frequently Asked Questions**\n` +
            `> Solutions and quick tips for server owners and administrators.\n\n` +
            `**${CE.white_settings.str}  Initial Server Setup**\n` +
            `> Quick 4-step guide to configure roles, logging channels, and automations.\n\n` +
            `> ${CE.white_premium.str} **Upgrade to Zenith Premium:** Stop dealing with raids and bot lag. Unlock 24/7 dedicated voice nodes, God-Mode Anti-Nuke, and No-Prefix commands!\n` +
            `> ${CE.link.str} **[Join Official Support & Claim VIP Pass](https://discord.gg/gFgAfpSYdp)**`,
          thumbnail: interaction.client.user?.displayAvatarURL() || undefined,
          color: COLORS.primary,
        });
      }

      if (categoryId === "setup") {
        return prettyEmbed({
          title: "Zenith Bot — Server Setup Guide",
          description:
            `### ${CE.white_settings.str}  **Quick Setup Walkthrough**\n\n` +
            `Follow these essential steps to configure Zenith for maximum security:\n\n` +
            `**1. Configuration Dashboard**\n` +
            `> Run </config:0> to open the interactive panel. Configure logging channels, staff roles, and punishment presets.\n\n` +
            `**2. Role Hierarchy Placement**\n` +
            `> In Server Settings -> Roles, drag **Zenith Bot** above all regular member and staff roles.\n\n` +
            `**3. Staff Authorization**\n` +
            `> Set your Moderator and Administrator roles in </config:0> so trusted staff can run commands.\n\n` +
            `**4. Anti-Nuke & AutoMod Shields**\n` +
            `> Enable Anti-Spam, Link Filter, and Anti-Raid shields to protect against unauthorized raids.`,
          thumbnail: interaction.client.user?.displayAvatarURL() || undefined,
          color: COLORS.primary,
        });
      }

      if (categoryId === "faq") {
        return prettyEmbed({
          title: "Zenith Bot — Frequently Asked Questions",
          description:
            `### ${CE.list.str}  **Frequently Asked Questions**\n\n` +
            `**Q: Why is the bot saying "Interaction Failed"?**\n` +
            `> A: This happens when the bot restarted recently and an old button in chat expired. Just re-run the command.\n\n` +
            `**Q: Why can't the bot punish someone?**\n` +
            `> A: The bot's role must be placed physically higher in the server role list than the user you are trying to punish.\n\n` +
            `**Q: How do I backup my server?**\n` +
            `> A: Use </server-backup:0> to create and load backups. Never share private backup IDs publicly!\n\n` +
            `**Q: How do I unlock 24/7 voice and No-Prefix commands?**\n` +
            `> A: Upgrade to Zenith Premium by visiting our Support Server at [discord.gg/gFgAfpSYdp](https://discord.gg/gFgAfpSYdp).`,
          thumbnail: interaction.client.user?.displayAvatarURL() || undefined,
          color: COLORS.primary,
        });
      }

      if (categoryId === "premium") {
        return prettyEmbed({
          title: "Zenith Bot — Premium VIP Tier & Perks",
          description:
            `### ${CE.white_premium.str}  **Take Your Server to the Top Tier**\n\n` +
            `Tired of bots crashing, laggy music, and server raids? Zenith Premium delivers enterprise reliability with dedicated infrastructure.\n\n` +
            `**${CE.white_premium.str} Exclusive Premium Capabilities:**\n` +
            `> • **No-Prefix Command Routing Engine:** Run commands naturally in chat without awkward prefixes (e.g. \`ban @user\` or \`play song\`).\n` +
            `> • **24/7 Always-On VC:** Dedicated voice connection that never disconnects, keeping the music playing 24/7.\n` +
            `> • **God-Mode Anti-Nuke:** Sub-20ms reaction trigger to immediately neutralize compromised admins or rogue bots.\n` +
            `> • **Custom Auto-Reactions (\`/auto-react\`):** Personalize channel and user reactions with your server emojis.\n` +
            `> • **Global AFK Tracking (\`/afk\`):** Cross-server and local status sync with custom triggers.\n\n` +
            `**${CE.white_claim.str} How to Claim Your VIP License:**\n` +
            `> Licenses are strictly managed to maintain 100% server quality. **Join the Official Support Server and open a VIP ticket:**\n` +
            `> ${CE.link.str} **[Claim Zenith Premium Today](https://discord.gg/gFgAfpSYdp)**`,
          thumbnail: interaction.client.user?.displayAvatarURL() || undefined,
          color: COLORS.premium,
        });
      }

      const rawCmds = categoryMap.get(categoryId) || [];
      const seenNames = new Set<string>();
      const cmds = rawCmds.filter((c) => {
        if (seenNames.has(c.data.name)) return false;
        seenNames.add(c.data.name);
        return true;
      });

      const getBadge = (name: string) => {
        const mode = commandModes[name.toLowerCase()];
        if (!mode || mode === "normal") return "";
        if (mode === "maintenance") return ` ${CE.white_settings.str} \`MAINTENANCE\``;
        if (mode === "down") return ` ${CE.error.str} \`OFFLINE\``;
        if (mode === "lockdown") return ` ${CE.white_lock.str} \`LOCKED\``;
        if (mode === "dev_only") return ` ${CE.white_owner.str} \`DEV ONLY\``;
        if (mode === "vip_only") return ` ${CE.white_premium.str} \`VIP ONLY\``;
        return "";
      };
      
      return prettyEmbed({
        title: `${cat?.label || "Command"} Suite`,
        description:
          `### ${cat?.emojiStr || CE.list.str}  **${cat?.label || "Category"} Commands (${cmds.length})**\n\n` +
          (cmds.length > 0 
            ? cmds.map(c => `> **\`/${c.data.name}\`**${getBadge(c.data.name)} — ${c.data.description}`).join("\n")
            : "> *No commands found in this category.*") +
          `\n\n${CE.white_premium.str} **Want instant No-Prefix command routing?** Upgrade to Premium at [discord.gg/gFgAfpSYdp](https://discord.gg/gFgAfpSYdp)`,
        color: COLORS.primary,
      });
    };

    const buildMenu = (selected: string) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("help_category_select")
        .setPlaceholder("Select a command category...");

      for (const cat of localCategories) {
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setDescription(cat.desc)
            .setEmoji(cat.emojiId)
            .setValue(cat.id)
            .setDefault(cat.id === selected)
        );
      }

      return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
    };

    const helpSupportRow = buildSupportRow(`${CE.boost.str} Join Support & Get VIP`);

    let message = await interaction.editReply({
      embeds: [buildEmbed("overview")],
      components: [buildMenu("overview"), helpSupportRow] as any,
    });

    if (!message) {
      try {
        message = await interaction.fetchReply();
      } catch {}
    }

    if (!message || typeof message.createMessageComponentCollector !== "function") {
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "help_category_select") {
        const catId = i.values[0];
        await i.update({
          embeds: [buildEmbed(catId)],
          components: [buildMenu(catId), helpSupportRow] as any,
        });
      }
    });

    collector.on("end", async () => {
      const disabledMenu = buildMenu("").components[0].setDisabled(true);
      const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(disabledMenu);
      await interaction.editReply({ components: [disabledRow, helpSupportRow] as any }).catch(() => {});
    });
  },
};

export default command;
