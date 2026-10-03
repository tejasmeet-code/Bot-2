import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type AutocompleteInteraction,
  type Interaction,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  isUserPremium,
  isGuildPremium,
  isPermanentOwner,
  isBotAdmin,
  PERMANENT_BOT_OWNER_ID,
  grantDirectPremium,
  removeDirectPremium,
  setPremiumRole,
  removePremiumRole,
  listActivePremiums,
  createPremiumCode,
  redeemPremiumCode,
  checkTargetPremium,
  sendStaffAndOwnerBriefing,
} from "../storage/premium";
import {
  isNoPrefixEnabled,
  setNoPrefix,
  getUserPremiumTier,
  setUserPremiumTier,
  PREMIUM_TIERS,
  PREMIUM_TIER_NAMES,
} from "../storage/profile";
import { getBotStaffRole, isBotStaff } from "../storage/botStaff";
import { CE, COLORS, prettyEmbed, SUPPORT_SERVER_URL } from "../utils/embedStyle";
import { safeSendUserDm } from "../utils/dmWebhook";

/**
 * Access check for the Premium Control Panel
 */
async function canAccessPremiumPanel(
  userId: string,
  guildOwnerId?: string | null,
): Promise<boolean> {
  if (isPermanentOwner(userId)) return true;
  if (isBotAdmin(userId)) return true;
  if (await isBotStaff(userId)) return true;
  if (guildOwnerId && guildOwnerId === userId) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 1. /premium (General User/Server Information & Status)
// ---------------------------------------------------------------------------
export const premiumCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("View Zenith Premium perks, tier breakdown, and manage your status")
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check your personal and server VIP status"),
    )
    .addSubcommand((sub) =>
      sub.setName("tiers").setDescription("View breakdown of VIP Tiers 1 through 4"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("redeem")
        .setDescription("Redeem a Zenith Premium license code")
        .addStringOption((o) =>
          o.setName("code").setDescription("The license code").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("noprefix")
        .setDescription("Toggle or check your global No-Prefix command status"),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand(false) || "status";
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (sub === "tiers") {
      const embed = new EmbedBuilder()
        .setTitle("👑 Zenith VIP Tiers & Feature Breakdown")
        .setColor(0xF1C40F)
        .setDescription(
          `Below is the complete breakdown of all 4 **Zenith Premium Tiers**.\n\n` +
          `### 🌟 **Tier 1: VIP Supporter**\n` +
          `• ⚡ **Global No-Prefix Commands**: Run \`play\`, \`skip\`, \`queue\` without prefix\n` +
          `• 🎶 **320kbps Lossless Audio Resolution**: Crystal-clear HD audio stream\n` +
          `• 🎛️ **14 Studio Equalizer Presets**: Bassboost, superbass, treble, pop, electronic (\`.eq\`)\n` +
          `• 🎨 **Dynamic Profile Cards**: Canvas profile badge and bio customization\n\n` +
          `### 🚀 **Tier 2: Pro Master**\n` +
          `• 📻 **24/7 Dedicated Voice Radio**: Keep the bot in voice 24/7 with auto-reconnect (\`.24/7\`)\n` +
          `• 🤖 **AI Autoplay Engine**: Continuous queue recommendations (\`.autoplay\`)\n` +
          `• 📚 **Unlimited Custom Playlists**: Save and load custom server playlists (\`.playlist\`)\n` +
          `• 🔊 **Nightcore, Vaporwave & 8D Spatial DSP**: 3D spatial surround filters\n\n` +
          `### 🛡️ **Tier 3: Enterprise God Mode**\n` +
          `• 🛡️ **Enterprise Anti-Nuke Protection**: 3 Security Walls anti-raid defense system (\`.antinuke\`)\n` +
          `• ⚡ **Mass-Action Mitigation**: Intercepts unauthorized deletions instantly\n` +
          `• 🎧 **Lossless FLAC Studio Engine**: Uncompressed lossless audio resolution\n` +
          `• 💎 **100% Ad-Free**: Removes promotional ads and sponsored footers\n\n` +
          `### 👑 **Tier 4: Ultimate Zenith Apex**\n` +
          `• 👑 **ALL 40+ VIP Perks Fully Unlocked** across all servers\n` +
          `• 🤖 **AI Autopilot DJ Engine**: Autonomous continuous queue generation\n` +
          `• 🎭 **Custom Server Bot Identity & Avatar**: Full \`.botavatar\` customization\n` +
          `• 🚀 **Priority Cluster Nodes**: Ultra-low latency voice packet processing`
        )
        .setFooter({ text: "Zenith Premium Ecosystem • /premium redeem to activate" });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "redeem") {
      const code = interaction.options.getString("code", true).trim();
      const result = await redeemPremiumCode(code, userId, "user");
      await interaction.reply({
        content: result.success ? `${CE.success.str} ${result.message}` : `${CE.failure.str} ${result.message}`,
        flags: 1 << 6,
      });
      return;
    }

    if (sub === "noprefix") {
      const current = await isNoPrefixEnabled(userId);
      setNoPrefix(userId, "user", !current);
      const newState = !current;
      await interaction.reply({
        content: `${newState ? "⚡" : "🚫"} **Global No-Prefix Mode is now ${newState ? "`ENABLED` (Commands run without prefix)" : "`DISABLED` (Prefix required)"}!**`,
        flags: 1 << 6,
      });
      return;
    }

    // Default: status
    const info = await checkTargetPremium(userId, interaction.client);
    const npActive = await isNoPrefixEnabled(userId, guildId || undefined);

    const embed = new EmbedBuilder()
      .setTitle(`👑 Your Zenith VIP Status`)
      .setColor(info.isActive ? 0xF1C40F : 0x2B2D31)
      .setDescription(
        `### Account: <@${userId}> (\`${userId}\`)\n` +
        `• **Subscription Status:** ${info.isActive ? `🌟 **Active (${info.overallPlan})**` : "⭐ **Standard Free Tier**"}\n` +
        `• **Global No-Prefix Mode:** ${npActive ? "⚡ `ENABLED` (Run commands without prefix)" : "🚫 `DISABLED`"}\n` +
        `• **Authorized Roles:** ${info.isPermanentOwner ? "`Permanent Bot Owner`" : info.isBotAdmin ? "`Bot Administrator`" : info.isBotStaff ? `\`${info.staffRole?.toUpperCase()}\`` : "`User`"}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### 🚀 Quick Actions & Controls\n` +
        `• Use the buttons below to toggle No-Prefix mode, check perks, or redeem codes.`
      )
      .setFooter({ text: "Zenith VIP Experience" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("btn:prem:toggle_noprefix")
        .setLabel(npActive ? "Disable No-Prefix" : "Enable No-Prefix")
        .setEmoji(npActive ? CE.failure.id : CE.success.id)
        .setStyle(npActive ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("btn:prem:redeem_modal")
        .setLabel("Redeem Code")
        .setEmoji(CE.giveaway.id)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setEmoji(CE.chat.id)
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_SERVER_URL),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

// ---------------------------------------------------------------------------
// 2. /premiumpanel (Executive Control Panel)
// ---------------------------------------------------------------------------
export const premiumPanelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premiumpanel")
    .setDescription("Executive Premium & No-Prefix Control Panel (Hardcoded Owner Only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const allowed = await canAccessPremiumPanel(interaction.user.id, interaction.guild?.ownerId);
    if (!allowed) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: "Access Restricted",
            color: COLORS.danger,
            description: `${CE.failure.str} Only **Bot Owners**, **Bot Admins**, and authorized **Bot Staff** can access the Executive Premium Management Panel.\n\nTo view your personal VIP status, run \`/premium\`.`,
          }),
        ],
        flags: 1 << 6,
      });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const embed = new EmbedBuilder()
      .setTitle("Executive Premium & No-Prefix Control Panel")
      .setColor(0xF1C40F)
      .setDescription(
        `Welcome to the **Zenith Premium Executive Control Panel**.\n\n` +
        `Directly manage premium subscriptions, grant or revoke No-Prefix execution, and check status in real-time.\n\n` +
        `• **Premium List**: Active subscribers, expiration countdowns, and configured roles\n` +
        `• **Give Premium**: *(Permanent Owner only)* Grants VIP privileges and delivers automated DM\n` +
        `• **Check Premium**: Verify status, tier, remaining days, and active perks\n` +
        `• **Give No-Prefix**: Direct command execution without typing any prefix\n` +
        `• **Remove No-Prefix**: Revoke direct command execution\n` +
        `• **Check No-Prefix**: Check user or server No-Prefix status\n` +
        `• **Remove Premium**: Revokes premium privileges from a user or server\n` +
        `• **Set Premium Role**: Auto-grants global premium to role holders\n` +
        `• **Redeem Code**: Activate license code`
      )
      .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
      .setFooter({ text: `Zenith Owner Dashboard • Operator: ${interaction.user.username} | Today at ${timeStr}` });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prem:panel:list")
        .setLabel("Premium List")
        .setEmoji(CE.clipboard.id)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("prem:panel:give_menu")
        .setLabel("Give Premium")
        .setEmoji(CE.star.id)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("prem:panel:check")
        .setLabel("Check Premium")
        .setEmoji(CE.staff.id)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("prem:panel:remove_menu")
        .setLabel("Remove Premium")
        .setEmoji(CE.trash.id)
        .setStyle(ButtonStyle.Danger),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prem:panel:redeem")
        .setLabel("Redeem Code")
        .setEmoji(CE.giveaway.id)
        .setStyle(ButtonStyle.Danger),
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prem:panel:give_noprefix_menu")
        .setLabel("Give No-Prefix")
        .setEmoji(CE.check.id)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("prem:panel:remove_noprefix_menu")
        .setLabel("Remove No-Prefix")
        .setEmoji(CE.demotion.id)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("prem:panel:check_noprefix")
        .setLabel("Check No-Prefix")
        .setEmoji(CE.clipboard.id)
        .setStyle(ButtonStyle.Secondary),
    );

    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prem:panel:set_role")
        .setLabel("Set Premium Role")
        .setEmoji(CE.owner.id)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("prem:panel:remove_role")
        .setLabel("Remove Role")
        .setEmoji(CE.failure.id)
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4] });
  },
};

// ---------------------------------------------------------------------------
// 3. Interaction Handler for Buttons and Modals
// ---------------------------------------------------------------------------
export async function handlePremiumInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<void> {
  // Public button actions
  if (interaction.isButton()) {
    if (interaction.customId === "btn:prem:toggle_noprefix") {
      const current = await isNoPrefixEnabled(interaction.user.id);
      setNoPrefix(interaction.user.id, "user", !current);
      const newState = !current;
      await interaction.reply({
        content: `${newState ? "⚡" : "🚫"} **Global No-Prefix Mode is now ${newState ? "`ENABLED` (Commands run without prefix)" : "`DISABLED` (Prefix required)"}!**`,
        flags: 1 << 6,
      }).catch(() => {});
      return;
    }

    if (interaction.customId === "btn:prem:redeem_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:redeem")
        .setTitle("Redeem Premium Code");

      const codeInput = new TextInputBuilder()
        .setCustomId("code")
        .setLabel("Enter License Code")
        .setPlaceholder("e.g. RELOSTA-XXXX-XXXX-XXXX")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:dismiss") {
      await (interaction as any).update({ content: "Operation closed.", embeds: [], components: [] }).catch(() => {});
      return;
    }
  }

  // Permission Check for Admin/Owner Panel Buttons
  const allowed = await canAccessPremiumPanel(interaction.user.id, interaction.guild?.ownerId);
  if (!allowed) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: `${CE.failure.str} Only authorized Bot Owners and Bot Staff can use executive controls.`,
        flags: 1 << 6,
      }).catch(() => {});
    }
    return;
  }

  // -------------------------------------------------------------------------
  // BUTTON MENUS & SUB-SELECTIONS
  // -------------------------------------------------------------------------
  if (interaction.isButton()) {
    // 1. Give Premium Submenu
    if (interaction.customId === "prem:panel:give_menu") {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can grant premium.`,
          flags: 1 << 6,
        });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prem:panel:give_user")
          .setLabel("Give User Premium")
          .setEmoji(CE.star.id)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("prem:panel:give_server")
          .setLabel("Give Server Premium")
          .setEmoji(CE.admin.id)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("prem:panel:give_user_lifetime")
          .setLabel("Quick Lifetime User (Apex)")
          .setEmoji(CE.star.id)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("prem:panel:give_server_lifetime")
          .setLabel("Quick Lifetime Server (Apex)")
          .setEmoji(CE.owner.id)
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({
        content: `### 👑 **Grant Premium Subscription**\nSelect the target classification and subscription parameters:`,
        components: [row],
        flags: 1 << 6,
      });
      return;
    }

    // 2. Remove Premium Submenu
    if (interaction.customId === "prem:panel:remove_menu") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prem:panel:rm_user_modal")
          .setLabel("Remove User Premium")
          .setEmoji(CE.trash.id)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("prem:panel:rm_guild_modal")
          .setLabel("Remove Server Premium")
          .setEmoji(CE.trash.id)
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.reply({
        content: `### 🗑️ **Revoke Premium Subscription**\nSelect target classification to revoke privileges from:`,
        components: [row],
        flags: 1 << 6,
      });
      return;
    }

    // 3. Give No-Prefix Submenu
    if (interaction.customId === "prem:panel:give_noprefix_menu") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prem:panel:np_user_modal")
          .setLabel("Enable User No-Prefix")
          .setEmoji(CE.check.id)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("prem:panel:np_guild_modal")
          .setLabel("Enable Server No-Prefix")
          .setEmoji(CE.check.id)
          .setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({
        content: `### 🟢 **Enable Direct No-Prefix Execution**\nSelect target classification to grant No-Prefix command execution:`,
        components: [row],
        flags: 1 << 6,
      });
      return;
    }

    // 4. Remove No-Prefix Submenu
    if (interaction.customId === "prem:panel:remove_noprefix_menu") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prem:panel:rm_np_user_modal")
          .setLabel("Disable User No-Prefix")
          .setEmoji(CE.demotion.id)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("prem:panel:rm_np_guild_modal")
          .setLabel("Disable Server No-Prefix")
          .setEmoji(CE.demotion.id)
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.reply({
        content: `### 🔴 **Disable No-Prefix Execution**\nSelect target classification to revoke No-Prefix command execution:`,
        components: [row],
        flags: 1 << 6,
      });
      return;
    }

    // 5. Open Give User Modal with Tier Selection
    if (interaction.customId === "prem:panel:give_user") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:give_user")
        .setTitle("Grant User VIP Premium");

      const userInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID or @Mention")
        .setPlaceholder("e.g. 1181221352393420856 or @user")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const daysInput = new TextInputBuilder()
        .setCustomId("duration_days")
        .setLabel("Duration in Days (9999 for Lifetime)")
        .setPlaceholder("30")
        .setValue("30")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const tierInput = new TextInputBuilder()
        .setCustomId("tier")
        .setLabel("Tier (1: Supporter, 2: Pro, 3: God, 4: Apex)")
        .setPlaceholder("1, 2, 3, or 4 (Default: 4)")
        .setValue("4")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(tierInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // 6. Open Give Server Modal with Tier Selection
    if (interaction.customId === "prem:panel:give_server") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:give_server")
        .setTitle("Grant Server VIP Premium");

      const serverInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Server / Guild ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const daysInput = new TextInputBuilder()
        .setCustomId("duration_days")
        .setLabel("Duration in Days (9999 for Lifetime)")
        .setPlaceholder("30")
        .setValue("30")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const tierInput = new TextInputBuilder()
        .setCustomId("tier")
        .setLabel("Tier (1: Supporter, 2: Pro, 3: God, 4: Apex)")
        .setPlaceholder("1, 2, 3, or 4 (Default: 4)")
        .setValue("4")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(tierInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // 7. Quick Lifetime User Modal
    if (interaction.customId === "prem:panel:give_user_lifetime") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:give_user_lifetime")
        .setTitle("Grant Lifetime User (Apex Tier 4)");

      const userInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID or @Mention")
        .setPlaceholder("e.g. 1181221352393420856")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userInput));
      await interaction.showModal(modal);
      return;
    }

    // 8. Quick Lifetime Server Modal
    if (interaction.customId === "prem:panel:give_server_lifetime") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:give_server_lifetime")
        .setTitle("Grant Lifetime Server (Apex Tier 4)");

      const serverInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Server / Guild ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput));
      await interaction.showModal(modal);
      return;
    }

    // 9. Remove Modals
    if (interaction.customId === "prem:panel:rm_user_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:rm_user")
        .setTitle("Remove User Premium");

      const userInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID or @Mention")
        .setPlaceholder("e.g. 1181221352393420856")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:rm_guild_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:rm_guild")
        .setTitle("Remove Server Premium");

      const serverInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput));
      await interaction.showModal(modal);
      return;
    }

    // 10. Enable No-Prefix Modals
    if (interaction.customId === "prem:panel:np_user_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:np_user")
        .setTitle("Enable User No-Prefix");

      const userInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID or @Mention")
        .setPlaceholder("e.g. 1181221352393420856")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:np_guild_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:np_guild")
        .setTitle("Enable Server No-Prefix");

      const serverInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput));
      await interaction.showModal(modal);
      return;
    }

    // 11. Disable No-Prefix Modals
    if (interaction.customId === "prem:panel:rm_np_user_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:rm_np_user")
        .setTitle("Disable User No-Prefix");

      const userInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID or @Mention")
        .setPlaceholder("e.g. 1181221352393420856")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:rm_np_guild_modal") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:rm_np_guild")
        .setTitle("Disable Server No-Prefix");

      const serverInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput));
      await interaction.showModal(modal);
      return;
    }

    // 12. Check Premium Modal
    if (interaction.customId === "prem:panel:check") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:check")
        .setTitle("Verify Premium Status");

      const targetInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID, @Mention, or Server ID")
        .setPlaceholder("e.g. 1181221352393420856")
        .setValue(interaction.user.id)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput));
      await interaction.showModal(modal);
      return;
    }

    // 13. Check No-Prefix Modal
    if (interaction.customId === "prem:panel:check_noprefix") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:check_noprefix")
        .setTitle("Check No-Prefix Status");

      const targetInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID, @Mention, or Server ID")
        .setPlaceholder("e.g. 1181221352393420856")
        .setValue(interaction.user.id)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput));
      await interaction.showModal(modal);
      return;
    }

    // 14. Redeem Modal
    if (interaction.customId === "prem:panel:redeem") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:redeem")
        .setTitle("Redeem Premium License Code");

      const codeInput = new TextInputBuilder()
        .setCustomId("code")
        .setLabel("License Code")
        .setPlaceholder("e.g. RELOSTA-XXXX-XXXX-XXXX")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput));
      await interaction.showModal(modal);
      return;
    }

    // 15. Set / Remove Role Modals
    if (interaction.customId === "prem:panel:set_role") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:set_role")
        .setTitle("Set Server Premium Role");

      const guildInput = new TextInputBuilder()
        .setCustomId("guild_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setValue(interaction.guildId ?? "")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roleInput = new TextInputBuilder()
        .setCustomId("role_id")
        .setLabel("Role ID or Role Mention")
        .setPlaceholder("e.g. 123456789012345678 or @VIP")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(guildInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:remove_role") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:remove_role")
        .setTitle("Remove Server Premium Role");

      const guildInput = new TextInputBuilder()
        .setCustomId("guild_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setValue(interaction.guildId ?? "")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roleInput = new TextInputBuilder()
        .setCustomId("role_id")
        .setLabel("Role ID or Role Mention to remove")
        .setPlaceholder("e.g. 123456789012345678")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(guildInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
      );

      await interaction.showModal(modal);
      return;
    }

    // 16. Premium List
    if (interaction.customId === "prem:panel:list") {
      await interaction.deferReply({ flags: 1 << 6 });
      const { users, guilds, roles } = await listActivePremiums();

      const userLines =
        users.length > 0
          ? users
              .slice(0, 15)
              .map((u) => `• <@${u.id}> (\`${u.id}\`) — ${u.expiresAt >= 4100000000000 ? `${CE.star.str} **Lifetime**` : `Expires: <t:${Math.floor(u.expiresAt / 1000)}:R>`}`)
              .join("\n")
          : "*No active user subscriptions.*";

      const guildLines =
        guilds.length > 0
          ? guilds
              .slice(0, 15)
              .map((g) => `• Server \`${g.id}\` — ${g.expiresAt >= 4100000000000 ? `${CE.star.str} **Lifetime**` : `Expires: <t:${Math.floor(g.expiresAt / 1000)}:R>`}`)
              .join("\n")
          : "*No active server subscriptions.*";

      const roleLines =
        roles && roles.length > 0
          ? roles
              .slice(0, 15)
              .map((r) => `• Server \`${r.guildId}\` ➔ <@&${r.roleId}> (\`${r.roleId}\`)`)
              .join("\n")
          : "*No premium roles configured.*";

      const listEmbed = new EmbedBuilder()
        .setTitle(`${CE.information.str} Active Premium Registry`)
        .setColor(0xF1C40F)
        .addFields(
          { name: `${CE.star.str} Active Users (${users.length})`, value: userLines },
          { name: `${CE.admin.str} Active Servers (${guilds.length})`, value: guildLines },
          { name: `${CE.owner.str} Premium Roles (${roles?.length ?? 0})`, value: roleLines },
        )
        .setFooter({ text: "Zenith Premium Registry" });

      await interaction.editReply({ embeds: [listEmbed] });
      return;
    }
  }

  // -------------------------------------------------------------------------
  // MODAL SUBMISSIONS
  // -------------------------------------------------------------------------
  if (interaction.isModalSubmit()) {
    // 1. Redeem Code
    if (interaction.customId === "prem:modal:redeem") {
      const code = interaction.fields.getTextInputValue("code").trim();
      const result = await redeemPremiumCode(code, interaction.user.id, "user");
      await interaction.reply({
        content: result.success ? `${CE.success.str} ${result.message}` : `${CE.failure.str} ${result.message}`,
        flags: 1 << 6,
      });
      return;
    }

    // 2. Check Premium
    if (interaction.customId === "prem:modal:check") {
      const rawTarget = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawTarget.match(/\d{17,20}/);
      const targetId = match ? match[0] : rawTarget;

      await interaction.deferReply({ flags: 1 << 6 });
      const info = await checkTargetPremium(targetId, interaction.client);

      let targetName = targetId;
      let isUserObject = false;
      try {
        const u = await interaction.client.users.fetch(targetId).catch(() => null);
        if (u) {
          targetName = `${u.tag} (${u.id})`;
          isUserObject = true;
        }
      } catch {}

      const embed = new EmbedBuilder()
        .setTitle(`👑 Premium Status Verification`)
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
              : `• **User Plan**: **Active**\n• **Remaining Time**: \`${info.userDaysLeft} day(s)\`\n• **Expires On**: <t:${Math.floor(info.userExpiry / 1000)}:F>\n`
          ) : "") +
          (info.guildExpiry ? (
            info.isGuildLifetime
              ? `• **Server Plan**: ${CE.star.str} **Lifetime Server VIP**\n• **Valid Until**: \`Permanent\`\n`
              : `• **Server Plan**: **Active**\n• **Remaining Time**: \`${info.guildDaysLeft} day(s)\`\n• **Expires On**: <t:${Math.floor(info.guildExpiry / 1000)}:F>\n`
          ) : "") +
          (info.rolePremiums.length > 0 ? (
            `• **Role-Based Premium**: Active via **${info.rolePremiums.length}** configured server role(s):\n` +
            info.rolePremiums.map((r) => `  - <@&${r.roleId}> in **${r.guildName ?? r.guildId}**`).join("\n") + "\n"
          ) : "") +
          `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `### ${CE.star.str} Unlocked VIP Privileges\n` +
          `• ${CE.music.str} **Remote VC Audio**: Stream audio directly into any voice channel without joining (\`.play <song> <vc_or_user>\`)\n` +
          `• ${CE.radio.str} **24/7 Voice Radio**: Keep the bot in voice 24/7 with auto-reconnect (\`.24/7 <vc_or_user>\`)\n` +
          `• ${CE.promotion.str} **Global No-Prefix Mode**: Run any bot command freely with no prefix\n` +
          `• ${CE.star.str} **Priority Audio Bitrate & Processing Speed**\n`
        );
      } else {
        embed.setColor(0xED4245);
        embed.setDescription(
          `### Target: ${isUserObject ? `<@${targetId}>` : `\`${targetName}\``}\n` +
          `**Status**: ${CE.failure.str} **No Active Premium Subscription Found**\n\n` +
          `This user or server does not currently hold an active premium subscription, lifetime grant, or server-configured premium role.`
        );
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 3. Check No-Prefix
    if (interaction.customId === "prem:modal:check_noprefix") {
      const rawTarget = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawTarget.match(/\d{17,20}/);
      const targetId = match ? match[0] : rawTarget;

      const userNp = await isNoPrefixEnabled(targetId, undefined);
      const guildNp = await isNoPrefixEnabled("", targetId);

      const embed = new EmbedBuilder()
        .setTitle(`⚡ No-Prefix Status Check`)
        .setColor(userNp || guildNp ? 0x57f287 : 0x2B2D31)
        .setDescription(
          `### Target: \`${targetId}\`\n\n` +
          `• **User No-Prefix:** ${userNp ? "🟢 `ENABLED`" : "🔴 `DISABLED`"}\n` +
          `• **Server No-Prefix:** ${guildNp ? "🟢 `ENABLED`" : "🔴 `DISABLED`"}\n\n` +
          `*(Users with No-Prefix enabled can run all bot commands globally without typing any prefix.)*`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 1 << 6 });
      return;
    }

    // 4. Set / Remove Premium Role
    if (interaction.customId === "prem:modal:set_role") {
      const rawGuild = interaction.fields.getTextInputValue("guild_id").trim();
      const guildIdMatch = rawGuild.match(/\d{17,20}/);
      const guildId = guildIdMatch ? guildIdMatch[0] : rawGuild;

      const rawRole = interaction.fields.getTextInputValue("role_id").trim();
      const roleIdMatch = rawRole.match(/\d{17,20}/);
      const roleId = roleIdMatch ? roleIdMatch[0] : rawRole;

      await interaction.deferReply();
      const result = await setPremiumRole(guildId, roleId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle(`${CE.success.str} Premium Role Configured`)
        .setColor(0x57f287)
        .setDescription(result.message)
        .addFields(
          { name: "Server ID", value: `\`${guildId}\``, inline: true },
          { name: "Role", value: `<@&${roleId}> (\`${roleId}\`)`, inline: true },
        )
        .setFooter({ text: `Set by Bot Owner: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.customId === "prem:modal:remove_role") {
      const rawGuild = interaction.fields.getTextInputValue("guild_id").trim();
      const guildIdMatch = rawGuild.match(/\d{17,20}/);
      const guildId = guildIdMatch ? guildIdMatch[0] : rawGuild;

      const rawRole = interaction.fields.getTextInputValue("role_id").trim();
      const roleIdMatch = rawRole.match(/\d{17,20}/);
      const roleId = roleIdMatch ? roleIdMatch[0] : rawRole;

      await interaction.deferReply();
      const result = await removePremiumRole(guildId, roleId);

      const embed = new EmbedBuilder()
        .setTitle(result.removed ? `${CE.success.str} Premium Role Removed` : `${CE.warning.str} Premium Role`)
        .setColor(result.removed ? 0x57f287 : 0xfee75c)
        .setDescription(result.message)
        .setFooter({ text: `Action by Bot Owner: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 5. Enable / Disable No-Prefix
    if (interaction.customId === "prem:modal:np_user") {
      const rawUser = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawUser.match(/\d{17,20}/);
      const userId = match ? match[0] : rawUser;

      setNoPrefix(userId, "user", true);
      await interaction.reply({
        content: `🟢 **User No-Prefix ENABLED for <@${userId}> (\`${userId}\`)!** They can now run all commands without prefix.`,
        flags: 1 << 6,
      });
      return;
    }

    if (interaction.customId === "prem:modal:np_guild") {
      const rawGuild = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawGuild.match(/\d{17,20}/);
      const guildId = match ? match[0] : rawGuild;

      setNoPrefix(guildId, "guild", true);
      await interaction.reply({
        content: `🟢 **Server No-Prefix ENABLED for Server \`${guildId}\`!** All members can run bot commands in this server without prefix.`,
        flags: 1 << 6,
      });
      return;
    }

    if (interaction.customId === "prem:modal:rm_np_user") {
      const rawUser = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawUser.match(/\d{17,20}/);
      const userId = match ? match[0] : rawUser;

      setNoPrefix(userId, "user", false);
      await interaction.reply({
        content: `🔴 **User No-Prefix DISABLED for <@${userId}> (\`${userId}\`).** Prefix is now required.`,
        flags: 1 << 6,
      });
      return;
    }

    if (interaction.customId === "prem:modal:rm_np_guild") {
      const rawGuild = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawGuild.match(/\d{17,20}/);
      const guildId = match ? match[0] : rawGuild;

      setNoPrefix(guildId, "guild", false);
      await interaction.reply({
        content: `🔴 **Server No-Prefix DISABLED for Server \`${guildId}\`.** Prefix is now required.`,
        flags: 1 << 6,
      });
      return;
    }

    // 6. Remove Premium
    if (interaction.customId === "prem:modal:rm_user") {
      const rawUser = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawUser.match(/\d{17,20}/);
      const targetId = match ? match[0] : rawUser;

      await interaction.deferReply();
      const result = await removeDirectPremium(targetId, "user");
      await interaction.editReply({
        content: result.success ? `${CE.success.str} ${result.message}` : `${CE.failure.str} ${result.message}`,
      });
      return;
    }

    if (interaction.customId === "prem:modal:rm_guild") {
      const rawGuild = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawGuild.match(/\d{17,20}/);
      const targetId = match ? match[0] : rawGuild;

      await interaction.deferReply();
      const result = await removeDirectPremium(targetId, "server");
      await interaction.editReply({
        content: result.success ? `${CE.success.str} ${result.message}` : `${CE.failure.str} ${result.message}`,
      });
      return;
    }

    // 7. Give User / Server Premium (with Tier support)
    const isGiveUser = interaction.customId === "prem:modal:give_user" || interaction.customId === "prem:modal:give_user_lifetime";
    const isGiveServer = interaction.customId === "prem:modal:give_server" || interaction.customId === "prem:modal:give_server_lifetime";

    if (isGiveUser || isGiveServer) {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can grant premium subscriptions.`,
          flags: 1 << 6,
        });
        return;
      }

      const rawTarget = interaction.fields.getTextInputValue("target_id").trim();
      const idMatch = rawTarget.match(/\d{17,20}/);
      const targetId = idMatch ? idMatch[0] : rawTarget;

      let days = 30;
      let tierNum = 4;

      if (interaction.customId === "prem:modal:give_user_lifetime" || interaction.customId === "prem:modal:give_server_lifetime") {
        days = 9999;
        tierNum = 4;
      } else {
        days = parseInt(interaction.fields.getTextInputValue("duration_days")?.trim() || "30", 10) || 30;
        const rawTier = interaction.fields.getTextInputValue("tier")?.trim() || "4";
        tierNum = Math.max(1, Math.min(4, parseInt(rawTier, 10) || 4));
      }

      const tierTitle = PREMIUM_TIER_NAMES[tierNum] || "Tier 4: Ultimate Zenith Apex";
      const isUser = isGiveUser;
      const type: "user" | "server" = isUser ? "user" : "server";

      await interaction.deferReply();

      const result = await grantDirectPremium(targetId, type, days);
      const isLifetime = result.expiresAt >= 4100000000000 || days >= 9999;
      let dmSent = false;

      if (isUser) {
        setUserPremiumTier(targetId, tierNum);
        setNoPrefix(targetId, "user", true);

        try {
          const userObj = await interaction.client.users.fetch(targetId).catch(() => null);
          if (userObj) {
            const dmEmbed = new EmbedBuilder()
              .setTitle(`🎉 You Have Been Granted Zenith Premium (${tierTitle})!`)
              .setColor(0xF1C40F)
              .setDescription(
                `Hello **${userObj.username}**! You have been granted **Zenith Premium (${tierTitle})** by the bot owner (<@${interaction.user.id}>)!\n\n` +
                `• **Tier Rank:** \`${tierTitle}\`\n` +
                `• **Duration:** ${isLifetime ? `${CE.star.str} **Lifetime Access**` : `\`${days}\` days (Active until <t:${Math.floor(result.expiresAt / 1000)}:F>)`}\n` +
                `• **Unlocked VIP Features:**\n` +
                `  ${CE.promotion.str} **Global No-Prefix Mode**: Execute bot commands freely without prefix\n` +
                `  ${CE.radio.str} **Remote VC Audio**: Play music into any voice channel without joining it (\`.play <song> <vc_or_user>\`)\n` +
                `  ${CE.music.str} **24/7 Voice Radio**: Keep the bot playing in your voice channel 24/7 (\`.24/7 <vc_or_user>\`)\n` +
                `  ${CE.boost.str} **Lossless 320kbps Audio DSP & 14 EQ Presets**\n` +
                `  ${CE.owner.str} **Custom Server Bot Profile & Avatar** (\`.botavatar\`)\n` +
                `  ${CE.level.str} **Priority Rates, Enterprise Mitigation & Anti-Nuke**\n\n` +
                `Thank you for being a valued part of the Zenith ecosystem!`,
              )
              .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
              .setFooter({ text: "Zenith Premium Experience" })
              .setTimestamp();
            const dmRes = await safeSendUserDm(userObj, { embeds: [dmEmbed] }, `Give User Premium: ${tierTitle}`);
            dmSent = dmRes.success;
          }
        } catch {
          dmSent = false;
        }
      } else {
        // Guild Server Premium
        setNoPrefix(targetId, "guild", true);

        try {
          const guildObj = interaction.client.guilds.cache.get(targetId) ?? (await interaction.client.guilds.fetch(targetId).catch(() => null));
          if (guildObj && guildObj.ownerId) {
            const ownerUser = await interaction.client.users.fetch(guildObj.ownerId).catch(() => null);
            if (ownerUser) {
              const guildDmEmbed = new EmbedBuilder()
                .setTitle(`🎉 Your Server Has Been Upgraded to Zenith Server Premium!`)
                .setColor(0xF1C40F)
                .setDescription(
                  `Greetings! Your Discord server **${guildObj.name}** (\`${guildObj.id}\`) has been granted **Zenith Server Premium (${tierTitle})** by the bot owner (<@${interaction.user.id}>)!\n\n` +
                  `• **Server Name:** **${guildObj.name}**\n` +
                  `• **Tier Rank:** \`${tierTitle}\`\n` +
                  `• **Duration:** ${isLifetime ? `${CE.star.str} **Lifetime Access**` : `\`${days}\` days (Active until <t:${Math.floor(result.expiresAt / 1000)}:F>)`}\n\n` +
                  `### 👑 **Unlocked Server Features:**\n` +
                  `• ⚡ **Global Server No-Prefix**: Everyone can run bot commands without typing a prefix in your server\n` +
                  `• 🛡️ **Enterprise Anti-Nuke & Defense**: Protect your community against mass-bans, kicks, and channel wipes\n` +
                  `• 🎧 **Lossless Studio Audio DSP & 14 Studio EQ Presets**\n` +
                  `• 🎭 **Custom Server Bot Avatar & Nickname**: Run \`.botavatar\` to give the bot a custom look tailored to your server!\n` +
                  `• 💎 **100% Ad-Free**: Removes promotional ads and sponsored footers\n\n` +
                  `Thank you for powering **${guildObj.name}** with Zenith Bot!`,
                )
                .setThumbnail(guildObj.iconURL() || "https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
                .setFooter({ text: `Zenith Server VIP Engine • ${guildObj.name}` })
                .setTimestamp();
              const dmRes = await safeSendUserDm(ownerUser, { embeds: [guildDmEmbed] }, `Give Server Premium: ${tierTitle}`);
              dmSent = dmRes.success;
            }
          }
        } catch {
          dmSent = false;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`${CE.success.str} Premium Granted Successfully!`)
        .setColor(0x57f287)
        .setDescription(
          `Successfully granted **${isLifetime ? `${CE.star.str} Lifetime` : `${days} days`}** of **${type.toUpperCase()}** Premium (\`${tierTitle}\`) to ${isUser ? `<@${targetId}> (\`${targetId}\`)` : `Server \`${targetId}\``}!\n\n` +
          `• **Tier Rank:** \`${tierTitle}\`\n` +
          `• **Expiration:** ${isLifetime ? `${CE.star.str} **Lifetime**` : `<t:${Math.floor(result.expiresAt / 1000)}:F>`}\n` +
          `• **DM Notification:** ${
            isUser
              ? dmSent
                ? `${CE.chat.str} User was directly notified via DM!`
                : `${CE.warning.str} Could not deliver direct message to user (DMs disabled)`
              : dmSent
                ? `${CE.chat.str} Server owner was directly notified via DM!`
                : `${CE.warning.str} Could not deliver DM to server owner`
          }`,
        )
        .setFooter({ text: `Granted by Hardcoded Bot Owner: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }
}

// Aliases exported for registry compatibility
export const premiumGiveCommand = premiumCommand;
export const premiumUserCommand = premiumCommand;
export const premiumServerCommand = premiumCommand;
export const premiumGenerateCommand = premiumCommand;

export default premiumCommand;
