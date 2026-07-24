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
    await page.locator('[data-ai-compare-profile="market"]').first().scrollIntoViewIfNeeded();

    const data = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-ai-compare-profile="market"]')];
      const other = [...document.querySelectorAll('[data-ai-compare-profile]:not([data-ai-compare-profile="market"])')];
      return {
        market: cards.map((card) => {
          const trust = [...card.querySelectorAll(".ai-search-result-card__trust-item")].map((item) => ({
            label: item.querySelector(".ai-search-result-card__trust-label span:last-child")?.textContent?.trim(),
            value: item.querySelector(".ai-search-result-card__trust-value")?.textContent?.trim(),
          }));
          const imgBtn = card.querySelector(".ai-search-result-card__product-media-btn");
          const img = card.querySelector(".ai-search-result-card__product-thumb");
          const ctas = [...card.querySelectorAll(".ai-search-result-card__actions .ai-cross-cta")].map((a) =>
            a.textContent.trim()
          );
          return {
            hasImage: Boolean(img?.getAttribute("src")),
            imgIsButton: imgBtn?.tagName === "BUTTON",
            imgHref: imgBtn?.getAttribute("href") || null,
            trust,
            ctas,
          };
        }),
        productStillHasImage: Boolean(
          document.querySelector('[data-ai-compare-profile="product"] .ai-search-result-card__product-thumb')
        ),
        otherWithProductImage: other.filter((c) => {
          const profile = c.getAttribute("data-ai-compare-profile");
          return profile !== "product" && profile !== "market" && c.querySelector(".ai-search-result-card__product-media-btn");
        }).length,
        otherWithMarketFields: other.filter((c) =>
          [...c.querySelectorAll(".ai-search-result-card__trust-item")].some((item) => {
            const label = item.querySelector(".ai-search-result-card__trust-label span:last-child")?.textContent?.trim();
            return label === "発送元" || label === "状態" || label === "発送予定" || label === "値下げ交渉";
          })
        ).length,
      };
    });

    console.log(`=== ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(data, null, 2));

    const first = data.market[0];
    const ok =
      data.market.length === 3 &&
      data.otherWithProductImage === 0 &&
      data.productStillHasImage &&
      data.market.every((c) => c.hasImage && c.imgIsButton && !c.imgHref) &&
      data.otherWithMarketFields === 0 &&
      data.market.every((c) =>
        ["発送元", "状態", "発送予定", "値下げ交渉"].every((label) => c.trust.some((t) => t.label === label))
      ) &&
      data.market.some((c) => c.trust.some((t) => t.label === "発送元" && t.value === "大阪府")) &&
      data.market.some((c) => c.trust.some((t) => t.label === "状態" && t.value === "やや傷あり")) &&
      data.market.some((c) => c.trust.some((t) => t.label === "発送予定" && t.value === "1〜2日")) &&
      data.market.some((c) => c.trust.some((t) => t.label === "値下げ交渉" && t.value === "不可")) &&
      data.market[0].ctas.includes("詳細を見る") &&
      data.market[0].ctas.includes("購入する");
    if (!ok) process.exitCode = 1;

    if (tag === "390") {
      await page.locator('[data-ai-compare-profile="market"] .ai-search-result-card__product-media-btn').first().click();
      const modalOpen = await page.evaluate(() => {
        const m = document.getElementById("ai-product-image-modal");
        return m && !m.hidden && m.classList.contains("is-open");
      });
      if (!modalOpen) process.exitCode = 1;
      await page.keyboard.press("Escape");
    }

    await page.close();
  }
});

await closeAllBrowsers();
