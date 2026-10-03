import config from "../config.json";
import { OBSClient } from "../obs_client";

async function startLive() {
  const obs = new OBSClient(config.obs_url, config.obs_password);
  try {
    await obs.connect();
    const status = await obs.call("GetStreamStatus");
    if (status.outputActive) {
      console.log("ℹ️ Stream sudah lagi jalan");
    } else {
      await obs.call("StartStream");
      console.log("🟣 Live dimulai");
    }
    obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

startLive();
