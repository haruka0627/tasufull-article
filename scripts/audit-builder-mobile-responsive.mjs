#!/usr/bin/env node
/**
 * Builder pages responsive audit (390 / 430 / 768 / 1280)
 *   node scripts/audit-builder-mobile-responsive.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/builder-mobile-audit");
const REPORT = path.join(ROOT, "reports/builder-mobile-responsive-audit.md");

const WIDTHS = [390, 430, 768, 1280];

const PAGES = [
  { id: "builder-top", path: "/builder/builder-top.html", label: "Builder TOP", cat: "top" },
  { id: "partner-dash", path: "/builder/index.html", label: "パートナーダッシュボード", cat: "dashboard" },
  { id: "user-dash", path: "/builder/user-dashboard.html", label: "一般ダッシュボード", cat: "dashboard" },
  { id: "admin-dash", path: "/builder-admin/admin-index.html", label: "運営Adminダッシュボード", cat: "dashboard" },
  { id: "mvp-project-new", path: "/builder/mvp-project-new.html", label: "案件新規作成", cat: "edit" },
  { id: "template-edit", path: "/builder/template-edit.html", label: "テンプレート編集", cat: "edit" },
  { id: "mvp-post", path: "/builder/mvp-post.html", label: "投稿作成", cat: "edit" },
  { id: "board-projects", path: "/builder/board-projects.html", label: "掲示板一覧", cat: "list" },
  { id: "board-project-detail", path: "/builder/board-project-detail.html", label: "掲示板詳細", cat: "detail" },
  { id: "mvp-projects", path: "/builder/mvp-projects.html", label: "MVP案件一覧", cat: "list" },
  { id: "mvp-project-detail", path: "/builder/mvp-project-detail.html", label: "MVP案件詳細", cat: "detail" },
  { id: "templates", path: "/builder/templates.html", label: "テンプレート一覧", cat: "list" },
  { id: "board-threads", path: "/builder/board-threads.html", label: "掲示板スレッド", cat: "list" },
  { id: "mvp-threads", path: "/builder/mvp-threads.html", label: "やりとり一覧", cat: "list" },
  { id: "settings", path: "/builder/settings.html", label: "設定", cat: "other" },
  { id: "partners", path: "/builder/partners.html", label: "パートナー", cat: "other" },
  { id: "admin-applications", path: "/builder/admin-applications.html", label: "Admin 応募管理", cat: "admin" },
  { id: "admin-partners", path: "/builder/admin-partners.html", label: "Admin パートナー", cat: "admin" },
  { id: "admin-dispatch", path: "/builder/admin-dispatch.html", label: "Admin 配信", cat: "admin" },
  { id: "admin-calendar", path: "/builder/admin-calendar.html", label: "Admin カレンダー", cat: "admin" },
  { id: "admin-notifications", path: "/builder/admin-notifications.html", label: "Admin 通知", cat: "admin" },
  { id: "admin-reviews", path: "/builder/admin-reviews.html", label: "Admin レビュー", cat: "admin" },
  { id: "admin-partner-evaluations", path: "/builder/admin-partner-evaluations.html", label: "Admin 評価", cat: "admin" },
];

function auditBuilderMetrics(viewportW) {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const overflowX = doc.scrollWidth > vw + 1;

  const wideEls = [...document.querySelectorAll("body *")]
    .filter((el) => {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > vw + 2 && r.height > 12;
    })
    .slice(0, 6)
    .map((el) => ({
      tag: el.tagName,
      cls: String(el.className || "").slice(0, 55),
      w: Math.round(el.getBoundingClientRect().width),
    }));

  const sidebar = document.querySelector(
    "[data-builder-partner-sidebar], .builder-partner-sidebar, .builder-dash-shell__sidebar"
  );
  let sidebarVisibleW = 0;
  let sidebarBlocks = false;
  if (sidebar) {
    const r = sidebar.getBoundingClientRect();
    const st = getComputedStyle(sidebar);
    sidebarVisibleW = Math.round(r.width);
    const open =
      document.body.classList.contains("is-sidebar-open") ||
      sidebar.classList.contains("is-open") ||
      st.transform !== "none" && r.left >= -1;
    if (viewportW <= 768 && r.width > 40 && r.left >= -1 && !open) {
      sidebarBlocks = r.width > vw * 0.35;
    }
    if (viewportW <= 768 && open && r.width > vw * 0.92) {
      sidebarBlocks = false;
    }
  }

  const statGrid = document.querySelector(".builder-stat-grid");
  let statCols = 0;
  if (statGrid) {
    const gt = getComputedStyle(statGrid).gridTemplateColumns;
    statCols = gt.split(" ").filter((p) => p && p !== "0px").length;
  }

  const tableOverflow = [...document.querySelectorAll("table, .builder-table-wrap, .builder-data-table")].filter(
    (el) => el.scrollWidth > el.clientWidth + 1
  ).length;

  const smallTapTargets = [...document.querySelectorAll("button, a, [role='tab'], input[type='submit']")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    })
    .slice(0, 8)
    .map((el) => ({
      text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      cls: String(el.className || "").slice(0, 40),
    }));

  const inputOverflow = [...document.querySelectorAll("input, textarea, select")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > vw + 1;
  }).length;

  const modalOverflow = [...document.querySelectorAll("[role='dialog'], .builder-modal, .modal.is-open, .builder-overlay.is-visible")].filter(
    (el) => {
      const r = el.getBoundingClientRect();
      return r.width > vw + 1;
    }
  ).length;

  const header = document.querySelector(".builder-header, .builder-top-header");
  const headerOverflow = header ? header.scrollWidth > header.clientWidth + 1 : false;

  const filterTabs = [...document.querySelectorAll("[role='tablist'] button, .builder-tabs__btn, .builder-filter-tabs button")];
  const smallTabs = filterTabs.filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 40).length;

  const menuToggle = document.querySelector("[data-builder-sidebar-toggle], .builder-partner-menu-toggle");
  const menuToggleSize = menuToggle
    ? {
        w: Math.round(menuToggle.getBoundingClientRect().width),
        h: Math.round(menuToggle.getBoundingClientRect().height),
      }
    : null;

  return {
    overflowX,
    scrollWidth: doc.scrollWidth,
    clientWidth: vw,
    wideEls,
    sidebarVisibleW,
    sidebarBlocks,
    statCols,
    tableOverflow,
    smallTapTargets,
    inputOverflow,
    modalOverflow,
    headerOverflow,
    smallTabs,
    menuToggleSize,
    title: document.title,
  };
}

function buildIssues(page, width, metrics) {
  const issues = [];
  const url = page.path;

  if (metrics.overflowX) {
    issues.push({
      severity: "HIGH",
      area: "横スクロール",
      detail: `${metrics.scrollWidth}px > ${metrics.clientWidth}px${metrics.wideEls.length ? ` — ${JSON.stringify(metrics.wideEls.slice(0, 3))}` : ""}`,
      fix: "overflow-x:hidden の確認、固定幅要素・min-width の見直し、390px向け max-width:100% / flex-wrap",
    });
  }

  if (metrics.tableOverflow > 0) {
    issues.push({
      severity: "HIGH",
      area: "テーブル",
      detail: `${metrics.tableOverflow} 件が横はみ出し`,
      fix: "SPではカード化または overflow-x:auto + 列の非表示/縦積み",
    });
  }

  if (metrics.inputOverflow > 0) {
    issues.push({
      severity: "HIGH",
      area: "入力フォーム",
      detail: `${metrics.inputOverflow} 入力がビューポート超過`,
      fix: "width:100%; box-sizing:border-box; grid-template-columns:1fr",
    });
  }

  if (metrics.modalOverflow > 0) {
    issues.push({
      severity: "HIGH",
      area: "モーダル",
      detail: "モーダルがビューポート幅を超過",
      fix: "max-width:min(100vw - 32px, 480px); margin-inline:auto",
    });
  }

  if (metrics.sidebarBlocks && width <= 768) {
    issues.push({
      severity: "HIGH",
      area: "固定サイドバー",
      detail: `閉じた状態で sidebar 幅 ${metrics.sidebarVisibleW}px がコンテンツを圧迫`,
      fix: "768px以下で sidebar を off-canvas 化、デフォルト非表示 + ハンバーガー開閉",
    });
  }

  if (page.cat === "dashboard" && metrics.statCols > 1 && width <= 430) {
    issues.push({
      severity: "MID",
      area: "数値カード",
      detail: `stat-grid が ${metrics.statCols} 列のまま（${width}px）`,
      fix: "640px以下で grid-template-columns:1fr に統一",
    });
  }

  if (metrics.headerOverflow) {
    issues.push({
      severity: "MID",
      area: "ヘッダー",
      detail: "ヘッダーが横はみ出し",
      fix: "ヘッダーグリッドを1列化、長いタイトルを truncate",
    });
  }

  if (metrics.smallTapTargets.length >= 3 && width <= 430) {
    issues.push({
      severity: "MID",
      area: "タップ領域",
      detail: `44px未満 ${metrics.smallTapTargets.length} 件 — ${JSON.stringify(metrics.smallTapTargets.slice(0, 3))}`,
      fix: "min-height/min-width:44px、padding 拡大、icon-only ボタンに aria-label + タップ領域",
    });
  } else if (metrics.smallTapTargets.length > 0 && width <= 390) {
    issues.push({
      severity: "LOW",
      area: "タップ領域",
      detail: `44px未満 ${metrics.smallTapTargets.length} 件`,
      fix: "主要CTAのみ 44px 確保",
    });
  }

  if (metrics.smallTabs > 0 && width <= 430) {
    issues.push({
      severity: "MID",
      area: "タブ/フィルター",
      detail: `高さ40px未満のタブ ${metrics.smallTabs} 件`,
      fix: "タブ min-height:44px、横スクロール可能な tablist",
    });
  }

  if (metrics.menuToggleSize && width <= 768) {
    const { w, h } = metrics.menuToggleSize;
    if (w < 44 || h < 44) {
      issues.push({
        severity: "MID",
        area: "ハンバーガー",
        detail: `メニューボタン ${w}×${h}px`,
        fix: "メニュートグルを 44×44px 以上に",
      });
    }
  }

  if (!issues.length) {
    issues.push({
      severity: "PASS",
      area: "総合",
      detail: "主要チェック項目クリア",
      fix: "—",
    });
  }

  return issues.map((i) => ({ ...i, url, width, page: page.label, pageId: page.id }));
}

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "builder/builder-top.html" });

const allResults = [];
const allIssues = [];

await withPlaywrightBrowser(async (browser) => {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      let status = 0;
      let metrics = null;
      let issues = [];

      try {
        const resp = await page.goto(`${base}${p.path}`, { waitUntil: "networkidle", timeout: 90000 });
        status = resp?.status() ?? 0;
        await page.waitForTimeout(600);
        metrics = await page.evaluate(auditBuilderMetrics, width);
        issues = buildIssues(p, width, metrics);

        const shot = path.join(OUT, `${p.id}-${width}.png`);
        await page.screenshot({ path: shot, fullPage: true });
      } catch (err) {
        issues = [
          {
            severity: "HIGH",
            area: "ページ読込",
            detail: String(err.message || err),
            fix: "URL・dev server・依存JSの確認",
            url: p.path,
            width,
            page: p.label,
            pageId: p.id,
          },
        ];
      }

      allResults.push({ ...p, width, status, metrics, issues, shot: `${p.id}-${width}.png` });
      allIssues.push(...issues.filter((i) => i.severity !== "PASS"));
      await page.close();
    }
    await ctx.close();
  }
});

await closeAllBrowsers();

const high = allIssues.filter((i) => i.severity === "HIGH");
const mid = allIssues.filter((i) => i.severity === "MID");
const low = allIssues.filter((i) => i.severity === "LOW");

let md = `# Builder Mobile Responsive Audit\n\n`;
md += `- **Base URL:** ${base}\n`;
md += `- **Widths:** ${WIDTHS.join(" / ")}px\n`;
md += `- **Date:** ${new Date().toISOString().slice(0, 10)}\n`;
md += `- **Pages audited:** ${PAGES.length}\n`;
md += `- **Note:** コード修正なし・監査のみ\n\n`;

md += `## Summary\n\n| Severity | Count |\n|----------|-------|\n`;
md += `| HIGH | ${high.length} |\n| MID | ${mid.length} |\n| LOW | ${low.length} |\n\n`;

md += `## Issue List\n\n`;
md += `| 重要度 | ページ | 幅 | 問題箇所 | 詳細 | 修正方針 |\n`;
md += `|--------|--------|-----|----------|------|----------|\n`;

for (const i of [...high, ...mid, ...low]) {
  md += `| **${i.severity}** | ${i.page} | ${i.width}px | ${i.area} | ${i.detail.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 120)} | ${i.fix.replace(/\|/g, "/")} |\n`;
}

md += `\n---\n\n## By Page\n\n`;

for (const p of PAGES) {
  md += `### ${p.label}\n\n`;
  md += `URL: \`${p.path}\`\n\n`;
  md += `| 幅 | HTTP | 横スクロール | stat列 | スクリーンショット |\n`;
  md += `|-----|------|-------------|--------|-------------------|\n`;
  for (const width of WIDTHS) {
    const r = allResults.find((x) => x.id === p.id && x.width === width);
    if (!r) continue;
    const ox = r.metrics?.overflowX ? "YES" : "no";
    const cols = r.metrics?.statCols ?? "—";
    md += `| ${width}px | ${r.status || "—"} | ${ox} | ${cols} | \`reports/screenshots/builder-mobile-audit/${r.shot}\` |\n`;
  }
  md += `\n`;
}

fs.writeFileSync(REPORT, md, "utf8");
console.log("Report:", REPORT);
console.log(`HIGH ${high.length} / MID ${mid.length} / LOW ${low.length}`);
console.log("Screenshots:", OUT);
