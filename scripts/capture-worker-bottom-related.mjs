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

async function capture(name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4500);

  const metrics = await page.evaluate(() => {
    const other = document.getElementById("otherServices");
    const footer = document.querySelector(".skill-detail-wrap > footer");
    const title = document.querySelector("#detailRelatedTitle");
    const cards = other?.querySelectorAll(".detail-seller-service-card");
    const lastCard = other && !other.hidden ? other : document.getElementById("section-reviews");
    const gap =
      footer && lastCard
        ? footer.getBoundingClientRect().top - lastCard.getBoundingClientRect().bottom
        : null;
    return {
      otherHidden: other?.hidden,
      titleText: title?.textContent?.trim(),
      titleVisible:
        title && !other?.hidden
          ? title.getBoundingClientRect().height > 0
          : false,
      cardCount: cards?.length || 0,
      cardCopyrightGapPx: gap != null ? Math.round(gap) : null,
      footerMarginTop: footer ? getComputedStyle(footer).marginTop : null,
    };
  });
  console.log(`${name} metrics:`, metrics);

  await page.evaluate(() => {
    const other = document.getElementById("otherServices");
    const footer = document.querySelector(".skill-detail-wrap > footer");
    if (other && !other.hidden && footer) {
      const otherBottom = other.offsetTop + other.offsetHeight;
      const targetY = otherBottom - window.innerHeight * 0.55;
      window.scrollTo(0, Math.max(0, targetY));
    } else {
      window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight);
    }
  });
  await page.waitForTimeout(500);

  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  console.log("saved:", p);
  await page.close();
  return metrics;
}

const sp = await capture("worker-detail-390-bottom-related.png", 390, 844);
const pc = await capture("worker-detail-1280-bottom-related.png", 1280, 900);

await browser.close();
console.log("done", { sp, pc });
