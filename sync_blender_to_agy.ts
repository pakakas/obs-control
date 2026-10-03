import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";

async function syncBlenderToAgy() {
  const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
  const obs = new OBSWebSocketClient("ws://127.0.0.1:4455", cfg.obs_password || "");
  const canvasUuid = "7b16b6bd-e632-475e-80fb-090e7dc91868";

  try {
    await obs.connect();
    console.log("⚡ Mengambil ukuran persis 'Antigravity Window' di Vertikal...");

    // 1. Ambil transform terkini dari Antigravity di Vertikal
    const agyItems = await obs.call("GetSceneItemList", { sceneName: "Vertical - Antigravity", canvasUuid });
    const agyItem = agyItems.sceneItems?.find((i: any) => i.sourceName === "Antigravity Window");

    if (!agyItem) {
      throw new Error("Antigravity Window tidak ditemukan di Vertical - Antigravity");
    }

    const agyTrans = agyItem.sceneItemTransform;
    console.log("Ukuran AGY Vertikal saat ini:", {
      positionX: agyTrans.positionX,
      positionY: agyTrans.positionY,
      boundsWidth: agyTrans.boundsWidth,
      boundsHeight: agyTrans.boundsHeight,
      boundsType: agyTrans.boundsType
    });

    // 2. Terapkan ukuran dan posisi yang sama persis ke 'Blender Window' di 'Vertical - Blender'
    const blItems = await obs.call("GetSceneItemList", { sceneName: "Vertical - Blender", canvasUuid });
    const blItem = blItems.sceneItems?.find((i: any) => i.sourceName === "Blender Window");

    if (blItem) {
      await obs.call("SetSceneItemTransform", {
        sceneName: "Vertical - Blender",
        sceneItemId: blItem.sceneItemId,
        canvasUuid,
        sceneItemTransform: {
          positionX: agyTrans.positionX,
          positionY: agyTrans.positionY,
          alignment: 5, // Top-Left
          boundsAlignment: 0, // Center focus inside bounds
          boundsType: "OBS_BOUNDS_SCALE_OUTER",
          boundsWidth: agyTrans.boundsWidth,
          boundsHeight: agyTrans.boundsHeight,
          cropLeft: 0,
          cropRight: 0,
          cropTop: 0,
          cropBottom: 0,
          cropToBounds: true
        }
      });
      console.log("✓ 'Blender Window' di scene Vertikal berhasil disamakan persis dengan AGY!");
      console.log(`  - Posisi: X=${agyTrans.positionX}, Y=${agyTrans.positionY}`);
      console.log(`  - Bounds: W=${agyTrans.boundsWidth}, H=${agyTrans.boundsHeight}`);
    }

    await obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

syncBlenderToAgy();
