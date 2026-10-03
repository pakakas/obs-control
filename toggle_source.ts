import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "config.json");
const CANVAS_UUID = "7b16b6bd-e632-475e-80fb-090e7dc91868";

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return { obs_url: "ws://127.0.0.1:4455", obs_password: "" };
}

async function main() {
  const targetPattern = process.argv[2];
  const stateArg = process.argv[3]; // "enable", "disable", "on", "off", default: disable

  if (!targetPattern) {
    console.error("Usage: bun toggle_source.ts <sourceNamePattern> [enable|disable]");
    process.exit(1);
  }

  const shouldEnable = stateArg === "enable" || stateArg === "on" || stateArg === "true";
  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");

  try {
    await obs.connect();
    const patternLower = targetPattern.toLowerCase();

    // 1. Get Scene List
    const sceneData = await obs.call("GetSceneList");
    const scenes: any[] = sceneData.scenes || [];
    let updatedCount = 0;

    // Helper to check & update items in a scene
    async function processScene(sceneName: string, canvasUuid?: string) {
      try {
        const params: any = { sceneName };
        if (canvasUuid) params.canvasUuid = canvasUuid;

        const itemsRes = await obs.call("GetSceneItemList", params);
        const items: any[] = itemsRes.sceneItems || [];

        for (const item of items) {
          if (item.sourceName.toLowerCase().includes(patternLower)) {
            const setParams: any = {
              sceneName,
              sceneItemId: item.sceneItemId,
              sceneItemEnabled: shouldEnable
            };
            if (canvasUuid) setParams.canvasUuid = canvasUuid;

            await obs.call("SetSceneItemEnabled", setParams);
            const statusStr = shouldEnable ? "ENABLED" : "DISABLED";
            console.log(`✓ [${sceneName}] ${item.sourceName} ➔ ${statusStr}`);
            updatedCount++;
          }
        }
      } catch (err: any) {
        // ignore errors for scenes that might not exist on canvas
      }
    }

    // Process main scenes
    for (const s of scenes) {
      await processScene(s.sceneName);
    }

    // Process vertical scenes
    for (const prefix of ["", "v-", "Vertical - "]) {
      for (const s of scenes) {
        const testName = prefix ? (prefix + s.sceneName) : s.sceneName;
        await processScene(testName, CANVAS_UUID);
      }
    }

    if (updatedCount === 0) {
      console.log(`Tidak ada source yang cocok dengan pola: "${targetPattern}"`);
    } else {
      console.log(`\nSelesai! ${updatedCount} source item berhasil di-${shouldEnable ? "enable" : "disable"}.`);
    }

    obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("Gagal terhubung ke OBS:", err.message);
    process.exit(1);
  }
}

main();
