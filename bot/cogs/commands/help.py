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
import asyncio
from typing import Optional, Dict, List, Any
from datetime import datetime

from core import Cog, Context, zyrox
from utils.config import BotName, BRAND_NAME, serverLink
from utils.Tools import getConfig, ignore_check, blacklist_check
from utils.emoji import (
    ARROWRED, BOOST, CAST, GAMES, LEVEL_UP, LOADINGRED, LOCK, MESSAGE,
    MINECRAFT, MUSIC, NEW, PIN, SEED, STAR, SWORD, SYSTEM, THUNDER,
    TICKET, WIFI, ZAI, ZARROW, ZBAN, ZBOT, ZCIRCLE, ZCIRCLE_ALT1,
    ZCLOUD, ZCOUNTING, ZMODULE, ZPEOPLE, ZROCKET, ZSAFE, ZTADA,
    ZUNMUTE, ZWRENCH, TICK, CROSS, HOME, REWIND, PREVIOUS, NEXT, FORWARD, DELETE
)

PRIMARY_COLOR = 0x2b2d31
ACCENT_COLOR = 0x5865F2

# Category Configuration
CATEGORIES: Dict[str, Dict[str, Any]] = {
    "security": {
        "label": "Antinuke & Security",
        "emoji": ZSAFE,
        "description": "Server protection, whitelisting, and panic modes",
        "cogs": ["Antinuke", "Whitelist", "Unwhitelist", "Extraowner", "Nightmode", "Emergency", "Jail", "Block", "Blacklist"]
    },
    "moderation": {
        "label": "Moderation",
        "emoji": SWORD,
        "description": "Ban, kick, mute, warn, channel lock, role management",
        "cogs": ["Moderation", "Ban", "Unban", "Mute", "Unmute", "Lock", "Unlock", "Hide", "Unhide", "Kick", "Warn", "Role", "Message", "TopCheck", "Snipe"]
    },
    "automod": {
        "label": "Automoderation",
        "emoji": ZBOT,
        "description": "Antispam, antilink, anticaps, anti-invite filters",
        "cogs": ["Automod", "AntiSpam", "AntiCaps", "AntiLink", "AntiInvite", "AntiMassMention", "AntiEmojiSpam"]
    },
    "music": {
        "label": "Music & Audio",
        "emoji": MUSIC,
        "description": "High-fidelity voice playback, filters, and 24/7 mode",
        "cogs": ["Music", "Voice"]
    },
    "owner": {
        "label": "Owner & Badges",
        "emoji": THUNDER,
        "description": "Bot badges, cloud backups, and developer commands",
        "cogs": ["Owner", "Badges", "Supabase", "Global", "NoPrefix"]
    },
    "utility": {
        "label": "Utility & Server",
        "emoji": ZWRENCH,
        "description": "Serverinfo, userinfo, ping, stats, avatar, banners",
        "cogs": ["General", "Stats", "Status", "Embed", "Media", "QR", "TranslateCog", "Minecraft", "encryption"]
    },
    "tickets": {
        "label": "Tickets & Logging",
        "emoji": TICKET,
        "description": "Interactive ticket panels and comprehensive server audits",
        "cogs": ["TicketCog", "Logging", "Tracking", "inviteTracker"]
    },
    "leveling": {
        "label": "Leveling & Vanity",
        "emoji": LEVEL_UP,
        "description": "XP rankings, leaderboard, vanity roles, custom roles",
        "cogs": ["Leveling", "VanityRoles", "Customrole", "Booster"]
    },
    "fun": {
        "label": "Fun & Games",
        "emoji": GAMES,
        "description": "Blackjack, slots, counting, minigames, image memes",
        "cogs": ["Fun", "Games", "Blackjack", "Slots", "Counting", "calculator", "Timer", "Steal", "Nitro", "ImageCommands"]
    },
    "welcome": {
        "label": "Welcome & Automation",
        "emoji": SEED,
        "description": "Greeter embeds, autoroles, join DMs, autoresponder",
        "cogs": ["Welcomer", "AutoRole", "Autorole2", "FastGreet", "joindm", "AutoReaction", "AutoResponder", "ReactionRoles", "StickyMessage"]
    },
    "ai": {
        "label": "Artificial Intelligence",
        "emoji": ZAI,
        "description": "Neural chat, AI image generation, smart prompt assistance",
        "cogs": ["AI"]
    }
}


class HelpDropdown(discord.ui.Select):
    def __init__(self, help_view: HelpInteractiveView):
        self.help_view = help_view
        options = [
            discord.SelectOption(
                label="Home Menu",
                value="home",
                emoji=HOME,
                description="Return to the Zenith main help overview"
            )
        ]
        for key, data in CATEGORIES.items():
            options.append(
                discord.SelectOption(
                    label=data["label"],
                    value=key,
                    emoji=data["emoji"],
                    description=data["description"][:100]
                )
            )
        super().__init__(placeholder="Choose a Module to explore commands...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.help_view.author_id:
            return await interaction.response.send_message("❌ This help session belongs to someone else.", ephemeral=True)
        
        selected = self.values[0]
        if selected == "home":
            self.help_view.current_category = "home"
            self.help_view.page_index = 0
            embed = self.help_view.build_home_embed()
        else:
            self.help_view.current_category = selected
            self.help_view.page_index = 0
            embed = self.help_view.build_category_embed(selected, 0)

        self.help_view.update_button_states()
        await interaction.response.edit_message(embed=embed, view=self.help_view)


class HelpInteractiveView(discord.ui.View):
    def __init__(self, bot: zyrox, author_id: int, prefix: str):
        super().__init__(timeout=180)
        self.bot = bot
        self.author_id = author_id
        self.prefix = prefix
        self.current_category = "home"
        self.page_index = 0
        self.message: Optional[discord.Message] = None

        # Add Category Dropdown
        self.dropdown = HelpDropdown(self)
        self.add_item(self.dropdown)

        # Pagination & Utility Buttons
        self.prev_button = discord.ui.Button(label="", emoji=PREVIOUS, style=discord.ButtonStyle.secondary, row=1, disabled=True)
        self.home_button = discord.ui.Button(label="Home", emoji=HOME, style=discord.ButtonStyle.primary, row=1)
        self.next_button = discord.ui.Button(label="", emoji=NEXT, style=discord.ButtonStyle.secondary, row=1, disabled=True)
        self.support_button = discord.ui.Button(label="Support", url="https://discord.gg/WqJGXrQX4", style=discord.ButtonStyle.link, row=1)
        self.delete_button = discord.ui.Button(label="", emoji=DELETE, style=discord.ButtonStyle.danger, row=1)

        self.prev_button.callback = self.on_prev_click
        self.home_button.callback = self.on_home_click
        self.next_button.callback = self.on_next_click
        self.delete_button.callback = self.on_delete_click

        self.add_item(self.prev_button)
        self.add_item(self.home_button)
        self.add_item(self.next_button)
        self.add_item(self.support_button)
        self.add_item(self.delete_button)

    def get_commands_for_category(self, cat_key: str) -> List[commands.Command]:
        cat_data = CATEGORIES.get(cat_key, {})
        cog_names = cat_data.get("cogs", [])
        collected = []
        seen = set()

        for cname in cog_names:
            cog = self.bot.get_cog(cname)
            if cog:
                for cmd in cog.get_commands():
                    if cmd.name not in seen and not cmd.hidden:
                        collected.append(cmd)
                        seen.add(cmd.name)

        collected.sort(key=lambda c: c.name)
        return collected

    def build_home_embed(self) -> discord.Embed:
        total_cmds = len([c for c in self.bot.walk_commands() if not c.hidden])
        total_guilds = len(self.bot.guilds)
        total_users = sum(g.member_count or 0 for g in self.bot.guilds)

        embed = discord.Embed(
            title=f"⚡ {BotName} — Neural Control Center",
            description=(
                f"Welcome to **{BotName}**, the high-performance Discord engine.\n"
                f"Prefix: `{self.prefix}` | Total Commands: **{total_cmds}**\n\n"
                f"Select any category from the menu below to view full command listings.\n"
                f"Type `{self.prefix}help <command>` for detailed syntax & examples."
            ),
            color=PRIMARY_COLOR,
            timestamp=datetime.utcnow()
        )

        # Build Category Overview fields
        for key, data in CATEGORIES.items():
            cmds = self.get_commands_for_category(key)
            cmd_count = len(cmds)
            embed.add_field(
                name=f"{data['emoji']} {data['label']}",
                value=f"> `{cmd_count} Commands` — {data['description']}",
                inline=True
            )

        embed.set_footer(text=f"{BotName} Infrastructure • Serving {total_guilds} Guilds & {total_users} Users", icon_url=self.bot.user.display_avatar.url)
        return embed

    def build_category_embed(self, cat_key: str, page: int = 0) -> discord.Embed:
        cat_data = CATEGORIES.get(cat_key, {})
        cmds = self.get_commands_for_category(cat_key)
        per_page = 8
        total_pages = max(1, (len(cmds) + per_page - 1) // per_page)
        page = min(page, total_pages - 1)

        start = page * per_page
        end = start + per_page
        chunk = cmds[start:end]

        embed = discord.Embed(
            title=f"{cat_data.get('emoji', '📁')} {cat_data.get('label', 'Module')} Commands",
            description=(
                f"**Category Overview**: {cat_data.get('description', '')}\n"
                f"Use `{self.prefix}help <command>` for in-depth command usage.\n\u200b"
            ),
            color=PRIMARY_COLOR,
            timestamp=datetime.utcnow()
        )

        if chunk:
            for cmd in chunk:
                params = f" `{cmd.signature}`" if cmd.signature else ""
                short_doc = cmd.short_doc or cmd.help or "No description provided."
                if len(short_doc) > 120:
                    short_doc = short_doc[:117] + "..."
                
                embed.add_field(
                    name=f"`{self.prefix}{cmd.name}`{params}",
                    value=f"> {short_doc}",
                    inline=False
                )
        else:
            embed.description += "\n*No commands found in this module.*"

        embed.set_footer(text=f"Page {page + 1} of {total_pages} • Total in category: {len(cmds)}", icon_url=self.bot.user.display_avatar.url)
        return embed

    def update_button_states(self):
        if self.current_category == "home":
            self.prev_button.disabled = True
            self.next_button.disabled = True
        else:
            cmds = self.get_commands_for_category(self.current_category)
            per_page = 8
            total_pages = max(1, (len(cmds) + per_page - 1) // per_page)
            self.prev_button.disabled = self.page_index <= 0
            self.next_button.disabled = self.page_index >= total_pages - 1

    async def on_prev_click(self, interaction: discord.Interaction):
        if interaction.user.id != self.author_id:
            return await interaction.response.send_message("❌ This is not your menu.", ephemeral=True)
        if self.page_index > 0:
            self.page_index -= 1
            embed = self.build_category_embed(self.current_category, self.page_index)
            self.update_button_states()
            await interaction.response.edit_message(embed=embed, view=self)

    async def on_next_click(self, interaction: discord.Interaction):
        if interaction.user.id != self.author_id:
            return await interaction.response.send_message("❌ This is not your menu.", ephemeral=True)
        self.page_index += 1
        embed = self.build_category_embed(self.current_category, self.page_index)
        self.update_button_states()
        await interaction.response.edit_message(embed=embed, view=self)

    async def on_home_click(self, interaction: discord.Interaction):
        if interaction.user.id != self.author_id:
            return await interaction.response.send_message("❌ This is not your menu.", ephemeral=True)
        self.current_category = "home"
        self.page_index = 0
        self.update_button_states()
        embed = self.build_home_embed()
        await interaction.response.edit_message(embed=embed, view=self)

    async def on_delete_click(self, interaction: discord.Interaction):
        if interaction.user.id != self.author_id:
            return await interaction.response.send_message("❌ This is not your menu.", ephemeral=True)
        await interaction.message.delete()

    async def on_timeout(self):
        for item in self.children:
            if hasattr(item, "disabled"):
                item.disabled = True
        if self.message:
            try:
                await self.message.edit(view=self)
            except Exception:
                pass


class Help(Cog, name="help"):
    """Comprehensive, interactive Help engine rendering all registered bot commands."""

    def __init__(self, bot: zyrox):
        self.bot = bot
        # Replace default help command with custom implementation
        bot.help_command = None

    @commands.command(name="help", aliases=["h", "commands", "cmds"])
    async def help_command(self, ctx: Context, *, query: Optional[str] = None):
        """Displays interactive help overview or detailed lookup for a specific command."""
        prefix = ctx.clean_prefix if hasattr(ctx, "clean_prefix") else ">"

        if query:
            # Command specific lookup
            cmd = self.bot.get_command(query)
            if not cmd:
                # Check cogs
                cog = self.bot.get_cog(query)
                if cog:
                    embed = discord.Embed(
                        title=f"📦 {cog.qualified_name} Module",
                        description=cog.description or "No module description provided.",
                        color=PRIMARY_COLOR,
                        timestamp=datetime.utcnow()
                    )
                    c_list = [f"`{prefix}{c.name}`" for c in cog.get_commands() if not c.hidden]
                    embed.add_field(name="Available Commands", value=" • ".join(c_list) if c_list else "None", inline=False)
                    return await ctx.reply(embed=embed)
                
                return await ctx.reply(f"❌ Command or module `{query}` not found. Type `{prefix}help` to browse all categories.")

            embed = discord.Embed(
                title=f"📖 Command: {prefix}{cmd.qualified_name}",
                description=cmd.help or cmd.description or "No detailed description provided.",
                color=PRIMARY_COLOR,
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="Usage Syntax", value=f"`{prefix}{cmd.qualified_name} {cmd.signature}`".strip(), inline=False)
            if cmd.aliases:
                embed.add_field(name="Aliases", value=" • ".join(f"`{a}`" for a in cmd.aliases), inline=True)
            if cmd.cog_name:
                embed.add_field(name="Module", value=f"`{cmd.cog_name}`", inline=True)
            embed.set_footer(text="Parameters in < > are required | [ ] are optional", icon_url=self.bot.user.display_avatar.url)
            return await ctx.reply(embed=embed)

        # Main interactive help overview
        view = HelpInteractiveView(self.bot, ctx.author.id, prefix)
        embed = view.build_home_embed()
        msg = await ctx.reply(embed=embed, view=view)
        view.message = msg

    @app_commands.command(name="help", description="Browse Zenith commands, modules, and documentation")
    @app_commands.describe(command="Specific command name to inspect")
    async def slash_help(self, interaction: discord.Interaction, command: Optional[str] = None):
        """Slash command version of /help."""
        prefix = "/"
        if command:
            cmd = self.bot.get_command(command)
            if not cmd:
                return await interaction.response.send_message(f"❌ Command `{command}` not found. Use `/help` to view all categories.", ephemeral=True)

            embed = discord.Embed(
                title=f"📖 Command: /{cmd.qualified_name}",
                description=cmd.help or cmd.description or "No detailed description provided.",
                color=PRIMARY_COLOR,
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="Usage Syntax", value=f"`/{cmd.qualified_name} {cmd.signature}`".strip(), inline=False)
            if cmd.aliases:
                embed.add_field(name="Aliases", value=" • ".join(f"`{a}`" for a in cmd.aliases), inline=True)
            if cmd.cog_name:
                embed.add_field(name="Module", value=f"`{cmd.cog_name}`", inline=True)
            return await interaction.response.send_message(embed=embed)

        view = HelpInteractiveView(self.bot, interaction.user.id, "/")
        embed = view.build_home_embed()
        await interaction.response.send_message(embed=embed, view=view)
        try:
            view.message = await interaction.original_response()
        except Exception:
            pass


async def setup(bot: zyrox):
    await bot.add_cog(Help(bot))