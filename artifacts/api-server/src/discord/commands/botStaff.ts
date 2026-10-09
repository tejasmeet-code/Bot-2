import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  User,
} from "discord.js";
import type { SlashCommand } from "../types";
import { isPermanentOwner, PERMANENT_BOT_OWNER_ID } from "../storage/premium";
import {
  getBotStaff,
  setBotStaffRole,
  removeBotStaffRole,
  canManageBotStaff,
  BOT_STAFF_ROLES,
  TEST_SERVER_STAFF_ROLE_ID,
  getTestingServerInvite,
  type BotStaffRole,
} from "../storage/botStaff";
import { CE, COLORS } from "../utils/embedStyle";

function parseUserToken(interaction: ChatInputCommandInteraction): User | null {
  const userOpt = interaction.options.getUser("user");
  if (userOpt) return userOpt;

  const rawArgs: string[] = (interaction as any).rawArgs || [];
  for (const token of rawArgs) {
    const mentionMatch = token.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
      const u = interaction.client.users.cache.get(mentionMatch[1]);
      if (u) return u;
    }
    const idMatch = token.match(/^\d{17,20}$/);
    if (idMatch) {
      const u = interaction.client.users.cache.get(idMatch[0]);
      if (u) return u;
    }
  }
  return null;
}

function parseRoleToken(interaction: ChatInputCommandInteraction): BotStaffRole | null {
  const roleOpt = interaction.options.getString("role");
  if (roleOpt && (roleOpt in BOT_STAFF_ROLES)) return roleOpt as BotStaffRole;

  const rawArgs: string[] = (interaction as any).rawArgs || [];
  for (const token of rawArgs) {
    const lower = token.toLowerCase().replace(/[-_ ]/g, "");
    if (lower === "owner") return "owner";
    if (lower === "coowner" || lower === "co_owner") return "co_owner";
    if (lower === "admin" || lower === "administrator") return "admin";
    if (lower === "headtester" || lower === "head_tester" || lower === "htester") return "head_tester";
    if (lower === "tester" || lower === "qa" || lower === "test") return "tester";
    if (lower === "manager" || lower === "mgr") return "manager";
    if (lower === "mod" || lower === "moderator") return "mod";
    if (lower === "help" || lower === "helper") return "help";
    if (lower === "vip") return "vip";
    if (lower === "homies" || lower === "homie") return "homies";
    if (lower === "partner") return "partner";
    if (lower === "supporter") return "supporter";
    if (lower === "supportteam" || lower === "support_team" || lower === "support") return "support_team";
  }
  return null;
}

export async function buildStaffPanelEmbed(): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const staff = await getBotStaff();
  const staffList = Object.values(staff);

  const owners = staffList.filter((s) => s.role === "owner");
  const coOwners = staffList.filter((s) => s.role === "co_owner");
  const admins = staffList.filter((s) => s.role === "admin");
  const managers = staffList.filter((s) => s.role === "manager");
  const headTesters = staffList.filter((s) => s.role === "head_tester");
  const testers = staffList.filter((s) => s.role === "tester");
  const mods = staffList.filter((s) => s.role === "mod");
  const helpers = staffList.filter((s) => s.role === "help");
  const partners = staffList.filter((s) => s.role === "partner");
  const vips = staffList.filter((s) => s.role === "vip");
  const homies = staffList.filter((s) => s.role === "homies");
  const supporters = staffList.filter((s) => s.role === "supporter");
  const supportTeams = staffList.filter((s) => s.role === "support_team");

  const embed = new EmbedBuilder()
    .setTitle(`${CE.white_owner.str} Official Bot Staff & Tester Control Panel`)
    .setColor(0xF1C40F)
    .setDescription(
      `Welcome to the **Bot Staff & QA Tester Management Center**.\n` +
      `*Authorized Access: Hardcoded Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>)*\n\n` +
      `### ${CE.white_owner.str} Hardcoded Founder & Owner\n` +
      `• <@${PERMANENT_BOT_OWNER_ID}> (\`${PERMANENT_BOT_OWNER_ID}\`) — *Full Bot Authority & Lifetime Premium*\n\n` +
      `### ${CE.white_owner.str} Bot Owners (${owners.length})\n` +
      (owners.length > 0
        ? owners.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *All premium & full command access*`).join("\n")
        : "*No appointed owners*") +
      `\n\n` +
      `### ${CE.white_co_owner.str} Bot Co-Owners (${coOwners.length})\n` +
      (coOwners.length > 0
        ? coOwners.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *All premium & full command access*`).join("\n")
        : "*No appointed co-owners*") +
      `\n\n` +
      `### ${CE.white_admin.str} Bot Administrators (${admins.length})\n` +
      (admins.length > 0
        ? admins.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Admin tools, user premium, elevated bypass*`).join("\n")
        : "*No appointed administrators*") +
      `\n\n` +
      `### ${CE.white_manager.str} Community Managers (${managers.length})\n` +
      (managers.length > 0
        ? managers.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Operations & server manager badge*`).join("\n")
        : "*No appointed managers*") +
      `\n\n` +
      `### ${CE.white_HeadTester.str} Head QA Testers (${headTesters.length})\n` +
      (headTesters.length > 0
        ? headTesters.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Lifetime VIP & Testing Lead*`).join("\n")
        : "*No appointed head testers*") +
      `\n\n` +
      `### ${CE.white_Tester.str} QA Testers (${testers.length})\n` +
      (testers.length > 0
        ? testers.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *1 Year VIP & Feature Testing*`).join("\n")
        : "*No appointed testers*") +
      `\n\n` +
      `### ${CE.Moderator.str} Bot Moderators (${mods.length})\n` +
      (mods.length > 0
        ? mods.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Global moderation, case logs, ticket tools*`).join("\n")
        : "*No appointed moderators*") +
      `\n\n` +
      `### ${CE.white_helper.str} Bot Support & Help (${helpers.length})\n` +
      (helpers.length > 0
        ? helpers.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Support helper badge & setup assistance*`).join("\n")
        : "*No appointed helpers*") +
      `\n\n` +
      `### ${CE.white_partner.str} Verified Partners (${partners.length})\n` +
      (partners.length > 0
        ? partners.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Official server affiliate & partner badge*`).join("\n")
        : "*No appointed partners*") +
      `\n\n` +
      `### ${CE.white_vip.str} VIP Contributors (${vips.length})\n` +
      (vips.length > 0
        ? vips.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *VIP lifetime contributor badge*`).join("\n")
        : "*No appointed VIPs*") +
      `\n\n` +
      `### ${CE.white_homies.str} Homies (${homies.length})\n` +
      (homies.length > 0
        ? homies.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Inner core community friend badge*`).join("\n")
        : "*No appointed homies*") +
      `\n\n` +
      `### ${CE.white_supporter.str} Supporters (${supporters.length})\n` +
      (supporters.length > 0
        ? supporters.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Server boosting supporter badge*`).join("\n")
        : "*No appointed supporters*") +
      `\n\n` +
      `### ${CE.white_support_team.str} Support Team (${supportTeams.length})\n` +
      (supportTeams.length > 0
        ? supportTeams.map((s) => `• <@${s.userId}> (\`${s.userId}\`) — *Official Zenith Bot staff badge*`).join("\n")
        : "*No appointed support team*") +
      `\n\n` +
      `**Quick Management:**\n` +
      `• **Staff Roles**: Appoint Staff or Remove Staff buttons below\n` +
      `• **Non-Staff Ranks**: Assign Non-Staff or Remove Non-Staff buttons (Partners, Homies, VIP, Supporter, Support Team)\n` +
      `• Or run: \`.botstaff set @user <role>\``
    )
    .setFooter({ text: "Zenith Bot Official Roster • Real-time Sync" })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn:bsp:add")
      .setLabel("Appoint Staff")
      .setEmoji(CE.success.id)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("btn:bsp:remove")
      .setLabel("Remove Staff")
      .setEmoji(CE.demotion.id)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("btn:bsp:add_nonstaff")
      .setLabel("Assign Non-Staff Role")
      .setEmoji(CE.white_vip.id)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn:bsp:remove_nonstaff")
      .setLabel("Remove Non-Staff Role")
      .setEmoji(CE.white_cancel.id)
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn:bsp:breakdown")
      .setLabel("Role Benefits & Badges")
      .setEmoji(CE.information.id)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:bsp:refresh")
      .setLabel("Refresh Roster")
      .setEmoji(CE.loading.id)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:bsp:dismiss")
      .setLabel("Close Panel")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [row1, row2] };
}

export async function handleBotStaffButton(interaction: ButtonInteraction): Promise<void> {
  const allowed = await canManageBotStaff(interaction.user.id, interaction.guild, interaction.client);
  if (!allowed) {
    await interaction.reply({
      content: `${CE.failure.str} Access Denied: Only authorized bot staff and administrators can interact with this panel.`,
      ephemeral: true,
    });
    return;
  }

  const customId = interaction.customId;

  if (customId === "btn:bsp:add") {
    const modal = new ModalBuilder()
      .setCustomId("modal:bsp:add")
      .setTitle("Appoint Bot Staff Member");

    const userInput = new TextInputBuilder()
      .setCustomId("bsp_add_user")
      .setLabel("User Mention or ID")
      .setPlaceholder("e.g. 1181221352393420856 or @user")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId("bsp_add_role")
      .setLabel("Staff Role")
      .setPlaceholder("admin | manager | head_tester | tester | mod | help")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
    );

    await interaction.showModal(modal as any);
    return;
  }

  if (customId === "btn:bsp:add_nonstaff") {
    const modal = new ModalBuilder()
      .setCustomId("modal:bsp:add")
      .setTitle("Assign Non-Staff Role");

    const userInput = new TextInputBuilder()
      .setCustomId("bsp_add_user")
      .setLabel("User Mention or ID")
      .setPlaceholder("e.g. 1181221352393420856 or @user")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId("bsp_add_role")
      .setLabel("Non-Staff Role: vip, homies, partner...")
      .setPlaceholder("vip | homies | partner | supporter | support_team")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
    );

    await interaction.showModal(modal as any);
    return;
  }

  if (customId === "btn:bsp:remove" || customId === "btn:bsp:remove_nonstaff") {
    const modal = new ModalBuilder()
      .setCustomId("modal:bsp:remove")
      .setTitle("Remove Role / Rank");

    const userInput = new TextInputBuilder()
      .setCustomId("bsp_remove_user")
      .setLabel("User Mention or ID")
      .setPlaceholder("e.g. 1181221352393420856 or @user")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userInput)
    );

    await interaction.showModal(modal as any);
    return;
  }

  if (customId === "btn:bsp:breakdown") {
    const fields = Object.values(BOT_STAFF_ROLES).map((r) => ({
      name: `${r.emojiStr} ${r.title} ${r.badge}`,
      value: `${r.description}\n` + r.benefits.map((b) => `• ${b}`).join("\n"),
      inline: false,
    }));

    const inviteUrl = await getTestingServerInvite(interaction.client);

    const embed = new EmbedBuilder()
      .setTitle(`${CE.admin.str} Official Bot Staff & Role Privileges`)
      .setColor(COLORS.primary)
      .setDescription(
        `Below is the complete hierarchy and unlocked benefits for official **Zenith Bot Staff, Testers & Non-Staff Ranks**.\n\n` +
        `• **Official Bot Testing Server:** [Click to Join Testing Server](${inviteUrl})\n` +
        `• **Testing Role Auto-Granted:** <@&${TEST_SERVER_STAFF_ROLE_ID}> upon joining`
      )
      .addFields(fields)
      .setFooter({ text: "Zenith Staff Operations • Authorized Roster" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === "btn:bsp:refresh") {
    const { embed, rows } = await buildStaffPanelEmbed();
    await interaction.update({ embeds: [embed], components: rows as any });
    return;
  }

  if (customId === "btn:bsp:dismiss") {
    await interaction.update({ components: [] as any });
    return;
  }
}

export async function handleBotStaffModal(interaction: ModalSubmitInteraction): Promise<void> {
  const allowed = await canManageBotStaff(interaction.user.id, interaction.guild, interaction.client);
  if (!allowed) {
    await interaction.reply({
      content: `${CE.failure.str} Access Denied: Unauthorized action.`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === "modal:bsp:add") {
    const rawUser = interaction.fields.getTextInputValue("bsp_add_user").trim();
    const rawRole = interaction.fields.getTextInputValue("bsp_add_role").trim();

    const idMatch = rawUser.match(/\d{17,20}/);
    if (!idMatch) {
      await interaction.reply({
        content: `${CE.failure.str} Invalid user provided. Please provide a valid User ID or @mention.`,
        ephemeral: true,
      });
      return;
    }
    const targetUserId = idMatch[0];

    const lowerRole = rawRole.toLowerCase().replace(/[-_ ]/g, "");
    let resolvedRole: BotStaffRole | null = null;
    if (lowerRole === "owner") resolvedRole = "owner";
    else if (lowerRole === "coowner" || lowerRole === "co_owner") resolvedRole = "co_owner";
    else if (lowerRole === "admin" || lowerRole === "administrator") resolvedRole = "admin";
    else if (lowerRole === "manager" || lowerRole === "mgr") resolvedRole = "manager";
    else if (lowerRole === "headtester" || lowerRole === "head_tester" || lowerRole === "htester") resolvedRole = "head_tester";
    else if (lowerRole === "tester" || lowerRole === "qa" || lowerRole === "test") resolvedRole = "tester";
    else if (lowerRole === "mod" || lowerRole === "moderator") resolvedRole = "mod";
    else if (lowerRole === "help" || lowerRole === "helper") resolvedRole = "help";
    else if (lowerRole === "vip") resolvedRole = "vip";
    else if (lowerRole === "homies" || lowerRole === "homie") resolvedRole = "homies";
    else if (lowerRole === "partner") resolvedRole = "partner";
    else if (lowerRole === "supporter") resolvedRole = "supporter";
    else if (lowerRole === "supportteam" || lowerRole === "support_team" || lowerRole === "support") resolvedRole = "support_team";

    if (!resolvedRole) {
      await interaction.reply({
        content: `${CE.failure.str} Invalid role \`${rawRole}\`.\nAvailable roles: \`owner\`, \`co_owner\`, \`admin\`, \`manager\`, \`head_tester\`, \`tester\`, \`mod\`, \`help\`, \`partner\`, \`vip\`, \`homies\`, \`supporter\`, \`support_team\`.`,
        ephemeral: true,
      });
      return;
    }

    const { dmSent } = await setBotStaffRole(targetUserId, resolvedRole, interaction.user.id, interaction.client);
    const meta = BOT_STAFF_ROLES[resolvedRole];

    const { getUserAllBadges } = await import("../storage/profile");
    const { badgeEmojisStr, topBadgesStr } = await getUserAllBadges(targetUserId, interaction.guildId || undefined);

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Role Appointed Successfully`)
      .setColor(meta.color)
      .setDescription(
        `Successfully appointed <@${targetUserId}> (\`${targetUserId}\`) as **${meta.title}** ${meta.badge}!\n\n` +
        `• **Role**: \`${meta.name}\`\n` +
        `• **Top Badges**: ${topBadgesStr || meta.emojiStr}\n` +
        `• **All Profile Badges**: ${badgeEmojisStr || meta.emojiStr}\n` +
        `• **Premium License**: ${resolvedRole === "head_tester" || resolvedRole === "owner" || resolvedRole === "co_owner" || resolvedRole === "admin" || resolvedRole === "vip" || resolvedRole === "homies" || resolvedRole === "partner" || resolvedRole === "supporter" ? `${CE.white_premium.str} \`LIFETIME VIP ACCESS\`` : resolvedRole === "tester" ? `${CE.white_award.str} \`1 YEAR (365 DAYS) VIP ACCESS\`` : "Staff Access"}\n` +
        `• **Testing Server Role**: Automatically assigned role <@&${TEST_SERVER_STAFF_ROLE_ID}>\n` +
        `• **Direct Message**: ${dmSent ? "Delivered successfully with permanent testing server invite" : "Could not reach user via DM (DMs closed)"}`
      )
      .setFooter({ text: "Zenith Bot Roster" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    if (interaction.message) {
      const { embed: panelEmbed, rows } = await buildStaffPanelEmbed();
      await interaction.message.edit({ embeds: [panelEmbed], components: rows as any }).catch(() => {});
    }
    return;
  }

  if (interaction.customId === "modal:bsp:remove") {
    const rawUser = interaction.fields.getTextInputValue("bsp_remove_user").trim();
    const idMatch = rawUser.match(/\d{17,20}/);
    if (!idMatch) {
      await interaction.reply({
        content: `${CE.failure.str} Invalid user provided. Please provide a valid User ID or @mention.`,
        ephemeral: true,
      });
      return;
    }
    const targetUserId = idMatch[0];

    const removed = await removeBotStaffRole(targetUserId);

    const embed = new EmbedBuilder()
      .setTitle(`${removed ? CE.success.str : CE.failure.str} Member ${removed ? "Removed" : "Not Found"}`)
      .setColor(removed ? 0xED4245 : 0x2B2D31)
      .setDescription(
        removed
          ? `Successfully removed <@${targetUserId}> (\`${targetUserId}\`) from the official roster.`
          : `<@${targetUserId}> was not found in the roster.`
      )
      .setFooter({ text: "Zenith Bot Directory" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    if (interaction.message && removed) {
      const { embed: panelEmbed, rows } = await buildStaffPanelEmbed();
      await interaction.message.edit({ embeds: [panelEmbed], components: rows as any }).catch(() => {});
    }
    return;
  }
}

export const botStaffCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("botstaff")
    .setDescription("Bot Staff Management Panel (Hardcoded Owner Only)")
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Display the interactive Bot Staff & Tester Panel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Assign or update a bot staff member or QA tester")
        .addUserOption((o) => o.setName("user").setDescription("User to assign").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Role to assign")
            .setRequired(true)
            .addChoices(
              { name: "Head Tester (Lifetime Premium & Lead QA)", value: "head_tester" },
              { name: "Tester (1 Year Premium & Bug Testing)", value: "tester" },
              { name: "Owner (All premium & all commands)", value: "owner" },
              { name: "Co Owner (Same as owner)", value: "co_owner" },
              { name: "Admin (Administration clearance & user premium)", value: "admin" },
              { name: "Mod (Global moderation & ticket oversight)", value: "mod" },
              { name: "Help (Support & helper clearance)", value: "help" },
              { name: "VIP (Special VIP Member Badge)", value: "vip" },
              { name: "Homies (Community Friend & Homies Rank)", value: "homies" },
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the bot staff team")
        .addUserOption((o) => o.setName("user").setDescription("User to remove").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all currently appointed bot staff and QA testers")
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const allowed = await canManageBotStaff(interaction.user.id, interaction.guild, interaction.client);
    if (!allowed) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Access Restricted")
            .setColor(COLORS.danger)
            .setDescription(
              `${CE.failure.str} You do not have permission to access the **Bot Staff Management Panel**.\n` +
              `*Authorized: Bot Owner, Bot Administrators, or Appointed Staff.*`
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false);
    const rawArgs: string[] = (interaction as any).rawArgs || [];

    // Determine sub action
    let action = sub;
    if (!action || action === "panel" || action === "add") {
      const firstArg = rawArgs[0]?.toLowerCase();
      if (firstArg === "remove" || firstArg === "delete" || firstArg === "del" || firstArg === "rm") {
        action = "remove";
      } else if (firstArg === "set" || firstArg === "appoint" || firstArg === "give") {
        action = "set";
      } else if (firstArg === "list" || firstArg === "ls" || firstArg === "all") {
        action = "list";
      } else if (rawArgs.length >= 2) {
        action = "set";
      } else {
        action = "panel";
      }
    }

    if (action === "panel" || action === "list") {
      const { embed, rows } = await buildStaffPanelEmbed();
      await interaction.reply({ embeds: [embed], components: rows as any });
      return;
    }

    if (action === "set") {
      let targetUser = parseUserToken(interaction);
      let role = parseRoleToken(interaction);

      // Sift from raw arguments if needed
      if (!targetUser && rawArgs.length > 0) {
        for (const arg of rawArgs) {
          const match = arg.match(/\d{17,20}/);
          if (match) {
            targetUser = await interaction.client.users.fetch(match[0]).catch(() => null);
            if (targetUser) break;
          }
        }
      }

      if (!targetUser) {
        await interaction.reply({
          content: `${CE.failure.str} Please specify a valid user to appoint. Example: \`.botstaff set @user tester\``,
          ephemeral: true,
        });
        return;
      }

      if (!role) {
        await interaction.reply({
          content: `${CE.failure.str} Please specify a valid staff role: \`head_tester\`, \`tester\`, \`owner\`, \`co_owner\`, \`admin\`, \`mod\`, or \`help\`.`,
          ephemeral: true,
        });
        return;
      }

      const meta = BOT_STAFF_ROLES[role];
      const { dmSent } = await setBotStaffRole(
        targetUser.id,
        role,
        interaction.user.id,
        interaction.client,
      );

      const { getUserAllBadges } = await import("../storage/profile");
      const { badgeEmojisStr, topBadgesStr } = await getUserAllBadges(targetUser.id, interaction.guildId || undefined);

      const embed = new EmbedBuilder()
        .setTitle(`${CE.success.str} Bot Staff / Tester Appointed Successfully`)
        .setColor(meta.color)
        .setDescription(
          `Successfully appointed <@${targetUser.id}> (\`${targetUser.id}\`) as **${meta.title}** ${meta.badge}!\n\n` +
          `• **Role**: \`${meta.name}\`\n` +
          `• **Top Badges**: ${topBadgesStr || meta.emojiStr}\n` +
          `• **All Profile Badges**: ${badgeEmojisStr || meta.emojiStr}\n` +
          `• **Premium Granted**: ${role === "head_tester" || role === "owner" || role === "co_owner" || role === "admin" ? `${CE.white_premium.str} \`LIFETIME VIP ACCESS\`` : role === "tester" ? `${CE.white_award.str} \`1 YEAR (365 DAYS) VIP ACCESS\`` : "Staff Access"}\n` +
          `• **Testing Server Role**: Assigned role <@&${TEST_SERVER_STAFF_ROLE_ID}>\n` +
          `• **Direct Message**: ${dmSent ? "Delivered successfully with permanent testing server invite link" : "Could not reach user via DM (DMs closed)"}`
        )
        .setFooter({ text: "Zenith Bot Staff Directory" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === "remove") {
      let targetUser = parseUserToken(interaction);
      if (!targetUser && rawArgs.length > 0) {
        for (const arg of rawArgs) {
          const match = arg.match(/\d{17,20}/);
          if (match) {
            targetUser = await interaction.client.users.fetch(match[0]).catch(() => null);
            if (targetUser) break;
          }
        }
      }

      if (!targetUser) {
        await interaction.reply({
          content: `${CE.failure.str} Please specify a valid user to remove. Example: \`.botstaff remove @user\``,
          ephemeral: true,
        });
        return;
      }

      const removed = await removeBotStaffRole(targetUser.id);
      const embed = new EmbedBuilder()
        .setTitle(`${removed ? CE.success.str : CE.failure.str} Staff Member ${removed ? "Removed" : "Not Found"}`)
        .setColor(removed ? 0xED4245 : 0x2B2D31)
        .setDescription(
          removed
            ? `Successfully removed <@${targetUser.id}> (\`${targetUser.id}\`) from the official bot staff team.`
            : `<@${targetUser.id}> was not found in the bot staff roster.`
        )
        .setFooter({ text: "Zenith Bot Staff Directory" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default botStaffCommand;
