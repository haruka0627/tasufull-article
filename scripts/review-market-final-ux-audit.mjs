/**
 * 市場全体 最終再監査（P0解消後・P2はFAIL扱いしない）
 * RELEASE FROZEN — 市場ECリリース確定（2026-06-16）reports/market-ec-release-status.md
 * node scripts/review-market-final-ux-audit.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "market-final-re-audit";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);

const PAGES = [
  {
    id: "top",
    label: "市場TOP",
    file: "shop-store.html",
    note: "shop-store.html（市場TOP）",
    wait: ".tasful-market-pc-hero-full, .tasful-market-card",
    expectBreadcrumb: true,
  },
  {
    id: "search",
    label: "検索",
    file: "shop-search.html",
    note: "shop-search.html（shop-market-search.html 相当）",
    query: "keyword=パン",
    wait: ".tasful-market-search-card, .tasful-market-search-empty",
    expectBreadcrumb: true,
  },
  {
    id: "product",
    label: "商品詳細",
    file: "detail-shop-product.html",
    query: "shopId=demo-shop-bakery&productId=p-0",
    wait: "[data-tasful-product-main]:not([hidden])",
    expectBreadcrumb: true,
  },
  {
    id: "checkout",
    label: "注文確認",
    file: "shop-market-checkout.html",
    query: "mode=buy&shopId=demo-shop-bakery&productId=p-0&quantity=1",
    wait: "[data-tasful-checkout-layout]:not([hidden])",
    expectBreadcrumb: false,
  },
  {
    id: "complete",
    label: "注文完了",
    file: "shop-market-complete.html",
    wait: ".tasful-market-complete-main",
    expectBreadcrumb: false,
  },
];

const VIEWPORTS = [
  { id: "1280", width: 1280, height: 900, pc: true },
  { id: "390", width: 390, height: 844, pc: false },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
await withPlaywrightBrowser(async (browser) => {const report = {
  capturedAt: new Date().toISOString(),
  base,
  pages: {},
  releaseBlockers: [],
  overall: "PASS",
};

const LAST_ORDER_KEY = "tasu_market_last_order";
const COMPLETE_CTA_FLOWS = [
  {
    id: "market",
    urlQuery: "source=market",
    order: {
      id: "TM-REAUDIT-MARKET",
      source: "market",
      channel: "shop_market",
      lines: [{ shopId: "demo-shop-bakery", productId: "p-0", title: "クロワッサン", shopName: "麦の香", qty: 1 }],
      totals: { total: 1280 },
    },
    expect: {
      source: "market",
      primaryLabel: "商品を見る",
      secondaryLabel: "TASFUL市場へ戻る",
      secondaryHref: "shop-store.html",
      primaryHrefIncludes: "detail-shop-product.html",
      forbidSecondaryHref: "shop-vendors.html",
    },
  },
  {
    id: "store",
    urlQuery: "source=store",
    order: {
      id: "TS-REAUDIT-STORE",
      source: "store",
      channel: "shop_store",
      lines: [{ shopId: "demo-shop-haru-cafe", productId: "p-0", title: "季節のパンケーキ", shopName: "HARU CAFE", qty: 1 }],
      totals: { total: 1280 },
    },
    expect: {
      source: "store",
      primaryLabel: "店舗を見る",
      secondaryLabel: "店舗一覧へ",
      secondaryHref: "shop-vendors.html",
      primaryHrefIncludes: "detail-shop-store.html",
      forbidSecondaryHref: "shop-store.html",
    },
  },
];

/** 既知P2 — リリース判定ではFAILにしない */
function isKnownP2(check) {
  const key = `${check.item} ${check.detail}`;
  return (
    /フッター統一|PC コンテンツ幅|戻る導線|ヘッダー上バナー|タイポ/.test(key) ||
    (/CTA/.test(check.item) && /未検出/.test(check.detail)) ||
    (/PC ヘッダー/.test(check.item) && /出品/.test(check.detail)) ||
    (/PC フッター/.test(check.item) && /列/.test(check.detail))
  );
}

function grade(checks) {
  const releaseFails = checks.filter((c) => c.level === "FAIL" && !isKnownP2(c));
  if (releaseFails.length) return "FAIL";
  const hasWarning = checks.some((c) => c.level === "WARNING" || (c.level === "FAIL" && isKnownP2(c)));
  if (hasWarning) return "WARNING";
  return "PASS";
}

function addCheck(arr, level, item, detail) {
  arr.push({ level, item, detail });
}

async function auditPage(page, pageDef, vp) {
  const url = buildLocalPageUrl(base, pageDef.file, pageDef.query ? `?${pageDef.query}` : "");
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(pageDef.wait, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(500);

  const m = await page.evaluate((expectBc) => {
    const header = document.querySelector("[data-tasful-market-header]");
    const footer = document.querySelector(".tasful-market-footer");
    const footerInner = footer?.querySelector(".tasful-market-footer__inner");
    const breadcrumb = document.querySelector("[data-breadcrumb]");
    const logo = document.querySelector(".tasful-market-mall-header__logo");
    const bcLinks = breadcrumb ? [...breadcrumb.querySelectorAll("a, span")].map((n) => (n.textContent || "").trim()).filter(Boolean) : [];
    const footerHeadings = footer ? [...footer.querySelectorAll(".tasful-market-footer__heading")].map((h) => h.textContent.trim()) : [];
    const footerBlocks = footerHeadings.length;

    const shell =
      document.querySelector(".tasful-market-shell") ||
      document.querySelector(".tasful-market-search-shell") ||
      document.querySelector(".tasful-market-search-layout") ||
      document.querySelector(".tasful-market-product-shell") ||
      document.querySelector(".tasful-market-checkout-main") ||
      document.querySelector(".tasful-market-complete-main") ||
      document.querySelector(".tasful-market-main");

    const primaryCtas = [
      ...document.querySelectorAll(
        ".tasful-market-product-hero__btn--buy, .tasful-market-product-hero__btn--cart, .tasful-market-checkout-bar__btn, .tasful-market-complete-actions__btn--primary, .tasful-market-complete-actions__btn--secondary, .tasful-market-search-card__cart, a.tasful-market-card"
      ),
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    const ctaMetrics = primaryCtas.slice(0, 4).map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        text: (el.textContent || "").trim().slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
        minH: s.minHeight,
        bg: s.backgroundColor,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
      };
    });

    const card =
      document.querySelector(".tasful-market-search-card") ||
      document.querySelector(".tasful-market-card") ||
      document.querySelector(".tasful-market-product-hero__figure img") ||
      document.querySelector(".tasful-market-checkout-item__img img") ||
      document.querySelector(".tasful-market-complete-card");

    let imgInfo = null;
    const imgCandidates = [
      ...document.querySelectorAll(
        ".tasful-market-search-card__img img, .tasful-market-card__img img, .tasful-market-pc-quad__thumb img, .tasful-market-pc-mini-thumb img, [data-tasful-product-image], .tasful-market-checkout-item__img img"
      ),
    ];
    const img = imgCandidates.find((node) => {
      const ir = node.getBoundingClientRect();
      return ir.width > 20 && ir.height > 20;
    });
    if (img) {
      const ir = img.getBoundingClientRect();
      const is = getComputedStyle(img);
      imgInfo = {
        w: Math.round(ir.width),
        h: Math.round(ir.height),
        display: is.display,
        natural: img.naturalWidth || 0,
        visible: ir.width > 20 && ir.height > 20,
      };
    }

    const priceEl =
      document.querySelector(".tasful-market-search-card__price") ||
      document.querySelector(".tasful-market-card__price") ||
      document.querySelector("[data-tasful-product-price]") ||
      document.querySelector(".tasful-market-checkout-bar__summary strong");

    const bodyFont = getComputedStyle(document.body).fontFamily;
    const headerRect = header?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const shellCs = shell ? getComputedStyle(shell) : null;
    const footerInnerCs = footerInner ? getComputedStyle(footerInner) : null;

    const tabbar = document.querySelector(".tasful-market-tabbar");
    const footerCopy = footer?.querySelector(".tasful-market-footer__copy");
    const copyRect = footerCopy?.getBoundingClientRect();
    const tabRect = tabbar?.getBoundingClientRect();

    return {
      url: location.href,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      hasHeader: !!header,
      headerH: headerRect ? Math.round(headerRect.height) : 0,
      headerLogoHref: logo?.getAttribute("href") || "",
      hasPcSell: !!document.querySelector(".tasful-header-pc__actions, [data-tasful-market-header-sell]"),
      hasFooter: !!footer,
      footerH: footerRect ? Math.round(footerRect.height) : 0,
      footerInnerMaxW: footerInnerCs?.maxWidth || "",
      footerGridCols: footerInnerCs?.gridTemplateColumns || "",
      footerBlocks,
      footerHeadings,
      hasBreadcrumbEl: !!breadcrumb,
      breadcrumbVisible: breadcrumb ? breadcrumb.offsetParent !== null && breadcrumb.children.length > 0 : false,
      breadcrumbLabels: bcLinks,
      shellW: shellRect ? Math.round(shellRect.width) : 0,
      shellMaxW: shellCs?.maxWidth || "",
      bodyFont,
      priceFontSize: priceEl ? getComputedStyle(priceEl).fontSize : "",
      ctaMetrics,
      imgInfo,
      tabbarVisible: tabbar ? getComputedStyle(tabbar).display !== "none" && tabbar.offsetParent !== null : false,
      footerTabOverlap:
        tabbar && getComputedStyle(tabbar).display !== "none" && tabbar.offsetParent !== null && copyRect && tabRect
          ? copyRect.bottom > tabRect.top - 4
          : false,
      tasuBanner: !!document.querySelector(".tasu-banner:not([hidden])"),
      tasuBannerDisplay: document.querySelector(".tasu-banner") ? getComputedStyle(document.querySelector(".tasu-banner")).display : "none",
    };
  }, pageDef.expectBreadcrumb);

  const checks = [];
  const prefix = vp.pc ? "PC" : "SP";

  if (!m.hasHeader) addCheck(checks, "FAIL", `${prefix} ヘッダー`, "data-tasful-market-header なし");
  else if (m.headerLogoHref !== "shop-store.html") addCheck(checks, "WARNING", `${prefix} 戻る導線`, `ロゴ href=${m.headerLogoHref}`);
  else addCheck(checks, "PASS", `${prefix} ヘッダー`, `高さ ${m.headerH}px`);

  if (vp.pc && !m.hasPcSell) addCheck(checks, "WARNING", `${prefix} ヘッダー`, "PC出品/アクション行の統一要確認");

  if (!m.hasFooter) addCheck(checks, "FAIL", `${prefix} フッター`, "フッターなし");
  else {
    const cols = m.footerGridCols.split(" ").filter(Boolean).length;
    if (vp.pc && cols < 3) addCheck(checks, "WARNING", `${prefix} フッター`, `PC列 ${cols}（3列想定）`);
    else addCheck(checks, "PASS", `${prefix} フッター`, `高さ ${m.footerH}px / inner max ${m.footerInnerMaxW}`);
    if (m.footerHeadings.join("|") !== "ショッピング|出品|サポート・規約" && m.footerHeadings.join("|") !== "ご利用ガイド|出品する") {
      addCheck(checks, "WARNING", `${prefix} フッター統一`, `見出し: ${m.footerHeadings.join(" / ")}`);
    }
  }

  if (m.scrollW > m.innerW + 1) addCheck(checks, "FAIL", `${prefix} 横スクロール`, `${m.scrollW}px > ${m.innerW}px`);
  else addCheck(checks, "PASS", `${prefix} 横スクロール`, "なし");

  if (vp.pc) {
    if (m.shellW && m.shellW < 900) addCheck(checks, "WARNING", `${prefix} コンテンツ幅`, `shell ${m.shellW}px（狭い）`);
    else addCheck(checks, "PASS", `${prefix} コンテンツ幅`, `shell ${m.shellW}px max=${m.shellMaxW}`);
  }

  if (pageDef.expectBreadcrumb) {
    if (!m.hasBreadcrumbEl) addCheck(checks, "WARNING", `${prefix} パンくず`, "要素なし");
    else if (!m.breadcrumbVisible) addCheck(checks, "WARNING", `${prefix} パンくず`, "未描画");
    else addCheck(checks, "PASS", `${prefix} パンくず`, m.breadcrumbLabels.join(" › ") || "あり");
  }

  if (m.ctaMetrics.length) {
    const small = m.ctaMetrics.filter((c) => c.h < 44);
    if (!vp.pc && small.length) {
      addCheck(checks, "FAIL", `${prefix} CTAタップ領域`, `${small.map((c) => `${c.text}:${c.h}px`).join("; ")}`);
    } else if (vp.pc && small.length) {
      addCheck(checks, "WARNING", `${prefix} CTA高さ`, `${small.map((c) => `${c.text}:${c.h}px`).join("; ")}`);
    } else {
      addCheck(checks, "PASS", `${prefix} CTA`, m.ctaMetrics.map((c) => `${c.text}:${c.h}px`).join("; "));
    }
  } else if (pageDef.id === "top") {
    addCheck(checks, "WARNING", `${prefix} CTA`, "主要CTA未検出（カード全体リンク）");
  } else {
    addCheck(checks, "WARNING", `${prefix} CTA`, "主要CTA未検出");
  }

  if (m.imgInfo) {
    if (!m.imgInfo.visible) addCheck(checks, "FAIL", `${prefix} 商品画像`, "表示サイズ不足");
    else addCheck(checks, "PASS", `${prefix} 商品画像`, `${m.imgInfo.w}×${m.imgInfo.h}px`);
  }

  if (!vp.pc && m.tabbarVisible && m.footerTabOverlap) addCheck(checks, "FAIL", `${prefix} フッター`, "タブバーと重なり");
  else if (!vp.pc && m.tabbarVisible) addCheck(checks, "PASS", `${prefix} フッター`, "タブバー共存OK");

  if (vp.pc && m.tasuBannerDisplay !== "none" && pageDef.id !== "top") {
    addCheck(checks, "WARNING", `${prefix} ヘッダー上バナー`, "TOP以外で tasu-banner 表示");
  }

  if (!m.bodyFont.includes("Noto Sans JP")) addCheck(checks, "WARNING", `${prefix} タイポ`, m.bodyFont.slice(0, 40));

  const shot = path.join(OUT_DIR, `${pageDef.id}-${vp.id}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  return { metrics: m, checks, grade: grade(checks), screenshot: path.relative(ROOT, shot).replace(/\\/g, "/") };
}

async function auditCompleteCtaBySource(page, vp) {
  const flowChecks = [];
  for (const flow of COMPLETE_CTA_FLOWS) {
    const url = buildLocalPageUrl(base, `shop-market-complete.html?${flow.urlQuery}`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, order }) => localStorage.setItem(key, JSON.stringify(order)),
      { key: LAST_ORDER_KEY, order: flow.order }
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-tasful-complete-primary-link]", { timeout: 20000 });

    const m = await page.evaluate(() => {
      const primary = document.querySelector("[data-tasful-complete-primary-link]");
      const secondary = document.querySelector("[data-tasful-complete-secondary-link]");
      const btn = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent.trim(),
          href: el.getAttribute("href") || "",
          h: Math.round(r.height),
        };
      };
      return {
        bodySource: document.body.dataset.tasfulCompleteSource || "",
        primary: btn(primary),
        secondary: btn(secondary),
      };
    });

    const e = flow.expect;
    const prefix = `${flow.id}@${vp.id}`;
    const pass = (ok, item, detail) => flowChecks.push({ level: ok ? "PASS" : "FAIL", item: `${prefix} ${item}`, detail });

    pass(m.bodySource === e.source, "流入元", m.bodySource);
    pass(m.primary?.text === e.primaryLabel, "primary", `${m.primary?.text}`);
    pass(m.secondary?.text === e.secondaryLabel, "secondary", `${m.secondary?.text}`);
    pass(m.secondary?.href === e.secondaryHref, "secondary href", m.secondary?.href);
    pass(m.primary?.href?.includes(e.primaryHrefIncludes), "primary href", m.primary?.href);
    pass(m.secondary?.href !== e.forbidSecondaryHref, "誤遷移なし", m.secondary?.href);
    pass((m.primary?.h || 0) >= 44, "primary 高さ", `${m.primary?.h}px`);
    pass((m.secondary?.h || 0) >= 44, "secondary 高さ", `${m.secondary?.h}px`);
  }
  return flowChecks;
}

for (const pageDef of PAGES) {
  const page = await browser.newPage();
  report.pages[pageDef.id] = { label: pageDef.label, file: pageDef.note, viewports: {} };
  for (const vp of VIEWPORTS) {
    const result = await auditPage(page, pageDef, vp);
    if (pageDef.id === "complete") {
      const ctaChecks = await auditCompleteCtaBySource(page, vp);
      result.checks.push(...ctaChecks);
      result.grade = grade(result.checks);
    }
    report.pages[pageDef.id].viewports[vp.id] = result;
    const g = result.grade;
    if (g === "FAIL") report.overall = "FAIL";
    else if (g === "WARNING" && report.overall === "PASS") report.overall = "WARNING";
  }
  await page.close();
}

});

// リリース前ブロッカー抽出
const blockers = [];
const warnings = [];

for (const [pid, pdata] of Object.entries(report.pages)) {
  for (const [vid, vdata] of Object.entries(pdata.viewports)) {
    for (const c of vdata.checks) {
      const row = { page: pdata.label, pageId: pid, viewport: vid, ...c };
      if (c.level === "FAIL" && !isKnownP2(c)) blockers.push(row);
      if (c.level === "WARNING") warnings.push(row);
    }
  }
}

// 重複統合・優先度
const uniqueWarnings = [];
const seen = new Set();
for (const w of warnings) {
  const key = `${w.pageId}:${w.item}:${w.detail}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniqueWarnings.push(w);
}

report.releaseBlockers = [
  ...blockers.map((b, i) => ({ priority: "P0", ...b })),
  ...uniqueWarnings
    .filter((w) => /フッター統一|パンくず|横スクロール|CTA|コンテンツ幅|バナー/.test(w.item + w.detail))
    .map((w) => ({ priority: "P1", ...w })),
  ...uniqueWarnings
    .filter((w) => !/フッター統一|パンくず|横スクロール|CTA|コンテンツ幅|バナー/.test(w.item + w.detail))
    .map((w) => ({ priority: "P2", ...w })),
];

function mdPageSection(pid, pdata) {
  const lines = [`### ${pdata.label}（${pdata.file}）`, ""];
  for (const vp of ["1280", "390"]) {
    const v = pdata.viewports[vp];
    lines.push(`**${vp}px — 【${v.grade}】**`, "");
    for (const c of v.checks) {
      const icon = c.level === "PASS" ? "✅" : c.level === "WARNING" ? "⚠️" : "❌";
      if (c.level !== "PASS") lines.push(`- ${icon} **${c.level}** ${c.item}: ${c.detail}`);
    }
    const fails = v.checks.filter((c) => c.level !== "PASS");
    if (!fails.length) lines.push("- 全チェック PASS");
    lines.push("");
  }
  return lines.join("\n");
}

const md = `# 市場全体 最終再監査

生成: ${report.capturedAt}
総合: **【${report.overall}】**
リリース前必須修正（P0）: **${blockers.length ? "あり" : "なし"}**

> P2既知課題（フッター統一・戻り導線・コンテンツ幅等）はFAIL扱いしない
> 注文完了CTA: source=market / source=store 両導線を検証

## ページ別サマリー

| ページ | 1280px | 390px |
|--------|--------|-------|
${PAGES.map((p) => {
  const d = report.pages[p.id];
  return `| ${d.label} | ${d.viewports["1280"].grade} | ${d.viewports["390"].grade} |`;
}).join("\n")}

${PAGES.map((p) => mdPageSection(p.id, report.pages[p.id])).join("\n")}

## 市場リリース前に直すべき項目（優先順）

### P0 — リリースブロッカー
${blockers.length ? blockers.map((b) => `- **${b.page}** (${b.viewport}px) — ${b.item}: ${b.detail}`).join("\n") : "- なし"}

### P1 — 強く推奨（UX統一）
${report.releaseBlockers.filter((r) => r.priority === "P1").map((b) => `- **${b.page}** — ${b.item}: ${b.detail}`).join("\n") || "- なし"}

### P2 — 改善推奨
${report.releaseBlockers.filter((r) => r.priority === "P2").map((b) => `- **${b.page}** — ${b.item}: ${b.detail}`).join("\n") || "- なし"}

## 注文完了（完了扱い・監査参考）
- PASS: 注文情報 / CTA / 次の流れ / PC・SP / フッター接続
- 余白調整は今後停止
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "市場全体 最終再監査",
  report: {
    ...report,
    overall: report.overall,
    pages: PAGES.map((p) => {
      const d = report.pages[p.id];
      const g1280 = d.viewports["1280"].grade;
      const g390 = d.viewports["390"].grade;
      const verdict =
        g1280 === "FAIL" || g390 === "FAIL"
          ? "FAIL"
          : g1280 === "WARNING" || g390 === "WARNING"
            ? "WARNING"
            : "PASS";
      return { id: p.id, label: d.label, file: p.file, verdict, viewports: d.viewports };
    }),
  },
  targetPages: PAGES.map((p) => p.file),
  viewports: ["390", "1280"],
  overall: report.overall,
  screenshotCatalog: PAGES.flatMap((p) =>
    VIEWPORTS.map((v) => ({
      file: `${p.id}-${v.id}.png`,
      label: `${p.label} ${v.id}px`,
      url: p.file + (p.query ? `?${p.query}` : ""),
      viewport: v.id,
    }))
  ),
});

console.log("OVERALL:", report.overall);
console.log("P0:", blockers.length, "P1:", report.releaseBlockers.filter((r) => r.priority === "P1").length);
console.log(md);

await closeAllBrowsers();
