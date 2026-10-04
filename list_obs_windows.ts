import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {}
  return { obs_url: "ws://127.0.0.1:4455", obs_password: "" };
}

async function main() {
  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");
  await obs.connect();

  const filter = (process.argv[2] || "").toLowerCase();

  try {
    const res = await obs.call("GetInputPropertiesListPropertyItems", {
      inputName: "talk",
      propertyName: "window"
    });

    const items: Array<{ itemName: string; itemValue: string }> = res.propertyItems || [];
    console.log(`\n=== WINDOWS AVAILABLE IN OBS (${items.length}) ===`);
    for (const item of items) {
      if (!filter || item.itemName.toLowerCase().includes(filter) || item.itemValue.toLowerCase().includes(filter)) {
        console.log(`- Value: "${item.itemValue}"`);
        console.log(`  Name:  "${item.itemName}"\n`);
      }
    }
  } catch (err: any) {
    console.error("Error getting windows from OBS:", err.message);
  }

  obs.disconnect();
}

main();
