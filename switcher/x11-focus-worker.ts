import { dlopen, FFIType, ptr } from "bun:ffi";

const x11 = dlopen("libX11.so.6", {
  XOpenDisplay: { args: [FFIType.ptr], returns: FFIType.ptr },
  XCloseDisplay: { args: [FFIType.ptr], returns: FFIType.i32 },
  XDefaultScreen: { args: [FFIType.ptr], returns: FFIType.i32 },
  XRootWindow: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.u64 },
  XInternAtom: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.u64 },
  XSelectInput: { args: [FFIType.ptr, FFIType.u64, FFIType.u64], returns: FFIType.i32 },
  XFlush: { args: [FFIType.ptr], returns: FFIType.i32 },
  XNextEvent: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
});

const display = x11.symbols.XOpenDisplay(null);
if (!display) {
  postMessage({ type: "error", message: `XOpenDisplay gagal (DISPLAY=${process.env.DISPLAY || "kosong"})` });
  throw new Error("Tidak dapat membuka X11 display");
}

const root = x11.symbols.XRootWindow(display, x11.symbols.XDefaultScreen(display));
const atomName = Buffer.from("_NET_ACTIVE_WINDOW\0");
const activeWindowAtom = x11.symbols.XInternAtom(display, ptr(atomName), 0);
const PROPERTY_CHANGE_MASK = 1n << 22n;

// XSelectInput queues the request and returns 1; X errors are asynchronous.
x11.symbols.XSelectInput(display, root, PROPERTY_CHANGE_MASK);
x11.symbols.XFlush(display);
postMessage({ type: "ready" });

// XEvent is a 192-byte union on 64-bit Linux. XPropertyEvent's atom is at byte 40.
const eventBuffer = new Uint8Array(192);
const eventView = new DataView(eventBuffer.buffer);
const PROPERTY_NOTIFY = 28;

while (true) {
  x11.symbols.XNextEvent(display, ptr(eventBuffer));
  const eventType = eventView.getInt32(0, true);
  if (eventType !== PROPERTY_NOTIFY) continue;
  const changedAtom = eventView.getBigUint64(40, true);
  if (changedAtom === activeWindowAtom) postMessage({ type: "focus-changed" });
}
