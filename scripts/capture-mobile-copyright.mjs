import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";

const outDir = "screenshots/product-detail";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);

await page.evaluate(() => {
  const card = document.querySelector(
    "[data-tasu-mdetail-other-products-section] .detail-product-other-services-card"
  );
  const footer = document.querySelector("[data-product-mobile-copyright]");
  if (card && footer) {
    const y = card.getBoundingClientRect().top - 24;
    window.scrollTo({ top: window.scrollY + y, behavior: "instant" });
  }
});
await page.waitForTimeout(450);

const gap = await page.evaluate(() => {
  const card = document.querySelector(
    "[data-tasu-mdetail-other-products-section] .detail-product-other-services-card"
  );
  const footer = document.querySelector("[data-product-mobile-copyright]");
  return card && footer
    ? Math.round(footer.getBoundingClientRect().top - card.getBoundingClientRect().bottom)
    : null;
});

await page.screenshot({ path: `${outDir}/final-bottom-mobile-390-copyright.png` });
console.log("mobile copyright gap:", gap);
await browser.close();
