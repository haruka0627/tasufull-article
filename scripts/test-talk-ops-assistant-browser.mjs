#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * TASFUL TALK 運営通知センター E2E
 *   node scripts/test-talk-ops-assistant-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel.replace(/^\//, "")}`;
  const [filePart, query] = rel.split("?");
  const url = pathToFileURL(path.join(root, filePart));
  if (query) url.search = `?${query}`;
  return url.href;
}

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_cases_v1",
  "tasu_ai_ops_events_v1",
  "tasful:builder:partner_visibility:v1",
  "tasful:builder:partner_status_events:v1",
  "tasful:builder:partner_evaluations:v1",
  "tasful_chat_threads",
  "tasful_chat_messages",
];

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seedSupport(page) {
  return page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support service" };

    svc.submitInquiry({
      user_id: "talk_ops",
      title: "返金希望",
      body: "全額返金をお願いします。",
    });
    window.TasuSupportTicketStore.saveTicket({
      id: "talk_ops_critical",
      title: "重大事故",
      body: "法的対応と損害賠償",
      user_id: "talk_ops",
      source: "test",
      category: "legal_or_risk",
      severity: "critical",
      status: "needs_review",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    svc.submitInquiry({
      user_id: "talk_ops",
      title: "Connect本人確認",
      body: "Stripe Connectの本人確認エラーで登録できません。",
    });
    svc.submitInquiry({
      user_id: "talk_ops",
      title: "通報",
      body: "迷惑行為の通報です。",
    });
    svc.submitInquiry({
      user_id: "talk_ops",
      title: "外部決済",
      body: "TASFUL外で銀行振込の外部決済を勧められました。",
    });
    return { ok: true };
  });
}

async function seedOpsExtras(page) {
  return page.evaluate(() => {
    window.TasuTalkOpsAssistant?.clearRoomForTests?.();
    window.TasuAiOpsCaseStore?.clearAllForTests?.();
    window.TasuBuilderPartnerEval?.clearAllForTests?.();
    globalThis.__BUILDER_DEMO_PARTNER_NAMES__ = [
      { display_name: "テスト非表示工務", partner_id: "demo-talk-ops-hide" },
    ];
    const c = window.TasuAiOpsCaseStore?.createCaseFromInput?.(
      {
        title: "違反報告テスト",
        body: "規約違反の違反報告です。",
        ops_category: "violation_report",
        status: "needs_review",
        ai_risk: "high",
      },
      false
    );
    if (!c) return { ok: false, reason: "ai ops case" };
    const hide = window.TasuBuilderPartnerEval.applyPartnerHideStatus({
      partner_name: "テスト非表示工務",
      reason: "ドタキャン",
    });
    if (!hide.ok) return { ok: false, reason: hide.error };
    return { ok: true };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seededSupport = await seedSupport(page);
  if (!seededSupport.ok) fail(`seed support: ${seededSupport.reason}`);
  pass("Supportテストデータ投入");

  await page.goto(pageUrl("talk-ops-room.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuTalkOpsAssistant, { timeout: 15000 });

  const seededExtras = await seedOpsExtras(page);
  if (!seededExtras.ok) fail(`seed extras: ${seededExtras.reason}`);
  pass("AI運営・Builderテストデータ投入");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuTalkOpsAssistant, { timeout: 15000 });
  await page.waitForSelector("[data-talk-ops-hub-section]", { timeout: 15000 });

  const sections = await page.locator("[data-talk-ops-hub-section]").count();
  if (sections !== 7) fail(`hub sections count ${sections}, expected 7`);
  pass("7つの集約セクションが表示される");

  const hubText = await page.locator("[data-talk-ops-hub]").innerText();
  const requiredSections = [
    "本日の優先対応",
    "未対応問い合わせ",
    "通報",
    "安否",
    "Connect関連",
    "Builder",
    "TALK通知",
  ];
  for (const label of requiredSections) {
    if (!hubText.includes(label)) fail(`missing hub section: ${label}`);
  }
  pass("ハブセクション見出し（優先・未対応・通報・安否・Connect・Builder・TALK通知）");

  if (!/Connect|通報|違反|非表示|重大/.test(hubText)) {
    fail(`expected alert types in hub: ${hubText.slice(0, 300)}`);
  }
  pass("ハブ内に Connect / 通報 / 違反 / 非表示 系の項目");

  const summary = await page.locator("[data-talk-ops-summary]").innerText();
  if (!summary.includes("本日の状況") && !summary.includes("おはよう")) {
    fail("daily summary missing");
  }
  pass("運営サマリー生成");

  await page.locator("[data-talk-ops-command-input]").fill("Connect問題");
  await page.locator("[data-talk-ops-command-form]").evaluate((f) => f.requestSubmit());
  await page.waitForFunction(() => {
    const pre = document.querySelector("[data-talk-ops-command-result]");
    return pre && !pre.hidden && pre.textContent.includes("Connect");
  });
  pass("運営コマンド検索（Connect問題）");

  const links = await page.locator("[data-talk-ops-detail-link]").all();
  if (links.length < 1) fail("detail links missing");
  const hrefs = await Promise.all(links.map((a) => a.getAttribute("href")));
  const joined = hrefs.join(" ");
  if (!/admin-ai-operations|support-trouble|admin-partner/.test(joined)) {
    fail(`admin links: ${joined}`);
  }
  pass("各管理画面リンク");

  const forbidden = [
    "[data-ai-ops-action]",
    "[data-support-action]",
    "[data-ops-dash-execute]",
    "button[data-talk-ops-refund]",
  ];
  for (const sel of forbidden) {
    if (await page.locator(sel).count()) fail(`forbidden control: ${sel}`);
  }
  pass("実行ボタンが存在しない");

  await page.goto(pageUrl("talk-home.html?talkAdmin=1"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuTalkData, { timeout: 20000 });
  await page.waitForSelector('[data-talk-channel-row="system"]', { timeout: 20000 });

  const sideNav = page.locator("aside .dash-nav-link[data-talk-ops-nav-link]").first();
  if (!(await sideNav.isVisible())) fail("AI運営秘書が左メニューに表示されていない");
  const sideHref = await sideNav.getAttribute("href");
  if (!sideHref?.includes("admin-operations-dashboard.html")) fail(`side nav href: ${sideHref}`);
  pass("talkAdmin=1 時に左メニューに AI運営秘書（ダッシュボードへ）");

  await page.goto(pageUrl("talk-home.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuTalkData, { timeout: 20000 });
  if (await page.locator("aside .dash-nav-link[data-talk-ops-nav-link]").isVisible()) {
    fail("一般表示で AI運営秘書が左メニューに出ている");
  }
  pass("一般ユーザーには左メニュー AI運営秘書 非表示");

  await page.waitForFunction(() => document.querySelector('[data-talk-tab="notify"]'), { timeout: 15000 });
  if (!(await page.locator('[data-talk-tab="notify"]').count())) fail("notify tab missing");
  pass("既存TASFUL TALK（通知タブ）維持");

  console.log("\nAll TALK operations assistant tests passed.");
    });
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
