#!/usr/bin/env node
/** Verify Q&A detail page template on 8788 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = "http://127.0.0.1:8788";
const SLUGS = ["signup", "pro-plan", "ai-free-plan", "tlv-gift-q11"];
const VIEWPORTS = [
  ["1280", 1280, 900],
  ["768", 768, 900],
  ["390", 390, 844],
];

await withPlaywrightBrowser(async (browser) => {
  let failed = false;

  for (const slug of SLUGS) {
    for (const [tag, w, h] of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: w, height: h });
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      const resp = await page.goto(`${BASE}/help/${slug}/`, {
        waitUntil: "networkidle",
        timeout: 120000,
      });

      const data = await page.evaluate(() => ({
        hasArticle: Boolean(document.querySelector("[data-platform-qa-article]")),
        answerAccent: Boolean(document.querySelector(".ai-site-qa-answer__box--accent")),
        relatedCards: document.querySelectorAll(".platform-qa-detail-related-card").length,
        navTitles: document.querySelectorAll(".platform-qa-detail-nav__title").length,
        navDirs: [...document.querySelectorAll(".platform-qa-detail-nav__dir")].map((el) =>
          el.textContent?.trim(),
        ),
        feedbackCounts: document.querySelectorAll("[data-platform-qa-feedback-count]").length,
        infobox: Boolean(document.querySelector(".platform-qa-infobox")),
        serviceCta: Boolean(document.querySelector(".platform-qa-service-cta__btn")),
        feedbackBtnMinHeight: (() => {
          const btn = document.querySelector(".ai-site-qa-answer__feedback-btn");
          if (!btn) return 0;
          return parseFloat(getComputedStyle(btn).minHeight) || btn.offsetHeight;
        })(),
      }));

      console.log(`=== /help/${slug}/ ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
      console.log(JSON.stringify(data, null, 2));
      if (consoleErrors.length) console.log("console errors:", consoleErrors);

      const ok =
        resp?.status?.() === 200 &&
        data.hasArticle &&
        data.answerAccent &&
        data.relatedCards >= 2 &&
        data.navTitles >= 1 &&
        data.feedbackCounts === 2 &&
        data.feedbackBtnMinHeight >= 44 &&
        consoleErrors.length === 0;

      if (!ok) {
        console.error(`FAIL /help/${slug}/ ${tag}px`);
        failed = true;
      } else {
        console.log(`PASS /help/${slug}/ ${tag}px`);
      }

      await page.close();
    }
  }

  await closeAllBrowsers();
  if (failed) process.exit(1);
  console.log("\nAll Q&A detail template checks PASS");
});
