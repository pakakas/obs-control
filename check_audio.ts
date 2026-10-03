import { OBSClient } from "./obs_client";

async function checkAudioStatus() {
  const obs = new OBSClient("ws://127.0.0.1:4455");
  try {
    await obs.connect();
    const specials = await obs.call("GetSpecialInputs");
    console.log("Special inputs:", specials);

    const inputs = await obs.call("GetInputList");
    for (const inp of inputs.inputs || []) {
      try {
        const muteStatus = await obs.call("GetInputMute", { inputName: inp.inputName });
        console.log(`- ${inp.inputName} (${inp.inputKind}): Muted = ${muteStatus.inputMuted}`);
      } catch {}
    }
    await obs.disconnect();
    process.exit(0);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

checkAudioStatus();
