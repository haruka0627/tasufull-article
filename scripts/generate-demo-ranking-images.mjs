import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "images", "demo-ranking");
await mkdir(outDir, { recursive: true });

const sections = {
  popular: [
    { a: "#1e3a5f", b: "#6ba3d4", c: "#e8f2fa" },
    { a: "#2d4a3a", b: "#7eb89a", c: "#eef8f3" },
    { a: "#3d2c4a", b: "#b89ad4", c: "#f5f0fb" },
    { a: "#4a3520", b: "#d4a86a", c: "#faf5eb" },
    { a: "#1a3348", b: "#5a9ec8", c: "#edf6fc" },
  ],
  new: [
    { a: "#1a4048", b: "#5eb8c8", c: "#e8f8fa" },
    { a: "#2a3d52", b: "#8aaed4", c: "#f0f6fc" },
    { a: "#3a2848", b: "#c49ae8", c: "#f8f2fc" },
    { a: "#284838", b: "#72c49a", c: "#eefaf3" },
    { a: "#483828", b: "#e8b878", c: "#fff8ee" },
  ],
  product: [
    { a: "#2a2420", b: "#c9956a", c: "#faf6f0" },
    { a: "#1e2838", b: "#8898b8", c: "#f2f5fa" },
    { a: "#382818", b: "#d8a050", c: "#fff6e8" },
    { a: "#182838", b: "#68a8d8", c: "#eef6fc" },
    { a: "#302018", b: "#b87848", c: "#faf0e8" },
  ],
  skill: [
    { a: "#1e3050", b: "#6090d8", c: "#edf4fc" },
    { a: "#283848", b: "#78a8c8", c: "#f0f6fa" },
    { a: "#3a2858", b: "#a888d8", c: "#f6f2fc" },
    { a: "#2a4838", b: "#68b888", c: "#effaf4" },
    { a: "#483020", b: "#d8a060", c: "#fff8f0" },
  ],
};

const w = 520;
const h = 320;

for (const [section, palettes] of Object.entries(sections)) {
  for (let i = 0; i < palettes.length; i++) {
    const p = palettes[i];
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${p.a}"/>
          <stop offset="50%" stop-color="${p.b}"/>
          <stop offset="100%" stop-color="${p.c}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <ellipse cx="${w * 0.75}" cy="${h * 0.3}" rx="90" ry="60" fill="rgba(255,255,255,0.1)"/>
      <ellipse cx="${w * 0.2}" cy="${h * 0.72}" rx="110" ry="70" fill="rgba(255,255,255,0.07)"/>
    </svg>`;
    const name = `${section}-${String(i + 1).padStart(2, "0")}.jpg`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(join(outDir, name));
    console.log("wrote", name);
  }
}

// Legacy filenames for backward compatibility
const legacy = ["rank-01", "rank-02", "rank-03", "rank-04", "rank-05"];
for (let i = 0; i < 5; i++) {
  const src = join(outDir, `popular-${String(i + 1).padStart(2, "0")}.jpg`);
  const dest = join(outDir, `${legacy[i]}.jpg`);
  await sharp(src).toFile(dest);
}
