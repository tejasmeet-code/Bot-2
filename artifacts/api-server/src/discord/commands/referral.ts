import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type RoleSelectMenuInteraction,
  type ButtonInteraction,
  type Guild,
} from "discord.js";
import type { SlashCommand } from "../types";
import { isBotAdmin, isPermanentOwner } from "../storage/premium";
import {
  createReferralCode,
  getReferralCode,
  getUserReferralStats,
  getReferralLeaderboard,
  redeemReferralCode,
  savePartnerStaffRoles,
  listReferralCodes,
  checkPartnerRolesIntegrity,
  type ReferralType,
} from "../storage/referrals";
import { CE, COLORS, prettyEmbed, errorEmbed, assertNoDefaultEmoji } from "../utils/embedStyle";

export const referralCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("referral")
    .setDescription("Referral System — Earn points, redeem server/user/partner codes & grant staff premiums")
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Check referral points and statistics for a user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user to check referral points for").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("redeem")
        .setDescription("Redeem a referral code (Server, User, or Partner code)")
        .addStringOption((opt) => opt.setName("code").setDescription("The referral code to redeem").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Bot Owner/Admin: Generate or set a referral code for a person")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Type of code: server, user, or partner")
            .setRequired(true)
            .addChoices(
              { name: "Server (30 Days Server Premium)", value: "server" },
              { name: "User (30 Days User Premium)", value: "user" },
              { name: "Partner (Lifetime Server + 1yr Junior Staff + Lifetime Higher Staff)", value: "partner" }
            )
        )
        .addUserOption((opt) => opt.setName("user").setDescription("Owner of this referral code").setRequired(true))
        .addStringOption((opt) => opt.setName("code").setDescription("Custom referral code string (leave blank to auto-generate)").setRequired(false))
        .addIntegerOption((opt) => opt.setName("max_uses").setDescription("Maximum uses limit (-1 for unlimited)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("partner-setup")
        .setDescription("Server Admin: Configure or re-configure Partner Junior & Higher Staff Roles")
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List referral codes owned by a user or globally")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("leaderboard")
        .setDescription("View top referral point holders")
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    let subcommand: string | null = null;
    try {
      subcommand = interaction.options.getSubcommand(false);
    } catch {
      subcommand = null;
    }
    if (!subcommand) {
      subcommand = "check";
    }

    const user = interaction.user;
    const guild = interaction.guild;

    // ────────────────────────────────────────────────────────────────────────
    // SUBCOMMAND: check (Check points for user)
    // ────────────────────────────────────────────────────────────────────────
    if (subcommand === "check" || subcommand === "points") {
      const targetUser = interaction.options.getUser("user") || user;
      const stats = await getUserReferralStats(targetUser.id);
      const userCodes = await listReferralCodes(targetUser.id);

      const codeListText = userCodes.length > 0
        ? userCodes.map((c) => `• \`${c.code}\` (${c.type.toUpperCase()} • ${c.usesCount} uses)`).join("\n")
        : "*No referral codes assigned yet.*";

      const embed = prettyEmbed({
        title: `${CE.award.str} Referral Statistics — ${targetUser.username}`,
        description:
          `### ${CE.award.str} Overview for **${targetUser.username}**\n\n` +
          `• **Total Referral Points:** \`${stats.points} Points\`\n` +
          `• **Server Code Redeems:** \`${stats.serverRedeems}\`\n` +
          `• **User Code Redeems:** \`${stats.userRedeems}\`\n` +
          `• **Partner Code Redeems:** \`${stats.partnerRedeems}\`\n\n` +
          `### ${CE.gift.str} Assigned Referral Codes:\n${codeListText}`,
        color: COLORS.primary,
        footer: "Zenith Referral Engine • Earn perks by referring servers and users",
      });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUBCOMMAND: redeem (Redeem a referral code)
    // ────────────────────────────────────────────────────────────────────────
    if (subcommand === "redeem") {
      const codeInput = interaction.options.getString("code") || (interaction as any).rawArgs?.join(" ") || "";
      if (!codeInput.trim()) {
        await interaction.reply({ embeds: [errorEmbed("Missing Code", "Please specify the referral code to redeem! (e.g. \`.redeem PARTNER-1234\`)")] });
        return;
      }

      const result = await redeemReferralCode({
        codeStr: codeInput,
        redeemerUser: { id: user.id, username: user.username },
        guild,
      });

      if (!result.success) {
        await interaction.reply({ embeds: [errorEmbed("Redemption Failed", result.message)] });
        return;
      }

      // If partner code redeemed, send interactive role selection prompt
      if (result.requiresStaffRoleSetup && guild) {
        const embed = prettyEmbed({
          title: `${CE.vip.str} Partner Referral Activated!`,
          description: result.message,
          color: COLORS.success,
          footer: "Select Junior Staff Role & Higher Staff Role below",
        });

        const juniorSelect = new RoleSelectMenuBuilder()
          .setCustomId(`ref:select_junior:${guild.id}`)
          .setPlaceholder("Select Junior Staff Role (1 Year User Premium)...")
          .setMinValues(1)
          .setMaxValues(1);

        const higherSelect = new RoleSelectMenuBuilder()
          .setCustomId(`ref:select_higher:${guild.id}`)
          .setPlaceholder("Select Higher Staff Role (LIFETIME User Premium)...")
          .setMinValues(1)
          .setMaxValues(1);

        const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(juniorSelect);
        const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(higherSelect);

        await interaction.reply({
          embeds: [embed],
          components: [row1, row2],
        });
        return;
      }

      const embed = prettyEmbed({
        title: `${CE.gift.str} Referral Code Redeemed!`,
        description: result.message,
        color: COLORS.success,
      });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUBCOMMAND: create (Owner / Admin generates code for person)
    // ────────────────────────────────────────────────────────────────────────
    if (subcommand === "create") {
      if (!isBotAdmin(user.id) && !isPermanentOwner(user.id)) {
        await interaction.reply({
          embeds: [errorEmbed("Permission Denied", "Only Bot Owners and Admins can create and assign referral codes!")],
          ephemeral: true,
        });
        return;
      }

      const codeType = (interaction.options.getString("type") || "user") as ReferralType;
      const targetUser = interaction.options.getUser("user") || user;
      const customCode = interaction.options.getString("code");
      const maxUses = interaction.options.getInteger("max_uses") ?? -1;

      try {
        const newCode = await createReferralCode({
          code: customCode || undefined,
          type: codeType,
          ownerId: targetUser.id,
          ownerName: targetUser.username,
          createdBy: user.id,
          maxUses,
        });

        const embed = prettyEmbed({
          title: `${CE.done.str} Referral Code Created!`,
          description:
            `Successfully created **${codeType.toUpperCase()}** referral code!\n\n` +
            `• **Referral Code:** \`${newCode.code}\`\n` +
            `• **Owner:** <@${targetUser.id}> (\`${targetUser.username}\`)\n` +
            `• **Code Type:** \`${codeType.toUpperCase()}\`\n` +
            `• **Max Uses:** \`${newCode.maxUses === -1 ? "Unlimited" : newCode.maxUses}\`\n\n` +
            `*Target user can share \`${newCode.code}\` with servers and users to earn referral points!*`,
          color: COLORS.success,
        });

        await interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.reply({ embeds: [errorEmbed("Code Creation Error", err.message || String(err))] });
      }
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUBCOMMAND: partner-setup (Configure Partner Staff Roles)
    // ────────────────────────────────────────────────────────────────────────
    if (subcommand === "partner-setup" || subcommand === "partner") {
      if (!guild) {
        await interaction.reply({ embeds: [errorEmbed("Guild Required", "This command can only be used inside a server.")], ephemeral: true });
        return;
      }

      const juniorSelect = new RoleSelectMenuBuilder()
        .setCustomId(`ref:select_junior:${guild.id}`)
        .setPlaceholder("Select Junior Staff Role (1 Year User Premium)...")
        .setMinValues(1)
        .setMaxValues(1);

      const higherSelect = new RoleSelectMenuBuilder()
        .setCustomId(`ref:select_higher:${guild.id}`)
        .setPlaceholder("Select Higher Staff Role (LIFETIME User Premium)...")
        .setMinValues(1)
        .setMaxValues(1);

      const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(juniorSelect);
      const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(higherSelect);

      const embed = prettyEmbed({
        title: `${CE.roles.str} Partner Staff Role Configuration`,
        description:
          `Configure or update your server's **Junior Staff** and **Higher Staff** roles for **${guild.name}**.\n\n` +
          `• **Junior Staff Role:** Members holding this role receive **1 Year User Premium**\n` +
          `• **Higher Staff Role:** Members holding this role receive **LIFETIME User Premium**\n\n` +
          `Select both roles below using the dropdown menus:`,
        color: COLORS.primary,
      });

      await interaction.reply({ embeds: [embed], components: [row1, row2] });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUBCOMMAND: list (List codes)
    // ────────────────────────────────────────────────────────────────────────
    if (subcommand === "list") {
      const targetUser = interaction.options.getUser("user");
      const codes = await listReferralCodes(targetUser?.id);

      if (codes.length === 0) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: `${CE.info.str} Referral Codes List`,
              description: targetUser
                ? `No referral codes found for <@${targetUser.id}>.`
                : "No referral codes have been created yet.",
              color: COLORS.info,
            }),
          ],
        });
        return;
      }

      const listText = codes
        .slice(0, 15)
        .map(
          (c) =>
            `• **\`${c.code}\`** — Type: \`${c.type.toUpperCase()}\` | Owner: <@${c.ownerId}> | Uses: \`${c.usesCount}\``
        )
        .join("\n");

      const embed = prettyEmbed({
        title: `${CE.gift.str} Active Referral Codes (${codes.length})`,
        description: listText,
        color: COLORS.primary,
      });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUBCOMMAND: leaderboard (Top referral holders)
    // ────────────────────────────────────────────────────────────────────────
    if (subcommand === "leaderboard" || subcommand === "top") {
      const leaderboard = await getReferralLeaderboard(10);

      if (leaderboard.length === 0) {
        await interaction.reply({
          embeds: [
            prettyEmbed({
              title: `${CE.award.str} Referral Leaderboard`,
              description: "No referral points recorded yet! Be the first to share referral codes.",
              color: COLORS.info,
            }),
          ],
        });
        return;
      }

      const rowsText = leaderboard
        .map(
          (u, index) =>
            `**#${index + 1}** <@${u.userId}> — **${u.points} Points** (${u.partnerRedeems} Partner, ${u.serverRedeems} Server, ${u.userRedeems} User)`
        )
        .join("\n");

      const embed = prettyEmbed({
        title: `${CE.award.str} Top Referral Leaderboard`,
        description: `### ${CE.award.str} Top Performers:\n\n${rowsText}`,
        color: COLORS.primary,
      });

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

// State for active role selections
const pendingStaffSelections = new Map<string, { juniorRoleId?: string; higherRoleId?: string }>();

/**
  * Interactive Role Select Handler for Partner Staff Roles
  */
export async function handleReferralRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;
  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Guild not found.")], ephemeral: true });
    return;
  }

  const selectedRoleId = interaction.values[0];
  const key = `${guild.id}:${interaction.user.id}`;
  const state = pendingStaffSelections.get(key) ?? {};

  if (customId.startsWith("ref:select_junior:")) {
    state.juniorRoleId = selectedRoleId;
    pendingStaffSelections.set(key, state);
  } else if (customId.startsWith("ref:select_higher:")) {
    state.higherRoleId = selectedRoleId;
    pendingStaffSelections.set(key, state);
  }

  if (state.juniorRoleId && state.higherRoleId) {
    const result = await savePartnerStaffRoles({
      guild,
      juniorStaffRoleId: state.juniorRoleId,
      higherStaffRoleId: state.higherRoleId,
    });

    pendingStaffSelections.delete(key);

    const embed = prettyEmbed({
      title: `${CE.done.str} Partner Staff Roles Saved!`,
      description: result.message,
      color: COLORS.success,
    });

    await interaction.update({ embeds: [embed], components: [] });
  } else {
    const juniorName = state.juniorRoleId ? `<@&${state.juniorRoleId}>` : "*Not selected yet*";
    const higherName = state.higherRoleId ? `<@&${state.higherRoleId}>` : "*Not selected yet*";

    const embed = prettyEmbed({
      title: `${CE.roles.str} Partner Staff Role Selection`,
      description:
        `Select both roles to complete partner staff setup:\n\n` +
        `• **Junior Staff Role (1 Year Premium):** ${juniorName}\n` +
        `• **Higher Staff Role (LIFETIME Premium):** ${higherName}\n\n` +
        `*Please select the remaining role above to save!*`,
      color: COLORS.info,
    });

    await interaction.update({ embeds: [embed] });
  }
}
