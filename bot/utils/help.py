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

import discord
from utils.Tools import *
from utils.emoji import REWIND, PREVIOUS, NEXT, FORWARD, DELETE, HOME
from utils.config import BRAND_NAME, BotName, serverLink


class Dropdown(discord.ui.Select):

    def __init__(self, ctx, options, placeholder="Choose a Category for Help", row=1):
        super().__init__(placeholder=placeholder,
                         min_values=1,
                         max_values=1,
                         options=options,
                         row=row)
        self.invoker_id = ctx.author.id if hasattr(ctx, 'author') else ctx.user.id

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.invoker_id:
            return await interaction.response.send_message(
                "You must run this command to interact with it.", ephemeral=True)
        index = self.view.find_index_from_select(self.values[0])
        await self.view.set_page(index, interaction)


class View(discord.ui.View):

    def __init__(self, mapping: dict, ctx, homeembed, ui: int = 2):
        super().__init__(timeout=180)
        self.mapping = mapping
        self.ctx = ctx
        self.index = 0
        self.homeembed = homeembed
        self.ui = ui
        self.invoker_id = ctx.author.id if hasattr(ctx, 'author') else ctx.user.id

        self.options, self.pages, self.total_pages = self.gen_pages(homeembed)
        self._rebuild()

    def _rebuild(self):
        self.clear_items()
        is_first = self.index == 0
        is_last = self.index >= self.total_pages - 1

        homeB = discord.ui.Button(label="", emoji=REWIND, style=discord.ButtonStyle.secondary, disabled=is_first, row=0)
        backB = discord.ui.Button(label="", emoji=PREVIOUS, style=discord.ButtonStyle.secondary, disabled=is_first, row=0)
        quitB = discord.ui.Button(label="", emoji=DELETE, style=discord.ButtonStyle.danger, row=0)
        nextB = discord.ui.Button(label="", emoji=NEXT, style=discord.ButtonStyle.secondary, disabled=is_last, row=0)
        lastB = discord.ui.Button(label="", emoji=FORWARD, style=discord.ButtonStyle.secondary, disabled=is_last, row=0)

        homeB.callback = self._home_cb
        backB.callback = self._back_cb
        quitB.callback = self._quit_cb
        nextB.callback = self._next_cb
        lastB.callback = self._last_cb

        self.add_item(homeB)
        self.add_item(backB)
        self.add_item(quitB)
        self.add_item(nextB)
        self.add_item(lastB)

        if len(self.options) <= 25:
            self.add_item(Dropdown(ctx=self.ctx, options=self.options, row=1))
        else:
            mid = len(self.options) // 2
            o1, o2 = self.options[:mid], self.options[mid:]
            if o1:
                self.add_item(Dropdown(ctx=self.ctx, options=o1[:25], placeholder="Main Commands", row=1))
            if o2:
                self.add_item(Dropdown(ctx=self.ctx, options=o2[:25], placeholder="Extra Commands", row=2))

    async def _check(self, interaction: discord.Interaction):
        if interaction.user.id != self.invoker_id:
            await interaction.response.send_message("You must run this command to interact with it.", ephemeral=True)
            return False
        return True

    async def _home_cb(self, interaction: discord.Interaction):
        if await self._check(interaction):
            await self.set_page(0, interaction)

    async def _back_cb(self, interaction: discord.Interaction):
        if await self._check(interaction):
            await self.set_page(self.index - 1 if self.index > 0 else self.total_pages - 1, interaction)

    async def _quit_cb(self, interaction: discord.Interaction):
        if await self._check(interaction):
            try:
                await interaction.message.delete()
            except Exception:
                await interaction.response.defer()

    async def _next_cb(self, interaction: discord.Interaction):
        if await self._check(interaction):
            await self.set_page(self.index + 1 if self.index < self.total_pages - 1 else 0, interaction)

    async def _last_cb(self, interaction: discord.Interaction):
        if await self._check(interaction):
            await self.set_page(self.total_pages - 1, interaction)

    def find_index_from_select(self, value):
        for idx, page in enumerate(self.pages):
            if page.get("label") == value:
                return idx
        return 0

    def get_cogs(self):
        return list(self.mapping.keys())

    def gen_pages(self, homeembed):
        options, pages = [], []
        options.append(discord.SelectOption(label="Home", emoji=HOME, description="Main Menu"))

        fields = []
        if hasattr(homeembed, 'fields') and homeembed.fields:
            fields = [(f.name, f.value) for f in homeembed.fields]

        pages.append({
            "label": "Home",
            "title": getattr(homeembed, 'title', f"{BotName} Helper") or f"{BotName} Helper",
            "description": getattr(homeembed, 'description', '') or '',
            "fields": fields,
            "footer": None
        })

        used_labels = {"Home"}
        for cog in self.get_cogs():
            if not cog or getattr(cog, "__class__", None) and cog.__class__.__name__ == "Roleplay":
                continue
            if hasattr(cog, "help_custom"):
                emoji, label, description = cog.help_custom()
                original_label = label
                counter = 1
                while label in used_labels:
                    label = f"{original_label} {counter}"
                    counter += 1
                used_labels.add(label)
                desc = description[:95] if description else "Commands in this category"
                options.append(discord.SelectOption(label=label, emoji=emoji, description=desc))

                cog_fields = []
                for command in cog.get_commands():
                    params = ""
                    for param in command.clean_params:
                        if param not in ["self", "ctx"]:
                            params += f" <{param}>"
                    help_text = command.help or "No description available"
                    if len(help_text) > 1020:
                        help_text = help_text[:1017] + "..."
                    cog_fields.append((f"{command.name}{params}", f"{help_text}\n•"))

                pages.append({
                    "label": label,
                    "title": f"{emoji} {original_label}",
                    "description": "",
                    "fields": cog_fields,
                    "footer": None
                })

        return options, pages, len(pages)

    async def set_page(self, page_index: int, interaction: discord.Interaction):
        self.index = page_index
        self._rebuild()
        page = self.pages[page_index]

        author_name = self.ctx.author.display_name if hasattr(self.ctx, 'author') else self.ctx.user.display_name
        footer_text = f"• Help page {self.index + 1}/{self.total_pages} | Requested by: {author_name} | Support: {serverLink}"

        if page_index == 0:
            embed = discord.Embed(
                title=page["title"],
                description=page["description"],
                color=0xFF0000
            )
            for name, value in page["fields"]:
                embed.add_field(name=name, value=value, inline=False)
            embed.set_footer(text=footer_text)
        else:
            embed = discord.Embed(
                title=page["title"],
                description=page["description"],
                color=0xFF0000
            )
            for name, value in page["fields"]:
                embed.add_field(name=name, value=value, inline=False)
            embed.set_footer(text=footer_text)

        await interaction.response.edit_message(embed=embed, view=self)