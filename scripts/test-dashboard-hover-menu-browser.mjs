/**
 * ダッシュボード hover メガメニュー検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-hover-menu";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード hover メガメニューレビュー";
const BUILD = "2026-06-15-hover-menu";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const PANEL_IDS = ["catalog", "publish", "comms"];
const PANEL_LINK_COUNTS = { catalog: 8, publish: 4, comms: 3 };

async function findBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/dashboard.html`, { method: "HEAD" });
      if (res.ok) return `http://127.0.0.1:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error("No dev server found");
}

function fixCssMime(page) {
  return page.route("**/*.css*", async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), "content-type": "text/css; charset=utf-8" };
    await route.fulfill({ response, headers, body: await response.body() });
  });
}

async function prepareDashboard(page, base) {
  await fixCssMime(page);
  await page.goto(`${base}/dashboard.html?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body?.classList.remove("tasu-app-mobile-page");
  });
  await page.addStyleTag({
    content: `
      body[data-page="dashboard"] .dash-grid { display: grid !important; }
      body[data-page="dashboard"] .tasu-mobile-home { display: none !important; }
      body[data-page="dashboard"] [data-dash-quick] { display: flex !important; }
    `,
  });
  await page.waitForSelector("[data-mega-menu-trigger]", { timeout: 20000, state: "attached" });
}

function collectPageErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}

async function panelIsOpen(page) {
  return page.evaluate(() => !document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"));
}

async function panelIsClosed(page) {
  return page.evaluate(() => document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
const cases = [];

// --- PC hover ---
{
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  const buildOk = await page.evaluate(
    (build) => window.TasuDashboardShell?.DASHBOARD_JS_BUILD === build,
    BUILD
  );
  cases.push({
    caseId: "js-build",
    pass: buildOk && errors.length === 0,
    label: "dashboard.js ビルド",
    actual: buildOk ? BUILD : "—",
    expected: BUILD,
  });

  for (const panelId of PANEL_IDS) {
    await page.hover(`[data-mega-menu-trigger="${panelId}"]`);
    await page.waitForFunction(
      () => !document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"),
      { timeout: 3000 }
    );

    const state = await page.evaluate((id) => {
      const trigger = document.querySelector(`[data-mega-menu-trigger="${id}"]`);
      const panel = document.querySelector("[data-mega-menu-panel]");
      const disclaimer = document.querySelector(".dash-disclaimer");
      const panelRect = panel?.getBoundingClientRect();
      const disclaimerRect = disclaimer?.getBoundingClientRect();
      const feeRect = document.querySelector("#dash-fees")?.getBoundingClientRect();
      const intersects = (a, b) =>
        Boolean(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
      return {
        expanded: trigger?.getAttribute("aria-expanded") === "true",
        linkCount: panel?.querySelectorAll(".dash-service-mega__link").length || 0,
        disclaimerBelow: panelRect && disclaimerRect ? disclaimerRect.top >= panelRect.bottom - 2 : false,
        feeOverlap: intersects(panelRect, feeRect),
      };
    }, panelId);

    cases.push({
      caseId: `pc-hover-${panelId}`,
      pass:
        state.expanded &&
        state.linkCount === PANEL_LINK_COUNTS[panelId] &&
        state.disclaimerBelow &&
        !state.feeOverlap,
      label: `PC hover ${panelId}`,
      actual: `expanded=${state.expanded}, links=${state.linkCount}`,
      expected: "hoverで展開",
    });

    if (panelId === "catalog") {
      await page.locator("[data-dash-quick]").screenshot({ path: path.join(OUT_DIR, "hover-catalog-1280.png") });
    }

    const quickBox = await page.locator("[data-dash-quick]").boundingBox();
    if (quickBox) {
      await page.mouse.move(quickBox.x - 40, quickBox.y - 40);
    } else {
      await page.mouse.move(4, 4);
    }
    await page.waitForTimeout(250);
    await page.waitForFunction(
      () => document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"),
      { timeout: 5000 }
    );
  }

  cases.push({
    caseId: "pc-hover-leave-close",
    pass: await panelIsClosed(page),
    label: "PC マウスを外すと閉じる",
    actual: (await panelIsClosed(page)) ? "closed" : "open",
    expected: "closed",
  });

  // panel hover keeps open
  await page.hover('[data-mega-menu-trigger="catalog"]');
  await page.waitForFunction(
    () => !document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"),
    { timeout: 3000 }
  );
  await page.hover("[data-mega-menu-panel] .dash-service-mega__link");
  await page.waitForTimeout(200);
  cases.push({
    caseId: "pc-panel-hover-stays",
    pass: await panelIsOpen(page),
    label: "PC メニュー上 hover で開いたまま",
    actual: (await panelIsOpen(page)) ? "open" : "closed",
    expected: "open",
  });

    });
}

// --- SP tap ---
{
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  await page.click('[data-mega-menu-trigger="catalog"]');
  await page.waitForFunction(
    () => !document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"),
    { timeout: 3000 }
  );

  const tapOpen = await page.evaluate(() => ({
    expanded: document.querySelector('[data-mega-menu-trigger="catalog"]')?.getAttribute("aria-expanded") === "true",
    links: document.querySelectorAll("[data-mega-menu-panel] .dash-service-mega__link").length,
    errors: 0,
  }));

  cases.push({
    caseId: "sp-tap-open",
    pass: tapOpen.expanded && tapOpen.links === 8 && errors.length === 0,
    label: "SP タップで開く",
    actual: `expanded=${tapOpen.expanded}, links=${tapOpen.links}`,
    expected: "タップで展開",
  });

  await page.locator("[data-dash-quick]").screenshot({ path: path.join(OUT_DIR, "tap-catalog-390.png") });

  await page.click('[data-mega-menu-trigger="catalog"]');
  await page.waitForFunction(
    () => document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"),
    { timeout: 3000 }
  );

  cases.push({
    caseId: "sp-tap-close",
    pass: await panelIsClosed(page),
    label: "SP 再タップで閉じる",
    actual: (await panelIsClosed(page)) ? "closed" : "open",
    expected: "closed",
  });

    });
}

const failCount = cases.filter((c) => !c.pass).length;
const passCount = cases.length - failCount;
const allPass = failCount === 0;

const indexReport = {
  generatedAt: new Date().toISOString(),
  folderId: FOLDER_ID,
  title: REVIEW_TITLE,
  overall: allPass ? "PASS" : "FAIL",
  allPass,
  summary: { overall: allPass ? "PASS" : "FAIL", failCount, passCount, minorCount: 0, total: cases.length },
  cases,
  screenshotCatalog: [
    { file: "hover-catalog-1280.png", label: "PC hover サービス一覧", url: "dashboard.html" },
    { file: "tap-catalog-390.png", label: "SP タップ サービス一覧", url: "dashboard.html" },
  ],
  base,
};

await writeFile(
  path.join(OUT_DIR, "review-report.json"),
  JSON.stringify({ results: cases, failed: failCount, total: cases.length, passed: passCount }, null, 2)
);
await writeFile(
  path.join(OUT_DIR, "review-report.md"),
  [`# ${REVIEW_TITLE}`, "", `総合: **${allPass ? "PASS" : "FAIL"}** (${passCount}/${cases.length})`, "", ...cases.map((c) => `- [${c.pass ? "OK" : "NG"}] ${c.label}`)].join("\n")
);

await finalizeScreenshotRun(ROOT, FOLDER_ID, { title: REVIEW_TITLE, report: indexReport, targetPage: "dashboard.html", viewports: ["390", "1280"] });
console.log(`\n${REVIEW_TITLE}: ${allPass ? "PASS" : "FAIL"} (${passCount}/${cases.length})`);
if (!allPass) {
  cases.filter((c) => !c.pass).forEach((c) => console.log(`  FAIL: ${c.label} — ${c.actual}`));
  await closeAllBrowsers();
  process.exit(1);
}
