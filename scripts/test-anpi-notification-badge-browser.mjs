#!/usr/bin/env node
/**
 * 安否通知バッジ・dashboard 緊急アラート E2E
 *
 *   node scripts/test-anpi-notification-badge-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DASH = "/dashboard.html";
const CENTER = "/anpi-notifications.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";

const SEED_CONTEXT = {
  user_id: "anpi_user_badge",
  user_name: "山田太郎",
  user_phone_masked: "09-***-5678",
  is_anpi_user: true,
  contract_holder_id: "holder_badge",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_phone_masked: "03-***-5678",
  contract_holder_email: "hanako@example.com",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat"],
  notification_level: "important_only",
  consent: {
    no_auto_execution: true,
    self_confirm_required: true,
    tasful_no_guarantee: true,
    emergency_contact_required: true,
    agreed_at: new Date().toISOString(),
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SEED_LOGS = [
  {
    id: "badge_urgent",
    event_type: "urgent_keyword_detected",
    user_id: "anpi_user_badge",
    user_name: "山田太郎",
    contract_holder_id: "holder_badge",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】緊急",
    message: "息苦しい",
    status: "local_only",
    is_read: false,
    priority: "urgent",
    created_at: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "badge_call",
    event_type: "call_consent_accepted",
    user_id: "anpi_user_badge",
    user_name: "山田太郎",
    contract_holder_id: "holder_badge",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】電話",
    message: "電話",
    status: "local_only",
    is_read: false,
    priority: "high",
    created_at: new Date(Date.now() - 120000).toISOString(),
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

async function ensureOrigin(page) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
}

async function clearStorage(page) {
  await ensureOrigin(page);
  await page.evaluate(
    ({ ctxKey, logKey }) => {
      localStorage.removeItem(ctxKey);
      localStorage.removeItem(logKey);
    },
    { ctxKey: STORAGE_CONTEXT, logKey: STORAGE_LOGS }
  );
}

async function seedStorage(page, { logs = true } = {}) {
  await ensureOrigin(page);
  await page.evaluate(
    ({ ctxKey, logKey, ctx, logsData, withLogs }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      if (withLogs) localStorage.setItem(logKey, JSON.stringify(logsData));
      else localStorage.removeItem(logKey);
    },
    {
      ctxKey: STORAGE_CONTEXT,
      logKey: STORAGE_LOGS,
      ctx: SEED_CONTEXT,
      logsData: SEED_LOGS,
      withLogs: logs,
    }
  );
}

async function gotoDashboard(page) {
  await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
  await page
    .waitForSelector("#dashSidebarNav a.dash-nav-link", { timeout: 25000 })
    .catch(() => null);
  await page.waitForSelector("[data-dash-quick]", { timeout: 15000 }).catch(() => null);
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

  try {
    await clearStorage(page);
    await gotoDashboard(page);
    await page.waitForTimeout(800);

    const badgeWhenUnreg = await page.locator(".anpi-badge").count();
    if (badgeWhenUnreg === 0) pass(`${vp.name}: 未登録でバッジ非表示`);
    else fail(`${vp.name}: 未登録でバッジ非表示`, String(badgeWhenUnreg));

    await seedStorage(page, { logs: false });
    await gotoDashboard(page);
    await page.waitForTimeout(800);
    const badgeZero = await page.locator(".anpi-badge").count();
    if (badgeZero === 0) pass(`${vp.name}: 登録済・通知0でバッジ非表示`);
    else fail(`${vp.name}: 登録済・通知0でバッジ非表示`, String(badgeZero));

    await seedStorage(page, { logs: true });
    await gotoDashboard(page);
    await page
      .waitForSelector('[data-dash-quick] .anpi-badge--unread', { timeout: 25000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    const unreadQuick = await page
      .locator('[data-dash-quick] a[href="anpi-notifications.html"] .anpi-badge--unread')
      .textContent();
    if (unreadQuick?.includes("未読")) pass(`${vp.name}: クイック未読バッジ`, unreadQuick.trim());
    else fail(`${vp.name}: クイック未読バッジ`, unreadQuick || "");

    const urgentQuick = await page
      .locator('[data-dash-quick] a[href="anpi-dashboard.html"] .anpi-badge--urgent')
      .textContent();
    if (urgentQuick?.includes("緊急")) pass(`${vp.name}: クイック緊急バッジ`, urgentQuick.trim());
    else fail(`${vp.name}: クイック緊急バッジ`, urgentQuick || "");

    const navBadge = await page.locator("#dashSidebarNav .anpi-badge").count();
    if (navBadge > 0) pass(`${vp.name}: サイドバーバッジ`, `${navBadge}個`);
    else fail(`${vp.name}: サイドバーバッジ`);

    const alert = page.locator("[data-dash-anpi-urgent]");
    if (await alert.isVisible()) pass(`${vp.name}: 緊急警告カード`);
    else fail(`${vp.name}: 緊急警告カード`);

    const alertCount = await alert.locator("strong").textContent();
    if (alertCount?.trim() === "1" || alertCount?.trim() === "2") {
      pass(`${vp.name}: 緊急件数表示`, alertCount.trim());
    } else {
      fail(`${vp.name}: 緊急件数表示`, alertCount || "");
    }

    const dashLink = await page.locator('#dashSidebarNav a[href="anpi-dashboard.html"]').count();
    const centerLink = await page.locator('#dashSidebarNav a[href="anpi-notifications.html"]').count();
    const quickDash = await page.locator('[data-dash-quick] a[href="anpi-dashboard.html"]').count();
    if (dashLink && centerLink && quickDash) pass(`${vp.name}: dashboard導線`);
    else fail(`${vp.name}: dashboard導線`);

    await page.goto(`${BASE}${CENTER}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.TasuAnpiNotificationsPage), { timeout: 10000 });
    await page.waitForTimeout(600);

    const unreadAfter = await page.locator("[data-anpi-summary-unread]").textContent();
    if (unreadAfter?.trim() === "0") pass(`${vp.name}: センター閲覧で未読0`);
    else fail(`${vp.name}: センター閲覧で未読0`, unreadAfter || "");

    const urgentAfter = await page.locator("[data-anpi-summary-urgent]").textContent();
    if (urgentAfter?.trim() === "1") pass(`${vp.name}: 緊急件数は維持`, urgentAfter.trim());
    else fail(`${vp.name}: 緊急件数は維持`, urgentAfter || "");

    await gotoDashboard(page);
    await page.waitForTimeout(800);
    const unreadBadgeAfter = await page.locator(".anpi-badge--unread").count();
    if (unreadBadgeAfter === 0) pass(`${vp.name}: 閲覧後未読バッジ消滅`);
    else fail(`${vp.name}: 閲覧後未読バッジ消滅`, String(unreadBadgeAfter));

    const urgentBadgeAfter = await page.locator(".anpi-badge--urgent").count();
    if (urgentBadgeAfter > 0) pass(`${vp.name}: 閲覧後緊急バッジ残存`, String(urgentBadgeAfter));
    else pass(`${vp.name}: 閲覧後緊急バッジ`, "なし（許容）");
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\n安否通知バッジ E2E — ${BASE}${DASH}\n`);
  await withPlaywrightBrowser(async (browser) => {await runViewport(browser, { name: "PC", width: 1280, height: 800 });
  await runViewport(browser, { name: "SP", width: 390, height: 844 });
    });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

await closeAllBrowsers();
