import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { PERM_WHITELIST } from "../storage/whitelist";
import { getPullableMemberCount, getPullableMembers } from "../storage/pullable-members";
import { CE } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("pullable")
    .setDescription("Show number of pullable members (global whitelist only)")
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!PERM_WHITELIST.has(interaction.user.id)) {
      await interaction.reply({
        content: "You aren't allowed to use this command.",
        ephemeral: true,
      });
      return;
    }

    const count = await getPullableMemberCount();

    if (count === 0) {
      await interaction.reply({
        content: `${CE.information.str} **0** pullable members available.`,
        ephemeral: true,
      });
      return;
    }

    // Get some details about the members
    const members = await getPullableMembers();
    const recentMembers = members.slice(-5).reverse(); // Last 5, most recent first

    const memberList = recentMembers
      .map(m => `• **${m.username}** (${m.userId}) - ${new Date(m.verifiedAt).toLocaleDateString()}`)
      .join("\n");

    await interaction.reply({
      content: `${CE.information.str} **${count}** pullable member${count === 1 ? "" : "s"} available.\n\nRecent members:\n${memberList}`,
      ephemeral: true,
    });
  },
};

export default command;