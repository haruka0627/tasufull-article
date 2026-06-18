/**
 * 市場フッター リンク監査
 * node scripts/audit-market-footer-links.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots", "market-footer-link-audit");

const EXPECTED = {
  "market-top": "shop-store.html",
  "vendor-list": "shop-vendors.html",
  "order-history": "shop-market-order-history.html",
  "cart": "shop-market-cart.html",
};

const PAGES = [
  {
    id: "checkout",
    label: "注文確認",
    path: "shop-market-checkout.html?mode=buy&shopId=demo-shop-bakery&productId=p-0&quantity=1",
    wait: "[data-tasful-checkout-layout]:not([hidden])",
  },
  {
    id: "complete",
    label: "注文完了",
    path: "shop-market-complete.html",
    wait: ".tasful-market-complete-main",
  },
];

const FORBIDDEN_HREFS = [
  /^detail-shop-store\.html/,
  /^detail-shop\.html/,
  /^shop-products\.html/,
  /^shop-store-cart\.html/,
  /^shop-store-checkout\.html/,
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = await findDevServerBaseUrl({ probePath: "shop-store.html" });
await withPlaywrightBrowser(async (browser) => {const report = { capturedAt: new Date().toISOString(), base, pages: {}, overall: "PASS" };

for (const pageDef of PAGES) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/${pageDef.path}`, { waitUntil: "networkidle" });
  try {
    await page.waitForSelector(pageDef.wait, { timeout: 15000 });
  } catch {
    /* demo may still render footer */
  }

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".tasful-market-footer a")).map((a) => ({
      key: a.getAttribute("data-tasful-market-footer-link") || "",
      text: a.textContent.trim(),
      href: a.getAttribute("href") || "",
    }))
  );

  const checks = [];
  for (const [key, expectedHref] of Object.entries(EXPECTED)) {
    const row = links.find((l) => l.key === key);
    if (!row) {
      checks.push({ level: "FAIL", key, expectedHref, actual: null, detail: "リンク未検出" });
      continue;
    }
    if (row.href !== expectedHref) {
      checks.push({ level: "FAIL", key, label: row.text, expectedHref, actual: row.href, detail: "href不一致" });
    } else {
      checks.push({ level: "PASS", key, label: row.text, href: row.href });
    }
  }

  for (const row of links) {
    if (FORBIDDEN_HREFS.some((re) => re.test(row.href))) {
      checks.push({
        level: "FAIL",
        key: row.key || row.text,
        href: row.href,
        detail: "店舗販売詳細導線への誤接続",
      });
    }
  }

  // 市場TOP クリック遷移
  const marketLink = page.locator('[data-tasful-market-footer-link="market-top"]');
  await marketLink.click();
  await page.waitForLoadState("networkidle");
  const afterMarketTop = page.url();
  const marketTopOk = /\/shop-store\.html(?:\?|#|$)/.test(afterMarketTop);
  checks.push({
    level: marketTopOk ? "PASS" : "FAIL",
    key: "market-top-navigation",
    detail: marketTopOk ? `遷移先 ${afterMarketTop}` : `誤遷移 ${afterMarketTop}`,
  });

  if (marketTopOk) {
    const breadcrumb = await page.evaluate(() => {
      const el = document.querySelector("[data-breadcrumb]");
      return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
    });
    const breadcrumbOk = /TASFUL市場/.test(breadcrumb) && !/店舗・販売TOP/.test(breadcrumb);
    checks.push({
      level: breadcrumbOk ? "PASS" : "WARNING",
      key: "market-top-breadcrumb",
      detail: breadcrumb || "(なし)",
    });
  }

  await page.screenshot({ path: path.join(OUT_DIR, `${pageDef.id}-footer-390.png`), fullPage: true });

  const grade = checks.some((c) => c.level === "FAIL")
    ? "FAIL"
    : checks.some((c) => c.level === "WARNING")
      ? "WARNING"
      : "PASS";

  report.pages[pageDef.id] = { label: pageDef.label, links, checks, grade };
  if (grade === "FAIL") report.overall = "FAIL";
  else if (grade === "WARNING" && report.overall === "PASS") report.overall = "WARNING";

  await page.close();
}

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

const md = `# 市場フッター リンク監査

生成: ${report.capturedAt}
総合: **${report.overall}**

## 期待値
| キー | ラベル | href |
|------|--------|------|
| market-top | 市場TOP | shop-store.html |
| vendor-list | 店舗一覧 | shop-vendors.html |
| order-history | 注文履歴 | shop-market-order-history.html |
| cart | カート | shop-market-cart.html |

${Object.entries(report.pages)
  .map(([id, p]) => {
    const lines = [`### ${p.label}（${id}） — ${p.grade}`, ""];
    for (const c of p.checks) {
      const icon = c.level === "PASS" ? "✅" : c.level === "WARNING" ? "⚠️" : "❌";
      lines.push(`- ${icon} ${c.key}: ${c.detail || c.href || c.expectedHref || ""}`);
    }
    lines.push("", "**フッター全リンク**", "```json", JSON.stringify(p.links, null, 2), "```", "");
    return lines.join("\n");
  })
  .join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);
});

console.log("OVERALL:", report.overall);
console.log(md);

await closeAllBrowsers();
