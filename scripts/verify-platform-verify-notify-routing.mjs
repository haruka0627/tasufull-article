#!/usr/bin/env node
/**
 * プラット通知 v3.1 — 18件「確認する」導線検証 + 390px スクショ
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "platform-verify-notify-routing");
const MARKERS = ["tasful_platform_notify_master_v2"];

/** @type {Array<{ id: string, title: string, rule: string, validate: (url: string) => boolean }>} */
const CASES = [
  {
    id: "platform-verify-job-full-apply-001",
    title: "この求人に応募がありました",
    rule: "求人 → 応募者一覧",
    validate: (u) => /detail-job\.html/i.test(u) && /view=applications|#applications/i.test(u),
  },
  {
    id: "platform-verify-job-full-applicant-start-001",
    title: "掲載者とのやりとりを開始してください（求人）",
    rule: "求人 → やりとりチャット",
    validate: (u) => /chat-detail\.html/i.test(u) && /thread=/i.test(u),
  },
  {
    id: "platform-verify-worker-request-001",
    title: "依頼が届きました",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=worker/i.test(u),
  },
  {
    id: "platform-verify-worker-accept-001",
    title: "依頼を受諾しました",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=worker/i.test(u),
  },
  {
    id: "platform-verify-skill-consult-001",
    title: "相談が届きました（スキル）",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=skill/i.test(u),
  },
  {
    id: "platform-verify-skill-purchase-001",
    title: "スキルが購入されました",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=skill/i.test(u),
  },
  {
    id: "platform-verify-product-inquiry-001",
    title: "商品について問い合わせがありました",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=product/i.test(u),
  },
  {
    id: "platform-verify-product-purchase-001",
    title: "商品が購入されました",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=product/i.test(u),
  },
  {
    id: "platform-verify-business-consult-001",
    title: "相談が届きました（業務）",
    rule: "Connectなし → 手数料支払い",
    validate: (u) =>
      /platform-chat-fee-pay\.html/i.test(u) && /category=business_service/i.test(u),
  },
  {
    id: "platform-verify-shop-inquiry-001",
    title: "問い合わせが届きました",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=shop_store/i.test(u),
  },
  {
    id: "platform-verify-shop-purchase-001",
    title: "商品が購入されました（店舗）",
    rule: "Connectなし → 手数料支払い",
    validate: (u) => /platform-chat-fee-pay\.html/i.test(u) && /category=shop_store/i.test(u),
  },
  {
    id: "platform-verify-builder-publish-001",
    title: "新しい案件が公開されました",
    rule: "Builder → 公開詳細",
    validate: (u) => /public-board-detail\.html/i.test(u),
  },
  {
    id: "platform-verify-builder-hired-001",
    title: "採用されました（Builder）",
    rule: "Builder → スレッド",
    validate: (u) =>
      /builder\/board-thread\.html/i.test(u) && !/detail-job\.html/i.test(u),
  },
  {
    id: "platform-verify-builder-completion-001",
    title: "完了報告が届きました",
    rule: "Builder → 完了確認",
    validate: (u) => /builder\/board-thread\.html/i.test(u) && /#completion/i.test(u),
  },
  {
    id: "platform-verify-anpi-001",
    title: "安否確認通知",
    rule: "安否 → ダッシュボード",
    validate: (u) => /anpi-dashboard\.html/i.test(u),
  },
  {
    id: "platform-verify-ai-001",
    title: "AIからお知らせがあります",
    rule: "AI → AIタブ",
    validate: (u) => /talk-home\.html/i.test(u) && /tab=ai/i.test(u),
  },
  {
    id: "platform-verify-official-001",
    title: "運営からのお知らせ",
    rule: "公式 → TALK",
    validate: (u) => /talk-home\.html/i.test(u) && /tab=chat/i.test(u),
  },
  {
    id: "platform-verify-system-001",
    title: "重要なお知らせがあります",
    rule: "運営 → マイページ",
    validate: (u) => /dashboard\.html/i.test(u),
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.addInitScript(({ markers }) => {
  markers.forEach((k) => localStorage.removeItem(k));
}, { markers: MARKERS });

const results = [];

for (let i = 0; i < CASES.length; i += 1) {
  const c = CASES[i];
  const slug = String(i + 1).padStart(2, "0");
  const fileSlug = c.id.replace(/^platform-verify-/, "").replace(/-001$/, "");

  await page.goto(`${BASE}/talk-home.html?tab=notify`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);

  const linkMeta = await page.evaluate((notifyId) => {
    const row = window.TasuTalkNotifications?.findById?.(notifyId);
    const nav = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    const card = document.querySelector(`[data-talk-notify-id="${notifyId}"]`);
    const anchor = card?.querySelector("[data-talk-notify-action]");
    return {
      resolvedHref: nav?.href || "",
      anchorHref: anchor?.getAttribute("href") || "",
      cardFound: Boolean(card),
    };
  }, c.id);

  if (!linkMeta.cardFound) {
    results.push({ ...c, ok: false, error: "card not found", url: "" });
    continue;
  }

  const action = page.locator(`article[data-talk-notify-id="${c.id}"]`);
  await action.scrollIntoViewIfNeeded();
  await action.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);

  const url = page.url();
  const pathAndQuery = url.replace(/^https?:\/\/[^/]+/, "");
  const ok = c.validate(pathAndQuery);

  await page.screenshot({
    path: path.join(OUT_DIR, `${slug}-${fileSlug}-390.png`),
    fullPage: false,
  });

  results.push({
    id: c.id,
    title: c.title,
    rule: c.rule,
    resolvedHref: linkMeta.resolvedHref,
    anchorHref: linkMeta.anchorHref,
    actualUrl: pathAndQuery,
    ok,
  });
}

const report = {
  version: results.length,
  generatedAt: new Date().toISOString(),
  pass: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  results,
};

fs.writeFileSync(path.join(OUT_DIR, "routing-report.json"), JSON.stringify(report, null, 2));

console.log("\n=== 18件 導線検証 ===\n");
for (const r of results) {
  const mark = r.ok ? "OK" : "NG";
  console.log(`${mark}\t${r.id}\t${r.title}`);
  console.log(`    期待: ${r.rule}`);
  console.log(`    実URL: ${r.actualUrl || r.error || "(なし)"}`);
  if (r.resolvedHref) console.log(`    リンク: ${r.resolvedHref}`);
  console.log("");
}

if (report.fail > 0) {
  console.error(`FAIL: ${report.fail}/${results.length}`);
  await closeAllBrowsers();
  process.exit(1);
}
console.log(`PASS: ${report.pass}/${results.length}`);
console.log(`Report: ${OUT_DIR}/routing-report.json`);
});
