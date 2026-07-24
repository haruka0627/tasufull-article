#!/usr/bin/env node
/**
 * Platform Request P4 — respond modal + 550 yen stub (8788)
 *   node scripts/test-platform-request-p4.mjs
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
  console.log(`[test-platform-request-p4] base=${BASE}`);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));

    // P2: create + redirect
    await page.goto(`${BASE}/platform-request-create`, { waitUntil: "domcontentloaded" });
    const unique = `P4回帰 ${Date.now()}`;
    await page.fill("#prq-title", unique);
    await page.fill("#prq-body", "外壁塗装の見積もり依頼です。");
    await page.selectOption("#prq-category", "リフォーム・塗装");
    await page.fill("#prq-area", "埼玉県 さいたま市");
    await page.click('button[type="submit"]');
    await page.waitForURL(/platform-request-detail\?id=prq-/);
    const localId = new URL(page.url()).searchParams.get("id");
    console.log("PASS P2 create redirect");

    // P3: candidates visible
    await page.waitForSelector("[data-prq-candidate-card]");
    const candCount = await page.locator("[data-prq-candidate-card]").count();
    assert(candCount >= 1, `expected candidates, got ${candCount}`);
    console.log(`PASS P3 candidates (${candCount})`);

    // 550 yen fee card
    await page.waitForSelector("[data-prq-fee-card]:not([hidden])");
    const feeText = await page.locator("[data-prq-fee-card]").textContent();
    assert(feeText.includes("550"), "fee card should mention 550");
    assert(feeText.includes("仮導線"), "fee card should mention stub");
    console.log("PASS 550 yen fee card");

    // Status controls for local post
    await page.waitForSelector("[data-prq-status-controls]:not([hidden])");
    await page.locator('[data-prq-status-set="closed"]').click();
    await page.waitForSelector(".prq-toast.is-visible");
    const statusText = await page.locator("[data-prq-detail-status]").textContent();
    assert(statusText.includes("終了"), `status should be 終了, got ${statusText}`);
    await page.locator('[data-prq-status-set="open"]').click();
    await page.waitForTimeout(300);
    const statusOpen = await page.locator("[data-prq-detail-status]").textContent();
    assert(statusOpen.includes("受付中"), "status should revert to 受付中");
    console.log("PASS local status update");

    // Respond modal on demo-1
    await page.goto(`${BASE}/platform-request-detail?id=demo-1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-prq-respond-candidate]");
    const urlBefore = page.url();
    await page.locator("[data-prq-respond-candidate]").first().click();
    await page.waitForSelector("[data-prq-respond-modal]:not([hidden])");
    const modalText = await page.locator("[data-prq-respond-modal]").textContent();
    assert(modalText.includes("550"), "modal should show 550 fee");
    assert(modalText.includes("P5"), "modal should mention P5");
    assert(modalText.includes("仮導線"), "modal should show stub note");
    assert(page.url() === urlBefore, "should not navigate on modal open");
    console.log("PASS respond modal opens without Talk navigation");

    // Cancel closes modal
    await page.locator("[data-prq-modal-cancel]").click();
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-prq-respond-modal]");
      return el && el.hidden;
    });
    console.log("PASS modal cancel");

    // 仮で進む → toast, no Talk
    await page.locator("[data-prq-respond-candidate]").first().click();
    await page.waitForSelector("[data-prq-respond-modal]:not([hidden])");
    await page.locator("[data-prq-modal-proceed]").click();
    await page.waitForSelector(".prq-toast.is-visible");
    const proceedToast = await page.locator("[data-prq-toast]").textContent();
    assert(proceedToast.includes("P5") && proceedToast.includes("550"), `proceed toast: ${proceedToast}`);
    assert(!page.url().includes("talk-home"), "must not navigate to Talk");
    console.log("PASS 仮で進む toast without Talk");

    // Responsive modal + cards + fee
    for (const vw of [1280, 768, 390]) {
      await page.setViewportSize({ width: vw, height: 900 });
      await page.goto(`${BASE}/platform-request-detail?id=demo-1`, { waitUntil: "domcontentloaded" });
      const feeBox = await page.locator("[data-prq-fee-card]").boundingBox();
      const cardBox = await page.locator("[data-prq-candidate-card]").first().boundingBox();
      assert(feeBox && feeBox.width > 0, `fee card missing at ${vw}px`);
      assert(cardBox && cardBox.width > 0, `candidate card missing at ${vw}px`);
      await page.locator("[data-prq-respond-candidate]").first().click();
      const modalBox = await page.locator(".prq-modal__panel").boundingBox();
      assert(modalBox && modalBox.width > 0, `modal missing at ${vw}px`);
      await page.locator("[data-prq-modal-cancel]").click();
      console.log(`PASS responsive ${vw}px`);
    }

    const prqErrors = filterConsoleErrors(consoleErrors);
    assert(prqErrors.length === 0, `console errors: ${prqErrors.join(" | ")}`);
    console.log("PASS console errors 0");

    console.log("[test-platform-request-p4] ALL PASS");
  });
}

main().catch((err) => {
  console.error("[test-platform-request-p4] FAIL", err.message || err);
  process.exit(1);
});
