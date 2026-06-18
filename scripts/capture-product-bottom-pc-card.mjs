import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);

const card = page.locator("#otherServices");
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

const box = await card.boundingBox();
const footer = page.locator(".skill-detail-wrap > footer");
const footerBox = await footer.boundingBox();

if (box && footerBox) {
  const y = Math.max(0, box.y - 8);
  const height = footerBox.y + footerBox.height - y + 8;
  await page.screenshot({
    path: "screenshots/product-detail/bottom-pc-1280.png",
    clip: { x: 0, y, width: 1280, height },
  });
}

});

await closeAllBrowsers();
