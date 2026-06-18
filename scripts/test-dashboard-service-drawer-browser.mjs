/**
 * ダッシュボード サービスメガメニュー — 開閉・リンク検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-service-drawer";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード サービスメガメニューレビュー";
const BUILD = "2026-06-15-service-mega";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const MEGA_LINKS = [
  { label: "業務サービス", href: "business.html" },
  { label: "スキル", href: "index.html?category=skill" },
  { label: "ワーカー", href: "index.html?category=worker" },
  { label: "商品掲載", href: "index.html?category=product" },
  { label: "TASFUL市場", href: "shop-store.html" },
  { label: "店舗・専門店", href: "shop-vendors.html" },
  { label: "求人", href: "job-top.html" },
  { label: "案件・求人ボード", href: "public-board.html" },
  { label: "業務サービス掲載", href: "post.html?scope=business" },
  { label: "スキル掲載", href: "post.html" },
  { label: "市場出品", href: "shop-market-listing-new.html" },
  { label: "掲載管理", href: "listing-management.html" },
  { label: "TALK", href: "talk-home.html" },
  { label: "すべてのやりとり", href: "chat-list.html" },
  { label: "AI相談", href: "ai-workspace.html" },
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

async function prepareDashboard(page, base, opts = {}) {
  const { keepMobileShell = false } = opts;
  await fixCssMime(page);
  await page.goto(`${base}/dashboard.html?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });
  if (!keepMobileShell) {
    await page.evaluate(() => {
      document.body?.classList.remove("tasu-app-mobile-page");
    });
    await page.addStyleTag({
      content: `
        body[data-page="dashboard"] .dash-grid { display: grid !important; }
        body[data-page="dashboard"] .tasu-mobile-home { display: none !important; }
        body[data-page="dashboard"] [data-dash-quick] { display: grid !important; }
      `,
    });
  }
  await page.waitForSelector("[data-dash-mega-toggle]", { timeout: 20000, state: "attached" });
}

async function openMegaMenu(page) {
  await page.evaluate(() => {
    document.querySelector("[data-dash-mega-toggle]")?.click();
  });
  await page.waitForSelector("[data-dash-service-mega].is-open", { timeout: 5000, state: "attached" });
}

async function closeMegaMenu(page) {
  await page.evaluate(() => {
    document.querySelector("[data-dash-mega-toggle]")?.click();
  });
  await page.waitForFunction(
    () => !document.querySelector("[data-dash-service-mega]")?.classList.contains("is-open"),
    { timeout: 5000 }
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
const cases = [];

// --- PC mega menu ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await prepareDashboard(page, base);
  await openMegaMenu(page);

  const pc = await page.evaluate(() => {
    const panel = document.querySelector("[data-dash-service-mega]");
    const cs = panel ? getComputedStyle(panel) : null;
    const r = panel?.getBoundingClientRect();
    const toggle = document.querySelector("[data-dash-mega-toggle]");
    const tr = toggle?.getBoundingClientRect();
    return {
      build: window.TasuDashboardShell?.DASHBOARD_JS_BUILD || null,
      position: cs?.position || "",
      width: r ? Math.round(r.width) : 0,
      leftOfToggle: r && tr ? r.left > tr.right - 4 : false,
      linkCount: document.querySelectorAll("[data-dash-service-mega] .dash-service-mega__link").length,
      hasOverlay: Boolean(document.querySelector("[data-dash-svc-drawer]")),
      columnCount: document.querySelectorAll("[data-dash-service-mega] .dash-service-mega__col").length,
    };
  });

  cases.push({
    caseId: "js-build",
    pass: pc.build === BUILD,
    label: "dashboard.js ビルド",
    actual: pc.build || "—",
    expected: BUILD,
  });

  cases.push({
    caseId: "pc-mega-layout",
    pass:
      errors.length === 0 &&
      pc.position === "absolute" &&
      pc.width >= 720 &&
      pc.width <= 900 &&
      pc.leftOfToggle &&
      pc.linkCount === 15 &&
      pc.columnCount === 3 &&
      !pc.hasOverlay,
    label: "PCメガメニュー（横展開・3カラム）",
    actual: `pos=${pc.position}, w=${pc.width}px, links=${pc.linkCount}, overlay=${pc.hasOverlay}`,
    expected: "absolute / 720-900px / 右展開 / オーバーレイなし",
  });

  await page.locator("[data-dash-service-mega].is-open").screenshot({
    path: path.join(OUT_DIR, "mega-menu-1280.png"),
  });
  await browser.close();
}

// --- SP bottom sheet ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await prepareDashboard(page, base);
  await openMegaMenu(page);

  const sp = await page.evaluate(() => {
    const panel = document.querySelector("[data-dash-service-mega]");
    const cs = panel ? getComputedStyle(panel) : null;
    const r = panel?.getBoundingClientRect();
    return {
      position: cs?.position || "",
      bottomNearViewport: r ? r.bottom >= window.innerHeight - 24 : false,
      linkCount: document.querySelectorAll("[data-dash-service-mega] .dash-service-mega__link").length,
    };
  });

  cases.push({
    caseId: "sp-bottom-sheet",
    pass: sp.position === "fixed" && sp.bottomNearViewport && sp.linkCount === 15,
    label: "SP Bottom Sheet",
    actual: `pos=${sp.position}, links=${sp.linkCount}`,
    expected: "fixed / 下から表示",
  });

  await page.locator("[data-dash-service-mega].is-open").screenshot({
    path: path.join(OUT_DIR, "mega-menu-390.png"),
  });
  await browser.close();
}

// --- toggle / outside click ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await prepareDashboard(page, base);
  await openMegaMenu(page);
  await closeMegaMenu(page);
  const closed = await page.evaluate(
    () => !document.querySelector("[data-dash-service-mega]")?.classList.contains("is-open")
  );
  cases.push({
    caseId: "toggle-close",
    pass: closed,
    label: "再クリックで閉じる",
    actual: closed ? "閉じた" : "開いたまま",
    expected: "閉じる",
  });

  await openMegaMenu(page);
  await page.click("body", { position: { x: 8, y: 8 } });
  await page.waitForTimeout(300);
  const outsideClosed = await page.evaluate(
    () => !document.querySelector("[data-dash-service-mega]")?.classList.contains("is-open")
  );
  cases.push({
    caseId: "outside-close",
    pass: outsideClosed,
    label: "外側クリックで閉じる",
    actual: outsideClosed ? "閉じた" : "開いたまま",
    expected: "閉じる",
  });
  await browser.close();
}

// --- all mega links ---
for (const link of MEGA_LINKS) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await prepareDashboard(page, base);
  await openMegaMenu(page);

  const href = await page.evaluate((label) => {
    const a = [...document.querySelectorAll("[data-dash-service-mega] .dash-service-mega__link")].find(
      (el) => el.querySelector(".dash-service-mega__link-label")?.textContent?.trim() === label
    );
    return a?.getAttribute("href") || "";
  }, link.label);

  let navOk = false;
  if (href === link.href) {
    const locator = page.locator("[data-dash-service-mega] .dash-service-mega__link", { hasText: link.label });
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
      locator.first().click(),
    ]);
    const status = response?.status?.() || 0;
    navOk = status !== 404;
  }

  cases.push({
    caseId: `link-${link.href.replace(/[^a-z0-9]+/gi, "-")}`,
    pass: href === link.href && navOk,
    label: `${link.label} → ${link.href}`,
    actual: `href=${href || "—"}`,
    expected: link.href,
  });
  await browser.close();
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
    { file: "mega-menu-1280.png", label: "PC 1280px メガメニュー", url: "dashboard.html" },
    { file: "mega-menu-390.png", label: "SP 390px Bottom Sheet", url: "dashboard.html" },
  ],
  base,
};

await writeFile(
  path.join(OUT_DIR, "review-report.json"),
  JSON.stringify({ results: cases, failed: failCount, total: cases.length, passed: passCount }, null, 2)
);
await writeFile(
  path.join(OUT_DIR, "review-report.md"),
  [`# ${REVIEW_TITLE}`, "", `総合: **${allPass ? "PASS" : "FAIL"}**`, "", ...cases.map((c) => `- [${c.pass ? "OK" : "NG"}] ${c.label}`)].join(
    "\n"
  )
);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: REVIEW_TITLE,
  report: indexReport,
  targetPage: "dashboard.html",
  viewports: ["390", "1280"],
});

console.log(JSON.stringify({ overall: indexReport.overall, passCount, failCount, base }, null, 2));
if (!allPass) process.exit(1);
