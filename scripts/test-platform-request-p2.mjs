#!/usr/bin/env node
/**
 * Platform Request P2 — localStorage flow smoke (8788)
 *   node scripts/test-platform-request-p2.mjs
 */
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const BASE = (process.env.PAGES_BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`[test-platform-request-p2] base=${BASE}`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    await page.goto(`${BASE}/platform-request-create`, { waitUntil: "domcontentloaded" });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(200);
    const errorCount = await page.locator(".prq-field.is-invalid").count();
    assert(errorCount >= 4, `expected >=4 validation errors, got ${errorCount}`);
    console.log("PASS validation errors shown");

    const unique = `P2テスト ${Date.now()}`;
    await page.fill("#prq-title", unique);
    await page.fill("#prq-body", "localStorage 保存テスト本文です。");
    await page.selectOption("#prq-category", "IT・Web");
    await page.fill("#prq-area", "東京都 渋谷区");
    await page.fill("#prq-budget", "3万円以内");
    await page.click('button[type="submit"]');
    await page.waitForURL(/platform-request-detail\?id=prq-/);
    const detailUrl = page.url();
    const id = new URL(detailUrl).searchParams.get("id");
    assert(id && id.startsWith("prq-"), `expected prq id, got ${id}`);
    console.log(`PASS redirect to detail id=${id}`);

    await page.waitForSelector("[data-prq-detail-title]");
    const title = await page.locator("[data-prq-detail-title]").textContent();
    assert(title.includes("P2テスト"), `detail title mismatch: ${title}`);
    const status = await page.locator("[data-prq-detail-status]").textContent();
    assert(status.includes("受付中"), `status mismatch: ${status}`);
    console.log("PASS detail content");

    await page.goto(`${BASE}/platform-request`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`a.prq-card[href*="id=${encodeURIComponent(id)}"]`, { timeout: 5000 });
    console.log("PASS list shows saved request");

    await page.goto(`${BASE}/platform-request-detail?id=missing-id-xyz`, { waitUntil: "domcontentloaded" });
    const notFoundHidden = await page.locator("[data-prq-not-found]").isVisible();
    assert(notFoundHidden, "not-found UI should be visible");
    console.log("PASS not-found UI");

    const prqErrors = consoleErrors.filter(
      (t) => !/favicon|Failed to load resource|net::ERR/i.test(t)
    );
    assert(prqErrors.length === 0, `console errors: ${prqErrors.join(" | ")}`);
    console.log("PASS console errors 0");

    for (const vw of [1280, 768, 390]) {
      await page.setViewportSize({ width: vw, height: 900 });
      await page.goto(`${BASE}/platform-request`, { waitUntil: "domcontentloaded" });
      const box = await page.locator(".prq-hero").boundingBox();
      assert(box && box.width > 0, `hero missing at ${vw}px`);
      console.log(`PASS responsive ${vw}px`);
    }

    console.log("[test-platform-request-p2] ALL PASS");
  });
}

main().catch((err) => {
  console.error("[test-platform-request-p2] FAIL", err.message || err);
  process.exit(1);
});
