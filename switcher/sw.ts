import { OBSWebSocketClient } from "./obs_client";
import { getActiveWindow, WindowInfo, findWindowByTitle, getWindows } from "./window_tracker";
import { keyboardHook, isAltHeld } from "./keyboard-hook";
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
const singleInstanceSources = new Map()

let availableScenes: string[] = [];
let currentScene = "";
let dynamicAliases: Record<string, string> = {};

async function loadSources() {
  const windows = getWindows()
  for (const sceneName of obs.availableScenes) {
    const sources = await obs.call('GetSceneItemList', { sceneName })
    const input = await obs.call('GetInputSettings', { inputName: sources.sceneItems[0].sourceName });

    // console.debug({scene_0: sources.sceneItems[0], input})

    if (input.inputSettings.window) {
      const [title, sourceType, processName] = input.inputSettings.window.split(':')
      mainSources.set(title, {
        sourceName: sources.sceneItems[0].sourceName,
        sceneName, title, processName, sourceType,
        pid: windows.find(w => w.title.includes(title))?.pid,
        get isVisible() {
          return true
        }
      })
      if (!singleInstanceSources.get(processName)) {
        singleInstanceSources.set(processName, {
          sourceName: sources.sceneItems[0].sourceName,
          sceneName, title, processName, sourceType,
          pid: windows.find(w => w.title.includes(title))?.pid,
          get isVisible() {
            return true
          }
        })
      }
    }
  }

  console.debug({mainSources, singleInstanceSources})
}

function findMatchingScene(win: WindowInfo, scenes: string[], mainSources: Map<string, any>): string | null {
  const source = mainSources.get(win.title)
  console.debug({source, win})
  if (source?.isVisible) {
    return source.sceneName
  }

  const tLower = win.title.toLowerCase().trim();
  const pLower = win.processName.toLowerCase().replace(/\.exe$/, "").trim();
console.debug('findMatchingScene', win, scenes)

  for (const source of mainSources.values()) {
    if (source.processName === win.processName) {
      return source.sceneName
    }
  }
}

let lastHwnd: any = null;
let lastTitle = "";

async function refreshScenes() {
  try {
    const data = await obs.call("GetSceneList");
    currentScene = data.currentProgramSceneName || "";
    availableScenes = (data.scenes || []).map((s: any) => s.sceneName);

    const newAliases: Record<string, string> = {};
    for (const scene of availableScenes) {
      try {
        const items = await obs.call("GetSceneItemList", { sceneName: scene });
        const winCaps = items.sceneItems
          .filter((i: any) => (i.inputKind === "window_capture" || i.inputKind === "game_capture") && i.sceneItemEnabled === true)
          .sort((a: any, b: any) => b.sceneItemIndex - a.sceneItemIndex);

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
  if (win.title === "Task Switching" || win.title === "Task View" || win.processName.toLowerCase() === "shellexperiencehost.exe") {
    return;
  }

  if (win.isOBS) {
    console.log(`[Focus] OBS Studio aktif (Scene dipertahankan: "${currentScene}")`);
    return;
  }

  await refreshScenes();
  const matchedScene = findMatchingScene(win, availableScenes, mainSources);
console.debug({matchedScene})
  if (!matchedScene) {
    console.log(`[No Match] Window: "${win.title.slice(0, 40)}" (${win.processName}) tidak ada di OBS [${availableScenes.join(", ")}]`);
    return;
  }

  if (currentScene.toLowerCase() === matchedScene.toLowerCase()) {
    console.log(`[Current] Tetap di scene "${matchedScene}"`);
    return;
  }

  try {
    await obs.call("SetCurrentProgramScene", { sceneName: matchedScene });
    currentScene = matchedScene;
    console.log(`[SWITCH OBS MAIN] ➔ "${matchedScene}" (Window: "${win.title.slice(0, 35)}", Proc: "${win.processName}")`);

    try {
      const vSceneName = "v-" + matchedScene;

      const vRes = await obs.call("CallVendorRequest", {
        vendorName: "aitum-vertical-canvas",
        requestType: "switch_scene",
        requestData: { scene: vSceneName }
      });
      if (vRes?.responseData?.success) {
        console.log(`[SWITCH AITUM VERTICAL] ➔ "${vSceneName}" (Sukses via Vendor API)`);
      }
    } catch (vErr: any) {
      if (!vErr.message.includes("No request was found")) {
        console.error("Gagal switch Aitum Vertical:", vErr.message);
      }
    }
  } catch (e: any) {
    console.error("Gagal switch scene:", e.message);
  }
}

let isLoopStarted = false;

export async function startAutoSwitcher() {
  console.log("==================================================");
  console.log("  @pakakas/obs-control — Alt+Tab Auto Switcher ");
  console.log("  (mode: keyboard hook event-driven, no polling)  ");
  console.log("==================================================");

  try {
    await obs.connect();
    console.log("Terhubung ke OBS Studio!");
    await refreshScenes();
    await loadSources()

    try {
      const { inputs } = await obs.call("GetInputList", { inputKind: "browser_source" });
      for (const i of inputs) {
        await obs.call("SetInputSettings", { inputName: i.inputName, inputSettings: { shutdown: false } });
      }
      console.log(`🌐 Browser sources aktif terus: [${inputs.map((i: any) => i.inputName).join(", ")}]`);
    } catch {}

    console.log(`Scene aktif: "${currentScene}"`);
    console.log(`Scenes di OBS: [${availableScenes.join(", ")}]`);
    console.log("\nMemantau event [Alt+Tab] & [Alt Rilis] (hook, bukan polling)...\n");

    // --- Alt dilepas -> keyboard hook (worker) yang notify, bukan kita nanya tiap tick ---
    keyboardHook.on("altReleased", async (totalTabs: number) => {
      console.log(`\n[ALT RILIS] (Setelah ${totalTabs}x Tab) ➔ Menentukan window target...`);

      await new Promise((r) => setTimeout(r, 80));

      const win = getActiveWindow();
      if (win) {
        lastHwnd = win.hwnd;
        lastTitle = win.title;
        await handleFinalWindowSwitch(win);
      }
    });

    if (!isLoopStarted) {
      isLoopStarted = true;

      // Loop ini SEKARANG cuma buat 2 hal: (1) reconnect OBS kalau putus,
      // (2) deteksi perpindahan fokus "biasa" (klik taskbar, dll — bukan alt-tab).
      // Deteksi Alt/Tab sendiri sudah pindah total ke keyboard_hook.ts (event-driven).
      setInterval(async () => {
        if (!obs.isConnected) {
          try {
            await obs.connect();
            await refreshScenes();
          } catch {}
          return;
        }

        // Selama Alt masih ditahan (lagi milih window di UI Alt-Tab), jangan proses fokus dulu.
        if (isAltHeld()) return;

        // const win = getActiveWindow();
        // if (!win) return;

        // if (win.hwnd === lastHwnd && win.title === lastTitle) return;
        // lastHwnd = win.hwnd;
        // lastTitle = win.title;

        // await handleFinalWindowSwitch(win);
      }, config.poll_interval_ms || 50);

      if (config.window_trackers && config.window_trackers.length > 0) {
        // setInterval(async () => {
        //   if (!obs.isConnected) return;
        //   for (const tracker of config.window_trackers!) {
        //     const title = findWindowByTitle(tracker.exe, tracker.title_keyword);
        //     if (!title) continue;
        //     const exe = tracker.exe;
        //     const winString = `${title}:Chrome_WidgetWin_1:${exe}`;
        //     try {
        //       await obs.call("SetInputSettings", {
        //         inputName: tracker.source,
        //         inputSettings: { window: winString }
        //       });
        //     } catch {}
        //   }
        // }, 3000);
      }
    }
  } catch (err: any) {
    console.log(err.message);
    console.log("Mencoba menghubungkan kembali dalam 3 detik...");
    setTimeout(startAutoSwitcher, 3000);
  }
}

if (import.meta.main) {
  startAutoSwitcher();
}