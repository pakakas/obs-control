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
  const inputName = process.argv[2];
  const windowValue = process.argv[3];
  const method = process.argv[4] ? parseInt(process.argv[4], 10) : 2;

  if (!inputName || !windowValue) {
    console.log("Usage: bun update_input.ts <inputName> <windowValue> [method: 0|1|2]");
    process.exit(1);
  }

  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");
  await obs.connect();

  try {
    await obs.call("SetInputSettings", {
      inputName,
      inputSettings: {
        window: windowValue,
        method: method, // 2 = Windows 10/11 WGC (Windows Graphics Capture)
        priority: 1, // Window Title must match
        cursor: false,
        client_area: false
      }
    });

    console.log(`✓ Input "${inputName}" berhasil diupdate:`);
    console.log(`  Window: "${windowValue}"`);
    console.log(`  Method: ${method} (WGC Capture)`);
  } catch (err: any) {
    console.error("Gagal update input settings:", err.message);
  }

  obs.disconnect();
}

main();
