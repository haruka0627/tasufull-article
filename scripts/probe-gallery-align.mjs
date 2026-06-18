import { chromium } from "./lib/playwright-browser.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);

await page.evaluate(() => {
  const section = document.querySelectorAll(".tasu-mdetail-section")[1];
  section?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const detailSection = document.querySelectorAll(".tasu-mdetail-section")[1];
  const body = detailSection?.querySelector(".tasu-mdetail-section__body");
  const paidCard = body?.querySelector(".paid-options-card, .product-paid-options, [class*='paid-options']");
  const galleryCard = body?.querySelector(".skill-portfolio-card");
  const galleryHead = body?.querySelector("h2, .skill-portfolio-premium__head");
  const sectionRect = detailSection?.getBoundingClientRect();
  const bodyRect = body?.getBoundingClientRect();
  const paidRect = paidCard?.getBoundingClientRect();
  const cardRect = galleryCard?.getBoundingClientRect();
  const headRect = galleryHead?.getBoundingClientRect();
  return {
    section: sectionRect ? { l: Math.round(sectionRect.left), r: Math.round(sectionRect.right) } : null,
    body: bodyRect ? { l: Math.round(bodyRect.left), r: Math.round(bodyRect.right) } : null,
    paid: paidRect ? { l: Math.round(paidRect.left), r: Math.round(paidRect.right), tag: paidCard?.tagName, cls: paidCard?.className?.slice(0, 60) } : null,
    galleryCard: cardRect ? { l: Math.round(cardRect.left), r: Math.round(cardRect.right) } : null,
    galleryHead: headRect ? { l: Math.round(headRect.left), r: Math.round(headRect.right) } : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
