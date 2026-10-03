import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";

async function normalizeLandscapeScenes() {
  const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));
  const obs = new OBSWebSocketClient("ws://127.0.0.1:4455", cfg.obs_password || "");

  try {
    await obs.connect();
    console.log("⚡ Menormalkan seluruh scene Lanskap ke Fullscreen 1920x1080...");

    // 1. Normalisasi Scene "Antigravity"
    try {
      const agyItems = await obs.call("GetSceneItemList", { sceneName: "Antigravity" });
      const agyItem = agyItems.sceneItems?.find((i: any) => i.sourceName === "Antigravity Window");
      if (agyItem) {
        await obs.call("SetSceneItemTransform", {
          sceneName: "Antigravity",
          sceneItemId: agyItem.sceneItemId,
          sceneItemTransform: {
            positionX: 0,
            positionY: 0,
            alignment: 5, // Top-Left
            boundsType: "OBS_BOUNDS_SCALE_INNER",
            boundsWidth: 1920,
            boundsHeight: 1080,
            boundsAlignment: 0, // Center
            cropLeft: 0,
            cropRight: 0,
            cropTop: 0,
            cropBottom: 0,
            cropToBounds: false
          }
        });
        console.log("✓ 'Antigravity Window' di scene Lanskap berhasil dinormalkan (Fullscreen 1920x1080)!");
      }

      // Aktifkan BGM di scene Antigravity
      const bgmItem = agyItems.sceneItems?.find((i: any) => i.sourceName === "Brave Music BGM");
      if (bgmItem) {
        await obs.call("SetSceneItemEnabled", {
          sceneName: "Antigravity",
          sceneItemId: bgmItem.sceneItemId,
          sceneItemEnabled: true
        });
        console.log("✓ 'Brave Music BGM' di scene Antigravity diaktifkan!");
      }
    } catch (e: any) {
      console.log("Info Antigravity:", e.message);
    }

    // 2. Normalisasi Scene "Blender"
    try {
      const blItems = await obs.call("GetSceneItemList", { sceneName: "Blender" });
      const blItem = blItems.sceneItems?.find((i: any) => i.sourceName === "Blender Window");
      if (blItem) {
        await obs.call("SetSceneItemTransform", {
          sceneName: "Blender",
          sceneItemId: blItem.sceneItemId,
          sceneItemTransform: {
            positionX: 0,
            positionY: 0,
            alignment: 5, // Top-Left
            boundsType: "OBS_BOUNDS_SCALE_INNER",
            boundsWidth: 1920,
            boundsHeight: 1080,
            boundsAlignment: 0, // Center
            cropLeft: 0,
            cropRight: 0,
            cropTop: 0,
            cropBottom: 0,
            cropToBounds: false
          }
        });
        console.log("✓ 'Blender Window' di scene Lanskap berhasil dinormalkan (Fullscreen 1920x1080)!");
      }

      // Aktifkan BGM di scene Blender
      const bgmItem = blItems.sceneItems?.find((i: any) => i.sourceName === "Brave Music BGM");
      if (bgmItem) {
        await obs.call("SetSceneItemEnabled", {
          sceneName: "Blender",
          sceneItemId: bgmItem.sceneItemId,
          sceneItemEnabled: true
        });
        console.log("✓ 'Brave Music BGM' di scene Blender diaktifkan!");
      }
    } catch (e: any) {
      console.log("Info Blender:", e.message);
    }

    // 3. Normalisasi Scene "Wallpaper"
    try {
      const wpItems = await obs.call("GetSceneItemList", { sceneName: "Wallpaper" });
      const wpItem = wpItems.sceneItems?.find((i: any) => i.sourceName === "Wallpaper Browser");
      if (wpItem) {
        await obs.call("SetSceneItemTransform", {
          sceneName: "Wallpaper",
          sceneItemId: wpItem.sceneItemId,
          sceneItemTransform: {
            positionX: 0,
            positionY: 0,
            alignment: 5,
            boundsType: "OBS_BOUNDS_SCALE_INNER",
            boundsWidth: 1920,
            boundsHeight: 1080,
            cropLeft: 0,
            cropRight: 0,
            cropTop: 0,
            cropBottom: 0,
            cropToBounds: false
          }
        });
        console.log("✓ 'Wallpaper Browser' di scene Lanskap berhasil dinormalkan (Fullscreen 1920x1080)!");
      }

      // Non-aktifkan border overlay vertikal di Wallpaper lanskap
      const borderItem = wpItems.sceneItems?.find((i: any) => i.sourceName === "Minimalist Border Frame");
      if (borderItem) {
        await obs.call("SetSceneItemEnabled", {
          sceneName: "Wallpaper",
          sceneItemId: borderItem.sceneItemId,
          sceneItemEnabled: false
        });
      }

      // Non-aktifkan static text di Wallpaper lanskap
      const textItem = wpItems.sceneItems?.find((i: any) => i.sourceName === "Vertical Static Text");
      if (textItem) {
        await obs.call("SetSceneItemEnabled", {
          sceneName: "Wallpaper",
          sceneItemId: textItem.sceneItemId,
          sceneItemEnabled: false
        });
      }
    } catch (e: any) {
      console.log("Info Wallpaper:", e.message);
    }

    await obs.disconnect();
    console.log("\n🎉 SUKSES BESAR: Seluruh scene Lanskap (Main Canvas) telah dinormalkan menjadi Fullscreen 1920x1080!");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

normalizeLandscapeScenes();
