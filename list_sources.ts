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
  const target = process.argv[2];
  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");

  try {
    await obs.connect();

    if (target) {
      console.log(`\n=== INSPECT INPUT: "${target}" ===`);
      try {
        const settings = await obs.call("GetInputSettings", { inputName: target });
        console.log("Settings:", JSON.stringify(settings, null, 2));
      } catch (err: any) {
        console.error(`Gagal inspect "${target}":`, err.message);
      }
      obs.disconnect();
      process.exit(0);
    }
    
    // Video / Canvas info
    try {
      const video = await obs.call("GetVideoSettings");
      console.log(`\n=== OBS CANVAS / VIDEO ===`);
      console.log(`Main Canvas:     ${video.baseWidth}x${video.baseHeight} (Output: ${video.outputWidth}x${video.outputHeight} @ ${(video.fpsNumerator / video.fpsDenominator).toFixed(0)}fps)`);
      console.log(`Vertical Canvas: 1080x1920`);
    } catch {}

    // 1. Get Scene List & their items
    const sceneData = await obs.call("GetSceneList");
    const currentScene = sceneData.currentProgramSceneName;
    const scenes: any[] = sceneData.scenes || [];

    console.log(`\n=== SCENES (${scenes.length}) [Active: ${currentScene}] ===`);
    for (const s of scenes) {
      const isCurrent = s.sceneName === currentScene ? " * (ACTIVE)" : "";
      console.log(`\n[Scene] ${s.sceneName}${isCurrent}`);
      try {
        const itemsRes = await obs.call("GetSceneItemList", { sceneName: s.sceneName });
        const items: any[] = itemsRes.sceneItems || [];
        if (items.length === 0) {
          console.log("  (no sources)");
        } else {
          // Sort top-most first (descending sceneItemIndex)
          items.sort((a, b) => b.sceneItemIndex - a.sceneItemIndex);
          for (const item of items) {
            const status = item.sceneItemEnabled ? "ENABLED" : "MUTED/OFF";
            console.log(`  - [${item.sceneItemIndex}] ${item.sourceName} (${item.inputKind || item.sourceType}) [${status}]`);
          }
        }
      } catch (err: any) {
        console.log(`  Error getting items: ${err.message}`);
      }
    }

    // 1b. Check Aitum Vertical Canvas scenes/sources
    const CANVAS_UUID = "7b16b6bd-e632-475e-80fb-090e7dc91868";
    console.log(`\n=== VERTICAL CANVAS / SCENES ===`);
    let foundVertical = false;

    // Check with canvasUuid
    for (const prefix of ["", "v-", "Vertical - "]) {
      for (const s of scenes) {
        const testName = prefix ? (prefix + s.sceneName) : s.sceneName;
        try {
          const itemsRes = await obs.call("GetSceneItemList", {
            sceneName: testName,
            canvasUuid: CANVAS_UUID
          });
          const items: any[] = itemsRes.sceneItems || [];
          if (items.length > 0) {
            foundVertical = true;
            console.log(`\n[Vertical Scene] ${testName}`);
            items.sort((a, b) => b.sceneItemIndex - a.sceneItemIndex);
            for (const item of items) {
              const status = item.sceneItemEnabled ? "ENABLED" : "MUTED/OFF";
              console.log(`  - [${item.sceneItemIndex}] ${item.sourceName} (${item.inputKind || item.sourceType}) [${status}]`);
            }
          }
        } catch {}
      }
    }

    if (!foundVertical) {
      console.log("Tidak ada scene terpisah di kanvas vertikal (atau canvasUuid tidak aktif).");
    }

    // 2. Global Input List
    try {
      const inputsRes = await obs.call("GetInputList");
      const inputs: any[] = inputsRes.inputs || [];
      console.log(`\n=== ALL GLOBAL INPUTS (${inputs.length}) ===`);
      for (const input of inputs) {
        console.log(`- ${input.inputName} (${input.inputKind})`);
      }
    } catch {}

    obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("Gagal terhubung ke OBS:", err.message);
    process.exit(1);
  }
}

main();
