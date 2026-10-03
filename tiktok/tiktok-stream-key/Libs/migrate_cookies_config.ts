import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const homeConfigTiktokDir = path.join(os.homedir(), ".config", "tiktok");
const homeConfigCookiesPath = path.join(homeConfigTiktokDir, "cookies.json");
const sourceCookiesPath = path.join(os.homedir(), ".tiktok", "cookies.json");
const fallbackLocalCookiesPath = path.resolve(import.meta.dir, "../cookies.json");

if (!fs.existsSync(homeConfigTiktokDir)) {
  fs.mkdirSync(homeConfigTiktokDir, { recursive: true });
}

let dataToCopy = "";
if (fs.existsSync(sourceCookiesPath)) {
  dataToCopy = fs.readFileSync(sourceCookiesPath, "utf-8");
} else if (fs.existsSync(fallbackLocalCookiesPath)) {
  dataToCopy = fs.readFileSync(fallbackLocalCookiesPath, "utf-8");
}

if (dataToCopy) {
  fs.writeFileSync(homeConfigCookiesPath, dataToCopy, "utf-8");
  console.log("✓ Cookies berhasil disimpan ke:", homeConfigCookiesPath);
} else {
  console.log("Created empty directory:", homeConfigTiktokDir);
}
