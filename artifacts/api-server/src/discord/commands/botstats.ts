import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildStats } from "../storage/stats";
import { getGuildConfig } from "../storage/config";
import { renderStatsCard } from "../utils/statsRenderer";
import { CE, prettyEmbed, COLORS } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("botstats")
    .setDescription("View bot automations vs community member activity breakdown as an image."),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const cfg = await getGuildConfig(guild.id);
    const statsData = await getGuildStats(guild.id);

    const isStatsEnabled = cfg.modules.stats ?? statsData.enabled ?? true;
    if (!isStatsEnabled) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Stats Module Disabled`,
            description: `The **Stats Module** is disabled on **${guild.name}**.\nEnable it in **.config** under **Analytics & Stats** to use this command!`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    let botMsgs = 0;
    let memberMsgs = 0;
    let botCount = 0;

    for (const [uid, cnt] of Object.entries(statsData.userMessages)) {
      const m = guild.members.cache.get(uid);
      if (m?.user.bot) {
        botMsgs += cnt;
        botCount++;
      } else {
        memberMsgs += cnt;
      }
    }

    const totalMsgs = botMsgs + memberMsgs;
    const botPct = totalMsgs > 0 ? ((botMsgs / totalMsgs) * 100).toFixed(1) : "0";
    const memberPct = totalMsgs > 0 ? ((memberMsgs / totalMsgs) * 100).toFixed(1) : "100";

    const botVsMemberBars = [
      { label: "Community Members", value: memberMsgs },
      { label: "Bot Automations", value: botMsgs },
    ];

    const imgBuffer = await renderStatsCard({
      categoryTitle: "AUTOMATION & BOT ANALYTICS",
      mainTitle: "Bot Traffic vs Human Activity",
      subtitle: `Guild Traffic Attribution • Total Tracked: ${totalMsgs}`,
      guildName: guild.name,
      items: [
        { label: "Member Messages", value: memberMsgs.toLocaleString(), sub: `${memberPct}% of traffic` },
        { label: "Bot Messages", value: botMsgs.toLocaleString(), sub: `${botPct}% of traffic` },
        { label: "Active Bots", value: botCount.toString(), sub: "Cached bot accounts" },
        { label: "Guild Size", value: guild.memberCount.toLocaleString(), sub: "Total server accounts" },
      ],
      bars: botVsMemberBars,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Bot vs Member volume breakdown template • Zenith Analytics`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-bot-${guild.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
