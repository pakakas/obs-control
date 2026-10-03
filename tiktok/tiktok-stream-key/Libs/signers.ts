import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

// Direktori konfigurasi standar: $HOME/.config/tiktok
export const HOME_CONFIG_DIR = path.join(os.homedir(), ".config", "tiktok");
export const CONFIG_PATH = path.join(HOME_CONFIG_DIR, "config.json");
export const DEFAULT_COOKIES_PATH = path.join(HOME_CONFIG_DIR, "cookies.json");

const DEFAULT_RAPIDAPI_URL = "https://tiktok-live-studio-api-signer1.p.rapidapi.com/";
const DEFAULT_RAPIDAPI_HOST = "tiktok-live-studio-api-signer1.p.rapidapi.com";

export interface Config {
  rapidapi_key?: string;
  signer_api_url?: string;
  priority_region?: string;
  cookies_path?: string;
}

export function readConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch {}
  return {};
}

export function saveConfig(cfg: Config): void {
  if (!fs.existsSync(HOME_CONFIG_DIR)) {
    fs.mkdirSync(HOME_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

export function makeXsStub(data: string | Uint8Array | null | undefined): string | null {
  if (!data || (typeof data === "string" && !data.trim())) return null;
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return crypto.createHash("md5").update(buf).digest("hex").toUpperCase();
}

export async function fetchSignatureHeaders(options: {
  timestamp?: number;
  aid?: string;
  params?: string | Record<string, any>;
  stub?: string | null;
  deviceId?: string;
  licenseId?: number;
  body?: Record<string, any>;
}): Promise<Record<string, string>> {
  const cfg = readConfig();
  const apiKey = process.env.RAPIDAPI_KEY || cfg.rapidapi_key || "";
  let baseUrl = process.env.TIKTOK_SIGNER_API_URL || cfg.signer_api_url || DEFAULT_RAPIDAPI_URL;
  if (!baseUrl.endsWith("/")) baseUrl += "/";

  const isRapidApi = baseUrl.includes("rapidapi.com");
  if (isRapidApi && !apiKey) {
    throw new Error("RapidAPI signer key dibutuhkan untuk membuat signature request.");
  }

  const timestamp = options.timestamp || Math.floor(Date.now() / 1000);

  let paramsObj: Record<string, any> = {};
  if (typeof options.params === "string") {
    const sp = new URLSearchParams(options.params);
    sp.forEach((v, k) => { paramsObj[k] = v; });
  } else if (options.params) {
    paramsObj = options.params;
  }

  const deviceId = options.deviceId || paramsObj.device_id || "";
  const aid = options.aid || paramsObj.aid || "8311";
  const priorityRegion = cfg.priority_region || paramsObj.priority_region || "";

  const templateObj: Record<string, any> = {
    id: "req_sign",
    aid: aid,
    device_id: deviceId,
    params: {
      aid: aid,
      device_platform: paramsObj.device_platform || "win",
      device_id: deviceId,
      ...paramsObj
    }
  };

  if (priorityRegion) {
    templateObj.params.priority_region = priorityRegion;
  }

  if (options.licenseId !== undefined) {
    templateObj.license_id = options.licenseId;
  }

  if (options.body) {
    templateObj.body_type = "form";
    templateObj.body = options.body;
  }

  const payload = {
    start_timestamp: timestamp,
    count: 1,
    step_seconds: 1,
    templates: [templateObj]
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isRapidApi) {
    headers["x-rapidapi-key"] = apiKey;
    headers["x-rapidapi-host"] = DEFAULT_RAPIDAPI_HOST;
  }

  const signUrl = `${baseUrl}signatures/batch`;
  const res = await fetch(signUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Signer API error (${res.status}): ${txt}`);
  }

  const json = (await res.json()) as any;
  if (!json.success || !json.signatures?.[0]) {
    throw new Error(json.message || "Failed to generate signature from batch signer");
  }

  const sig = json.signatures[0];
  return {
    "x-ladon": sig.headers["x-ladon"] || sig.headers["X-Ladon"] || "",
    "x-khronos": String(sig.headers["x-khronos"] || sig.headers["X-Khronos"] || timestamp),
    "x-argus": sig.headers["x-argus"] || sig.headers["X-Argus"] || "",
    "x-gorgon": sig.headers["x-gorgon"] || sig.headers["X-Gorgon"] || "",
  };
}
