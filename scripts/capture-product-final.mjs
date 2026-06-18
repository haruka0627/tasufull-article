import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";

const outDir = "screenshots/product-detail";
fs.mkdirSync(outDir, { recursive: true });

await withPlaywrightBrowser(async (browser) => {async function snapMobile(url, name, selector) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(7000);
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await page.close();
}

async function snapPcBottom(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(7000);
  const card = page.locator("#otherServices");
  const footer = page.locator(".skill-detail-wrap > footer");
  await card.scrollIntoViewIfNeeded();
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await card.boundingBox();
  const footerBox = await footer.boundingBox();
  if (box && footerBox) {
    const y = Math.max(0, box.y - 8);
    const height = footerBox.y + footerBox.height - y + 8;
    await page.screenshot({
      path: `${outDir}/final-bottom-pc-1280.png`,
      clip: { x: 0, y, width: 1280, height },
    });
  }
  await page.close();
}

const url = "http://127.0.0.1:5173/detail-product.html?id=product_set_2026";

await snapPcBottom(url);
await snapMobile(url, "final-gallery-390", ".tasu-mdetail-section .skill-portfolio-premium__head");
await snapMobile(url, "final-stats-390", ".tasu-mdetail-section .seller-main__stats");
await snapMobile(
  url,
  "final-bottom-mobile-390",
  "[data-tasu-mdetail-other-products-section]"
);

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    document.querySelector("[data-product-mobile-copyright]")?.scrollIntoView({
      block: "center",
    });
  });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outDir}/final-bottom-mobile-390-copyright.png` });
  await page.close();
}

});
console.log("done");

await closeAllBrowsers();
