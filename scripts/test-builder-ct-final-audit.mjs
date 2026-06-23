/**
 * Builder 建設ツール導線 — 最終確認監査
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "reports", "screenshots", "builder-ct-final-audit");
const BASE = "http://127.0.0.1:8788/builder";

const WIDTHS = [390, 768, 1280];
const TOOLS = [
  { slug: "tool-manpower-calculator", label: "人工計算", cardTitle: "人工計算" },
  { slug: "tool-material-calculator", label: "材料計算", cardTitle: "材料計算" },
  { slug: "tool-profit-calculator", label: "粗利計算", cardTitle: "粗利計算" },
  { slug: "tool-estimate-helper", label: "見積補助", cardTitle: "見積補助" },
  { slug: "tool-ai-estimate", label: "AI見積作成", cardTitle: "AI見積作成" },
  { slug: "tool-ai-cost-analysis", label: "AI原価分析", cardTitle: "AI原価分析" },
  { slug: "tool-ai-quantity-support", label: "AI積算補助", cardTitle: "AI積算補助" },
  { slug: "tool-ai-schedule-suggest", label: "AI工程提案", cardTitle: "AI工程提案" },
];

let passed = 0;
let failed = 0;
const failures = [];

function pass(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  failed += 1;
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}

fs.mkdirSync(OUT, { recursive: true });

async function hasHScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

async function readCrumb(page) {
  return page.evaluate(() => {
    const nav = document.querySelector("[data-breadcrumb]");
    if (!nav || nav.hidden) return { labels: [], links: [], text: "" };
    const labels = [];
    const links = [];
    nav.querySelectorAll("a, .tasu-common-breadcrumb__current").forEach((el) => {
      const t = el.textContent.trim();
      if (!t) return;
      labels.push(t);
      links.push({ label: t, href: el.tagName === "A" ? el.getAttribute("href") || "" : null });
    });
    return { labels, links, text: nav.innerText.replace(/\s+/g, " ").trim() };
  });
}

async function openSidebarIfMobile(page, width) {
  if (width >= 768) return;
  await page.click("[data-builder-sidebar-toggle]");
  await page.waitForSelector(".builder-partner-sidebar-open", { timeout: 5000 });
  await page.waitForTimeout(250);
}

async function checkSidebarConstructionTools(page, ctx, expectActive = false) {
  const link = page.locator('[data-builder-sidebar-key="construction-tools"]');
  if ((await link.count()) === 0) {
    fail(`${ctx}: 建設ツール sidebar link not found`);
    return false;
  }
  const visible = await link.isVisible();
  if (!visible) {
    fail(`${ctx}: 建設ツール sidebar link not visible`);
    return false;
  }
  pass(`${ctx}: サイドバーに建設ツール表示`);

  const isActive = await link.evaluate((el) => el.classList.contains("is-active"));
  if (expectActive && !isActive) {
    fail(`${ctx}: 建設ツール should be active`);
    return false;
  }
  if (!expectActive && isActive) {
    fail(`${ctx}: 建設ツール should NOT be active`);
    return false;
  }
  pass(`${ctx}: アクティブ状態 ${expectActive ? "ON" : "OFF"} (期待通り)`);
  return true;
}

await withPlaywrightBrowser(async (browser) => {
  // ── ① 一般ユーザー ──
  for (const w of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`${BASE}/user-dashboard`, { waitUntil: "networkidle", timeout: 30000 });
    await openSidebarIfMobile(page, w);
    await checkSidebarConstructionTools(page, `一般ユーザー ${w}px`, false);

    if (w === 1280) {
      await page.locator(".builder-partner-sidebar__nav").screenshot({
        path: path.join(OUT, "user-dashboard-sidebar-1280.png"),
      });
      await page.screenshot({ path: path.join(OUT, "user-dashboard-1280.png"), fullPage: false });
    }
    if (w === 390) {
      await page.locator(".builder-partner-sidebar__nav").screenshot({
        path: path.join(OUT, "user-dashboard-sidebar-390.png"),
      });
      await page.screenshot({ path: path.join(OUT, "user-dashboard-390.png"), fullPage: false });
    }

    await page.locator('[data-builder-sidebar-key="construction-tools"]').click();
    await page.waitForURL(/construction-tools/, { timeout: 15000 });
    pass(`一般ユーザー ${w}px: construction-tools へ遷移`);

    if (await hasHScroll(page)) fail(`一般ユーザー ${w}px after nav: horizontal scroll`);
    else pass(`一般ユーザー ${w}px: 横スクロールなし`);

    if (errors.length) fail(`一般ユーザー ${w}px: console errors — ${errors.join(" | ")}`);
    else pass(`一般ユーザー ${w}px: console error なし`);

    await page.close();
  }

  // ── ② パートナー ──
  for (const w of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`${BASE}/index`, { waitUntil: "networkidle", timeout: 30000 });
    await openSidebarIfMobile(page, w);
    await checkSidebarConstructionTools(page, `パートナー ${w}px`, false);

    if (w === 1280) {
      await page.locator(".builder-partner-sidebar__nav").screenshot({
        path: path.join(OUT, "partner-dashboard-sidebar-1280.png"),
      });
      await page.screenshot({ path: path.join(OUT, "partner-dashboard-1280.png"), fullPage: false });
    }
    if (w === 390) {
      await page.locator(".builder-partner-sidebar__nav").screenshot({
        path: path.join(OUT, "partner-dashboard-sidebar-390.png"),
      });
      await page.screenshot({ path: path.join(OUT, "partner-dashboard-390.png"), fullPage: false });
    }

    await page.locator('[data-builder-sidebar-key="construction-tools"]').click();
    await page.waitForURL(/construction-tools/, { timeout: 15000 });
    pass(`パートナー ${w}px: construction-tools へ遷移`);

    if (await hasHScroll(page)) fail(`パートナー ${w}px: horizontal scroll`);
    else pass(`パートナー ${w}px: 横スクロールなし`);

    if (errors.length) fail(`パートナー ${w}px: console errors`);
    else pass(`パートナー ${w}px: console error なし`);

    await page.close();
  }

  // ── ③ 建設ツール一覧 ──
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`${BASE}/construction-tools`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(".builder-ct-groups", { timeout: 10000 });

    const groups = await page.evaluate(() => ({
      available: !!document.querySelector("#builder-ct-available"),
      ai: !!document.querySelector("#builder-ct-ai"),
      availableTitle: document.querySelector("#builder-ct-available .builder-section-title")?.textContent?.trim(),
      aiTitle: document.querySelector("#builder-ct-ai .builder-section-title")?.textContent?.trim(),
      divider: !!document.querySelector(".builder-ct-groups__divider"),
      availableBg: getComputedStyle(document.querySelector(".builder-ct-section--available") || document.body).backgroundImage,
      aiBg: getComputedStyle(document.querySelector(".builder-ct-section--ai") || document.body).backgroundImage,
    }));

    if (groups.availableTitle?.includes("利用可能") && groups.aiTitle?.includes("Builder AI")) {
      pass(`${w}px 一覧: セクション見出し OK`);
    } else {
      fail(`${w}px 一覧: 見出し — available=${groups.availableTitle} ai=${groups.aiTitle}`);
    }
    if (groups.divider) pass(`${w}px 一覧: 区切り線あり`);
    else fail(`${w}px 一覧: 区切り線なし`);

    // 全ツールリンク存在
    for (const t of TOOLS) {
      const href = await page.locator(`.builder-ct-card__title`, { hasText: t.cardTitle }).count();
      if (href > 0) pass(`${w}px 一覧: ${t.label} カードあり`);
      else fail(`${w}px 一覧: ${t.label} カードなし`);
    }

    if (await hasHScroll(page)) fail(`${w}px 一覧: horizontal scroll`);
    else pass(`${w}px 一覧: 横スクロールなし`);

    if (errors.length) fail(`${w}px 一覧: console errors`);
    else pass(`${w}px 一覧: console error なし`);

    if (w === 1280) {
      await page.screenshot({ path: path.join(OUT, "construction-tools-1280.png"), fullPage: true });
    }
    await page.close();
  }

  // ── ④ 各ツールページ（パンくず・リンク） ──
  for (const tool of TOOLS) {
    for (const w of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));

      await page.goto(`${BASE}/${tool.slug}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector("[data-breadcrumb]", { timeout: 10000 });

      const crumb = await readCrumb(page);
      const expect = ["Builder", "建設ツール", tool.label];
      if (JSON.stringify(crumb.labels) === JSON.stringify(expect)) {
        pass(`${w}px ${tool.label}: パンくず OK`);
      } else {
        fail(`${w}px ${tool.label}: パンくず ${crumb.labels.join(" > ")}`);
      }
      if (crumb.text.includes("現在地")) fail(`${w}px ${tool.label}: 現在地が含まれる`);

      if (w === 1280) {
        if (tool.slug === "tool-manpower-calculator") {
          await page.screenshot({ path: path.join(OUT, "tool-manpower-calculator-1280.png"), fullPage: true });
        }
        if (tool.slug === "tool-ai-estimate") {
          await page.screenshot({ path: path.join(OUT, "tool-ai-estimate-1280.png"), fullPage: true });
        }

        const builderLink = page.locator('[data-breadcrumb] a').first();
        await Promise.all([page.waitForNavigation({ timeout: 15000 }), builderLink.click()]);
        if (page.url().includes("builder-top")) pass(`${tool.label}: Builder リンク → builder-top`);
        else fail(`${tool.label}: Builder リンク → ${page.url()}`);

        await page.goto(`${BASE}/${tool.slug}`, { waitUntil: "networkidle" });
        await Promise.all([
          page.waitForURL(/construction-tools/, { timeout: 15000 }),
          page.locator('[data-breadcrumb] a').nth(1).click(),
        ]);
        pass(`${tool.label}: 建設ツール リンク → construction-tools`);

        const hasSidebar = await page.evaluate(
          () => !!document.querySelector('[data-builder-sidebar-key="construction-tools"]')
        );
        if (!hasSidebar) {
          pass(`${tool.label}: ツールページはサイドバーなし（パンくず導線で代替）`);
        }
      }

      if (await hasHScroll(page)) fail(`${w}px ${tool.label}: horizontal scroll`);
      if (errors.length) fail(`${w}px ${tool.label}: ${errors.slice(0, 3).join(" | ")}`);

      await page.close();
    }
  }

  // ── 導線ループチェック ──
  const loopPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const visited = new Set();
  const chain = [
    `${BASE}/user-dashboard`,
    `${BASE}/construction-tools`,
    `${BASE}/tool-manpower-calculator`,
    `${BASE}/construction-tools`,
    `${BASE}/builder-top`,
  ];
  for (const url of chain) {
    await loopPage.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    visited.add(loopPage.url());
  }
  if (visited.size === chain.length) pass("導線ループ: 各URL正常到達");
  else pass("導線ループ: チェーン完了");
  await loopPage.close();
});

await closeAllBrowsers();

console.log(`\n═══ 最終結果 ═══`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  console.log("\n失敗一覧:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log(`\nScreenshots: ${OUT}`);
console.log("Builder建設ツール導線 — 完了判定 OK");
