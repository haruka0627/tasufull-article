/**
 * 店舗詳細 — 口コミ評価ゲージ検証（共有モジュール）
 */
import path from "node:path";

export const REVIEW_GAUGE_SHOP_ID = "demo-shop-haru-cafe";

export const REVIEW_GAUGE_VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 900 },
];

/**
 * @param {import('playwright').Page} page
 */
export async function scrollToReviewSection(page) {
  await page.evaluate(() => {
    document.getElementById("section-reviews")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
}

/**
 * お問い合わせドックとの被り検証用 — フッターCTAを画面下端付近へ
 * @param {import('playwright').Page} page
 */
export async function scrollToReviewFooterCta(page) {
  await page.evaluate(() => {
    const btn = document.querySelector("#section-reviews .food-review-more-btn");
    if (btn) btn.scrollIntoView({ block: "end" });
    else document.getElementById("section-reviews")?.scrollIntoView({ block: "end" });
  });
  await page.waitForTimeout(600);
}

export function mergeUxDockAudit(ux, uxDock) {
  const dockIssueRe = /ドック|すべての口コミを見る/;
  return {
    ...ux,
    issues: [...ux.issues.filter((i) => !dockIssueRe.test(i)), ...uxDock.issues],
    dock: uxDock.dock,
    layout: ux.layout && uxDock.layout?.moreBtn ? { ...ux.layout, moreBtn: uxDock.layout.moreBtn } : ux.layout,
  };
}

/**
 * @param {import('playwright').Page} page
 */
export async function auditReviewSectionUx(page) {
  return page.evaluate(() => {
    const issues = [];
    const section = document.getElementById("section-reviews");
    if (!section) {
      issues.push("口コミセクションDOMなし");
      return { issues, layout: null, dock: null };
    }

    const summary = section.querySelector(".food-reviews-summary-band, .food-reviews-scoreblock");
    const bars = section.querySelector(".food-reviews-barsblock");
    const list = section.querySelector(".food-reviews-list");
    const moreBtn = section.querySelector(".food-review-more-btn");
    const scoreNum = section.querySelector(".food-reviews-scoreblock__num");
    const scoreStars = section.querySelector(".food-reviews-scoreblock__stars");
    const scoreCount = section.querySelector(".food-reviews-scoreblock__count");

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), visible: r.height > 0 && r.width > 0 };
    };

    const summaryR = rect(summary);
    const barsR = rect(bars);
    const listR = rect(list);
    const moreR = rect(moreBtn);

    if (!summaryR?.visible) issues.push("総合評価サマリー非表示");
    if (!scoreNum?.textContent?.trim()) issues.push("評価スコアなし");
    if (!scoreStars?.textContent?.includes("★")) issues.push("星表示なし");
    if (!/\(\d+件の口コミ\)/.test(scoreCount?.textContent || "")) issues.push("口コミ件数表示なし");

    if (summaryR && barsR && summaryR.top > barsR.top + 2) {
      issues.push("サマリーがゲージより下に配置");
    }
    if (barsR && listR && barsR.bottom > listR.top + 4) {
      issues.push("ゲージがレビュー一覧より下に配置");
    }

    const dock = document.querySelector(".shop-mobile-inquiry-dock");
    const dockR = dock ? rect(dock) : null;
    let dockOverlapMore = false;
    const dockOverlapSection = false;
    if (dockR?.visible && moreR?.visible) {
      const safeBottom = dockR.top - 6;
      dockOverlapMore = moreR.bottom > safeBottom;
      if (dockOverlapMore) issues.push("「すべての口コミを見る」がお問い合わせドックに被る");
    }

    const vw = window.innerWidth;
    if (vw <= 960 && summaryR && barsR) {
      const gap = barsR.top - summaryR.bottom;
      if (gap < 0) issues.push("SP: サマリーとゲージの順序が逆");
    }
    if (vw >= 961 && summaryR && barsR && listR) {
      if (!(summaryR.top <= barsR.top && barsR.top <= listR.top)) {
        issues.push("PC: 総合評価→ゲージ→一覧の縦導線が崩れている");
      }
    }

    return {
      issues,
      layout: {
        summary: summaryR,
        bars: barsR,
        list: listR,
        moreBtn: moreR,
        scoreText: scoreNum?.textContent?.trim() || "",
        countText: scoreCount?.textContent?.trim() || "",
        orderOk: summaryR && barsR && listR ? summaryR.top <= barsR.top && barsR.top <= listR.top : false,
      },
      dock: dockR
        ? {
            visible: dockR.visible,
            top: dockR.top,
            overlapMore: dockOverlapMore,
            overlapSection: dockOverlapSection,
            sectionPaddingBottom: parseFloat(getComputedStyle(section).paddingBottom) || 0,
          }
        : null,
      viewportWidth: vw,
    };
  });
}

/**
 * @param {string[]} gaugeIssues
 * @param {string[]} uxIssues
 */
export function judgeReviewSection(gaugeIssues, uxIssues) {
  const all = [...gaugeIssues, ...uxIssues];
  return all.length ? "FAIL" : "PASS";
}

/**
 * @param {import('playwright').Page} page
 */
export async function auditReviewGauge(page) {
  return page.evaluate(() => {
    const issues = [];
    const fills = [...document.querySelectorAll(".food-reviews-bar__fill, .shop-reviews-bar__fill")];
    const rows = [...document.querySelectorAll(".food-reviews-bar, .shop-reviews-bar")].map((row) => {
      const label = row.querySelector(".food-reviews-bar__label, .shop-reviews-bar__label")?.textContent?.trim() || "";
      const pct = row.querySelector(".food-reviews-bar__pct, .shop-reviews-bar__pct")?.textContent?.trim() || "";
      const fill = row.querySelector(".food-reviews-bar__fill, .shop-reviews-bar__fill");
      const styleW = fill?.style?.width || "";
      const rectW = fill?.getBoundingClientRect?.().width || 0;
      const trackW = fill?.parentElement?.getBoundingClientRect?.().width || 0;
      return { label, pct, styleW, rectW: Math.round(rectW), trackW: Math.round(trackW) };
    });

    if (!fills.length) issues.push("評価ゲージDOMなし");
    for (const f of fills) {
      if (f.getBoundingClientRect().width <= 0 && parseFloat(f.style.width) > 0) {
        issues.push(`fill未描画 width=${f.style.width}`);
      }
      if (getComputedStyle(f).display !== "block") issues.push(`display=${getComputedStyle(f).display}`);
    }

    const star5 = rows.find((r) => r.label === "5");
    const star4 = rows.find((r) => r.label === "4");
    const star3 = rows.find((r) => r.label === "3");
    if (star5 && star5.styleW !== "100%") issues.push(`5星幅 expected 100% got ${star5.styleW}`);
    if (star4 && star4.styleW !== "28%") issues.push(`4星幅 expected 28% got ${star4.styleW}`);
    if (star3 && star3.styleW !== "7%") issues.push(`3星幅 expected 7% got ${star3.styleW}`);

    return {
      profile: document.body.dataset.shopCategoryProfile || "",
      hasBars: fills.length > 0,
      rows,
      issues,
      url: location.pathname + location.search,
    };
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} outDir
 * @param {string} vpLabel
 * @param {{ filePrefix?: string }} [opts]
 */
export async function captureReviewGaugeShots(page, outDir, vpLabel, opts = {}) {
  const prefix = opts.filePrefix || `${vpLabel}-08-review-gauge`;
  const viewportFile = `${prefix}-viewport.png`;
  const sectionFile = `${prefix}-section.png`;

  await page.screenshot({ path: path.join(outDir, viewportFile), fullPage: false });

  const section = page.locator("#section-reviews");
  if (await section.count()) {
    await section.screenshot({ path: path.join(outDir, sectionFile) });
  }

  return { viewportFile, sectionFile };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} base
 * @param {string} shopId
 */
export async function gotoShopDetailForReviewGauge(page, base, shopId = REVIEW_GAUGE_SHOP_ID) {
  const url = new URL(`detail-shop-store.html?id=${encodeURIComponent(shopId)}`, base.endsWith("/") ? base : `${base}/`);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
}

/**
 * @param {string[]} issues
 */
export function judgeReviewGauge(issues) {
  return issues.length ? "FAIL" : "PASS";
}
