/**
 * Builder案件詳細 — カード分離 390px スクリーンショット
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "deal-detail-builder-cards");

const PORTS = [5173, 5176, 5174, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/deal-detail.html?id=builder_demo_001`, {
        method: "HEAD",
      });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const SHOTS = [
  { file: "full-client-390.png", url: "/deal-detail.html?id=builder_demo_001" },
  { file: "focus-completion-390.png", url: "/deal-detail.html?id=builder_demo_001#completion" },
  { file: "focus-project-assigned-390.png", url: "/deal-detail.html?id=builder_demo_001&role=worker#project" },
  { file: "focus-project-worker-no-hash-390.png", url: "/deal-detail.html?id=builder_demo_001&role=worker" },
  { file: "focus-invoice-390.png", url: "/deal-detail.html?id=builder_demo_001#invoice" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

for (const shot of SHOTS) {
  await page.goto(`${base}${shot.url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(900);
  const outPath = path.join(OUT_DIR, shot.file);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Saved:", outPath);
}

});

await closeAllBrowsers();
