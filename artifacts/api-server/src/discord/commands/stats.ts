import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildStats, getLast7Days } from "../storage/stats";
import { getGuildConfig } from "../storage/config";
import { renderStatsCard } from "../utils/statsRenderer";
import { CE, prettyEmbed, COLORS } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View visual template cards with server activity, user/role message stats, and join/leave graphs.")
    .addSubcommand((sub) =>
      sub
        .setName("server")
        .setDescription("View comprehensive server activity, traffic breakdown, and hourly heatmaps as an image.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("user")
        .setDescription("View detailed message activity stats and rank for a user.")
        .addUserOption((o) => o.setName("target").setDescription("User to view stats for").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("View message activity breakdown and message volume produced by members with a role.")
        .addRoleOption((o) => o.setName("role").setDescription("Role to view message stats for").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("flow")
        .setDescription("View 7-day join & leave flow graphs and member velocity as a generated image.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("top")
        .setDescription("View top users and channels by message activity.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("View message volume and activity breakdown for a specific channel.")
        .addChannelOption((o) => o.setName("target").setDescription("Channel to view stats for").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("hourly")
        .setDescription("View 24-hour server traffic heatmap and peak hours breakdown as an image.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("bot")
        .setDescription("View automated bot activity vs community member traffic breakdown.")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const cfg = await getGuildConfig(guild.id);
    const statsData = await getGuildStats(guild.id);

    // Gating check: ensure Stats module is enabled in .config
    const isStatsEnabled = cfg.modules.stats ?? statsData.enabled ?? true;
    if (!isStatsEnabled) {
      await interaction.reply({
        embeds: [
          prettyEmbed({
            title: `${CE.error.str} Stats Module Disabled`,
            description: `The **Stats Module** is currently disabled on **${guild.name}**.\nEnable it in the **.config** menu to activate real-time server tracking and analytics commands!`,
            color: COLORS.danger,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const sub = interaction.options.getSubcommand(false) || "server";

    if (sub === "user") {
      const targetUser = interaction.options.getUser("target") || interaction.user;
      const totalUserMsgs = statsData.userMessages[targetUser.id] || 0;

      // Calculate user ranking
      const allUsersSorted = Object.entries(statsData.userMessages).sort((a, b) => b[1] - a[1]);
      const rankIdx = allUsersSorted.findIndex(([uid]) => uid === targetUser.id);
      const rankStr = rankIdx >= 0 ? `#${rankIdx + 1} of ${allUsersSorted.length}` : "Unranked";

      // Last 7 days breakdown for user
      const days = getLast7Days();
      const dailyBars = days.map((d) => ({
        label: d.slice(5),
        value: statsData.userDaily[d]?.[targetUser.id] || 0,
      }));

      const totalGuildMsgs = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);
      const sharePercent = totalGuildMsgs > 0 ? ((totalUserMsgs / totalGuildMsgs) * 100).toFixed(1) : "0";

      const imgBuffer = await renderStatsCard({
        categoryTitle: "USER MESSAGE ANALYTICS",
        mainTitle: `${targetUser.username}'s Activity Profile`,
        subtitle: `Server Contributor Insights • ID: ${targetUser.id}`,
        guildName: guild.name,
        items: [
          { label: "Total Messages", value: totalUserMsgs.toLocaleString(), sub: "Tracked server messages" },
          { label: "Server Rank", value: rankStr, sub: "Message leaderboard" },
          { label: "Activity Share", value: `${sharePercent}%`, sub: "Of all guild messages" },
          { label: "Status", value: targetUser.bot ? "Bot User" : "Community Member", sub: "Account category" },
        ],
        bars: dailyBars,
        hourlyActivity: statsData.hourlyActivity,
        footerNote: `Real-time activity profile for @${targetUser.username} • Generated via Canvas`,
      });

      const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-user-${targetUser.id}.png` });
      await interaction.editReply({ files: [attachment] });
      return;
    }

    if (sub === "role") {
      const role = interaction.options.getRole("role", true);
      const days = getLast7Days();
      const dailyBars = days.map((d) => ({
        label: d.slice(5),
        value: statsData.roleDaily[d]?.[role.id] || 0,
      }));

      const totalRoleMsgs = dailyBars.reduce((a, b) => a + b.value, 0);
      const roleMemberCount = (guild.roles.cache.get(role.id) as any)?.members?.size ?? 0;
      const avgPerMember = roleMemberCount > 0 ? (totalRoleMsgs / roleMemberCount).toFixed(1) : "0";

      const imgBuffer = await renderStatsCard({
        categoryTitle: "ROLE ENGAGEMENT ANALYTICS",
        mainTitle: `@${role.name} Activity Breakdown`,
        subtitle: `Role Group Insights • Role ID: ${role.id}`,
        guildName: guild.name,
        items: [
          { label: "Role Members", value: roleMemberCount.toLocaleString(), sub: "Assigned guild members" },
          { label: "7-Day Messages", value: totalRoleMsgs.toLocaleString(), sub: "Messages sent by role" },
          { label: "Avg / Member", value: avgPerMember, sub: "Activity per member" },
          { label: "Role Color", value: role.hexColor.toUpperCase(), sub: "Discord role accent" },
        ],
        bars: dailyBars,
        hourlyActivity: statsData.hourlyActivity,
        footerNote: `Real-time role activity graph for @${role.name} • Zenith Intelligence`,
      });

      const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-role-${role.id}.png` });
      await interaction.editReply({ files: [attachment] });
      return;
    }

    if (sub === "flow") {
      const days = getLast7Days();
      const joinBars = days.map((d) => {
        const joins = statsData.joinsDaily[d] || 0;
        const leaves = statsData.leavesDaily[d] || 0;
        return {
          label: `${d.slice(5)} (+${joins}/-${leaves})`,
          value: joins,
        };
      });

      const totalJoins = Object.values(statsData.joinsDaily).reduce((a, b) => a + b, 0);
      const totalLeaves = Object.values(statsData.leavesDaily).reduce((a, b) => a + b, 0);
      const netGrowth = totalJoins - totalLeaves;

      const imgBuffer = await renderStatsCard({
        categoryTitle: "MEMBER RETENTION & FLOW",
        mainTitle: "Server Join & Leave Trajectory",
        subtitle: `7-Day Community Growth Rate • Current Members: ${guild.memberCount}`,
        guildName: guild.name,
        items: [
          { label: "Current Members", value: guild.memberCount.toLocaleString(), sub: "Total guild population" },
          { label: "Total Joins", value: `+${totalJoins}`, sub: "Tracked new joins" },
          { label: "Total Leaves", value: `-${totalLeaves}`, sub: "Tracked member departures" },
          { label: "Net Growth", value: `${netGrowth >= 0 ? "+" : ""}${netGrowth}`, sub: "Net community flow" },
        ],
        bars: joinBars,
        footerNote: `7-Day Join/Leave velocity curve for ${guild.name} • Generated automatically`,
      });

      const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-flow-${guild.id}.png` });
      await interaction.editReply({ files: [attachment] });
      return;
    }

    if (sub === "top") {
      const sortedUsers = Object.entries(statsData.userMessages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([uid, cnt]) => {
          const user = guild.members.cache.get(uid)?.user;
          return {
            label: user ? `@${user.username}` : `User ${uid.slice(0, 8)}`,
            value: cnt,
          };
        });

      const totalTracked = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);

      const imgBuffer = await renderStatsCard({
        categoryTitle: "TOP ENGAGEMENT LEADERBOARD",
        mainTitle: "Most Active Community Members",
        subtitle: "Ranked by Recorded Message Volume",
        guildName: guild.name,
        items: [
          { label: "Tracked Messages", value: totalTracked.toLocaleString(), sub: "Across all channels" },
          { label: "Active Contributors", value: Object.keys(statsData.userMessages).length.toLocaleString(), sub: "Unique authors" },
          { label: "#1 Contributor", value: sortedUsers[0] ? sortedUsers[0].label : "None", sub: sortedUsers[0] ? `${sortedUsers[0].value} msgs` : "0 msgs" },
          { label: "Server Guild", value: guild.name, sub: "Zenith Community" },
        ],
        bars: sortedUsers,
        hourlyActivity: statsData.hourlyActivity,
        footerNote: `Leaderboard ranking for ${guild.name} • Zenith Intelligence Template`,
      });

      const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-top-${guild.id}.png` });
      await interaction.editReply({ files: [attachment] });
      return;
    }

    if (sub === "channel") {
      const targetCh = interaction.options.getChannel("target") || interaction.channel;
      const targetChId = targetCh ? targetCh.id : interaction.channelId;
      const targetChName = (targetCh as any)?.name || "channel";

      const days = getLast7Days();
      const dailyBars = days.map((d) => ({
        label: d.slice(5),
        value: statsData.channelDaily[d]?.[targetChId] || 0,
      }));

      const totalChMsgs = dailyBars.reduce((a, b) => a + b.value, 0);
      const totalGuildMsgs = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);
      const sharePct = totalGuildMsgs > 0 ? ((totalChMsgs / totalGuildMsgs) * 100).toFixed(1) : "0";

      const imgBuffer = await renderStatsCard({
        categoryTitle: "CHANNEL ENGAGEMENT ANALYTICS",
        mainTitle: `#${targetChName} Activity Profile`,
        subtitle: `Channel Insights • ID: ${targetChId}`,
        guildName: guild.name,
        items: [
          { label: "Channel Msgs", value: totalChMsgs.toLocaleString(), sub: "Last 7 days volume" },
          { label: "Guild Share", value: `${sharePct}%`, sub: "Of overall server talk" },
          { label: "Channel Type", value: targetCh ? String((targetCh as any).type ?? "Text") : "Text", sub: "Discord channel kind" },
          { label: "Tracked Days", value: "7 Days", sub: "Rolling analytics window" },
        ],
        bars: dailyBars,
        hourlyActivity: statsData.hourlyActivity,
        footerNote: `Channel activity template for #${targetChName} • Zenith Analytics`,
      });

      const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-channel-${targetChId}.png` });
      await interaction.editReply({ files: [attachment] });
      return;
    }

    if (sub === "hourly" || sub === "activity") {
      const hourly = statsData.hourlyActivity || new Array(24).fill(0);
      let maxVal = -1;
      let peakHour = 0;
      let minVal = Infinity;
      let quietHour = 0;

      for (let h = 0; h < 24; h++) {
        const v = hourly[h] || 0;
        if (v > maxVal) { maxVal = v; peakHour = h; }
        if (v < minVal) { minVal = v; quietHour = h; }
      }

      const total24h = hourly.reduce((a, b) => a + b, 0);

      const imgBuffer = await renderStatsCard({
        categoryTitle: "24-HOUR TRAFFIC TIMELINE",
        mainTitle: "Server Traffic & Peak Activity",
        subtitle: `Hourly Activity Heatmap • Current Members: ${guild.memberCount}`,
        guildName: guild.name,
        items: [
          { label: "Peak Hour", value: `${peakHour.toString().padStart(2, "0")}:00 UTC`, sub: `${maxVal} peak messages` },
          { label: "Quiet Hour", value: `${quietHour.toString().padStart(2, "0")}:00 UTC`, sub: `${minVal === Infinity ? 0 : minVal} quiet messages` },
          { label: "24h Volume", value: total24h.toLocaleString(), sub: "Messages in rolling 24h" },
          { label: "Total Members", value: guild.memberCount.toLocaleString(), sub: "Community size" },
        ],
        hourlyActivity: hourly,
        footerNote: `24-Hour hourly distribution heatmap for ${guild.name} • Zenith Intelligence Engine`,
      });

      const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-hourly-${guild.id}.png` });
      await interaction.editReply({ files: [attachment] });
      return;
    }

    if (sub === "bot") {
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
      return;
    }

    // Default: "server" overview
    const totalMsgs = Object.values(statsData.userMessages).reduce((a, b) => a + b, 0);
    const totalActiveUsers = Object.keys(statsData.userMessages).length;
    const channelsCount = guild.channels.cache.size;

    const days = getLast7Days();
    const serverDailyBars = days.map((d) => {
      const dailyMap = statsData.channelDaily[d] || {};
      const sum = Object.values(dailyMap).reduce((a, b) => a + b, 0);
      return {
        label: d.slice(5),
        value: sum,
      };
    });

    const imgBuffer = await renderStatsCard({
      categoryTitle: "SERVER ACTIVITY INTELLIGENCE",
      mainTitle: `${guild.name} Analytics Overview`,
      subtitle: `Realtime Server Metrics & 24h Heatmap • Total Members: ${guild.memberCount}`,
      guildName: guild.name,
      items: [
        { label: "Total Messages", value: totalMsgs.toLocaleString(), sub: "Historical message logs" },
        { label: "Active Writers", value: totalActiveUsers.toLocaleString(), sub: "Unique message posters" },
        { label: "Total Channels", value: channelsCount.toLocaleString(), sub: "Voice & text channels" },
        { label: "Server Size", value: guild.memberCount.toLocaleString(), sub: "Total cached members" },
      ],
      bars: serverDailyBars,
      hourlyActivity: statsData.hourlyActivity,
      footerNote: `Live server analytics dashboard template for ${guild.name} • Zenith High-Fi Core`,
    });

    const attachment = new AttachmentBuilder(imgBuffer, { name: `stats-overview-${guild.id}.png` });
    await interaction.editReply({ files: [attachment] });
  },
};

export default command;
