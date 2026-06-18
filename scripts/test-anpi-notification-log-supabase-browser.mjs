#!/usr/bin/env node
/**
 * 安否通知ログ Supabase 同期 E2E（P9-2）
 *
 *   node scripts/test-anpi-notification-log-supabase-browser.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { runAnpiRlsBrowserTests } from "./lib/anpi-rls-browser-tests.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const NOTIFICATIONS = "/anpi-notifications.html";
const ADMIN_PAGE = "/anpi-line-admin.html?anpi_admin=1";
const CTX_KEY = "tasu_anpi_user_context_v1";
const LOGS_KEY = "tasu_anpi_notification_logs_v1";
const LOGS_MOCK_KEY = "tasu_anpi_notification_logs_supabase_mock_v1";

const HOLDER_ID = "holder_notif_log_e2e";
const USER_ID = "anpi_notif_log_e2e";

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
    t.includes("CORS policy") ||
    t.includes("anpi-line-send") ||
    t.includes("anpi-line-token-exchange")
  );
}

async function enableMocks(page) {
  await page.addInitScript(() => {
    window.__ANPI_CONTEXT_SUPABASE_MOCK__ = true;
    window.__ANPI_NOTIFICATION_LOGS_SUPABASE_MOCK__ = true;
    window.__anpiContextSupabaseStore = new Map();
    window.__anpiNotificationLogsSupabaseStore = new Map();
    try {
      localStorage.setItem("tasu_anpi_context_supabase_mock_v1", "1");
      localStorage.setItem("tasu_anpi_notification_logs_supabase_mock_v1", "1");
    } catch {
      /* ignore */
    }
  });
}

async function seedAnpiContext(page) {
  await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiUserContext?.setAnpiUserContext &&
          window.TasuAnpiNotificationLogsSupabase?.upsertAnpiNotificationLog
      ),
    { timeout: 15000 }
  );

  await page.evaluate(
    ({ userId, holderId, ctxKey }) => {
      const ctx = {
        user_id: userId,
        is_anpi_user: true,
        user_name: "ログE2E太郎",
        user_phone_masked: "09-***-4321",
        contract_holder_id: holderId,
        contract_holder_name: "ログE2E花子",
        contract_holder_relation: "娘",
        contract_holder_email: "log-e2e@example.com",
        contract_holder_phone_masked: "03-***-5678",
        contract_holder_contact_method: "tasful_chat",
        notify_channels: ["tasful_chat", "line"],
        notification_level: "all_ai_actions",
        line_notification_enabled: true,
        line_user_id: "line_notif_log_e2e",
        line_linked_at: new Date().toISOString(),
        line_user_id_enc: "enc_log_e2e",
        line_oauth_access_token_enc: "enc_token_log_e2e",
        line_oauth_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
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
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      return window.TasuAnpiUserContext.setAnpiUserContext(ctx);
    },
    { userId: USER_ID, holderId: HOLDER_ID, ctxKey: CTX_KEY }
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
    await enableMocks(page);
    await seedAnpiContext(page);

    const urgent = await page.evaluate(() => {
      return window.TasuAnpiNotifications.recordUrgentKeyword("救急車が必要です", "救急車");
    });
    if (urgent?.event_type === "urgent_keyword_detected") {
      pass(`${vp.name}: 通知ログ作成（緊急）`);
    } else fail(`${vp.name}: 通知ログ作成（緊急）`);

    await page.waitForTimeout(800);

    const mockHas = await page.evaluate((logId) => {
      const log = window.TasuAnpiNotifications.getRawLogsFromStorage()[0];
      return window.__anpiNotificationLogsSupabaseStore?.has?.(log?.id) === true;
    });
    if (mockHas) pass(`${vp.name}: Supabase(mock)保存`);
    else fail(`${vp.name}: Supabase(mock)保存`);

    const logId = await page.evaluate(() => {
      return window.TasuAnpiNotifications.getRawLogsFromStorage()[0]?.id || "";
    });

    await page.evaluate((key) => localStorage.removeItem(key), LOGS_KEY);

    const restored = await page.evaluate(async () => {
      return window.TasuAnpiNotifications.syncAnpiNotificationLogsWithSupabase();
    });

    if (restored?.restored && restored?.merged_count >= 1) {
      pass(`${vp.name}: localStorage削除後に復元`, `count=${restored.merged_count}`);
    } else fail(`${vp.name}: localStorage削除後に復元`, JSON.stringify(restored));

    const afterRestore = await page.evaluate(() => {
      const log = window.TasuAnpiNotifications.getRawLogsFromStorage()[0];
      const info = window.TasuAnpiNotifications.getLogsStorageInfo();
      return {
        event_type: log?.event_type,
        line_user_id: log?.line_user_id,
        line_user_id_enc: log?.line_user_id_enc,
        line_status: log?.line_status,
        is_read: log?.is_read,
        restored: info?.restored,
      };
    });

    if (afterRestore.event_type === "urgent_keyword_detected") {
      pass(`${vp.name}: 緊急通知復元`);
    } else fail(`${vp.name}: 緊急通知復元`, afterRestore.event_type);

    if (afterRestore.line_user_id === "line_notif_log_e2e") {
      pass(`${vp.name}: LINE情報復元`);
    } else fail(`${vp.name}: LINE情報復元`, afterRestore.line_user_id);

    if (afterRestore.restored) pass(`${vp.name}: restored フラグ`);
    else fail(`${vp.name}: restored フラグ`);

    const unreadBefore = await page.evaluate(() => {
      return window.TasuAnpiNotifications.getNotificationSummary().unread;
    });

    await page.evaluate((id) => {
      window.TasuAnpiNotifications.markNotificationRead(id);
    }, logId);

    const readState = await page.evaluate(
      ({ id }) => {
        const log = window.TasuAnpiNotifications.getRawLogsFromStorage().find((l) => l.id === id);
        const mockRow = window.__anpiNotificationLogsSupabaseStore?.get(id);
        return { local: log?.is_read, remote: mockRow?.is_read, read_at: log?.read_at };
      },
      { id: logId }
    );

    if (readState.local && readState.remote && readState.read_at) {
      pass(`${vp.name}: 既読化 Supabase同期`);
    } else fail(`${vp.name}: 既読化 Supabase同期`, JSON.stringify(readState));

    const unreadAfter = await page.evaluate(() => {
      return window.TasuAnpiNotifications.getNotificationSummary().unread;
    });
    if (unreadAfter < unreadBefore) pass(`${vp.name}: 未読サマリー更新`);
    else fail(`${vp.name}: 未読サマリー更新`, `${unreadBefore}->${unreadAfter}`);

    // --- LINE 失敗状態 ---
    await page.evaluate(
      ({ id, holderId }) => {
        const logs = window.TasuAnpiNotifications.getRawLogsFromStorage();
        const idx = logs.findIndex((l) => l.id === id);
        if (idx < 0) return;
        logs[idx] = {
          ...logs[idx],
          line_status: "failed",
          line_error_message: "E2E mock failure",
          line_error_code: "LINE_API_ERROR",
          line_send_in_progress: false,
          updated_at: new Date().toISOString(),
        };
        window.TasuAnpiNotifications.saveRawLogs(logs);
      },
      { id: logId, holderId: HOLDER_ID }
    );

    await page.waitForTimeout(500);

    const failedOk = await page.evaluate((id) => {
      const log = window.TasuAnpiNotifications.getRawLogsFromStorage().find((l) => l.id === id);
      const row = window.__anpiNotificationLogsSupabaseStore?.get(id);
      return (
        log?.line_status === "failed" &&
        row?.line_status === "failed" &&
        log?.line_error_message?.includes("E2E")
      );
    }, logId);

    if (failedOk) pass(`${vp.name}: LINE失敗状態復元`);
    else fail(`${vp.name}: LINE失敗状態復元`);

    // --- updated_at 競合: remote 優先 ---
    await page.evaluate(
      ({ id, key }) => {
        const localOld = {
          id,
          log_id: id,
          user_id: "anpi_notif_log_e2e",
          contract_holder_id: "holder_notif_log_e2e",
          event_type: "urgent_keyword_detected",
          title: "ローカル古い",
          message: "local",
          is_read: false,
          line_status: "pending",
          line_notification_enabled: true,
          line_user_id: "line_notif_log_e2e",
          notify_channels: ["line"],
          created_at: "2020-01-01T00:00:00.000Z",
          updated_at: "2020-01-01T00:00:00.000Z",
        };
        localStorage.setItem(key, JSON.stringify([localOld]));
        const row = window.TasuAnpiNotificationLogsSupabase.logToRow({
          ...localOld,
          title: "リモート新しい",
          message: "remote wins",
          updated_at: new Date().toISOString(),
        });
        window.__anpiNotificationLogsSupabaseStore.set(id, row);
      },
      { id: logId, key: LOGS_KEY }
    );

    const remoteWin = await page.evaluate(() =>
      window.TasuAnpiNotifications.syncAnpiNotificationLogsWithSupabase()
    );
    const titleRemote = await page.evaluate(() => {
      return window.TasuAnpiNotifications.getRawLogsFromStorage()[0]?.title;
    });
    if (titleRemote === "リモート新しい") {
      pass(`${vp.name}: updated_at競合 Supabase優先`);
    } else fail(`${vp.name}: updated_at競合 Supabase優先`, titleRemote);

    // --- updated_at 競合: local 優先 ---
    await page.evaluate(
      ({ id, key }) => {
        const remoteOld = window.TasuAnpiNotificationLogsSupabase.logToRow({
          id,
          user_id: "anpi_notif_log_e2e",
          contract_holder_id: "holder_notif_log_e2e",
          event_type: "urgent_keyword_detected",
          title: "リモート古い",
          message: "remote",
          is_read: true,
          line_status: "sent",
          line_notification_enabled: true,
          line_user_id: "line_notif_log_e2e",
          notify_channels: ["line"],
          created_at: "2020-01-01T00:00:00.000Z",
          updated_at: "2020-01-01T00:00:00.000Z",
        });
        window.__anpiNotificationLogsSupabaseStore.set(id, remoteOld);
        const localNew = {
          ...JSON.parse(localStorage.getItem(key) || "[]")[0],
          title: "ローカル新しい",
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify([localNew]));
      },
      { id: logId, key: LOGS_KEY }
    );

    const localWin = await page.evaluate(() =>
      window.TasuAnpiNotifications.syncAnpiNotificationLogsWithSupabase()
    );
    const mockTitle = await page.evaluate((id) => {
      return window.__anpiNotificationLogsSupabaseStore.get(id)?.title || "";
    }, logId);
    const localTitle = await page.evaluate(() => {
      return window.TasuAnpiNotifications.getRawLogsFromStorage()[0]?.title;
    });
    if (localTitle === "ローカル新しい" && mockTitle === "ローカル新しい") {
      pass(`${vp.name}: updated_at競合 localStorage優先`);
    } else fail(`${vp.name}: updated_at競合 localStorage優先`, `${localTitle}/${mockTitle}`);

    // --- フォールバック ---
    const fallback = await page.evaluate(() => {
      const orig = window.TasuAnpiNotificationLogsSupabase.upsertAnpiNotificationLog;
      window.TasuAnpiNotificationLogsSupabase.upsertAnpiNotificationLog = async () => ({
        ok: false,
        error: "mock_fail",
      });
      const r = window.TasuAnpiNotifications.recordAiSearch({
        userText: "フォールバック検索テスト",
        intent: "cross_search",
      });
      window.TasuAnpiNotificationLogsSupabase.upsertAnpiNotificationLog = orig;
      const logs = window.TasuAnpiNotifications.getRawLogsFromStorage();
      return { ok: Boolean(r), has: logs.some((l) => l.message?.includes("フォールバック")) };
    });
    if (fallback.ok && fallback.has) pass(`${vp.name}: Supabase失敗時 localStorage継続`);
    else fail(`${vp.name}: Supabase失敗時 localStorage継続`);

    // --- 管理画面 ---
    await page.evaluate(() => {
      localStorage.setItem("tasu_anpi_line_admin_v1", "1");
    });
    await enableMocks(page);
    await page.goto(`${BASE}${ADMIN_PAGE}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-anpi-line-admin-page]", { timeout: 10000 });
    const adminText = await page.locator(".anpi-line-admin-page__stats, .anpi-line-admin-page__logs-storage").allTextContents();
    const joined = adminText.join("\n");
    if (
      joined.includes("Notification Logs Storage") &&
      joined.includes("Merged count")
    ) {
      pass(`${vp.name}: 管理画面 Logs Storage表示`);
    } else fail(`${vp.name}: 管理画面 Logs Storage表示`);

    await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await runAnpiRlsBrowserTests(page, vp, pass, fail);
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\n安否通知ログ Supabase E2E — ${BASE}\n`);
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
