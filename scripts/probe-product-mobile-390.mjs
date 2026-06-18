import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";

const url = "http://127.0.0.1:5173/detail-product.html?id=product_set_2026";
fs.mkdirSync("screenshots/product-detail", { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const sectionPortfolio = document.getElementById("section-portfolio");
  const chunk = document.querySelector('[data-tasu-mdetail-from="section-portfolio"]');
  const sections = [...document.querySelectorAll(".tasu-mdetail-section")].map((s) => ({
    label: s.querySelector(".tasu-mdetail-section__label")?.textContent?.trim(),
    html: s.innerHTML.slice(0, 300),
  }));
  const card = sectionPortfolio?.querySelector(".skill-portfolio-card");
  const cardImg = card?.querySelector("img");
  return {
    mdetailReady: document.body.classList.contains("tasu-mdetail-ready"),
    pcWrapHidden: document.querySelector(".skill-detail-wrap")?.style.display,
    sections,
    chunkHtml: chunk?.innerHTML?.slice(0, 600),
    cardImg: cardImg
      ? {
          src: cardImg.src?.slice(-60),
          alt: cardImg.alt,
          rect: cardImg.getBoundingClientRect(),
          fontSize: getComputedStyle(cardImg).fontSize,
        }
      : null,
    sellerMoreBtn: (() => {
      const btn = document.querySelector("#section-seller .seller-more-jobs-btn");
      const svg = btn?.querySelector("svg");
      return {
        btnH: btn?.getBoundingClientRect()?.height,
        svgW: svg?.getBoundingClientRect()?.width,
        svgCS: svg ? getComputedStyle(svg).width : null,
      };
    })(),
    statsBlock: (() => {
      const b = document.querySelector("#section-seller .seller-main__stats");
      return b
        ? {
            h: b.offsetHeight,
            mb: getComputedStyle(b).marginBottom,
            pb: getComputedStyle(b).paddingBottom,
            minH: getComputedStyle(b).minHeight,
          }
        : null;
    })(),
    bodyHasLte: document.body.innerText.toLowerCase().includes("lte"),
    visibleTextSample: document.body.innerText.slice(0, 500),
  };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "screenshots/product-detail/probe-390.png" });
});

await closeAllBrowsers();
