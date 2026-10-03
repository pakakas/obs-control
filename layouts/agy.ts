import { OBSWebSocketClient } from "../switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "..", "config.json");
const CANVAS_UUID = "7b16b6bd-e632-475e-80fb-090e7dc91868"; // Aitum Vertical Canvas UUID

export const AGY_VERTICAL_LAYOUT = {
  sceneName: "Vertical - Antigravity",
  sourceName: "Antigravity Window",
  transform: {
    positionX: 37,
    positionY: 197,
    alignment: 5, // Top-Left
    boundsAlignment: 9,
    boundsType: "OBS_BOUNDS_SCALE_OUTER",
    boundsWidth: 1035,
    boundsHeight: 1374,
    cropRight: 1352,
    cropLeft: 0,
    cropTop: 0,
    cropBottom: 0,
    cropToBounds: true
  }
};

export async function applyAgyVerticalLayout() {
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
    console.log("⚡ Menerapkan layout presisi ke 'Vertical - Antigravity'...");

    const items = await obs.call("GetSceneItemList", {
      sceneName: AGY_VERTICAL_LAYOUT.sceneName,
      canvasUuid: CANVAS_UUID
    });

    const agyItem = items.sceneItems?.find((i: any) => i.sourceName === AGY_VERTICAL_LAYOUT.sourceName);

    if (!agyItem) {
      throw new Error(`Source '${AGY_VERTICAL_LAYOUT.sourceName}' tidak ditemukan di scene '${AGY_VERTICAL_LAYOUT.sceneName}'`);
    }

    await obs.call("SetSceneItemTransform", {
      sceneName: AGY_VERTICAL_LAYOUT.sceneName,
      sceneItemId: agyItem.sceneItemId,
      canvasUuid: CANVAS_UUID,
      sceneItemTransform: AGY_VERTICAL_LAYOUT.transform
    });

    console.log("✓ Layout Antigravity Vertikal berhasil diterapkan:");
    console.log(`  - Posisi: X=${AGY_VERTICAL_LAYOUT.transform.positionX}, Y=${AGY_VERTICAL_LAYOUT.transform.positionY}`);
    console.log(`  - Bounds: W=${AGY_VERTICAL_LAYOUT.transform.boundsWidth}, H=${AGY_VERTICAL_LAYOUT.transform.boundsHeight}`);
    console.log(`  - Crop Right: ${AGY_VERTICAL_LAYOUT.transform.cropRight}px (Zoom In)`);

    await obs.disconnect();
  } catch (err: any) {
    console.error("❌ Gagal menerapkan layout:", err.message);
  }
}

if (import.meta.main) {
  applyAgyVerticalLayout();
}
