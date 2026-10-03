import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import { exec } from "child_process";
import path from "path";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dashboard", dashboardRouter);

router.get("/download-patch", (_req, res) => {
  const tarPath = path.join(process.cwd(), "modified_files.tar.gz");
  const filesToPack = [
    "bot/discord/commands/ping.ts",
    "bot/discord/commands/botinfo.ts",
    "bot/discord/commands/ginfo.ts",
    "bot/discord/commands/hosting.ts",
    "bot/discord/commands/bot-check.ts",
    "bot/discord/messageHandler.ts",
    "bot/discord/commands/oping.ts",
    "bot/discord/music/musicManager.ts",
    "bot/discord/storage/persistentJson.ts",
    "bot/index.ts",
    "render.yaml",
    "package.json"
  ].join(" ");
  
  exec(`tar -czf "${tarPath}" ${filesToPack}`, (err) => {
    if (err) {
      res.status(500).send({ error: "Failed to create archive", details: err.message });
      return;
    }
    res.download(tarPath, "modified_files.tar.gz");
  });
  return;
});

export default router;
