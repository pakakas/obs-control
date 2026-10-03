import fs from "node:fs";

export interface CookieItem {
  name: string;
  value: string;
}

export async function getCookiesViaCDP(port: number = 9222): Promise<CookieItem[]> {
  // 1. Fetch targets from CDP
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!listRes.ok) {
    throw new Error(`CDP /json/list merespons status ${listRes.status}. Pastikan browser dijalankan dengan flag: --remote-debugging-port=${port} --remote-allow-origins=*`);
  }
  const targets = (await listRes.json()) as any[];
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("Tidak ada tab browser aktif yang terdeteksi di CDP port " + port);
  }

  // Cari tab tiktok atau gunakan page target pertama
  const target = targets.find(t => t.type === "page" && t.url?.includes("tiktok.com")) || targets.find(t => t.type === "page") || targets[0];
  const wsUrl = target.webSocketDebuggerUrl;
  if (!wsUrl) {
    throw new Error("webSocketDebuggerUrl tidak tersedia pada target CDP.");
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Timeout saat mengambil cookies dari CDP WebSocket"));
    }, 6000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: "Network.getCookies",
        params: { urls: ["https://www.tiktok.com", "https://webcast.tiktok.com"] }
      }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timer);
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === 1 && msg.result) {
          const rawCookies = msg.result.cookies || [];
          const formatted: CookieItem[] = rawCookies.map((c: any) => ({
            name: c.name,
            value: c.value,
          }));
          ws.close();
          resolve(formatted);
        }
      } catch (err) {
        ws.close();
        reject(err);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(new Error("Gagal koneksi ke CDP WebSocket: " + String(err)));
    };
  });
}
