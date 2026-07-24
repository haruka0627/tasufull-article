#!/usr/bin/env node
/** QA-D-05 — Workspace Q&A hit renders PlatformQaArticle.buildResultHtml */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788";

async function sendAndWaitQa(page, query) {
  await page.fill("[data-ai-chat-input]", query);
  await page.click("[data-ai-chat-send]");
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll(".ai-msg-row .ai-message");
      const last = rows[rows.length - 1];
      return (
        last &&
        (last.querySelector("[data-platform-qa-article]") ||
          last.querySelector(".ai-cross-card") ||
          last.querySelector(".ai-site-qa-layout"))
      );
    },
    { timeout: 30000 },
  );
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll(".ai-msg-row .ai-message")];
    const last = rows[rows.length - 1];
    return {
      hasPlatformQa: Boolean(last?.querySelector("[data-platform-qa-article]")),
      slug: last?.querySelector("[data-platform-qa-slug]")?.getAttribute("data-platform-qa-slug") || "",
      title: last?.querySelector(".ai-site-qa-result__title")?.textContent?.trim() || "",
      hasCrossCard: Boolean(last?.querySelector(".ai-cross-card")),
      hasStack: Boolean(last?.querySelector(".ai-workspace-qa-search-stack")),
    };
  });
}

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

    const uiResp = await page.goto(`${BASE}/ai-workspace/?uiReview=search&mode=cross-matching`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    const uiData = await page.evaluate(() => ({
      qaCount: document.querySelectorAll(".ai-site-qa-layout__results .ai-site-qa-result").length,
      cardCount: document.querySelectorAll(".ai-search-ui-review-showcase__section").length,
    }));
    console.log(`=== uiReview ${tag}px HTTP ${uiResp?.status?.() ?? 0} ===`, uiData);
    if (
      uiResp?.status?.() !== 200 ||
      uiData.qaCount !== 12 ||
      uiData.cardCount !== 7 ||
      consoleErrors.length
    ) {
      console.error(`FAIL uiReview regression ${tag}px`, consoleErrors);
      failed = true;
    } else {
      console.log(`PASS uiReview regression ${tag}px`);
    }

    await page.goto(`${BASE}/ai-workspace/?mode=cross-matching`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });

    const cases = [
      { query: "退会", slugPart: "account-delete", label: "退会" },
      { query: "TASFUL AI 料金", slugPart: "ai", label: "TASFUL AI 料金" },
      { query: "TLV 投げ銭", slugPart: "tlv", label: "TLV 投げ銭" },
    ];

    for (const c of cases) {
      const hit = await sendAndWaitQa(page, c.query);
      console.log(`=== QA-D-05 ${c.label} ${tag}px ===`, hit);
      const slugOk = hit.slug.includes(c.slugPart) || hit.title.toLowerCase().includes(c.slugPart);
      if (!hit.hasPlatformQa || !slugOk) {
        console.error(`FAIL QA hit ${c.label} ${tag}px`);
        failed = true;
      } else {
        console.log(`PASS QA hit ${c.label} ${tag}px slug=${hit.slug}`);
      }
    }

    if (consoleErrors.length) {
      console.error(`FAIL console errors ${tag}px`, consoleErrors);
      failed = true;
    } else {
      console.log(`PASS console errors ${tag}px`);
    }

    await page.close();
  }

  await closeAllBrowsers();
  if (failed) process.exit(1);
  console.log("\nAll QA-D-05 checks PASS");
});
