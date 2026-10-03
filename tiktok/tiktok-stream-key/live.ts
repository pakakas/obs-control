#!/usr/bin/env bun
import { TikTokClient } from "./Libs/tiktok_client";
import { OBSWebSocketClient } from "../../switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

function loadOBSPass(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "../../config.json"), "utf-8"));
    return cfg.obs_password || "";
  } catch {
    return "";
  }
}

async function goLive() {
  const customTitle = process.argv[2] || "clipper agent";

  console.log(`\n======================================================`);
  console.log(`🚀 TikTok Live & OBS Auto-Setup`);
  console.log(`   Judul: "${customTitle}"`);
  console.log(`======================================================\n`);

  try {
    const client = new TikTokClient();
    console.log("⚡ [1/2] Mendaftarkan room sesi live di server TikTok...");
    const result = await client.createStream({
      title: customTitle,
      topicId: "5",
      multiStream: false
    });

    console.log("✓ Sesi room live berhasil didaftarkan di TikTok!");
    console.log(`  Room ID: ${result.roomId}`);

    // Connect ke OBS WebSocket
    const obs = new OBSWebSocketClient("ws://127.0.0.1:4455", loadOBSPass());
    await obs.connect();

    // 1. Inject ke Aitum Vertical via Vendor Request API SAJA (Main Stream tetap YouTube)
    try {
      await obs.call("CallVendorRequest", {
        vendorName: "aitum-vertical-canvas",
        requestType: "update_stream_server",
        requestData: {
          index: 0,
          stream_server: result.serverUrl,
          server: result.serverUrl
        }
      });

      await obs.call("CallVendorRequest", {
        vendorName: "aitum-vertical-canvas",
        requestType: "update_stream_key",
        requestData: {
          index: 0,
          stream_key: result.streamKey,
          key: result.streamKey
        }
      });

      console.log("✓ [2/2] Aitum Vertical: Server URL & Stream Key BERHASIL DI-INJECT VIA VENDOR API (LIVE)!");
    } catch (vErr: any) {
      console.log("  (Info Aitum Vendor API):", vErr.message);
    }

    // 2. Update overlay teks di scene vertikal
    try {
      await obs.call("SetInputSettings", {
        inputName: "Vertical Static Text",
        inputSettings: { text: customTitle },
        overlay: true
      });
      console.log(`✓ Overlay Teks Vertikal diupdate ke: "${customTitle}"`);
    } catch {}

    await obs.disconnect();

    console.log(`\n🎉 SUKSES: Aitum Vertical siap untuk live TikTok! (Main Stream tetap aman untuk YouTube).\n`);
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

goLive();
