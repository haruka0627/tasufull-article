import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
await withPlaywrightBrowser(async (browser) => {const p = await browser.newPage();
await p.setViewportSize({ width: 1280, height: 900 });

await p.goto(buildLocalPageUrl(base, "detail-shop-store.html?id=demo-shop-haru-cafe"), {
  waitUntil: "domcontentloaded",
});
await p.waitForTimeout(2000);
const storeLinks = await p.evaluate(() =>
  [...document.querySelectorAll("a")]
    .filter((a) => /商品|shop-products/.test((a.textContent || "") + (a.getAttribute("href") || "")))
    .slice(0, 8)
    .map((a) => ({ text: (a.textContent || "").trim().slice(0, 30), href: a.getAttribute("href") }))
);
console.log("store product links", storeLinks);

await p.goto(buildLocalPageUrl(base, "shop-market-checkout.html?mode=cart"), { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
const submit = p.locator("[data-tasful-market-checkout-submit]").first();
if (await submit.count()) {
  await submit.click();
  await p.waitForTimeout(2500);
}
console.log(
  "after submit",
  p.url(),
  await p.evaluate(() => ({
    title: document.title,
    has: Boolean(document.querySelector(".tasful-market-complete, [data-tasful-market-complete]")),
  }))
);

await p.goto(buildLocalPageUrl(base, "detail-shop.html?id=demo-shop-haru-cafe"), { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
console.log(
  "detail-shop alias",
  await p.evaluate(() => ({
    title: document.querySelector("[data-biz-detail-title]")?.textContent?.trim(),
    path: location.pathname,
  }))
);

await p.goto(buildLocalPageUrl(base, "shop-market-seller.html?shopId=demo-shop-haru-cafe"), {
  waitUntil: "domcontentloaded",
});
await p.waitForTimeout(1500);
console.log(
  "seller page",
  await p.evaluate(() => ({
    title: document.title,
    linksToStore: [...document.querySelectorAll("a")].filter((a) => /detail-shop-store/.test(a.href)).length,
    linksToDetailShop: [...document.querySelectorAll("a")].filter((a) => /detail-shop\.html/.test(a.href)).length,
  }))
);

});

await closeAllBrowsers();
