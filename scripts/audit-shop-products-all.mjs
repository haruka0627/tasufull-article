import { chromium } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";

const base = await findDevServerBaseUrl({ probePath: "shop-vendors.html" });
const ids = JSON.parse(
  fs.readFileSync("screenshots/shop-vendor-flow-audit/report.json", "utf8")
).steps.vendorList.cards.map((c) => c.id);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const productsFails = [];
const productLinkStats = { ok: 0, ng: 0, ngIds: [] };

for (const id of ids) {
  await page.goto(buildLocalPageUrl(base, `shop-products.html?id=${encodeURIComponent(id)}`), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({
    error: document.querySelector(".shop-products-error")?.textContent?.trim() || "",
    cards: document.querySelectorAll(".shop-products-card__link").length,
    hrefs: [...document.querySelectorAll(".shop-products-card__link")].map((a) => a.getAttribute("href")),
  }));
  if (st.error || st.cards === 0) {
    productsFails.push({ id, error: st.error || "no cards" });
    continue;
  }
  for (const href of st.hrefs.slice(0, 3)) {
    await page.goto(buildLocalPageUrl(base, href.replace(/^\//, "")), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const ok = await page.evaluate(
      () =>
        !document.querySelector("[data-tasful-product-main]")?.hidden &&
        Boolean(document.querySelector("[data-tasful-product-title]")?.textContent?.trim()) &&
        !/見つかりません/.test(document.querySelector("[data-tasful-product-status]")?.textContent || "")
    );
    if (ok) productLinkStats.ok += 1;
    else {
      productLinkStats.ng += 1;
      const pid = new URL(href, base).searchParams.get("productId");
      productLinkStats.ngIds.push(`${id}:${pid}`);
    }
  }
}

console.log(JSON.stringify({ productsFails, productLinkStats }, null, 2));
await browser.close();
