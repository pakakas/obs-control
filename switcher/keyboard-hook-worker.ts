import { dlopen, FFIType, JSCallback, ptr, toArrayBuffer } from "bun:ffi";

// --- Konstanta WinAPI ---
const WH_KEYBOARD_LL = 13;
const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const WM_SYSKEYDOWN = 0x0104; // Alt ditahan -> key lain jadi SYSKEY
const WM_SYSKEYUP = 0x0105;
const VK_MENU = 0x12; // Alt
const VK_LMENU = 0xa4
const VK_RMENU = 0xa5
const VK_TAB = 0x09;
const LLKHF_UP = 0x80;

const user32 = dlopen("user32.dll", {
  SetWindowsHookExW: {
    args: [FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.u32],
    returns: FFIType.ptr,
  },
  UnhookWindowsHookEx: { args: [FFIType.ptr], returns: FFIType.i32 },
  CallNextHookEx: {
    args: [FFIType.ptr, FFIType.i32, FFIType.u64, FFIType.ptr],
    returns: FFIType.ptr,
  },
  GetMessageW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.u32],
    returns: FFIType.i32,
  },
  TranslateMessage: { args: [FFIType.ptr], returns: FFIType.i32 },
  DispatchMessageW: { args: [FFIType.ptr], returns: FFIType.ptr },
});

// nCode: i32, wParam: WPARAM (pointer-sized -> u64 di x64), lParam: LPARAM -> pointer ke KBDLLHOOKSTRUCT
const hookProc = new JSCallback(
  (nCode: number, wParam: number | bigint, lParam: any) => {
    // console.debug({ nCode, wParam, lParam })
    if (nCode >= 0 && lParam) {
      try {
        // KBDLLHOOKSTRUCT: vkCode ada di 4 byte pertama, cukup ini yang kita perlu
        const vkCode = new Uint32Array(toArrayBuffer(lParam, 0, 4))[0];
        const flags = new Uint32Array(toArrayBuffer(lParam, 8, 4))[0];

        const isKeyUp = (flags & LLKHF_UP) !== 0;
        const w = Number(wParam);
        // console.debug({ w, vkCode, flags, isKeyUp })

        postMessage({ kbd: {vkCode, flags} });
        // if (vkCode === VK_MENU && (w === WM_KEYDOWN || w === WM_SYSKEYDOWN)) {
          // postMessage({ btn: "altDown" });
        // } else if ([VK_LMENU, VK_RMENU].includes(vkCode) && isKeyUp) {
        //   // w === WM_KEYUP) {
        //   postMessage({ btn: "altUp" });
        // } else if (vkCode === VK_TAB && (w === WM_KEYDOWN || w === WM_SYSKEYDOWN)) {
        //   postMessage({ btn: "tabDown" });
        // }
      } catch (e) {
        // jangan biarin error di callback native bikin proses mati
      }
    }
    return user32.symbols.CallNextHookEx(null, nCode, BigInt(wParam as any), lParam);
  },
  {
    args: [FFIType.i32, FFIType.u64, FFIType.ptr],
    returns: FFIType.ptr,
  }
);

const hHook = user32.symbols.SetWindowsHookExW(WH_KEYBOARD_LL, hookProc.ptr, null, 0);

if (!hHook) {
  postMessage({ log: "error: SetWindowsHookExW gagal (hHook null)" });
} else {
  postMessage({ state: "ready" });
}

// --- Message loop: BLOCKING, tapi ini thread worker sendiri jadi ga ganggu main thread ---
// GetMessageW tidur (0% CPU) sampe ada event masuk ke message queue thread ini.
// Wajib ada loop ini selama hook low-level mau tetep hidup & callback ke-invoke.
const msgBuf = new Uint8Array(48); // struct MSG (x64, dengan padding)

while (true) {
  postMessage({ log: 'in GetMessageW loop:' + new Date() })
  const ret = user32.symbols.GetMessageW(ptr(msgBuf), null, 0, 0);
  if (ret <= 0) break; // 0 = WM_QUIT, -1 = error
  user32.symbols.TranslateMessage(ptr(msgBuf));
  user32.symbols.DispatchMessageW(ptr(msgBuf));
}

user32.symbols.UnhookWindowsHookEx(hHook);
