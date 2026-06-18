/**
 * ダッシュボード サイドバー hover メガメニュー検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-sidebar-mega";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード サイドバーメガメニューレビュー";
const BUILD = "2026-06-15-sidebar-mega";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const TRIGGERS = [
  { id: "search", label: "業務サービスを探す" },
  { id: "favorites", label: "お気に入り" },
  { id: "talk", label: "TASFUL TALK" },
  { id: "chats", label: "すべてのやりとり" },
];

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
  await page.evaluate(() => document.body?.classList.remove("tasu-app-mobile-page"));
  await page.waitForSelector("[data-sidebar-mega-trigger]", { timeout: 20000, state: "attached" });
}

function collectPageErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
const cases = [];

{
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  const layout = await page.evaluate((build) => {
    const panel = document.querySelector("[data-sidebar-mega-panel]");
    const cs = panel ? getComputedStyle(panel) : null;
    return {
      build: window.TasuDashboardShell?.DASHBOARD_JS_BUILD,
      quickRemoved: !document.querySelector("[data-dash-quick]"),
      triggerCount: document.querySelectorAll("[data-sidebar-mega-trigger]").length,
      panelHidden: panel?.hasAttribute("hidden"),
      panelPosition: cs?.position || "",
    };
  }, BUILD);

  cases.push({
    caseId: "layout-pc",
    pass:
      errors.length === 0 &&
      layout.build === BUILD &&
      layout.quickRemoved &&
      layout.triggerCount === 4 &&
      layout.panelHidden &&
      layout.panelPosition === "fixed",
    label: "PC クイック削除・4トリガー",
    actual: `quick=${layout.quickRemoved}, triggers=${layout.triggerCount}, build=${layout.build}`,
    expected: "4カード削除 / サイドバー4項目",
  });

  for (const trigger of TRIGGERS) {
    await page.hover(`[data-sidebar-mega-trigger][data-breadcrumb-label="${trigger.label}"]`);
    await page.waitForFunction(
      () => !document.querySelector("[data-sidebar-mega-panel]")?.hasAttribute("hidden"),
      { timeout: 3000 }
    );

    const state = await page.evaluate(() => {
      const panel = document.querySelector("[data-sidebar-mega-panel]");
      const cs = panel ? getComputedStyle(panel) : null;
      const rect = panel?.getBoundingClientRect();
      const sidebar = document.querySelector(".dash-sidebar");
      const sidebarRect = sidebar?.getBoundingClientRect();
      const feeRect = document.querySelector("#dash-fees")?.getBoundingClientRect();
      const disclaimer = document.querySelector(".dash-disclaimer")?.getBoundingClientRect();
      const intersects = (a, b) =>
        Boolean(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
      return {
        width: rect ? Math.round(rect.width) : 0,
        leftOfSidebar: rect && sidebarRect ? rect.left >= sidebarRect.right - 4 : false,
        linkCount: panel?.querySelectorAll(".dash-sidebar-mega__link").length || 0,
        colCount: panel?.querySelectorAll(".dash-sidebar-mega__col").length || 0,
        feeOverlap: intersects(rect, feeRect),
        disclaimerOverlap: intersects(rect, disclaimer),
        zIndex: cs?.zIndex || "",
      };
    });

    cases.push({
      caseId: `hover-${trigger.id}`,
      pass:
        state.width >= 720 &&
        state.width <= 860 &&
        state.leftOfSidebar &&
        state.linkCount === 15 &&
        state.colCount === 3 &&
        !state.feeOverlap &&
        !state.disclaimerOverlap &&
        Number(state.zIndex) >= 300,
      label: `hover ${trigger.label}`,
      actual: `w=${state.width}, links=${state.linkCount}, cols=${state.colCount}`,
      expected: "3カラム / 720-860px / 右展開",
    });

    if (trigger.id === "search") {
      await page.locator("[data-sidebar-mega-panel]").screenshot({
        path: path.join(OUT_DIR, "sidebar-mega-1280.png"),
      });
    }

    await page.hover("[data-sidebar-mega-panel] .dash-sidebar-mega__link");
    await page.waitForTimeout(150);
    const staysOpen = await page.evaluate(
      () => !document.querySelector("[data-sidebar-mega-panel]")?.hasAttribute("hidden")
    );
    if (trigger.id === "search") {
      cases.push({
        caseId: "panel-hover-stays",
        pass: staysOpen,
        label: "メニュー上 hover で開いたまま",
        actual: staysOpen ? "open" : "closed",
        expected: "open",
      });
    }

    await page.mouse.move(1200, 20);
    await page.waitForTimeout(250);
    await page.waitForFunction(
      () => document.querySelector("[data-sidebar-mega-panel]")?.hasAttribute("hidden"),
      { timeout: 3000 }
    );
  }

  cases.push({
    caseId: "hover-leave-close",
    pass: await page.evaluate(() => document.querySelector("[data-sidebar-mega-panel]")?.hasAttribute("hidden")),
    label: "マウスを外すと閉じる",
    actual: "closed",
    expected: "closed",
  });

    });
}

{
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  const sp = await page.evaluate(() => ({
    quickRemoved: !document.querySelector("[data-dash-quick]"),
    panelDisplay: getComputedStyle(document.querySelector("[data-sidebar-mega-host]") || document.body).display,
    triggers: document.querySelectorAll("[data-sidebar-mega-trigger]").length,
  }));

  cases.push({
    caseId: "layout-sp",
    pass: errors.length === 0 && sp.quickRemoved && sp.triggers === 4,
    label: "SP 現状維持",
    actual: `quick=${sp.quickRemoved}, triggers=${sp.triggers}`,
    expected: "クイック削除 / サイドバー項目維持",
  });

  await page.screenshot({ path: path.join(OUT_DIR, "dashboard-390.png"), fullPage: false });
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
    { file: "sidebar-mega-1280.png", label: "PC サイドバーメガメニュー", url: "dashboard.html" },
    { file: "dashboard-390.png", label: "SP 390px", url: "dashboard.html" },
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
