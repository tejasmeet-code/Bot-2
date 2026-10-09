import { Client, IntentsBitField, ChannelType } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const EMOJI_TEXT = `
<:7316iconspeak:890361360976842813>
<:AmazonMusic:1179503431627575368>
<:AppleMusic:1529160381363130470>
<a:bot:768746814785454110>
<a:bot_music:760524064459849739>
<a:Close:1521536715376824391>
<a:Close_ticket:1046848661285519401>
<a:DD_bot_ping:1031140002517757972>
<a:dev_white:947872643137290240>
<:dwnld_icons:866441672509489185>
<a:emojiKo_24:1209143730670534788>
<a:emojis:801000030919327794>
<a:error:974493842600525835>
<:gaana:1523756814670500013>
<a:Homies:978688292809764874>
<a:html_open_then_close:1528152644470837410>
<:icons:939498414121553930>
<:icons_1:945243372862451742>
<:icons_18:957659769122992209>
<:icons_2:910754289062912102>
<:icons_3:898815898289307669>
<:icons_4:945243419347943455>
<:icons_5:909728229424783370>
<:icons_6:1357085417790505100>
<:icons_8:909728340544462858>
<:icons8whiteexclamationmark48:1503715579595325480>
<:icons_9:909728354062704711>
<:icons_audiodisable:944556695617671185>
<:icons_bots:1075035157964279858>
<:icons_crown:1077445439743336570>
<:icons_dev:1529811749346345041>
<:icons_discover:941455002776530965>
<:icons_emojis:955966305813528646>
<:icons_eventcolour:916573429669462107>
<:IconsEvents:944556696485920789>
<:icons_Female:944477467165491240>
<:icons_invite:1523698954108276766>
<:icons_juego:866199429396299787>
<:icons_linkadd:1523281970975604816>
<:icons_linked:990303738617004042>
<:icons_Male:944477346088493096>
<:icons_nitro:1524662099467440178>
<:icons_no:1002575462091980890>
<:iconspin:867092556122161173>
<:icons_ping:867428113569546250>
<:icons_role:1089550879033675856>
<:Icons_rpodcast:930856311707562015>
<:icons_swardx:948968810403217508>
<:icons_text:1477670513907204148>
<:icons_text1s:908986042672107521>
<:icons_uptime:938029941080068117>
<:Icons_utility:1523281775080505504>
<:icons_utility:914769717670076456>
<:icons_verified:1360551753686188073>
<a:link:1522158187556638750>
<a:Loop:914550906798866532>
<a:loop:1329833340941107302>
<a:mc_bot_emoji:1343083583438590065>
<a:Mod:1524820838828871752>
<a:music:985666364427624488>
<a:Music:1370601973534949558>
<a:music_bot:1521544068742643783>
<a:MusicBot:1500733404977827884>
<a:MusicBots:1394231020336840865>
<a:nitro:836157250049409070>
<a:online:953760278527488000>
<a:pauseplay:1427809142051176458>
<a:pause_resume:1535977738714742825>
<a:premium:850449561503399956>
<a:premium_:1067818535704862742>
<:right_icons:1320488185574457456>
<a:Shuffle:839061572281827328>
<:spotify:1521499633107337217>
<a:startpixel:1524110226901434530>
<a:SuccesWhite:840524131065528320>
<a:support:1140225994825941093>
<a:supporter:1170077012552060959>
<a:Tester:799143615804342273>
<a:ticket:1526080026053840986>
<a:Turn_OnOff_Button:1350893966156894278>
<:type_icons:1368167945750184007>
<a:vip:938795741470654504>
<a:Web:907921558541070346>
<a:website:1100409618821300294>
<:white_crown:886844273671176263>
<:white_host:1040160044790067220>
<:whitemod:1217718000916889681>
<a:xD_Head_mod:1011353178060632074>
<a:X_Ticket:1336748753821896735>
<:YouTubeMusic:1523754898771148810>
<a:pepe_wave:1269179166993944667>
<a:black_tick:1471104274997182514>
<a:yellow_tick:1471104306286694451>
<a:green_tick:1471104332568203364>
<a:blue_tick:1471104362142240830>
<a:purple_tick:1471104388482470009>
<a:pink_tick:1471104414902263889>
<a:white_tick:1471104443209613385>
<a:cyan_tick:1471104467389644831>
<a:orange_tick:1471104494191378462>
<a:red_tick:1471104517373431878>
<:crown_leads:1471104546582302929>
<:red_crown:1471104574944186419>
<a:FireRedandBlack:1471148448622444679>
<a:PurpleStar:1471148510245294100>
<a:red_point:1471148554717499558>
<:red_info:1471148734833492065>
<:Founders:1471148780530434333>
<:8968pastelstaff:1471148829888872661>
<a:Tickets_t:1471148888957124710>
<a:stars:1471148954581209223>
<:RedAdmin:1471461238620946584>
<:ng_website:1471456690766348350>
<a:announcement:1471459879448477739>
<:guidelines:1471461018956988568>
<a:Fire_Cyan:1466875400243384421>
<:redarrow:1481966135917281430>
<a:arrow_arrow:1511698578567860404>
<a:boosts:1511698728820670645>
<:spotify_logo:1511698888741355531>
<:874346wrong:1511387734483144764>
<:4561pinkerror:1511387678170677377>
<:serverannounce:1519271127854088282>
<:y_arrow:1519269086775873536>
<:x_logMessage:1519269247908581498>
<:user:1519271719137968238>
<:1178verified:1519270217912422441>
<:white_bot:1521553655126425640>
<:250885giveaway:1519270730540253204>
<:BotCompras:1551170021999255552>
<:botCalendarLight:1551170019226947625>
<:0white_pm:1551170015774900294>
<:botuser:1551170035773481070>
<:bottom:1551170032183025705>
<:bots:1551170028517335140>
<:botinfo:1551170025732313109>
<a:white:1551170067058786309>
<a:SuccesWhite:1551170061404864546>
<a:music:1551170042346082397>
<a:sk_volumehigh:1551170045617639535>
<:sk_lyrics:1551170054815875225>
<:sk_playlist:1551170051280081036>
<:sk_addrole:1551170114093977721>
<:sk_removerole:1551170110398660608>
<:sk_lock:1551170070384742410>
<:sk_unlock:1551170073287332004>
<a:loading_process:1551170081390985226>
<:sk_modstats:1551170085442551848>
<:sk_warn:1551170088995389440>
<:sk_mute:1551170104443015181>
<:sk_unmute:1551170101372784772>
<:sk_ban:1551170098042372179>
<:sk_unban:1551170094708162601>
<:sk_kick:1551170107299336336>
<a:red_developer:1551170144574115930>
<:sk_owner:1551170126786199653>
<:sk_coinflip:1551170133270335558>
<:sk_8ball:1551170130091315354>
<:sk_slots:1551170136869179503>
<:sk_games:1551170140228816916>
<:sk_profile:1551170120150945823>
<:sk_xp:1551170123187490916>
<:sk_demote:1551170117097361498>
<:sk_promote:1551170113271791771>
<:sk_badge_bug_hunter:1551170170423873536>
<:sk_badge_supporter:1551170166296412190>
<:sk_badge_loyal_staff:1551170162509217822>
<:sk_badge_active_developer:1551170154942435389>
<:sk_badge_premium:1551170158407188490>
<:sk_badge_owner:1551170151322746971>
<:sk_badge_vip_staff:1551170147983949826>
<:sk_automations:1551170176882835497>
<:sk_autoyes:1551170180292812850>
<:sk_autono:1551170184478724126>
<:sk_autoheal:1551170188048207902>
<:sk_autoreact:1551170191063908473>
<:sk_checkstaff:1551170200844763167>
<:sk_staff_profile:1551170197707689994>
<:sk_staff_shop:1551170194687660052>
<:sk_quota:1551170204363640974>
<:sk_infraction:1551170207572230234>
<:sk_notes:1551170211145908336>
<:sk_appeal:1551170214220337162>
<:sk_antinuke:1551170217982496841>
<:sk_whitelists:1551170220994138122>
<:sk_staffmanager:1551170224164900895>
<:sk_staffaudit:1551170227285626880>
<:sk_automod:1551170230678818816>
<:sk_punishment:1551170233778540605>
<:sk_triggers:1551170237192699925>
<:sk_banned_words:1551170240417992775>
<:sk_invite_filter:1551170243685220373>
<:sk_link_filter:1551170246960844810>
<:sk_spam_filter:1551170250006036611>
<:sk_ginfo:1551170253457817651>
<:sk_glist:1551170256607739945>
<:sk_gback:1551170259795542157>
<:sk_backup:1551170263234945034>
<:sk_gwhitelist:1551170266397446214>
<:sk_connect:1551170269559951381>
<:sk_broad:1551170272906874941>
<:sk_leaveserv:1551170276224696320>
<:sk_greact:1551170279546458153>
<:sk_slowmode:1551170282834788392>
<:sk_vcmove:1551170295325556758>
<:sk_vckick:1551170292351664188>
<:sk_vcdeafen:1551170289067786370>
<:sk_vcmute:1551170285909348362>
<:sk_betrayal:1551170298642993183>
<:sk_cursed:1551170301880991755>
<:sk_words:1551170305093836881>
<:sk_choice:1551170308356997190>
<:sk_scramble:1551170311746261012>
<:sk_prizeguess:1551170321741283369>
<:sk_shufchan:1551170318465269864>
<:sk_shufrol:1551170315055431690>
<:sk_wordscramble:1551170324887011400>
<:sk_hangman:1551170328225808527>
<:sk_tictactoe:1551170331404959774>
<:sk_c4:1551170334810738740>
<:sk_hl:1551170338166394883>
`;

interface ParsedEmoji {
  name: string;
  id: string;
  animated: boolean;
  url: string;
}

const parsedEmojis: ParsedEmoji[] = [];
const regex = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
let match;
while ((match = regex.exec(EMOJI_TEXT)) !== null) {
  const animated = match[1] === "a";
  const name = match[2];
  const id = match[3];
  const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
  parsedEmojis.push({ name, id, animated, url });
}

console.log(`Parsed ${parsedEmojis.length} total emojis.`);

async function main() {
  const client = new Client({
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildEmojisAndStickers,
    ],
  });

  client.once("ready", async () => {
    console.log(`Uploader bot logged in as: ${client.user?.tag}`);

    // Fetch all servers (guilds) the bot is in
    const oAuthGuilds = await client.guilds.fetch();
    console.log(`Connected to ${oAuthGuilds.size} total guilds.`);

    // Map each emoji name to see which ones are already present on any of the servers
    const existingEmojiNames = new Set<string>();
    
    for (const [id, partialGuild] of oAuthGuilds) {
      try {
        const fullGuild = await partialGuild.fetch();
        const serverEmojis = await fullGuild.emojis.fetch();
        for (const [eId, emoji] of serverEmojis) {
          if (emoji.name) {
            existingEmojiNames.add(emoji.name);
          }
        }
      } catch {}
    }

    const missingEmojis = parsedEmojis.filter(e => !existingEmojiNames.has(e.name));
    console.log(`${parsedEmojis.length - missingEmojis.length} emojis already exist on joined servers.`);
    console.log(`${missingEmojis.length} emojis need to be uploaded.`);

    if (missingEmojis.length === 0) {
      console.log("All 235 emojis are already fully distributed and available across your servers!");
      client.destroy();
      process.exit(0);
    }

    // Distribute missing emojis across guilds that have empty slots
    let uploadedCount = 0;

    for (const [gId, partialGuild] of oAuthGuilds) {
      if (uploadedCount >= missingEmojis.length) break;

      try {
        const guild = await partialGuild.fetch();
        
        // Ensure bot has permission to manage emojis here
        const botMember = await guild.members.fetch(client.user!.id).catch(() => null);
        if (!botMember) continue;
        
        const hasPerms = botMember.permissions.has("ManageEmojisAndStickers") || botMember.permissions.has("Administrator");
        if (!hasPerms) {
          console.log(`Skipping server "${guild.name}" - Missing Manage Emojis permissions.`);
          continue;
        }

        // Fetch current custom emojis
        const currentEmojis = await guild.emojis.fetch();
        const currentStatic = currentEmojis.filter(e => !e.animated).size;
        const currentAnimated = currentEmojis.filter(e => e.animated).size;

        // Level 0: 50, Level 1: 100, Level 2: 150, Level 3: 250
        const limitMap: Record<number, number> = { 0: 50, 1: 100, 2: 150, 3: 250 };
        const tier = guild.premiumTier;
        const maxSlots = limitMap[tier] || 50;

        const remainingStatic = Math.max(0, maxSlots - currentStatic);
        const remainingAnimated = Math.max(0, maxSlots - currentAnimated);

        if (remainingStatic === 0 && remainingAnimated === 0) {
          console.log(`Server "${guild.name}" is completely full (Static: ${currentStatic}/${maxSlots}, Animated: ${currentAnimated}/${maxSlots}).`);
          continue;
        }

        console.log(`\nDistributing to "${guild.name}" (Tier ${tier}): Static Slots Left: ${remainingStatic}, Animated Slots Left: ${remainingAnimated}`);

        let guildUploadedStatic = 0;
        let guildUploadedAnimated = 0;

        for (let i = uploadedCount; i < missingEmojis.length; i++) {
          const emoji = missingEmojis[i];
          const isAnimated = emoji.animated;

          if (isAnimated && guildUploadedAnimated >= remainingAnimated) continue;
          if (!isAnimated && guildUploadedStatic >= remainingStatic) continue;

          try {
            console.log(`Downloading: :${emoji.name}: (${emoji.url})`);
            const res = await fetch(emoji.url, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
            
            const buffer = Buffer.from(await res.arrayBuffer());
            const created = await guild.emojis.create({
              attachment: buffer,
              name: emoji.name,
              reason: "Global Multi-Server Emoji Distribution Setup",
            });

            console.log(`Successfully created :${created.name}: in "${guild.name}"!`);
            
            if (isAnimated) guildUploadedAnimated++;
            else guildUploadedStatic++;

            uploadedCount++;
            
            // Respect Discord Rate Limits
            await new Promise(r => setTimeout(r, 650));
          } catch (err: any) {
            console.error(`Error uploading :${emoji.name}: to "${guild.name}":`, err.message || err);
            if (err.message?.includes("Rate limit")) {
              console.log("Hit rate limit, cooling down...");
              await new Promise(r => setTimeout(r, 10000));
            }
          }
        }
      } catch (guildErr: any) {
        console.error(`Error processing guild ${gId}:`, guildErr.message || guildErr);
      }
    }

    console.log(`\nDistribution finished! Distributed ${uploadedCount} emojis across joined servers.`);
    client.destroy();
    process.exit(0);
  });

  client.login(process.env.DISCORD_BOT_TOKEN);
}

main().catch(console.error);
