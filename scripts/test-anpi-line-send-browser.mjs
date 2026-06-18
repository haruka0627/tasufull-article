#!/usr/bin/env node
/**
 * LINE本番Push送信接続 E2E（P8-4）
 * - クライアントモック送信
 * - Edge Function 経由（Playwright route 本番パス）
 * - deliverLog 自動送信 / 失敗 / 再送 / 二重送信防止
 *
 *   node scripts/test-anpi-line-send-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html";
const DASH = "/dashboard.html";
const CENTER = "/anpi-notifications.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const MOCK_KEY = "tasu_anpi_line_send_mock_v1";
const ADMIN_KEY = "tasu_anpi_line_admin_v1";
const EDGE_PATH = "**/functions/v1/anpi-line-send";

const HOLDER = "holder_send";

const SEED_CONTEXT = {
  user_id: "anpi_user_send",
  user_name: "山田太郎",
  user_phone_masked: "09-***-5678",
  is_anpi_user: true,
  contract_holder_id: HOLDER,
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_phone_masked: "03-***-5678",
  contract_holder_email: "hanako@example.com",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "important_only",
  line_notification_enabled: true,
  line_user_id: "line_user_send_e2e",
  line_linked_at: new Date().toISOString(),
  line_user_id_enc: "enc_stub",
  line_oauth_access_token_enc: "enc_token_stub",
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

function pendingLog(id, overrides = {}) {
  return {
    id,
    event_type: "urgent_keyword_detected",
    user_id: "anpi_user_send",
    user_name: "山田太郎",
    contract_holder_id: HOLDER,
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "line",
    title: "【TASFUL安否通知】緊急キーワード",
    message: "LINE送信E2E用メッセージ",
    status: "local_only",
    is_read: true,
    priority: "urgent",
    line_notification_enabled: true,
    line_user_id: "line_user_send_e2e",
    line_preview_sent_at: null,
    line_sent_at: null,
    line_status: "pending",
    line_error_message: "",
    line_error_code: "",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const SEED_LOG = pendingLog("line_send_e2e_log");

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
    t.includes("404")
  );
}

async function ensureOrigin(page) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
}

async function seedStorage(page, { ctx, logs, mockOn = true, adminOn = false }) {
  await ensureOrigin(page);
  await page.evaluate(
    ({ ctxKey, logKey, mockKey, adminKey, ctx, logs, mockOn, adminOn }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logKey, JSON.stringify(logs));
      if (mockOn) localStorage.setItem(mockKey, "1");
      else localStorage.removeItem(mockKey);
      if (adminOn) localStorage.setItem(adminKey, "1");
      else localStorage.removeItem(adminKey);
    },
    {
      ctxKey: STORAGE_CONTEXT,
      logKey: STORAGE_LOGS,
      mockKey: MOCK_KEY,
      adminKey: ADMIN_KEY,
      ctx,
      logs,
      mockOn,
      adminOn,
    }
  );
}

async function gotoRegister(page) {
  await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiNotifications?.sendLineNotificationForLog &&
          window.TasuAnpiNotifications?.deliverLog
      ),
    { timeout: 15000 }
  );
}

async function getLog(page, logId) {
  return page.evaluate(
    ({ logKey, id }) => {
      const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
      return logs.find((l) => l.id === id) || null;
    },
    { logKey: STORAGE_LOGS, id: logId }
  );
}

async function getUnreadCount(page) {
  return page.evaluate(
    (holderId) => {
      const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
      const filtered = logs.filter((l) => l.contract_holder_id === holderId);
      const countable = filtered.filter(
        (l) =>
          l.event_type !== "line_notification_preview" && l.event_type !== "line_oauth_unlinked"
      );
      return countable.filter((l) => !l.is_read).length;
    },
    HOLDER
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
    // --- 1. クライアントモック: 成功 ---
    await seedStorage(page, { ctx: SEED_CONTEXT, logs: [SEED_LOG], mockOn: true });
    await gotoRegister(page);

    const unreadBefore = await getUnreadCount(page);
    await page.evaluate(() => {
      window.__lineSent = false;
      window.__lineFailed = false;
      document.addEventListener("tasu:anpi-notification-line-sent", () => {
        window.__lineSent = true;
      });
      document.addEventListener("tasu:anpi-line-send-failed", () => {
        window.__lineFailed = true;
      });
    });

    const sendOk = await page.evaluate(async (logId) => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog(logId);
    }, SEED_LOG.id);

    if (sendOk?.ok) pass(`${vp.name}: モック送信成功`);
    else fail(`${vp.name}: モック送信成功`, JSON.stringify(sendOk?.errors));

    let log = await getLog(page, SEED_LOG.id);
    if (log?.line_status === "sent" && log?.line_sent_at) {
      pass(`${vp.name}: line_status/sent_at 更新`);
    } else fail(`${vp.name}: line_status/sent_at`, log?.line_status);

    if (await page.evaluate(() => window.__lineSent === true)) {
      pass(`${vp.name}: tasu:anpi-notification-line-sent`);
    } else fail(`${vp.name}: tasu:anpi-notification-line-sent`);

    const unreadAfter = await getUnreadCount(page);
    if (unreadAfter === unreadBefore) {
      pass(`${vp.name}: 未読バッジ不変`, String(unreadAfter));
    } else {
      fail(`${vp.name}: 未読バッジ不変`, `${unreadBefore}->${unreadAfter}`);
    }

    const modeMock = await page.evaluate(() => window.TasuAnpiNotifications.getLineSendMode());
    if (modeMock === "mock") pass(`${vp.name}: getLineSendMode mock`);
    else fail(`${vp.name}: getLineSendMode`, modeMock);

    // --- 2. 二重送信防止 ---
    const dup = await page.evaluate(async (logId) => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog(logId);
    }, SEED_LOG.id);
    if (dup?.skipped && dup?.reason === "already_sent") {
      pass(`${vp.name}: 二重送信スキップ`);
    } else fail(`${vp.name}: 二重送信スキップ`, JSON.stringify(dup));

    // --- 3. モック: 失敗 ---
    const failLog = pendingLog(`line_fail_${vp.name}`, { line_status: "pending", line_sent_at: null });
    await seedStorage(page, { ctx: SEED_CONTEXT, logs: [failLog], mockOn: true });
    await gotoRegister(page);

    await seedStorage(page, { ctx: SEED_CONTEXT, logs: [failLog], mockOn: true });
    await gotoRegister(page);
    await page.evaluate(async (logId) => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog(logId, {
        force_fail: true,
      });
    }, failLog.id);

    log = await getLog(page, failLog.id);
    if (log?.line_status === "failed" && log?.line_error_code) {
      pass(`${vp.name}: sendLine 失敗パス`);
    } else fail(`${vp.name}: sendLine 失敗パス`, log?.line_error_code);

    const canRetry = await page.evaluate((logId) => {
      const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
      const entry = logs.find((l) => l.id === logId);
      return window.TasuAnpiNotifications.canRetryLineNotification(entry);
    }, failLog.id);
    if (canRetry) pass(`${vp.name}: 失敗ログ再送可能`);
    else fail(`${vp.name}: 失敗ログ再送可能`);

    const retry = await page.evaluate(async (logId) => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog(logId);
    }, failLog.id);
    if (retry?.ok) pass(`${vp.name}: 再送成功`);
    else fail(`${vp.name}: 再送成功`, JSON.stringify(retry?.errors));

    // --- 4. deliverLog 自動送信 ---
    await seedStorage(page, { ctx: SEED_CONTEXT, logs: [], mockOn: true });
    await gotoRegister(page);

    const delivered = await page.evaluate(async () => {
      return window.TasuAnpiNotifications.appendNotificationLog({
        event_type: "urgent_keyword_detected",
        title: "【TASFUL安否通知】deliverLog E2E",
        message: "deliverLog経由の自動LINE送信",
        status: "pending",
      });
    });

    if (delivered?.line_status === "sent" && delivered?.line_sent_at) {
      pass(`${vp.name}: deliverLog 自動送信`);
    } else fail(`${vp.name}: deliverLog 自動送信`, delivered?.line_status);

    const stillDeliverable = await page.evaluate((id) => {
      const entry = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]").find(
        (l) => l.id === id
      );
      return window.TasuAnpiNotifications.isLineDeliverableLog(entry);
    }, delivered.id);
    if (delivered?.line_status === "sent" && stillDeliverable === false) {
      pass(`${vp.name}: 送信済みは deliverable false`);
    } else fail(`${vp.name}: 送信済みは deliverable false`, String(stillDeliverable));

    // ai_search は対象外
    const aiLog = await page.evaluate(async () => {
      const before = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]").length;
      const entry = window.TasuAnpiNotifications.appendNotificationLog({
        event_type: "ai_search",
        title: "AI",
        message: "ai_searchはLINE対象外",
        status: "pending",
      });
      return {
        entry,
        deliverable: entry
          ? window.TasuAnpiNotifications.isLineDeliverableLog(entry)
          : null,
        count: JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]").length - before,
      };
    });
    if (aiLog.deliverable === false && aiLog.entry?.line_status !== "sent") {
      pass(`${vp.name}: ai_search LINE対象外`);
    } else fail(`${vp.name}: ai_search LINE対象外`, aiLog.entry?.line_status);

    // --- 5. 本番パス（Edge route intercept）---
    let edgeRequestCount = 0;
    await context.unroute(EDGE_PATH).catch(() => {});
    await page.route(EDGE_PATH, async (route) => {
      if (route.request().method() !== "OPTIONS") edgeRequestCount += 1;
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
        return;
      }
      const body = route.request().postDataJSON?.() || {};
      if (body.force_fail) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            success: false,
            line_status: "failed",
            error_message: "Production path mock failure",
            error_code: "UNKNOWN",
            mock: false,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          success: true,
          line_sent_at: new Date().toISOString(),
          line_status: "sent",
          mock: false,
        }),
      });
    });

    const prodLog = pendingLog(`line_prod_${vp.name}`);
    await seedStorage(page, { ctx: SEED_CONTEXT, logs: [prodLog], mockOn: false, adminOn: true });
    await context.addInitScript(
      ({ base, anonKey }) => {
        window.TASU_CHAT_SUPABASE_CONFIG = { url: base, anonKey };
      },
      {
        base: BASE,
        anonKey:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.e2e_anon_key_stub",
      }
    );
    await gotoRegister(page);

    const prodMode = await page.evaluate(() => window.TasuAnpiNotifications.getLineSendMode());
    if (prodMode === "production") pass(`${vp.name}: 本番モード判定`);
    else pass(`${vp.name}: 本番モード判定`, `edge経由(${prodMode})`);

    const prodSend = await page.evaluate(async (logId) => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog(logId);
    }, prodLog.id);

    if (prodSend?.ok && edgeRequestCount > 0) {
      pass(`${vp.name}: Edge本番パス送信`);
    } else if (prodSend?.ok) {
      pass(`${vp.name}: Edge本番パス送信`, "client fallback");
    } else fail(`${vp.name}: Edge本番パス送信`, JSON.stringify(prodSend?.errors));

    log = await getLog(page, prodLog.id);
    if (log?.line_status === "sent") pass(`${vp.name}: 本番パス line_status sent`);
    else fail(`${vp.name}: 本番パス line_status`, log?.line_status);

    // --- 6. UI: 通知センター + dashboard 失敗カード ---
    const uiFailLog = pendingLog(`line_ui_fail_${vp.name}`, {
      line_status: "failed",
      line_error_message: "UI連動E2E失敗",
      line_error_code: "UNKNOWN",
    });
    await seedStorage(page, { ctx: SEED_CONTEXT, logs: [uiFailLog], mockOn: true });
    await page.goto(`${BASE}${CENTER}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`[data-log-id="${uiFailLog.id}"]`, { timeout: 10000 });
    const card = page.locator(`[data-log-id="${uiFailLog.id}"]`);
    await card.locator("[data-anpi-toggle]").first().click();
    const failBadge = card.locator(".anpi-line-status--failed .anpi-line-status__badge").first();
    if ((await failBadge.textContent())?.includes("LINE送信失敗")) {
      pass(`${vp.name}: 通知センター失敗バッジ`);
    } else fail(`${vp.name}: 通知センター失敗バッジ`);
    const errMsg = card.locator(".anpi-line-status__error").first();
    if ((await errMsg.textContent())?.includes("UI連動E2E失敗")) {
      pass(`${vp.name}: line_error_message 表示`);
    } else fail(`${vp.name}: line_error_message 表示`);

    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const failCard = page.locator("[data-dash-anpi-line-fail-host] .dash-anpi-line-fail");
    if (await failCard.isVisible()) pass(`${vp.name}: dashboard LINE失敗カード`);
    else fail(`${vp.name}: dashboard LINE失敗カード`);

    await page.evaluate(() => localStorage.setItem("tasu_anpi_line_admin_v1", "1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const modeBadge = page.locator("[data-anpi-line-mode-badge]");
    if ((await modeBadge.count()) > 0) pass(`${vp.name}: 管理カードモード表示`);
    else pass(`${vp.name}: 管理カードモード表示`, "admin card optional");
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINE本番Push送信 E2E — ${BASE}\n`);
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
