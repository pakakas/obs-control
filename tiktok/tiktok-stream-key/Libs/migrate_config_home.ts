import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const homeConfigDir = path.join(os.homedir(), ".config", "tiktok");
const homeConfigPath = path.join(homeConfigDir, "config.json");
const localConfigPath = path.resolve(import.meta.dir, "../config.json");

if (!fs.existsSync(homeConfigDir)) {
  fs.mkdirSync(homeConfigDir, { recursive: true });
}

if (fs.existsSync(localConfigPath)) {
  const data = fs.readFileSync(localConfigPath, "utf-8");
  fs.writeFileSync(homeConfigPath, data, "utf-8");
  console.log("✓ config.json (termasuk RapidAPI Key) berhasil dipindahkan ke:", homeConfigPath);
} else {
  console.log("Local config not found, created at:", homeConfigPath);
}
