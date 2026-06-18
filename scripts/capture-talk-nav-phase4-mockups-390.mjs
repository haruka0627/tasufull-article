/**
 * Phase 4 UI案 — 現状 + 案A + 案B スクリーンショット（390px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "talk-nav-phase4-proposal-390");
const PORTS = [5173, 5174, 5176, 5199, 5200, 5188];

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/talk-home.html`, { method: "GET" });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

const shots = [
  { file: "01-current-live.png", url: (base) => `${base}/talk-home.html?tab=chat&talkDev=1`, note: "現状（本番 talk-home）" },
  { file: "02-current-mock.png", url: (base) => `${base}/talk-nav-phase4-mockup.html?variant=current`, note: "現状（モック・左ナビ強調）" },
  { file: "03-proposal-a.png", url: (base) => `${base}/talk-nav-phase4-mockup.html?variant=proposalA`, note: "案A" },
  { file: "04-proposal-b-notify-tab.png", url: (base) => `${base}/talk-nav-phase4-mockup.html?variant=proposalB`, note: "案B・通知タブ" },
  { file: "05-proposal-b-all-tab.png", url: (base) => `${base}/talk-nav-phase4-mockup.html?variant=proposalBAll`, note: "案B・すべてタブ" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const manifest = [];
for (const shot of shots) {
  const url = shot.url(base);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const outPath = path.join(OUT_DIR, shot.file);
  await page.screenshot({ path: outPath, fullPage: false });
  manifest.push({ file: shot.file, note: shot.note, url });
  console.log("Captured:", shot.file);
}

await browser.close();
fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify({ base, shots: manifest }, null, 2));
console.log("Done:", OUT_DIR);
