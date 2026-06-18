import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);

const tree = await page.evaluate(() => {
  function path(el) {
    const parts = [];
    let n = el;
    while (n && n !== document.body) {
      const tag = n.tagName.toLowerCase();
      const attrs = [
        n.id ? `#${n.id}` : "",
        n.getAttribute("data-tasu-mdetail-other-products-section") !== null
          ? "[other-products]"
          : "",
        n.getAttribute("data-product-mobile-copyright") !== null ? "[copyright]" : "",
        n.getAttribute("data-tasu-mdetail-sections") !== null ? "[sections]" : "",
        n.className && typeof n.className === "string"
          ? `.${n.className.split(" ").slice(0, 2).join(".")}`
          : "",
      ]
        .filter(Boolean)
        .join("");
      parts.unshift(tag + attrs);
      n = n.parentElement;
    }
    return parts.join(" > ");
  }

  const card = document.querySelector(".detail-product-other-services-card");
  const footer = document.querySelector("[data-product-mobile-copyright]");
  const sections = document.querySelector("[data-tasu-mdetail-sections]");

  return {
    cardPath: path(card),
    footerPath: path(footer),
    footerPrev: footer?.previousElementSibling?.tagName + (footer?.previousElementSibling?.getAttribute("data-tasu-mdetail-other-products-section") !== null ? "[other-products]" : ""),
    sectionsLastChild: sections?.lastElementChild?.tagName + (sections?.lastElementChild?.getAttribute("data-product-mobile-copyright") !== null ? "[copyright]" : ""),
    sectionsChildren: Array.from(sections?.children || []).map((c) => c.tagName + (c.dataset ? Object.keys(c.dataset).join(",") : "")),
  };
});

console.log(JSON.stringify(tree, null, 2));
});

await closeAllBrowsers();
