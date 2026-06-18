import { chromium } from "./lib/playwright-browser.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);

await page.evaluate(() => {
  const footer = document.querySelector("[data-product-mobile-copyright]");
  footer?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(500);
await page.screenshot({ path: "screenshots/product-detail/bottom-mobile-390.png" });

await browser.close();
