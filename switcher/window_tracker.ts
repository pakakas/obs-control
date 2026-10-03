import { dlopen, FFIType, ptr, JSCallback } from "bun:ffi";

const user32 = dlopen("user32.dll", {
  EnumWindows: {
    args: [FFIType.function, FFIType.i64],
    return: FFIType.bool,
  },
  GetForegroundWindow: {
    args: [],
    returns: FFIType.ptr,
  },
  GetWindowTextW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  GetWindowThreadProcessId: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.u32,
  },
  GetAsyncKeyState: {
    args: [FFIType.i32],
    returns: FFIType.i16,
  },
});

export function isAltPressed(): boolean {
  // VK_MENU = 0x12 (Alt key)
  return (user32.symbols.GetAsyncKeyState(0x12) & 0x8000) !== 0;
}

export function isTabPressed(): boolean {
  // VK_TAB = 0x09 (Tab key)
  return (user32.symbols.GetAsyncKeyState(0x09) & 0x8000) !== 0;
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

const kernel32 = dlopen("kernel32.dll", {
  OpenProcess: {
    args: [FFIType.u32, FFIType.bool, FFIType.u32],
    returns: FFIType.ptr,
  },
  QueryFullProcessImageNameW: {
    args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr],
    returns: FFIType.bool,
  },
  CloseHandle: {
    args: [FFIType.ptr],
    returns: FFIType.bool,
  },

});

export interface WindowInfo {
  hwnd: any;
  title: string;
  pid: number;
  processName: string;
  processPath: string;
  isOBS: boolean;
}

export function getActiveWindow(): WindowInfo | null {
  const hwnd = user32.symbols.GetForegroundWindow();
  if (!hwnd || hwnd === 0) return null;

  // 1. Ambil Window Title (UTF-16LE, 512 chars)
  const titleBuf = new Uint8Array(1024);
  const len = user32.symbols.GetWindowTextW(hwnd, ptr(titleBuf), 512);
  let title = "";
  if (len > 0) {
    const view = new DataView(titleBuf.buffer);
    for (let i = 0; i < len * 2; i += 2) {
      title += String.fromCharCode(view.getUint16(i, true));
    }
  }

  // 2. Ambil PID
  const pidBuf = new Uint32Array(1);
  user32.symbols.GetWindowThreadProcessId(hwnd, ptr(pidBuf));
  const pid = pidBuf[0];

  // 3. Ambil Process Exe Name
  let processPath = "";
  let processName = "";
  const hProc = kernel32.symbols.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (hProc && hProc !== 0) {
    const pathBuf = new Uint8Array(2048);
    const sizeBuf = new Uint32Array([1024]);
    const ok = kernel32.symbols.QueryFullProcessImageNameW(hProc, 0, ptr(pathBuf), ptr(sizeBuf));
    if (ok) {
      const pathLen = sizeBuf[0];
      const view = new DataView(pathBuf.buffer);
      for (let i = 0; i < pathLen * 2; i += 2) {
        processPath += String.fromCharCode(view.getUint16(i, true));
      }
      const parts = processPath.split(/[\/\\]/);
      processName = parts[parts.length - 1] || "";
    }
    kernel32.symbols.CloseHandle(hProc);
  }

  const pLower = processName.toLowerCase();
  const tLower = title.toLowerCase();
  const isOBS = pLower.includes("obs64") || pLower.includes("obs32") || pLower.includes("obs.exe") || tLower.startsWith("obs ");

  return {
    hwnd,
    title,
    pid,
    processName,
    processPath,
    isOBS,
  };
}

export function getWindows(): WindowInfo[] {
  const results: WindowInfo[] = [];

  const textBuf = new Uint16Array(256);
  const textPtr = ptr(textBuf);

  const pidBuf = new Uint32Array(1);
  const pidPtr = ptr(pidBuf);

  const callback = new JSCallback(
    (hwnd: bigint, _lParam: bigint): boolean => {
      // if (!user32.symbols.IsWindowVisible(hwnd)) return true;

      const len = user32.symbols.GetWindowTextW(hwnd, textPtr, 256);
      if (len === 0) return true; // no title, skip

      const title = Buffer.from(textBuf.buffer, 0, len * 2).toString("utf16le");

      user32.symbols.GetWindowThreadProcessId(hwnd, pidPtr);
      const pid = pidBuf[0];

      const info: WindowInfo = { hwnd, title, pid };

      // if (title.includes(titleKeyword)) {
        results.push(info);
        // return false; // stop enumeration
      // }

      return true; // keep going
    },
    {
      args: [FFIType.ptr, FFIType.i64],
      returns: FFIType.bool,
    }
  );

  user32.symbols.EnumWindows(callback.ptr, 0n);
  callback.close();

  return results;
}
