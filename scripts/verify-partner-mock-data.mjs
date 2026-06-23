/**
 * Partner mock UI — full-page screenshots at 390 / 768 / 1280
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";
const OUT_DIR = path.join("reports", "screenshots", "partner-mgmt-ui", "mock-data");

const PAGES = [
  {
    name: "mgmt",
    url: "/builder/partner-management.html?mock=1",
    ready: "[data-prt-mgmt-tbody] .builder-prt-app-card",
    minCards: 20,
  },
  {
    name: "detail",
    url: "/builder/partner-detail.html?mock=1&id=PR-2026-001",
    ready: "[data-prt-detail-content]:not([hidden])",
  },
];

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1280", width: 1280, height: 900 },
];

async function capture(browser, pageDef, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

  let loadOk = true;
  let metrics = {};
  try {
    const res = await page.goto(BASE + pageDef.url, { waitUntil: "networkidle", timeout: 30000 });
    if (!res || !res.ok()) loadOk = false;
    await page.waitForSelector(pageDef.ready, { timeout: 15000 });

    metrics = await page.evaluate((minCards) => {
      const root = document.documentElement;
      const cards = document.querySelectorAll(".builder-prt-app-card");
      const countEl = document.querySelector("[data-prt-mgmt-count]");
      return {
        cardCount: cards.length,
        countLabel: countEl ? countEl.textContent : null,
        horizontalScroll: root.scrollWidth > root.clientWidth + 1,
        mockMode: document.querySelector("[data-prt-mgmt-mode]")?.textContent === "モック",
      };
    }, pageDef.minCards || 0);

    if (pageDef.minCards && metrics.cardCount < pageDef.minCards) {
      loadOk = false;
      consoleErrors.push(`Expected >= ${pageDef.minCards} cards, got ${metrics.cardCount}`);
    }
  } catch (e) {
    loadOk = false;
    consoleErrors.push(String(e.message || e));
  }

  const shot = path.join(OUT_DIR, `${pageDef.name}-${vp.label}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

  await context.close();
  return { page: pageDef.name, viewport: vp.label, loadOk, consoleErrors, screenshot: shot, metrics };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const pageDef of PAGES) {
    for (const vp of VIEWPORTS) {
      results.push(await capture(browser, pageDef, vp));
    }
  }

  await browser.close();

  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    mockCount: 28,
    results,
    summary: {
      total: results.length,
      loadFailures: results.filter((r) => !r.loadOk).length,
      consoleErrorCount: results.reduce((n, r) => n + r.consoleErrors.length, 0),
    },
  };

  await writeFile("reports/partner-mock-data-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  process.exit(report.summary.loadFailures > 0 || report.summary.consoleErrorCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
