#!/usr/bin/env node
/**
 * スマホ共通下部タブ・戻る（390px）
 *   node scripts/test-tasu-app-mobile-shell.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const PAGES = ["detail-job.html", "post.html", "my-listings.html", "checkout.html"];

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  
    for (const p of PAGES) {
      await page.goto(`${BASE}/${p}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(() => typeof window.TasufulAppMobile?.isMobileViewport === "function");
      await page.waitForTimeout(250);

      const state = await page.evaluate(() => {
        const tab = document.querySelector("[data-tasu-app-tabbar]");
        const tabStyle = tab ? getComputedStyle(tab).display : "none";
        const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom);
        const back = document.querySelector("[data-tasu-mobile-back]");
        const backStyle = back ? getComputedStyle(back).display : "none";
        return {
          tabVisible: tabStyle === "flex",
          bodyPad,
          backVisible: backStyle !== "none" && Boolean(back),
          mobileClass: document.body.classList.contains("tasu-app-mobile-page"),
        };
      });

      if (!state.mobileClass) fail(`${p}: tasu-app-mobile-page class`);
      else pass(`${p}: mobile page class`);

      if (!state.tabVisible) fail(`${p}: bottom tab bar visible`);
      else pass(`${p}: bottom tab bar visible`);

      if (state.bodyPad < 50) fail(`${p}: body padding-bottom (${state.bodyPad})`);
      else pass(`${p}: body padding-bottom`);

      if (!state.backVisible) fail(`${p}: mobile back button`);
      else pass(`${p}: mobile back button`);
    }

    await page.goto(`${BASE}/detail-job.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    await page.locator("[data-tasu-mobile-back]").first().click({ force: true });
    await page.waitForTimeout(300);
    const afterBack = page.url();
    if (!afterBack.includes("detail-job") && !afterBack.includes("dashboard")) {
      fail("back navigation");
    } else pass("back button click");

    console.log("\n---");
    if (errors.length) {
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All mobile shell checks passed.");
    }
    });
  
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

await closeAllBrowsers();
