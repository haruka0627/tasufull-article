#!/usr/bin/env node
/** Verify Q&A curation admin UI on 8788 (?qa_dev=1) */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788";

await withPlaywrightBrowser(async (browser) => {
  let failed = false;

  for (const [tag, w, h] of [
    ["1280", 1280, 900],
    ["390", 390, 844],
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    const resp = await page.goto(`${BASE}/help/curation/?qa_dev=1`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });

    const data = await page.evaluate(() => {
      const counts = window.PlatformQaCuration?.getTabCounts?.() || {};
      return {
        enabled: window.PlatformQaCuration?.isEnabled?.() === true,
        tabs: document.querySelectorAll("[data-qa-curation-tab]").length,
        rows: document.querySelectorAll(".platform-qa-curation-row").length,
        bulkDelete: Boolean(document.querySelector("[data-qa-curation-bulk-delete]")),
        bulkArchive: Boolean(document.querySelector("[data-qa-curation-bulk-archive]")),
        bulkKeywordsDisabled: document.querySelector("[data-qa-curation-bulk-keywords]")?.disabled === true,
        statusSelects: document.querySelectorAll("[data-qa-curation-status]").length,
        duplicateCount: counts.duplicates || 0,
        lowQualityCount: counts["low-quality"] || 0,
        allCount: counts.all || 0,
      };
    });

    console.log(`=== /help/curation/?qa_dev=1 ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(data, null, 2));
    if (consoleErrors.length) console.log("console errors:", consoleErrors);

    const ok =
      resp?.status?.() === 200 &&
      data.enabled &&
      data.tabs === 8 &&
      data.rows > 0 &&
      data.bulkDelete &&
      data.bulkArchive &&
      data.bulkKeywordsDisabled &&
      data.statusSelects > 0 &&
      data.duplicateCount > 100 &&
      data.lowQualityCount > 100 &&
      data.allCount >= 4390 &&
      consoleErrors.length === 0;

    if (!ok) {
      console.error(`FAIL curation ${tag}px`);
      failed = true;
    } else {
      console.log(`PASS curation ${tag}px`);
    }

    await page.click('[data-qa-curation-tab="low-quality"]');
    await page.waitForTimeout(200);
    const tabSwitch = await page.evaluate(() => ({
      active: document.querySelector(".platform-qa-curation-tab.is-active")?.textContent?.includes("低品質"),
      rows: document.querySelectorAll(".platform-qa-curation-row").length,
    }));
    if (!tabSwitch.active || tabSwitch.rows < 1) {
      console.error(`FAIL tab switch ${tag}px`, tabSwitch);
      failed = true;
    }

    await page.close();
  }

  const denyPage = await browser.newPage();
  await denyPage.goto(`${BASE}/help/curation/`, { waitUntil: "networkidle", timeout: 120000 });
  const denied = await denyPage.evaluate(
    () => document.querySelector(".platform-qa-curation-denied") !== null,
  );
  if (!denied) {
    console.error("FAIL curation without qa_dev should be denied");
    failed = true;
  } else {
    console.log("PASS curation denied without qa_dev");
  }
  await denyPage.close();

  await closeAllBrowsers();
  if (failed) process.exit(1);
  console.log("\nAll curation admin checks PASS");
});
