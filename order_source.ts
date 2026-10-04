import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "config.json");
const CANVAS_UUID = "7b16b6bd-e632-475e-80fb-090e7dc91868";

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {}
  return { obs_url: "ws://127.0.0.1:4455", obs_password: "" };
}

async function main() {
  const targetName = process.argv[2] || "talk";
  const position = process.argv[3] || "bottom"; // "bottom" (0) | "top" | number

  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");
  await obs.connect();

  console.log(`Mengatur urutan source "${targetName}" ke posisi "${position}"...`);

  // Helper to reorder in a scene
  async function reorderInScene(sceneName: string, isVertical: boolean) {
    const canvasParam = isVertical ? { canvasUuid: CANVAS_UUID } : {};
    try {
      const itemsRes = await obs.call("GetSceneItemList", { sceneName, ...canvasParam });
      const items: any[] = itemsRes.sceneItems || [];
      const item = items.find((i: any) => i.sourceName.toLowerCase() === targetName.toLowerCase());

      if (!item) return;

      let newIndex = 0;
      if (position === "bottom") {
        newIndex = 0;
      } else if (position === "top") {
        newIndex = items.length - 1;
      } else {
        newIndex = parseInt(position, 10);
      }

      const params: any = {
        sceneName,
        sceneItemId: item.sceneItemId,
        sceneItemIndex: newIndex
      };
      if (isVertical) params.canvasUuid = CANVAS_UUID;

      await obs.call("SetSceneItemIndex", params);
      console.log(`✓ [${sceneName}] "${item.sourceName}" dipindah ke index ${newIndex} (${position})`);
    } catch (err: any) {
      console.log(`✗ [${sceneName}] Gagal: ${err.message}`);
    }
  }

  // 1. Get Main Scenes
  const { scenes: mainScenes } = await obs.call("GetSceneList");
  for (const s of mainScenes) {
    await reorderInScene(s.sceneName, false);
  }

  // 2. Get Vertical Scenes
  let verticalSceneNames = ["v-vscode", "v-terminal", "v-chat", "v-blender", "v-wallpaper"];
  try {
    const vRes = await obs.call("CallVendorRequest", {
      vendorName: "aitum-vertical-canvas",
      requestType: "get_scenes",
      requestData: {}
    });
    if (vRes?.responseData?.scenes) {
      verticalSceneNames = vRes.responseData.scenes.map((s: any) => s.name);
    }
  } catch {}

  for (const vScene of verticalSceneNames) {
    await reorderInScene(vScene, true);
  }

  obs.disconnect();
  console.log("\nSelesai!");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
