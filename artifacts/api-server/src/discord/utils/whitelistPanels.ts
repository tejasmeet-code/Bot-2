import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import { getGuildConfig, updateGuildConfig, getAntiNukeConfig } from "../storage/config";
import { getAutomodConfig, updateAutomodConfig } from "../storage/automod";
import { CE, COLORS } from "./embedStyle";

export function buildAntiNukeWhitelistPanelEmbed(
  guildName: string,
  targetName: string,
  targetId: string,
  targetType: "user" | "role" | "channel" | "category",
  an: any,
): EmbedBuilder {
  const isGlobal =
    targetType === "user"
      ? an.globalWhitelistUserIds?.includes(targetId)
      : targetType === "role"
      ? an.globalWhitelistRoleIds?.includes(targetId)
      : targetType === "channel"
      ? an.globalWhitelistChannelIds?.includes(targetId)
      : an.globalWhitelistCategoryIds?.includes(targetId);

  const getSubState = (miniKey: string) => {
    const mini = an[miniKey];
    if (!mini) return false;
    return targetType === "user"
      ? mini.whitelistUserIds?.includes(targetId)
      : mini.whitelistRoleIds?.includes(targetId);
  };

  const statusStr = (val: boolean) => (val ? `${CE.check_yes.str} \`ENABLED\`` : `${CE.check_no.str} \`DISABLED\``);

  return new EmbedBuilder()
    .setTitle(`${CE.admin.str} Anti-Nuke Whitelist Panel • ${targetName}`)
    .setColor(isGlobal ? 0x57f287 : 0x2b2d31)
    .setDescription(
      `### ${CE.white_antinuke.str} Whitelist Permissions for **${targetName}** (\`${targetId}\`)\n\n` +
        `• **Global Immunity (All Modules):** ${statusStr(isGlobal)}\n` +
        `• **Anti-Ban Defenses:** ${statusStr(getSubState("antiBan"))}\n` +
        `• **Anti-Kick Defenses:** ${statusStr(getSubState("antiKick"))}\n` +
        `• **Anti-Channel Deletions:** ${statusStr(getSubState("antiChannel"))}\n` +
        `• **Anti-Role Deletions:** ${statusStr(getSubState("antiRole"))}\n` +
        `• **Anti-Webhook Creation:** ${statusStr(getSubState("antiWebhook"))}\n` +
        `• **Anti-Bot Addition:** ${statusStr(getSubState("antiBotAdd"))}\n\n` +
        `*Click the buttons below to instantly toggle whitelist access for this ${targetType}.*`
    )
    .setFooter({ text: `Server: ${guildName} • Zenith Anti-Nuke Sentinel Engine` })
    .setTimestamp();
}

export function buildAntiNukeWhitelistPanelRows(
  targetType: string,
  targetId: string,
  an: any
): ActionRowBuilder<ButtonBuilder>[] {
  const isGlobal =
    targetType === "user"
      ? an.globalWhitelistUserIds?.includes(targetId)
      : targetType === "role"
      ? an.globalWhitelistRoleIds?.includes(targetId)
      : targetType === "channel"
      ? an.globalWhitelistChannelIds?.includes(targetId)
      : an.globalWhitelistCategoryIds?.includes(targetId);

  const getSubState = (miniKey: string) => {
    const mini = an[miniKey];
    if (!mini) return false;
    return targetType === "user"
      ? mini.whitelistUserIds?.includes(targetId)
      : mini.whitelistRoleIds?.includes(targetId);
  };

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:global`)
      .setLabel(isGlobal ? "Disable Global Whitelist" : "Enable Global Whitelist")
      .setStyle(isGlobal ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:antiBan`)
      .setLabel("Anti-Ban")
      .setStyle(getSubState("antiBan") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:antiKick`)
      .setLabel("Anti-Kick")
      .setStyle(getSubState("antiKick") ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:antiChannel`)
      .setLabel("Anti-Channel")
      .setStyle(getSubState("antiChannel") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:antiRole`)
      .setLabel("Anti-Role")
      .setStyle(getSubState("antiRole") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:antiWebhook`)
      .setLabel("Anti-Webhook")
      .setStyle(getSubState("antiWebhook") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:antiBotAdd`)
      .setLabel("Anti-BotAdd")
      .setStyle(getSubState("antiBotAdd") ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:grantAll`)
      .setLabel("Grant All Whitelists")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn:anwl:${targetType}:${targetId}:removeAll`)
      .setLabel("Remove All Whitelists")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

export function buildAutomodWhitelistPanelEmbed(
  guildName: string,
  targetName: string,
  targetId: string,
  targetType: "user" | "role" | "channel" | "category",
  am: any
): EmbedBuilder {
  const isUser = targetType === "user";
  const isRole = targetType === "role";

  const isGlobal =
    isUser
      ? am.whitelistUserIds?.includes(targetId)
      : isRole
      ? am.whitelistRoleIds?.includes(targetId)
      : am.whitelistChannelIds?.includes(targetId);

  const isFilterExempt = (ruleObj: any) => {
    if (isGlobal) return true;
    if (!ruleObj) return false;
    if (isRole && ruleObj.exemptRoleIds?.includes(targetId)) return true;
    if (!isRole && ruleObj.exemptChannelIds?.includes(targetId)) return true;
    return false;
  };

  const statusStr = (val: boolean) => (val ? `${CE.check_yes.str} \`ENABLED\`` : `${CE.check_no.str} \`DISABLED\``);

  return new EmbedBuilder()
    .setTitle(`${CE.automod.str} AutoMod Whitelist Panel • ${targetName}`)
    .setColor(isGlobal ? 0x57f287 : 0x2b2d31)
    .setDescription(
      `### ${CE.automod.str} AutoMod Whitelist Permissions for **${targetName}** (\`${targetId}\`)\n\n` +
        `• **Global AutoMod Whitelist (All Filters):** ${statusStr(isGlobal)}\n` +
        `• **Anti-Spam Filter:** ${statusStr(isFilterExempt(am.spam))}\n` +
        `• **Anti-Link Filter:** ${statusStr(isFilterExempt(am.links))}\n` +
        `• **Anti-Invite Filter:** ${statusStr(isFilterExempt(am.invites))}\n` +
        `• **Anti-Mass Mention Filter:** ${statusStr(isFilterExempt(am.mentions))}\n` +
        `• **Bad Words / Profanity Filter:** ${statusStr(isFilterExempt(am.badWords))}\n\n` +
        `*Click the buttons below to toggle AutoMod bypass permissions for this ${targetType}.*`
    )
    .setFooter({ text: `Server: ${guildName} • Zenith AutoMod Engine` })
    .setTimestamp();
}

export function buildAutomodWhitelistPanelRows(
  targetType: string,
  targetId: string,
  am: any
): ActionRowBuilder<ButtonBuilder>[] {
  const isUser = targetType === "user";
  const isRole = targetType === "role";

  const isGlobal =
    isUser
      ? am.whitelistUserIds?.includes(targetId)
      : isRole
      ? am.whitelistRoleIds?.includes(targetId)
      : am.whitelistChannelIds?.includes(targetId);

  const isFilterExempt = (ruleObj: any) => {
    if (isGlobal) return true;
    if (!ruleObj) return false;
    if (isRole && ruleObj.exemptRoleIds?.includes(targetId)) return true;
    if (!isRole && ruleObj.exemptChannelIds?.includes(targetId)) return true;
    return false;
  };

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:global`)
      .setLabel(isGlobal ? "Disable Global AutoMod Whitelist" : "Enable Global AutoMod Whitelist")
      .setStyle(isGlobal ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:spam`)
      .setLabel("Anti-Spam")
      .setStyle(isFilterExempt(am.spam) ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:links`)
      .setLabel("Anti-Link")
      .setStyle(isFilterExempt(am.links) ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:invites`)
      .setLabel("Anti-Invite")
      .setStyle(isFilterExempt(am.invites) ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:mentions`)
      .setLabel("Anti-MassMention")
      .setStyle(isFilterExempt(am.mentions) ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:badWords`)
      .setLabel("Bad Words")
      .setStyle(isFilterExempt(am.badWords) ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:grantAll`)
      .setLabel("Grant All AutoMod Filters")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn:amwl:${targetType}:${targetId}:removeAll`)
      .setLabel("Remove All AutoMod Filters")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

export async function handleAntiNukeWhitelistButton(interaction: ButtonInteraction): Promise<void> {
  const cid = interaction.customId;
  if (!cid.startsWith("btn:anwl:")) return;
  const parts = cid.split(":");
  const targetType = parts[2] as "user" | "role" | "channel" | "category";
  const targetId = parts[3];
  const action = parts[4];

  const guild = interaction.guild;
  if (!guild) return;

  let targetName = targetId;
  if (targetType === "user") {
    const u = await interaction.client.users.fetch(targetId).catch(() => null);
    if (u) targetName = `@${u.username}`;
  } else if (targetType === "role") {
    const r = guild.roles.cache.get(targetId);
    if (r) targetName = `@${r.name}`;
  } else if (targetType === "channel" || targetType === "category") {
    const ch = guild.channels.cache.get(targetId);
    if (ch) targetName = `#${ch.name}`;
  }

  await updateGuildConfig(guild.id, (cfg) => {
    const an = getAntiNukeConfig(cfg);

    const toggleArr = (arr: string[] = []) =>
      arr.includes(targetId) ? arr.filter((id) => id !== targetId) : [...arr, targetId];

    const addArr = (arr: string[] = []) => Array.from(new Set([...arr, targetId]));
    const remArr = (arr: string[] = []) => arr.filter((id) => id !== targetId);

    if (action === "global") {
      if (targetType === "user") an.globalWhitelistUserIds = toggleArr(an.globalWhitelistUserIds);
      else if (targetType === "role") an.globalWhitelistRoleIds = toggleArr(an.globalWhitelistRoleIds);
      else if (targetType === "channel") an.globalWhitelistChannelIds = toggleArr(an.globalWhitelistChannelIds);
      else if (targetType === "category") an.globalWhitelistCategoryIds = toggleArr(an.globalWhitelistCategoryIds);
    } else if (action === "grantAll") {
      if (targetType === "user") an.globalWhitelistUserIds = addArr(an.globalWhitelistUserIds);
      else if (targetType === "role") an.globalWhitelistRoleIds = addArr(an.globalWhitelistRoleIds);
      else if (targetType === "channel") an.globalWhitelistChannelIds = addArr(an.globalWhitelistChannelIds);
      else if (targetType === "category") an.globalWhitelistCategoryIds = addArr(an.globalWhitelistCategoryIds);

      const miniKeys = ["antiBan", "antiKick", "antiChannel", "antiRole", "antiWebhook", "antiBotAdd"];
      for (const k of miniKeys) {
        if (!(an as any)[k]) (an as any)[k] = { enabled: true, whitelistUserIds: [], whitelistRoleIds: [], punishment: "ban" };
        const mini = (an as any)[k];
        if (targetType === "user") mini.whitelistUserIds = addArr(mini.whitelistUserIds);
        else if (targetType === "role") mini.whitelistRoleIds = addArr(mini.whitelistRoleIds);
      }
    } else if (action === "removeAll") {
      if (targetType === "user") an.globalWhitelistUserIds = remArr(an.globalWhitelistUserIds);
      else if (targetType === "role") an.globalWhitelistRoleIds = remArr(an.globalWhitelistRoleIds);
      else if (targetType === "channel") an.globalWhitelistChannelIds = remArr(an.globalWhitelistChannelIds);
      else if (targetType === "category") an.globalWhitelistCategoryIds = remArr(an.globalWhitelistCategoryIds);

      const miniKeys = ["antiBan", "antiKick", "antiChannel", "antiRole", "antiWebhook", "antiBotAdd"];
      for (const k of miniKeys) {
        const mini = (an as any)[k];
        if (mini) {
          if (targetType === "user") mini.whitelistUserIds = remArr(mini.whitelistUserIds);
          else if (targetType === "role") mini.whitelistRoleIds = remArr(mini.whitelistRoleIds);
        }
      }
    } else if (action && (an as any)[action]) {
      const mini = (an as any)[action];
      if (targetType === "user") mini.whitelistUserIds = toggleArr(mini.whitelistUserIds);
      else if (targetType === "role") mini.whitelistRoleIds = toggleArr(mini.whitelistRoleIds);
    }

    cfg.antiNukeConfig = an;
    return cfg;
  });

  const latestCfg = await getGuildConfig(guild.id);
  const latestAn = getAntiNukeConfig(latestCfg);

  const embed = buildAntiNukeWhitelistPanelEmbed(guild.name, targetName, targetId, targetType, latestAn);
  const rows = buildAntiNukeWhitelistPanelRows(targetType, targetId, latestAn);

  await interaction.update({ embeds: [embed], components: rows as any }).catch(() => {});
}

export async function handleAutomodWhitelistButton(interaction: ButtonInteraction): Promise<void> {
  const cid = interaction.customId;
  if (!cid.startsWith("btn:amwl:")) return;
  const parts = cid.split(":");
  const targetType = parts[2] as "user" | "role" | "channel" | "category";
  const targetId = parts[3];
  const action = parts[4] || "global";

  const guild = interaction.guild;
  if (!guild) return;

  let targetName = targetId;
  if (targetType === "user") {
    const u = await interaction.client.users.fetch(targetId).catch(() => null);
    if (u) targetName = `@${u.username}`;
  } else if (targetType === "role") {
    const r = guild.roles.cache.get(targetId);
    if (r) targetName = `@${r.name}`;
  } else if (targetType === "channel" || targetType === "category") {
    const ch = guild.channels.cache.get(targetId);
    if (ch) targetName = `#${ch.name}`;
  }

  await updateAutomodConfig(guild.id, (c) => {
    const toggleArr = (arr: string[] = []) =>
      arr.includes(targetId) ? arr.filter((id) => id !== targetId) : [...arr, targetId];
    const addArr = (arr: string[] = []) => Array.from(new Set([...arr, targetId]));
    const remArr = (arr: string[] = []) => arr.filter((id) => id !== targetId);

    if (action === "global" || action === "toggle") {
      if (targetType === "user") return { ...c, whitelistUserIds: toggleArr(c.whitelistUserIds) };
      if (targetType === "role") return { ...c, whitelistRoleIds: toggleArr(c.whitelistRoleIds) };
      if (targetType === "channel") return { ...c, whitelistChannelIds: toggleArr(c.whitelistChannelIds) };
      return { ...c, whitelistCategoryIds: toggleArr(c.whitelistCategoryIds) };
    } else if (action === "grantAll") {
      let nextC = { ...c };
      if (targetType === "user") nextC.whitelistUserIds = addArr(nextC.whitelistUserIds);
      else if (targetType === "role") nextC.whitelistRoleIds = addArr(nextC.whitelistRoleIds);
      else if (targetType === "channel") nextC.whitelistChannelIds = addArr(nextC.whitelistChannelIds);
      else if (targetType === "category") nextC.whitelistCategoryIds = addArr(nextC.whitelistCategoryIds);

      const rules = ["spam", "links", "invites", "mentions", "badWords", "caps", "duplicates", "newlines"];
      for (const rKey of rules) {
        if ((nextC as any)[rKey]) {
          const rule = { ...(nextC as any)[rKey] };
          if (targetType === "role") rule.exemptRoleIds = addArr(rule.exemptRoleIds);
          else if (targetType === "channel" || targetType === "category") rule.exemptChannelIds = addArr(rule.exemptChannelIds);
          (nextC as any)[rKey] = rule;
        }
      }
      return nextC;
    } else if (action === "removeAll") {
      let nextC = { ...c };
      if (targetType === "user") nextC.whitelistUserIds = remArr(nextC.whitelistUserIds);
      else if (targetType === "role") nextC.whitelistRoleIds = remArr(nextC.whitelistRoleIds);
      else if (targetType === "channel") nextC.whitelistChannelIds = remArr(nextC.whitelistChannelIds);
      else if (targetType === "category") nextC.whitelistCategoryIds = remArr(nextC.whitelistCategoryIds);

      const rules = ["spam", "links", "invites", "mentions", "badWords", "caps", "duplicates", "newlines"];
      for (const rKey of rules) {
        if ((nextC as any)[rKey]) {
          const rule = { ...(nextC as any)[rKey] };
          if (targetType === "role") rule.exemptRoleIds = remArr(rule.exemptRoleIds);
          else if (targetType === "channel" || targetType === "category") rule.exemptChannelIds = remArr(rule.exemptChannelIds);
          (nextC as any)[rKey] = rule;
        }
      }
      return nextC;
    } else if (action && (c as any)[action]) {
      const nextC = { ...c };
      const rule = { ...(nextC as any)[action] };
      if (targetType === "role") rule.exemptRoleIds = toggleArr(rule.exemptRoleIds);
      else if (targetType === "channel" || targetType === "category") rule.exemptChannelIds = toggleArr(rule.exemptChannelIds);
      (nextC as any)[action] = rule;
      return nextC;
    }

    return c;
  });

  const latestAm = await getAutomodConfig(guild.id);
  const embed = buildAutomodWhitelistPanelEmbed(guild.name, targetName, targetId, targetType, latestAm);
  const rows = buildAutomodWhitelistPanelRows(targetType, targetId, latestAm);

  await interaction.update({ embeds: [embed], components: rows as any }).catch(() => {});
}
