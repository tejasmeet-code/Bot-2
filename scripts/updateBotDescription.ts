import { Client, IntentsBitField } from "discord.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");

  const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

  client.once("ready", async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    try {
      const description = "Elite Discord Protector made by demonXtejas. 🛡️\n\nEquipped with advanced Anti-Nuke, High-Fidelity Music, and Enterprise Moderation tools.\n\n🔗 Support Server: https://discord.gg/gFgAfpSYdp\n🌟 Premium: .premium";
      
      // Update application description
      await readyClient.application.edit({
        description: description,
      });
      
      console.log("Updated application description successfully.");
    } catch (err) {
      console.error("Failed to update application description:", err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(token);
}

main().catch(console.error);
