#!/usr/bin/env node
/**
 * public-board-detail（from=talk）レビュー用スクショ PC1280 / SP390
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots", "public-board-detail-talk");

async function findBaseUrl() {
  for (const host of ["http://localhost", "http://127.0.0.1"]) {
    for (const port of [5173, 5176, 5174]) {
      try {
        const res = await fetch(`${host}:${port}/public-board-detail.html`, { method: "HEAD" });
        if (res.ok) return `${host}:${port}`;
      } catch {
        /* next */
      }
    }
  }
  throw new Error("No dev server found");
}

const URL =
  "/public-board-detail.html?id=pub-board-project-001&type=project&from=talk";

fs.mkdirSync(OUT_DIR, { recursive: true });
const BASE = await findBaseUrl();
const browser = await chromium.launch({ headless: true });

for (const { file, width, height } of [
  { file: "public-board-detail-talk-1280.png", width: 1280, height: 900 },
  { file: "public-board-detail-talk-390.png", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}${URL}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => document.body.dataset.boardDetailLoaded === "true",
    { timeout: 20000 }
  );
  await page.waitForTimeout(width < 500 ? 1500 : 800);
  await page.evaluate(() => {
    document.querySelectorAll(".is-view-focus").forEach((el) => el.classList.remove("is-view-focus"));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(width < 500 ? 500 : 200);

  const out = path.join(OUT_DIR, file);
  await page.screenshot({
    path: out,
    fullPage: width >= 960,
  });
  const meta = await page.evaluate(() => ({
    detailType: document.body.dataset.detailType,
    boardDetailType: document.body.dataset.boardDetailType,
    title: document.querySelector("[data-public-project-title]")?.textContent?.trim(),
    mobileTitle: document.querySelector(".tasu-mobile-page-head__title")?.textContent?.trim(),
    talkBack: document.querySelector("[data-tasu-talk-back]")?.textContent?.trim(),
    heroCard: Boolean(document.querySelector(".job-top-card.job-panel-card")),
    dock: Boolean(document.querySelector("[data-public-project-dock-apply]:not([hidden])")),
  }));
  console.log(file, meta, errors.length ? `errors:${errors.length}` : "no-console-errors");
  await page.close();
}

await browser.close();
console.log(`Screenshots saved to ${OUT_DIR}`);
