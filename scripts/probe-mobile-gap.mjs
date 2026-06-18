import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);
const gap = await page.evaluate(() => {
  const card = document.querySelector(
    "[data-tasu-mdetail-other-products-section] .detail-product-other-services-card"
  );
  const footer = document.querySelector("[data-product-mobile-copyright]");
  return card && footer
    ? Math.round(footer.getBoundingClientRect().top - card.getBoundingClientRect().bottom)
    : null;
});
console.log("mobile gap:", gap);
});

await closeAllBrowsers();
