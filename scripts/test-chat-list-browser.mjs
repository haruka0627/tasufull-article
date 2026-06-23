#!/usr/bin/env node
/**
 * chat-list → TALK リダイレクト E2E
 *   node scripts/test-chat-list-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5179").replace(/\/$/, "");
const PAGE = "/chat-list.html";

const results = [];
function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}
function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  console.log(`\nchat-list redirect E2E — ${BASE}${PAGE}\n`);
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    try {
      await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/talk-home\.html/, { timeout: 15000 });
      const finalUrl = page.url();
      if (/tab=chat/.test(finalUrl)) pass("chat-list → TALK redirect", finalUrl.replace(BASE, ""));
      else fail("chat-list → TALK redirect", finalUrl);

      await page.goto(`${BASE}${PAGE}?thread=chat-demo-redirect-001`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForURL(/thread=chat-demo-redirect-001/, { timeout: 15000 });
      pass("thread クエリ保持");

      const severe = errors.filter(
        (e) => !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]/i.test(e)
      );
      if (severe.length) fail("コンソールエラー", severe.join(" | "));
      else pass("コンソールエラーなし");
    } catch (err) {
      fail("例外", err instanceof Error ? err.message : String(err));
    }
  });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main();

await closeAllBrowsers();
