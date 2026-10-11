import { OBSWebSocketClient } from "./obs_client";
import { createFocusAdapter, FocusAdapter, FocusEvent, FocusWindow } from "./focus-adapter";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "..", "config.json");

interface Config {
  obs_url?: string;
  obs_password?: string;
  poll_interval_ms?: number;
  aliases?: Record<string, string>;
  vertical_scenes?: Record<string, string>;
  strict_title_windows?: string[];
  window_trackers?: Array<{ source: string; exe: string; title_keyword: string }>;
}
let focusAdapter: FocusAdapter | undefined;

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {}
  return { obs_url: "ws://127.0.0.1:4455", poll_interval_ms: 50, aliases: {} };
}

const config = loadConfig();
const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");
const mainSources = new Map<string, any>();
const singleInstanceSources = new Map<string, any>();
const obsSourceCache: Array<{ sceneName: string; sourceName: string; inputKind: string; enabled: boolean; windowSpec: string }> = [];

let availableScenes: string[] = [];
let currentScene = "";
let lastWindowId = "";
let lastTitle = "";
let isLoopStarted = false;

async function loadSources() {
  mainSources.clear();
  singleInstanceSources.clear();
  obsSourceCache.length = 0;

  const visibleWindows = await focusAdapter!.getVisibleWindows();
  const sourceScenes = availableScenes.length > 0 ? availableScenes : (obs.availableScenes || []);
  for (const sceneName of sourceScenes) {
    try {
      const { sceneItems = [] } = await obs.call("GetSceneItemList", { sceneName });
      for (const item of sceneItems) {
        let inputSettings: Record<string, any> = {};
        try {
          const input = await obs.call("GetInputSettings", { inputName: item.sourceName });
          inputSettings = input.inputSettings || {};
        } catch {}
        const windowSpec = typeof inputSettings.capture_window === "string"
          ? inputSettings.capture_window
          : (typeof inputSettings.window === "string" ? inputSettings.window : "");
        obsSourceCache.push({
          sceneName,
          sourceName: item.sourceName,
          inputKind: item.inputKind || "unknown",
          enabled: item.sceneItemEnabled === true,
          windowSpec,
        });
      }

      if (sceneItems.length === 0) continue;
      const mainItem = sceneItems[0];
      const input = await obs.call("GetInputSettings", { inputName: mainItem.sourceName });
      const settings = input.inputSettings || {};
      const windowSpec = typeof settings.capture_window === "string"
        ? settings.capture_window
        : (typeof settings.window === "string" ? settings.window : "");
      if (!windowSpec) continue;

      const parsed = focusAdapter!.parseWindowSource(settings, visibleWindows);
      if (!parsed) continue;
      const { title, processName, windowId } = parsed;

      const source = {
        sourceName: mainItem.sourceName,
        sceneName,
        sceneItemId: mainItem.sceneItemId,
        title,
        processName,
        windowId,
        enabled: mainItem.sceneItemEnabled === true,
        get isVisible() { return this.enabled === true; },
      };
      mainSources.set(title, source);
      const key = focusAdapter!.canonicalizeProcess(processName || "");
      if (key && !singleInstanceSources.has(key)) singleInstanceSources.set(key, source);
    } catch {}
  }
  // console.debug({ mainSources, singleInstanceSources });
}

function findMatchingScene(window: FocusWindow): string | null {
  let source = mainSources.get(window.title);
  if (source?.isVisible) return source.sceneName;

  const process = focusAdapter!.canonicalizeProcess(window.processName);
  const strictProcess = (config.strict_title_windows || []).some(name => focusAdapter!.canonicalizeProcess(name) === process);
  if (!strictProcess) {
    source = singleInstanceSources.get(process);
    if (source?.isVisible) return source.sceneName;
  }
  return null;
}

function buildX11WindowCache(windows: FocusWindow[]) {
  const cache = new Map<string, string>();
  for (const window of windows) {
    if (window.isOBS) continue;
    const byId = [...mainSources.values()].filter(source => source.enabled && source.windowId === window.id);
    const exactIdScenes = [...new Set(byId.map(source => source.sceneName))];
    const scene = exactIdScenes.length === 1 ? exactIdScenes[0] : findMatchingScene(window);
    if (scene) cache.set(window.id, scene);
  }
  return cache;
}

async function refreshScenes() {
  try {
    const data = await obs.call("GetSceneList");
    currentScene = data.currentProgramSceneName || "";
    availableScenes = (data.scenes || []).map((scene: any) => scene.sceneName);
    for (const source of mainSources.values()) {
      try {
        const result = await obs.call("GetSceneItemEnabled", {
          sceneName: source.sceneName,
          sceneItemId: source.sceneItemId,
        });
        source.enabled = result.sceneItemEnabled;
      } catch {}
    }
  } catch {}
}

async function handleWindowSwitch(window: FocusWindow, x11Cache?: Map<string, string>) {
  if (window.title === "Task Switching" || window.title === "Task View" ||
      window.processName.toLowerCase() === "shellexperiencehost.exe") return;
  if (window.isOBS) {
    console.log(`[Focus] OBS Studio aktif (Scene dipertahankan: "${currentScene}")`);
    return;
  }

  await refreshScenes();
  const matchedScene = x11Cache?.get(window.id) || findMatchingScene(window);
  if (!matchedScene) {
    console.log(`[No Match] Window: "${window.title.slice(0, 40)}" (${window.processName}) tidak ada di OBS [${availableScenes.join(", ")}]`);
    return;
  }
  if (currentScene.toLowerCase() === matchedScene.toLowerCase()) {
    console.log(`[Current] Tetap di scene "${matchedScene}"`);
    return;
  }

  try {
    await obs.call("SetCurrentProgramScene", { sceneName: matchedScene });
    currentScene = matchedScene;
    console.log(`[SWITCH OBS MAIN] ➔ "${matchedScene}" (Window: "${window.title.slice(0, 35)}", Proc: "${window.processName}")`);
    try {
      const verticalScene = "v-" + matchedScene;
      const result = await obs.call("CallVendorRequest", {
        vendorName: "aitum-vertical-canvas",
        requestType: "switch_scene",
        requestData: { scene: verticalScene },
      });
      if (result?.responseData?.success) console.log(`[SWITCH AITUM VERTICAL] ➔ "${verticalScene}" (Sukses via Vendor API)`);
    } catch (error: any) {
      if (!String(error?.message).includes("No request was found")) console.error("Gagal switch Aitum Vertical:", error?.message);
    }
  } catch (error: any) {
    console.error("Gagal switch scene:", error?.message);
  }
}

// Platform wrapper: OBS and scene-switching flow stays in this file;
// the OS-specific modules only report the focused window.
async function subscribeFocusBackend(onFocus: (event: FocusEvent) => void) {
  await focusAdapter!.subscribe(onFocus, message => console.error(`[${focusAdapter!.platformName}] ${message}`));
}

async function startAutoSwitcher() {
  try { focusAdapter = await createFocusAdapter(); }
  catch (error: any) { console.error(error?.message || String(error)); process.exitCode = 1; return; }
  console.log("==================================================");
  console.log("  @pakakas/obs-control — Auto Scene Switcher");
  console.log("  (OBS switching flow shared; focus API via adapter)");
  console.log("==================================================");

  try {
    await obs.connect();
    console.log("Terhubung ke OBS Studio!");
    await refreshScenes();
    await loadSources();

    try {
      const { inputs } = await obs.call("GetInputList", { inputKind: "browser_source" });
      for (const input of inputs) {
        await obs.call("SetInputSettings", { inputName: input.inputName, inputSettings: { shutdown: false } });
      }
      console.log(`🌐 Browser sources aktif terus: [${inputs.map((input: any) => input.inputName).join(", ")}]`);
    } catch {}

    console.log(`Scene aktif: "${currentScene}"`);
    console.log(`Scenes di OBS: [${availableScenes.join(", ")}]`);
    // console.log("[Debug] Seluruh source OBS:");
    // for (const source of obsSourceCache) {
    //   console.log(`  scene="${source.sceneName}" source="${source.sourceName}" kind="${source.inputKind}" enabled=${source.enabled} window="${source.windowSpec.replaceAll("\r\n", " | ")}"`);
    // }

    const initialWindows = await focusAdapter!.getVisibleWindows();
    let windowCache = buildX11WindowCache(initialWindows);
    // console.log(`[${focusAdapter!.platformName}] Daftar window dan cache ID → scene:`);
    // for (const window of initialWindows) {
    //   console.log(`  id=${window.id} pid=${window.pid} process="${window.processName}" title="${window.title}" => ${windowCache.get(window.id) || "(unmatched)"}`);
    // }

    await subscribeFocusBackend(async event => {
      if (event.eventType === "alt-released") {
        console.log(`\n[ALT RILIS] (Setelah ${event.totalTabs || 0}x Tab) ➔ Menentukan window target...`);
      } else {
        if (event.id === lastWindowId && event.title === lastTitle) return;
        await refreshScenes();
        windowCache = buildX11WindowCache(await focusAdapter!.getVisibleWindows());
        console.log(`[Focus] id=${event.id} process="${event.processName}" title="${event.title}" => ${event.isOBS ? "OBS (diabaikan)" : (windowCache.get(event.id) || findMatchingScene(event) || "tidak cocok")}`);
      }
      lastWindowId = event.id;
      lastTitle = event.title;
      await handleWindowSwitch(event, windowCache);
    });

    if (!isLoopStarted) {
      isLoopStarted = true;
      // Keep the original Windows reconnect cadence; Linux focus events remain event-driven.
      setInterval(async () => {
        if (!obs.isConnected) {
          try {
            await obs.connect();
            await refreshScenes();
            if (focusAdapter!.reloadSourcesOnReconnect) await loadSources();
          }
          catch {}
        }
      }, focusAdapter!.reconnectIntervalMs || config.poll_interval_ms || 50);
    }
  } catch (error: any) {
    console.log(error?.message);
    console.log("Mencoba menghubungkan kembali dalam 3 detik...");
    setTimeout(startAutoSwitcher, 3000);
  }
}

if (import.meta.main) startAutoSwitcher();
