import { Client, PermissionFlagsBits } from "discord.js";
import { logger } from "../../lib/logger";

const GUILD_ID = "1260221097970761808";

// All emojis provided by the user in the prompt
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
<:pepe_gun2:1269224052967346258>
<:pepe_happy:1269224143807844403>
<:pepe_chair:1269224014921072663>
<:you_tried:1269224011091677204>
<:pepe_cry:1269224006997774377>
<:pepe_pain:1269224121041158215>
<a:pepe_gun_shoot:1269224075276976169>
<:pepe_dum:1269224096005226526>
<:pepe_drink:1269223997065920545>
<:pepe_money:1269224102598545512>
<:thankful_emoji:1269240483323056240>
<:angrypout_emoji:1269240460963090482>
<:whytho_emoji:1269240504575459370>
<:nerdbait_emoji:1269240517062033551>
<:sideeye_emoji:1269240401248784426>
<:snoozing_emoji:1269240452029349960>
<:adoring_emoji:1269240435998724196>
<:maskoff_emoji:1269240500595068988>
<:lennyface_emoji:1269240426817261578>
<:attentive_emoji:1269240445779574806>
<:1053friendzone:1269240393158098985>
<:ominous_emoji:1269240422941855774>
<:roll_safe:1269243611028131861>
<:pepe_hmm:1269243615557718068>
<a:nitro_24_months:1269243031912189992>
<:Dead_body_report:1520007220992151552>
<a:steve:1269179125550153779>
<:rules:1269179117442433057>
<a:pepe_ahh:1269179151986720768>
<a:boo:1269179293829955624>
<:pepe_yes:1269223987381141554>
<:support:1520007840503431219>
<a:verify_black:1269225330602938428>
<:pepe_dressed:1269224042787897374>
<a:verify_orange:1269225411355869205>
<:pepe_monkas:1269224080142372864>
<:pepe_okay:1269224125012901959>
<:pepe_diamond_sword:1269224129723236352>
<:pepe_angel:1269224019626950737>
<:pepe_exhausted:1269224134601084959>
<:pepe_no:1269224107036381300>
<:pepe_gun:1269223992519163946>
<a:pepe_rich:1269224069576921220>
<:pepe_lmao:1269224148358533120>
<:pepe_cheer:1269224111884865598>
<a:verify_light_yellow:1269225520877535366>
<a:verify_light_blue:1269225532248031333>
<a:verify_green:1269225509749788703>
<a:verify_blue:1269225545082867763>
<a:verify_light_pink:1269225441453936650>
<a:verify_red:1269225565601267732>
<a:verify_purple:1269225576930082836>
<a:verify_pink:1269225554117267638>
<:spotify:1269228162441543682>
<:youtube:1269228154443272303>
<:twitter:1269228146276700195>
<:tiktok:1269228150576123944>
<a:red_fire_flames:1269228315894349865>
<a:mint_fire_flames:1269228311918149633>
<a:hotpink_fire_flames:1269228320046972938>
<a:fire_flames:1269228327965560864>
<a:white_fire_flames:1269228324148740107>
<a:pink_fire_flames:1269228331979509811>
<:facecover_emoji:1269240473088823469>
<:grarr_emoji:1269240409062772748>
<:yousuredog_emoji:1269240469443838063>
<:lipbite_emoji:1269240512343179337>
<:joy_emoji:1269240416033837167>
<:munching_emoji:1269240496233119795>
<:disgust_emoji:1269240547478994995>
<:nosesniff_emoji:1269240564306546760>
<:sobbingsohard_emoji:1269240570862108715>
<:cantrepsond_emoji:1269240529795940376>
<:pleading_emoji:1269240624008138803>
<:whug_emoji:1269240598490124330>
<:blurrycry_emoji:1269240585609412698>
<:deadchat:1269240604588511326>
<:sleepy:1269240615074267136>
<:dreaming_emoji:1269240592056062095>
<a:nitro_2_months:1269242962370367613>
<a:nitro_1_months:1269242944938971168>
<a:nitro_18_months:1269242995949961278>
<:nice:1296443701295579268>
<:sufferinginside:1297233657714708574>
<:GETTHISGUYBANNED:1296447838544465984>
<:Spoigbob_AmEvilSegma:1298865045416972370>
<a:nitro_3_months:1269242977620987936>
<a:37496alert:1269243594913611857>
<a:nitro_9_months:1269243012257550357>
<a:nitro_12_months:1269243021770358796>
<:pepe_welcome:1269243586847707157>
<:cheese:1269247079281332305>
<:Robux:1269271852715610133>
<:Shining_Smile:1296099977814343791>
<:thinkingjojo:1299399386349961216>
<:thinkaboutit:1299399554864644126>
<:yesiamadummy:1299400437262450788>
<:soermdaddysakayzo:1299401395249610753>
<:what:1299673323080519740>
<:Cyanika:1300929909979480104>
<:gyat:1302222676722585611>
<:evilcheesy:1346640524236427315>
<:did_somebody_say_lime:1481666282028929115>
<:Cyanikasgoodbye:1519700888678039552>
<:goodbye:1519700922048184410>
<:doggosgoodbye:1519701178378616983>
<:support:1520007115815649422>
<:Rule_Book:1520007334733021197>
<:man_face:1269243619550691350>
<:73508judgepepe:1508269740269899886>
<a:DieselNOD:1508269937242673334>
<a:frfr:1508269955747942621>
<a:ucxPeepoLaughingBlastOwO:1508269951654559749>
<a:omegadance:1508269945853579273>
<:level:1508270012987736124>
<a:LS_hehe:1508269959904497696>
<:star:1508270776414113842>
<a:Miyano:1508269941734768871>
<:Staff:1508271653946396673>
<:m_staff:1508271678583472148>
<:no:1508271844686561350>
<a:pin:1508272612055318599>
<:Microphone:1508272773053550602>
<:book:1508272497022206085>
<:Report:1508272118561898506>
<:Collab:1508271966539223082>
<:18_18_18_18_18_18:1508274315299389523>
<:sponser:1508272033765654578>
<:18_18_18_18_18:1508274340465213500>
<a:female:1508274224161362032>
<:male_male:1508274175700373566>
<:report:1508272136698204240>
<:PUBG:1508274562310213774>
<:Minecraft:1508274456437592255>
<:FREEFIRE:1508274583319609354>
<:Roblox:1508274713493770376>
<:pubglite:1508274541775032450>
<:GTAV:1508274635509207211>
<:Valorant:1508275633254432880>
<:RULES_RULES:1508952798182506659>
<:Book:1508272538818445332>
<:YouTube:1508940607748313111>
<:pin_pin:1508273046010724412>
<a:party2:1508953028076503182>
`;

interface ParsedEmoji {
  name: string;
  id: string;
  animated: boolean;
}

function parseEmojis(text: string): ParsedEmoji[] {
  const regex = /<(a?):([A-Za-z0-9_]+):([0-9]+)>/g;
  const list: ParsedEmoji[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    list.push({
      animated: match[1] === "a",
      name: match[2],
      id: match[3],
    });
  }
  return list;
}

export async function uploadAllEmojisToGodsEye(client: Client): Promise<void> {
  const parsed = parseEmojis(EMOJI_TEXT);
  logger.info(`[BULK EMOJI] Parsed ${parsed.length} total emojis to upload.`);

  try {
    let guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) {
      logger.info(`[BULK EMOJI] Fetching guild by ID ${GUILD_ID} failed, trying cache / name search fallback...`);
      // Try to find the guild in cache by ID or name
      guild = client.guilds.cache.get(GUILD_ID) || 
              client.guilds.cache.find((g) => g.name.toLowerCase().includes("god") && g.name.toLowerCase().includes("eye")) || 
              null;
    }

    if (!guild) {
      logger.info("[BULK EMOJI] Guild 'god's eye' not found. Scanning for any server where the bot has administrator or manage emoji permissions to populate custom emojis...");
      guild = client.guilds.cache.find((g) => {
        const me = g.members.me;
        return (
          me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions) ||
          me?.permissions.has(PermissionFlagsBits.Administrator) ||
          false
        );
      }) || null;
    }

    if (!guild) {
      logger.error("[BULK EMOJI] Could not find any server in the bot's cache where it has permissions to upload/manage emojis.");
      return;
    }

    logger.info(`[BULK EMOJI] Connected to Guild: ${guild.name} (ID: ${guild.id})`);

    await guild.emojis.fetch();
    const currentEmojis = guild.emojis.cache;
    const staticCount = currentEmojis.filter(e => !e.animated).size;
    const animatedCount = currentEmojis.filter(e => e.animated).size;

    let limit = 50;
    if (guild.premiumTier === 1) limit = 100;
    if (guild.premiumTier === 2) limit = 150;
    if (guild.premiumTier === 3) limit = 250;

    const remainingStatic = Math.max(0, limit - staticCount);
    const remainingAnimated = Math.max(0, limit - animatedCount);

    logger.info(
      `[BULK EMOJI] Status: Boost Level ${guild.premiumTier}. Static: ${staticCount}/${limit} (rem: ${remainingStatic}), Animated: ${animatedCount}/${limit} (rem: ${remainingAnimated})`
    );

    let uploadedStatic = 0;
    let uploadedAnimated = 0;
    let failed = 0;
    let alreadyExists = 0;

    // Filter out duplicates and only upload what fits
    for (const emoji of parsed) {
      const exists = currentEmojis.some(e => e.name === emoji.name);
      if (exists) {
        alreadyExists++;
        continue;
      }

      const isAnimated = emoji.animated;
      if (isAnimated && uploadedAnimated >= remainingAnimated) {
        continue; // No slots left for animated
      }
      if (!isAnimated && uploadedStatic >= remainingStatic) {
        continue; // No slots left for static
      }

      const ext = isAnimated ? "gif" : "png";
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;

      try {
        const res = await fetch(emojiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to download emoji ${emoji.name} from ${emojiUrl}: Status ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await guild.emojis.create({
          attachment: buffer,
          name: emoji.name,
          reason: "Bulk emoji sync request",
        });

        if (isAnimated) {
          uploadedAnimated++;
        } else {
          uploadedStatic++;
        }
        logger.info(`[BULK EMOJI] Successfully uploaded ${isAnimated ? "animated" : "static"}: :${emoji.name}:`);

        // Small timeout to respect rate limits
        await new Promise(r => setTimeout(r, 700));
      } catch (err: any) {
        logger.warn(`[BULK EMOJI] Error uploading :${emoji.name}: - ${err.message || err}`);
        failed++;
      }
    }

    logger.info(
      `[BULK EMOJI] Finished: Uploaded ${uploadedStatic} static, ${uploadedAnimated} animated. Already exists: ${alreadyExists}, Failed: ${failed}.`
    );

  } catch (err) {
    logger.error({ err }, "[BULK EMOJI] General bulk upload error");
  }
}
