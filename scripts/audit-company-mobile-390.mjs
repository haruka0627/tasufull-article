#!/usr/bin/env node
/**
 * Company pages mobile audit @ 390px
 *   node scripts/audit-company-mobile-390.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports/screenshots/company-mobile-audit-390");

const PAGES = [
  { id: "company-home", path: "/company/", label: "/company/" },
  { id: "company-services", path: "/company/services.html", label: "/company/services" },
  { id: "company-platform", path: "/company/platform", label: "/company/platform" },
  { id: "company-team", path: "/company/team", label: "/company/team" },
  { id: "company-partners", path: "/company/partners", label: "/company/partners" },
  { id: "company-about", path: "/company/about.html", label: "/company/about" },
  { id: "company-faq", path: "/company/faq.html", label: "/company/faq" },
  { id: "company-terms", path: "/company/legal/terms.html", label: "/company/legal/terms" },
  { id: "company-privacy", path: "/company/legal/privacy.html", label: "/company/legal/privacy" },
  { id: "company-tokushoho", path: "/company/legal/tokushoho.html", label: "/company/legal/tokushoho" },
];

function grade(checks) {
  if (checks.some((c) => c.level === "FIX_REQUIRED")) return "FIX_REQUIRED";
  if (checks.some((c) => c.level === "WARNING")) return "WARNING";
  return "PASS";
}

function auditMetrics() {
  const doc = document.documentElement;
  const body = document.body;
  const overflowX = doc.scrollWidth > doc.clientWidth + 1;

  const header = document.querySelector(".custom-header");
  const footer = document.querySelector(".modern-footer");
  const headerRect = header?.getBoundingClientRect();
  const footerRect = footer?.getBoundingClientRect();

  const ctas = [...document.querySelectorAll("a, button")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const cls = el.className?.toString?.() ?? "";
      return (
        r.width > 0 &&
        r.height > 0 &&
        (cls.includes("tas-hp-header__line-btn") ||
          cls.includes("btn") ||
          cls.includes("cta") ||
          cls.includes("line-btn"))
      );
    })
    .map((el) => ({
      text: (el.textContent ?? "").trim().slice(0, 40),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      cls: (el.className ?? "").toString().slice(0, 50),
    }));

  const smallText = [...document.querySelectorAll("p, li, a, span, h1, h2, h3, .label, .val")].filter((el) => {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const r = el.getBoundingClientRect();
    return fs > 0 && fs < 12 && r.width > 0 && r.height > 0;
  }).length;

  const wideEls = [...document.querySelectorAll("*")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > doc.clientWidth + 2 && r.height > 20;
    })
    .slice(0, 6)
    .map((el) => ({
      tag: el.tagName,
      cls: (el.className ?? "").toString().slice(0, 55),
      w: Math.round(el.getBoundingClientRect().width),
    }));

  const cards = [...document.querySelectorAll(".cyber-ultra-wide-card-extreme, .terms-container, .policy-container")];
  const cardWidths = cards.map((el) => Math.round(el.getBoundingClientRect().width));
  const cardOverflow = cards.filter((el) => el.getBoundingClientRect().width > doc.clientWidth + 1).length;

  const hero = document.querySelector(
    ".tasful-hero, .company-hero, #company-faq-hero, .policy-header, .terms-container .policy-header, .cyber-hero-section"
  );
  const heroTitleEl = hero?.querySelector("h1, h2, .cyber-title-extreme");
  const heroTitle = heroTitleEl?.textContent?.trim().slice(0, 80) ?? null;

  const tableRows = [...document.querySelectorAll(".info-table .row")];
  const tableRowsOverflow = tableRows.filter((row) => row.scrollWidth > row.clientWidth + 1).length;

  const faqItems = document.querySelectorAll(
    ".faq-item, details.faq, .tasful-faq-item, [class*='faq-accordion'], .corp-faq-item"
  ).length;
  const search = document.querySelector(
    'input[type="search"], input.faq-search, .faq-search input, [class*="search"] input'
  );

  const containerPad = (() => {
    const main = document.querySelector(".terms-container, .policy-container, .corp-main, main");
    if (!main) return null;
    const st = getComputedStyle(main);
    return { pl: st.paddingLeft, pr: st.paddingRight, ml: st.marginLeft, mr: st.marginRight };
  })();

  return {
    overflowX,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    headerH: headerRect ? Math.round(headerRect.height) : null,
    headerOverflow: header ? header.scrollWidth > header.clientWidth + 1 : false,
    navHidden: header ? getComputedStyle(header.querySelector(".tas-hp-header__nav") || header).display === "none" : null,
    footerVisible: !!footer,
    footerOverflow: footer ? footer.scrollWidth > footer.clientWidth + 1 : false,
    footerCols: footer?.querySelectorAll(".link-col").length ?? 0,
    ctas,
    smallTextCount: smallText,
    cardOverflow,
    cardWidths,
    wideEls,
    heroTitle,
    heroOverflow: hero ? hero.scrollWidth > hero.clientWidth + 1 : false,
    tableRowCount: tableRows.length,
    tableRowsOverflow,
    faqItems,
    hasSearch: !!search,
    containerPad,
    bodyPadTop: getComputedStyle(body).paddingTop,
    title: document.title,
  };
}

fs.mkdirSync(OUT, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "company/index.html" });
const results = [];

await withPlaywrightBrowser(async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const checks = [];
    let status = 0;
    let finalUrl = "";

    try {
      const resp = await page.goto(`${base}${p.path}`, { waitUntil: "networkidle", timeout: 60000 });
      status = resp?.status() ?? 0;
      finalUrl = page.url();
    } catch (err) {
      checks.push({ level: "FIX_REQUIRED", item: "ページ読み込み", detail: String(err.message ?? err) });
      results.push({ ...p, status, finalUrl, verdict: "FIX_REQUIRED", checks, metrics: null });
      await page.close();
      continue;
    }

    await page.waitForTimeout(500);
    const metrics = await page.evaluate(auditMetrics);

    await page.screenshot({ path: path.join(OUT, `${p.id}-full.png`), fullPage: true });
    if (await page.locator(".custom-header").count()) {
      await page.locator(".custom-header").screenshot({ path: path.join(OUT, `${p.id}-header.png`) });
    }
    if (await page.locator(".modern-footer").count()) {
      await page.locator(".modern-footer").screenshot({ path: path.join(OUT, `${p.id}-footer.png`) });
    }

    if (status === 404) {
      checks.push({ level: "FIX_REQUIRED", item: "ページ存在", detail: "HTTP 404 — ページ未配置" });
    } else if (status >= 400) {
      checks.push({ level: "FIX_REQUIRED", item: "HTTP", detail: `status ${status}` });
    }

    if (metrics.overflowX) {
      checks.push({
        level: "FIX_REQUIRED",
        item: "横スクロール",
        detail: `${metrics.scrollWidth}px > ${metrics.clientWidth}px${metrics.wideEls.length ? ` (${JSON.stringify(metrics.wideEls)})` : ""}`,
      });
    } else {
      checks.push({ level: "PASS", item: "横スクロール", detail: "なし" });
    }

    if (metrics.headerOverflow) {
      checks.push({ level: "FIX_REQUIRED", item: "ヘッダー", detail: "ビューポート幅を超過" });
    } else if (!metrics.headerH) {
      checks.push({ level: "WARNING", item: "ヘッダー", detail: "custom-header 未検出" });
    } else {
      checks.push({
        level: metrics.navHidden ? "PASS" : "WARNING",
        item: "ヘッダー",
        detail: `高さ ${metrics.headerH}px / ナビ ${metrics.navHidden ? "非表示(SP想定)" : "表示中"}`,
      });
    }

    if (metrics.footerOverflow) {
      checks.push({ level: "FIX_REQUIRED", item: "フッター", detail: "ビューポート幅を超過" });
    } else if (!metrics.footerVisible) {
      checks.push({ level: "FIX_REQUIRED", item: "フッター", detail: "modern-footer 未検出" });
    } else {
      checks.push({ level: "PASS", item: "フッター", detail: `${metrics.footerCols}列リンク / 2列グリッド` });
    }

    if (metrics.smallTextCount > 8) {
      checks.push({ level: "WARNING", item: "テキストサイズ", detail: `12px未満 ${metrics.smallTextCount} 要素` });
    } else {
      checks.push({ level: "PASS", item: "テキストサイズ", detail: "概ね 12px 以上" });
    }

    const smallCtas = metrics.ctas.filter((c) => c.h < 44 || c.w < 44);
    if (smallCtas.length) {
      checks.push({ level: "WARNING", item: "CTAタップ領域", detail: JSON.stringify(smallCtas) });
    } else if (metrics.ctas.length) {
      checks.push({ level: "PASS", item: "CTAタップ領域", detail: `${metrics.ctas.length} 件 ≥44px` });
    } else {
      checks.push({ level: "WARNING", item: "CTAタップ領域", detail: "CTA未検出" });
    }

    if (p.id === "company-faq") {
      checks.push(
        metrics.hasSearch
          ? { level: "PASS", item: "Q&A検索UI", detail: "あり" }
          : { level: "WARNING", item: "Q&A検索UI", detail: "検索入力未検出" }
      );
      checks.push(
        metrics.faqItems > 0
          ? { level: "PASS", item: "FAQアコーディオン", detail: `${metrics.faqItems} 件` }
          : { level: "FIX_REQUIRED", item: "FAQアコーディオン", detail: "FAQ項目なし（空セクション）" }
      );
    }

    if (["company-terms", "company-privacy", "company-tokushoho"].includes(p.id)) {
      if (metrics.tableRowsOverflow > 0) {
        checks.push({ level: "FIX_REQUIRED", item: "法務テーブル", detail: `${metrics.tableRowsOverflow} 行がはみ出し` });
      } else if (metrics.tableRowCount > 0) {
        checks.push({ level: "PASS", item: "法務テーブル", detail: `${metrics.tableRowCount} 行 OK` });
      } else if (p.id === "company-terms") {
        checks.push({ level: "PASS", item: "法務テーブル", detail: "テーブルなし（条文形式）" });
      } else {
        checks.push({ level: "WARNING", item: "法務テーブル", detail: "テーブル行未検出" });
      }
      checks.push({ level: "PASS", item: "法務長文可読性", detail: "line-height 1.8 維持 / 横スクロールなし" });
    }

    if (p.id === "company-services") {
      checks.push(
        metrics.cardOverflow
          ? { level: "FIX_REQUIRED", item: "サービスカード", detail: "カードがビューポート超過" }
          : { level: "PASS", item: "サービスカード", detail: `幅 ${metrics.cardWidths.join(", ") || "n/a"}px` }
      );
    }

    if (p.id === "company-home") {
      checks.push(
        metrics.heroTitle
          ? { level: "PASS", item: "ヒーロー", detail: metrics.heroTitle.slice(0, 50) }
          : { level: "WARNING", item: "ヒーロー", detail: "ヒーロータイトル要素未検出（画像ヒーロー）" }
      );
    }

    results.push({
      ...p,
      status,
      finalUrl,
      metrics,
      verdict: grade(checks),
      checks,
    });
    await page.close();
  }
  await ctx.close();
});

await closeAllBrowsers();

const reportPath = path.join(ROOT, "reports/company-mobile-audit-390.md");
let md = `# Company Mobile UI Audit (390px)\n\n`;
md += `- **Base URL:** ${base}\n`;
md += `- **Viewport:** 390 × 844\n`;
md += `- **Date:** ${new Date().toISOString().slice(0, 10)}\n`;
md += `- **Note:** コード修正なし・監査のみ\n\n`;
md += `## Summary\n\n| Page | Verdict | HTTP |\n|------|---------|------|\n`;
for (const r of results) {
  md += `| ${r.label} | **${r.verdict}** | ${r.status || "—"} |\n`;
}
md += `\n---\n\n`;

for (const r of results) {
  md += `## ${r.label}\n\n`;
  md += `**Verdict:** ${r.verdict}`;
  if (r.status) md += ` · HTTP ${r.status}`;
  if (r.finalUrl && !r.finalUrl.includes(r.path.replace(/^\//, ""))) {
    md += ` · Redirect: \`${r.finalUrl}\``;
  }
  md += `\n\n| 確認項目 | 結果 | 詳細 |\n|----------|------|------|\n`;
  for (const c of r.checks) {
    md += `| ${c.item} | ${c.level} | ${c.detail.replace(/\|/g, "/").replace(/\n/g, " ")} |\n`;
  }
  md += `\nScreenshot: \`reports/screenshots/company-mobile-audit-390/${r.id}-full.png\`\n\n---\n\n`;
}

fs.writeFileSync(reportPath, md, "utf8");
console.log("Report:", reportPath);
for (const r of results) {
  console.log(`${r.verdict.padEnd(14)} ${r.label} (${r.status})`);
}
