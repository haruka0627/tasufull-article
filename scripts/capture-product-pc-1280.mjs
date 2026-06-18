import { chromium } from "./lib/playwright-browser.mjs";

const url = "http://127.0.0.1:5173/detail-product.html?id=product_set_2026";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);

const metrics = await page.evaluate(() => {
  const wrap = document.querySelector(".skill-detail-wrap");
  const heroImg = document.querySelector("[data-listing-image]");
  const cta = document.querySelector(".product-cta-panel");
  return {
    mdetailActive: document.body.classList.contains("tasu-mdetail-page"),
    wrapVisible: wrap ? getComputedStyle(wrap).display !== "none" : false,
    heroImg: heroImg
      ? {
          w: Math.round(heroImg.getBoundingClientRect().width),
          h: Math.round(heroImg.getBoundingClientRect().height),
        }
      : null,
    cta: cta
      ? {
          w: Math.round(cta.getBoundingClientRect().width),
          position: getComputedStyle(cta.closest(".skill-hero-premium__cta") || cta).position,
        }
      : null,
  };
});

console.log(JSON.stringify(metrics, null, 2));
await page.screenshot({ path: "screenshots/product-detail/pc-1280-regression.png", fullPage: false });
await browser.close();
