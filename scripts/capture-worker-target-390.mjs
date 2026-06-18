import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "screenshots", "worker-detail");
const TARGET_PATH =
  "/detail-worker.html?userId=u_hiro&id=worker_hiro_001";
const PORTS = [5173, 5176, 5174, 5199, 5200];

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
const TARGET_URL = (await findBase()) + TARGET_PATH;
console.log("URL:", TARGET_URL);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);

const dom = await page.evaluate(() => ({
  featuredDisplay: getComputedStyle(
    document.querySelector("[data-featured-upsell-section]")
  ).display,
  tagsVisible: !document.querySelector(
    "[data-listing-worker-support-tags-block]"
  )?.hidden,
  tagPills: document.querySelectorAll(".worker-detail-tag-pill").length,
}));
console.log("verify:", dom);

async function shot(name, scrollFn) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  if (scrollFn) await page.evaluate(scrollFn);
  await page.waitForTimeout(450);
  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  console.log("saved:", p);
}

// 1. 上位掲載エリア付近（詳細末尾 → ポートフォリオ直前）
await shot("worker-detail-390-featured-area.png", () => {
  const portfolio = document.getElementById("section-portfolio");
  if (portfolio) {
    portfolio.scrollIntoView({ block: "start", behavior: "instant" });
    window.scrollBy(0, -24);
  }
});

// 2. 対応タグ付近
await shot("worker-detail-390-tags.png", () => {
  const tags = document.querySelector(
    "[data-listing-worker-support-tags-block]"
  );
  if (tags && !tags.hidden) {
    tags.scrollIntoView({ block: "center", behavior: "instant" });
  } else {
    document
      .getElementById("section-details")
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }
});

// 3. 最下部
await shot("worker-detail-390-bottom.png", () => {
  window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight);
});

await browser.close();
