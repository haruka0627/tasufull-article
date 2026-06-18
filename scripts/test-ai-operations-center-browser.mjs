#!/usr/bin/env node
/**
 * AI運営センター E2E
 *   node scripts/test-ai-operations-center-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  return pathToFileURL(path.join(root, rel)).href;
}

const KEYS = [
  "tasu_ai_ops_cases_v1",
  "tasu_ai_ops_events_v1",
  "tasu_ai_ops_admin_notifications_v1",
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_support_admin_notifications_v1",
];

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seedCases(page) {
  return page.evaluate(() => {
    window.TasuAiOpsCaseStore?.clearAllForTests?.();
    [
      "tasu_support_tickets_v1",
      "tasu_support_events_v1",
      "tasu_support_admin_notifications_v1",
    ].forEach((k) => localStorage.removeItem(k));

    const samples = [
      { title: "返金希望", body: "案件完了後の品質クレーム。全額返金を希望します。" },
      { title: "チャージバック", body: "Stripeでチャージバック通知が届きました。" },
      { title: "Connect本人確認", body: "Stripe Connectの本人確認エラーで登録できません。" },
      { title: "外部決済", body: "TASFUL外で銀行振込の外部決済を勧められました。" },
      { title: "直営業", body: "プラットフォーム外で直営業の連絡がありました。" },
      { title: "通報", body: "他ユーザーから迷惑行為の通報です。" },
      { title: "法的クレーム", body: "現場で事故が発生し損害賠償について法的対応を求めます。弁護士。" },
      { title: "BAN候補", body: "アカウント停止とBANを検討してください。重大違反。" },
    ];

    const created = [];
    samples.forEach((s) => {
      const t = window.TasuSupportTicketService.submitInquiry({
        user_id: "test_ops",
        title: s.title,
        body: s.body,
        source: "test",
      });
      const c = window.TasuAiOpsCaseStore.createCaseFromInput(
        {
          title: s.title,
          body: s.body,
          support_ticket_id: t.ticket.id,
          support_category: t.ticket.category,
          severity: t.ticket.severity,
          status: t.ticket.status === "ai_replied" ? "open" : "needs_review",
        },
        true
      );
      created.push(c);
    });
    return created.map((c) => ({
      id: c.id,
      ops: c.ops_category,
      risk: c.ai_risk,
      hasSummary: Boolean(c.ai_summary),
      hasReply: Boolean(c.ai_reply_draft),
    }));
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(pageUrl("admin-ai-operations-center.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.TasuAiOpsCaseStore && window.TasuAiOpsProvider,
    { timeout: 15000 }
  );

  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seeded = await seedCases(page);
  if (seeded.length < 8) fail(`seed count ${seeded.length}`);

  const refund = seeded.find((c) => c.ops === "refund");
  if (!refund?.hasSummary || !refund?.hasReply) fail(`refund case AI fields ${JSON.stringify(refund)}`);
  pass("返金問い合わせ — AI要約・返信案");

  const cb = seeded.find((c) => c.ops === "chargeback");
  if (!cb) fail("chargeback case missing");
  pass("チャージバック");

  const connect = seeded.find((c) => c.ops === "connect_issue");
  if (!connect) fail("connect case missing");
  pass("Connect本人確認エラー");

  if (!seeded.some((c) => c.ops === "external_payment")) fail("external_payment");
  pass("外部決済誘導");

  if (!seeded.some((c) => c.ops === "direct_sales")) fail("direct_sales");
  pass("直営業");

  if (!seeded.some((c) => c.ops === "report")) fail("report");
  pass("通報");

  if (!seeded.some((c) => c.ops === "legal")) fail("legal");
  pass("法的クレーム");

  if (!seeded.some((c) => c.ops === "ban_candidate")) fail("ban_candidate");
  pass("BAN候補");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ai-ops-case-id]");

  await page.locator("[data-ai-ops-command-input]").fill("返金案件だけ見せて");
  await page.locator("[data-ai-ops-command-run]").click();
  await page.waitForFunction(() => {
    const items = document.querySelectorAll("[data-ai-ops-case-id]");
    return items.length >= 1 && items[0].textContent.includes("返金");
  });
  pass("運営コマンド「返金案件だけ見せて」");

  await page.locator("[data-ai-ops-case-id]").first().click();
  await page.locator('[data-ai-ops-action="refund_candidate"]').click();
  const modal = page.locator("[data-ai-ops-modal]");
  if (!(await modal.isVisible())) fail("返金候補でモーダルなし");
  pass("管理者アクションは確認モーダル");

  await page.locator("[data-ai-ops-modal-confirm]").click();
  await page.waitForTimeout(300);

  const notifyCount = await page.evaluate(() => window.TasuAiOpsNotify.getUnreadCount());
  if (notifyCount < 1) fail(`notify count ${notifyCount}`);
  pass("high/critical 系は運営通知");

  await page.goto(pageUrl("builder/index.html"), { waitUntil: "domcontentloaded" });
  if (!(await page.locator("[data-builder-root]").count())) fail("builder broken");
  pass("既存 Builder index 維持");

  console.log("\nAll AI operations center tests passed.");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
