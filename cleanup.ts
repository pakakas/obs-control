import fs from "node:fs";
import path from "node:path";

const dir = "F:\\work\\00-oss\\maintenis\\pakakas\\obs-control";
const toRemove = ["check_audio.ts", "mute_global_audio.ts", "register_blender.ts"];

for (const file of toRemove) {
  const p = path.join(dir, file);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log("Removed:", file);
  }
}
