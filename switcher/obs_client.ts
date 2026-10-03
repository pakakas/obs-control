import crypto from "node:crypto";

export interface OBSScene {
  sceneName: string;
  sceneIndex: number;
}

export class OBSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private password?: string;
  private reqIdCounter: number = 1;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  public isConnected: boolean = false;
  public currentScene: string = "";
  public availableScenes: string[] = [];

  constructor(url: string = "ws://127.0.0.1:4455", password?: string) {
    this.url = url;
    this.password = password;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        return reject(err);
      }

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          this.disconnect();
          reject(new Error("Koneksi ke OBS WebSocket (port 4455) timeout. Pastikan OBS WebSocket sudah diaktifkan di Tools -> WebSocket Server Settings."));
        }
      }, 5000);

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          const op = msg.op;
          const d = msg.d;

          // Op 0: Hello from OBS
          if (op === 0) {
            let authResponse: string | undefined = undefined;
            if (d.authentication && this.password) {
              const { challenge, salt } = d.authentication;
              const secret = crypto.createHash("sha256").update(this.password + salt).digest("base64");
              authResponse = crypto.createHash("sha256").update(secret + challenge).digest("base64");
            }

            // Send Op 1: Identify
            this.ws?.send(JSON.stringify({
              op: 1,
              d: {
                rpcVersion: 1,
                authentication: authResponse,
                eventSubscriptions: 33, // General + Scenes
              }
            }));
          }

          // Op 2: Identified (Connection successful)
          if (op === 2) {
            clearTimeout(timeout);
            this.isConnected = true;
            await this.refreshScenes();
            resolve();
          }

          // Op 5: Event
          if (op === 5) {
            if (d.eventType === "CurrentProgramSceneChanged") {
              this.currentScene = d.eventData?.sceneName || this.currentScene;
            } else if (d.eventType === "SceneListChanged" || d.eventType === "SceneCreated" || d.eventType === "SceneRemoved") {
              this.refreshScenes().catch(() => {});
            }
          }

          // Op 7: RequestResponse
          if (op === 7) {
            const reqId = d.requestId;
            const handler = this.pendingRequests.get(reqId);
            if (handler) {
              this.pendingRequests.delete(reqId);
              if (d.requestStatus?.result) {
                handler.resolve(d.responseData);
              } else {
                handler.reject(new Error(d.requestStatus?.comment || "OBS request failed"));
              }
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };

      this.ws.onerror = (err) => {
        clearTimeout(timeout);
        if (!this.isConnected) {
          reject(new Error("Gagal koneksi ke OBS WebSocket: " + String(err)));
        }
      };
    });
  }

  public async call(requestType: string, requestData?: Record<string, any>): Promise<any> {
    if (!this.ws || !this.isConnected) {
      throw new Error("OBS WebSocket belum terhubung.");
    }
    const requestId = String(this.reqIdCounter++);
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.ws?.send(JSON.stringify({
        op: 6,
        d: {
          requestType,
          requestId,
          requestData: requestData || {},
        }
      }));
    });
  }

  public async refreshScenes(): Promise<void> {
    try {
      const data = await this.call("GetSceneList");
      this.currentScene = data.currentProgramSceneName || "";
      const scenes: any[] = data.scenes || [];
      this.availableScenes = scenes.map((s: any) => s.sceneName);
    } catch {}
  }

  public async switchScene(sceneName: string): Promise<boolean> {
    if (this.currentScene === sceneName) return false;
    await this.call("SetCurrentProgramScene", { sceneName });
    this.currentScene = sceneName;
    return true;
  }

  public disconnect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export { OBSClient as OBSWebSocketClient };
