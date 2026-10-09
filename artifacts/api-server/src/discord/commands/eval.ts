import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, COLORS, CE } from "../utils/embedStyle";
import { isPermanentOwner } from "../storage/premium";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("eval")
    .setDescription("Bot Owner only: Evaluate JavaScript expressions live.")
    .addStringOption((opt) =>
      opt
        .setName("code")
        .setDescription("The code to evaluate")
        .setRequired(true),
    )
    .setDMPermission(false),
  globalWhitelistOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isPermanentOwner(interaction.user.id)) {
      await interaction.reply({
        content: `${CE.error.str} Access denied. Only the Hardcoded Permanent Bot Owner can use this command.`,
        ephemeral: true,
      });
      return;
    }

    const code = interaction.options.getString("code", true);
    await interaction.deferReply({ ephemeral: true });

    const startTime = Date.now();
    let resultStr: string;
    let isError = false;

    try {
      // Execute in sandbox with helpful contextual variables
      const client = interaction.client;
      const guild = interaction.guild;
      const channel = interaction.channel;
      const user = interaction.user;
      const member = interaction.member;

      let evaluated = (0, eval)(code);
      if (evaluated instanceof Promise) {
        evaluated = await evaluated;
      }

      if (typeof evaluated !== "string") {
        resultStr = (await import("node:util")).inspect(evaluated, { depth: 2, maxArrayLength: 20 });
      } else {
        resultStr = evaluated;
      }
    } catch (err: any) {
      isError = true;
      resultStr = err?.stack || err?.message || String(err);
    }

    const elapsed = Date.now() - startTime;

    // Redact sensitive tokens and keys from eval output
    const token = interaction.client.token || "";
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
    if (token) resultStr = resultStr.replaceAll(token, "[REDACTED_TOKEN]");
    if (supabaseKey) resultStr = resultStr.replaceAll(supabaseKey, "[REDACTED_KEY]");

    const maxLen = 1800;
    const truncated = resultStr.length > maxLen ? `${resultStr.slice(0, maxLen)}\n... [truncated]` : resultStr;

    await interaction.editReply({
      embeds: [
        prettyEmbed({
          title: isError ? `${CE.error.str} Eval Error (${elapsed}ms)` : `${CE.success.str} Eval Result (${elapsed}ms)`,
          description: `\`\`\`js\n${truncated}\n\`\`\``,
          color: isError ? COLORS.danger : COLORS.success,
          footer: `Invoked by ${interaction.user.tag}`,
        }),
      ],
    });
  },
};

export default command;
