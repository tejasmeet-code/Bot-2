import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildBullets, COLORS, CE } from "../utils/embedStyle";
import { getSupabaseStatus, syncAllLocalStoresToSupabase } from "../storage/persistentJson";
import { isPermanentOwner, isBotAdmin } from "../storage/premium";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("supabasestatus")
    .setDescription("Check Supabase database persistence connection status and table state.")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("Action to perform: 'check' or 'sync' (syncs local stores to cloud)")
        .setRequired(false)
        .addChoices(
          { name: "Check Status", value: "check" },
          { name: "Sync Local Stores to Supabase", value: "sync" },
        ),
    )
    .setDMPermission(false),
  globalWhitelistOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const isOwner = isPermanentOwner(interaction.user.id) || isBotAdmin(interaction.user.id);
    if (!isOwner && interaction.guild?.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: `${CE.error.str} This diagnostic command is only available to the bot owner.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const rawAction = interaction.options.getString("action") || (interaction as any).rawArgs?.[0] || "check";
    const isSync = rawAction.toLowerCase() === "sync";

    if (isSync) {
      const syncResult = await syncAllLocalStoresToSupabase();
      if (syncResult.error) {
        await interaction.editReply({
          embeds: [
            prettyEmbed({
              title: `${CE.error.str} Supabase Sync Error`,
              description: `Could not sync stores to Supabase: \`${syncResult.error}\``,
              color: COLORS.danger,
              footer: "Zenith Bot Persistence Manager",
            }),
          ],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          prettyEmbed({
            title: `${CE.success.str} Local Stores Synced to Supabase`,
            description:
              `Successfully pushed local data stores into your Supabase \`bot_json_store\` table!\n\n` +
              buildBullets([
                { label: "Synced Stores", value: `**${syncResult.synced}** stores uploaded` },
                { label: "Failed Stores", value: `${syncResult.failed}` },
                {
                  label: "Stores",
                  value: syncResult.stores.length > 0 ? syncResult.stores.slice(0, 10).map((s) => `\`${s}\``).join(", ") + (syncResult.stores.length > 10 ? ` (+${syncResult.stores.length - 10} more)` : "") : "None",
                },
              ]),
            color: COLORS.success,
            footer: "Zenith Bot Persistence Manager",
          }),
        ],
      });
      return;
    }

    const status = await getSupabaseStatus();

    if (!status.configured) {
      await interaction.editReply({
        embeds: [
          prettyEmbed({
            title: `${CE.warning.str} Supabase Storage Not Configured`,
            description:
              `Data is currently stored in ephemeral local files which reset when the bot container restarts!\n\n` +
              `### ${CE.information.str} How to connect Supabase:\n` +
              `1. Open [Supabase Dashboard](https://supabase.com/dashboard)\n` +
              `2. Copy your **Project URL** and **Service Role API Key** (Settings -> API)\n` +
              `3. Add these environment variables to your bot:\n` +
              `   \`\`\`env\n` +
              `   SUPABASE_URL=https://your-project.supabase.co\n` +
              `   SUPABASE_SERVICE_ROLE_KEY=ey...\n` +
              `   \`\`\`\n` +
              `4. Run this SQL in the Supabase SQL Editor:\n` +
              `   \`\`\`sql\n` +
              `   create table if not exists bot_json_store (\n` +
              `     store_name text primary key,\n` +
              `     payload jsonb not null,\n` +
              `     updated_at timestamptz default now()\n` +
              `   );\n` +
              `   \`\`\``,
            color: COLORS.warning,
            footer: "Zenith Bot Persistence Manager",
          }),
        ],
      });
      return;
    }

    if (!status.connected || !status.tableReady) {
      const isPaused =
        status.error?.toLowerCase().includes("paused") ||
        status.error?.toLowerCase().includes("503") ||
        status.error?.toLowerCase().includes("econnrefused") ||
        status.error?.toLowerCase().includes("fetch failed");

      await interaction.editReply({
        embeds: [
          prettyEmbed({
            title: isPaused ? `${CE.warning.str} Supabase Project Paused` : `${CE.error.str} Supabase Connection Alert`,
            description: isPaused
              ? `Your Supabase project appears to be paused or sleeping. In your [Supabase Dashboard](https://supabase.com/dashboard), click **Restore project** / **Unpause** to re-activate it. Once restored, run \`.db sync\` to immediately sync all local stores to the cloud!`
              : `Supabase environment variables are detected, but table verification encountered an issue.\n\n` +
                buildBullets([
                  { label: "Host", value: `\`${status.urlHost ?? "unknown"}\`` },
                  { label: "Connected", value: status.connected ? `${CE.success.str} Yes` : `${CE.error.str} No` },
                  { label: "Table `bot_json_store`", value: status.tableReady ? `${CE.success.str} Ready` : `${CE.warning.str} Missing` },
                  { label: "Error", value: `\`${status.error ?? "Unknown issue"}\`` },
                ]) +
                `\n\n### ${CE.settings.str} Fix Missing Table:\n` +
                `Run this query in your Supabase SQL Editor:\n` +
                `\`\`\`sql\n` +
                `create table if not exists bot_json_store (\n` +
                `  store_name text primary key,\n` +
                `  payload jsonb not null,\n` +
                `  updated_at timestamptz default now()\n` +
                `);\n` +
                `\`\`\``,
            color: isPaused ? COLORS.warning : COLORS.danger,
            footer: "Zenith Bot Persistence Manager",
          }),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        prettyEmbed({
          title: `${CE.success.str} Supabase Cloud Persistence Active`,
          description:
            `All bot configs, warnings, cases, whitelists, and staff records are securely persisted in Supabase cloud!\n\n` +
            buildBullets([
              { label: "Host", value: `\`${status.urlHost}\`` },
              { label: "Status", value: `${CE.success.str} Connected & Synced` },
              { label: "Table", value: "`bot_json_store` active" },
              { label: "Stored Stores", value: `**${status.storeCount}** collections saved` },
            ]) +
            `\n\n*Tip: Run \`.db sync\` at any time to force-sync all local files to the cloud.*`,
          color: COLORS.success,
          footer: "Zenith Bot Persistence Manager",
        }),
      ],
    });
  },
};

export default command;
