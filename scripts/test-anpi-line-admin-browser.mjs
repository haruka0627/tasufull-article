#!/usr/bin/env node
/**
 * LINE運用画面・管理カード E2E（P8-5）
 *
 *   node scripts/test-anpi-line-admin-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const ADMIN_PAGE = "/anpi-line-admin.html";
const DASH = "/dashboard.html";
const ANPI_DASH = "/anpi-dashboard.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const MOCK_KEY = "tasu_anpi_line_send_mock_v1";
const ADMIN_KEY = "tasu_anpi_line_admin_v1";

const HOLDER = "holder_admin";

const SEED_CONTEXT = {
  user_id: "anpi_user_admin",
  user_name: "山田太郎",
  is_anpi_user: true,
  contract_holder_id: HOLDER,
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "important_only",
  line_notification_enabled: true,
  line_user_id: "line_user_admin_e2e",
  line_linked_at: new Date().toISOString(),
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

const SENT_LOG = {
  id: "admin_sent_log",
  event_type: "urgent_keyword_detected",
  contract_holder_id: HOLDER,
  title: "送信済みサンプル",
  message: "統計用",
  is_read: true,
  line_notification_enabled: true,
  line_user_id: "line_user_admin_e2e",
  line_status: "sent",
  line_sent_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const FAILED_LOG = {
  id: "admin_fail_log",
  event_type: "urgent_keyword_detected",
  contract_holder_id: HOLDER,
  title: "失敗サンプル",
  message: "統計用失敗",
  is_read: true,
  line_notification_enabled: true,
  line_user_id: "line_user_admin_e2e",
  line_status: "failed",
  line_error_message: "Admin E2E fail sample",
  line_error_code: "UNKNOWN",
  created_at: new Date().toISOString(),
};

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

async function seed(page, { admin = true, mock = true } = {}) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(
    ({ ctxKey, logKey, mockKey, adminKey, ctx, logs, mock, admin }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logKey, JSON.stringify(logs));
      if (mock) localStorage.setItem(mockKey, "1");
      else localStorage.removeItem(mockKey);
      if (admin) localStorage.setItem(adminKey, "1");
      else localStorage.removeItem(adminKey);
    },
    {
      ctxKey: STORAGE_CONTEXT,
      logKey: STORAGE_LOGS,
      mockKey: MOCK_KEY,
      adminKey: ADMIN_KEY,
      ctx: SEED_CONTEXT,
      logs: [SENT_LOG, FAILED_LOG],
      mock,
      admin,
    }
  );
}

async function waitAdminApis(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiLineAdmin?.renderAdminPage &&
          window.TasuAnpiLineHealthcheck?.runAnpiLineHealthcheck &&
          window.TasuAnpiNotifications?.sendLineTestPush
      ),
    { timeout: 15000 }
  );
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} (${vp.width}) ========`);
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
    // --- 一般ユーザー: 管理画面拒否 ---
    await seed(page, { admin: false, mock: true });
    await page.goto(`${BASE}${ADMIN_PAGE}`, { waitUntil: "domcontentloaded" });
    await waitAdminApis(page);
    await page.waitForSelector("[data-anpi-line-admin-denied]", { timeout: 10000 });
    if (await page.locator("[data-anpi-line-test-push]").count() === 0) {
      pass(`${vp.name}: 非管理者はテストPush非表示`);
    } else fail(`${vp.name}: 非管理者はテストPush非表示`);

    // --- 管理者: 運用画面 ---
    await seed(page, { admin: true, mock: true });
    await page.goto(`${BASE}${ADMIN_PAGE}?anpi_admin=1`, { waitUntil: "domcontentloaded" });
    await waitAdminApis(page);
    await page.waitForSelector("[data-anpi-line-admin-page]", { timeout: 10000 });

    if (await page.locator("[data-anpi-line-hc-list] li").count() >= 5) {
      pass(`${vp.name}: Healthcheck一覧`);
    } else fail(`${vp.name}: Healthcheck一覧`);

    const hcIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("[data-hc-id]")).map((el) =>
        el.getAttribute("data-hc-id")
      );
    });
    const required = [
      "line_login_channel_id",
      "line_channel_access_token",
      "supabase_url",
      "edge_anpi_line_send",
      "edge_anpi_line_token_exchange",
    ];
    if (required.every((id) => hcIds.includes(id))) {
      pass(`${vp.name}: Healthcheck必須項目`);
    } else fail(`${vp.name}: Healthcheck必須項目`, hcIds.join(","));

    const statsText = await page.locator(".anpi-line-admin-page__stats").textContent();
    if (statsText?.includes("送信済み") && statsText?.includes("送信失敗")) {
      pass(`${vp.name}: 統計表示`);
    } else fail(`${vp.name}: 統計表示`);

    const modeBadge = page.locator("[data-anpi-line-mode-badge]");
    if (await modeBadge.isVisible()) {
      const modeText = await modeBadge.textContent();
      if (modeText?.includes("モック")) pass(`${vp.name}: モックモード表示`);
      else fail(`${vp.name}: モックモード表示`, modeText || "");
    } else fail(`${vp.name}: モードバッジ`);

    const navLinks = await page.locator(".anpi-line-admin-page__nav a").count();
    if (navLinks >= 3) pass(`${vp.name}: 関連画面リンク`);
    else fail(`${vp.name}: 関連画面リンク`, String(navLinks));

    await page.locator("[data-anpi-line-test-push]").click();
    await page.waitForFunction(
      () => {
        const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
        return logs.some((l) => l.event_type === "line_test_push" && l.line_status === "sent");
      },
      { timeout: 10000 }
    );
    await page.waitForSelector("[data-anpi-line-test-result]", {
      state: "visible",
      timeout: 10000,
    });

    const testLog = await page.evaluate(() => {
      const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
      const log = logs.find((l) => l.event_type === "line_test_push");
      const summary =
        window.TasuAnpiNotifications?.getNotificationSummary?.({
          contractHolderId: "holder_admin",
        }) || {};
      const badgeOk = log ? window.TasuAnpiNotifications.isBadgeCountableLog(log) : null;
      return { log, summary_unread: summary.unread, badgeOk };
    });

    if (testLog.log?.line_status === "sent") pass(`${vp.name}: テストPush成功`);
    else fail(`${vp.name}: テストPush成功`, testLog.log?.line_status);

    if (testLog.badgeOk === false) pass(`${vp.name}: line_test_push バッジ対象外`);
    else fail(`${vp.name}: line_test_push バッジ対象外`, String(testLog.badgeOk));

    const resultEl = page.locator("[data-anpi-line-test-result]");
    if (await resultEl.isVisible()) pass(`${vp.name}: テスト結果表示`);
    else fail(`${vp.name}: テスト結果表示`);

    // --- dashboard 管理カード ---
    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await waitAdminApis(page);
    await page.waitForTimeout(500);
    const dashCard = page.locator("[data-anpi-line-admin-card]");
    if (await dashCard.isVisible()) pass(`${vp.name}: dashboard 管理カード`);
    else fail(`${vp.name}: dashboard 管理カード`);

    await page.goto(`${BASE}${ANPI_DASH}`, { waitUntil: "domcontentloaded" });
    await waitAdminApis(page);
    await page.waitForTimeout(500);
    const anpiCard = page.locator("[data-anpi-line-admin-card]");
    if (await anpiCard.isVisible()) pass(`${vp.name}: anpi-dashboard 管理カード`);
    else fail(`${vp.name}: anpi-dashboard 管理カード`);

    // 非管理者でカード非表示
    await seed(page, { admin: false, mock: true });
    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (await page.locator("[data-anpi-line-admin-card]").count() === 0) {
      pass(`${vp.name}: 非管理者 管理カード非表示`);
    } else fail(`${vp.name}: 非管理者 管理カード非表示`);
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINE運用画面 E2E — ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  await runViewport(browser, { name: "PC", width: 1280, height: 800 });
  await runViewport(browser, { name: "SP", width: 390, height: 844 });
  await browser.close();

  const ng = results.filter((r) => !r.ok);
  console.log(`\n--- 結果: ${results.length - ng.length}/${results.length} OK ---\n`);
  if (ng.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
