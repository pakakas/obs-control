import { OBSClient } from "./obs_client";

async function disableGlobalAudio() {
  const obs = new OBSClient("ws://127.0.0.1:4455");

  try {
    console.log("Menghubungkan ke OBS WebSocket...");
    await obs.connect();
    console.log("✅ Terhubung ke OBS!");

    // 1. Ambil daftar special / global audio inputs
    const specialInputs = await obs.call("GetSpecialInputs");
    console.log("Global / Special Inputs terdeteksi:", specialInputs);

    const inputsToMute: string[] = [];
    for (const [key, name] of Object.entries(specialInputs)) {
      if (name && typeof name === "string") {
        inputsToMute.push(name);
      }
    }

    // 2. Ambil juga semua input aktif untuk cek Desktop Audio / Mic
    const inputList = await obs.call("GetInputList");
    const allInputs: any[] = inputList.inputs || [];

    for (const inp of allInputs) {
      const name = inp.inputName;
      const kind = inp.inputKind;
      // Cek apakah jenis audio global
      if (
        kind.includes("wasapi") ||
        name.toLowerCase().includes("desktop") ||
        name.toLowerCase().includes("mic") ||
        name.toLowerCase().includes("audio")
      ) {
        if (!inputsToMute.includes(name)) {
          inputsToMute.push(name);
        }
      }
    }

    console.log("\nMematikan / Mute Global Audio Inputs:", inputsToMute);

    for (const inputName of inputsToMute) {
      try {
        await obs.call("SetInputMute", {
          inputName,
          inputMuted: true,
        });
        console.log(`🔇 [MUTED] "${inputName}" berhasil dimatikan.`);
      } catch (e: any) {
        console.log(`⚠️ Gagal mute "${inputName}":`, e.message);
      }
    }

    console.log("\n✅ Semua Global Audio Input di OBS berhasil dimatikan!");
    await obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

disableGlobalAudio();
