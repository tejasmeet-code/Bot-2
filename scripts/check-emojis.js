#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs'), path = require('path');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'bin', 'artifacts/api-server/bin']);
const SKIP_FILES = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|emoji_report\.txt|check-emojis\.js|yt-dlp)$/;
const BIN = /\.(png|jpe?g|gif|webp|ico|mp3|mp4|wav|ogg|zip|gz|pdf|woff2?|ttf|otf|sqlite|db)$/i;

// Real emoji: pictographs, emoji-presentation, flags, skin tones, keycap/variation/joiner parts
const UNI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u20E3\uFE0F\u200D]/gu;
// Decorative symbols (arrows, bullets, box/shape/dingbats). Reported for review.
const SYM = /[\u2022\u2023\u25E6\u2190-\u21FF\u2500-\u25FF\u2600-\u27BF\u2B00-\u2BFF]/gu;
// :shortcode: but NOT custom <:name:id> / <a:name:id>, times, or URLs
const SHORT = /(?<![\w<]):([a-z_][a-z0-9_+\-]*):(?!\d)/gi;

const cp = n => { try { return String.fromCodePoint(n); } catch { return ''; } };
const decode = s => s
  .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => cp(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => cp(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)));

function scanLine(line) {
  const hits = [];
  for (const m of line.matchAll(UNI)) hits.push({ type: 'unicode', text: m[0] });
  const stripped = line.replace(UNI, '');
  const dec = decode(stripped);
  if (dec !== stripped) for (const m of dec.matchAll(UNI)) hits.push({ type: 'escaped', text: m[0] });
  for (const m of line.matchAll(SHORT)) hits.push({ type: 'shortcode', text: m[0] });
  for (const m of line.matchAll(SYM)) if (!UNI.test(m[0])) hits.push({ type: 'symbol(review)', text: m[0] });
  UNI.lastIndex = 0;
  return hits;
}

function selfTest() {
  const must = ['✅', '❌', '⚠️', '🎵', '1️⃣', '⭐', '▶️', '🇮🇳', '👍🏽', '\\u2705', '\\uD83C\\uDFB5', '\\u{1F3B5}', '&#x2705;', ':musical_note:', ':white_check_mark:'];
  const mustNot = ['<:ok:123456789012345678>', '<a:spin:123456789012345678>', 'at 12:30:45', 'https://example.com'];
  let ok = true;
  for (const t of must) if (!scanLine(t).some(h => h.type !== 'symbol(review)')) { console.log('MISSED:', t); ok = false; }
  for (const t of mustNot) if (scanLine(t).some(h => h.type !== 'symbol(review)')) { console.log('FALSE POSITIVE:', t); ok = false; }
  console.log(ok ? 'SELF-TEST PASSED' : 'SELF-TEST FAILED');
  return ok;
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(p); }
    else if (!SKIP_FILES.test(e.name) && !BIN.test(e.name)) yield p;
  }
}

if (!selfTest()) process.exit(2);
if (process.argv.includes('--self-test')) process.exit(0);

const out = []; const perFile = {}; let failing = 0, review = 0;
for (const f of walk(process.argv[2] || '.')) {
  let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  txt.split(/\r?\n/).forEach((line, i) => {
    for (const h of scanLine(line)) {
      out.push(`${f}:${i + 1}: [${h.type}] ${h.text}   <- ${line.trim().slice(0, 120)}`);
      perFile[f] = (perFile[f] || 0) + 1;
      h.type === 'symbol(review)' ? review++ : failing++;
    }
  });
}
out.push('', '--- PER FILE ---', ...Object.entries(perFile).map(([f, n]) => `${n}\t${f}`));
out.push('', `TOTAL emoji/shortcode hits: ${failing}`, `TOTAL symbols to review: ${review}`);
fs.writeFileSync('emoji_report.txt', out.join('\n'));
console.log(out.slice(-40).join('\n'));
process.exit(failing ? 1 : 0);
