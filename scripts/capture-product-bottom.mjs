import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";

const outDir = "screenshots/product-detail";
fs.mkdirSync(outDir, { recursive: true });

await withPlaywrightBrowser(async (browser) => {async function captureBottom(url, name, width) {
  const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 900 : 844 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(7000);

  const isMobile = width === 390;
  const cardSel = isMobile
    ? "[data-tasu-mdetail-other-products-section]"
    : "#otherServices";
  const footerSel = isMobile
    ? "[data-product-mobile-copyright]"
    : ".skill-detail-wrap > footer";

  await page.waitForSelector(cardSel, { timeout: 15000 }).catch(() => {});

  await page.evaluate(({ cardSel, footerSel }) => {
    document.querySelector(cardSel)?.scrollIntoView({ block: "start" });
    document.querySelector(footerSel)?.scrollIntoView({ block: "end" });
  }, { cardSel, footerSel });
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(({ isMobile }) => {
    const head = document.querySelector(
      isMobile
        ? "[data-tasu-mdetail-other-products-section] .detail-bottom-card__title"
        : "#detailRelatedTitle"
    );
    const card = document.querySelector(
      isMobile ? "[data-tasu-mdetail-other-products-section]" : "#otherServices"
    );
    const footer = document.querySelector(
      isMobile ? "[data-product-mobile-copyright]" : ".skill-detail-wrap > footer"
    );
    const cardRect = card?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    return {
      headText: head?.textContent?.trim(),
      headVisible: head ? head.getBoundingClientRect().height > 0 : false,
      gap:
        cardRect && footerRect
          ? Math.round(footerRect.top - cardRect.bottom)
          : null,
      footerMarginTop: footer ? getComputedStyle(footer).marginTop : null,
    };
  }, { isMobile });

  console.log(`${name}:`, JSON.stringify(metrics));
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await page.close();
}

await captureBottom(
  "http://127.0.0.1:5173/detail-product.html?id=product_set_2026",
  "bottom-pc-1280",
  1280
);
await captureBottom(
  "http://127.0.0.1:5173/detail-product.html?id=product_set_2026",
  "bottom-mobile-390",
  390
);

});

await closeAllBrowsers();
