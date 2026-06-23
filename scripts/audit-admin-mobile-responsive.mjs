#!/usr/bin/env node
/**
 * TASFUL 管理者向け画面 — モバイル監査 (390 / 430 / 768 / 1280)
 *   node scripts/audit-admin-mobile-responsive.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/admin-mobile-audit");
const REPORT = path.join(ROOT, "reports/admin-mobile-responsive-audit.md");
const JSON_OUT = path.join(ROOT, "reports/admin-mobile-audit-data.json");

const WIDTHS = [390, 430, 768, 1280];

/** 管理者向けのみ（利用者・市場・TALK・AI利用者・IWASHO は対象外） */
const PAGES = [
  { id: "builder-admin-dash", path: "/builder-admin/admin-index.html", label: "Builder Admin ダッシュボード", cat: "builder-admin" },
  { id: "builder-admin-threads", path: "/builder-admin/threads.html", label: "Builder Admin スレッド管理", cat: "builder-admin" },
  { id: "admin-applications", path: "/builder/admin-applications.html", label: "Builder 応募管理", cat: "builder-admin" },
  { id: "admin-partners", path: "/builder/admin-partners.html", label: "Builder パートナー検索", cat: "builder-admin" },
  { id: "admin-dispatch", path: "/builder/admin-dispatch.html", label: "Builder 案件手配", cat: "builder-admin" },
  { id: "admin-calendar", path: "/builder/admin-calendar.html", label: "Builder 案件カレンダー", cat: "builder-admin" },
  { id: "admin-notifications", path: "/builder/admin-notifications.html", label: "Builder 通知送信", cat: "builder-admin" },
  { id: "admin-reviews", path: "/builder/admin-reviews.html", label: "Builder 審査管理", cat: "builder-admin" },
  { id: "admin-partner-evaluations", path: "/builder/admin-partner-evaluations.html", label: "Builder パートナー評価", cat: "builder-admin" },
  { id: "ops-dashboard", path: "/admin-operations-dashboard.html", label: "AI運営司令塔", cat: "ops" },
  { id: "ai-ops-center", path: "/admin-ai-operations-center.html", label: "AI運営センター (API)", cat: "ops" },
  { id: "talk-ops-room", path: "/talk-ops-room.html", label: "運営TALKルーム (旧)", cat: "ops" },
  { id: "support-trouble", path: "/support-trouble-center.html", label: "重要問い合わせセンター", cat: "support" },
  { id: "anpi-dashboard", path: "/anpi-dashboard.html", label: "安否ダッシュボード", cat: "anpi" },
  { id: "anpi-line-admin", path: "/anpi-line-admin.html", label: "LINE運用 (管理者)", cat: "anpi" },
  { id: "anpi-notifications", path: "/anpi-notifications.html", label: "安否通知センター", cat: "anpi" },
];

function auditAdminMetrics(viewportW) {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const vh = window.innerHeight;
  const overflowX = doc.scrollWidth > vw + 1;

  const wideEls = [...document.querySelectorAll("body *")]
    .filter((el) => {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      return r.width > vw + 2 && r.height > 12;
    })
    .slice(0, 5)
    .map((el) => ({
      tag: el.tagName,
      cls: String(el.className || "").slice(0, 50),
      w: Math.round(el.getBoundingClientRect().width),
    }));

  const sidebarSel =
    ".ops-ai-sidebar, .dash-sidebar, .builder-partner-sidebar, .builder-dash-shell__sidebar, .ai-ops-layout";
  const sidebar = document.querySelector(sidebarSel.split(",")[0]) || document.querySelector(".dash-sidebar");
  let sidebarIssue = null;
  if (sidebar && viewportW <= 768) {
    const r = sidebar.getBoundingClientRect();
    const st = getComputedStyle(sidebar);
    const hidden =
      r.left < -20 ||
      st.transform.includes("translateX(-") ||
      st.transform.includes("matrix(1, 0, 0, 1, -") ||
      document.body.classList.contains("ops-ai-sidebar-open") === false &&
        (st.visibility === "hidden" || r.width === 0);
    const open =
      document.body.classList.contains("ops-ai-sidebar-open") ||
      document.body.classList.contains("dash-sidebar-open") ||
      document.body.classList.contains("builder-partner-sidebar-open") ||
      r.left >= -1;
    if (!open && r.left >= -1 && r.width > vw * 0.3 && r.width > 60) {
      sidebarIssue = `sidebar ${Math.round(r.width)}px visible (closed state)`;
    }
    if (open && r.width > vw * 0.95 && viewportW <= 430) {
      sidebarIssue = `sidebar full-screen ${Math.round(r.width)}px — no backdrop?`;
    }
  }

  const tableOverflow = [...document.querySelectorAll("table, .builder-table-wrap, .ops-ai-table, [class*='table']")].filter(
    (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && el.scrollWidth > el.clientWidth + 1;
    }
  ).length;

  const statGrid = document.querySelector(".builder-stat-grid, .ops-ai-kpi__grid, .ops-ai-morning-summary__chips, [data-ops-ai-kpi]");
  let statCols = 0;
  if (statGrid) {
    const gt = getComputedStyle(statGrid).gridTemplateColumns;
    statCols = gt.split(" ").filter((p) => p && p !== "0px").length;
  }

  const cardGrids = [...document.querySelectorAll("[class*='grid'], [class*='Grid']")].filter((el) => {
    const st = getComputedStyle(el);
    if (st.display !== "grid") return false;
    const r = el.getBoundingClientRect();
    return r.width > vw + 1;
  }).length;

  const fixedEls = [...document.querySelectorAll("*")].filter((el) => {
    const st = getComputedStyle(el);
    return (st.position === "fixed" || st.position === "sticky") && st.display !== "none";
  });
  let fixedOverlap = null;
  const fixedHeader = fixedEls.find((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= 2 && r.height > 40 && r.height < 200;
  });
  const fixedBottom = fixedEls.find((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom >= vh - 2 && r.height > 36 && r.width > vw * 0.5;
  });
  if (fixedHeader && fixedBottom && viewportW <= 430) {
    const gap = vh - fixedHeader.getBoundingClientRect().bottom - fixedBottom.getBoundingClientRect().height;
    if (gap < 120) fixedOverlap = `fixed header+CTA gap ~${Math.round(gap)}px`;
  }

  const modalOverflow = [...document.querySelectorAll("[role='dialog'], .ai-ops-modal, .builder-modal, .mvp-slack-modal__panel, .builder-eval-modal, .support-trouble-modal")].filter(
    (el) => {
      const st = getComputedStyle(el);
      if (st.display === "none" || el.hidden) return false;
      const r = el.getBoundingClientRect();
      return r.width > vw + 1 || r.right > vw + 1;
    }
  ).length;

  const smallTapTargets = [...document.querySelectorAll("button, a, [role='tab'], input[type='submit']")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      const text = (el.textContent || "").trim();
      if (!text && !el.getAttribute("aria-label")) return false;
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    })
    .slice(0, 8)
    .map((el) => ({
      text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      cls: String(el.className || "").slice(0, 35),
    }));

  const inputOverflow = [...document.querySelectorAll("input, textarea, select")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > vw + 1;
  }).length;

  const smallTabs = [...document.querySelectorAll("[role='tablist'] button, .builder-tabs__btn, .ops-ai-tabs button, .ai-ops-tabs button, .admin-cal-viewToggle button")].filter(
    (el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.height < 40;
    }
  ).length;

  const menuToggle = document.querySelector(
    "[data-ops-sidebar-toggle], [data-dash-menu-toggle], [data-builder-sidebar-toggle], .ops-ai-menu-btn, .dash-topbar__menu"
  );
  const menuToggleSize = menuToggle
    ? { w: Math.round(menuToggle.getBoundingClientRect().width), h: Math.round(menuToggle.getBoundingClientRect().height) }
    : null;

  return {
    overflowX,
    scrollWidth: doc.scrollWidth,
    clientWidth: vw,
    wideEls,
    sidebarIssue,
    tableOverflow,
    statCols,
    cardGridOverflow: cardGrids,
    fixedOverlap,
    modalOverflow,
    smallTapTargets,
    inputOverflow,
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
      detail: `${metrics.scrollWidth}px > ${metrics.clientWidth}px${metrics.wideEls.length ? ` — ${JSON.stringify(metrics.wideEls.slice(0, 2))}` : ""}`,
      fix: "固定幅・min-width 見直し、390px で max-width:100% / flex-wrap / overflow-x:hidden",
      priority: 1,
    });
  }

  if (metrics.sidebarIssue && width <= 768) {
    issues.push({
      severity: "HIGH",
      area: "サイドバー",
      detail: metrics.sidebarIssue,
      fix: "768px以下で off-canvas + ハンバーガー、デフォルト非表示",
      priority: 1,
    });
  }

  if (metrics.tableOverflow > 0) {
    issues.push({
      severity: "HIGH",
      area: "テーブル",
      detail: `${metrics.tableOverflow} 件が横はみ出し`,
      fix: "SPカード化 or overflow-x:auto + 列非表示",
      priority: 2,
    });
  }

  if (metrics.inputOverflow > 0) {
    issues.push({
      severity: "HIGH",
      area: "フォーム",
      detail: `${metrics.inputOverflow} 入力がビューポート超過`,
      fix: "width:100%; box-sizing:border-box; grid 1列化",
      priority: 2,
    });
  }

  if (metrics.modalOverflow > 0) {
    issues.push({
      severity: "HIGH",
      area: "モーダル",
      detail: "表示中モーダルが390px超過",
      fix: "max-width:min(100vw-32px,480px); margin:auto",
      priority: 2,
    });
  }

  if (metrics.fixedOverlap && width <= 430) {
    issues.push({
      severity: "HIGH",
      area: "固定ヘッダー/CTA",
      detail: metrics.fixedOverlap,
      fix: "main に padding-bottom、sticky CTA の高さ分確保",
      priority: 2,
    });
  }

  if (metrics.cardGridOverflow > 0 && width <= 430) {
    issues.push({
      severity: "MID",
      area: "カードグリッド",
      detail: `${metrics.cardGridOverflow} grid がビューポート超過`,
      fix: "430px以下 grid-template-columns:1fr",
      priority: 3,
    });
  }

  if (
    (page.cat === "builder-admin" || page.path.includes("admin-index") || page.path.includes("anpi-dashboard")) &&
    metrics.statCols > 1 &&
    width <= 430
  ) {
    issues.push({
      severity: "MID",
      area: "数値カード",
      detail: `stat/KPI grid が ${metrics.statCols} 列（${width}px）`,
      fix: "640px以下で grid-template-columns:1fr",
      priority: 3,
    });
  }

  const tinyLinks = metrics.smallTapTargets.filter((t) => t.h < 36 && t.w < 120);
  if (tinyLinks.length > 0 && width <= 430) {
    issues.push({
      severity: "HIGH",
      area: "ボタン/リンク",
      detail: `極小タップ ${tinyLinks.length} 件 — ${JSON.stringify(tinyLinks.slice(0, 2))}`,
      fix: "インライン link を block 化、min-height:44px",
      priority: 1,
    });
  } else if (metrics.smallTapTargets.length >= 4 && width <= 430) {
    issues.push({
      severity: "MID",
      area: "ボタン",
      detail: `44px未満 ${metrics.smallTapTargets.length} 件`,
      fix: "主要CTA・戻る・検索に min-height:44px",
      priority: 4,
    });
  } else if (metrics.smallTapTargets.length > 0 && width <= 390) {
    issues.push({
      severity: "LOW",
      area: "ボタン",
      detail: `44px未満 ${metrics.smallTapTargets.length} 件`,
      fix: "主要操作のみ 44px 確保",
      priority: 5,
    });
  }

  if (metrics.smallTabs > 0 && width <= 430) {
    issues.push({
      severity: "MID",
      area: "タブ/フィルター",
      detail: `高さ40px未満 ${metrics.smallTabs} 件`,
      fix: "min-height:44px、横スクロール tablist",
      priority: 4,
    });
  }

  if (metrics.menuToggleSize && width <= 768) {
    const { w, h } = metrics.menuToggleSize;
    if (w < 44 || h < 44) {
      issues.push({
        severity: "MID",
        area: "メニュートグル",
        detail: `${w}×${h}px`,
        fix: "ハンバーガーを 44×44px 以上",
        priority: 4,
      });
    }
  }

  if (!issues.length) {
    issues.push({ severity: "PASS", area: "総合", detail: "主要チェッククリア", fix: "—", priority: 99 });
  }

  return issues.map((i) => ({ ...i, url, width, page: page.label, pageId: page.id, cat: page.cat }));
}

async function tryOpenModals(page) {
  const triggers = [
    "[data-ai-ops-modal-confirm]",
    "[data-builder-eval-open]",
    "[data-admin-cal-add]",
    "[data-support-action]",
    "button:has-text('詳細')",
    "button:has-text('確認')",
  ];
  for (const sel of triggers) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) && (await el.isVisible())) {
        await el.click({ timeout: 2000 });
        await page.waitForTimeout(400);
        break;
      }
    } catch {
      /* ignore */
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "builder-admin/admin-index.html" });

const allResults = [];
const allIssues = [];

await withPlaywrightBrowser(async (browser) => {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      let status = 0;
      let metrics = null;
      let metricsModal = null;
      let issues = [];

      try {
        const resp = await page.goto(`${base}${p.path}`, { waitUntil: "networkidle", timeout: 120000 });
        status = resp?.status() ?? 0;
        await page.waitForTimeout(800);
        metrics = await page.evaluate(auditAdminMetrics, width);

        if (width <= 430) {
          await tryOpenModals(page);
          metricsModal = await page.evaluate(auditAdminMetrics, width);
          if (metricsModal.modalOverflow > metrics.modalOverflow) {
            metrics = metricsModal;
          }
        }

        issues = buildIssues(p, width, metrics);
        const shot = path.join(OUT, `${p.id}-${width}.png`);
        await page.screenshot({ path: shot, fullPage: true });
      } catch (err) {
        issues = [
          {
            severity: "HIGH",
            area: "ページ読込",
            detail: String(err.message || err),
            fix: "URL・dev server・JS依存確認",
            priority: 0,
            url: p.path,
            width,
            page: p.label,
            pageId: p.id,
            cat: p.cat,
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

const pageStatus = PAGES.map((p) => {
  const pageIssues = allIssues.filter((i) => i.pageId === p.id);
  const mobile390 = pageIssues.filter((i) => i.width <= 430);
  const highMobile = mobile390.filter((i) => i.severity === "HIGH");
  const midMobile = mobile390.filter((i) => i.severity === "MID");
  const overflow390 = allResults.some((r) => r.id === p.id && r.width === 390 && r.metrics?.overflowX);
  let status = "対応済み（軽微のみ）";
  if (highMobile.length || overflow390) status = "スマホ未対応";
  else if (midMobile.length >= 3) status = "部分対応（要改善）";
  else if (midMobile.length) status = "概ね対応（MID残）";
  return { ...p, status, highMobile: highMobile.length, midMobile: midMobile.length, overflow390 };
});

const notReady = pageStatus.filter((p) => p.status === "スマホ未対応");
const partial = pageStatus.filter((p) => p.status.startsWith("部分") || p.status.startsWith("概ね"));

let md = `# TASFUL 管理者向け画面 — モバイル監査\n\n`;
md += `- **Base URL:** ${base}\n`;
md += `- **Widths:** ${WIDTHS.join(" / ")}px\n`;
md += `- **Date:** ${new Date().toISOString().slice(0, 10)}\n`;
md += `- **Pages:** ${PAGES.length}（利用者・市場・TALK・AI利用者・IWASHO は除外）\n`;
md += `- **Note:** コード修正なし\n\n`;

md += `## 完了条件: スマホ未対応ページ一覧\n\n`;
if (notReady.length) {
  md += `| 優先 | URL | 状態 | HIGH(390/430) | MID(390/430) |\n|------|-----|------|---------------|-------------|\n`;
  for (const p of notReady) {
    md += `| P1 | \`${p.path}\` | ${p.status} | ${p.highMobile} | ${p.midMobile} |\n`;
  }
} else {
  md += `_390/430px で HIGH または横スクロールがあるページはありません。_\n`;
}

md += `\n### 部分対応（要改善）\n\n`;
if (partial.length) {
  md += `| URL | 状態 | MID(390/430) |\n|-----|------|-------------|\n`;
  for (const p of partial) {
    md += `| \`${p.path}\` | ${p.status} | ${p.midMobile} |\n`;
  }
} else {
  md += `_なし_\n`;
}

md += `\n## Summary\n\n| Severity | Count |\n|----------|-------|\n`;
md += `| HIGH | ${high.length} |\n| MID | ${mid.length} |\n| LOW | ${low.length} |\n\n`;

md += `## Issue List（重要度順）\n\n`;
md += `| 優先 | 重要度 | ページ | 幅 | 問題 | 詳細 | 修正方針 |\n`;
md += `|------|--------|--------|-----|------|------|----------|\n`;

const sorted = [...allIssues].sort((a, b) => a.priority - b.priority || (a.severity === "HIGH" ? 0 : 1) - (b.severity === "HIGH" ? 0 : 1));
for (const i of sorted) {
  md += `| P${i.priority} | **${i.severity}** | ${i.page} | ${i.width}px | ${i.area} | ${i.detail.replace(/\|/g, "/").slice(0, 90)} | ${i.fix.replace(/\|/g, "/")} |\n`;
}

md += `\n---\n\n## By Page\n\n`;
for (const p of PAGES) {
  const ps = pageStatus.find((x) => x.id === p.id);
  md += `### ${p.label} — ${ps?.status ?? "?"}\n\n`;
  md += `URL: \`${p.path}\`\n\n`;
  md += `| 幅 | HTTP | 横スクロール | stat列 | SS |\n|-----|------|-------------|--------|-----|\n`;
  for (const width of WIDTHS) {
    const r = allResults.find((x) => x.id === p.id && x.width === width);
    if (!r) continue;
    const ox = r.metrics?.overflowX ? "**YES**" : "no";
    const cols = r.metrics?.statCols ?? "—";
    md += `| ${width}px | ${r.status || "—"} | ${ox} | ${cols} | \`reports/screenshots/admin-mobile-audit/${r.shot}\` |\n`;
  }
  md += `\n`;
}

fs.writeFileSync(REPORT, md, "utf8");
fs.writeFileSync(JSON_OUT, JSON.stringify({ pages: pageStatus, issues: allIssues, results: allResults.map(({ metrics, ...r }) => r) }, null, 2));
console.log("Report:", REPORT);
console.log(`Pages not ready (390/430): ${notReady.length}`);
console.log(`HIGH ${high.length} / MID ${mid.length} / LOW ${low.length}`);
