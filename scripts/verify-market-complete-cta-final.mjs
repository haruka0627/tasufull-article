/**
 * 注文完了 CTA 最終目視確認 — 市場/店舗販売 × SP 390px
 * node scripts/verify-market-complete-cta-final.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { buildLocalPageUrl, findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { finalizeScreenshotRun } from "./lib/finalize-screenshot-run.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOLDER_ID = "market-complete-cta-final";
const OUT_DIR = path.join(ROOT, "screenshots", FOLDER_ID);
const LAST_ORDER_KEY = "tasu_market_last_order";

const FLOWS = [
  {
    id: "market",
    label: "市場購入フロー",
    urlQuery: "source=market",
    order: {
      id: "TM-CTA-MARKET",
      source: "market",
      channel: "shop_market",
      lines: [
        {
          shopId: "demo-shop-bakery",
          productId: "p-0",
          title: "クロワッサン",
          shopName: "麦の香",
          qty: 1,
        },
      ],
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
    label: "店舗販売フロー",
    urlQuery: "source=store",
    order: {
      id: "TS-CTA-STORE",
      source: "store",
      channel: "shop_store",
      lines: [
        {
          shopId: "demo-shop-haru-cafe",
          productId: "p-0",
          title: "季節のパンケーキ",
          shopName: "HARU CAFE",
          qty: 1,
        },
      ],
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

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-market-complete.html" });
await withPlaywrightBrowser(async (browser) => {const report = {
  capturedAt: new Date().toISOString(),
  viewport: "390",
  frozen: false,
  overall: "PASS",
  flows: {},
};

for (const flow of FLOWS) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const url = buildLocalPageUrl(base, `shop-market-complete.html?${flow.urlQuery}`);

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, order }) => localStorage.setItem(key, JSON.stringify(order)),
    { key: LAST_ORDER_KEY, order: flow.order }
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-tasful-complete-primary-link]");

  const metrics = await page.evaluate(() => {
    const primary = document.querySelector("[data-tasful-complete-primary-link]");
    const secondary = document.querySelector("[data-tasful-complete-secondary-link]");
    const btnInfo = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        href: el.getAttribute("href") || "",
        w: Math.round(r.width),
        h: Math.round(r.height),
        minH: cs.minHeight,
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        lineCount: Math.round(el.scrollHeight / (parseFloat(cs.lineHeight) || 20)),
        whiteSpace: cs.whiteSpace,
      };
    };
    return {
      bodySource: document.body.dataset.tasfulCompleteSource || "",
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      primary: btnInfo(primary),
      secondary: btnInfo(secondary),
    };
  });

  const checks = [];
  const e = flow.expect;

  checks.push({
    level: metrics.bodySource === e.source ? "PASS" : "FAIL",
    item: "流入元",
    detail: `data-tasful-complete-source=${metrics.bodySource}`,
  });

  checks.push({
    level: metrics.primary?.text === e.primaryLabel ? "PASS" : "FAIL",
    item: "primary ラベル",
    detail: `${metrics.primary?.text} (期待: ${e.primaryLabel})`,
  });

  checks.push({
    level: metrics.secondary?.text === e.secondaryLabel ? "PASS" : "FAIL",
    item: "secondary ラベル",
    detail: `${metrics.secondary?.text} (期待: ${e.secondaryLabel})`,
  });

  checks.push({
    level: metrics.secondary?.href === e.secondaryHref ? "PASS" : "FAIL",
    item: "secondary href",
    detail: `${metrics.secondary?.href} (期待: ${e.secondaryHref})`,
  });

  checks.push({
    level: metrics.primary?.href?.includes(e.primaryHrefIncludes) ? "PASS" : "FAIL",
    item: "primary href",
    detail: metrics.primary?.href,
  });

  checks.push({
    level: metrics.secondary?.href !== e.forbidSecondaryHref ? "PASS" : "FAIL",
    item: "誤遷移なし",
    detail: `secondary ≠ ${e.forbidSecondaryHref}`,
  });

  for (const [role, btn] of [
    ["primary", metrics.primary],
    ["secondary", metrics.secondary],
  ]) {
    if (!btn) {
      checks.push({ level: "FAIL", item: `${role} ボタン`, detail: "未検出" });
      continue;
    }
    checks.push({
      level: btn.h >= 44 ? "PASS" : "FAIL",
      item: `${role} 高さ`,
      detail: `${btn.h}px (min ${btn.minH})`,
    });
    const singleLine = btn.scrollH <= btn.clientH + 2;
    checks.push({
      level: singleLine ? "PASS" : "FAIL",
      item: `${role} ラベル折れ`,
      detail: singleLine ? "1行表示" : `scrollH ${btn.scrollH} > clientH ${btn.clientH}`,
    });
  }

  checks.push({
    level: metrics.scrollW <= metrics.innerW ? "PASS" : "FAIL",
    item: "横スクロール",
    detail: `scrollW ${metrics.scrollW} / innerW ${metrics.innerW}`,
  });

  const grade = checks.some((c) => c.level === "FAIL")
    ? "FAIL"
    : checks.some((c) => c.level === "WARNING")
      ? "WARNING"
      : "PASS";

  if (grade === "FAIL") report.overall = "FAIL";

  await page.screenshot({
    path: path.join(OUT_DIR, `complete-cta-${flow.id}-390.png`),
    fullPage: true,
  });

  report.flows[flow.id] = { label: flow.label, url, metrics, checks, grade };
  await context.close();
}

if (report.overall === "PASS") {
  report.frozen = true;
  report.freezeNote = "注文完了CTA — PASS凍結（市場/店舗販売導線・SP390）";
}

const md = `# 注文完了 CTA 最終目視確認

生成: ${report.capturedAt}
ビューポート: **390px**
総合: **${report.overall}**
凍結: ${report.frozen ? "✅ PASS凍結" : "—"}

${Object.entries(report.flows)
  .map(([id, f]) => {
    const lines = [`## ${f.label}（${id}） — ${f.grade}`, "", `URL: \`${f.url}\``, ""];
    for (const c of f.checks) {
      const icon = c.level === "PASS" ? "✅" : c.level === "WARNING" ? "⚠️" : "❌";
      lines.push(`- ${icon} ${c.item}: ${c.detail}`);
    }
    lines.push("", `![${id}](complete-cta-${id}-390.png)`, "");
    return lines.join("\n");
  })
  .join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);

await finalizeScreenshotRun(ROOT, FOLDER_ID, {
  title: "注文完了 CTA 最終確認",
  report: {
    ...report,
    pages: Object.entries(report.flows).map(([id, f]) => ({
      id,
      label: f.label,
      verdict: f.grade,
    })),
  },
  targetPage: "shop-market-complete.html",
  viewports: ["390"],
  overall: report.overall,
  screenshotCatalog: FLOWS.map((f) => ({
    file: `complete-cta-${f.id}-390.png`,
    label: `${f.label} 390px`,
    url: `shop-market-complete.html?${f.urlQuery}`,
    viewport: "390",
  })),
});

});
console.log("OVERALL:", report.overall, report.frozen ? "(FROZEN)" : "");
console.log(md);
await closeAllBrowsers();
process.exit(report.overall === "PASS" ? 0 : 1);
