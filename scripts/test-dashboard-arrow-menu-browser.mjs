/**
 * ダッシュボード 矢印付き展開メニュー検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-arrow-menu";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード 矢印付き展開メニューレビュー";
const BUILD = "2026-06-15-arrow-menu";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const PANEL_LINKS = {
  catalog: [
    { label: "業務サービス", href: "business.html" },
    { label: "スキル", href: "index.html?category=skill" },
    { label: "ワーカー", href: "index.html?category=worker" },
    { label: "商品掲載", href: "index.html?category=product" },
    { label: "TASFUL市場", href: "shop-store.html" },
    { label: "店舗・専門店", href: "shop-vendors.html" },
    { label: "求人", href: "job-top.html" },
    { label: "案件・求人ボード", href: "public-board.html" },
  ],
  publish: [
    { label: "掲載管理", href: "listing-management.html" },
    { label: "業務サービス掲載", href: "post.html?scope=business" },
    { label: "スキル掲載", href: "post.html" },
    { label: "市場出品", href: "shop-market-listing-new.html" },
  ],
  comms: [
    { label: "TASFUL TALK", href: "talk-home.html" },
    { label: "すべてのやりとり", href: "chat-list.html" },
    { label: "AI相談", href: "ai-workspace.html" },
  ],
};

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

async function openPanel(page, panelId) {
  await page.click(`[data-mega-menu-trigger="${panelId}"]`);
  await page.waitForSelector("[data-mega-menu-panel]:not([hidden])", { timeout: 5000 });
}

async function closePanel(page, panelId) {
  await page.click(`[data-mega-menu-trigger="${panelId}"]`);
  await page.waitForFunction(
    () => document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden"),
    { timeout: 5000 }
  );
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

for (const [viewport, suffix] of [
  [{ width: 1280, height: 900 }, "1280"],
  [{ width: 390, height: 844 }, "390"],
]) {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  const layout = await page.evaluate(() => {
    const bar = document.querySelector(".dash-quick-menu__bar");
    const items = document.querySelectorAll(".dash-quick-menu__item");
    const triggers = document.querySelectorAll("[data-mega-menu-trigger]");
    const chevrons = document.querySelectorAll(".dash-quick-menu__chevron");
    const panel = document.querySelector("[data-mega-menu-panel]");
    const feeCard = document.querySelector("#dash-fees");
    const quick = document.querySelector("[data-dash-quick]");
    const disclaimer = document.querySelector(".dash-disclaimer");
    const barRect = bar?.getBoundingClientRect();
    const feeRect = feeCard?.getBoundingClientRect();
    const disclaimerRect = disclaimer?.getBoundingClientRect();
    const intersects = (a, b) =>
      Boolean(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
    return {
      build: window.TasuDashboardShell?.DASHBOARD_JS_BUILD || null,
      itemCount: items.length,
      triggerCount: triggers.length,
      chevronCount: chevrons.length,
      panelHidden: panel?.hasAttribute("hidden"),
      panelInQuick: quick?.contains(panel),
      panelNotFixed: panel ? getComputedStyle(panel).position !== "fixed" : false,
      disclaimerBelowBar: barRect && disclaimerRect ? disclaimerRect.top >= barRect.bottom - 2 : false,
      feeOverlapsBar: intersects(barRect, feeRect),
    };
  });

  cases.push({
    caseId: `layout-${suffix}`,
    pass:
      errors.length === 0 &&
      layout.build === BUILD &&
      layout.itemCount === 4 &&
      layout.triggerCount === 3 &&
      layout.chevronCount === 4 &&
      layout.panelHidden &&
      layout.panelInQuick &&
      layout.panelNotFixed &&
      layout.disclaimerBelowBar &&
      !layout.feeOverlapsBar,
    label: `${suffix}px 4項目・パネル in-flow`,
    actual: `items=${layout.itemCount}, inQuick=${layout.panelInQuick}, disclaimerBelow=${layout.disclaimerBelowBar}`,
    expected: "4項目 / in-flow / 免責事項は下",
  });

  await page.locator(".dash-quick-menu__bar").screenshot({
    path: path.join(OUT_DIR, `menu-bar-${suffix}.png`),
  });

  for (const panelId of ["catalog", "publish", "comms"]) {
    await openPanel(page, panelId);

    const state = await page.evaluate((id) => {
      const trigger = document.querySelector(`[data-mega-menu-trigger="${id}"]`);
      const panel = document.querySelector("[data-mega-menu-panel]");
      const cs = panel ? getComputedStyle(panel) : null;
      const chevron = trigger?.querySelector(".dash-quick-menu__chevron");
      const chevCs = chevron ? getComputedStyle(chevron) : null;
      const panelRect = panel?.getBoundingClientRect();
      const barRect = document.querySelector(".dash-quick-menu__bar")?.getBoundingClientRect();
      const feeRect = document.querySelector("#dash-fees")?.getBoundingClientRect();
      const disclaimerRect = document.querySelector(".dash-disclaimer")?.getBoundingClientRect();
      const intersects = (a, b) =>
        Boolean(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
      return {
        expanded: trigger?.getAttribute("aria-expanded") === "true",
        panelHidden: panel?.hasAttribute("hidden"),
        panelDisplay: cs?.display || "",
        panelPosition: cs?.position || "",
        chevronRotated: chevCs?.transform && chevCs.transform !== "none",
        panelBelowBar: panelRect && barRect ? panelRect.top >= barRect.bottom - 2 : false,
        disclaimerBelowPanel: panelRect && disclaimerRect ? disclaimerRect.top >= panelRect.bottom - 2 : false,
        feeOverlapsPanel: intersects(panelRect, feeRect),
        linkCount: panel?.querySelectorAll(".dash-service-mega__link").length || 0,
      };
    }, panelId);

    cases.push({
      caseId: `${panelId}-open-${suffix}`,
      pass:
        state.expanded &&
        !state.panelHidden &&
        state.panelDisplay !== "none" &&
        state.panelPosition !== "fixed" &&
        state.chevronRotated &&
        state.panelBelowBar &&
        state.disclaimerBelowPanel &&
        !state.feeOverlapsPanel &&
        state.linkCount === PANEL_LINKS[panelId].length,
      label: `${suffix}px ${panelId} 展開`,
      actual: `expanded=${state.expanded}, links=${state.linkCount}, disclaimerBelow=${state.disclaimerBelowPanel}`,
      expected: "展開 / chevron回転 / 下に表示 / 免責事項を押し下げ",
    });

    await page.locator("[data-dash-quick]").screenshot({
      path: path.join(OUT_DIR, `${panelId}-open-${suffix}.png`),
    });

    await closePanel(page, panelId);
  }

    });
}

// toggle / outside
{
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await prepareDashboard(page, base);
  await openPanel(page, "catalog");
  await closePanel(page, "catalog");
  const closed = await page.evaluate(
    () => document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden")
  );
  cases.push({
    caseId: "toggle-close",
    pass: closed,
    label: "再クリックで閉じる",
    actual: closed ? "hidden" : "open",
    expected: "hidden",
  });

  await openPanel(page, "catalog");
  await page.click("body", { position: { x: 4, y: 4 } });
  await page.waitForTimeout(200);
  const outsideClosed = await page.evaluate(
    () => document.querySelector("[data-mega-menu-panel]")?.hasAttribute("hidden")
  );
  cases.push({
    caseId: "outside-close",
    pass: outsideClosed,
    label: "外側クリックで閉じる",
    actual: outsideClosed ? "hidden" : "open",
    expected: "hidden",
  });
    });
}

// anpi link
{
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await prepareDashboard(page, base);
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
    page.click(".dash-quick-menu__item--anpi"),
  ]);
  cases.push({
    caseId: "anpi-link",
    pass: page.url().includes("anpi-dashboard.html") && (response?.status?.() || 200) !== 404,
    label: "安否 → anpi-dashboard.html",
    actual: page.url(),
    expected: "anpi-dashboard.html",
  });
    });
}

const failCount = cases.filter((c) => !c.pass).length;
const passCount = cases.length - failCount;
const allPass = failCount === 0;
const capturedAt = new Date().toISOString();

const indexReport = {
  generatedAt: capturedAt,
  folderId: FOLDER_ID,
  title: REVIEW_TITLE,
  overall: allPass ? "PASS" : "FAIL",
  allPass,
  summary: { overall: allPass ? "PASS" : "FAIL", failCount, passCount, minorCount: 0, total: cases.length },
  cases,
  screenshotCatalog: [
    { file: "menu-bar-1280.png", label: "PC メニューバー", url: "dashboard.html" },
    { file: "catalog-open-1280.png", label: "PC サービス一覧展開", url: "dashboard.html" },
    { file: "menu-bar-390.png", label: "SP メニューバー", url: "dashboard.html" },
    { file: "catalog-open-390.png", label: "SP サービス一覧展開", url: "dashboard.html" },
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
