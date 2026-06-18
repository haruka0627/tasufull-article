#!/usr/bin/env node
/**
 * chat-list.html UI レビュー — 1280 / 390 スクリーンショット + チェック
 * node scripts/review-chat-list-ui.mjs
 */
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(root, "screenshots", "chat-list-ui-review");
const PORT = 8799;
const NAV_TIMEOUT = 25000;
const SEL_TIMEOUT = 20000;

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const pathname = decodeURIComponent(String(req.url || "/").split("?")[0]);
      const rel = pathname.replace(/^\//, "") || "index.html";
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !existsSync(file)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      createReadStream(file).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function url(rel) {
  return `http://127.0.0.1:${PORT}/${rel.replace(/^\//, "")}`;
}

/** @type {Array<Record<string, unknown>>} */
const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, ...detail });
}

async function waitListReady(page) {
  await page.waitForFunction(
    () => {
      const list = document.getElementById("chatThreadList");
      const loading = list?.querySelector(".chat-hub-loading");
      if (loading) return false;
      const empty = document.querySelector("[data-chat-hub-empty]");
      if (empty && !empty.hidden) return true;
      return Boolean(list?.querySelector(".chat-list__item[data-chat-thread-id]"));
    },
    { timeout: SEL_TIMEOUT }
  );
  await page.waitForTimeout(400);
}

async function readUiMetrics(page) {
  return page.evaluate(() => {
    const title = document.querySelector(".chat-hub-head__title")?.textContent?.trim() || "";
    const sub = document.querySelector(".chat-hub-head__sub")?.textContent?.trim() || "";
    const search = document.querySelector("[data-chat-hub-search]");
    const sort = document.querySelector("[data-chat-hub-sort]");
    const filters = [...document.querySelectorAll("[data-chat-hub-filter]")].map((b) => ({
      label: b.textContent.trim(),
      w: b.getBoundingClientRect().width,
      h: b.getBoundingClientRect().height,
    }));
    const items = [...document.querySelectorAll(".chat-list__item[data-chat-thread-id]")].map((li) => {
      const type = li.querySelector(".chat-type")?.textContent?.trim() || "";
      const unread = li.querySelector(".chat-unread")?.textContent?.trim() || "";
      const pill = li.querySelector(".chat-pill")?.textContent?.trim() || "";
      const titleEl = li.querySelector(".chat-thread__title")?.textContent?.trim() || "";
      return { type, unread, pill, title: titleEl };
    });
    const empty = document.querySelector("[data-chat-hub-empty]");
    const toolbar = document.querySelector("[data-chat-hub-toolbar]");
    const pageEl = document.querySelector(".page");
    const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
    return {
      title,
      sub,
      hasSearch: Boolean(search),
      hasSort: Boolean(sort),
      filterCount: filters.length,
      filters,
      itemCount: items.length,
      items,
      emptyVisible: empty ? !empty.hidden : false,
      emptyTitle: document.querySelector("[data-chat-hub-empty-title]")?.textContent?.trim() || "",
      toolbarBox: toolbar?.getBoundingClientRect(),
      pageBox: pageEl?.getBoundingClientRect(),
      viewportW: window.innerWidth,
      overflowX,
    };
  });
}

async function screenshot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function runViewportReview(page, viewport) {
  const tag = `${viewport.width}`;
  const casePrefix = `viewport-${tag}`;

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url("chat-list.html"), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await waitListReady(page);

  const metrics = await readUiMetrics(page);
  await screenshot(page, `chat-list-${tag}-default.png`);
  await page.locator(".chat-card--hub").screenshot({
    path: path.join(OUT_DIR, `chat-list-${tag}-card.png`),
  });

  const titleOk = metrics.title === "すべてのやりとり" && metrics.sub.includes("相談・見積り");
  record(`${casePrefix}-page-identity`, titleOk, {
    step: "ページ識別",
    actual: `${metrics.title} / ${metrics.sub.slice(0, 40)}…`,
    expected: "すべてのやりとり + 補足文",
  });

  const toolbarOk =
    metrics.hasSearch &&
    metrics.hasSort &&
    metrics.filterCount >= 6 &&
    metrics.toolbarBox &&
    metrics.toolbarBox.width <= metrics.viewportW;
  record(`${casePrefix}-toolbar-layout`, toolbarOk, {
    step: "検索/フィルター/ソート配置",
    actual: `filters=${metrics.filterCount}, toolbarW=${Math.round(metrics.toolbarBox?.width || 0)}`,
    expected: "検索・6フィルター・ソートがビューポート内",
  });

  const minChipH = Math.min(...metrics.filters.map((f) => f.h), 999);
  const chipOk = minChipH >= 34;
  record(`${casePrefix}-filter-tap-target`, chipOk, {
    step: "フィルターチップ押しやすさ",
    actual: `min height ${Math.round(minChipH)}px`,
    expected: "≥ 34px",
  });

  const typeOk = metrics.itemCount > 0 && metrics.items.every((i) => i.type);
  record(`${casePrefix}-type-labels`, typeOk, {
    step: "種別ラベル",
    actual: metrics.items.map((i) => i.type).join(", ") || "(なし)",
    expected: "全行に種別ラベル",
  });

  const pillsPerRow = metrics.items.map((i) => [i.unread, i.pill].filter(Boolean).length);
  const maxBadges = pillsPerRow.length ? Math.max(...pillsPerRow) : 0;
  const badgeOk = maxBadges <= 2;
  record(`${casePrefix}-status-badges`, badgeOk, {
    step: "未読/ステータス過剰",
    actual: `max badges/row=${maxBadges}`,
    expected: "≤ 2（未読 + ACTIVE等）",
  });

  record(`${casePrefix}-overflow`, !metrics.overflowX, {
    step: "横スクロール崩れ",
    actual: metrics.overflowX ? "overflow" : "ok",
    expected: "ページ横オーバーフローなし",
  });

  // 検索0件
  await page.fill("[data-chat-hub-search]", "zzzzzz_no_match_query_999");
  await page.waitForTimeout(300);
  const searchEmpty = await page.evaluate(() => ({
    emptyTitle: document.querySelector("[data-chat-hub-empty-title]")?.textContent?.trim() || "",
    emptyVisible: !document.querySelector("[data-chat-hub-empty]")?.hidden,
    listHidden: document.getElementById("chatThreadList")?.hidden,
  }));
  await screenshot(page, `chat-list-${tag}-search-empty.png`);

  record(`${casePrefix}-search-empty`, searchEmpty.emptyVisible && searchEmpty.emptyTitle === "検索結果なし", {
    step: "検索0件空状態",
    actual: searchEmpty.emptyTitle,
    expected: "検索結果なし",
  });

  await page.fill("[data-chat-hub-search]", "");
  await page.evaluate(() => {
    const el = document.querySelector("[data-chat-hub-search]");
    if (el) el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(200);

  // フィルター0件（運営通知 — ショーケース導入後は件数あり。空状態 DOM は search-empty で検証済み）
  await page.locator('[data-chat-hub-filter="ops"]').click();
  await page.waitForTimeout(300);
  const filterEmpty = await page.evaluate(() => ({
    emptyTitle: document.querySelector("[data-chat-hub-empty-title]")?.textContent?.trim() || "",
    emptyVisible: !document.querySelector("[data-chat-hub-empty]")?.hidden,
    listHidden: document.getElementById("chatThreadList")?.hidden,
    visibleCount: document.querySelectorAll(".chat-list__item[data-chat-thread-id]").length,
  }));
  await screenshot(page, `chat-list-${tag}-filter-empty.png`);

  const filterEmptyOk =
    filterEmpty.visibleCount > 0
      ? filterEmpty.visibleCount >= 1
      : filterEmpty.emptyVisible && filterEmpty.emptyTitle.includes("該当");
  record(`${casePrefix}-filter-empty`, filterEmptyOk, {
    step: "フィルター0件空状態",
    actual:
      filterEmpty.visibleCount > 0
        ? `運営通知フィルター ${filterEmpty.visibleCount}件（空状態は search-empty で検証）`
        : filterEmpty.emptyTitle,
    expected: "該当するやりとりはありません（または運営通知に実データ）",
  });

  await page.locator('[data-chat-hub-filter="all"]').click();
  await page.waitForTimeout(200);

  // 未読フィルター表示
  await page.locator('[data-chat-hub-filter="unread"]').click();
  await page.waitForTimeout(300);
  await screenshot(page, `chat-list-${tag}-filter-unread.png`);

  return metrics;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startStaticServer();
  const browser = await launchHeadlessBrowser();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await runViewportReview(page, { width: 1280, height: 900 });
    await runViewportReview(page, { width: 390, height: 844 });

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => r.pass === false);
  const md = [
    "# chat-list.html UI レビュー",
    "",
    `生成: ${new Date().toISOString()}`,
    "",
    `合計 ${results.length} チェック / 成功 ${results.length - failed.length} / 失敗 ${failed.length}`,
    "",
    "## スクリーンショット",
    "",
    "- `chat-list-1280-default.png` — PC 通常",
    "- `chat-list-1280-search-empty.png` — PC 検索0件",
    "- `chat-list-1280-filter-empty.png` — PC フィルター0件",
    "- `chat-list-1280-filter-unread.png` — PC 未読フィルター",
    "- `chat-list-390-default.png` — SP 通常",
    "- `chat-list-390-search-empty.png` — SP 検索0件",
    "- `chat-list-390-filter-empty.png` — SP フィルター0件",
    "- `chat-list-390-filter-unread.png` — SP 未読フィルター",
    "",
    failed.length ? "## NG\n" : "## 結果\n\n全チェック成功\n",
    ...failed.map((f) =>
      [
        `### ${f.id} — ${f.step}`,
        `- 実際: ${f.actual || "(n/a)"}`,
        `- 期待: ${f.expected || "(n/a)"}`,
        "",
      ].join("\n")
    ),
    "## 全結果",
    "",
    ...results.map((r) => `- [${r.pass ? "OK" : "NG"}] ${r.id} / ${r.step}: ${r.actual || "ok"}`),
  ].join("\n");

  await writeFile(path.join(OUT_DIR, "review-report.json"), JSON.stringify({ results, failed: failed.length }, null, 2));
  await writeFile(path.join(OUT_DIR, "review-report.md"), md);

  const indexArtifacts = await finalizeScreenshotRun(root, "chat-list-ui-review", {
    title: "chat-list UIレビュー",
    report: {
      generatedAt: new Date().toISOString(),
      results,
      failed: failed.length,
      total: results.length,
      passed: results.length - failed.length,
    },
    overall: failed.length > 0 ? "FAIL" : "PASS",
  });

  console.log(md);
  console.log(`\nIndex: screenshots/index.html`);
  console.log(`Folder: screenshots/chat-list-ui-review/index.html`);
  if (indexArtifacts.rootIndexPath) {
    console.log(`Root index written: ${indexArtifacts.rootIndexPath}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
