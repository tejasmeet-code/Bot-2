# Full Codebase Audit Checklist & Findings Log (`tejasmeet-code/bot-2`)

## Startup & Data Flow Architecture
1. **Entry Point**: `artifacts/api-server/src/index.ts`
   - Loads `.env` configuration.
   - Listens on Express HTTP server (`port 3000`) for health checks (`/health`, `/_health`) and web dashboard.
   - Triggers `startDiscordBot()` from `artifacts/api-server/src/discord/client.ts`.

2. **Bot Startup & Initializers (`client.ts`)**:
   - Checks single instance flag (`isBotStartingOrStarted`).
   - Loads persistent custom emojis from `.data/custom_emojis.json`.
   - Initializes permission whitelists (`initPermWhitelist()`).
   - Instantiates Discord `Client` with necessary Gateway Intents (`Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`, `GuildModeration`, `DirectMessages`, `GuildVoiceStates`).
   - **On Ready**:
     - Synchronizes application commands globally and per-guild.
     - Initializes Lavalink v4 Shoukaku node (`initLavalink(readyClient)`).
     - Restores 24/7 Voice Radio Sessions across guilds (`init247Sessions()`).
     - Triggers background custom emoji syncing (`uploadAllEmojisToGodsEye`, `syncDevServerEmojis`).
     - Launches giveaway scheduler intervals.

3. **Message & Command Dispatching**:
   - **`MessageCreate` Event (`client.ts` -> `messageHandler.ts`)**:
     - Deduplicates via 15-min TTL message ID cache (`isMessageRecentlyProcessed`).
     - Checks AFK, auto-reactions, and owner immunity.
     - Evaluates AutoMod rules.
     - Extracts prefix or resolves alias via `resolveCommandAndArgs()`.
     - Executes matching prefix command or no-prefix command exactly once.
   - **`InteractionCreate` Event (`client.ts`)**:
     - Identifies Slash Commands, Buttons, StringSelectMenus, or Modals.
     - Routes to slash command registry or specific feature handlers (`handleMusicButton`, `handleTicketButton`, `handleRoleMenu`, etc.).

---

## Source File Inventory & Review Status

- [ ] `artifacts/api-server/src/index.ts`
- [ ] `artifacts/api-server/src/app.ts`
- [ ] `artifacts/api-server/src/dashboardView.ts`
- [ ] `artifacts/api-server/src/lib/logger.ts`
- [ ] `artifacts/api-server/src/lib/paths.ts`
- [ ] `artifacts/api-server/src/routes/index.ts`
- [ ] `artifacts/api-server/src/routes/health.ts`
- [ ] `artifacts/api-server/src/routes/dashboard.ts`
- [ ] `artifacts/api-server/src/discord/client.ts`
- [ ] `artifacts/api-server/src/discord/messageHandler.ts`
- [ ] `artifacts/api-server/src/discord/registry.ts`
- [ ] `artifacts/api-server/src/discord/types.ts`
- [ ] `artifacts/api-server/src/discord/music/lavalinkClient.ts`
- [ ] `artifacts/api-server/src/discord/music/musicManager.ts`
- [ ] `artifacts/api-server/src/discord/music/sourceResolver.ts`
- [ ] `artifacts/api-server/src/discord/music/lyricsService.ts`
- [ ] `artifacts/api-server/src/discord/registry/registerGuildCommands.ts`
- [ ] `artifacts/api-server/src/discord/utils/embedStyle.ts`
- [ ] `artifacts/api-server/src/discord/utils/emojis.ts`
- [ ] `artifacts/api-server/src/discord/utils/commandAliases.ts`
- [ ] `artifacts/api-server/src/discord/utils/dmCore.ts`
- [ ] `artifacts/api-server/src/discord/utils/antiNuke.ts`
- [ ] `artifacts/api-server/src/discord/utils/staffPerms.ts`
- [ ] `artifacts/api-server/src/discord/utils/ownerImmunity.ts`
- [ ] `artifacts/api-server/src/discord/utils/devServerEmojiSync.ts`
- [ ] `artifacts/api-server/src/discord/utils/tempEmojiUpload.ts`
- [ ] `artifacts/api-server/src/discord/utils/paginator.ts`
- [ ] `artifacts/api-server/src/discord/utils/autoModNative.ts`
- [ ] `artifacts/api-server/src/discord/utils/messageInterceptors.ts`
- [ ] `artifacts/api-server/src/discord/storage/supabase.ts`
- [ ] `artifacts/api-server/src/discord/storage/persistentJson.ts`
- [ ] `artifacts/api-server/src/discord/storage/config.ts`
- [ ] `artifacts/api-server/src/discord/storage/premium.ts`
- [ ] `artifacts/api-server/src/discord/storage/botStaff.ts`
- [ ] `artifacts/api-server/src/discord/storage/whitelist.ts`
- [ ] `artifacts/api-server/src/discord/storage/automod.ts`
- [ ] `artifacts/api-server/src/discord/storage/cases.ts`
- [ ] `artifacts/api-server/src/discord/storage/warnings.ts`
- [ ] `artifacts/api-server/src/discord/storage/giveaways.ts`
- [ ] `artifacts/api-server/src/discord/storage/tickets.ts`
- [ ] `artifacts/api-server/src/discord/storage/music247.ts`
- [ ] `artifacts/api-server/src/discord/storage/musicDj.ts`
- [ ] `artifacts/api-server/src/discord/storage/afk.ts`
- [ ] `artifacts/api-server/src/discord/storage/loa.ts`
- [ ] `artifacts/api-server/src/discord/storage/profile.ts`
- [ ] `artifacts/api-server/src/discord/storage/levels.ts`
- [ ] `artifacts/api-server/src/discord/storage/quota.ts`
- [ ] `artifacts/api-server/src/discord/storage/serverBackup.ts`
- [ ] `artifacts/api-server/src/discord/commands/music.ts`
- [ ] `artifacts/api-server/src/discord/commands/premium.ts`
- [ ] `artifacts/api-server/src/discord/commands/ban.ts`
- [ ] `artifacts/api-server/src/discord/commands/kick.ts`
- [ ] `artifacts/api-server/src/discord/commands/mute.ts`
- [ ] `artifacts/api-server/src/discord/commands/unban.ts`
- [ ] `artifacts/api-server/src/discord/commands/warn.ts`

---

## Audit Findings Log

| ID | File & Line | Severity | Description | Fix Summary |
|---|---|---|---|---|
| AUD-01 | `musicManager.ts` | High | Lavalink reconnection attempt on startup throws when Lavalink node is offline | Return empty tracks array cleanly on node disconnect |
| AUD-02 | `client.ts:1700-1725` | Medium | Duplicate inactivity timeout logic on `VoiceStateUpdate` | Consolidated into `musicManager.ts` |
