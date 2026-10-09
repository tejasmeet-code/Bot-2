import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  User,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  isOwnerOrCoOwner,
  getGlobalAutoReactStore,
  addGlobalAutoReactRule,
  removeGlobalAutoReactRule,
  toggleGlobalAutoReactRule,
  toggleGlobalAutoReactMaster,
  setGlobalAutoReactMasterEnabled,
  clearGlobalAutoReactRules,
  type GlobalAutoReactTargetType,
  type GlobalAutoReactStore,
} from "../storage/globalAutoReact";
import { CE, COLORS } from "../utils/embedStyle";

export function buildGlobalAutoReactPanel(store: GlobalAutoReactStore): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
} {
  const isEnabled = store.enabled;
  const rules = store.rules;
  const activeCount = rules.filter((r) => r.enabled).length;

  const words = rules.filter((r) => r.targetType === "word");
  const users = rules.filter((r) => r.targetType === "user");
  const channels = rules.filter((r) => r.targetType === "channel");
  const roles = rules.filter((r) => r.targetType === "role");

  let previewText = "";
  if (rules.length === 0) {
    previewText = "*No global auto-reactions configured yet.*\n*Use `.gar <word> <emoji>` or `.gar user @user <emoji>` to create one.*";
  } else {
    const sample = rules.slice(0, 8).map((r) => {
      let targetDisplay = `\`${r.target}\``;
      if (r.targetType === "user") targetDisplay = `<@${r.target}>`;
      else if (r.targetType === "channel") targetDisplay = `<#${r.target}>`;
      else if (r.targetType === "role") targetDisplay = `<@&${r.target}>`;
      const statusIcon = r.enabled ? CE.check.str : CE.warning.str;
      return `• ${statusIcon} \`[${r.id}]\` **${r.targetType.toUpperCase()}**: ${targetDisplay} ➔ ${r.emoji}`;
    });
    previewText = sample.join("\n") + (rules.length > 8 ? `\n*...and ${rules.length - 8} more rules.*` : "");
  }

  const embed = new EmbedBuilder()
    .setTitle(`${CE.owner.str} Global Auto-React Matrix`)
    .setColor(isEnabled ? COLORS.premium : 0xED4245)
    .setDescription(
      `Cross-server global auto-reactions configured by **Bot Owner** and **Bot Co-Owner**.\n` +
      `When active, the bot automatically reacts to matching triggers across **all servers** the bot operates in.\n\n` +
      `### System Status\n` +
      `• **Master Switch:** ${isEnabled ? `${CE.check.str} **ENABLED (ACTIVE)**` : `${CE.failure.str} **DISABLED (PAUSED)**`}\n` +
      `• **Total Rules:** \`${rules.length}\` (\`${activeCount}\` enabled, \`${rules.length - activeCount}\` paused)\n` +
      `• **Clearance Tier:** ${CE.owner.str} \`OWNER & CO-OWNER ONLY\`\n` +
      `• **Distribution:** 💬 Words: \`${words.length}\` | 👤 Users: \`${users.length}\` | 📢 Channels: \`${channels.length}\` | ${CE.locked.str} Roles: \`${roles.length}\`\n\n` +
      `### Configured Global Rules Preview\n` +
      previewText +
      `\n\n### Quick Shorthand Commands\n` +
      `• \`.gar (phrase) <emoji>\` — e.g. \`.gar gg ${CE.trophy.str}\` or \`.gar "good morning" ${CE.star.str}\`\n` +
      `• \`.gar user @user <emoji>\` — e.g. \`.gar user @owner ${CE.owner.str}\`\n` +
      `• \`.gar toggle <id>\` — Pause or resume a specific rule\n` +
      `• \`.gar remove <id>\` — Delete a global auto-reaction rule\n` +
      `• \`.gar list\` — View full details of all active rules\n` +
      `• \`.gar clear\` — Clear all global auto-reaction rules`
    )
    .setFooter({ text: "Zenith Global Infrastructure • Owner & Co-Owner Exclusive" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("btn:gar:refresh")
      .setLabel("Refresh")
      .setEmoji(CE.loading.id)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn:gar:toggle_master")
      .setLabel(isEnabled ? "Disable Global" : "Enable Global")
      .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("btn:gar:list")
      .setLabel("View All Rules")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn:gar:dismiss")
      .setLabel("Close")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, row };
}

export function buildGlobalAutoReactList(store: GlobalAutoReactStore): EmbedBuilder {
  const rules = store.rules;

  if (rules.length === 0) {
    return new EmbedBuilder()
      .setTitle(`${CE.owner.str} Global Auto-React Rules`)
      .setColor(0x2B2D31)
      .setDescription(
        `*No global auto-reactions currently configured.*\n\n` +
        `**Add one now with:**\n` +
        `• \`.gar (word/phrase) <emoji>\`\n` +
        `• \`.gar user @user <emoji>\``
      );
  }

  const lines = rules.map((r) => {
    let targetDisplay = `\`${r.target}\``;
    if (r.targetType === "user") targetDisplay = `<@${r.target}> (\`${r.target}\`)`;
    else if (r.targetType === "channel") targetDisplay = `<#${r.target}> (\`${r.target}\`)`;
    else if (r.targetType === "role") targetDisplay = `<@&${r.target}> (\`${r.target}\`)`;

    const statusBadge = r.enabled ? `${CE.check.str} \`ENABLED\`` : `${CE.warning.str} \`PAUSED\``;
    const authorTag = r.addedByName ? ` by **${r.addedByName}**` : (r.addedBy ? ` by <@${r.addedBy}>` : "");

    return (
      `• **ID:** \`${r.id}\` | **Type:** \`${r.targetType.toUpperCase()}\` | ${statusBadge}\n` +
      `  **Target:** ${targetDisplay} ➔ **Emoji:** ${r.emoji}${authorTag}`
    );
  });

  return new EmbedBuilder()
    .setTitle(`${CE.owner.str} Global Auto-React Rules (${rules.length})`)
    .setColor(store.enabled ? COLORS.premium : 0xED4245)
    .setDescription(
      `Master Switch: ${store.enabled ? `${CE.check.str} **ONLINE**` : `${CE.failure.str} **PAUSED**`}\n\n` +
      lines.join("\n\n")
    )
    .setFooter({ text: "Use .gar remove <id> to delete a rule • .gar toggle <id> to pause" })
    .setTimestamp();
}

export const globalAutoReactCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("globalautoreact")
    .setDescription("[Owner & Co-Owner] Configure cross-server global auto-reactions")
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Display the Global Auto-React management panel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add or update a global auto-reaction rule")
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("Trigger type")
            .setRequired(true)
            .addChoices(
              { name: "Word / Phrase", value: "word" },
              { name: "User", value: "user" },
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
            )
        )
        .addStringOption((o) =>
          o.setName("target").setDescription("Word, phrase, user ID, or channel/role ID").setRequired(true)
        )
        .addStringOption((o) =>
          o.setName("emoji").setDescription("Unicode or custom emoji to react with").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a global auto-reaction rule by ID or target")
        .addStringOption((o) =>
          o.setName("id").setDescription("The rule ID or target").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Toggle a specific rule or master switch")
        .addStringOption((o) =>
          o.setName("id").setDescription("The rule ID (leave empty to toggle master switch)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all configured global auto-reactions")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Remove all configured global auto-reactions")
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const authorized = await isOwnerOrCoOwner(userId);

    if (!authorized) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: This command is strictly reserved for the **Bot Owner** and **Bot Co-Owner**.`,
        flags: 1 << 6,
      });
      return;
    }

    let sub = interaction.options.getSubcommand(false);
    const rawArgs: string[] = (interaction as any).rawArgs || [];

    // Fallback prefix parsing
    if (!sub) {
      if (rawArgs.length === 0) {
        sub = "panel";
      } else {
        const first = rawArgs[0].toLowerCase();
        if (first === "list") sub = "list";
        else if (first === "clear") sub = "clear";
        else if (first === "remove" || first === "delete" || first === "del") sub = "remove";
        else if (first === "toggle") sub = "toggle";
        else if (first === "enable" || first === "on") sub = "enable";
        else if (first === "disable" || first === "off") sub = "disable";
        else if (first === "panel") sub = "panel";
        else sub = "add";
      }
    }

    const store = await getGlobalAutoReactStore();

    if (sub === "panel") {
      const { embed, row } = buildGlobalAutoReactPanel(store);
      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (sub === "list") {
      const embed = buildGlobalAutoReactList(store);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "enable") {
      await setGlobalAutoReactMasterEnabled(true);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Global Auto-React Enabled`)
            .setColor(0x57F287)
            .setDescription(`Global Auto-Reaction system is now **ONLINE** across all servers.`)
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "disable") {
      await setGlobalAutoReactMasterEnabled(false);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.failure.str} Global Auto-React Disabled`)
            .setColor(0xED4245)
            .setDescription(`Global Auto-Reaction system is now **PAUSED** across all servers.`)
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "clear") {
      const count = await clearGlobalAutoReactRules();
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Global Auto-Reactions Cleared`)
            .setColor(0x57F287)
            .setDescription(`Successfully removed all **${count}** global auto-reaction rules.`)
            .setFooter({ text: `Cleared by ${interaction.user.tag}` })
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "toggle") {
      let targetId = interaction.options.getString("id");
      if (!targetId && rawArgs.length > 1) {
        targetId = rawArgs[1];
      }

      if (!targetId || targetId.toLowerCase() === "master") {
        const nextState = await toggleGlobalAutoReactMaster();
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${nextState ? CE.success.str : CE.failure.str} Global Auto-React Master Switch`)
              .setColor(nextState ? 0x57F287 : 0xED4245)
              .setDescription(`Global Auto-React is now **${nextState ? "ENABLED" : "PAUSED"}** globally.`)
              .setTimestamp(),
          ],
        });
        return;
      }

      const updated = await toggleGlobalAutoReactRule(targetId);
      if (!updated) {
        await interaction.reply({
          content: `${CE.failure.str} Rule \`${targetId}\` not found. Use \`.gar list\` to view IDs.`,
          flags: 1 << 6,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${updated.enabled ? CE.success.str : CE.warning.str} Global Rule Toggled`)
            .setColor(updated.enabled ? 0x57F287 : 0xED4245)
            .setDescription(
              `Rule \`[${updated.id}]\` (${updated.targetType}: \`${updated.target}\` ➔ ${updated.emoji}) is now **${updated.enabled ? "ACTIVE" : "PAUSED"}**.`
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "remove") {
      let targetId = interaction.options.getString("id");
      if (!targetId && rawArgs.length > 1) {
        targetId = rawArgs[1];
      }

      if (!targetId) {
        await interaction.reply({
          content: `${CE.failure.str} Please provide the Rule ID to remove. Use \`.gar list\` to inspect IDs.`,
          flags: 1 << 6,
        });
        return;
      }

      const ok = await removeGlobalAutoReactRule(targetId);
      if (!ok) {
        await interaction.reply({
          content: `${CE.failure.str} Could not find any rule matching \`${targetId}\`. Use \`.gar list\` to view active IDs.`,
          flags: 1 << 6,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Global Rule Removed`)
            .setColor(0x57F287)
            .setDescription(`Successfully deleted global auto-reaction rule \`${targetId}\`.`)
            .setFooter({ text: `Removed by ${interaction.user.tag}` })
            .setTimestamp(),
        ],
      });
      return;
    }

    // sub === "add"
    let targetType: GlobalAutoReactTargetType = "word";
    let target = "";
    let emoji = "";

    const optType = interaction.options.getString("type") as GlobalAutoReactTargetType | null;
    const optTarget = interaction.options.getString("target");
    const optEmoji = interaction.options.getString("emoji");

    if (optType && optTarget && optEmoji) {
      targetType = optType;
      target = optTarget.trim();
      emoji = optEmoji.trim();
    } else if (rawArgs.length >= 2) {
      let cleanArgs = [...rawArgs];
      if (cleanArgs[0]?.toLowerCase() === "add") {
        cleanArgs.shift();
      }

      emoji = cleanArgs[cleanArgs.length - 1].trim();
      cleanArgs.pop(); // Remove emoji from the end

      const firstToken = cleanArgs[0]?.toLowerCase() || "";

      if (firstToken === "user" && cleanArgs.length > 1) {
        targetType = "user";
        const m = cleanArgs[1].match(/\d{17,20}/);
        target = m ? m[0] : cleanArgs[1];
      } else if (firstToken === "channel" && cleanArgs.length > 1) {
        targetType = "channel";
        const m = cleanArgs[1].match(/\d{17,20}/);
        target = m ? m[0] : cleanArgs[1];
      } else if ((firstToken === "role" || firstToken === "roles") && cleanArgs.length > 1) {
        targetType = "role";
        const m = cleanArgs[1].match(/\d{17,20}/);
        target = m ? m[0] : cleanArgs[1];
      } else if (cleanArgs.length === 1 && cleanArgs[0].match(/^<@!?\d{17,20}>$/)) {
        targetType = "user";
        target = cleanArgs[0].replace(/[<@!>]/g, "");
      } else if (cleanArgs.length === 1 && cleanArgs[0].match(/^<#\d{17,20}>$/)) {
        targetType = "channel";
        target = cleanArgs[0].replace(/[<#>]/g, "");
      } else if (cleanArgs.length === 1 && cleanArgs[0].match(/^<@&\d{17,20}>$/)) {
        targetType = "role";
        target = cleanArgs[0].replace(/[<@&>]/g, "");
      } else {
        targetType = "word";
        target = cleanArgs.join(" ").replace(/^["']|["']$/g, "").trim();
      }
    }

    if (!target || !emoji) {
      await interaction.reply({
        content:
          `${CE.failure.str} Invalid format! Examples:\n` +
          `• \`.gar (phrase) <emoji>\` (e.g. \`.gar gg ${CE.trophy.str}\`)\n` +
          `• \`.gar user @user <emoji>\` (e.g. \`.gar user @owner ${CE.owner.str}\`)\n` +
          `• \`.gar channel #general <emoji>\``,
        flags: 1 << 6,
      });
      return;
    }

    const { rule, isNew } = await addGlobalAutoReactRule(
      targetType,
      target,
      emoji,
      interaction.user.id,
      interaction.user.tag,
    );

    let displayTarget = `\`${target}\``;
    if (targetType === "user") displayTarget = `<@${target}> (\`${target}\`)`;
    else if (targetType === "channel") displayTarget = `<#${target}>`;
    else if (targetType === "role") displayTarget = `<@&${target}>`;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Global Auto-Reaction ${isNew ? "Created" : "Updated"}`)
      .setColor(COLORS.premium)
      .setDescription(
        `Successfully configured global auto-reaction across all servers!\n\n` +
        `• **Rule ID:** \`${rule.id}\`\n` +
        `• **Type:** \`${targetType.toUpperCase()}\`\n` +
        `• **Target Filter:** ${displayTarget}\n` +
        `• **Reaction Emoji:** ${emoji}\n\n` +
        `*The bot will automatically react with ${emoji} globally whenever this condition is met.*`
      )
      .setFooter({ text: `Authorized Owner/Co-Owner: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export async function handleGlobalAutoReactButton(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const authorized = await isOwnerOrCoOwner(userId);

  if (!authorized) {
    await interaction.reply({
      content: `${CE.failure.str} Access Denied: Only the Bot Owner and Co-Owner can interact with Global Auto-React.`,
      flags: 1 << 6,
    });
    return;
  }

  const customId = interaction.customId;

  if (customId === "btn:gar:dismiss") {
    await interaction.message.delete().catch(() => {});
    return;
  }

  if (customId === "btn:gar:refresh") {
    const store = await getGlobalAutoReactStore();
    const { embed, row } = buildGlobalAutoReactPanel(store);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId === "btn:gar:toggle_master") {
    await toggleGlobalAutoReactMaster();
    const store = await getGlobalAutoReactStore();
    const { embed, row } = buildGlobalAutoReactPanel(store);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId === "btn:gar:list") {
    const store = await getGlobalAutoReactStore();
    const embed = buildGlobalAutoReactList(store);
    await interaction.reply({ embeds: [embed], flags: 1 << 6 });
    return;
  }
}
