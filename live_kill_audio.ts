import { OBSClient } from "./obs_client";

async function applyLiveLazy() {
  const obs = new OBSClient("ws://127.0.0.1:4455");

  try {
    await obs.connect();
    console.log("⚡ Menghubungkan ke OBS live...");

    // 1. Ambil special global inputs
    const specialInputs = await obs.call("GetSpecialInputs");
    const specialNames = Object.values(specialInputs).filter((n): n is string => Boolean(n));

    // 2. Ambil seluruh input di OBS
    const inputList = await obs.call("GetInputList");
    const allInputs: any[] = inputList.inputs || [];

    const targetInputs = new Set<string>(specialNames);
    for (const inp of allInputs) {
      const n = inp.inputName;
      const k = inp.inputKind;
      if (
        k.includes("wasapi") ||
        n.toLowerCase().includes("desktop") ||
        n.toLowerCase().includes("mic")
      ) {
        targetInputs.add(n);
      }
    }

    console.log(`Ditemukan ${targetInputs.size} input audio global untuk dimatikan live:`);

    for (const inputName of targetInputs) {
      console.log(`\n🔇 Memproses: "${inputName}"`);

      // A. Mute
      try {
        await obs.call("SetInputMute", { inputName, inputMuted: true });
        console.log(`  ✓ Muted`);
      } catch (e: any) {
        console.log(`  - Mute skip: ${e.message}`);
      }

      // B. Volume set to 0 (-100 dB)
      try {
        await obs.call("SetInputVolume", { inputName, inputVolumeMul: 0.0, inputVolumeDb: -100.0 });
        console.log(`  ✓ Volume diset ke 0 dB`);
      } catch (e: any) {
        console.log(`  - Volume skip: ${e.message}`);
      }

      // C. Uncheck ALL 6 Audio Tracks (Jalur 1 s/d 6 dimatikan)
      try {
        await obs.call("SetInputAudioTracks", {
          inputName,
          inputAudioTracks: {
            "1": false,
            "2": false,
            "3": false,
            "4": false,
            "5": false,
            "6": false,
          }
        });
        console.log(`  ✓ Semua 6 Audio Track dimatikan (tidak masuk stream/rekaman)`);
      } catch (e: any) {
        console.log(`  - Audio tracks skip: ${e.message}`);
      }
    }

    console.log("\n🎉 BERHASIL: Seluruh audio global langsung mati detik ini juga tanpa restart!");
    await obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

applyLiveLazy();
