import { OBSWebSocketClient } from "./obs_client";
import { getActiveWindow, WindowInfo, isAltPressed, isTabPressed, findWindowByTitle } from "./window_tracker";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "..", "config.json");

interface Config {
  obs_url?: string;
  obs_password?: string;
  poll_interval_ms?: number;
  aliases?: Record<string, string>;
  vertical_scenes?: Record<string, string>;
  window_trackers?: Array<{ source: string; exe: string; title_keyword: string }>;
}

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {
    obs_url: "ws://127.0.0.1:4455",
    obs_password: "",
    poll_interval_ms: 50,
    aliases: {}
  };
}

const config = loadConfig();
const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");

const mainSources = new Map()
let availableScenes: string[] = [];
let currentScene = "";

async function loadMainSources() {
  for (const sceneName of obs.availableScenes) {
    const sources = await obs.call('GetSceneItemList', { sceneName })
    const input = await obs.call('GetInputSettings', { inputName: sources.sceneItems[0].sourceName });

    if (input.inputSettings.window) {
      const [title, appName] = input.inputSettings.window.split(':')
      mainSources.set(title, {
        sourceName: sources.sceneItems[0].sourceName,
        sceneName, title, appName,
        get isVisible() {
          return true
        }
      })
    }
  }
}

function findMatchingScene(win: WindowInfo, scenes: string[], mainSources: any[]): string | null {
  const source = mainSources.get(win.title)
  if (source?.isVisible) {
    // mainSources.set(win.pid, mainSources.get(win.title))
    return source.sceneName
  }

  return

  const tLower = win.title.toLowerCase().trim();
  const pLower = win.processName.toLowerCase().replace(/\.exe$/, "").trim();

  // 1. Exact match (Prioritas tertinggi: Jika nama scene persis sama dengan judul window/exe)
  for (const scene of scenes) {
    const sLower = scene.toLowerCase().trim();
    if (sLower === pLower || sLower === tLower) return scene;
  }

  // 2. Substring match title (Prioritas kedua: Jika judul window spesifik mengandung nama scene)
  const sorted = [...scenes].sort((a, b) => b.length - a.length);
  for (const scene of sorted) {
    const sLower = scene.toLowerCase().trim();
    if (sLower.length >= 3 && tLower.includes(sLower)) return scene;
  }

  // 3. Aliases dinamis dari OBS Window Capture
  if (dynamicAliases) {
    for (const [key, targetScene] of Object.entries(dynamicAliases)) {
      const kLower = key.toLowerCase();
      if (win.processName.toLowerCase() === kLower || pLower === kLower || tLower.includes(kLower)) {
        const matched = scenes.find(s => s.toLowerCase() === targetScene.toLowerCase());
        if (matched) return matched;
      }
    }
  }

  // 4. Exe match (Prioritas terakhir)
  for (const scene of sorted) {
    const sLower = scene.toLowerCase().trim();
    if (pLower.length >= 3 && sLower.includes(pLower)) return scene;
  }

  return null;
}

let lastHwnd: any = null;
let lastTitle = "";
let wasAltHeld = false;
let tabCount = 0;
let wasTabDown = false;

let dynamicAliases: Record<string, string> = {};

async function refreshScenes() {
  try {
    const data = await obs.call("GetSceneList");
    currentScene = data.currentProgramSceneName || "";
    availableScenes = (data.scenes || []).map((s: any) => s.sceneName);

    // Build dynamic aliases from OBS Window Capture sources
    const newAliases: Record<string, string> = {};
    for (const scene of availableScenes) {
      try {
        const items = await obs.call("GetSceneItemList", { sceneName: scene });
        // Filter window/game capture yang VISIBLE (mata terbuka) dan urutkan berdasarkan index tertinggi
        const winCaps = items.sceneItems
          .filter((i: any) => (i.inputKind === "window_capture" || i.inputKind === "game_capture") && i.sceneItemEnabled === true)
          .sort((a: any, b: any) => b.sceneItemIndex - a.sceneItemIndex);

        // Ambil HANYA yang paling atas (index pertama setelah disortir descending)
        if (winCaps.length > 0) {
          const topSource = winCaps[0];
          const s = await obs.call("GetInputSettings", { inputName: topSource.sourceName });
          const winString = s.inputSettings.window;
          if (typeof winString === "string") {
            const exe = winString.split(":").pop();
            if (exe && exe.toLowerCase().endsWith(".exe")) {
              newAliases[exe.toLowerCase()] = scene;
            }
          }
        }
      } catch (e) {}
    }
    dynamicAliases = newAliases;
  } catch {}
}

async function handleFinalWindowSwitch(win: WindowInfo) {
  // Abaikan jika jendela overlay task switching windows
  if (win.title === "Task Switching" || win.title === "Task View" || win.processName.toLowerCase() === "shellexperiencehost.exe") {
    return;
  }

  // Abaikan OBS
  if (win.isOBS) {
    console.log(`[Focus] OBS Studio aktif (Scene dipertahankan: "${currentScene}")`);
    return;
  }

  await refreshScenes();
  await loadMainSources()
  const matchedScene = findMatchingScene(win, availableScenes, mainSources);

  if (!matchedScene) {
    console.log(`ℹ️ [No Match] Window: "${win.title.slice(0, 40)}" (${win.processName}) tidak ada di OBS [${availableScenes.join(", ")}]`);
    return;
  }

  if (currentScene.toLowerCase() === matchedScene.toLowerCase()) {
    console.log(`✓ [Current] Tetap di scene "${matchedScene}"`);
    return;
  }

  try {
    // 1. Switch Scene di Kanvas Utama OBS
    await obs.call("SetCurrentProgramScene", { sceneName: matchedScene });
    currentScene = matchedScene;
    console.log(`⚡ [SWITCH OBS MAIN] ➔ "${matchedScene}" (Window: "${win.title.slice(0, 35)}", Proc: "${win.processName}")`);

    // 2. Switch Scene di Kanvas Aitum Vertical via Vendor Request API
    try {
      const vSceneName = config.vertical_scenes?.[matchedScene] || ("v-" + matchedScene);
      
      const vRes = await obs.call("CallVendorRequest", {
        vendorName: "aitum-vertical-canvas",
        requestType: "switch_scene",
        requestData: { scene: vSceneName }
      });
      if (vRes?.responseData?.success) {
        console.log(`📱 [SWITCH AITUM VERTICAL] ➔ "${vSceneName}" (Sukses via Vendor API)`);
      }
    } catch (vErr: any) {
      if (!vErr.message.includes("No request was found")) {
        console.error("❌ Gagal switch Aitum Vertical:", vErr.message);
      }
    }
  } catch (e: any) {
    console.error("❌ Gagal switch scene:", e.message);
  }
}

let isLoopStarted = false;

export async function startAutoSwitcher() {
  console.log("==================================================");
  console.log("  🎮 @pakakas/obs-control — Alt+Tab Auto Switcher ");
  console.log("==================================================");

  try {
    await obs.connect();
    console.log("✅ Terhubung ke OBS Studio!");
    await refreshScenes();

    // Pastikan semua browser source tetap aktif terus
    try {
      const { inputs } = await obs.call("GetInputList", { inputKind: "browser_source" });
      for (const i of inputs) {
        await obs.call("SetInputSettings", { inputName: i.inputName, inputSettings: { shutdown: false } });
      }
      console.log(`🌐 Browser sources aktif terus: [${inputs.map((i: any) => i.inputName).join(", ")}]`);
    } catch {}

    console.log(`🎬 Scene aktif: "${currentScene}"`);
    console.log(`📋 Scenes di OBS: [${availableScenes.join(", ")}]`);
    console.log("\n👀 Memantau event [Alt+Tab] & [Alt Rilis]...\n");

    if (!isLoopStarted) {
      isLoopStarted = true;

      setInterval(async () => {
        if (!obs.isConnected) {
          try {
            await obs.connect();
            await refreshScenes();
          } catch {}
          return;
        }

        const altDown = isAltPressed();
        const tabDown = isTabPressed();

        // 1. Deteksi saat Alt ditekan & Tab ditekan berulang-ulang
        if (altDown) {
          wasAltHeld = true;
          if (tabDown && !wasTabDown) {
            tabCount++;
            console.log(`⌨️  [Press Tab #${tabCount}] Sedang memilih window... (Alt masih ditahan)`);
          }
          wasTabDown = tabDown;
          return; // Jangan switch saat Alt masih ditahan!
        }

        // 2. Deteksi saat [Alt Rilis]
        if (wasAltHeld && !altDown) {
          wasAltHeld = false;
          wasTabDown = false;
          const totalTabs = tabCount;
          tabCount = 0;

          console.log(`\n🚀 [ALT RILIS] (Setelah ${totalTabs}x Tab) ➔ Menentukan window target...`);

          // Beri jeda 80ms agar Windows selesai memfokuskan jendela final
          await new Promise((r) => setTimeout(r, 80));

          const win = getActiveWindow();
          if (win) {
            lastHwnd = win.hwnd;
            lastTitle = win.title;
            await handleFinalWindowSwitch(win);
          }
          return;
        }

        // 3. Deteksi perpindahan fokus biasa
        const win = getActiveWindow();
        if (!win) return;

        if (win.hwnd === lastHwnd && win.title === lastTitle) return;
        lastHwnd = win.hwnd;
        lastTitle = win.title;

        await handleFinalWindowSwitch(win);
      }, config.poll_interval_ms || 50);

      // Window tracker: pastikan source OBS selalu pointing ke window yang benar
      if (config.window_trackers && config.window_trackers.length > 0) {
        setInterval(async () => {
          if (!obs.isConnected) return;
          for (const tracker of config.window_trackers!) {
            const title = findWindowByTitle(tracker.exe, tracker.title_keyword);
            if (!title) continue;
            const exe = tracker.exe;
            const winString = `${title}:Chrome_WidgetWin_1:${exe}`;
            try {
              await obs.call("SetInputSettings", {
                inputName: tracker.source,
                inputSettings: { window: winString }
              });
            } catch {}
          }
        }, 3000); // cek setiap 3 detik
      }
    }
  } catch (err: any) {
    console.log("⏳ " + err.message);
    console.log("🔄 Mencoba menghubungkan kembali dalam 3 detik...");
    setTimeout(startAutoSwitcher, 3000);
  }
}

if (import.meta.main) {
  startAutoSwitcher();
}
