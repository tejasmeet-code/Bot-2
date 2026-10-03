import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActivityType,
} from "discord.js";
import { SlashCommand } from "../types";
import { isPermanentOwner } from "../storage/premium";
import { CE, prettyEmbed, errorEmbed, COLORS, resolveDynamicEmoji } from "../utils/embedStyle";
import { logger } from "../../lib/logger";
import { getGuildConfig } from "../storage/config";
import { setBotStatusMode, getOriginalAvatarUrl, setBotCommandMode, type BotStatusMode } from "../storage/botStatusState";
import sharp from "sharp";

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
        let processed: Buffer;
        if (type === "maintenance" || type === "dev_only") {
          // Grayscale version for maintenance / developer mode
          processed = await sharp(buffer).grayscale().png().toBuffer();
        } else {
          // Red-tinted version for down / lockdown / vip modes
          processed = await sharp(buffer).tint({ r: 255, g: 50, b: 50 }).png().toBuffer();
        }
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
    client.user.setPresence({
      activities: [{ name: type === "normal" ? "demonxtejas" : statusText, type: ActivityType.Listening }],
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
