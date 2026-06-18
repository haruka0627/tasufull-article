import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "detail-job-verify");
const PORTS = [5173, 5176, 5174, 5188, 5199, 5200, 5182];

async function findBaseUrl() {
  for (const port of PORTS) {
    const url = `http://127.0.0.1:${port}/detail-job.html`;
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
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

const browser = await chromium.launch({ headless: true });

async function audit(page, label) {
  const metrics = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const forbidden = [
      "フォロワー",
      "新規ユーザー",
      "PREMIUM",
      "LEGEND",
      "他の求人を見る",
      "出品者",
      "他の商品",
      "他のサービス",
      "関連ワーカー",
      "信頼プロフィール",
    ];
    return {
      forbiddenFound: forbidden.filter((w) => text.includes(w)),
      rankChip: document.querySelectorAll(".seller-rank-chip,[data-seller-rank-chip]").length,
      followers: document.querySelectorAll("[data-seller-followers]").length,
      rating: document.querySelectorAll("[data-seller-trust-anchor],[data-seller-rating-value]").length,
      companyName: document.querySelector("[data-seller-display-name]")?.textContent?.trim(),
      relatedTitle: document.querySelector("#detailRelatedTitle")?.textContent?.trim(),
      moreBtn: document.querySelector(".job-company-card__more span")?.textContent?.trim(),
      heroStats: document.querySelector(".job-top-company__stats")?.textContent?.trim(),
      hasJobCompany: !!document.querySelector(".job-company-section"),
    };
  });
  console.log(`${label} metrics:`, JSON.stringify(metrics, null, 2));
  return metrics;
}

async function capturePc() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/detail-job.html?id=demo_job_001`, {
    waitUntil: "commit",
    timeout: 45000,
  });
  await page.waitForTimeout(8000);
  await audit(page, "PC");
  const sections = [
    { name: "01-hero", y: 0 },
    { name: "02-details", id: "section-details" },
    { name: "03-company", id: "section-seller" },
    { name: "04-portfolio", id: "section-portfolio" },
    { name: "05-related", id: "otherServices" },
  ];
  for (const shot of sections) {
    if (shot.id) {
      const el = await page.$(`#${shot.id}`);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await el.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
        console.log("Saved:", shot.name);
        continue;
      }
    }
    await page.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
    console.log("Saved:", shot.name);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "06-bottom.png"), fullPage: false });
  await page.close();
}

async function captureMobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/detail-job.html?id=demo_job_001`, {
    waitUntil: "commit",
    timeout: 45000,
  });
  await page.waitForTimeout(8000);
  await audit(page, "MOBILE");
  const shots = [
    { name: "m01-first-view", y: 0 },
    { name: "m02-details", id: "section-details" },
    { name: "m03-company", id: "section-seller" },
    { name: "m04-portfolio", id: "section-portfolio" },
    { name: "m05-related", id: "otherServices" },
  ];
  for (const shot of shots) {
    if (shot.id) {
      const el = await page.$(`#${shot.id}`);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        await el.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
        console.log("Saved:", shot.name);
        continue;
      }
    }
    await page.evaluate((y) => window.scrollTo(0, y), shot.y || 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
    console.log("Saved:", shot.name);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "m06-footer.png") });
  await page.close();
}

await capturePc();
await captureMobile();
await browser.close();
console.log("Done.");
