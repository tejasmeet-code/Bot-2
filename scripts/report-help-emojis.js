import fs from "fs";
import path from "path";

const files = [
  "artifacts/api-server/src/discord/commands/help.ts",
  "artifacts/api-server/src/discord/commands/music.ts",
  "artifacts/api-server/src/discord/commands/ping.ts",
  "artifacts/api-server/src/discord/commands/botinfo.ts",
  "artifacts/api-server/src/discord/commands/serverinfo.ts",
  "artifacts/api-server/src/discord/commands/userinfo.ts",
  "artifacts/api-server/src/discord/commands/rank.ts",
  "artifacts/api-server/src/discord/commands/config.ts",
  "artifacts/api-server/src/discord/commands/automod.ts",
  "artifacts/api-server/src/discord/commands/antinuke.ts",
  "artifacts/api-server/src/discord/commands/premium.ts",
  "artifacts/api-server/src/discord/utils/embedStyle.ts"
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const lines = fs.readFileSync(f, "utf-8").split("\n");
    lines.forEach((line, idx) => {
      if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u.test(line) || /(?<!<a?):[a-z0-9_+-]+:(?![\d>])/i.test(line)) {
        if (line.trim().startsWith("//") || line.trim().startsWith("/*")) return;
        console.log(`${f}:${idx + 1} | ${line.trim()}`);
      }
    });
  }
});
