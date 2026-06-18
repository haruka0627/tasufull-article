import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);
await page.locator(".tasu-mdetail-section .skill-portfolio-premium").first().scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(400);

const d = await page.evaluate(() => {
  const sel = (s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      l: Math.round(r.left),
      r: Math.round(r.right),
      w: Math.round(r.width),
      pl: cs.paddingLeft,
      pr: cs.paddingRight,
      ml: cs.marginLeft,
      border: cs.borderWidth,
    };
  };
  return {
    overview: sel(".tasu-mdetail-section:nth-child(1)"),
    detail: sel(".tasu-mdetail-section:nth-child(2)"),
    portfolio: sel(".skill-portfolio-premium"),
    trackWrap: sel(".skill-portfolio-premium__track-wrap"),
    stat: sel(".skill-seller-stat"),
  };
});

console.log(JSON.stringify(d, null, 2));
});

await closeAllBrowsers();
