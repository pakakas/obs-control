import config from "./config.json";
import { OBSClient } from "./obs_client";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

async function addDancingSource() {
  const obs = new OBSClient(config.obs_url, config.obs_password);

  try {
    await obs.connect();

    const pageUrl = pathToFileURL(resolve(import.meta.dir, "dancing.html")).href;
    const sourceName = "Dancing GIF";

    // Hapus source lama jika ada
    try {
      await obs.call("RemoveInput", { inputName: sourceName });
    } catch {}

    await obs.call("CreateInput", {
      sceneName: obs.currentScene,
      inputName: sourceName,
      inputKind: "browser_source",
      inputSettings: {
        url: pageUrl,
        width: 1920,
        height: 1080,
        reroute_audio: false,
        shutdown: false,
      },
    });

    console.log(`✅ Browser source "${sourceName}" (${pageUrl}) ditambahkan ke scene "${obs.currentScene}"`);
    obs.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

addDancingSource();
