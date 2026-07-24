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
    await page.locator('[data-ai-compare-profile="shop"]').first().scrollIntoViewIfNeeded();

    const data = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-ai-compare-profile="shop"]')];
      const other = [...document.querySelectorAll('[data-ai-compare-profile]:not([data-ai-compare-profile="shop"])')];
      return {
        shop: cards.map((card) => {
          const trust = [...card.querySelectorAll(".ai-search-result-card__trust-item")].map((item) => ({
            label: item.querySelector(".ai-search-result-card__trust-label span:last-child")?.textContent?.trim(),
            value: item.querySelector(".ai-search-result-card__trust-value")?.textContent?.trim(),
            tone: [...(item.querySelector(".ai-search-result-card__trust-value")?.classList || [])].find((c) =>
              c.includes("business-")
            ),
          }));
          const imgBtn = card.querySelector(".ai-search-result-card__shop-media-btn");
          const img = card.querySelector(".ai-search-result-card__shop-thumb");
          const ctas = [...card.querySelectorAll(".ai-search-result-card__actions .ai-cross-cta")].map((a) =>
            a.textContent.trim()
          );
          return {
            hasShopImage: Boolean(img?.getAttribute("src")),
            imgIsButton: imgBtn?.tagName === "BUTTON",
            imgHref: imgBtn?.getAttribute("href") || null,
            trust,
            ctas,
          };
        }),
        otherWithShopImage: other.filter((c) => c.querySelector(".ai-search-result-card__shop-media-btn")).length,
        productStillHasImage: Boolean(
          document.querySelector('[data-ai-compare-profile="product"] .ai-search-result-card__product-thumb')
        ),
      };
    });

    console.log(`=== ${tag}px HTTP ${resp?.status?.() ?? 0} ===`);
    console.log(JSON.stringify(data, null, 2));

    const first = data.shop[0];
    const hoursIdx = first.trust.findIndex((t) => t.label === "営業時間");
    const statusIdx = first.trust.findIndex((t) => t.label === "営業状況");
    const distIdx = first.trust.findIndex((t) => t.label === "距離");
    const addrIdx = first.trust.findIndex((t) => t.label === "所在地");
    const ok =
      data.shop.length === 3 &&
      data.otherWithShopImage === 0 &&
      data.productStillHasImage &&
      first.hasShopImage &&
      first.imgIsButton &&
      !first.imgHref &&
      first.ctas.includes("詳細を見る") &&
      first.ctas.includes("問い合わせ") &&
      statusIdx === hoursIdx + 1 &&
      distIdx === statusIdx + 1 &&
      distIdx === addrIdx - 1 &&
      data.shop.some((c) => c.trust.some((t) => t.label === "距離" && t.value === "850m")) &&
      data.shop.some((c) => c.trust.some((t) => t.label === "距離" && t.value === "2.4km")) &&
      data.shop.some((c) => c.trust.some((t) => t.label === "距離" && t.value === "徒歩約5分")) &&
      data.shop.every((c) => !c.trust.some((t) => t.label === "距離") || c.trust.some((t) => t.label === "距離" && t.value)) &&
      data.shop.some((c) => c.trust.some((t) => t.label === "営業状況" && t.value === "営業中")) &&
      data.shop.some((c) => c.trust.some((t) => t.label === "営業状況" && t.value === "営業終了"));
    if (!ok) process.exitCode = 1;

    if (tag === "390") {
      await page.locator('[data-ai-compare-profile="shop"] .ai-search-result-card__shop-media-btn').first().click();
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
