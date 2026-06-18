import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-dashboard-review");
const INDEX_PATH = path.join(__dirname, "..", "builder", "index.html");

const SHOTS = [
  { file: "builder-dashboard-pc1280.png", width: 1280, height: 900 },
  { file: "builder-dashboard-mobile390.png", width: 390, height: 844 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
  });
  await page.goto(`file://${INDEX_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("[data-builder-recent-list] .builder-recent-card", { timeout: 10000 });
  await page.waitForTimeout(800);

  const outPath = path.join(OUT_DIR, shot.file);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Saved:", outPath);
  await page.close();
}

});
console.log("Done.");

await closeAllBrowsers();
