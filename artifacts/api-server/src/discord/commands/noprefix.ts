import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
  type GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { isUserPremium, isPermanentOwner, isBotAdmin } from "../storage/premium";
import { isNoPrefixEnabled, setNoPrefix } from "../storage/profile";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("noprefix")
    .setDescription("Toggle user-level No-Prefix command execution (Premium Perk)")
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("Action to take: enable, disable, or status")
        .setRequired(false)
        .addChoices(
          { name: "Enable No-Prefix", value: "enable" },
          { name: "Disable No-Prefix", value: "disable" },
          { name: "Check Status", value: "status" },
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.user;
    const guildId = interaction.guildId || undefined;
    const member = interaction.member as GuildMember | null;

    const action = interaction.options.getString("action")?.toLowerCase() || "status";
    const isOwner = isPermanentOwner(user.id);
    const isAdmin = isBotAdmin(user.id);
    const isPremium = await isUserPremium(user.id, guildId, member);

    if (action === "enable" || action === "on") {
      if (!isOwner && !isAdmin && !isPremium) {
        const premiumEmbed = prettyEmbed({
          title: "Zenith Premium Feature Required",
          color: COLORS.premium,
          description:
            `### ${CE.boost.str} **User-Level No-Prefix Execution**\n\n` +
            `Executing commands with zero prefix (e.g. \`play heat waves\`, \`skip\`, \`queue\`, \`ban\`) is an exclusive **Zenith Premium** perk!\n\n` +
            `• **Free Users:** Use your server prefix (e.g. \`.play\`, \`.help\`, \`.ping\`) or slash commands (\`/play\`).\n` +
            `• **Premium Perks:** Global No-Prefix command execution across all servers, dedicated 24/7 nodes, and Golden VIP identity.\n\n` +
            `${CE.crown.str} **Upgrade today:** [Claim VIP Access](https://discord.gg/gFgAfpSYdp)`,
          footer: "Zenith Premium System • Upgrade: discord.gg/gFgAfpSYdp",
        });

        await interaction.reply({
          embeds: [premiumEmbed],
          components: [buildSupportRow("Get VIP Pass") as any],
          ephemeral: true,
        });
        return;
      }

      setNoPrefix(user.id, "user", true);
      const embed = prettyEmbed({
        title: `${CE.success.str} No-Prefix Mode Enabled`,
        description:
          `### ${CE.check.str} **No-Prefix Execution is now ENABLED!**\n\n` +
          `You can now run commands across servers without typing any prefix (e.g. \`play <song>\`, \`queue\`, \`skip\`, \`profile\`, etc.).\n\n` +
          `*To disable at any time, run \`.np disable\` or \`/noprefix disable\`.*`,
        color: COLORS.success,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (action === "disable" || action === "off") {
      setNoPrefix(user.id, "user", false);
      const embed = prettyEmbed({
        title: `${CE.white_cancel.str} No-Prefix Mode Disabled`,
        description:
          `### ${CE.check.str} **No-Prefix Execution is now DISABLED.**\n\n` +
          `The bot will now only respond to messages starting with your server prefix (e.g. \`.\`) or slash commands.\n\n` +
          `*To re-enable at any time, run \`.np enable\` or \`/noprefix enable\`.*`,
        color: COLORS.primary,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Default: Status
    const isCurrentlyEnabled = await isNoPrefixEnabled(user.id, guildId);
    const statusEmbed = prettyEmbed({
      title: `${CE.settings.str} User No-Prefix Configuration`,
      description:
        `### Current Status: **${isCurrentlyEnabled ? `${CE.check.str} ENABLED` : `${CE.white_cancel.str} DISABLED`}**\n\n` +
        `• **User Account:** <@${user.id}>\n` +
        `• **VIP Status:** ${isPremium ? `${CE.star.str} \`PREMIUM ACTIVE\`` : `${CE.members.str} \`FREE USER\` (Requires Premium)`}\n\n` +
        `**Quick Commands:**\n` +
        `• \`.np enable\` — Turn on No-Prefix execution for your account\n` +
        `• \`.np disable\` — Turn off No-Prefix execution\n` +
        `• \`.np\` — Check your current status`,
      color: isCurrentlyEnabled ? COLORS.success : COLORS.primary,
    });

    await interaction.reply({
      embeds: [statusEmbed],
      components: isPremium ? [] : [buildSupportRow("Get VIP Pass") as any],
      ephemeral: true,
    });
  },
};

export default command;
