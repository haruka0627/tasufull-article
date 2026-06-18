#!/usr/bin/env node
/**
 * 安否通知センター E2E
 *
 *   node scripts/test-anpi-notifications-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";

const SEED_LOGS = [
  {
    id: "anpi_seed_urgent",
    event_type: "urgent_keyword_detected",
    user_id: "anpi_user_e2e",
    user_name: "山田太郎",
    contract_holder_id: "holder_e2e",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】緊急キーワード",
    message: "息苦しいとの相談がありました。",
    intent: "urgent",
    source_type: "cross_search",
    item_category: "",
    phone_masked: "",
    status: "local_only",
    is_read: false,
    priority: "urgent",
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "anpi_seed_call",
    event_type: "call_consent_accepted",
    user_id: "anpi_user_e2e",
    user_name: "山田太郎",
    contract_holder_id: "holder_e2e",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】電話（同意）",
    message: "業者へ電話しようとしています。",
    intent: "repair_request",
    source_type: "business_service",
    item_id: "demo-biz-repair-1",
    item_title: "水道修理",
    item_category: "業務サービス",
    phone_masked: "03-***-0199",
    status: "local_only",
    is_read: false,
    priority: "high",
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "anpi_seed_ai",
    event_type: "ai_search",
    user_id: "anpi_user_e2e",
    user_name: "山田太郎",
    contract_holder_id: "holder_e2e",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】AI検索",
    message: "買い物代行を頼みたいと相談",
    intent: "delivery_request",
    source_type: "cross_search",
    item_category: "",
    phone_masked: "",
    status: "local_only",
    is_read: true,
    priority: "normal",
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
];

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function isIgnorableConsoleError(text) {
  const t = String(text || "");
  return (
    t.includes("Failed to load resource") ||
    t.includes("net::ERR_") ||
    t.includes("favicon") ||
    t.includes("404") ||
    t.includes("supabase")
  );
}

async function seedLogs(page) {
  await page.evaluate(
    ({ key, logs }) => {
      localStorage.setItem(key, JSON.stringify(logs));
    },
    { key: STORAGE_LOGS, logs: SEED_LOGS }
  );
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      errors.push(msg.text());
    }
  });

  await page.goto(`${BASE}/anpi-notifications.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.TasuAnpiNotifications), { timeout: 10000 });
  await seedLogs(page);
  await page.evaluate(() => window.TasuAnpiNotificationsPage?.renderList?.());

  const unread = await page.locator("[data-anpi-summary-unread]").textContent();
  const total = await page.locator("[data-anpi-summary-total]").textContent();
  const urgent = await page.locator("[data-anpi-summary-urgent]").textContent();

  if (unread?.trim() !== "2件") fail(`${vp.name} unread summary`, unread);
  else pass(`${vp.name} unread summary`, unread);
  if (total?.trim() !== "3件") fail(`${vp.name} total summary`, total);
  else pass(`${vp.name} total summary`, total);
  if (urgent?.trim() !== "1件") fail(`${vp.name} urgent summary`, urgent);
  else pass(`${vp.name} urgent summary`, urgent);

  const urgentZone = page.locator("[data-anpi-urgent-zone]");
  if (await urgentZone.isHidden()) fail(`${vp.name} urgent zone visible`);
  else pass(`${vp.name} urgent zone visible`);

  const cards = page.locator("[data-anpi-card]");
  const cardCount = await cards.count();
  if (cardCount < 3) fail(`${vp.name} list cards`, String(cardCount));
  else pass(`${vp.name} list cards`, String(cardCount));

  const urgentCard = page.locator(".anpi-notification-card--urgent").first();
  if (!(await urgentCard.count())) fail(`${vp.name} urgent card style`);
  else pass(`${vp.name} urgent card style`);

  await page.locator('[data-log-id="anpi_seed_call"] [data-anpi-toggle]').click();
  await page.waitForSelector('[data-log-id="anpi_seed_call"] [data-anpi-detail]:not([hidden])', {
    timeout: 5000,
  });
  pass(`${vp.name} detail expand`);

  const detailText = await page
    .locator('[data-log-id="anpi_seed_call"] .anpi-notification-detail__body')
    .textContent();
  if (!detailText?.includes("電話")) fail(`${vp.name} detail body`);
  else pass(`${vp.name} detail body`);

  await page.waitForFunction(
    () => document.querySelector("[data-anpi-summary-unread]")?.textContent?.trim() === "1件",
    { timeout: 5000 }
  );
  pass(`${vp.name} mark read`);

  const readState = await page.evaluate(() => {
    const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
    const call = logs.find((l) => l.id === "anpi_seed_call");
    return call?.is_read === true;
  });
  if (!readState) fail(`${vp.name} is_read in storage`);
  else pass(`${vp.name} is_read in storage`);

  if (JSON.stringify(SEED_LOGS).includes("03-5555-0199")) {
    fail(`${vp.name} seed has full phone`);
  } else {
    pass(`${vp.name} no full phone in seed`);
  }

  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_LOGS);
  await page.locator("[data-anpi-refresh]").click();
  await page.waitForSelector("[data-anpi-empty]:not([hidden])", { timeout: 5000 });
  pass(`${vp.name} empty state`);

  if (errors.length) fail(`${vp.name} console`, errors.slice(0, 2).join(" | "));
  else pass(`${vp.name} console clean`);

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  await runViewport(browser, { name: "PC1280", width: 1280, height: 900 });
  await runViewport(browser, { name: "SP390", width: 390, height: 844 });
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    failed.forEach((f) => console.error(`FAIL: ${f.step} ${f.detail || ""}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
