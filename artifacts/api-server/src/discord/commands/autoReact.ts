import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig, type GuildConfig } from "../storage/config";
import { isBotAdmin } from "../storage/premium";
import { CE } from "../utils/embedStyle";

function isUserWhitelistedForAutoReact(
  userId: string,
  guild: { ownerId: string; id: string },
  cfg: GuildConfig,
  member: GuildMember | null,
): boolean {
  if (guild.ownerId === userId) return true;
  if (isBotAdmin(userId)) return true;
  if (cfg.serverOwnerWhitelistUserIds?.includes(userId)) return true;
  if (cfg.serverAdminWhitelistUserIds?.includes(userId)) return true;
  if (cfg.trustedWhitelistUserIds?.includes(userId)) return true;
  if (cfg.antiNukeConfig?.globalWhitelistUserIds?.includes(userId)) return true;
  if (
    member &&
    typeof member.permissions !== "string" &&
    (member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild))
  ) {
    return true;
  }
  return false;
}

export const autoReactCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("auto-react")
    .setDescription("Configure custom emoji auto-reactions for words/phrases, channels, and roles.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add an auto-reaction mapping")
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("Trigger type")
            .setRequired(true)
            .addChoices(
              { name: "Word / Phrase", value: "word" },
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "User", value: "user" },
            ),
        )
        .addStringOption((o) =>
          o.setName("target").setDescription("Word/phrase, #channel, or @role").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("emoji").setDescription("Unicode emoji or custom server emoji").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active auto-reaction rules."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an auto-reaction rule by ID or target")
        .addStringOption((o) =>
          o.setName("id").setDescription("Rule ID or target name").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Remove all configured auto-reactions"),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used inside a server.", ephemeral: true });
      return;
    }

    const cfg = await getGuildConfig(guildId);
    const member = (interaction.member as GuildMember) ?? null;

    if (!isUserWhitelistedForAutoReact(interaction.user.id, interaction.guild, cfg, member)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: Only whitelisted members or server administrators can configure Auto-Reactions.`,
        ephemeral: true,
      });
      return;
    }

    const mappings = cfg.autoReactMappings ?? [];
    let sub = interaction.options.getSubcommand(false);
    const rawArgs: string[] = (interaction as any).rawArgs || [];

    // Fallback parser for shorthand prefix commands like:
    // .autoreact (word/phrase) emoji
    // .autoreact channel emoji
    // .autoreact roles emoji
    if (!sub && rawArgs.length > 0) {
      const first = rawArgs[0].toLowerCase();
      if (first === "list") {
        sub = "list";
      } else if (first === "clear") {
        sub = "clear";
      } else if (first === "remove" || first === "delete") {
        sub = "remove";
      } else {
        sub = "add";
      }
    }

    if (sub === "list") {
      if (mappings.length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE.settings.str} Auto-Reactions`)
              .setColor(0x2b2d31)
              .setDescription(`No auto-reactions configured yet.\n\n**Usage Examples:**\n• \`.autoreact hello ${CE.star.str}\`\n• \`.autoreact channel #general ${CE.star.str}\`\n• \`.autoreact roles @VIP ${CE.owner.str}\``),
          ],
        });
        return;
      }

      const listStr = mappings
        .map((m) => {
          let targetDisplay = m.targetId;
          if (m.targetType === "channel") targetDisplay = `<#${m.targetId}>`;
          else if (m.targetType === "role") targetDisplay = `<@&${m.targetId}>`;
          else if (m.targetType === "user") targetDisplay = `<@${m.targetId}>`;
          else targetDisplay = `\`${m.targetId}\``;
          return `• **ID:** \`${m.id}\` | **Type:** \`${m.targetType.toUpperCase()}\` | **Target:** ${targetDisplay} | **Emoji:** ${m.emoji}`;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`${CE.settings.str} Active Auto-Reactions (${mappings.length})`)
        .setDescription(listStr)
        .setColor(0x2b2d31)
        .setFooter({ text: "Use .autoreact remove <id> to delete a rule" });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "clear") {
      await updateGuildConfig(guildId, (c) => ({
        ...c,
        autoReactMappings: [],
      }));
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Auto-Reactions Cleared`)
            .setColor(0x57f287)
            .setDescription("Successfully removed all auto-reaction rules from this server."),
        ],
      });
      return;
    }

    if (sub === "remove") {
      let targetId = interaction.options.getString("id")?.trim();
      if (!targetId && rawArgs.length > 1) {
        targetId = rawArgs[1].trim();
      }

      if (!targetId) {
        await interaction.reply({
          content: `${CE.failure.str} Please provide the Rule ID to remove. Use \`.autoreact list\` to view IDs.`,
          ephemeral: true,
        });
        return;
      }

      const nextMappings = mappings.filter(
        (m) => m.id.toLowerCase() !== targetId!.toLowerCase() && m.targetId.toLowerCase() !== targetId!.toLowerCase(),
      );

      if (nextMappings.length === mappings.length) {
        await interaction.reply({
          content: `${CE.failure.str} Auto-reaction rule \`${targetId}\` not found. Use \`.autoreact list\` to check IDs.`,
          ephemeral: true,
        });
        return;
      }

      await updateGuildConfig(guildId, (c) => ({
        ...c,
        autoReactMappings: nextMappings,
      }));

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Auto-Reaction Removed`)
            .setDescription(`Successfully removed auto-reaction rule \`${targetId}\`.`)
            .setColor(0x57f287),
        ],
      });
      return;
    }

    // sub === "add"
    let targetType: "word" | "channel" | "role" | "user" | "category" = "word";
    let targetId = "";
    let emoji = "";

    const optType = interaction.options.getString("type") as any;
    const optTarget = interaction.options.getString("target");
    const optEmoji = interaction.options.getString("emoji");

    if (optType && optTarget && optEmoji) {
      targetType = optType;
      targetId = optTarget.trim();
      emoji = optEmoji.trim();
    } else if (rawArgs.length >= 2) {
      // Parse flexible shorthand:
      // Case 1: .autoreact channel #channel emoji OR .autoreact channel 12345 emoji
      // Case 2: .autoreact roles @role emoji OR .autoreact role @role emoji
      // Case 3: .autoreact #general emoji
      // Case 4: .autoreact @role emoji
      // Case 5: .autoreact (word or phrase) emoji
      let cleanArgs = [...rawArgs];
      if (cleanArgs[0].toLowerCase() === "add") {
        cleanArgs.shift();
      }

      emoji = cleanArgs[cleanArgs.length - 1].trim();
      cleanArgs.pop(); // Remove emoji from the end

      const firstToken = cleanArgs[0]?.toLowerCase() || "";

      if (firstToken === "channel" && cleanArgs.length > 1) {
        targetType = "channel";
        const chMention = cleanArgs[1].match(/\d{17,20}/);
        targetId = chMention ? chMention[0] : cleanArgs[1];
      } else if ((firstToken === "roles" || firstToken === "role") && cleanArgs.length > 1) {
        targetType = "role";
        const roleMention = cleanArgs[1].match(/\d{17,20}/);
        targetId = roleMention ? roleMention[0] : cleanArgs[1];
      } else if (cleanArgs.length === 1 && cleanArgs[0].match(/^<#\d{17,20}>$/)) {
        targetType = "channel";
        targetId = cleanArgs[0].replace(/[<#>]/g, "");
      } else if (cleanArgs.length === 1 && cleanArgs[0].match(/^<@&\d{17,20}>$/)) {
        targetType = "role";
        targetId = cleanArgs[0].replace(/[<@&>]/g, "");
      } else if (cleanArgs.length === 1 && cleanArgs[0].match(/^<@!?\d{17,20}>$/)) {
        targetType = "user";
        targetId = cleanArgs[0].replace(/[<@!>]/g, "");
      } else {
        // Target is a word or phrase
        targetType = "word";
        targetId = cleanArgs.join(" ").replace(/^["']|["']$/g, "").trim();
      }
    }

    // Clean up channel / role mentions if any
    if (targetType === "channel") {
      const match = targetId.match(/\d{17,20}/);
      if (match) targetId = match[0];
    } else if (targetType === "role") {
      const match = targetId.match(/\d{17,20}/);
      if (match) targetId = match[0];
    }

    if (!targetId || !emoji) {
      await interaction.reply({
        content:
          `${CE.failure.str} Invalid syntax! Examples:\n` +
          `• \`.autoreact (word/phrase) <emoji>\` (e.g. \`.autoreact lol <:white_games:1555133649504968775>\`)\n` +
          `• \`.autoreact channel <#channel> <emoji>\`\n` +
          `• \`.autoreact roles <@role> <emoji>\``,
        ephemeral: true,
      });
      return;
    }

    const mappingId = Math.random().toString(36).substring(2, 8);
    const newMapping = { id: mappingId, targetType, targetId, emoji };

    await updateGuildConfig(guildId, (c) => ({
      ...c,
      autoReactMappings: [...(c.autoReactMappings ?? []), newMapping],
    }));

    let displayTarget = `\`${targetId}\``;
    if (targetType === "channel") displayTarget = `<#${targetId}>`;
    else if (targetType === "role") displayTarget = `<@&${targetId}>`;
    else if (targetType === "user") displayTarget = `<@${targetId}>`;

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Auto-Reaction Configured`)
      .setColor(0x57f287)
      .setDescription(
        `Successfully added new auto-reaction rule!\n\n` +
          `• **Rule ID:** \`${mappingId}\`\n` +
          `• **Trigger Type:** \`${targetType.toUpperCase()}\`\n` +
          `• **Target Filter:** ${displayTarget}\n` +
          `• **Reaction Emoji:** ${emoji}\n\n` +
          `*The bot will automatically react with ${emoji} whenever the trigger criteria is met.*`,
      )
      .setFooter({ text: `Added by whitelisted member: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default autoReactCommand;
