#!/usr/bin/env node
/**
 * Platform Request P3 — candidate matching smoke (8788)
 *   node scripts/test-platform-request-p3.mjs
 */
import { withPlaywrightBrowser } from "./lib/playwright-browser.mjs";

const BASE = (process.env.PAGES_BASE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function filterConsoleErrors(errors) {
  return errors.filter((t) => !/favicon|Failed to load resource|net::ERR/i.test(t));
}

async function main() {
  console.log(`[test-platform-request-p3] base=${BASE}`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    // P2 regression: create + redirect
    await page.goto(`${BASE}/platform-request-create`, { waitUntil: "domcontentloaded" });
    const unique = `P3回帰 ${Date.now()}`;
    await page.fill("#prq-title", unique);
    await page.fill("#prq-body", "Web制作の相談です。LP制作をお願いしたい。");
    await page.selectOption("#prq-category", "IT・Web");
    await page.fill("#prq-area", "東京都 渋谷区");
    await page.click('button[type="submit"]');
    await page.waitForURL(/platform-request-detail\?id=prq-/);
    const createdId = new URL(page.url()).searchParams.get("id");
    assert(createdId && createdId.startsWith("prq-"), "P2 create redirect broken");
    console.log("PASS P2 create redirect preserved");

    // Category/area match shows candidates
    await page.waitForSelector("[data-prq-candidates-section]:not([hidden])");
    const itCount = await page.locator("[data-prq-candidate-card]").count();
    assert(itCount >= 1, `expected IT/Web candidates, got ${itCount}`);
    const hasCategoryReason = await page.locator(".prq-tag--reason", { hasText: "カテゴリ一致" }).count();
    assert(hasCategoryReason >= 1, "expected カテゴリ一致 reason");
    console.log(`PASS category/area candidates (${itCount} cards)`);

    // Urgency: demo-4 至急 — available 千葉 should rank above busy 全国
    await page.goto(`${BASE}/platform-request-detail?id=demo-4`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-prq-candidate-card]");
    const firstId = await page.locator("[data-prq-candidate-card]").first().getAttribute("data-prq-candidate-id");
    const firstAvail = await page.locator("[data-prq-candidate-card]").first().getAttribute("data-prq-candidate-availability");
    assert(firstId === "cand-7", `expected cand-7 first for 至急 千葉 設備, got ${firstId}`);
    assert(firstAvail === "available", `expected available first, got ${firstAvail}`);
    const urgentReason = await page.locator(".prq-tag--reason", { hasText: "急ぎ対応可" }).count();
    assert(urgentReason >= 1, "expected 急ぎ対応可 reason");
    console.log("PASS urgency prefers available candidate");

    // Empty state: その他 + 北海道 (no area/category overlap with 沖縄のみ候補)
    await page.goto(`${BASE}/platform-request-create`, { waitUntil: "domcontentloaded" });
    await page.fill("#prq-title", `P3空状態 ${Date.now()}`);
    await page.fill("#prq-body", "北海道限定のニッチ依頼。候補ゼロ想定。");
    await page.selectOption("#prq-category", "その他");
    await page.fill("#prq-area", "北海道 札幌市");
    await page.click('button[type="submit"]');
    await page.waitForURL(/platform-request-detail\?id=prq-/);
    await page.waitForSelector("[data-prq-candidates-empty]:not([hidden])");
    const emptyText = await page.locator("[data-prq-candidates-empty]").textContent();
    assert(emptyText.includes("まだ条件に合う候補が見つかっていません"), "empty state text mismatch");
    console.log("PASS empty candidates state");

    // Unconnected buttons → toast
    await page.goto(`${BASE}/platform-request-detail?id=demo-1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-prq-notify-candidate]");
    await page.locator("[data-prq-notify-candidate]").first().click();
    await page.waitForSelector(".prq-toast.is-visible");
    const toast1 = await page.locator("[data-prq-toast]").textContent();
    assert(toast1.includes("P5"), `notify toast unexpected: ${toast1}`);
    await page.locator("[data-prq-talk-candidate]").first().click();
    await page.waitForTimeout(400);
    const toast2 = await page.locator("[data-prq-toast]").textContent();
    assert(toast2.includes("P5"), `talk toast unexpected: ${toast2}`);
    console.log("PASS unconnected action toasts");

    // Responsive candidate cards on detail
    for (const vw of [1280, 768, 390]) {
      await page.setViewportSize({ width: vw, height: 900 });
      await page.goto(`${BASE}/platform-request-detail?id=demo-1`, { waitUntil: "domcontentloaded" });
      const box = await page.locator("[data-prq-candidate-card]").first().boundingBox();
      assert(box && box.width > 0, `candidate card missing at ${vw}px`);
      console.log(`PASS responsive candidates ${vw}px`);
    }

    const prqErrors = filterConsoleErrors(consoleErrors);
    assert(prqErrors.length === 0, `console errors: ${prqErrors.join(" | ")}`);
    console.log("PASS console errors 0");

    console.log("[test-platform-request-p3] ALL PASS");
  });
}

main().catch((err) => {
  console.error("[test-platform-request-p3] FAIL", err.message || err);
  process.exit(1);
});
