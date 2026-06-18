import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";

const url = "http://127.0.0.1:5173/detail-product.html?id=product_set_2026";
const outDir = "screenshots/product-detail";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(7000);

async function snap(name, selector) {
  if (selector) {
    const el = await page.$(selector);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
    }
  }
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

const metrics = await page.evaluate(() => {
  const heroImg = document.querySelector(".tasu-mdetail-hero__img");
  const portfolioImg = document.querySelector(
    ".tasu-mdetail-section__body .skill-portfolio-card img"
  );
  const svg = document.querySelector(
    ".tasu-mdetail-section__body .seller-more-jobs-btn svg"
  );
  const stats = document.querySelector(
    ".tasu-mdetail-section__body .seller-main__stats"
  );
  const m = (el) =>
    el
      ? {
          w: Math.round(el.getBoundingClientRect().width),
          h: Math.round(el.getBoundingClientRect().height),
        }
      : null;
  return {
    heroImg: heroImg ? { src: heroImg.src.slice(-40), ...m(heroImg) } : null,
    portfolioImg: portfolioImg
      ? { alt: portfolioImg.alt.slice(0, 20), ...m(portfolioImg) }
      : null,
    svg: m(svg),
    stats: m(stats),
    otherSection: !!document.querySelector("[data-tasu-mdetail-other-products-section]"),
  };
});

console.log(JSON.stringify(metrics, null, 2));

await snap("01-hero-gallery", ".tasu-mdetail-hero__media");
await snap("02-gallery-fixed", ".tasu-mdetail-section__body .skill-portfolio-card img");
await snap("03-provider-stats", ".tasu-mdetail-section__body .seller-main__stats");
await snap("04-purchase-actions", ".tasu-mdetail-section__body .seller-actions");
await snap("05-other-products", "[data-tasu-mdetail-other-products-section]");
await snap("06-bottom-cta", "[data-tasu-mdetail-cta-dock]");

await browser.close();
