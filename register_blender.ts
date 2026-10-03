import { OBSClient } from "./obs_client";

async function main() {
  const obs = new OBSClient("ws://127.0.0.1:4455");

  try {
    console.log("Menghubungkan ke OBS WebSocket...");
    await obs.connect();
    console.log("✅ Terhubung ke OBS!");

    // 1. Cek apakah scene "Blender" sudah ada
    await obs.refreshScenes();
    console.log("Scenes saat ini:", obs.availableScenes);

    const sceneName = "Blender";
    const exists = obs.availableScenes.some(s => s.toLowerCase() === sceneName.toLowerCase());

    if (!exists) {
      console.log(`Membuat Scene "${sceneName}" di OBS...`);
      await obs.call("CreateScene", { sceneName });
      console.log(`✅ Berhasil membuat Scene "${sceneName}"!`);
    } else {
      console.log(`ℹ️ Scene "${sceneName}" sudah terdaftar di OBS.`);
    }

    // 2. Coba tambahkan Window Capture Blender ke dalam scene Blender jika belum ada
    try {
      console.log(`Menambahkan Source Window Capture untuk Blender...`);
      await obs.call("CreateInput", {
        sceneName,
        inputName: "Blender Window",
        inputKind: "window_capture",
        inputSettings: {
          // Window capture configuration for Windows (Graphics Capture method)
          priority: 2, // Match title, otherwise find window of same executable
        }
      });
      console.log("✅ Berhasil menambahkan Source 'Blender Window'!");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("ℹ️ Source 'Blender Window' sudah ada di scene.");
      } else {
        console.log("Catatan Source:", e.message);
      }
    }

    // 3. Switch ke scene Blender untuk konfirmasi
    await obs.switchScene(sceneName);
    console.log(`🎬 Berhasil switch program scene ke: "${sceneName}"`);

    await obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
