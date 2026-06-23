/**
 * Builder TOP — 建設ツールセクション UI レビュー用スクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "reports", "screenshots", "builder-top-ct-review");
const TOP_PATH = path.join(root, "builder", "builder-top.html");

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {
  for (const vp of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`file://${TOP_PATH}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".builder-top-ct", { timeout: 10000 });
    await page.waitForSelector("[data-builder-top-projects] .builder-top-project-card", { timeout: 10000 });
    await page.waitForTimeout(400);

    const tag = `${vp.width}`;

    // 1) ファーストビュー（ヒーロー + 建設ツールセクション上部）
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(OUT_DIR, `builder-top-fold-${tag}.png`),
    });
    console.log(`Saved: builder-top-fold-${tag}.png`);

    // 2) 建設ツールセクションのみ（クリップ）
    await page.locator(".builder-top-ct").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const ctBox = await page.locator(".builder-top-ct").boundingBox();
    if (ctBox) {
      const pad = 16;
      const clipY = Math.max(0, ctBox.y - pad);
      const clipH = Math.min(ctBox.height + pad * 2, vp.height * 3);
      await page.screenshot({
        path: path.join(OUT_DIR, `builder-top-ct-section-${tag}.png`),
        clip: {
          x: 0,
          y: clipY,
          width: vp.width,
          height: Math.max(1, clipH),
        },
      });
      console.log(`Saved: builder-top-ct-section-${tag}.png`);
    }

    // 3) ヒーロー下端〜主要機能まで（重なり確認用）
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const hero = await page.locator(".builder-top-hero").boundingBox();
    const major = await page.locator('.builder-top-section[aria-label="主要機能"]').boundingBox();
    if (hero && major) {
      const y = Math.max(0, hero.y + hero.height * 0.5);
      const endY = major.y + Math.min(major.height, 180);
      const h = Math.max(1, Math.min(endY - y + 24, 1400));
      await page.screenshot({
        path: path.join(OUT_DIR, `builder-top-hero-to-major-${tag}.png`),
        clip: {
          x: 0,
          y,
          width: vp.width,
          height: h,
        },
      });
      console.log(`Saved: builder-top-hero-to-major-${tag}.png`);
    }

    // 4) ページ全体（流れ確認）
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(OUT_DIR, `builder-top-full-${tag}.png`),
      fullPage: true,
    });
    console.log(`Saved: builder-top-full-${tag}.png`);

    await page.close();
  }
});

console.log(`\nDone. Output: ${OUT_DIR}`);
await closeAllBrowsers();
