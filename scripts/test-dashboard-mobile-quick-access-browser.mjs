/**
 * ダッシュボード スマホ クイックアクセス v2 検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "dashboard-mobile-quick-access-v2";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const REVIEW_TITLE = "ダッシュボード スマホ クイックアクセス v2";
const PORTS = [5173, 5176, 5174, 5199, 5200, 5188, 5502, 5500];

const CARD_LABELS = ["探す", "掲載する", "やりとり", "安否"];
const CARD_SUBS = ["サービス・求人", "出品・掲載", "TALK・AI", "確認・通知"];

const SHEETS = {
  explore: {
    title: "探す",
    description: "サービス・求人・市場",
    labels: [
      "業務サービス",
      "スキル",
      "ワーカー",
      "商品",
      "TASFUL市場",
      "店舗・専門店",
      "求人",
      "案件・求人ボード",
    ],
  },
  publish: {
    title: "掲載する",
    description: "サービス掲載・出品管理",
    labels: ["掲載管理", "業務サービス掲載", "スキル掲載", "市場出品"],
  },
  comms: {
    title: "やりとり",
    description: "TALK・チャット・AI",
    labels: ["TASFUL TALK", "すべてのやりとり", "AI相談"],
  },
  anpi: {
    title: "安否",
    description: "安否確認・通知管理",
    labels: ["安否ダッシュボード", "安否サービス登録", "安否通知センター"],
  },
};

const HOME_SECTIONS = ["最近のやりとり", "おすすめ案件", "おすすめ求人", "おすすめサービス"];

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

function collectPageErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}

async function prepareMobileDashboard(page, base) {
  await fixCssMime(page);
  await page.goto(`${base}/dashboard.html?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body.classList.add("tasu-app-mobile-page");
  });
  await page.waitForSelector("[data-mobile-quick-sheet]", { timeout: 20000, state: "visible" });
}

async function prepareDesktopDashboard(page, base) {
  await fixCssMime(page);
  await page.goto(`${base}/dashboard.html?v=${Date.now()}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => document.body.classList.remove("tasu-app-mobile-page"));
  await page.waitForSelector("[data-sidebar-mega-trigger]", { timeout: 20000, state: "attached" });
}

function assert(condition, message) {
  return { ok: !!condition, message };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findBaseUrl();
const cases = [];
const allErrors = [];

{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareMobileDashboard(page, base);

  const layout = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-mobile-quick-sheet]")];
    const grid = document.querySelector(".tasu-mobile-quick__grid");
    const cs = grid ? getComputedStyle(grid) : null;
    const cardCs = cards[0] ? getComputedStyle(cards[0]) : null;
    const sectionTitles = [...document.querySelectorAll(".tasu-mobile-home__section-title")].map((el) =>
      el.textContent.trim()
    );
    return {
      cardCount: cards.length,
      gridCols: cs?.gridTemplateColumns || "",
      cardMinHeight: cardCs ? parseFloat(cardCs.minHeight) : 0,
      cardLabels: cards.map((c) => c.querySelector(".tasu-mobile-quick__label")?.textContent?.trim()),
      cardSubs: cards.map((c) => c.querySelector(".tasu-mobile-quick__sub")?.textContent?.trim()),
      sectionTitles,
    };
  });

  cases.push({
    id: "mobile-quick-grid",
    ...assert(layout.cardCount === 4, `4 cards (got ${layout.cardCount})`),
  });
  cases.push({
    id: "mobile-grid-2col",
    ...assert(layout.gridCols.includes(" ") && !layout.gridCols.includes("repeat(3"), "2-column grid"),
  });
  cases.push({
    id: "mobile-card-height",
    ...assert(layout.cardMinHeight >= 72, `card min-height ${layout.cardMinHeight}px`),
  });
  cases.push({
    id: "mobile-card-labels",
    ...assert(layout.cardLabels.join("|") === CARD_LABELS.join("|"), `labels: ${layout.cardLabels.join(", ")}`),
  });
  cases.push({
    id: "mobile-card-subs",
    ...assert(layout.cardSubs.join("|") === CARD_SUBS.join("|"), `subs: ${layout.cardSubs.join(", ")}`),
  });

  for (const title of HOME_SECTIONS) {
    cases.push({
      id: `home-section-${title}`,
      ...assert(layout.sectionTitles.includes(title), `section "${title}" present`),
    });
  }

  await page.screenshot({ path: path.join(OUT_DIR, "quick-access-390.png"), fullPage: true });

  for (const [sheetId, expected] of Object.entries(SHEETS)) {
    await page.click(`[data-mobile-quick-sheet="${sheetId}"]`);
    await page.waitForSelector(".tasu-mobile-sheet.is-open", { timeout: 5000 });
    const sheet = await page.evaluate(() => {
      const root = document.querySelector("[data-tasu-mobile-sheet]");
      const title = root?.querySelector("[data-tasu-mobile-sheet-title]")?.textContent?.trim();
      const desc = root?.querySelector("[data-tasu-mobile-sheet-desc]")?.textContent?.trim();
      const cards = [...root.querySelectorAll(".tasu-mobile-sheet__card")];
      const cardCs = cards[0] ? getComputedStyle(cards[0]) : null;
      return {
        open: root?.classList.contains("is-open"),
        title,
        desc,
        cardCount: cards.length,
        cardMinHeight: cardCs ? parseFloat(cardCs.minHeight) : 0,
        cardBorderRadius: cardCs ? parseFloat(cardCs.borderRadius) : 0,
        links: cards.map((a) => ({
          label: a.querySelector(".tasu-mobile-sheet__card-title")?.textContent?.trim(),
          hint: a.querySelector(".tasu-mobile-sheet__card-hint")?.textContent?.trim(),
          href: a.getAttribute("href"),
          hasIcon: !!a.querySelector(".tasu-mobile-sheet__card-icon"),
          hasChevron: !!a.querySelector(".tasu-mobile-sheet__card-chevron"),
        })),
      };
    });

    cases.push({ id: `sheet-open-${sheetId}`, ...assert(sheet.open, `${sheetId} sheet opens`) });
    cases.push({
      id: `sheet-title-${sheetId}`,
      ...assert(sheet.title === expected.title, `${sheetId} title: ${sheet.title}`),
    });
    cases.push({
      id: `sheet-desc-${sheetId}`,
      ...assert(sheet.desc === expected.description, `${sheetId} desc: ${sheet.desc}`),
    });
    cases.push({
      id: `sheet-links-${sheetId}`,
      ...assert(
        expected.labels.every((l, i) => sheet.links[i]?.label === l),
        `${sheetId} links: ${sheet.links.map((l) => l.label).join(", ")}`
      ),
    });
    cases.push({
      id: `sheet-hints-${sheetId}`,
      ...assert(sheet.links.every((l) => l.hint), `${sheetId} hints present`),
    });
    cases.push({
      id: `sheet-hrefs-${sheetId}`,
      ...assert(sheet.links.every((l) => l.href && l.href !== "#"), `${sheetId} hrefs present`),
    });
    cases.push({
      id: `sheet-card-style-${sheetId}`,
      ...assert(
        sheet.cardCount === expected.labels.length &&
          sheet.links.every((l) => l.hasIcon && l.hasChevron) &&
          sheet.cardMinHeight >= 56 &&
          sheet.cardMinHeight <= 64 &&
          sheet.cardBorderRadius >= 12,
        `${sheetId} card style (${sheet.cardCount} cards, min-h ${sheet.cardMinHeight}px)`
      ),
    });

    await page.screenshot({
      path: path.join(OUT_DIR, `sheet-${sheetId}-390.png`),
      fullPage: false,
    });
    await page.click(".tasu-mobile-sheet__close");
    await page.waitForFunction(() => !document.querySelector(".tasu-mobile-sheet.is-open"), { timeout: 5000 });
  }

  const badgeCheck = await page.evaluate(() => {
    window.TasuDashboardMobileHome.renderMobileHome(
      {
        profile: { welcomeName: "テスト会員" },
        stats: { ongoing: 1 },
        unreadMessages: 12,
        threads: [],
        ongoingRows: [],
        favorites: [],
      },
      5
    );
    const commsCard = document.querySelector('[data-mobile-quick-sheet="comms"]');
    const exploreCard = document.querySelector('[data-mobile-quick-sheet="explore"]');
    const commsBadge = commsCard?.querySelector(".tasu-mobile-quick__badge")?.textContent?.trim();
    const exploreBadge = exploreCard?.querySelector(".tasu-mobile-quick__badge");
    return { commsBadge, exploreHasBadge: !!exploreBadge };
  });

  cases.push({
    id: "badge-comms-visible",
    ...assert(badgeCheck.commsBadge === "17", `comms badge shows count (${badgeCheck.commsBadge})`),
  });
  cases.push({
    id: "badge-zero-hidden",
    ...assert(!badgeCheck.exploreHasBadge, "explore card hides badge when zero"),
  });

  allErrors.push(...errors);
  await browser.close();
}

{
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  collectPageErrors(page, errors);
  await prepareDesktopDashboard(page, base);

  const desktop = await page.evaluate(() => ({
    quickDisplay: document.querySelector(".tasu-mobile-quick")
      ? getComputedStyle(document.querySelector(".tasu-mobile-quick")).display
      : "none",
    mobileHomeHidden: document.querySelector("[data-tasu-mobile-home]")?.classList.contains("tasu-mobile-home--hidden"),
    sidebarTriggers: document.querySelectorAll("[data-sidebar-mega-trigger]").length,
  }));

  cases.push({
    id: "desktop-no-quick",
    ...assert(desktop.mobileHomeHidden || desktop.quickDisplay === "none", "PC: quick access hidden"),
  });
  cases.push({
    id: "desktop-sidebar-mega",
    ...assert(desktop.sidebarTriggers >= 4, `PC: sidebar mega triggers (${desktop.sidebarTriggers})`),
  });

  await page.screenshot({ path: path.join(OUT_DIR, "dashboard-1280.png"), fullPage: true });
  allErrors.push(...errors);
  await browser.close();
}

const passCount = cases.filter((c) => c.ok).length;
const failCount = cases.length - passCount;
const report = {
  title: REVIEW_TITLE,
  folder: FOLDER_ID,
  pass: passCount,
  fail: failCount,
  consoleErrors: allErrors.length,
  cases,
  errors: allErrors,
};

await writeFile(path.join(OUT_DIR, "review-report.json"), JSON.stringify(report, null, 2));
await writeFile(
  path.join(OUT_DIR, "review-report.md"),
  [
    `# ${REVIEW_TITLE}`,
    "",
    `- PASS: ${passCount}/${cases.length}`,
    `- Console errors: ${allErrors.length}`,
    "",
    "## Cases",
    ...cases.map((c) => `- [${c.ok ? "x" : " "}] ${c.id}: ${c.message}`),
    "",
    allErrors.length ? "## Console errors\n" + allErrors.map((e) => `- ${e}`).join("\n") : "",
  ].join("\n")
);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: REVIEW_TITLE,
  cases,
  targetPage: "dashboard.html",
  viewports: ["390", "1280"],
  overall: failCount > 0 || allErrors.length > 0 ? "FAIL" : "PASS",
  screenshotCatalog: [
    { file: "quick-access-390.png", label: "SP クイックアクセス 390px", url: "dashboard.html", viewport: "390" },
    { file: "sheet-explore-390.png", label: "SP 探す Sheet", url: "dashboard.html", viewport: "390" },
    { file: "sheet-publish-390.png", label: "SP 掲載する Sheet", url: "dashboard.html", viewport: "390" },
    { file: "sheet-comms-390.png", label: "SP やりとり Sheet", url: "dashboard.html", viewport: "390" },
    { file: "sheet-anpi-390.png", label: "SP 安否 Sheet", url: "dashboard.html", viewport: "390" },
    { file: "dashboard-1280.png", label: "PC 1280px", url: "dashboard.html", viewport: "1280" },
  ],
});

console.log(`\n${REVIEW_TITLE}`);
console.log(`PASS ${passCount}/${cases.length}, console errors: ${allErrors.length}`);
cases.filter((c) => !c.ok).forEach((c) => console.log(`  FAIL ${c.id}: ${c.message}`));
if (allErrors.length) allErrors.forEach((e) => console.log(`  ERR ${e}`));

process.exit(failCount > 0 || allErrors.length > 0 ? 1 : 0);
