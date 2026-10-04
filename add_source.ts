import { OBSWebSocketClient } from "./switcher/obs_client";
import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = path.join(import.meta.dir, "config.json");
const CANVAS_UUID = "7b16b6bd-e632-475e-80fb-090e7dc91868";

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {}
  return { obs_url: "ws://127.0.0.1:4455", obs_password: "" };
}

// Simple CLI arg parser
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = "true";
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        options[key] = next;
        i++;
      } else {
        options[key] = "true";
      }
    }
  }
  return options;
}

async function main() {
  const opts = parseArgs();
  const name = opts.name || opts.n;
  const kind = opts.kind || opts.k || "window_capture";
  const target = opts.target || opts.t || "vertical"; // vertical | main | all | comma-separated
  const excludeStr = opts.exclude || opts.e || "wallpaper";
  const windowStr = opts.window || opts.w;
  const urlStr = opts.url || opts.u;
  const fileStr = opts.file || opts.f;
  const enabled = opts.enabled !== "false";
  const priority = parseInt(opts.priority || "1", 10);
  const preset = opts.preset || opts.p;
  const posStr = opts.pos;
  const boundsStr = opts.bounds;

  if (!name) {
    console.log(`
Usage: bun add_source.ts --name <sourceName> [options]

Options:
  --name, -n     Source name (required)
  --kind, -k     Input kind (default: window_capture)
  --window, -w   Window string for window_capture
  --url, -u      URL for browser_source
  --file, -f     File path for image_source
  --target, -t   Target scenes: 'vertical' (default), 'main', 'all', or comma-separated names
  --exclude, -e  Comma-separated scene names/keywords to exclude (default: 'wallpaper')
  --enabled      Set initial enabled state ('true' or 'false', default: true)
  --priority     Window matching priority (default: 1 = match by title)
  --preset, -p   Transform preset: 'top-right' (lanskap), 'bottom' (vertikal 16:9 slot)
  --pos          Manual position 'X,Y' (e.g. 1710,20)
  --bounds       Manual bounds 'WxH' (e.g. 190x100)

Examples:
  bun add_source.ts --name talk --kind window_capture --window "Gawdat - YouTube - Brave:Chrome_WidgetWin_1:brave.exe" --target vertical --exclude wallpaper --preset bottom
  bun add_source.ts --name profile-pic --kind image_source --file "static/profilepic.png" --target main --exclude wallpaper --preset top-right
  bun add_source.ts --name alert --kind browser_source --url "http://localhost:3000/alert" --target all
`);
    process.exit(1);
  }

  const config = loadConfig();
  const obs = new OBSWebSocketClient(config.obs_url || "ws://127.0.0.1:4455", config.obs_password || "");
  await obs.connect();

  console.log(`Connecting to OBS to add source "${name}" (${kind})...`);

  // 1. Cek apakah input global sudah ada
  const { inputs } = await obs.call("GetInputList");
  let inputItem = inputs.find((i: any) => i.inputName === name);

  // Buat input settings berdasarkan kind
  const inputSettings: Record<string, any> = {};
  if (kind === "window_capture") {
    if (windowStr) inputSettings.window = windowStr;
    inputSettings.priority = priority;
    inputSettings.client_area = false;
    inputSettings.cursor = false;
  } else if (kind === "browser_source") {
    if (urlStr) inputSettings.url = urlStr;
  } else if (kind === "image_source") {
    if (fileStr) inputSettings.file = fileStr;
  }

  // 2. Dapatkan daftar scene (baik main maupun Aitum vertical)
  const { scenes: mainScenes } = await obs.call("GetSceneList");
  const mainSceneNames: string[] = mainScenes.map((s: any) => s.sceneName);

  let verticalSceneNames: string[] = [];
  try {
    const vRes = await obs.call("CallVendorRequest", {
      vendorName: "aitum-vertical-canvas",
      requestType: "get_scenes",
      requestData: {}
    });
    if (vRes?.responseData?.scenes) {
      verticalSceneNames = vRes.responseData.scenes.map((s: any) => s.name);
    }
  } catch {}

  if (verticalSceneNames.length === 0) {
    // Fallback: gunakan prefix v-
    verticalSceneNames = mainSceneNames.map(s => `v-${s}`);
  }

  // Filter target scenes
  const excludes = excludeStr.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

  let targetScenes: Array<{ name: string; isVertical: boolean }> = [];

  if (target === "vertical") {
    targetScenes = verticalSceneNames.map(s => ({ name: s, isVertical: true }));
  } else if (target === "main") {
    targetScenes = mainSceneNames.map(s => ({ name: s, isVertical: false }));
  } else if (target === "all") {
    targetScenes = [
      ...mainSceneNames.map(s => ({ name: s, isVertical: false })),
      ...verticalSceneNames.map(s => ({ name: s, isVertical: true }))
    ];
  } else {
    const specified = target.split(",").map(s => s.trim());
    for (const spec of specified) {
      const isVert = verticalSceneNames.includes(spec) || spec.startsWith("v-") || spec.startsWith("Vertical");
      targetScenes.push({ name: spec, isVertical: isVert });
    }
  }

  // Filter excludes
  targetScenes = targetScenes.filter(t => {
    const lower = t.name.toLowerCase();
    return !excludes.some(ex => lower.includes(ex));
  });

  console.log(`Target scenes (${targetScenes.length}): [${targetScenes.map(t => t.name).join(", ")}]`);

  // 3. Tambahkan ke masing-masing scene
  // Helper to add source to a scene
  async function addSourceToScene(sceneName: string, isVertical: boolean) {
    const canvasParam = isVertical ? { canvasUuid: CANVAS_UUID } : {};

    // Cek apakah sudah ada di scene
    try {
      const itemsRes = await obs.call("GetSceneItemList", { sceneName, ...canvasParam });
      const existing = itemsRes.sceneItems?.find((i: any) => i.sourceName === name);
      if (existing) {
        console.log(`  ⏭ [${sceneName}] "${name}" sudah ada (id: ${existing.sceneItemId})`);
        return;
      }
    } catch {}

    // Helper to apply transform and protect index [0]
    async function postProcessSceneItem(sceneItemId: number) {
      if (customTransform) {
        try {
          await obs.call("SetSceneItemTransform", {
            sceneName,
            sceneItemId,
            ...(isVertical ? { canvasUuid: CANVAS_UUID } : {}),
            sceneItemTransform: customTransform
          });
          console.log(`    ➔ Transform diterapkan (${preset || posStr || boundsStr})`);
        } catch (e: any) {
          console.log(`    ⚠ Gagal set transform: ${e.message}`);
        }
      }

      // Pastikan item baru TIDAK membajak index [0] jika bukan satu-satunya item
      try {
        const finalRes = await obs.call("GetSceneItemList", { sceneName, ...(isVertical ? { canvasUuid: CANVAS_UUID } : {}) });
        const items = finalRes.sceneItems || [];
        if (items.length > 1 && items[0].sourceName === name) {
          // Pindahkan item baru ke paling atas agar index [0] tetap main source
          await obs.call("SetSceneItemIndex", {
            sceneName,
            sceneItemId,
            sceneItemIndex: items.length - 1,
            ...(isVertical ? { canvasUuid: CANVAS_UUID } : {})
          });
        }
      } catch {}
    }

    // Add to vertical scene
    if (isVertical) {
      let sourceUuid = inputItem?.sourceUuid;
      if (!sourceUuid) {
        try {
          // Cari sourceUuid dari input settings
          const s = await obs.call("GetInputSettings", { inputName: name });
          sourceUuid = s?.sourceUuid;
        } catch {}
      }

      // Percobaan 1: Menggunakan sceneName + sourceUuid + canvasUuid
      if (sourceUuid) {
        try {
          const res = await obs.call("CreateSceneItem", {
            sceneName,
            sourceUuid,
            sceneItemEnabled: enabled,
            canvasUuid: CANVAS_UUID
          });
          console.log(`  ✓ [${sceneName}] "${name}" ditambahkan (id: ${res.sceneItemId})`);
          await postProcessSceneItem(res.sceneItemId);
          return;
        } catch {}
      }

      // Percobaan 2: Menggunakan sourceName + canvasUuid
      try {
        const res = await obs.call("CreateSceneItem", {
          sceneName,
          sourceName: name,
          sceneItemEnabled: enabled,
          canvasUuid: CANVAS_UUID
        });
        console.log(`  ✓ [${sceneName}] "${name}" ditambahkan (id: ${res.sceneItemId})`);
        await postProcessSceneItem(res.sceneItemId);
        return;
      } catch {}

      // Percobaan 3: CreateInput langsung jika belum ada di canvas
      try {
        const res = await obs.call("CreateInput", {
          sceneName,
          inputName: name,
          inputKind: kind,
          inputSettings,
          sceneItemEnabled: enabled,
          canvasUuid: CANVAS_UUID
        });
        console.log(`  ✓ [${sceneName}] "${name}" dibuat baru (id: ${res.sceneItemId})`);
        await postProcessSceneItem(res.sceneItemId);
        return;
      } catch (err: any) {
        console.log(`  ✗ [${sceneName}] Gagal menambahkan: ${err.message}`);
      }
    } else {
      // Main landscape scene
      try {
        if (!inputItem) {
          const res = await obs.call("CreateInput", {
            sceneName,
            inputName: name,
            inputKind: kind,
            inputSettings,
            sceneItemEnabled: enabled
          });
          inputItem = { inputName: name, inputKind: kind };
          console.log(`  ✓ [${sceneName}] "${name}" dibuat di scene (id: ${res.sceneItemId})`);
          await postProcessSceneItem(res.sceneItemId);
          return;
        } else {
          const res = await obs.call("CreateSceneItem", {
            sceneName,
            sourceName: name,
            sceneItemEnabled: enabled
          });
          console.log(`  ✓ [${sceneName}] "${name}" ditambahkan (id: ${res.sceneItemId})`);
          await postProcessSceneItem(res.sceneItemId);
          return;
        }
      } catch (err: any) {
        console.log(`  ✗ [${sceneName}] Gagal: ${err.message}`);
      }
    }
  }

  for (const t of targetScenes) {
    await addSourceToScene(t.name, t.isVertical);
  }

  obs.disconnect();
  console.log("\nSelesai!");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
