#!/usr/bin/env node
/**
 * ランクアイコン透過表示確認 — http://127.0.0.1:8788
 *   npm run dev
 *   node scripts/verify-rank-icons-8788.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "rank-icons-verify");
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");

const RANK_FILES = [
  { key: "new", label: "ROOKIE", file: "new.webp" },
  { key: "iron", label: "IRON", file: "iron.webp" },
  { key: "bronze", label: "BRONZE", file: "bronze.webp" },
  { key: "silver", label: "SILVER", file: "silver.webp" },
  { key: "gold", label: "GOLD", file: "gold.webp" },
  { key: "platinum", label: "PLATINUM", file: "platinum.webp" },
  { key: "diamond", label: "DIAMOND", file: "diamond.webp" },
  { key: "legend", label: "MASTER", file: "legend.png" },
];

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

function buildPreviewHtml(baseUrl = "") {
  const prefix = baseUrl.replace(/\/$/, "");
  const cards = RANK_FILES.map(
    (r) => `
    <figure class="rank-preview-card" data-rank="${r.key}">
      <img src="${prefix}/images/rank/${r.file}" alt="${r.label}" width="220" height="auto" loading="eager">
      <figcaption>${r.label} <code>${r.file}</code></figcaption>
    </figure>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Rank icon verify</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #f7f6f3; color: #1c1c1a; }
    .panel-dark { background: #1e293b; padding: 24px; }
    .panel-light { background: #ffffff; padding: 24px; border-top: 1px solid #e8e5de; }
    h1 { font-size: 1rem; margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .rank-preview-card { margin: 0; text-align: center; }
    .rank-preview-card img { display: block; width: 220px; max-width: 100%; margin: 0 auto; }
    figcaption { margin-top: 8px; font-size: 0.75rem; }
    code { font-size: 0.6875rem; }
  </style>
</head>
<body>
  <div class="panel-light"><h1>Light background</h1><div class="grid">${cards}</div></div>
  <div class="panel-dark"><h1>Dark background</h1><div class="grid">${cards}</div></div>
</body>
</html>`;
}

async function checkHttp(url) {
  const res = await fetch(url, { method: "GET" });
  return res.status;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const previewPath = path.join(OUT_DIR, "rank-icons-preview.html");
  fs.writeFileSync(previewPath, buildPreviewHtml(BASE));

  console.log("=== Rank icon verify @ 8788 ===\n");

  for (const r of RANK_FILES) {
    const url = `${BASE}/images/rank/${r.file}`;
    const status = await checkHttp(url);
    console.log(`${r.label.padEnd(8)} ${url} -> HTTP ${status}`);
    if (status !== 200) {
      throw new Error(`Missing rank asset: ${url}`);
    }
  }

  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto(`${BASE}/product.html`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.evaluate(
        ({ cardsHtml }) => {
          const style = document.createElement("style");
          style.textContent = `
            body { margin: 0; font-family: sans-serif; background: #f7f6f3; color: #1c1c1a; }
            .panel-dark { background: #1e293b; padding: 24px; color: #f8fafc; }
            .panel-light { background: #ffffff; padding: 24px; border-top: 1px solid #e8e5de; }
            h1 { font-size: 1rem; margin: 0 0 16px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
            .rank-preview-card { margin: 0; text-align: center; }
            .rank-preview-card img { display: block; width: 220px; max-width: 100%; margin: 0 auto; }
            figcaption { margin-top: 8px; font-size: 0.75rem; }
            code { font-size: 0.6875rem; }
          `;
          document.head.appendChild(style);
          document.body.innerHTML = "";
          const light = document.createElement("div");
          light.className = "panel-light";
          light.innerHTML = `<h1>Light background</h1><div class="grid">${cardsHtml}</div>`;
          const dark = document.createElement("div");
          dark.className = "panel-dark";
          dark.innerHTML = `<h1>Dark background</h1><div class="grid">${cardsHtml}</div>`;
          document.body.append(light, dark);
        },
        { cardsHtml: RANK_FILES.map((r) => `
    <figure class="rank-preview-card" data-rank="${r.key}">
      <img src="/images/rank/${r.file}" alt="${r.label}" width="220" height="auto" loading="eager">
      <figcaption>${r.label} <code>${r.file}</code></figcaption>
    </figure>`).join("") }
      );
      await page.waitForFunction(() => {
        const imgs = [...document.querySelectorAll(".rank-preview-card img")];
        return imgs.length === 16 && imgs.every((img) => img.complete && img.naturalWidth > 0);
      });

      const metrics = await page.evaluate(() => {
        const seen = new Set();
        const imgs = [...document.querySelectorAll(".panel-light .rank-preview-card img")];
        return imgs.filter((img) => {
          if (seen.has(img.alt)) return false;
          seen.add(img.alt);
          return true;
        }).map((img) => {
          const canvas = document.createElement("canvas");
          const w = Math.min(img.naturalWidth || 64, 64);
          const h = Math.min(img.naturalHeight || 64, 64);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const corners = [
            ctx.getImageData(0, 0, 1, 1).data,
            ctx.getImageData(w - 1, 0, 1, 1).data,
            ctx.getImageData(0, h - 1, 1, 1).data,
            ctx.getImageData(w - 1, h - 1, 1, 1).data,
          ];
          const cornerAlpha = corners.map((px) => px[3]);
          const center = ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data;
          return {
            alt: img.alt,
            src: img.getAttribute("src"),
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            cornerAlpha,
            centerAlpha: center[3],
            transparentCorners: cornerAlpha.every((a) => a < 16),
          };
        });
      });

      console.log(`\nViewport ${vp.name}px — console errors: ${errors.length}`);
      for (const m of metrics) {
        const ok = m.transparentCorners ? "PASS" : "FAIL";
        console.log(
          `  ${ok} ${m.alt}: ${m.naturalWidth}x${m.naturalHeight} cornerAlpha=${m.cornerAlpha.join(",")}`
        );
        if (!m.transparentCorners) {
          throw new Error(`White box detected on ${m.alt} at ${vp.name}px`);
        }
      }

      const shotPath = path.join(OUT_DIR, `rank-icons-${vp.name}.png`);
      try {
        await page.screenshot({ path: shotPath, fullPage: false, timeout: 15000 });
      } catch (shotErr) {
        console.warn(`  screenshot skipped (${vp.name}px): ${shotErr.message}`);
      }

      await page.close();
    }
  });

  console.log(`\nScreenshots: ${OUT_DIR}`);
  console.log("ALL PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
