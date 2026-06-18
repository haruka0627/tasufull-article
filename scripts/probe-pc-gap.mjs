import { chromium } from "./lib/playwright-browser.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);
const gap = await page.evaluate(() => {
  const card = document.querySelector("#otherServices .detail-product-other-services-card, #otherServices.detail-bottom-card");
  const footer = document.querySelector(".skill-detail-wrap > footer");
  const cardEl = card || document.getElementById("otherServices");
  return cardEl && footer
    ? Math.round(footer.getBoundingClientRect().top - cardEl.getBoundingClientRect().bottom)
    : null;
});
console.log("PC gap:", gap);
await browser.close();
