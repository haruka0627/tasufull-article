import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "builder-top-review");
const TOP_PATH = path.join(__dirname, "..", "builder", "builder-top.html");

const SHOTS = [
  { file: "builder-top-pc1280.png", width: 1280, height: 900, fullPage: true },
  { file: "builder-top-footer-pc1280.png", width: 1280, height: 900, fullPage: false, footer: true },
  { file: "builder-top-mobile390.png", width: 390, height: 844, fullPage: true },
  { file: "builder-top-footer-mobile390.png", width: 390, height: 844, fullPage: false, footer: true },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
  });
  await page.goto(`file://${TOP_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("[data-builder-top-projects] .builder-top-project-card", { timeout: 10000 });

  if (shot.footer) {
    const footer = page.locator(".builder-top-footer");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const box = await footer.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(OUT_DIR, shot.file),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 8),
          width: shot.width,
          height: Math.min(box.height + 16, shot.height),
        },
      });
    }
  } else {
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT_DIR, shot.file),
      fullPage: shot.fullPage,
    });
  }

  console.log("Saved:", path.join(OUT_DIR, shot.file));
  await page.close();
}

});
console.log("Done.");

await closeAllBrowsers();
