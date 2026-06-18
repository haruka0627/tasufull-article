import { chromium } from "./lib/playwright-browser.mjs";

const browser = await chromium.launch({ headless: true });
for (const id of ["demo_product_001", "product_set_2026"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:5173/detail-product.html?id=${id}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(7000);
  const gap = await page.evaluate(() => {
    const card = document.querySelector(
      "[data-tasu-mdetail-other-products-section] .detail-product-other-services-card"
    );
    const footer = document.querySelector("[data-product-mobile-copyright]");
    const heading = document.querySelector(
      "[data-tasu-mdetail-other-products-section] .detail-bottom-card__title"
    );
    return {
      gap: card && footer
        ? Math.round(footer.getBoundingClientRect().top - card.getBoundingClientRect().bottom)
        : null,
      heading: heading?.textContent?.trim() || null,
    };
  });
  console.log(id, gap);
  await page.close();
}
await browser.close();
