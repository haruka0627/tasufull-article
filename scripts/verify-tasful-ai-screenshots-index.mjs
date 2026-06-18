#!/usr/bin/env node
/**
 * TASFUL AI Talk UI — screenshots/index.html 掲載確認
 *   node scripts/verify-tasful-ai-screenshots-index.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { resolveStaticServer } from "./lib/finalize-verification.mjs";
import { writeScreenshotsIndex } from "./lib/screenshots-index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = `http://localhost:${process.env.SCREENSHOT_INDEX_PORT || 5502}`;
const SHOTS = [
  "talk-home-tasful-ai-sheet-390.png",
  "talk-home-tasful-ai-sheet-pc.png",
  "chat-detail-tasful-ai-sheet-390.png",
  "chat-detail-header-390-normal.png",
  "chat-detail-header-390-ai-sheet.png",
  "chat-detail-header-pc.png",
];

async function main() {
  await writeScreenshotsIndex(root);
  const { close } = await resolveStaticServer(root);
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  
    await page.goto(`${BASE}/screenshots/index.html#recent-reviews`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-review-folder="tasful-ai-talk"]', { timeout: 10000 });

    results.push({
      check: "recent card visible",
      ok: (await page.locator('[data-review-folder="tasful-ai-talk"]').count()) === 1,
    });

    const html = await page.content();
    results.push({
      check: "index references tasful-ai-talk thumb (card UI)",
      ok: html.includes("tasful-ai-talk/talk-home-tasful-ai-sheet-390.png"),
    });

    await page.locator('[data-review-folder="tasful-ai-talk"] .recent-card__thumb').click();
    await page.waitForSelector("#img-viewer.is-open", { timeout: 5000 });
    const src = (await page.locator("#img-viewer-img").getAttribute("src")) || "";
    results.push({
      check: "root index lightbox opens",
      ok: /tasful-ai-talk\/talk-home-tasful-ai-sheet-390/.test(src),
    });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    await Promise.all([
      page.waitForURL(/tasful-ai-talk\/index\.html/, { timeout: 15000 }),
      page.locator('[data-review-folder="tasful-ai-talk"] .recent-card__cta').click(),
    ]);
    results.push({
      check: "folder detail index opens",
      ok: page.url().includes("reports/screenshots/tasful-ai-talk/index.html"),
    });

    const shotCount = await page.locator(".shot-card__btn[data-lightbox-src]").count();
    results.push({ check: "detail shows 6 screenshots", ok: shotCount === SHOTS.length });

    const detailHtml = await page.content();
    for (const file of SHOTS) {
      results.push({
        check: `detail references ${file}`,
        ok: detailHtml.includes(file),
      });
    }

    results.push({
      check: "detail shows card UI label",
      ok: detailHtml.includes("カードUI"),
    });
    results.push({
      check: "detail shows chat-detail header shots",
      ok: detailHtml.includes("chat-detail-header-390-normal.png"),
    });

    const backHref = await page.locator(".screenshot-back-nav__link").getAttribute("href");
    results.push({
      check: "back link to screenshots index",
      ok: backHref === "../../screenshots/index.html#recent-reviews",
    });

    await page.locator(".shot-card__btn[data-lightbox-src]").first().click();
    await page.waitForSelector("#img-viewer.is-open", { timeout: 5000 });
    results.push({
      check: "detail lightbox works",
      ok: await page.locator("#img-viewer.is-open").isVisible(),
    });

    const allOk = results.every((r) => r.ok);
    console.log(JSON.stringify({ allOk, shotCount, results }, null, 2));
    if (!allOk) process.exitCode = 1;
    });
  close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
