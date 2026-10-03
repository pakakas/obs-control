import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const homeTiktokDir = path.join(os.homedir(), ".tiktok");
const homeCookiesPath = path.join(homeTiktokDir, "cookies.json");
const localCookiesPath = path.resolve(import.meta.dir, "../cookies.json");

if (!fs.existsSync(homeTiktokDir)) {
  fs.mkdirSync(homeTiktokDir, { recursive: true });
}

if (fs.existsSync(localCookiesPath)) {
  const data = fs.readFileSync(localCookiesPath, "utf-8");
  fs.writeFileSync(homeCookiesPath, data, "utf-8");
  console.log("✓ Cookies berhasil dipindahkan/disalin ke HOME:", homeCookiesPath);
} else {
  console.log("Local cookies not found, created empty directory at:", homeTiktokDir);
}
