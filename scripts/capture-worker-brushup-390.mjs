import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "worker-detail");
const TARGET_PATH =
  "/detail-worker.html?userId=u_hiro&id=worker_hiro_001";
const PORTS = [5173, 5176, 5174, 5199, 5200];
const WIDE_BANNER = "/images/signup-left-visual.png";

async function findBase() {
  for (const port of PORTS) {
    try {
      if (
        (await fetch(`http://127.0.0.1:${port}${TARGET_PATH}`, {
          method: "HEAD",
        })).ok
      ) {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
      /* next */
    }
  }
  throw new Error("no dev server");
}

fs.mkdirSync(OUT, { recursive: true });
const base = await findBase();
const TARGET_URL = base + TARGET_PATH;
console.log("URL:", TARGET_URL);

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);

await page.evaluate((bannerSrc) => {
  const img = document.querySelector("[data-listing-image]");
  if (img) {
    img.src = bannerSrc;
    img.classList.remove("is-loading");
    img.closest("figure")?.classList.remove("is-placeholder", "is-loading");
  }
}, WIDE_BANNER);
await page.waitForTimeout(1200);

const verify = await page.evaluate(() => {
  const img = document.querySelector("[data-listing-image]");
  const notes = document.querySelector("[data-listing-worker-notes-block]");
  const reviews = document.querySelector("#section-reviews");
  const footer = document.querySelector(".skill-detail-wrap > footer");
  return {
    imgFit: img ? getComputedStyle(img).objectFit : null,
    imgNatural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
    imgBox: img?.getBoundingClientRect(),
    notesVisible: notes && !notes.hidden,
    notesMarginTop: notes
      ? getComputedStyle(notes).marginTop
      : null,
    cardCopyrightGap:
      reviews && footer
        ? footer.getBoundingClientRect().top -
          reviews.getBoundingClientRect().bottom
        : null,
    footerPaddingTop: footer ? getComputedStyle(footer).paddingTop : null,
  };
});
console.log("390 verify:", verify);

async function shot(name, scrollFn) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  if (scrollFn) await page.evaluate(scrollFn);
  await page.waitForTimeout(450);
  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  console.log("saved:", p);
}

await shot("worker-detail-390-notes.png", () => {
  const notes = document.querySelector("[data-listing-worker-notes-block]");
  if (notes && !notes.hidden) {
    notes.scrollIntoView({ block: "center", behavior: "instant" });
  }
});

await shot("worker-detail-390-profile-photo.png", () => {
  window.scrollTo(0, 0);
});

await shot("worker-detail-390-bottom.png", () => {
  window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight);
});

const pcPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await pcPage.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
await pcPage.waitForTimeout(3000);
const pcVerify = await pcPage.evaluate(() => ({
  imgFit: getComputedStyle(document.querySelector("[data-listing-image]")).objectFit,
  imgMaxH: getComputedStyle(document.querySelector("[data-listing-image]")).maxHeight,
  ctaPosition: getComputedStyle(document.querySelector(".skill-hero-premium__cta"))
    .position,
  notesMarginTop: getComputedStyle(
    document.querySelector("[data-listing-worker-notes-block]")
  ).marginTop,
  footerPaddingTop: getComputedStyle(
    document.querySelector(".skill-detail-wrap > footer")
  ).paddingTop,
}));
console.log("PC verify:", pcVerify);

});

await closeAllBrowsers();
