import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { isWhitelisted, type WhitelistedCommand } from "../storage/whitelist";
import { isPermanentOwner, isBotAdmin } from "../storage/premium";
import { isBotStaff } from "../storage/botStaff";
import { getGuildConfig } from "../storage/config";
import { isManager } from "./staffPerms";

/**
 * Checks if the invoking user is allowed to run a restricted command.
 * Server owners, administrators, bot owners, bot staff, server managers,
 * users with native Discord moderation permissions, and whitelisted users are allowed.
 * Replies with an ephemeral denial message and returns false if not allowed.
 */
export async function ensureWhitelisted(
  interaction: ChatInputCommandInteraction,
  command: WhitelistedCommand,
): Promise<boolean> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return false;
  }

  const userId = interaction.user.id;

  // 1. Permanent bot owner is always allowed
  if (isPermanentOwner(userId)) {
    return true;
  }

  // 2. Bot administrators and staff are always allowed
  if (isBotAdmin(userId) || (await isBotStaff(userId))) {
    return true;
  }

  // 3. Server owner is always allowed in their own server
  const isOwner = interaction.guild?.ownerId === userId;
  if (isOwner) {
    return true;
  }

  // 4. Server administrators are always allowed
  const member = interaction.member as GuildMember | null;
  const isAdmin =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    false;

  if (isAdmin) {
    return true;
  }

  // 5. Server managers configured in the bot are allowed
  try {
    if (await isManager(interaction)) {
      return true;
    }
  } catch {}

  // 6. Check native Discord moderation permissions for specific command families
  if (member?.permissions) {
    const cmdStr = String(command).toLowerCase();
    if (cmdStr === "kick" && member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return true;
    }
    if ((cmdStr === "ban" || cmdStr === "unban") && member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return true;
    }
    if ((cmdStr === "mute" || cmdStr === "unmute" || cmdStr === "timeout" || cmdStr === "untimeout") && member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return true;
    }
    if ((cmdStr === "purge" || cmdStr === "warn" || cmdStr === "unwarn" || cmdStr === "slowmode" || cmdStr === "lock" || cmdStr === "unlock") && (member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.ManageChannels))) {
      return true;
    }
    if ((cmdStr === "rolegive" || cmdStr === "roleremove" || cmdStr === "role") && member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return true;
    }
  }

  // 7. Check database whitelist
  const allowed = await isWhitelisted(
    command,
    interaction.guildId,
    userId,
  );
  if (!allowed) {
    await interaction.reply({
      content: `You aren't authorized to use \`/${command}\`. You need the required moderation permission or to be whitelisted via \`/whitelist-${command} add\`.`,
      ephemeral: true,
    });
    return false;
  }
  return true;
}
