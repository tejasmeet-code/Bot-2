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
import { getGuildCommands } from "../registry";
import { COLORS, CE, EMOJI, prettyEmbed, buildSupportRow } from "../utils/embedStyle";
import { getGuildConfig } from "../storage/config";

const SUPPORT_SERVER_URL = "https://discord.gg/gFgAfpSYdp";

const CATEGORIES: { id: string; label: string; emoji: string; desc: string; commands: string[] }[] = [
  { id: "overview", label: "Overview & Help", emoji: CE.information.id, desc: "Main menu", commands: [] },
  { id: "premium", label: "Premium Tier & Features", emoji: CE.cash.id, desc: "Premium perks, NLP No-Prefix routing, license codes", commands: ["premium-user", "premium-server", "auto-react", "afk"] },
  { id: "setup", label: "Setup Guide", emoji: CE.settings.id, desc: "How to setup the bot and role hierarchy", commands: ["setup"] },
  { id: "faq", label: "FAQ", emoji: CE.clipboard.id, desc: "Frequently Asked Questions", commands: [] },
  { id: "mod", label: "Moderation", emoji: CE.moderation.id, desc: "Tools to keep your server safe", commands: ["ban", "kick", "mute", "unmute", "warn", "unwarn", "timeout", "untimeout", "jail", "unjail", "case", "edit-case", "modhistory", "purge", "lock", "unlock", "slowmode", "nuke", "appeal"] },
  { id: "staff", label: "Staff & Admin", emoji: CE.admin.id, desc: "Server configuration and staff tracking", commands: ["config", "bot-admin", "ai-admin", "loa", "staff-report", "promote", "demote", "staff-roles", "bot-check", "maintenance", "whitelist", "bot-admins", "verify-owner", "setup", "globalautoreact", "botstaff", "botwhitelist"] },
  { id: "economy", label: "Economy & Levels", emoji: CE.cash.id, desc: "Ranks, shop, and currency", commands: ["rank", "leaderboard", "give-xp", "slots"] },
  { id: "fun", label: "Fun & Games", emoji: CE.giveaway.id, desc: "Games, minigames, and fun commands", commands: ["8ball", "coinflip", "roll", "rps", "tictactoe", "connect4", "hangman", "trivia", "wouldyourather", "wordscramble", "meme", "ship", "spooky", "guess", "higherlower", "russianroulette"] },
  { id: "utility", label: "Utility & Info", emoji: CE.information.id, desc: "Useful tools and information", commands: ["help", "ping", "serverinfo", "userinfo", "botinfo", "roleinfo", "avatar", "setavatar", "servercount", "poll", "announce", "dm", "note", "pull", "giveaway", "staff-database", "afk"] },
];

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all available slash commands with premium categories."),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const { getCommandModesMap } = await import("../storage/botStatusState");
    const commandModes = await getCommandModesMap();

    const allCommands = getGuildCommands();
    
    // Map commands to categories
    const categoryMap = new Map<string, SlashCommand[]>();
    const uncategorized: SlashCommand[] = [];

    CATEGORIES.forEach(c => categoryMap.set(c.id, []));

    const localCategories = [...CATEGORIES];

    for (const cmd of allCommands) {
      let found = false;
      for (const cat of localCategories) {
        if (cat.commands.includes(cmd.data.name)) {
          categoryMap.get(cat.id)?.push(cmd);
          found = true;
          break;
        }
      }
      if (!found) uncategorized.push(cmd);
    }
    if (uncategorized.length > 0) {
      categoryMap.set("other", uncategorized);
      localCategories.push({ id: "other", label: "Other", emoji: CE.folder.str, desc: "Uncategorized commands", commands: [] });
    }

    const buildEmbed = (categoryId: string) => {
      const cat = localCategories.find(c => c.id === categoryId);
      
      if (categoryId === "overview") {
        return prettyEmbed({
          title: "Zenith Tester • Feature Staging & Systems Hub",
          description:
            `### ${CE.bot.str}  **Official Testing & Staging Environment**\n\n` +
            `This instance is used to test and refine the Zenith Bot ecosystem before production deployment.\n\n` +
            `**${CE.folder.str}  Command Categories**\n` +
            `> Browse through Zenith's feature categories in the dropdown below to explore commands.\n\n` +
            `**${CE.information.str}  Frequently Asked Questions**\n` +
            `> Solutions and quick tips for server owners and administrators.\n\n` +
            `**${CE.settings.str}  Initial Server Setup**\n` +
            `> Quick 4-step guide to configure roles, logging channels, and automations.\n\n` +
            `> ${CE.limited.str} **Upgrade to Zenith Premium:** Stop dealing with raids and bot lag. Unlock 24/7 dedicated voice nodes, God-Mode Anti-Nuke, and No-Prefix commands!\n` +
            `> ${CE.link.str} **[Join Official Support & Claim VIP Pass](https://discord.gg/gFgAfpSYdp)**`,
          thumbnail: interaction.client.user?.displayAvatarURL() || undefined,
          color: COLORS.primary,
        });
      }

      if (categoryId === "setup") {
        return prettyEmbed({
          title: "Zenith Bot — Server Setup Guide",
          description:
            `### ${CE.settings.str}  **Quick Setup Walkthrough**\n\n` +
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
            `### ${CE.clipboard.str}  **Frequently Asked Questions**\n\n` +
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
            `### ${CE.star.str}  **Take Your Server to the Top Tier**\n\n` +
            `Tired of bots crashing, laggy music, and server raids? Zenith Premium delivers enterprise reliability with dedicated infrastructure.\n\n` +
            `**${CE.owner.str} Exclusive Premium Capabilities:**\n` +
            `> • **No-Prefix Command Routing Engine:** Run commands naturally in chat without awkward prefixes (e.g. \`ban @user\` or \`play song\`).\n` +
            `> • **24/7 Always-On VC:** Dedicated voice connection that never disconnects, keeping the music playing 24/7.\n` +
            `> • **God-Mode Anti-Nuke:** Sub-20ms reaction trigger to immediately neutralize compromised admins or rogue bots.\n` +
            `> • **Custom Auto-Reactions (\`/auto-react\`):** Personalize channel and user reactions with your server emojis.\n` +
            `> • **Global AFK Tracking (\`/afk\`):** Cross-server and local status sync with custom triggers.\n\n` +
            `**${CE.limited.str} How to Claim Your VIP License:**\n` +
            `> Licenses are strictly managed to maintain 100% server quality. **Join the Official Support Server and open a VIP ticket:**\n` +
            `> ${CE.link.str} **[Claim Zenith Premium Today](https://discord.gg/gFgAfpSYdp)**`,
          thumbnail: interaction.client.user?.displayAvatarURL() || undefined,
          color: COLORS.premium,
        });
      }

      const cmds = categoryMap.get(categoryId) || [];

      const getBadge = (name: string) => {
        const mode = commandModes[name.toLowerCase()];
        if (!mode || mode === "normal") return "";
        if (mode === "maintenance") return " `<:sk_automations:1551170176882835497> MAINTENANCE`";
        if (mode === "down") return " `<:sk_ban:1551170098042372179> OFFLINE`";
        if (mode === "lockdown") return " `<:sk_lock:1551170070384742410> LOCKED`";
        if (mode === "dev_only") return " `<a:red_developer:1551170144574115930> DEV ONLY`";
        if (mode === "vip_only") return " `<:sk_badge_premium:1551170158407188490> VIP ONLY`";
        return "";
      };
      
      return prettyEmbed({
        title: `${cat?.label || "Command"} Suite`,
        description:
          `### ${cat?.emoji || CE.folder.str}  **${cat?.label || "Category"} Commands**\n\n` +
          (cmds.length > 0 
            ? cmds.map(c => `> **\`/${c.data.name}\`**${getBadge(c.data.name)} — ${c.data.description}`).join("\n")
            : "> *No commands found in this category.*") +
          `\n\n${CE.limited.str} **Want instant No-Prefix command routing?** Upgrade to Premium at [discord.gg/gFgAfpSYdp](https://discord.gg/gFgAfpSYdp)`,
        color: COLORS.primary,
      });
    };

    const buildMenu = (selected: string) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("help_category_select")
        .setPlaceholder("Select a command category...");

      for (const cat of localCategories) {
        if (cat.id === "other" && (!categoryMap.has("other") || categoryMap.get("other")!.length === 0)) continue;
        
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setDescription(cat.desc)
            .setEmoji(cat.emoji)
            .setValue(cat.id)
            .setDefault(cat.id === selected)
        );
      }

      return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
    };

    const helpSupportRow = buildSupportRow(`${CE.boost.str} Join Support & Get VIP`);

    const message = await interaction.editReply({
      embeds: [buildEmbed("overview")],
      components: [buildMenu("overview"), helpSupportRow],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "help_category_select") {
        const catId = i.values[0];
        await i.update({
          embeds: [buildEmbed(catId)],
          components: [buildMenu(catId), helpSupportRow],
        });
      }
    });

    collector.on("end", async () => {
      const disabledMenu = buildMenu("").components[0].setDisabled(true);
      const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(disabledMenu);
      await interaction.editReply({ components: [disabledRow, helpSupportRow] }).catch(() => {});
    });
  },
};

export default command;
