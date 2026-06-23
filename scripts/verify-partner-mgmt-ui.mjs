/**
 * Partner management UI — viewport screenshots + console check
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PRT_UI_BASE || "http://127.0.0.1:8788";
const OUT_DIR = path.join("reports", "screenshots", "partner-mgmt-ui");

const PAGES = [
  { name: "mgmt-mock", url: "/builder/partner-management.html?mock=1", selector: "[data-prt-mgmt-table]" },
  { name: "detail-mock", url: "/builder/partner-detail.html?mock=1&id=PR-2026-001", selector: "[data-prt-detail-content]:not([hidden])" },
];

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1280", width: 1280, height: 900 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const pageDef of PAGES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      const fullUrl = BASE + pageDef.url;
      let loadOk = true;
      try {
        const res = await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 30000 });
        if (!res || !res.ok()) loadOk = false;
        await page.waitForSelector(pageDef.selector, { timeout: 15000 });
      } catch (e) {
        loadOk = false;
        consoleErrors.push(String(e.message || e));
      }

      const shot = path.join(OUT_DIR, `${pageDef.name}-${vp.label}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

      results.push({ page: pageDef.name, viewport: vp.label, loadOk, consoleErrors, screenshot: shot });
      await context.close();
    }
  }

  await browser.close();

  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    results,
    summary: {
      total: results.length,
      loadFailures: results.filter((r) => !r.loadOk).length,
      consoleErrorCount: results.reduce((n, r) => n + r.consoleErrors.length, 0),
    },
  };

  await writeFile("reports/partner-mgmt-ui-verify.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  process.exit(report.summary.loadFailures > 0 || report.summary.consoleErrorCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
