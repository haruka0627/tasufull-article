/**
 * 透過 LEGEND PNG → legend.svg（ベクター容器・高解像度表示用）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const assetsDir =
  process.env.LEGEND_PNG_SRC ||
  path.join(
    root,
    "..",
    ".cursor",
    "projects",
    "c-Users-rubih-tasufull-article",
    "assets"
  );

async function findSourcePng() {
  const explicit = process.argv[2];
  if (explicit && fs.existsSync(explicit)) return explicit;

  const preferred = path.join(
    assetsDir,
    "c__Users_rubih_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_LEGEND-94fad7ce-bdc4-490c-95ef-621cf7160700.png"
  );
  if (fs.existsSync(preferred)) return preferred;

  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Assets not found: ${assetsDir}`);
  }
  const hit = fs
    .readdirSync(assetsDir)
    .find((name) => /LEGEND-94fad7ce/i.test(name));
  if (!hit) throw new Error("LEGEND source PNG not found");
  return path.join(assetsDir, hit);
}

async function main() {
  const src = await findSourcePng();
  const buf = fs.readFileSync(src);
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;
  const b64 = buf.toString("base64");
  const out = path.join(root, "images", "rank", "legend.svg");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="LEGEND member plate">
  <title>LEGEND</title>
  <image width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${b64}"/>
</svg>`;

  fs.writeFileSync(out, svg, "utf8");
  console.log(`Built ${out} from ${path.basename(src)} (${w}x${h})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
