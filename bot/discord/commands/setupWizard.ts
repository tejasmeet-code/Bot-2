import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type RoleSelectMenuInteraction,
  type AnySelectMenuInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { updateGuildConfig, getGuildConfig, getAntiNukeConfig } from "../storage/config";
import {
  runAutoSetupWizard,
  runAllSetupWizard,
  runSpecificSetup,
} from "../utils/autoSetupWizard";
import { detectSmartRoles } from "../utils/roleDetector";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

interface WizardState {
  step: number;
  ownerRoleId?: string;
  adminRoleId?: string;
  mainRoleId?: string;
  staffCommonRoleId?: string;
  staffRoleHierarchy?: string[];
  securityWallsActive?: boolean;
  botNotificationsChannelId?: string;
}

const activeWizards = new Map<string, WizardState>();

export async function startSetupWizard(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    const msg = { content: "This command can only be used inside a server.", flags: 1 << 6 };
    if (interaction.isButton()) await interaction.update(msg);
    else await interaction.reply(msg);
    return;
  }

  const detection = await detectSmartRoles(interaction.guild);
  const state: WizardState = {
    step: 1,
    ownerRoleId: detection.ownerRole?.id,
    adminRoleId: detection.adminRole?.id,
    mainRoleId: detection.mainMemberRole?.id,
    staffCommonRoleId: detection.staffCommonRole?.id,
    staffRoleHierarchy: detection.staffHierarchy.map((r) => r.id),
    securityWallsActive: true,
  };
  activeWizards.set(`${interaction.guildId}:${interaction.user.id}`, state);

  const ownerRoleText = detection.ownerRole
    ? `<@&${detection.ownerRole.id}> (\`${detection.ownerRole.name}\`)`
    : "*No specific owner role detected*";
  const adminRoleText = detection.adminRole
    ? `<@&${detection.adminRole.id}> (\`${detection.adminRole.name}\`)`
    : "*No specific admin role detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.owner.str} Server Setup — Step 1/4: Owner & Admin Roles`)
    .setDescription(
      `Configure the **Executive Leadership Roles** for **${interaction.guild.name}**.\n\n` +
      `👑 **Detected Owner Role:** ${ownerRoleText}\n` +
      `🛡️ **Detected Admin Role:** ${adminRoleText}\n\n` +
      `• Click **Apply Detected Leadership** to accept both roles in 1-click\n` +
      `• Or use the dropdown menu below to select your server's **Owner Role**\n` +
      `• Or click **1-Click Full Auto Setup** to configure all roles, 3 security walls, and channels instantly!`,
    )
    .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
    .setColor(COLORS.primary);

  const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("wiz:step1:select_owner")
      .setPlaceholder("Select Server Owner / Executive Role...")
      .setMinValues(1)
      .setMaxValues(1),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step1:apply_leadership")
      .setLabel("Apply Detected Leadership")
      .setEmoji({ id: CE.star.id, name: CE.star.name })
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("wiz:step1:auto")
      .setLabel("1-Click Full Auto Setup")
      .setEmoji({ id: CE.check.id, name: CE.check.name })
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:step1:skip")
      .setLabel("Skip Step 1")
      .setStyle(ButtonStyle.Secondary),
  );

  if (interaction.isButton()) {
    await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
  } else {
    await interaction.reply({ embeds: [embed], components: [selectRow, btnRow] });
  }
}

export async function showSmartRolesOverview(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply();

  const detection = await detectSmartRoles(interaction.guild);

  const ownerStr = detection.ownerRole ? `<@&${detection.ownerRole.id}> (\`${detection.ownerRole.name}\`)` : "*None detected*";
  const adminStr = detection.adminRole ? `<@&${detection.adminRole.id}> (\`${detection.adminRole.name}\`)` : "*None detected*";
  const memberStr = detection.mainMemberRole ? `<@&${detection.mainMemberRole.id}> (\`${detection.mainMemberRole.name}\`)` : "*None detected*";
  const staffStr = detection.staffCommonRole ? `<@&${detection.staffCommonRole.id}> (\`${detection.staffCommonRole.name}\`)` : "*None detected*";
  const hierarchyStr =
    detection.staffHierarchy.length > 0
      ? detection.staffHierarchy
          .slice(0, 8)
          .map((r, i) => `\`${i + 1}.\` <@&${r.id}> (Pos: ${r.position})`)
          .join("\n")
      : "*No staff hierarchy roles found*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.star.str} Smart Role Detection Report — ${interaction.guild.name}`)
    .setColor(0x57f287)
    .setDescription(
      "Zenith Sentinel has scanned your server permissions, positions, and executive roles.\n" +
      "Click **Apply Detected Roles** to instantly synchronize these roles across all bot modules.",
    )
    .addFields(
      { name: `${CE.owner.str} Owner Role`, value: ownerStr, inline: true },
      { name: `${CE.admin.str} Admin Role`, value: adminStr, inline: true },
      { name: `${CE.members.str} Main Member Role`, value: memberStr, inline: true },
      { name: `${CE.moderation.str} Staff Common Role`, value: staffStr, inline: true },
      { name: `${CE.manager.str} Auto-Ranked Staff Hierarchy (${detection.staffHierarchy.length} Roles)`, value: hierarchyStr, inline: false },
    )
    .setFooter({ text: "Use /setup to customize each role individually or run 1-Click Auto Setup." })
    .setTimestamp();

  if (!detection.isBotRoleHighEnough && detection.botRoleWarning) {
    embed.addFields({
      name: `⚠️ High Role Position Required`,
      value: detection.botRoleWarning,
      inline: false,
    });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step1:auto")
      .setLabel("Apply Detected Roles & 3 Walls")
      .setEmoji({ id: CE.check.id, name: CE.check.name })
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:wizard:start")
      .setLabel("Interactive Setup Wizard")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export const setupWizardCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure Owner & Member roles, auto-filled staff hierarchy, and 3 security walls.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName("module")
        .setDescription("Specific setup module: all, roles, antinuke, automod, staff, logs, verify")
        .setRequired(false)
        .addChoices(
          { name: "all (Setup Everything: 3 Security Walls, AutoMod, Staff, Channels)", value: "all" },
          { name: "roles (Smart Role Detection & Hierarchy Preview)", value: "roles" },
          { name: "antinuke (3 Security Walls & Whitelisting)", value: "antinuke" },
          { name: "automod (AutoMod & Moderation System)", value: "automod" },
          { name: "staff (Staff Hierarchy & Management)", value: "staff" },
          { name: "logs (Designated Logging Channels)", value: "logs" },
          { name: "verify (Member Verification)", value: "verify" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used inside a server.", flags: 1 << 6 });
      return;
    }

    const moduleOption = interaction.options.getString("module");
    if (moduleOption) {
      if (moduleOption === "roles") {
        await showSmartRolesOverview(interaction);
        return;
      }
      if (moduleOption === "all") {
        await interaction.deferReply();
        const { embed } = await runAllSetupWizard(interaction.guild, interaction.user.id);
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      const { embed } = await runSpecificSetup(interaction.guild, moduleOption, interaction.user.id);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    await startSetupWizard(interaction);
  },
};

export async function handleWizardSelect(interaction: AnySelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) return;
  const key = `${guildId}:${interaction.user.id}`;
  const state = activeWizards.get(key) ?? { step: 1 };

  if (interaction.customId === "wiz:step1:select_owner") {
    state.ownerRoleId = interaction.values[0];
    state.step = 2;
    activeWizards.set(key, state);
    await showStep2(interaction as any);
  } else if (interaction.customId === "wiz:step2:select_member") {
    state.mainRoleId = interaction.values[0];
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction as any);
  } else if (interaction.customId === "wiz:step3:multiselect") {
    state.staffRoleHierarchy = interaction.values;
    state.step = 4;
    activeWizards.set(key, state);
    await showStep4(interaction as any);
  } else if (interaction.customId === "wiz:step4:select_notifications") {
    state.botNotificationsChannelId = interaction.values[0];
    activeWizards.set(key, state);
    await showStep4(interaction as any);
  }
}

export async function handleWizardButton(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) return;
  const key = `${guildId}:${interaction.user.id}`;
  const state = activeWizards.get(key) ?? { step: 1 };

  if (interaction.customId === "wiz:wizard:start") {
    await startSetupWizard(interaction);
    return;
  }

  if (interaction.customId === "wiz:step1:apply_leadership") {
    const detection = await detectSmartRoles(interaction.guild);
    state.ownerRoleId = detection.ownerRole?.id;
    state.adminRoleId = detection.adminRole?.id;
    state.step = 2;
    activeWizards.set(key, state);
    await showStep2(interaction);
    return;
  }

  if (interaction.customId === "wiz:step1:auto") {
    const { embed } = await runAutoSetupWizard(interaction.guild, interaction.user.id);
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (interaction.customId === "wiz:step1:skip") {
    state.step = 2;
    activeWizards.set(key, state);
    await showStep2(interaction);
    return;
  }

  if (interaction.customId === "wiz:step2:auto" || interaction.customId === "wiz:step2:apply") {
    const detection = await detectSmartRoles(interaction.guild);
    state.mainRoleId = detection.mainMemberRole?.id;
    state.staffCommonRoleId = detection.staffCommonRole?.id;
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction);
    return;
  }

  if (interaction.customId === "wiz:step2:skip") {
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction);
    return;
  }

  if (interaction.customId === "wiz:step3:confirm_auto" || interaction.customId === "wiz:step3:confirm") {
    const detection = await detectSmartRoles(interaction.guild);
    state.staffRoleHierarchy = detection.staffHierarchy.map((r) => r.id);
    state.step = 4;
    activeWizards.set(key, state);
    await showStep4(interaction);
    return;
  }

  if (interaction.customId === "wiz:step3:customize") {
    await showStep3Customizer(interaction);
    return;
  }

  if (interaction.customId === "wiz:step3:skip") {
    state.step = 4;
    activeWizards.set(key, state);
    await showStep4(interaction);
    return;
  }

  if (interaction.customId === "wiz:step4:finish" || interaction.customId === "wiz:step4:arm_walls") {
    state.securityWallsActive = true;
    await finishWizard(interaction, state);
    return;
  }
}

async function showStep2(
  interaction: RoleSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  const detection = await detectSmartRoles(interaction.guild);
  const suggestedMember = detection.mainMemberRole
    ? `<@&${detection.mainMemberRole.id}> (\`${detection.mainMemberRole.name}\`)`
    : "*None detected*";
  const suggestedStaff = detection.staffCommonRole
    ? `<@&${detection.staffCommonRole.id}> (\`${detection.staffCommonRole.name}\`)`
    : "*None detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.settings.str} Server Setup — Step 2/4: Member & Common Staff Roles`)
    .setDescription(
      `Configure the **Main Member Role** and **Staff Common Role** for **${interaction.guild.name}**.\n\n` +
      `👥 **Detected Main Member Role:** ${suggestedMember}\n` +
      `🛡️ **Detected Staff Common Role:** ${suggestedStaff}\n\n` +
      `• Click **Apply Detected Roles** to accept both roles in 1-click\n` +
      `• Or use the dropdown menu below to select your server's **Main Member Role**\n` +
      `• Or click **Skip Step 2** to proceed to the Staff Hierarchy.`,
    )
    .setColor(COLORS.primary);

  const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("wiz:step2:select_member")
      .setPlaceholder("Select Main Member Role...")
      .setMinValues(1)
      .setMaxValues(1),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step2:apply")
      .setLabel("Apply Detected Roles")
      .setEmoji({ id: CE.check.id, name: CE.check.name })
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:step2:skip")
      .setLabel("Skip Step 2")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
}

async function showStep3(
  interaction: RoleSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  const detection = await detectSmartRoles(interaction.guild);

  const hierarchyPreview =
    detection.staffHierarchy.length > 0
      ? detection.staffHierarchy
          .slice(0, 8)
          .map((r, i) => `\`${i + 1}.\` <@&${r.id}> *(Pos: ${r.position})*`)
          .join("\n") +
        (detection.staffHierarchy.length > 8 ? `\n*+${detection.staffHierarchy.length - 8} more roles*` : "")
      : "*No staff roles automatically detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.manager.str} Server Setup — Step 3/4: Auto-Filled Staff Hierarchy`)
    .setDescription(
      `Staff roles have been **automatically identified and ranked** by authority and position in your server.\n\n` +
      `**${CE.bot.str} Auto-Filled Hierarchy:**\n` +
      `${hierarchyPreview}\n\n` +
      `• Click **Confirm Auto-Filled Hierarchy (Recommended)** to save and proceed\n` +
      `• Click **Customize Hierarchy** if you want to manually edit the order\n` +
      `• Or click **Skip Step 3**.`,
    )
    .setColor(COLORS.primary);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step3:confirm_auto")
      .setLabel("Confirm Auto-Filled Hierarchy")
      .setEmoji({ id: CE.check.id, name: CE.check.name })
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:step3:customize")
      .setLabel("Customize / Edit Hierarchy")
      .setEmoji({ id: CE.edit_icon.id, name: CE.edit_icon.name })
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("wiz:step3:skip")
      .setLabel("Skip Step 3")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [btnRow] });
}

async function showStep3Customizer(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;
  const detection = await detectSmartRoles(interaction.guild);

  const embed = new EmbedBuilder()
    .setTitle(`${CE.edit_icon.str} Customize Staff Hierarchy`)
    .setDescription(
      "Use the multi-select menu below to pick your server's staff roles in exact descending order (from **Highest Authority** to **Lowest Authority**).",
    )
    .setColor(COLORS.primary);

  const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("wiz:step3:multiselect")
      .setPlaceholder("Select staff roles in order (Highest ➔ Lowest)...")
      .setMinValues(1)
      .setMaxValues(Math.min(detection.allValidRoles.length || 1, 25)),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step3:confirm_auto")
      .setLabel("Back to Auto-Filled")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
}

async function showStep4(
  interaction: RoleSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  const detection = await detectSmartRoles(interaction.guild);

  let warningField: { name: string; value: string } | null = null;
  if (!detection.isBotRoleHighEnough && detection.botRoleWarning) {
    warningField = {
      name: `⚠️ High Role Position Required`,
      value: detection.botRoleWarning,
    };
  }

  const key = `${interaction.guildId}:${interaction.user.id}`;
  const state = activeWizards.get(key) ?? { step: 4 };

  const notificationsChanText = state.botNotificationsChannelId
    ? `<#${state.botNotificationsChannelId}>`
    : "*Not set (Select below)*";

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ Server Setup — Step 4/4: Bot Notifications & Security Walls`)
    .setDescription(
      `Activate Zenith Sentinel's **3 Security Walls** and configure your server's designated **Bot Notifications Channel**.\n\n` +
      `📢 **Selected Bot Notifications Channel:** ${notificationsChanText}\n` +
      `*Bot updates, system announcements, and staff alerts will be dispatched here.*\n\n` +
      `### 🧱 **The 3 Security Walls Structure:**\n` +
      `• **Wall 1: Staff & Entry Shield** *(Positioned at Staff Roles)*\n` +
      `  Protects staff permissions, halts unauthorized kicks, member pruning, and anti-spam bypass.\n\n` +
      `• **Wall 2: Structure & Administrative Shield** *(Positioned at Admin Roles)*\n` +
      `  Intercepts channel creations/deletions, role modifications, bot additions, and rogue webhooks.\n\n` +
      `• **Wall 3: Apex God-Mode Shield** *(Positioned at Server Owner & Founder)*\n` +
      `  Counters mass-bans, vanity/guild updates, and triggers instant quarantine with auto-restoration.`,
    )
    .setColor(COLORS.primary);

  if (warningField) {
    embed.addFields(warningField);
  }

  const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("wiz:step4:select_notifications")
      .setPlaceholder("Select Bot Notifications Channel...")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step4:arm_walls")
      .setLabel("Arm 3 Security Walls & Finish")
      .setEmoji({ id: CE.check.id, name: CE.check.name })
      .setStyle(ButtonStyle.Success),
  );

  await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
}

async function finishWizard(
  interaction: ButtonInteraction | RoleSelectMenuInteraction,
  state: WizardState,
): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  await updateGuildConfig(guildId, (cfg) => {
    const an = getAntiNukeConfig(cfg);
    an.enabled = true;
    an.commonPunishment = "ban";

    // Auto-whitelist Server Owner and setup runner
    if (guild.ownerId && !an.globalWhitelistUserIds.includes(guild.ownerId)) {
      an.globalWhitelistUserIds.push(guild.ownerId);
    }
    if (!an.globalWhitelistUserIds.includes(interaction.user.id)) {
      an.globalWhitelistUserIds.push(interaction.user.id);
    }
    if (state.ownerRoleId && !an.globalWhitelistRoleIds.includes(state.ownerRoleId)) {
      an.globalWhitelistRoleIds.push(state.ownerRoleId);
    }
    if (state.adminRoleId && !an.globalWhitelistRoleIds.includes(state.adminRoleId)) {
      an.globalWhitelistRoleIds.push(state.adminRoleId);
    }

    return {
      ...cfg,
      setupWizardCompleted: true,
      commandsUnlocked: true,
      antiNukeConfig: an,
      serverOwnerWhitelistUserIds: Array.from(new Set([...(cfg.serverOwnerWhitelistUserIds ?? []), guild.ownerId, interaction.user.id])),
      channels: {
        ...cfg.channels,
        botNotifications: state.botNotificationsChannelId || cfg.channels?.botNotifications,
      },
      setupConfig: {
        mainRoleId: state.mainRoleId,
        staffCommonRoleId: state.staffCommonRoleId,
        staffRoleHierarchy: state.staffRoleHierarchy ?? [],
      },
    };
  });

  const detection = await detectSmartRoles(guild);

  const ownerRoleText = state.ownerRoleId ? `<@&${state.ownerRoleId}>` : "Auto (Guild Owner)";
  const adminRoleText = state.adminRoleId ? `<@&${state.adminRoleId}>` : "Auto (Administrators)";
  const mainRoleText = state.mainRoleId ? `<@&${state.mainRoleId}>` : "Not set (Skipped)";
  const staffRoleText = state.staffCommonRoleId ? `<@&${state.staffCommonRoleId}>` : "Not set (Skipped)";
  const notificationsText = state.botNotificationsChannelId ? `<#${state.botNotificationsChannelId}>` : "None";
  const hierarchyText =
    state.staffRoleHierarchy && state.staffRoleHierarchy.length > 0
      ? state.staffRoleHierarchy.slice(0, 6).map((r) => `<@&${r}>`).join(" ➔ ") +
        (state.staffRoleHierarchy.length > 6 ? ` *(+${state.staffRoleHierarchy.length - 6} more)*` : "")
      : "Auto-Detected";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.success.str} Server Setup Complete — All 3 Security Walls Armed!`)
    .setDescription(
      `**Zenith Bot** has successfully configured **${guild.name}**!\n\n` +
      `🛡️ **3 Security Walls**: \`ACTIVE & MONITORING\`\n` +
      `📢 **Bot Notifications Channel**: ${notificationsText}\n` +
      `⚡ **Command Restriction**: \`UNLOCKED (100% OPERATIONAL)\``,
    )
    .setColor(0x57f287)
    .addFields(
      { name: `${CE.owner.str} Owner Role`, value: ownerRoleText, inline: true },
      { name: `${CE.admin.str} Admin Role`, value: adminRoleText, inline: true },
      { name: `${CE.members.str} Main Role`, value: mainRoleText, inline: true },
      { name: `${CE.moderation.str} Staff Common Role`, value: staffRoleText, inline: true },
      { name: `${CE.manager.str} Staff Hierarchy (Highest ➔ Lowest)`, value: hierarchyText, inline: false },
      {
        name: `🧱 3 Security Walls Armed`,
        value:
          `• **Wall 1 (Staff Shield):** Protects staff permissions & prevents unauthorized kicks\n` +
          `• **Wall 2 (Admin Shield):** Safeguards channels, roles, and rogue bots\n` +
          `• **Wall 3 (Apex Shield):** Anti-Ban, Anti-Nuke, and Server Destruction quarantine`,
        inline: false,
      },
    )
    .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
    .setFooter({ text: "Use /setup or .an at any time to manage roles or whitelist additional admins." })
    .setTimestamp();

  if (!detection.isBotRoleHighEnough && detection.botRoleWarning) {
    embed.addFields({
      name: `⚠️ Reminder: Drag Bot Role Higher`,
      value: detection.botRoleWarning,
      inline: false,
    });
  }

  await interaction.update({ embeds: [embed], components: [] });
}

export default setupWizardCommand;
