import fs from "node:fs";
import path from "node:path";
import { fetchSignatureHeaders, makeXsStub, readConfig, DEFAULT_COOKIES_PATH } from "./signers";

export interface StreamInfo {
  roomId: string;
  streamId: string;
  serverUrl: string;
  streamKey: string;
  streamUrl: string;
  multiServerUrl?: string;
  multiStreamKey?: string;
  shareUrl?: string;
}

export class TikTokClient {
  private cookiesPath: string;
  private cookies: Record<string, string> = {};
  public roomId: string = "";
  public streamId: string = "";
  public serverUrl: string = "";
  public streamKey: string = "";
  public streamUrl: string = "";

  constructor(cookiesPath?: string) {
    this.cookiesPath = cookiesPath || readConfig().cookies_path || DEFAULT_COOKIES_PATH;
    this.loadCookies();
  }

  public loadCookies(): void {
    try {
      if (fs.existsSync(this.cookiesPath)) {
        const raw = fs.readFileSync(this.cookiesPath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.cookies = {};
          for (const item of list) {
            if (item.name && item.value !== undefined) {
              this.cookies[item.name] = item.value;
            }
          }
        } else if (typeof list === "object") {
          this.cookies = list;
        }
      }
    } catch {}
  }

  public saveCookies(cookieList: any[]): void {
    fs.writeFileSync(this.cookiesPath, JSON.stringify(cookieList, null, 2), "utf-8");
    this.loadCookies();
  }

  public hasCookies(): boolean {
    return Object.keys(this.cookies).length > 0;
  }

  private getCookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  private getCommonParams(extra: Record<string, string> = {}): URLSearchParams {
    const cfg = readConfig();
    const baseParams: Record<string, string> = {
      aid: "8311",
      app_name: "tiktok_live_studio",
      channel: "studio",
      device_platform: "windows",
      live_mode: "6",
      app_version: "0.64.0",
      version_code: "064000",
      ...extra,
    };
    if (cfg.priority_region) {
      baseParams.priority_region = cfg.priority_region;
    }
    return new URLSearchParams(baseParams);
  }

  private getBaseHeaders(): Record<string, string> {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) TikTokLIVEStudio/0.64.0 Chrome/136.0.0.0 Electron/35.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Cookie": this.getCookieHeader(),
    };
  }

  private async signedRequest(method: "GET" | "POST", url: string, params: URLSearchParams, bodyData?: Record<string, any>): Promise<any> {
    const paramStr = params.toString();
    const fullUrl = `${url}?${paramStr}`;
    let bodyStr: string | null = null;
    let stub: string | null = null;

    if (bodyData && method === "POST") {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(bodyData)) {
        form.append(k, String(v));
      }
      bodyStr = form.toString();
      stub = makeXsStub(bodyStr);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signHeaders = await fetchSignatureHeaders({
      timestamp,
      aid: "8311",
      params: paramStr,
      stub,
      body: bodyData
    });

    const headers: Record<string, string> = {
      ...this.getBaseHeaders(),
      ...signHeaders,
    };
    if (stub) headers["x-ss-stub"] = stub;
    if (bodyStr) headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";

    const res = await fetch(fullUrl, {
      method,
      headers,
      body: bodyStr || undefined,
    });

    const json = (await res.json()) as any;
    if (json.status_code !== 0 && json.status_code !== undefined) {
      const msg = json.data?.message || json.data?.prompts || json.message || `Error status_code: ${json.status_code}`;
      throw new Error(msg);
    }
    return json.data || json;
  }

  public async getAccountInfo(): Promise<any> {
    if (!this.hasCookies()) {
      throw new Error(`File cookies.json belum ada di: ${this.cookiesPath}`);
    }
    const params = this.getCommonParams();
    return await this.signedRequest("GET", "https://webcast.tiktok.com/webcast/room/create_info/", params);
  }

  public async getHashtagList(): Promise<any> {
    const params = this.getCommonParams();
    return await this.signedRequest("GET", "https://webcast.tiktok.com/webcast/room/hashtag/list/", params);
  }

  public async getIdentity(): Promise<any> {
    const params = this.getCommonParams();
    return await this.signedRequest("GET", "https://www.tiktok.com/passport/web/account/info/", params);
  }

  public async createStream(options: {
    title?: string;
    topicId?: string;
    ageRestricted?: boolean;
    multiStream?: boolean;
  } = {}): Promise<StreamInfo> {
    if (!this.hasCookies()) {
      throw new Error("Cookies akun belum dimasukkan. Silakan paste cookies terlebih dahulu.");
    }

    const title = options.title || "Live Stream";
    const topicId = options.topicId || "5";
    const params = this.getCommonParams();

    const postData: Record<string, any> = {
      title,
      hashtag_id: topicId,
      live_mode: "6",
      enable_multi_stream: options.multiStream ? "1" : "0",
      age_restricted: options.ageRestricted ? "1" : "0",
    };

    const data = await this.signedRequest("POST", "https://webcast.tiktok.com/webcast/room/create/", params, postData);

    const room = data.room || data;
    this.roomId = String(room.id_str || room.id || "");
    this.streamId = String(room.stream_id_str || room.stream_id || "");

    const streamUrlObj = room.stream_url || {};
    this.streamUrl = streamUrlObj.complete_push_url || "";
    this.serverUrl = streamUrlObj.rtmp_push_url || "";
    this.streamKey = streamUrlObj.rtmp_key || "";

    const multiStreamUrlObj = room.multi_stream_url || {};
    const multiServerUrl = multiStreamUrlObj.rtmp_push_url || "";
    const multiStreamKey = multiStreamUrlObj.rtmp_key || "";

    if (!this.serverUrl && this.streamUrl) {
      const parts = this.streamUrl.split("/");
      this.streamKey = parts.pop() || "";
      this.serverUrl = parts.join("/");
    }

    return {
      roomId: this.roomId,
      streamId: this.streamId,
      serverUrl: this.serverUrl,
      streamKey: this.streamKey,
      streamUrl: this.streamUrl,
      multiServerUrl,
      multiStreamKey,
      shareUrl: room.share_url || "",
    };
  }

  public async endStream(roomId?: string): Promise<any> {
    const id = roomId || this.roomId;
    if (!id) throw new Error("Room ID tidak ditemukan untuk endStream");
    const params = this.getCommonParams({ room_id: id });
    return await this.signedRequest("POST", "https://webcast.tiktok.com/webcast/room/finish_abnormal/", params);
  }
}
