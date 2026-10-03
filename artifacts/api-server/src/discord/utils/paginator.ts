import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type Message,
  type ButtonInteraction,
  type ComponentType,
} from "discord.js";
import { CE, COLORS } from "./embedStyle";
import { logger } from "../../lib/logger";

export interface PaginationOptions {
  timeoutMs?: number;
  ephemeral?: boolean;
  extraRows?: ActionRowBuilder<any>[];
  footerPrefix?: string;
  authorName?: string;
  authorIcon?: string;
}

/**
 * Sends a multi-page paginated embed message with interactive controls.
 */
export async function sendPaginatedEmbed(
  target: ChatInputCommandInteraction | Message,
  pages: EmbedBuilder[],
  options: PaginationOptions = {}
): Promise<Message | null> {
  if (!pages || pages.length === 0) return null;

  const timeoutMs = options.timeoutMs ?? 120_000;
  let currentPage = 0;

  // Single page mode: send without pagination row
  if (pages.length === 1) {
    const singleEmbed = pages[0];
    if (options.footerPrefix && !singleEmbed.data.footer) {
      singleEmbed.setFooter({ text: options.footerPrefix });
    }
    const components = options.extraRows ?? [];
    if ("replied" in target || "deferred" in target) {
      const interaction = target as ChatInputCommandInteraction;
      if (interaction.replied || interaction.deferred) {
        return (await interaction.editReply({ embeds: [singleEmbed], components: components as any })) as Message;
      } else {
        return (await interaction.reply({ embeds: [singleEmbed], components: components as any, ephemeral: options.ephemeral, fetchReply: true })) as Message;
      }
    } else {
      return await target.reply({ embeds: [singleEmbed], components: components as any });
    }
  }

  // Multi-page helper to generate navigation row
  const getNavRow = (pageIdx: number): ActionRowBuilder<ButtonBuilder> => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("page_first")
        .setLabel("First")
        .setEmoji(CE.arrow_anim.id)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIdx === 0),
      new ButtonBuilder()
        .setCustomId("page_prev")
        .setLabel("Back")
        .setEmoji(CE.arrow_yellow.id)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIdx === 0),
      new ButtonBuilder()
        .setCustomId("page_stop")
        .setLabel("Close")
        .setEmoji(CE.trash.id)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("page_next")
        .setLabel("Next")
        .setEmoji(CE.arrow_red.id)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIdx === pages.length - 1),
      new ButtonBuilder()
        .setCustomId("page_last")
        .setLabel("Last")
        .setEmoji(CE.arrow_anim.id)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIdx === pages.length - 1)
    );
  };

  const prepareEmbed = (pageIdx: number): EmbedBuilder => {
    const page = EmbedBuilder.from(pages[pageIdx]);
    const footerText = options.footerPrefix
      ? `${options.footerPrefix} • Page ${pageIdx + 1} of ${pages.length}`
      : `Page ${pageIdx + 1} of ${pages.length}`;
    page.setFooter({ text: footerText });
    return page;
  };

  const components = [getNavRow(currentPage), ...(options.extraRows ?? [])];

  let replyMsg: Message;
  if ("replied" in target || "deferred" in target) {
    const interaction = target as ChatInputCommandInteraction;
    if (interaction.replied || interaction.deferred) {
      replyMsg = (await interaction.editReply({
        embeds: [prepareEmbed(currentPage)],
        components: components as any,
      })) as Message;
    } else {
      replyMsg = (await interaction.reply({
        embeds: [prepareEmbed(currentPage)],
        components: components as any,
        ephemeral: options.ephemeral,
        fetchReply: true,
      })) as Message;
    }
  } else {
    replyMsg = await target.reply({
      embeds: [prepareEmbed(currentPage)],
      components: components as any,
    });
  }

  if (!replyMsg || typeof replyMsg.createMessageComponentCollector !== "function") return replyMsg ?? null;

  const collector = replyMsg.createMessageComponentCollector({
    time: timeoutMs,
  });

  collector.on("collect", async (interaction: ButtonInteraction) => {
    // Only allow command invoker or admins to navigate
    const invokerId = "user" in target ? target.user.id : target.author.id;
    if (interaction.user.id !== invokerId) {
      await interaction.reply({
        content: `${CE.failure.str} Only the user who ran this command can navigate pages.`,
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    await interaction.deferUpdate().catch(() => {});

    switch (interaction.customId) {
      case "page_first":
        currentPage = 0;
        break;
      case "page_prev":
        if (currentPage > 0) currentPage--;
        break;
      case "page_next":
        if (currentPage < pages.length - 1) currentPage++;
        break;
      case "page_last":
        currentPage = pages.length - 1;
        break;
      case "page_stop":
        collector.stop("user_dismiss");
        return;
    }

    const updatedComponents = [getNavRow(currentPage) as any, ...(options.extraRows ?? []) as any];
    await interaction.editReply({
      embeds: [prepareEmbed(currentPage)],
      components: updatedComponents as any,
    }).catch(() => {});
  });

  collector.on("end", async (_, reason) => {
    try {
      if (reason === "user_dismiss") {
        await replyMsg.delete().catch(() => {});
      } else {
        // Disable navigation buttons on collector timeout
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("page_first").setLabel("First").setEmoji(CE.arrow_anim.id).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("page_prev").setLabel("Back").setEmoji(CE.arrow_yellow.id).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId("page_stop").setLabel("Closed").setEmoji(CE.trash.id).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("page_next").setLabel("Next").setEmoji(CE.arrow_red.id).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId("page_last").setLabel("Last").setEmoji(CE.arrow_anim.id).setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await replyMsg.edit({
          components: [disabledRow as any, ...(options.extraRows ?? [] as any) as any],
        }).catch(() => {});
      }
    } catch (err) {
      logger.debug({ err }, "Error ending paginator collector");
    }
  });

  return replyMsg;
}

/**
 * Utility function to build page embeds from an array of text items or lines.
 */
export function buildPaginatedPages<T>(
  title: string,
  items: T[],
  itemsPerPage: number,
  formatter: (item: T, globalIndex: number) => string,
  color: number = COLORS.primary,
  headerDescription = ""
): EmbedBuilder[] {
  if (!items || items.length === 0) {
    return [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${headerDescription}\n\n*No items found.*`)
        .setColor(color),
    ];
  }

  const pageCount = Math.ceil(items.length / itemsPerPage);
  const pages: EmbedBuilder[] = [];

  for (let p = 0; p < pageCount; p++) {
    const chunk = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
    const lines = chunk.map((item, idx) => formatter(item, p * itemsPerPage + idx));
    const description = `${headerDescription ? headerDescription + "\n\n" : ""}${lines.join("\n")}`;

    pages.push(
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(description.slice(0, 4096))
        .setColor(color)
    );
  }

  return pages;
}
