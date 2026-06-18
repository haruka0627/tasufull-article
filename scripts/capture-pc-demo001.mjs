import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";

const outDir = "screenshots/product-detail";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=demo_product_001", {
  waitUntil: "networkidle",
  timeout: 60000,
});
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
    path: `${outDir}/final-bottom-pc-1280-demo001.png`,
    clip: { x: 0, y, width: 1280, height },
  });
}
await page.close();
await browser.close();
console.log("done");
