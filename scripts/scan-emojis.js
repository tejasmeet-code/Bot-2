import fs from "fs";
import path from "path";

// Regex for direct unicode symbols/emojis
const UNICODE_EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{231A}-\u{231B}\u{23ED}-\u{23EF}\u{23F0}\u{23F3}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{3297}\u{3299}\u{00AE}\u{00A9}\u{203C}\u{2049}\u{20E3}\u{3030}\u{303D}]/u;

// Regex for shortcodes :name: not in <:name:id> or <a:name:id>
const SHORTCODE_REGEX = /(?<!<a?):([a-z0-9_+-]+):(?![\d>])/gi;

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (file.endsWith(".ts") || file.endsWith(".js")) {
      callback(fullPath);
    }
  }
}

const matches = [];

walkDir("./artifacts/api-server/src", (filePath) => {
  if (filePath.includes("node_modules") || filePath.includes("dist")) return;
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const trimmed = lineText.trim();

    // Ignore comment lines
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    // Ignore internal UNICODE_FALLBACKS map in embedStyle.ts
    if (filePath.includes("embedStyle.ts") && lineNum >= 15 && lineNum <= 81) return;

    // Check direct unicode emoji
    if (UNICODE_EMOJI_REGEX.test(lineText)) {
      matches.push({
        file: filePath,
        line: lineNum,
        type: "unicode",
        text: trimmed
      });
    }

    // Check shortcodes
    let match;
    const regex = new RegExp(SHORTCODE_REGEX);
    while ((match = regex.exec(lineText)) !== null) {
      const code = match[0];
      const name = match[1];

      // Exclude technical false positives (URLs, custom string splitters, etc.)
      if (code === ":http:" || code === ":https:" || code === "::") continue;
      if (trimmed.includes(`http:${code}`) || trimmed.includes(`https:${code}`)) continue;
      if (trimmed.includes("customId") && trimmed.includes("appeal:dm:")) continue;

      matches.push({
        file: filePath,
        line: lineNum,
        type: "shortcode",
        code: code,
        text: trimmed
      });
    }
  });
});

console.log(`TOTAL_UI_MATCHES:${matches.length}`);
matches.forEach((m, i) => {
  console.log(`[${i + 1}] File: ${m.file}:${m.line} (${m.type}) -> ${m.text}`);
});
