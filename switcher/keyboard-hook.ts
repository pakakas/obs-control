import { EventEmitter } from "node:events";
import path from "node:path";

export const keyboardHook = new EventEmitter();

const VK_LMENU = 0xa4
const VK_RMENU = 0xa5
const LLKHF_UP = 0x80;

let altHeld = false;
let tabCount = 0;

/** Ganti pengganti isAltPressed() lama — state ini di-update dari event worker, bukan polling. */
export function isAltHeld(): boolean {
  return altHeld;
}

function createLogger() {
  return new Proxy({}, {
    get(target, message, receiver) {
      return () => {
        if (message.startsWith('error')) {
          console.error("[KeyboardHook]", message);
        } else {
          console.log("[KeyboardHook]", message);
        }
      }
    },
  })
}

function createHandler(fn) {
  return new Proxy({}, {
    get(target, message, receiver) {
      return fn //(args) => fn(args)
    },
  })
}

function altPressed(flags) {
  const isKeyUp = (flags & LLKHF_UP) !== 0;
}

const workerUrl = new URL("./keyboard-hook-worker.ts", import.meta.url).href;
const worker = new Worker(workerUrl);

const handlers = {
  state: {
    ready() {
      console.log("[KeyboardHook] Low-level hook terpasang (event-driven, no polling).");
    }
  },

  kbd: createHandler((data) => {
    // console.log("[KeyboardHook]", {data});
    const isKeyUp = (data.flags & LLKHF_UP) !== 0;

    if ([VK_LMENU, VK_RMENU].includes(data.vkCode) && isKeyUp) {
      keyboardHook.emit("altReleased");
    }
  }),

  btn: {
    altDown() {
      altHeld = true;
    },
    tabDown() {
      if (altHeld) {
        tabCount++;
        console.log(`[Press Tab #${tabCount}] Sedang memilih window... (Alt masih ditahan)`);
      }
    },
    altUp() {
      altHeld = false;
      const totalTabs = tabCount;
      tabCount = 0;

      console.log(`alt up`);

      keyboardHook.emit("altReleased", totalTabs);
    }
  },
  
  log: createLogger()
}

worker.onmessage = (event: MessageEvent<any>) => {
  for (let fn in event.data) {
    if (fn === 'btn') {
      // console.debug('btn:'+ event.data[fn])
    }
    handlers[fn][event.data[fn]](event.data[fn])
    break
  }
};

worker.onerror = (err: any) => {
  console.error("[KeyboardHook] Worker crash:", err?.message || err);
};

export function stopKeyboardHook() {
  worker.terminate();
}