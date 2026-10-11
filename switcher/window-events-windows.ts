import { getActiveWindow } from "./window_tracker";
import { keyboardHook } from "./keyboard-hook";

export interface FocusWindow {
  id: string;
  title: string;
  pid: number;
  processName: string;
  isOBS: boolean;
}

export function subscribeWindowsFocus(onFocus: (window: FocusWindow, totalTabs: number) => void) {
  keyboardHook.on("altReleased", async (totalTabs: number) => {
    await new Promise(resolve => setTimeout(resolve, 80));
    const active = getActiveWindow();
    if (!active) return;
    onFocus({
      id: String(active.hwnd),
      title: active.title,
      pid: active.pid,
      processName: active.processName,
      isOBS: active.isOBS,
    }, totalTabs || 0);
  });
}
