# ╔══════════════════════════════════════════════════════════════════╗
# ║                                                                  ║
# ║   ░█▀▀░█▀█░█▀▄░█▀▀░█░█   ░█▀▄░█▀▀░█░█░█▀▀                     ║
# ║   ░█░░░█░█░█░█░█▀▀░▄▀▄   ░█░█░█▀▀░▀▄▀░▀▀█                     ║
# ║   ░▀▀▀░▀▀▀░▀▀░░▀▀▀░▀░▀   ░▀▀░░▀▀▀░░▀░░▀▀▀                     ║
# ║                                                                  ║
# ║            © 2026 Zenith Development — All Rights Reserved       ║
# ║                                                                  ║
# ║   discord  ──  https://discord.gg/WqJGXrQX4                      ║
# ╚══════════════════════════════════════════════════════════════════╝

from __future__ import annotations
import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import os
from typing import Optional, Dict, Any
from datetime import datetime

from core import Cog, Context, zyrox
from utils.config import OWNER_IDS, BRAND_NAME
from utils.emoji import (
    ACTIVE_DEVELOPER, BLACKCROWN, STAFF, PARTNER_BADGE, NITRO_BOOST,
    STAR, BUG_HUNTER, EARLY_SUPPORTER, REDHEART, CERTIFIED_MODERATOR,
    TICK, CROSS
)

DB_PATH = os.path.join("db", "badges.db")

# 10 Custom Zenith Bot Badges with icons exclusively from bot emojis
BOT_BADGES: Dict[str, Dict[str, str]] = {
    "developer": {
        "name": "Main Developer",
        "emoji": str(ACTIVE_DEVELOPER),
        "description": "Architect & Core Developer of Zenith",
    },
    "owner": {
        "name": "Zenith Founder",
        "emoji": str(BLACKCROWN),
        "description": "Creator & Supreme Owner of Zenith",
    },
    "staff": {
        "name": "Zenith Staff",
        "emoji": str(STAFF),
        "description": "Official Management & Staff Team",
    },
    "partner": {
        "name": "Zenith Partner",
        "emoji": str(PARTNER_BADGE),
        "description": "Affiliated Community Partner",
    },
    "booster": {
        "name": "Elite Booster",
        "emoji": str(NITRO_BOOST),
        "description": "Server Booster & Patron of Zenith",
    },
    "vip": {
        "name": "Zenith VIP",
        "emoji": str(STAR),
        "description": "Very Important Person in the Zenith Ecosystem",
    },
    "bughunter": {
        "name": "Bug Hunter",
        "emoji": str(BUG_HUNTER),
        "description": "Reported critical bugs & security vulnerabilities",
    },
    "early": {
        "name": "Early Supporter",
        "emoji": str(EARLY_SUPPORTER),
        "description": "Supported Zenith since initial release",
    },
    "family": {
        "name": "Zenith Family",
        "emoji": str(REDHEART),
        "description": "Trusted Associate & Family Member",
    },
    "moderator": {
        "name": "Certified Moderator",
        "emoji": str(CERTIFIED_MODERATOR),
        "description": "Certified Community Moderator",
    }
}


def init_db():
    os.makedirs("db", exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS badges (user_id INTEGER PRIMARY KEY)")
        for b in BOT_BADGES.keys():
            try:
                c.execute(f"ALTER TABLE badges ADD COLUMN {b} INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass
        # Automatically award all badges to the Main Developer
        cols = ", ".join(BOT_BADGES.keys())
        placeholders = ", ".join(["1"] * len(BOT_BADGES))
        c.execute(
            f"INSERT INTO badges (user_id, {cols}) VALUES (1181221352393420856, {placeholders}) "
            f"ON CONFLICT(user_id) DO UPDATE SET " + ", ".join([f"{k}=1" for k in BOT_BADGES.keys()])
        )
        conn.commit()


def get_user_badges(user_id: int) -> Dict[str, int]:
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM badges WHERE user_id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            return {}
        col_names = [d[0] for d in c.description]
        return dict(zip(col_names, row))


def set_user_badge(user_id: int, badge_key: str, value: int = 1) -> bool:
    if badge_key not in BOT_BADGES:
        return False
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("SELECT 1 FROM badges WHERE user_id = ?", (user_id,))
        if c.fetchone() is None:
            c.execute(f"INSERT INTO badges (user_id, {badge_key}) VALUES (?, ?)", (user_id, value))
        else:
            c.execute(f"UPDATE badges SET {badge_key} = ? WHERE user_id = ?", (value, user_id))
        conn.commit()
    return True


def set_all_badges(user_id: int, value: int = 1):
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("SELECT 1 FROM badges WHERE user_id = ?", (user_id,))
        cols = ", ".join(BOT_BADGES.keys())
        if c.fetchone() is None:
            placeholders = ", ".join([str(value)] * len(BOT_BADGES))
            c.execute(f"INSERT INTO badges (user_id, {cols}) VALUES (?, {placeholders})", (user_id,))
        else:
            sets = ", ".join([f"{k} = {value}" for k in BOT_BADGES.keys()])
            c.execute(f"UPDATE badges SET {sets} WHERE user_id = ?", (user_id,))
        conn.commit()


class Badges(Cog, name="Badges"):
    """Comprehensive Zenith Bot Badge management system."""

    def __init__(self, bot: zyrox):
        self.bot = bot
        init_db()

    def _is_owner_or_staff(self, ctx: Context) -> bool:
        return ctx.author.id in OWNER_IDS or ctx.author.id == self.bot.owner_id or ctx.author.id == 1181221352393420856

    @commands.group(name="badge", aliases=["badges", "bdg"], invoke_without_command=True)
    async def badge_group(self, ctx: Context, *, member: Optional[discord.Member] = None):
        """Displays user badges or shows badge management menu."""
        if member:
            return await self.show_badge_profile(ctx, member)

        embed = discord.Embed(
            title=f"🎖️ {BRAND_NAME} Bot Badges System",
            description=(
                f"Explore and manage exclusive **{BRAND_NAME}** custom profile badges.\n\n"
                f"**Available Commands:**\n"
                f"`{ctx.prefix}badge list` — View all bot badges and their icons\n"
                f"`{ctx.prefix}badge show [user]` — View a user's badges\n"
                f"`{ctx.prefix}badge add <user> <badge>` — Give a badge to a member\n"
                f"`{ctx.prefix}badge remove <user> <badge>` — Remove a badge\n"
                f"`{ctx.prefix}badge all give <user>` — Award all badges to a user\n"
                f"`{ctx.prefix}badge clear <user>` — Remove all badges from a user"
            ),
            color=0x2b2d31,
            timestamp=datetime.utcnow()
        )
        embed.set_footer(text=f"Zenith Identity System • Requested by {ctx.author.name}")
        await ctx.reply(embed=embed)

    @badge_group.command(name="list")
    async def badge_list(self, ctx: Context):
        """Lists all available bot badges with their official icons and descriptions."""
        embed = discord.Embed(
            title=f"🎖️ {BRAND_NAME} Official Badges Catalog",
            description="These exclusive badges are assigned to distinguished community members and developers.",
            color=0x5865F2,
            timestamp=datetime.utcnow()
        )

        for key, data in BOT_BADGES.items():
            embed.add_field(
                name=f"{data['emoji']} {data['name']} (`{key}`)",
                value=f"> {data['description']}",
                inline=False
            )

        embed.set_footer(text=f"Total Badges: {len(BOT_BADGES)} • Use {ctx.prefix}badge add <user> <key> to assign")
        await ctx.reply(embed=embed)

    @badge_group.command(name="show", aliases=["profile"])
    async def badge_show(self, ctx: Context, *, member: Optional[discord.Member] = None):
        """Displays a user's earned bot badges."""
        target = member or ctx.author
        await self.show_badge_profile(ctx, target)

    async def show_badge_profile(self, ctx: Context, member: discord.Member):
        badges_data = get_user_badges(member.id)
        active_badges = [
            (key, BOT_BADGES[key])
            for key in BOT_BADGES.keys()
            if badges_data.get(key) == 1
        ]

        embed = discord.Embed(
            title=f"🎖️ Badges Profile — {member.display_name}",
            color=member.color if member.color.value else 0x5865F2,
            timestamp=datetime.utcnow()
        )
        embed.set_thumbnail(url=member.display_avatar.url)

        if active_badges:
            badge_icons = " ".join(b[1]["emoji"] for b in active_badges)
            embed.description = f"### {badge_icons}\n\n**Earned Badges ({len(active_badges)}/{len(BOT_BADGES)}):**\n"
            for key, bdata in active_badges:
                is_main_dev = (key == "developer" and member.id == 1181221352393420856)
                extra = " *(Main Dev)*" if is_main_dev else ""
                embed.description += f"• {bdata['emoji']} **{bdata['name']}**{extra} — *{bdata['description']}*\n"
        else:
            embed.description = f"{member.mention} currently has no {BRAND_NAME} bot badges.\nParticipate in the community to earn badges!"

        embed.set_footer(text=f"User ID: {member.id} • Zenith Identity")
        await ctx.reply(embed=embed)

    @badge_group.command(name="add")
    async def badge_add(self, ctx: Context, member: discord.Member, *, badge: str):
        """Gives a badge to a member."""
        if not self._is_owner_or_staff(ctx):
            return await ctx.reply(f"{CROSS} Only bot developers and staff can assign badges.")

        badge_key = badge.lower().replace(" ", "").replace("_", "")
        # Fuzzy match
        matched_key = None
        for k in BOT_BADGES.keys():
            if k == badge_key or badge_key in k or badge_key in BOT_BADGES[k]["name"].lower():
                matched_key = k
                break

        if not matched_key:
            available = ", ".join(f"`{k}`" for k in BOT_BADGES.keys())
            return await ctx.reply(f"{CROSS} Unknown badge `{badge}`. Available: {available}")

        set_user_badge(member.id, matched_key, 1)
        binfo = BOT_BADGES[matched_key]
        embed = discord.Embed(
            description=f"{TICK} Successfully awarded {binfo['emoji']} **{binfo['name']}** badge to {member.mention}!",
            color=0x22c55e
        )
        await ctx.reply(embed=embed)

    @badge_group.command(name="remove")
    async def badge_remove(self, ctx: Context, member: discord.Member, *, badge: str):
        """Removes a badge from a member."""
        if not self._is_owner_or_staff(ctx):
            return await ctx.reply(f"{CROSS} Only bot developers and staff can remove badges.")

        badge_key = badge.lower().replace(" ", "").replace("_", "")
        matched_key = None
        for k in BOT_BADGES.keys():
            if k == badge_key or badge_key in k:
                matched_key = k
                break

        if not matched_key:
            return await ctx.reply(f"{CROSS} Unknown badge `{badge}`.")

        set_user_badge(member.id, matched_key, 0)
        binfo = BOT_BADGES[matched_key]
        embed = discord.Embed(
            description=f"{TICK} Removed {binfo['emoji']} **{binfo['name']}** badge from {member.mention}.",
            color=0xef4444
        )
        await ctx.reply(embed=embed)

    @badge_group.group(name="all", invoke_without_command=True)
    async def badge_all(self, ctx: Context, member: discord.Member):
        """Gives all available badges to a member."""
        if not self._is_owner_or_staff(ctx):
            return await ctx.reply(f"{CROSS} Only bot developers and staff can run this command.")

        set_all_badges(member.id, 1)
        all_emojis = " ".join(b["emoji"] for b in BOT_BADGES.values())
        embed = discord.Embed(
            title=f"{TICK} All Badges Awarded!",
            description=f"Successfully awarded all **{len(BOT_BADGES)}** badges to {member.mention}!\n\n{all_emojis}",
            color=0x22c55e,
            timestamp=datetime.utcnow()
        )
        await ctx.reply(embed=embed)

    @badge_all.command(name="give")
    async def badge_all_give(self, ctx: Context, member: discord.Member):
        """Explicit alias: +badge all give <member>."""
        await self.badge_all(ctx, member)

    @badge_group.command(name="giveall")
    async def badge_giveall(self, ctx: Context, member: discord.Member):
        """Alias: +badge giveall <member>."""
        await self.badge_all(ctx, member)

    @badge_group.command(name="clear", aliases=["removeall"])
    async def badge_clear(self, ctx: Context, member: discord.Member):
        """Removes all badges from a member."""
        if not self._is_owner_or_staff(ctx):
            return await ctx.reply(f"{CROSS} Only bot developers and staff can run this command.")

        set_all_badges(member.id, 0)
        embed = discord.Embed(
            description=f"{TICK} Cleared all badges from {member.mention}.",
            color=0xef4444
        )
        await ctx.reply(embed=embed)


async def setup(bot: zyrox):
    await bot.add_cog(Badges(bot))
