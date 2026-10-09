import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActivityType,
} from "discord.js";
import { SlashCommand } from "../types";
import { isPermanentOwner } from "../storage/premium";
import { isBotStaff } from "../storage/botStaff";
import { CE, prettyEmbed, errorEmbed, COLORS, resolveDynamicEmoji } from "../utils/embedStyle";
import { logger } from "../../lib/logger";
import { getGuildConfig } from "../storage/config";
import { setBotStatusMode, getOriginalAvatarUrl, setBotCommandMode, type BotStatusMode } from "../storage/botStatusState";

export function formatNitroUsername(text: string, style: string = "bold_sans"): string {
  const boldSansMap: Record<string, string> = {
    A: "𝘼", B: "𝘽", C: "𝘾", D: "𝘿", E: "𝙀", F: "𝙁", G: "𝙂", H: "𝙃", I: "𝙄", J: "𝙅", K: "𝙆", L: "𝙇", M: "𝙈",
    N: "𝙉", O: "𝙊", P: "𝙋", Q: "𝙌", R: "𝙍", S: "𝙎", T: "𝙏", U: "𝙐", V: "𝙑", W: "𝙒", X: "𝙯", Y: "𝙔", Z: "𝙕",
    a: "𝙖", b: "𝙗", c: "𝙘", d: "𝙙", e: "𝙚", f: "𝙛", g: "𝙜", h: "𝙝", i: "𝙞", j: "𝙟", k: "𝙠", l: "𝙡", m: "𝙢",
    n: "𝙣", o: "𝙤", p: "𝙥", q: "𝙦", r: "𝙧", s: "𝙨", t: "𝙩", u: "𝙪", v: "𝙫", w: "𝙬", x: "𝙭", y: "𝙮", z: "𝙯",
    "0": "𝟬", "1": "𝟭", "2": "𝟮", "3": "𝟯", "4": "𝟰", "5": "𝟱", "6": "𝟲", "7": "𝟳", "8": "𝟴", "9": "𝟵"
  };

  const boldSerifMap: Record<string, string> = {
    A: "𝐀", B: "𝐁", C: "𝐂", D: "𝐃", E: "𝐄", F: "𝐅", G: "𝐆", H: "𝐇", I: "𝐈", J: "𝐉", K: "𝐊", L: "𝐋", M: "𝐌",
    N: "𝐍", O: "𝐎", P: "𝐏", Q: "𝐐", R: "𝐑", S: "𝐒", T: "𝐓", U: "𝐔", V: "𝐕", W: "𝐖", X: "𝐗", Y: "𝐘", Z: "𝐙",
    a: "𝐚", b: "𝐛", c: "𝐜", d: "𝐝", e: "𝐞", f: "𝐟", g: "𝐠", h: "𝐡", i: "𝐢", j: "𝐣", k: "𝐤", l: "𝐥", m: "𝐦",
    n: "𝐧", o: "𝐨", p: "𝐩", q: "𝐪", r: "𝐫", s: "𝐬", t: "𝐭", u: "𝐮", v: "𝐯", w: "𝐰", x: "𝐱", y: "𝐲", z: "𝐳"
  };

  const italicScriptMap: Record<string, string> = {
    A: "𝓐", B: "𝓑", C: "𝓒", D: "𝓓", E: "𝓔", F: "贵", G: "𝓖", H: "𝓗", I: "𝓘", J: "𝓙", K: "𝓚", L: "𝓛", M: "𝓜",
    N: "𝓝", O: "𝓞", P: "𝓟", Q: "𝓠", R: "𝓡", S: "𝓢", T: "𝓯", U: "𝓤", V: "𝓥", W: "𝓦", X: "𝓧", Y: "𝓨", Z: "𝓩",
    a: "𝒶", b: "𝒷", c: "𝒸", d: "𝒹", e: "𝑒", f: "𝒻", g: "𝑔", h: "𝒽", i: "𝒾", j: "𝒿", k: "<ctrl42>", l: "𝓁", m: "𝓂",
    n: "𝓃", o: "𝑜", p: "𝓅", q: "𝓆", r: "𝓇", s: "𝓈", t: "𝓉", u: "𝓊", v: "𝓋", w: "𝓌", x: "𝓍", y: "𝓎", z: "𝓏"
  };

  const smallCapsMap: Record<string, string> = {
    a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ғ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ",
    n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ"
  };

  const medievalMap: Record<string, string> = {
    A: "Ⲍ", B: "Ⲃ", C: "Ⲥ", D: "Ⲇ", E: "Ⲉ", F: "Ϥ", G: "Ⲅ", H: "Ⲏ", I: "Ⲓ", J: "Ϫ", K: "Ⲕ", L: "Ⲗ", M: "Ⲙ",
    N: "Ⲛ", O: "Ⲟ", P: "Ⲡ", Q: "Ϥ", R: "Ⲣ", S: "Ⲥ", T: "Ⲧ", U: "Ⲩ", V: "Ⲃ", W: "Ⲱ", X: "Ⲭ", Y: "Ⲩ", Z: "Ⲍ",
    a: "ⲁ", b: "ⲃ", c: "ⲥ", d: "ⲇ", e: "ⲉ", f: "ϥ", g: "ⲅ", h: "ⲏ", i: "ⲓ", j: "ϫ", k: "ⲕ", l: "ⲗ", m: "ⲙ",
    n: "ⲛ", o: "ⲟ", p: "ⲡ", q: "ϥ", r: "ⲣ", s: "ⲥ", t: "ⲧ", u: "ⲩ", v: "ⲃ", w: "ⲱ", x: "ⲭ", y: "ⲩ", z: "ⲛ"
  };

  let chosenMap = boldSansMap;
  if (style === "bold_serif") chosenMap = boldSerifMap;
  else if (style === "italic_script") chosenMap = italicScriptMap;
  else if (style === "small_caps") chosenMap = smallCapsMap;
  else if (style === "medieval" || style === "gothic") chosenMap = medievalMap;

  const converted = text.split("").map(ch => chosenMap[ch] || ch).join("");
  if (converted.includes("⚡")) return converted.slice(0, 32);
  return `⚡ ${converted} ⚡`.slice(0, 32);
}

export const botStatusCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("botmaintenance")
      .setDescription("Bot Owner: Set bot status to maintenance.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "maintenance");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botmaintainence")
      .setDescription("Bot Owner: Set bot status to maintenance.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "maintenance");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botdown")
      .setDescription("Bot Owner: Set bot status to down.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "down");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botlockdown")
      .setDescription("Bot Owner: Set bot status to lockdown.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "lockdown");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botdevonly")
      .setDescription("Bot Owner: Set bot status to developer-only mode.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "dev_only");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botviponly")
      .setDescription("Bot Owner: Set bot status to VIP & Staff only mode.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "vip_only");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botnormal")
      .setDescription("Bot Owner: Restore bot status to normal.")
      .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        const res = await executeBotStatusUpdate(interaction.client, "normal");
        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Bot Status Updated",
            description: res.message,
            color: res.color,
          })],
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Update Failed", err.message || "An unknown error occurred.")],
        });
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("botcmd")
      .setDescription("Bot Owner: Set specific command status/access mode.")
      .setDMPermission(false)
      .addStringOption(o =>
        o.setName("name").setDescription("The exact name of the command to restrict (e.g. 'play', 'ban')").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("mode").setDescription("The lock mode to apply to this command").setRequired(true)
          .addChoices(
            { name: "Fully Open (normal)", value: "normal" },
            { name: "Under Maintenance (maintenance)", value: "maintenance" },
            { name: "Service Down (down)", value: "down" },
            { name: "Emergency Lockdown (lockdown)", value: "lockdown" },
            { name: "Developer Only (dev_only)", value: "dev_only" },
            { name: "VIP & Staff Only (vip_only)", value: "vip_only" }
          )
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }

      let cmdName = interaction.options.getString("name")?.trim().toLowerCase();
      let modeStr = interaction.options.getString("mode")?.trim().toLowerCase();

      // Prefix parsing fallback
      if (!cmdName || !modeStr) {
        // @ts-ignore
        const rawArgs = interaction.rawArgs || [];
        cmdName = rawArgs[0]?.trim().toLowerCase();
        modeStr = rawArgs[1]?.trim().toLowerCase();
      }

      if (!cmdName || !modeStr) {
        await interaction.reply({
          embeds: [errorEmbed("Invalid Arguments", "Usage: `.botcmd <commandName> <mode>`\nValid modes: `normal`, `maintenance`, `down`, `lockdown`, `dev_only`, `vip_only`")]
        });
        return;
      }

      const validModes = new Set(["normal", "maintenance", "down", "lockdown", "dev_only", "vip_only"]);
      if (!validModes.has(modeStr)) {
        await interaction.reply({
          embeds: [errorEmbed("Invalid Mode", `The mode \`${modeStr}\` is not recognized.\nChoose from: \`normal\`, \`maintenance\`, \`down\`, \`lockdown\`, \`dev_only\`, \`vip_only\``)]
        });
        return;
      }

      // Check if command is registered in registry
      const { getGuildCommands } = await import("../registry");
      const exists = getGuildCommands().some(c => c.data.name.toLowerCase() === cmdName);
      if (!exists && cmdName !== "all" && cmdName !== "music") {
        await interaction.reply({
          embeds: [errorEmbed("Command Not Found", `Warning: \`${cmdName}\` is not currently a registered bot command, but state has been saved.`)]
        });
        return;
      }

      await setBotCommandMode(cmdName, modeStr as BotStatusMode, interaction.user.tag);

      await interaction.reply({
        embeds: [prettyEmbed({
          title: `Command Access Restructured`,
          description: `Successfully set command **\`/${cmdName}\`** to **${modeStr.toUpperCase()}** mode.\n\n• **Access Restrictions:** Effective immediately.\n• **Help Display:** Description will update with badge indicator.`,
          color: modeStr === "normal" ? COLORS.success : COLORS.warning,
        })]
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName("syncpfp")
      .setDescription("Bot Owner: Sync and set new profile picture baseline.")
      .setDMPermission(false)
      .addStringOption(o =>
        o.setName("url").setDescription("Optional image URL for new bot avatar").setRequired(false)
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only the absolute Bot Owner can run this command.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply();
      try {
        let imageUrl = interaction.options.getString("url")?.trim();
        // @ts-ignore
        if (!imageUrl && interaction.rawArgs?.[0]) {
          // @ts-ignore
          imageUrl = interaction.rawArgs[0].trim();
        }

        const client = interaction.client;
        const { updateOriginalAvatarUrl, getBotStatusMode } = await import("../storage/botStatusState");

        if (imageUrl) {
          const res = await fetch(imageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          if (!res.ok) {
            throw new Error(`Failed to download image from provided URL (HTTP ${res.status})`);
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          await client.user.setAvatar(buffer);
        }

        // Get fresh avatar URL after potential update
        const freshAvatarUrl = client.user.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
        await updateOriginalAvatarUrl(freshAvatarUrl);

        const currentMode = await getBotStatusMode();
        if (currentMode !== "normal") {
          await executeBotStatusUpdate(client, currentMode);
        }

        await interaction.editReply({
          embeds: [prettyEmbed({
            title: "Profile Picture Baseline Synced",
            description: `Successfully updated **Zenith Bot** profile picture baseline!\n\n• **New Avatar URL:** [View Avatar](${freshAvatarUrl})\n• **Active Status Mode:** \`${currentMode.toUpperCase()}\`\n• **Status Mode Tinting:** ${currentMode !== "normal" ? "Applied to new image" : "Clean original active"}`,
            color: COLORS.success,
          })]
        });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [errorEmbed("Sync Failed", err.message || "Could not update bot profile picture.")],
        });
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName("setstatus")
      .setDescription("Bot Owner/Staff: Change bot presence status (Online, Offline, Idle, DND) and optional activity.")
      .setDMPermission(false)
      .addStringOption(o =>
        o.setName("status")
          .setDescription("Select presence status")
          .setRequired(true)
          .addChoices(
            { name: "Online (Green)", value: "online" },
            { name: "Idle / AFK (Yellow)", value: "idle" },
            { name: "Do Not Disturb (Red)", value: "dnd" },
            { name: "Offline / Invisible (Gray)", value: "invisible" }
          )
      )
      .addStringOption(o =>
        o.setName("activity")
          .setDescription("Optional custom status activity text (e.g. '.help | Server Guard')")
          .setRequired(false)
      )
      .addStringOption(o =>
        o.setName("type")
          .setDescription("Activity type")
          .setRequired(false)
          .addChoices(
            { name: "Playing", value: "0" },
            { name: "Streaming", value: "1" },
            { name: "Listening", value: "2" },
            { name: "Watching", value: "3" },
            { name: "Custom", value: "4" },
            { name: "Competing", value: "5" }
          )
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id) && !(await isBotStaff(interaction.user.id))) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only Bot Owners and Staff can change the bot presence status.")],
          ephemeral: true,
        });
        return;
      }

      let statusInput = interaction.options.getString("status")?.toLowerCase() || "";
      let activityInput = interaction.options.getString("activity") || "";
      let typeInput = parseInt(interaction.options.getString("type") || "4", 10);

      // @ts-ignore
      const rawArgs = interaction.rawArgs || [];
      if (!statusInput && rawArgs.length > 0) {
        statusInput = rawArgs[0].toLowerCase();
        if (rawArgs.length > 1) {
          activityInput = rawArgs.slice(1).join(" ");
        }
      }

      let mappedStatus: "online" | "idle" | "dnd" | "invisible" = "online";
      if (["idle", "afk", "away", "yellow"].includes(statusInput)) {
        mappedStatus = "idle";
      } else if (["dnd", "do_not_disturb", "busy", "red"].includes(statusInput)) {
        mappedStatus = "dnd";
      } else if (["offline", "invisible", "hidden", "gray"].includes(statusInput)) {
        mappedStatus = "invisible";
      } else {
        mappedStatus = "online";
      }

      const client = interaction.client;
      const actText = activityInput.trim() || ".help | Server Guard";

      try {
        client.user.setPresence({
          status: mappedStatus,
          activities: [
            {
              name: actText,
              type: isNaN(typeInput) ? ActivityType.Custom : typeInput,
              state: actText,
            },
          ],
        });
      } catch (err: any) {
        logger.error({ err: err?.message }, "Failed to update bot status presence");
      }

      const statusBadge =
        mappedStatus === "online" ? "🟢 Online" :
        mappedStatus === "idle" ? "🟡 Idle" :
        mappedStatus === "dnd" ? "🔴 Do Not Disturb" : "⚪ Offline / Invisible";

      await interaction.reply({
        embeds: [prettyEmbed({
          title: "Bot Presence Status Updated",
          description: `Successfully updated **${client.user.username}** presence!\n\n• **Status:** \`${statusBadge}\`\n• **Activity Text:** \`${actText}\``,
          color: COLORS.success,
        })],
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName("botname")
      .setDescription("Bot Owner/Staff: Change bot username and per-server nicknames to stylish Nitro username text.")
      .setDMPermission(false)
      .addStringOption(o =>
        o.setName("name").setDescription("New bot name (or text to convert into Nitro style)").setRequired(false)
      )
      .addStringOption(o =>
        o.setName("style")
          .setDescription("Nitro text font style")
          .setRequired(false)
          .addChoices(
            { name: "⚡ 𝙕𝙀𝙉𝙄𝙏𝙃 𝘽𝙊𝙏 ⚡ (Bold Sans)", value: "bold_sans" },
            { name: "⚡ 𝐙𝐞𝐧𝐢𝐭𝐡 𝐁𝐨𝐭 ⚡ (Bold Serif)", value: "bold_serif" },
            { name: "⚡ 𝒁𝒆𝒏𝒊𝒕𝒉 𝑩𝒐𝒕 ⚡ (Italic Script)", value: "italic_script" },
            { name: "⚡ ᴢᴇɴɪᴛʜ ʙᴏᴛ ⚡ (Small Caps)", value: "small_caps" },
            { name: "⚡ 𝔅𝔬𝔱 ℨ𝔢𝔫𝔦𝔱𝔥 ⚡ (Gothic)", value: "gothic" },
            { name: "⚡ Ⲍⲉⲛⲓⲧⲁ Ⲃⲟⲧ ⚡ (Medieval)", value: "medieval" }
          )
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!isPermanentOwner(interaction.user.id) && !(await isBotStaff(interaction.user.id))) {
        await interaction.reply({
          embeds: [errorEmbed("Access Denied", "Only Bot Owners and Staff can change the bot username.")],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      let inputName = interaction.options.getString("name")?.trim();
      let styleOption = interaction.options.getString("style") || "bold_sans";

      // @ts-ignore
      const rawArgs = interaction.rawArgs || [];
      if (!inputName && rawArgs.length > 0) {
        inputName = rawArgs.join(" ").trim();
      }

      if (!inputName) {
        inputName = "Zenith Bot";
      }

      const stylishName = formatNitroUsername(inputName, styleOption);
      const client = interaction.client;

      let globalNameChanged = false;
      try {
        await client.user.setUsername(stylishName);
        globalNameChanged = true;
      } catch (err: any) {
        logger.info({ err: err?.message }, "Global setUsername skipped or rate limited — applying per-server nicknames");
      }

      let updatedNicknames = 0;
      for (const [_, guild] of client.guilds.cache) {
        try {
          const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
          if (me) {
            await me.setNickname(stylishName).catch(() => {});
            updatedNicknames++;
          }
        } catch {}
      }

      await interaction.editReply({
        embeds: [prettyEmbed({
          title: "Bot Username & Nitro Styling Updated",
          description: `Successfully updated bot name to Nitro username text!\n\n• **New Nitro Name:** **\`${stylishName}\`**\n• **Global Name Updated:** ${globalNameChanged ? "Yes" : "Nicknames Applied (Rate Limited)"}\n• **Server Nicknames Synced:** **${updatedNicknames}** servers`,
          color: COLORS.success,
        })],
      });
    }
  }
];

export async function executeBotStatusUpdate(client: any, type: BotStatusMode) {
  const anEmoji = resolveDynamicEmoji(client, "sk_antinuke", CE.nuke.id);
  const connEmoji = resolveDynamicEmoji(client, "sk_connect", CE.link.id);
  const premEmoji = resolveDynamicEmoji(client, "sk_badge_premium", CE.boost.id);

  let newName = "Zenith Bot";
  let newDesc = `Zenith Bot - The ultimate high-performance Discord management, moderation, music, and AI operations system.\n\nEquipped with advanced Anti-Nuke security, 24/7 High-Fidelity Music streaming, AutoMod, and AI Admin capabilities.\n\n${connEmoji} Support Server: https://discord.gg/gFgAfpSYdp\n${premEmoji} Made by demonXtejas`;
  let color: number = COLORS.success;
  let statusText = "Online & Active";
  let presenceStatus: "online" | "idle" | "dnd" = "online";

  if (type === "maintenance") {
    newName = "Zenith [MAINTENANCE]";
    newDesc = `Zenith Bot is currently undergoing scheduled maintenance. Some features might be temporarily restricted.\n\n${connEmoji} Support Server: https://discord.gg/gFgAfpSYdp\n${premEmoji} Made by demonXtejas`;
    color = COLORS.neutral;
    statusText = "Maintenance Mode";
    presenceStatus = "idle";
  } else if (type === "down") {
    newName = "Zenith [DOWN]";
    newDesc = `Zenith Bot is currently offline / experiencing technical downtime. We will be back shortly.\n\n${connEmoji} Support Server: https://discord.gg/gFgAfpSYdp\n${premEmoji} Made by demonXtejas`;
    color = COLORS.danger;
    statusText = "Service Offline";
    presenceStatus = "dnd";
  } else if (type === "lockdown") {
    newName = "Zenith [LOCKDOWN]";
    newDesc = `Emergency Lockdown is active on Zenith Bot. Operations are restricted to authorized Bot Staff only.\n\n${connEmoji} Support Server: https://discord.gg/gFgAfpSYdp\n${premEmoji} Made by demonXtejas`;
    color = COLORS.danger;
    statusText = "Emergency Lockdown";
    presenceStatus = "dnd";
  } else if (type === "dev_only") {
    newName = "Zenith [DEVELOPER]";
    newDesc = `Zenith Bot is running in Developer-Only Mode for direct system updates.\n\n${connEmoji} Support Server: https://discord.gg/gFgAfpSYdp\n${premEmoji} Made by demonXtejas`;
    color = COLORS.neutral;
    statusText = "Developer Only";
    presenceStatus = "idle";
  } else if (type === "vip_only") {
    newName = "Zenith [VIP ONLY]";
    newDesc = `Zenith Bot is currently operating in VIP & Staff Only access mode.\n\n${connEmoji} Support Server: https://discord.gg/gFgAfpSYdp\n${premEmoji} Made by demonXtejas`;
    color = COLORS.premium;
    statusText = "VIP Mode";
    presenceStatus = "online";
  }

  // 1. Update Global Avatar (Save current avatar as baseline for status mode tinting/grayscaling)
  const currentAvatarUrl = client.user.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
  const { updateOriginalAvatarUrl } = await import("../storage/botStatusState");
  let savedOriginalUrl = await getOriginalAvatarUrl();

  if (type === "normal") {
    // If we have a saved original clean avatar, restore it on Discord
    if (savedOriginalUrl) {
      try {
        const res = await fetch(savedOriginalUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          await client.user.setAvatar(buffer);
        }
      } catch (err) {
        logger.warn({ err }, "Could not restore original clean bot avatar");
      }
    }
    // Update baseline to the clean avatar
    const updatedUrl = client.user.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
    await setBotStatusMode("normal", "owner", updatedUrl);
  } else {
    // Entering a restricted mode
    if (!savedOriginalUrl) {
      savedOriginalUrl = currentAvatarUrl;
      await updateOriginalAvatarUrl(savedOriginalUrl || null);
    }

    try {
      // ALWAYS transform from the clean original baseline image
      const sourceUrl = savedOriginalUrl || currentAvatarUrl;
      const res = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const { createCanvas, loadImage } = await import("@napi-rs/canvas");
        const img = await loadImage(buffer);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        
        if (type === "maintenance" || type === "dev_only") {
          // Grayscale version for maintenance / developer mode
          for (let i = 0; i < imgData.data.length; i += 4) {
            const r = imgData.data[i];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            imgData.data[i] = gray;
            imgData.data[i + 1] = gray;
            imgData.data[i + 2] = gray;
          }
        } else {
          // Red-tinted version for down / lockdown / vip modes
          for (let i = 0; i < imgData.data.length; i += 4) {
            const r = imgData.data[i];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            imgData.data[i] = Math.min(255, gray + 100);
            imgData.data[i + 1] = Math.max(0, gray - 50);
            imgData.data[i + 2] = Math.max(0, gray - 50);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const processed = canvas.toBuffer("image/png");
        await client.user.setAvatar(processed);
      }
    } catch (err) {
      logger.warn({ err }, "Could not apply bot status avatar change");
    }
  }

  // Persist current status lock state
  await setBotStatusMode(type, "owner");

  // 2. Update Application Description
  try {
    await client.application.edit({
      description: newDesc,
    });
  } catch (err) {
    logger.warn({ err }, "Could not update bot status application description");
  }

  // 3. Update Username (Global) & Guild Server Nicknames across ALL servers
  try {
    await client.user.setUsername(newName);
  } catch (e: any) {
    if (e?.code === 50035 || e?.message?.includes("verified") || e?.message?.includes("verified support required")) {
      logger.info(`[STATUS] Application is verified, skipping global username change to "${newName}".`);
    } else {
      logger.warn({ e }, "Rate limited on global username change — updating per-server nicknames instead");
    }
  }

  let nicknameCount = 0;
  for (const [_, guild] of client.guilds.cache) {
    try {
      const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
      if (me) {
        await me.setNickname(newName).catch(() => {});
        nicknameCount++;
      }
    } catch {}
  }

  // 4. Update Presence
  try {
    const normalActivity = ".help | Server Guard";
    client.user.setPresence({
      activities: [
        {
          name: type === "normal" ? normalActivity : statusText,
          type: ActivityType.Custom,
          state: type === "normal" ? normalActivity : statusText,
        },
      ],
      status: presenceStatus,
    });
  } catch (err) {
    logger.warn({ err }, "Could not update bot presence");
  }

  // 5. Broadcast to all servers
  const guilds = client.guilds.cache;
  let broadcastCount = 0;
  for (const [id, guild] of guilds) {
    try {
      const cfg = await getGuildConfig(id);
      let targetChannelId = cfg.channels?.botNotifications || cfg.channels?.moderation || cfg.channels?.antiNukeLog;
      let ch = targetChannelId ? guild.channels.cache.get(targetChannelId) : null;
      if (!ch) {
        ch = guild.channels.cache.find((c: any) => c.isTextBased() && c.permissionsFor(guild.members.me)?.has("SendMessages")) ?? null;
      }
      if (ch && ch.isTextBased()) {
        const notifEmoji = resolveDynamicEmoji(client, "sk_broad", CE.notifications.id);
        const embed = prettyEmbed({
          title: `${notifEmoji} Global Status Update: ${statusText}`,
          description: `The bot status has been updated to **${type.toUpperCase()}** by the developers.\n\n${newDesc}`,
          color: color,
          footer: "Zenith Global Infrastructure",
        });
        await (ch as any).send({ embeds: [embed] }).catch(() => {});
        broadcastCount++;
        // Add a small delay to avoid hitting global rate limits if in many guilds
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    } catch {}
  }

  return {
    success: true,
    message: `Successfully set bot status to **${type}**.\n\n• **Name Updated In:** ${nicknameCount} servers\n• **Broadcasted to:** ${broadcastCount} servers`,
    color,
    broadcastCount,
  };
}

export default botStatusCommands;
