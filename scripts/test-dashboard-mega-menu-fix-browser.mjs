/**
 * ダッシュボード メガメニュー修正 — 4カード・3パネル検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-mega-menu-fix";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード メガメニュー修正レビュー";
const BUILD = "2026-06-15-mega-fix";
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

async function openMegaPanel(page, panelId) {
  await page.evaluate((id) => {
    document.querySelector(`[data-dash-mega-toggle="${id}"]`)?.click();
  }, panelId);
  await page.waitForSelector("[data-dash-service-mega].is-open", { timeout: 5000, state: "attached" });
}

async function closeMegaPanel(page, panelId) {
  await page.evaluate((id) => {
    document.querySelector(`[data-dash-mega-toggle="${id}"]`)?.click();
  }, panelId);
  await page.waitForFunction(
    () => !document.querySelector("[data-dash-service-mega]")?.classList.contains("is-open"),
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

// --- 4 cards PC ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  const cards = await page.evaluate(() => ({
    build: window.TasuDashboardShell?.DASHBOARD_JS_BUILD || null,
    toggleCount: document.querySelectorAll("[data-dash-mega-toggle]").length,
    anpiHref: document.querySelector(".dash-quick-card--anpi-hub")?.getAttribute("href") || "",
    cardCount: document.querySelectorAll("[data-dash-quick] .dash-quick-card").length,
  }));

  cases.push({
    caseId: "js-build",
    pass: cards.build === BUILD,
    label: "dashboard.js ビルド",
    actual: cards.build || "—",
    expected: BUILD,
  });

  cases.push({
    caseId: "pc-four-cards",
    pass: errors.length === 0 && cards.cardCount === 4 && cards.toggleCount === 3,
    label: "PC 4カード表示",
    actual: `cards=${cards.cardCount}, toggles=${cards.toggleCount}, errors=${errors.length}`,
    expected: "4カード / console error 0",
  });

  cases.push({
    caseId: "anpi-link",
    pass: cards.anpiHref === "anpi-dashboard.html",
    label: "安否カード遷移先",
    actual: cards.anpiHref || "—",
    expected: "anpi-dashboard.html",
  });

  await page.locator("[data-dash-quick]").screenshot({ path: path.join(OUT_DIR, "quick-cards-1280.png") });
  await browser.close();
}

// --- catalog mega PC ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);
  await openMegaPanel(page, "catalog");
  await page.waitForFunction(
    () => {
      const panel = document.querySelector("[data-dash-service-mega].is-open");
      if (!panel) return false;
      const cs = getComputedStyle(panel);
      return cs.visibility === "visible" && cs.opacity === "1";
    },
    { timeout: 3000 }
  );

  const pc = await page.evaluate(() => {
    const panel = document.querySelector("[data-dash-service-mega]");
    const cs = panel ? getComputedStyle(panel) : null;
    const r = panel?.getBoundingClientRect();
    const toggle = document.querySelector('[data-dash-mega-toggle="catalog"]');
    const tr = toggle?.getBoundingClientRect();
    return {
      position: cs?.position || "",
      opacity: cs?.opacity || "",
      visibility: cs?.visibility || "",
      width: r ? Math.round(r.width) : 0,
      leftOfToggle: r && tr ? r.left >= tr.right - 20 : false,
      inViewport: r ? r.top >= 0 && r.bottom <= window.innerHeight + 1 : false,
      linkCount: document.querySelectorAll("[data-dash-service-mega] .dash-service-mega__link").length,
      hostInApp: Boolean(document.querySelector("[data-dash-service-mega-host]")),
    };
  });

  cases.push({
    caseId: "pc-catalog-mega",
    pass:
      errors.length === 0 &&
      pc.position === "fixed" &&
      pc.opacity === "1" &&
      pc.visibility === "visible" &&
      pc.width >= 720 &&
      pc.width <= 900 &&
      pc.inViewport &&
      pc.linkCount === 8 &&
      pc.hostInApp,
    label: "PC サービス一覧メガメニュー",
    actual: `pos=${pc.position}, w=${pc.width}px, links=${pc.linkCount}, vis=${pc.visibility}, inView=${pc.inViewport}`,
    expected: "fixed / 720-900px / 右展開 / 8リンク",
  });

  await page.locator("[data-dash-service-mega].is-open").screenshot({
    path: path.join(OUT_DIR, "catalog-mega-1280.png"),
  });
  await browser.close();
}

// --- publish / comms PC ---
for (const [panelId, label] of [
  ["publish", "掲載・出品"],
  ["comms", "やりとり"],
]) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);
  await openMegaPanel(page, panelId);

  const info = await page.evaluate((id) => {
    const panel = document.querySelector("[data-dash-service-mega]");
    const cs = panel ? getComputedStyle(panel) : null;
    return {
      open: panel?.classList.contains("is-open"),
      position: cs?.position || "",
      linkCount: document.querySelectorAll("[data-dash-service-mega] .dash-service-mega__link").length,
    };
  }, panelId);

  const expectedLinks = PANEL_LINKS[panelId].length;
  cases.push({
    caseId: `pc-${panelId}-menu`,
    pass: errors.length === 0 && info.open && info.position === "fixed" && info.linkCount === expectedLinks,
    label: `PC ${label}メニュー`,
    actual: `links=${info.linkCount}, pos=${info.position}`,
    expected: `${expectedLinks}リンク / fixed`,
  });

  await page.locator("[data-dash-service-mega].is-open").screenshot({
    path: path.join(OUT_DIR, `${panelId}-menu-1280.png`),
  });
  await browser.close();
}

// --- SP ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDashboard(page, base);

  const spCards = await page.evaluate(() => ({
    cardCount: document.querySelectorAll("[data-dash-quick] .dash-quick-card").length,
    quickVisible: (() => {
      const el = document.querySelector("[data-dash-quick]");
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    })(),
  }));

  cases.push({
    caseId: "sp-four-cards",
    pass: errors.length === 0 && spCards.cardCount === 4 && spCards.quickVisible,
    label: "SP 4カード表示 (390px)",
    actual: `cards=${spCards.cardCount}, visible=${spCards.quickVisible}, errors=${errors.length}`,
    expected: "4カード",
  });

  await page.locator("[data-dash-quick]").scrollIntoViewIfNeeded();
  await page.locator("[data-dash-quick]").screenshot({ path: path.join(OUT_DIR, "quick-cards-390.png") });

  for (const panelId of ["catalog", "publish", "comms"]) {
    await openMegaPanel(page, panelId);
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
      caseId: `sp-${panelId}-sheet`,
      pass: sp.position === "fixed" && sp.bottomNearViewport && sp.linkCount === PANEL_LINKS[panelId].length,
      label: `SP ${panelId} Bottom Sheet`,
      actual: `pos=${sp.position}, links=${sp.linkCount}`,
      expected: "fixed / 下から表示",
    });

    await page.locator("[data-dash-service-mega].is-open").screenshot({
      path: path.join(OUT_DIR, `${panelId}-menu-390.png`),
    });
    await closeMegaPanel(page, panelId);
  }

  await browser.close();
}

// --- toggle / outside click ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await prepareDashboard(page, base);
  await openMegaPanel(page, "catalog");
  await closeMegaPanel(page, "catalog");
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

  await openMegaPanel(page, "catalog");
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

// --- link navigation ---
for (const [panelId, links] of Object.entries(PANEL_LINKS)) {
  for (const link of links) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await prepareDashboard(page, base);
    await openMegaPanel(page, panelId);

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
      caseId: `link-${panelId}-${link.href.replace(/[^a-z0-9]+/gi, "-")}`,
      pass: href === link.href && navOk,
      label: `${link.label} → ${link.href}`,
      actual: `href=${href || "—"}`,
      expected: link.href,
    });
    await browser.close();
  }
}

// --- anpi navigation ---
{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await prepareDashboard(page, base);
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
    page.click(".dash-quick-card--anpi-hub"),
  ]);
  const status = response?.status?.() || 0;
  const pathOk = page.url().includes("anpi-dashboard.html");
  cases.push({
    caseId: "link-anpi-dashboard",
    pass: pathOk && status !== 404,
    label: "安否 → anpi-dashboard.html",
    actual: page.url(),
    expected: "anpi-dashboard.html",
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
    { file: "quick-cards-1280.png", label: "PC 1280px 4カード", url: "dashboard.html" },
    { file: "catalog-mega-1280.png", label: "PC サービス一覧メガメニュー", url: "dashboard.html" },
    { file: "publish-menu-1280.png", label: "PC 掲載・出品メニュー", url: "dashboard.html" },
    { file: "comms-menu-1280.png", label: "PC やりとりメニュー", url: "dashboard.html" },
    { file: "quick-cards-390.png", label: "SP 390px 4カード", url: "dashboard.html" },
    { file: "catalog-menu-390.png", label: "SP サービス一覧", url: "dashboard.html" },
    { file: "publish-menu-390.png", label: "SP 掲載・出品", url: "dashboard.html" },
    { file: "comms-menu-390.png", label: "SP やりとり", url: "dashboard.html" },
  ],
  base,
};

await writeFile(
  path.join(OUT_DIR, "review-report.json"),
  JSON.stringify({ results: cases, failed: failCount, total: cases.length, passed: passCount }, null, 2)
);
await writeFile(
  path.join(OUT_DIR, "review-report.md"),
  [`# ${REVIEW_TITLE}`, "", `総合: **${allPass ? "PASS" : "FAIL"}** (${passCount}/${cases.length})`, "", ...cases.map((c) => `- [${c.pass ? "OK" : "NG"}] ${c.label}`)].join(
    "\n"
  )
);

await finalizeScreenshotRun(ROOT, FOLDER_ID, { title: REVIEW_TITLE, report: indexReport, targetPage: "dashboard.html", viewports: ["390", "1280"] });
console.log(`\n${REVIEW_TITLE}: ${allPass ? "PASS" : "FAIL"} (${passCount}/${cases.length})`);
console.log(`Screenshots: screenshots/${FOLDER_ID}/`);
if (!allPass) {
  cases.filter((c) => !c.pass).forEach((c) => console.log(`  FAIL: ${c.label} — ${c.actual}`));
  process.exit(1);
}
