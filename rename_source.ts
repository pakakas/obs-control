import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return { obs_url: "ws://127.0.0.1:4455", obs_password: "" };
}

async function main() {
  const oldName = process.argv[2];
  const newName = process.argv[3];

  if (!oldName || !newName) {
    console.error("Usage: bun rename_source.ts <oldName> <newName>");
    process.exit(1);
  }

  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");

  try {
    await obs.connect();
    console.log(`Mengganti nama input dari "${oldName}" ke "${newName}"...`);
    
    await obs.call("SetInputName", {
      inputName: oldName,
      newInputName: newName
    });

    console.log(`Sukses! Input "${oldName}" berhasil di-rename menjadi "${newName}".`);
    obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error(`Gagal rename input:`, err.message);
    obs.disconnect();
    process.exit(1);
  }
}

main();
