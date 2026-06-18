import { chromium } from "./lib/playwright-browser.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/detail-product.html?id=product_set_2026", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(7000);

const info = await page.evaluate(() => {
  const card = document.querySelector(
    "[data-tasu-mdetail-other-products-section] .detail-product-other-services-card"
  );
  const section = document.querySelector("[data-tasu-mdetail-other-products-section]");
  const sectionsWrap = document.querySelector("[data-tasu-mdetail-sections]");
  const footer = document.querySelector("[data-product-mobile-copyright]");
  const shell = document.querySelector("[data-tasu-mobile-detail-shell]");

  function cs(el) {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      marginTop: s.marginTop,
      marginBottom: s.marginBottom,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      gap: s.gap,
    };
  }

  const gap =
    card && footer
      ? Math.round(footer.getBoundingClientRect().top - card.getBoundingClientRect().bottom)
      : null;

  return {
    gap,
    card: cs(card),
    section: cs(section),
    sectionsWrap: cs(sectionsWrap),
    footer: cs(footer),
    shell: cs(shell),
    sectionBottom: section?.getBoundingClientRect().bottom,
    cardBottom: card?.getBoundingClientRect().bottom,
    footerTop: footer?.getBoundingClientRect().top,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
