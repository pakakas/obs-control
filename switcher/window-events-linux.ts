import { spawnSync } from "node:child_process";
import fs from "node:fs";

export interface FocusWindow {
  id: string;
  title: string;
  pid: number;
  processName: string;
  isOBS: boolean;
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 1500 });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function getActiveX11Window(): FocusWindow | null {
  const id = run("xdotool", ["getactivewindow"]);
  if (!id) return null;
  const title = run("xdotool", ["getwindowname", id]);
  const pid = Number(run("xdotool", ["getwindowpid", id])) || 0;
  let processName = "";
  if (pid) {
    try { processName = fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim(); } catch {}
  }
  const lower = processName.toLowerCase();
  return { id, title, pid, processName, isOBS: lower === "obs" || lower.startsWith("obs-") || title.toLowerCase().startsWith("obs ") };
}

export function getVisibleX11Windows(): FocusWindow[] {
  const ids = run("xdotool", ["search", "--onlyvisible", "--name", "."]).split(/\s+/).filter(Boolean);
  return [...new Set(ids)].map(id => {
    const title = run("xdotool", ["getwindowname", id]);
    const pid = Number(run("xdotool", ["getwindowpid", id])) || 0;
    let processName = "";
    if (pid) {
      try { processName = fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim(); } catch {}
    }
    const lower = processName.toLowerCase();
    return { id, title, pid, processName, isOBS: lower === "obs" || lower.startsWith("obs-") || title.toLowerCase().startsWith("obs ") };
  }).filter(window => window.title);
}

export async function subscribeX11Focus(onFocus: (window: FocusWindow) => void, onError: (message: string) => void) {
  if (process.env.XDG_SESSION_TYPE === "wayland") throw new Error("Sesi Wayland terdeteksi; switcher memerlukan sesi Xorg/X11.");
  if (!process.env.DISPLAY || !run("xdotool", ["getactivewindow"])) {
    throw new Error("Jalankan switcher dari terminal dalam sesi desktop Xorg yang sama.");
  }
  if (spawnSync("which", ["xdotool"], { encoding: "utf8" }).status !== 0) {
    throw new Error("xdotool belum terpasang. Install dengan: sudo apt install xdotool");
  }

  const worker = new Worker(new URL("./x11-focus-worker.ts", import.meta.url).href);
  let debounce: ReturnType<typeof setTimeout> | undefined;
  worker.onmessage = (event: MessageEvent<{ type: string; message?: string }>) => {
    if (event.data.type === "ready") {
      const active = getActiveX11Window();
      if (active) onFocus(active);
      return;
    }
    if (event.data.type === "error") {
      onError(event.data.message || "Gagal memasang listener event X11.");
      return;
    }
    if (event.data.type !== "focus-changed") return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      const active = getActiveX11Window();
      if (active) onFocus(active);
    }, 180);
  };
  worker.onerror = error => onError(error.message);
  return worker;
}
