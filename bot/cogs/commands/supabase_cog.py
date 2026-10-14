from __future__ import annotations
import discord
from discord.ext import commands
import os
import json
from datetime import datetime

from core import Cog, Context
from utils.config import OWNER_IDS
from utils.supabase_storage import supabase_storage

class SupabaseCog(Cog, name="Supabase"):
    """Cloud persistence and backup controls powered by Supabase Storage."""

    def __init__(self, bot):
        self.bot = bot

    def _is_owner_check(self, ctx: Context) -> bool:
        return ctx.author.id in OWNER_IDS or ctx.author.id == self.bot.owner_id

    @commands.group(name="supabase", aliases=["cloudstorage", "dbbackup"], invoke_without_command=True)
    async def supabase_group(self, ctx: Context):
        """Supabase Storage persistence commands for bot owners."""
        if not self._is_owner_check(ctx):
            return await ctx.reply("❌ Only bot owners can access Supabase Storage controls.")

        embed = discord.Embed(
            title="☁️ Zenith Supabase Storage & Persistence",
            description="Manage cloud backups and automated state sync with Supabase.",
            color=0x2b2d31,
            timestamp=datetime.utcnow()
        )
        embed.add_field(name="`+supabase backup`", value="Trigger an immediate backup of all SQLite databases and JSON stores to Supabase.", inline=False)
        embed.add_field(name="`+supabase restore`", value="Restore missing SQLite databases and JSON configs from Supabase.", inline=False)
        embed.add_field(name="`+supabase status`", value="View current Supabase Storage bucket status and remote file count.", inline=False)
        embed.set_footer(text="Zenith Cloud Persistence Engine")
        await ctx.reply(embed=embed)

    @supabase_group.command(name="backup")
    async def supabase_backup(self, ctx: Context):
        """Immediately back up all bot databases and JSON state to Supabase Storage."""
        if not self._is_owner_check(ctx):
            return await ctx.reply("❌ Only bot owners can run this command.")

        status_msg = await ctx.reply("⏳ Uploading databases and JSON stores to Supabase Storage...")

        try:
            res = await self.bot.loop.run_in_executor(None, supabase_storage.backup_databases, ".")
            succeeded = len(res.get("success", []))
            failed = len(res.get("failed", []))

            embed = discord.Embed(
                title="☁️ Supabase Cloud Backup Completed",
                color=0x22c55e if failed == 0 else 0xeab308,
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="Bucket", value=f"`{supabase_storage.bucket}`", inline=True)
            embed.add_field(name="Synced Files", value=f"**{succeeded}**", inline=True)
            embed.add_field(name="Failures", value=f"**{failed}**", inline=True)

            sample_synced = res.get("success", [])[:6]
            if sample_synced:
                embed.add_field(name="Sample Synced", value="\n".join(f"• `{p}`" for p in sample_synced), inline=False)

            await status_msg.edit(content=None, embed=embed)
        except Exception as e:
            await status_msg.edit(content=f"❌ Backup failed with error: `{e}`")

    @supabase_group.command(name="restore")
    async def supabase_restore(self, ctx: Context):
        """Restores any missing databases or JSON state from Supabase Storage."""
        if not self._is_owner_check(ctx):
            return await ctx.reply("❌ Only bot owners can run this command.")

        status_msg = await ctx.reply("⏳ Checking and restoring databases from Supabase Storage...")

        try:
            res = await self.bot.loop.run_in_executor(None, supabase_storage.restore_databases, ".")
            restored = len(res.get("restored", []))
            skipped = len(res.get("skipped", []))
            failed = len(res.get("failed", []))

            embed = discord.Embed(
                title="☁️ Supabase Cloud Restore Completed",
                color=0x22c55e if failed == 0 else 0xef4444,
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="Restored Files", value=f"**{restored}**", inline=True)
            embed.add_field(name="Already Present", value=f"**{skipped}**", inline=True)
            embed.add_field(name="Failures", value=f"**{failed}**", inline=True)

            if res.get("restored"):
                embed.add_field(name="Restored Items", value="\n".join(f"• `{p}`" for p in res["restored"][:8]), inline=False)

            await status_msg.edit(content=None, embed=embed)
        except Exception as e:
            await status_msg.edit(content=f"❌ Restore failed with error: `{e}`")

    @supabase_group.command(name="status")
    async def supabase_status(self, ctx: Context):
        """Shows Supabase Storage connection and backup statistics."""
        if not self._is_owner_check(ctx):
            return await ctx.reply("❌ Only bot owners can run this command.")

        status_msg = await ctx.reply("⏳ Querying Supabase Storage status...")

        try:
            files = await self.bot.loop.run_in_executor(None, supabase_storage.list_files, "")
            total_size_bytes = sum(f.get("metadata", {}).get("size", 0) for f in files if isinstance(f, dict))
            total_size_mb = total_size_bytes / (1024 * 1024)

            embed = discord.Embed(
                title="☁️ Supabase Storage Status",
                color=0x3b82f6,
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="Target Bucket", value=f"`{supabase_storage.bucket}`", inline=True)
            embed.add_field(name="Remote Objects", value=f"**{len(files)}** files", inline=True)
            embed.add_field(name="Total Cloud Size", value=f"**{total_size_mb:.2f} MB**", inline=True)

            last_backup = supabase_storage.last_backup_time
            last_b_str = last_backup.strftime("%Y-%m-%d %H:%M:%S UTC") if last_backup else "None in current session"
            embed.add_field(name="Last Session Backup", value=f"`{last_b_str}`", inline=False)

            await status_msg.edit(content=None, embed=embed)
        except Exception as e:
            await status_msg.edit(content=f"❌ Status check failed: `{e}`")


async def setup(bot):
    await bot.add_cog(SupabaseCog(bot))
