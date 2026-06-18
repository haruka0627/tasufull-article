import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "job-top-mobile");
const PORTS = [5173, 5176, 5174, 5188, 5199, 5200];

async function findBaseUrl() {
  for (const port of PORTS) {
    const url = `http://127.0.0.1:${port}/job-top.html`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);

await withPlaywrightBrowser(async (browser) => {async function captureMobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/job-top.html`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(5000);

  const shots = [
    { name: "01-filter-spacing", selector: ".job-top-filter__toggle" },
    { name: "02-load-more", selector: ".job-top-pagination-bar" },
    { name: "03-count-text", selector: ".job-top-pagination__range" },
    { name: "04-page-bottom", type: "page-bottom" },
  ];

  const filterToggle = await page.$("[data-job-top-filter-toggle]");
  if (filterToggle) {
    await filterToggle.click();
    await page.waitForTimeout(300);
  }

  for (const shot of shots) {
    if (shot.type === "page-bottom") {
      const maxScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
      await page.waitForTimeout(350);
      const range = await page.$(".job-top-pagination__range");
      const rangeBox = range ? await range.boundingBox() : null;
      const clipY = rangeBox ? Math.max(0, rangeBox.y - 120) : Math.max(0, maxScroll - 200);
      await page.screenshot({
        path: path.join(OUT_DIR, `${shot.name}.png`),
        clip: { x: 0, y: clipY, width: 390, height: Math.min(844, 844 - clipY) },
      });
      console.log("Saved:", shot.name);
      continue;
    }

    if (shot.selector) {
      const el = await page.$(shot.selector);
      if (el) {
        const visible = await el.isVisible();
        if (!visible) {
          console.log("Skip (hidden):", shot.name);
          continue;
        }
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        if (shot.name === "01-filter-spacing") {
          const pr = await page.$(".job-top-pr");
          if (pr) {
            const prBox = await pr.boundingBox();
            const filterBox = await el.boundingBox();
            if (prBox && filterBox) {
              await page.screenshot({
                path: path.join(OUT_DIR, `${shot.name}.png`),
                clip: {
                  x: 0,
                  y: Math.max(0, prBox.y - 8),
                  width: 390,
                  height: Math.min(844, filterBox.y + filterBox.height + 24 - Math.max(0, prBox.y - 8)),
                },
              });
              console.log("Saved:", shot.name);
              continue;
            }
          }
        }
        await el.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
        console.log("Saved:", shot.name);
        continue;
      }
    }
    if (shot.y !== undefined) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.y);
      await page.waitForTimeout(200);
    }
    await page.screenshot({
      path: path.join(OUT_DIR, `${shot.name}.png`),
      fullPage: shot.name === "01-top-header" ? false : undefined,
    });
    console.log("Saved:", shot.name);
  }

  const metrics = await page.evaluate(() => {
    const pr = document.querySelector(".job-top-pr");
    const filter = document.querySelector(".job-top-filter");
    const loadMore = document.querySelector(".job-top-pagination__load-more");
    const prRect = pr?.getBoundingClientRect();
    const filterRect = filter?.getBoundingClientRect();
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      prToFilterGap: prRect && filterRect ? filterRect.top - prRect.bottom : null,
      layoutMarginTop: cs(document.querySelector(".job-top-layout"))?.marginTop,
      prMarginBottom: cs(pr)?.marginBottom,
      loadMoreText: loadMore?.textContent?.trim() || null,
      loadMoreHeight: loadMore?.getBoundingClientRect().height || null,
      loadMoreWidth: loadMore?.getBoundingClientRect().width || null,
      loadMoreRadius: cs(loadMore)?.borderRadius || null,
      pageBtnCount: document.querySelectorAll(".job-top-pagination button:not(.job-top-pagination__load-more)").length,
      mobileCardCount: document.querySelectorAll(".job-list-mobile-card").length,
      rangeText: document.querySelector("[data-job-top-range]")?.textContent?.trim() || null,
      rangeColor: cs(document.querySelector("[data-job-top-range]"))?.color || null,
      containerPadBottom: cs(document.querySelector(".job-top-container"))?.paddingBottom || null,
      paginationBarMarginBottom: cs(document.querySelector(".job-top-pagination-bar"))?.marginBottom || null,
      gapBelowRange:
        document.documentElement.scrollHeight -
        ((document.querySelector("[data-job-top-range]")?.getBoundingClientRect().bottom || 0) +
          window.scrollY),
    };
  });
  console.log("390px metrics:", JSON.stringify(metrics, null, 2));

  await page.close();
}

async function capturePc() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/job-top.html`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(OUT_DIR, "pc-1280-overview.png"), fullPage: false });
  console.log("Saved: pc-1280-overview");

  const metrics = await page.evaluate(() => ({
    tableVisible: getComputedStyle(document.querySelector(".job-table-wrap")).display !== "none",
    mobileListVisible: getComputedStyle(document.querySelector(".job-list-mobile")).display !== "none",
    searchGridCols: getComputedStyle(document.querySelector(".job-top-search__form")).gridTemplateColumns,
  }));
  console.log("1280px metrics:", JSON.stringify(metrics, null, 2));

  await page.close();
}

await captureMobile();
await capturePc();
});
console.log("Done.");

await closeAllBrowsers();
