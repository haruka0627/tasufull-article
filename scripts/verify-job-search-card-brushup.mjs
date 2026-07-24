#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:8788/ai-workspace/?uiReview=search&mode=cross-matching";

await withPlaywrightBrowser(async (browser) => {
  for (const [tag, w, h] of [
    ["1280", 1280, 900],
    ["390", 390, 844],
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('[data-ai-compare-profile="job"]').first().scrollIntoViewIfNeeded();

    const data = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-ai-compare-profile="job"]')];
      return cards.map((card) => {
        const trust = [...card.querySelectorAll(".ai-search-result-card__trust-item")].map((item) => ({
          label: item.querySelector(".ai-search-result-card__trust-label span:last-child")?.textContent?.trim(),
          value: item.querySelector(".ai-search-result-card__trust-value")?.textContent?.trim(),
        }));
        const chips = [...card.querySelectorAll(".ai-search-result-card__match-chip")].map((c) => c.textContent.trim());
        const badges = [...card.querySelectorAll(".ai-search-result-card__badge")].map((b) => ({
          text: b.textContent.trim(),
          tone: [...b.classList].find((c) => c.startsWith("ai-search-result-card__badge--"))?.replace("ai-search-result-card__badge--", ""),
        }));
        const salaryBold = card.querySelector(".ai-search-result-card__fact-value--price")?.textContent?.trim();
        const ctas = [...card.querySelectorAll(".ai-search-result-card__actions .ai-cross-cta")].map((a) => a.textContent.trim());
        return { trust, chips, badges, salaryBold, ctas };
      });
    });

    console.log(`=== ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(data, null, 2));

    const first = data[0];
    const ok =
      data.length === 3 &&
      first.chips.includes("勤務地一致") &&
      first.chips.includes("給与一致") &&
      !first.chips.includes("予算一致") &&
      !first.chips.includes("エリア一致") &&
      !first.trust.some((t) => t.label === "応募数") &&
      !first.trust.some((t) => t.label === "掲載日") &&
      data.some((c) => c.trust.some((t) => t.label === "募集人数" && t.value === "3名")) &&
      data.some((c) => c.trust.some((t) => t.label === "勤務日数" && t.value === "週5日")) &&
      data.some((c) => c.trust.some((t) => t.label === "応募締切" && t.value === "2026/03/31")) &&
      first.salaryBold?.includes("月給") &&
      first.ctas.includes("詳細を見る") &&
      first.ctas.includes("応募する");
    if (!ok) process.exitCode = 1;

    await page.close();
  }
});

await closeAllBrowsers();
