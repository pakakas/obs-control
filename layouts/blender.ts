import { OBSWebSocketClient } from "../switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "..", "config.json");
const CANVAS_UUID = "7b16b6bd-e632-475e-80fb-090e7dc91868";

export const BLENDER_VERTICAL_LAYOUT = {
  sceneName: "Vertical - Blender",
  sourceName: "Blender Window",
  transform: {
    positionX: 37,
    positionY: 197,
    alignment: 5, // Top-Left
    boundsAlignment: 0, // Center focus inside frame
    boundsType: "OBS_BOUNDS_SCALE_OUTER",
    boundsWidth: 1035,
    boundsHeight: 1374,
    cropToBounds: true
  }
};

export async function applyBlenderVerticalLayout() {
  let obsPassword = "";
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      obsPassword = cfg.obs_password || "";
    }
  } catch {}

  const obs = new OBSWebSocketClient("ws://127.0.0.1:4455", obsPassword);

  try {
    await obs.connect();
    console.log("⚡ Menerapkan layout presisi ke 'Vertical - Blender'...");

    const items = await obs.call("GetSceneItemList", {
      sceneName: BLENDER_VERTICAL_LAYOUT.sceneName,
      canvasUuid: CANVAS_UUID
    });

    const blItem = items.sceneItems?.find((i: any) => i.sourceName === BLENDER_VERTICAL_LAYOUT.sourceName);

    if (!blItem) {
      throw new Error(`Source '${BLENDER_VERTICAL_LAYOUT.sourceName}' tidak ditemukan di scene '${BLENDER_VERTICAL_LAYOUT.sceneName}'`);
    }

    await obs.call("SetSceneItemTransform", {
      sceneName: BLENDER_VERTICAL_LAYOUT.sceneName,
      sceneItemId: blItem.sceneItemId,
      canvasUuid: CANVAS_UUID,
      sceneItemTransform: BLENDER_VERTICAL_LAYOUT.transform
    });

    console.log("✓ Layout Blender Vertikal berhasil diterapkan!");
    await obs.disconnect();
  } catch (err: any) {
    console.error("❌ Gagal menerapkan layout:", err.message);
  }
}

if (import.meta.main) {
  applyBlenderVerticalLayout();
}
