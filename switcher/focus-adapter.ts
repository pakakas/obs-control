export interface FocusWindow {
  id: string;
  title: string;
  pid: number;
  processName: string;
  isOBS: boolean;
}

export interface FocusEvent extends FocusWindow {
  eventType: "alt-released" | "focus-changed";
  totalTabs?: number;
}

export interface ParsedWindowSource {
  title: string;
  processName: string;
  windowId: string;
}

export interface FocusAdapter {
  platformName: string;
  reconnectIntervalMs: number;
  reloadSourcesOnReconnect: boolean;
  canonicalizeProcess(value: string): string;
  getVisibleWindows(): Promise<FocusWindow[]>;
  parseWindowSource(settings: Record<string, any>, visibleWindows: FocusWindow[]): ParsedWindowSource | null;
  subscribe(onFocus: (event: FocusEvent) => void, onError: (message: string) => void): Promise<void>;
}

function normalizeLinuxProcess(value: string): string {
  let process = value.trim().replace(/^['"]|['"]$/g, "").split(/[/:\\]/).pop()!.toLowerCase().replace(/\.exe$/, "");
  if (process === "brave-browser") process = "brave";
  return process;
}

export async function createFocusAdapter(): Promise<FocusAdapter> {
  if (process.platform === "win32") {
    const api = await import("./window-events-windows");
    return {
      platformName: "Windows",
      reconnectIntervalMs: 50,
      reloadSourcesOnReconnect: false,
      canonicalizeProcess: value => value,
      getVisibleWindows: async () => [],
      parseWindowSource(settings) {
        const spec = typeof settings.window === "string" ? settings.window : "";
        if (!spec) return null;
        const [title = "", , processName = ""] = spec.split(":");
        return { title, processName, windowId: "" };
      },
      async subscribe(onFocus, onError) {
        try {
          api.subscribeWindowsFocus((window, totalTabs) => onFocus({ ...window, eventType: "alt-released", totalTabs }));
        } catch (error: any) { onError(error?.message || String(error)); }
      },
    };
  }

  if (process.platform === "linux") {
    const api = await import("./window-events-linux");
    return {
      platformName: "Ubuntu/X11",
      reconnectIntervalMs: 3000,
      reloadSourcesOnReconnect: true,
      canonicalizeProcess: normalizeLinuxProcess,
      getVisibleWindows: async () => api.getVisibleX11Windows(),
      parseWindowSource(settings, visibleWindows) {
        const spec = typeof settings.capture_window === "string"
          ? settings.capture_window
          : (typeof settings.window === "string" ? settings.window : "");
        if (!spec) return null;
        const [id = "", title = "", windowClass = ""] = spec.split("\r\n");
        if (!title) return null;
        const selected = visibleWindows.find(window => window.id === id);
        return { title, processName: selected?.processName || windowClass, windowId: id };
      },
      async subscribe(onFocus, onError) {
        await api.subscribeX11Focus(window => onFocus({ ...window, eventType: "focus-changed" }), onError);
      },
    };
  }

  throw new Error(`Platform ${process.platform} belum didukung oleh auto scene switcher.`);
}
