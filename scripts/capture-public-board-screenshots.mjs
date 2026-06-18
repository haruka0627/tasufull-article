#!/usr/bin/env node
/**
 * public-board レビュー用スクリーンショット（390px / 1280px）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "public-board-review");

const PORTS = [
  Number(process.env.VITE_PORT) || 0,
  5191,
  5190,
  5173,
  5174,
  5175,
  5176,
  5177,
  5178,
  5182,
  5199,
  5200,
].filter((p) => p > 0);

async function findBaseUrl() {
  for (const port of PORTS) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${base}/public-board.html`, { method: "HEAD" });
      if (res.ok) return base;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found. Start with: npx vite --port 5190");
}

const SHOTS = [
  {
    file: "01-public-board-390.png",
    path: "/public-board.html",
    width: 390,
    height: 844,
    setup: async (page) => {
      await page.waitForSelector("[data-job-list-mobile] article", { timeout: 25000 });
      await page.waitForTimeout(1200);
    },
  },
  {
    file: "02-public-board-1280.png",
    path: "/public-board.html",
    width: 1280,
    height: 900,
    setup: async (page) => {
      await page.waitForSelector("[data-job-list-body] .job-table-row", { timeout: 25000 });
      await page.waitForTimeout(1200);
    },
  },
  {
    file: "03-public-board-filter-project-390.png",
    path: "/public-board.html",
    width: 390,
    height: 844,
    setup: async (page) => {
      await page.waitForSelector("[data-job-top-tabs]", { timeout: 25000 });
      await page.click('[data-job-tab="project"]');
      await page.waitForTimeout(800);
    },
  },
  {
    file: "04-public-board-detail-project-390.png",
    path: "/public-board-detail.html?id=pub-board-proj-001&type=project",
    width: 390,
    height: 844,
    setup: async (page) => {
      await page.waitForSelector('[data-board-detail-root="project"]', { timeout: 25000 });
      await page.waitForFunction(
        () => document.querySelector("[data-public-project-title]")?.textContent?.trim().length > 0,
        { timeout: 25000 }
      );
      await page.addStyleTag({
        content:
          '[data-board-detail-root="project"], [data-board-detail-root="project"] * { visibility: visible !important; }',
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1800);
    },
  },
  {
    file: "05-public-board-detail-project-1280.png",
    path: "/public-board-detail.html?id=pub-board-proj-001&type=project",
    width: 1280,
    height: 900,
    setup: async (page) => {
      await page.waitForSelector('[data-board-detail-root="project"]', { timeout: 25000 });
      await page.waitForFunction(
        () => document.querySelector("[data-public-project-title]")?.textContent?.trim().length > 0,
        { timeout: 25000 }
      );
      await page.addStyleTag({
        content:
          '[data-board-detail-root="project"], [data-board-detail-root="project"] * { visibility: visible !important; }',
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1800);
    },
  },
  {
    file: "06-public-board-detail-job-390.png",
    path: "/public-board-detail.html?id=pub-board-job-001&type=job",
    width: 390,
    height: 844,
    setup: async (page) => {
      await page.waitForSelector('[data-board-detail-root="job"]:not([hidden])', { timeout: 25000 });
      await page.waitForFunction(
        () => document.body.dataset.listingLoaded === "true",
        { timeout: 25000 }
      );
      await page.waitForTimeout(1500);
    },
  },
  {
    file: "07-public-board-detail-job-1280.png",
    path: "/public-board-detail.html?id=pub-board-job-001&type=job",
    width: 1280,
    height: 900,
    setup: async (page) => {
      await page.waitForSelector('[data-board-detail-root="job"]:not([hidden])', { timeout: 25000 });
      await page.waitForFunction(
        () => document.body.dataset.listingLoaded === "true",
        { timeout: 25000 }
      );
      await page.waitForTimeout(1500);
    },
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const base = await findBaseUrl();
console.log("Base URL:", base);

const browser = await chromium.launch({ headless: true });

for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
  });

  await page.addInitScript(() => {
    try {
      const KEY = "tasful:builder:mvp:v1";
      const raw = localStorage.getItem(KEY);
      if (raw) return;
    } catch {
      /* seed on page */
    }
  });

  await page.goto(`${base}${shot.path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await shot.setup(page);

  const outPath = path.join(OUT_DIR, shot.file);
  const projectRoot = page.locator('[data-board-detail-root="project"]:not([hidden])');
  const jobRoot = page.locator('[data-board-detail-root="job"]:not([hidden])');
  if (shot.path.includes("type=project") && (await projectRoot.count())) {
    await page.screenshot({ path: outPath, fullPage: true });
  } else if (shot.path.includes("type=job") && (await jobRoot.count())) {
    await page.screenshot({ path: outPath, fullPage: true });
  } else {
    await page.screenshot({ path: outPath, fullPage: true });
  }
  console.log("Saved:", outPath);

  if (shot.path.includes("public-board.html") && !shot.file.includes("filter")) {
    const stats = await page.evaluate(() => {
      const badges = [...document.querySelectorAll(".job-board-type-badge")].map((b) => b.textContent?.trim());
      const project = badges.filter((b) => b === "案件").length;
      const job = badges.filter((b) => b === "求人").length;
      return {
        total: document.querySelector("[data-job-top-count]")?.textContent,
        visible: badges.length,
        project,
        job,
      };
    });
    console.log("  stats:", JSON.stringify(stats));
  }

  await page.close();
}

await browser.close();
console.log("\nDone. Output:", OUT_DIR);
