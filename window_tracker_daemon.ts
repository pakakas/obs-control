/**
 * window_tracker_daemon.ts
 * 
 * Daemon mandiri: selalu update OBS source agar pointing ke window yang benar,
 * terlepas dari auto_switcher. Baca konfigurasi dari config.json (field window_trackers).
 * 
 * Jalankan: bun run window_tracker_daemon.ts
 */

import { OBSWebSocketClient } from "./switcher/obs_client";
import { findWindowByTitle } from "./switcher/window_tracker";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "config.json");

interface TrackerConfig {
  obs_url?: string;
  obs_password?: string;
  window_trackers?: Array<{
    source: string;
    exe: string;
    title_keyword: string;
  }>;
}

function loadConfig(): TrackerConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function runDaemon() {
  const config = loadConfig();
  const trackers = config.window_trackers ?? [];

  if (trackers.length === 0) {
    console.log("⚠️  Tidak ada window_trackers di config.json, daemon berhenti.");
    process.exit(0);
  }

  const obs = new OBSWebSocketClient(
    config.obs_url || "ws://127.0.0.1:4455",
    config.obs_password || ""
  );

  console.log("🔍 Window Tracker Daemon aktif");
  console.log(`📡 Memantau ${trackers.length} tracker(s):`);
  for (const t of trackers) {
    console.log(`   • source="${t.source}" | exe="${t.exe}" | keyword="${t.title_keyword}"`);
  }
  console.log();

  async function connectLoop() {
    while (true) {
      if (!obs.isConnected) {
        try {
          await obs.connect();
          console.log("✅ Terhubung ke OBS");
        } catch {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
      }

      for (const tracker of trackers) {
        const title = findWindowByTitle(tracker.exe, tracker.title_keyword);
        if (!title) continue;

        const winString = `${title}:Chrome_WidgetWin_1:${tracker.exe}`;
        try {
          await obs.call("SetInputSettings", {
            inputName: tracker.source,
            inputSettings: { window: winString }
          });
          console.log(`🎯 [${tracker.source}] ➔ "${title}"`);
        } catch (e: any) {
          console.error(`❌ [${tracker.source}] Gagal:`, e.message);
        }
      }

      await new Promise(r => setTimeout(r, 3000));
    }
  }

  connectLoop();
}

runDaemon();
