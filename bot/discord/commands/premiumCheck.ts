import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  canAccessPremiumPanel,
  checkTargetPremium,
  PERMANENT_BOT_OWNER_ID,
} from "../storage/premium";
import { CE } from "../utils/embedStyle";

export const premiumCheckCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premiumcheck")
    .setDescription("Bot Owner & Staff: Verify real-time premium status and VIP perks for any user or server.")
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("User ID, @mention, or Server ID to verify")
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // 1. Permission check: Owners, Bot Staff, Server Owners
    if (!(await canAccessPremiumPanel(interaction.user.id, interaction.guild?.ownerId))) {
      await interaction.reply({
        content: `${CE.failure.str} Access Restricted: Only Bot Owners, Bot Staff, and Server Owners can verify premium subscription status.`,
        flags: 1 << 6,
      });
      return;
    }

    // 2. Resolve target ID
    let rawTarget = interaction.options.getString("target")?.trim();
    if (!rawTarget) {
      const rawArgs: string[] = (interaction as any).rawArgs ?? [];
      if (rawArgs.length > 0) {
        rawTarget = rawArgs.join(" ").trim();
      }
    }

    let targetId = interaction.user.id;
    if (rawTarget) {
      const match = rawTarget.match(/\d{17,20}/);
      if (match) {
        targetId = match[0];
      } else {
        await interaction.reply({
          content: `${CE.failure.str} Invalid target: Please provide a valid User ID, @User mention, or Server ID.`,
          flags: 1 << 6,
        });
        return;
      }
    }

    await interaction.deferReply();

    // 3. Inspect target via premium storage
    const info = await checkTargetPremium(targetId, interaction.client);

    // Try to resolve user or guild details
    let targetName = targetId;
    let isUserObject = false;
    let isGuildObject = false;

    try {
      const fetchedUser = await interaction.client.users.fetch(targetId).catch(() => null);
      if (fetchedUser) {
        targetName = `${fetchedUser.tag} (${fetchedUser.id})`;
        isUserObject = true;
      }
    } catch {}

    if (!isUserObject && interaction.client.guilds) {
      const fetchedGuild = interaction.client.guilds.cache.get(targetId);
      if (fetchedGuild) {
        targetName = `${fetchedGuild.name} (\`${fetchedGuild.id}\`)`;
        isGuildObject = true;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CE.star.str} Premium Status Verification`)
      .setTimestamp()
      .setFooter({ text: `Zenith Executive Registry • Checked by ${interaction.user.tag}` });

    if (info.isActive) {
      embed.setColor(0xF1C40F);
      embed.setDescription(
        `### Target: ${isUserObject ? `<@${targetId}>` : `\`${targetName}\``}\n` +
        `**Classification**: \`${info.type.toUpperCase()}\` • **Current Tier**: **${info.overallPlan}**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### ${CE.star.str} Subscription Details\n` +
        (info.isPermanentOwner ? `• **Authorization**: Hardcoded Permanent Bot Owner\n• **Expiration**: \`Never (Lifetime Access)\`\n` : "") +
        (info.isBotAdmin && !info.isPermanentOwner ? `• **Authorization**: Appointed Bot Administrator\n• **Expiration**: \`Never (Lifetime Access)\`\n` : "") +
        (info.isBotStaff ? `• **Staff Ranking**: \`${info.staffRole?.toUpperCase() ?? "STAFF"}\`\n` : "") +
        (info.userExpiry ? (
          info.isUserLifetime
            ? `• **User Plan**: ${CE.star.str} **Lifetime VIP Access**\n• **Valid Until**: \`Permanent\`\n`
            : `• **User Plan**: **Active**\n• **Remaining Time**: \`${info.userDaysLeft} day(s)\`\n• **Expires On**: <t:${Math.floor(info.userExpiry / 1000)}:F> (<t:${Math.floor(info.userExpiry / 1000)}:R>)\n`
        ) : "") +
        (info.guildExpiry ? (
          info.isGuildLifetime
            ? `• **Server Plan**: ${CE.star.str} **Lifetime Server VIP**\n• **Valid Until**: \`Permanent\`\n`
            : `• **Server Plan**: **Active**\n• **Remaining Time**: \`${info.guildDaysLeft} day(s)\`\n• **Expires On**: <t:${Math.floor(info.guildExpiry / 1000)}:F> (<t:${Math.floor(info.guildExpiry / 1000)}:R>)\n`
        ) : "") +
        (info.rolePremiums.length > 0 ? (
          `• **Role-Based Premium**: Active via **${info.rolePremiums.length}** configured server role(s):\n` +
          info.rolePremiums.map((r) => `  - <@&${r.roleId}> in **${r.guildName ?? r.guildId}**`).join("\n") + "\n"
        ) : "") +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### ${CE.star.str} Unlocked VIP Privileges\n` +
        `• ${CE.radio.str} **Remote VC Audio**: Stream audio directly into any voice channel without joining (\`.play <song> <vc_or_user>\`)\n` +
        `• ${CE.music.str} **24/7 Voice Radio**: Keep the bot in voice 24/7 with auto-reconnect (\`.24/7 <vc_or_user>\`)\n` +
        `• ${CE.promotion.str} **Global No-Prefix Mode**: Run any bot command freely with no prefix\n` +
        `• ${CE.level.str} **Priority Audio Bitrate & Equalizer DSP Engine**\n`
      );
    } else {
      embed.setColor(0xED4245);
      embed.setDescription(
        `### Target: ${isUserObject ? `<@${targetId}>` : `\`${targetName}\``}\n` +
        `**Status**: ${CE.failure.str} **No Active Premium Subscription Found**\n\n` +
        `This user or server does not currently hold an active premium subscription, lifetime grant, or server-configured premium role.\n\n` +
        `• **To Grant User/Server Premium**: The Hardcoded Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can grant subscriptions via \`.premiumpanel\` or \`.premium give <@user|id> <days>\`.\n` +
        `• **To Redeem a License Code**: Use \`/premium-user <code>\` or \`/premium-server <code>\`.`
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
