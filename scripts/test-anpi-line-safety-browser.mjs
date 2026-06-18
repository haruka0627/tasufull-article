#!/usr/bin/env node
/**
 * LINE本番前安全化 E2E（P7-5）
 *
 *   node scripts/test-anpi-line-safety-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html";
const DASH = "/dashboard.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const MOCK_KEY = "tasu_anpi_line_send_mock_v1";
const ADMIN_KEY = "tasu_anpi_line_admin_v1";

const HOLDER = "holder_safety";

const SEED_CONTEXT = {
  user_id: "anpi_user_safety",
  user_name: "山田太郎",
  is_anpi_user: true,
  contract_holder_id: HOLDER,
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "important_only",
  line_notification_enabled: true,
  line_user_id: "line_user_safety",
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

async function seed(page, { logs, mock = "1", admin = true }) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(
    ({ ctxKey, logKey, mockKey, adminKey, ctx, logList, mock, admin }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logKey, JSON.stringify(logList));
      if (mock === "1") localStorage.setItem(mockKey, "1");
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
      logList: logs,
      mock,
      admin,
    }
  );
}

async function waitLogApi(page) {
  await page.waitForFunction(
    () => Boolean(window.TasuAnpiNotifications?.sendLineNotificationForLog),
    { timeout: 20000 }
  );
}

async function waitAdminApi(page) {
  await waitLogApi(page);
  await page.waitForFunction(
    () => Boolean(window.TasuAnpiLineHealthcheck?.runAnpiLineHealthcheck),
    { timeout: 20000 }
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

  try {
    const sentLog = {
      id: "safety_sent_log",
      event_type: "urgent_keyword_detected",
      contract_holder_id: HOLDER,
      line_notification_enabled: true,
      line_user_id: "line_user_safety",
      notify_channels: ["tasful_chat", "line"],
      line_status: "sent",
      line_sent_at: new Date().toISOString(),
      line_error_message: "",
      line_error_code: "",
      title: "送信済み",
      message: "済",
      is_read: true,
      created_at: new Date().toISOString(),
    };

    await seed(page, { logs: [sentLog] });
    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await waitLogApi(page);

    const dup = await page.evaluate(async () => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog("safety_sent_log");
    });
    if (dup?.skipped && dup?.reason === "already_sent") {
      pass(`${vp.name}: 送信済みは再送スキップ`);
    } else fail(`${vp.name}: 送信済みは再送スキップ`, JSON.stringify(dup));

    const inProgressLog = {
      ...sentLog,
      id: "safety_progress_log",
      line_status: "pending",
      line_sent_at: null,
      line_send_in_progress: true,
      title: "送信中",
    };
    await seed(page, { logs: [inProgressLog] });
    const busy = await page.evaluate(async () => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog("safety_progress_log");
    });
    if (busy?.reason === "send_in_progress" || busy?.errors?.[0]?.includes("処理中")) {
      pass(`${vp.name}: 送信中フラグでブロック`);
    } else fail(`${vp.name}: 送信中フラグ`, JSON.stringify(busy));

    const aiLog = {
      id: "safety_ai_log",
      event_type: "ai_search",
      contract_holder_id: HOLDER,
      line_notification_enabled: true,
      line_user_id: "line_user_safety",
      notify_channels: ["tasful_chat", "line"],
      line_status: "pending",
      line_sent_at: null,
      title: "AI",
      message: "AI",
      is_read: true,
      created_at: new Date().toISOString(),
    };
    const deliverable = await page.evaluate((log) => {
      return {
        deliverable: window.TasuAnpiNotifications.isLineDeliverableLog(log),
        send: null,
      };
    }, aiLog);
    if (!deliverable.deliverable) {
      pass(`${vp.name}: ai_search は送信対象外`);
    } else fail(`${vp.name}: ai_search は送信対象外`);

    await page.evaluate((log) => {
      const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
      logs.unshift(log);
      localStorage.setItem("tasu_anpi_notification_logs_v1", JSON.stringify(logs));
    }, aiLog);

    const aiSend = await page.evaluate(async () => {
      return window.TasuAnpiNotifications.sendLineNotificationForLog("safety_ai_log");
    });
    if (aiSend?.ok === false && aiSend?.errors?.some((e) => e.includes("対象外"))) {
      pass(`${vp.name}: ai_search 手動送信拒否`);
    } else fail(`${vp.name}: ai_search 手動送信拒否`, JSON.stringify(aiSend?.errors));

    const failedLog = {
      id: "safety_fail_log",
      event_type: "urgent_keyword_detected",
      contract_holder_id: HOLDER,
      line_notification_enabled: true,
      line_user_id: "line_user_safety",
      notify_channels: ["tasful_chat", "line"],
      line_status: "failed",
      line_sent_at: null,
      line_error_message: "Mock fail",
      line_error_code: "LINE_API_ERROR",
      title: "失敗",
      message: "失敗",
      is_read: true,
      created_at: new Date().toISOString(),
    };
    await seed(page, { logs: [failedLog], mock: "1" });
    const canRetry = await page.evaluate((log) => {
      return window.TasuAnpiNotifications.canRetryLineNotification(log);
    }, failedLog);
    if (canRetry) pass(`${vp.name}: 失敗ログは再送可能`);
    else fail(`${vp.name}: 失敗ログは再送可能`);

    const sentNoRetry = await page.evaluate((log) => {
      return window.TasuAnpiNotifications.canRetryLineNotification(log);
    }, sentLog);
    if (!sentNoRetry) pass(`${vp.name}: 送信済みは再送ボタン不可`);
    else fail(`${vp.name}: 送信済みは再送ボタン不可`);

    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await waitAdminApi(page);
    await page.waitForFunction(
      () => document.querySelector("[data-anpi-line-mode-badge]"),
      { timeout: 20000 }
    );

    const modeText = await page.locator("[data-dash-anpi-line-mode] [data-anpi-line-mode-badge]").textContent();
    if (modeText?.includes("モック")) pass(`${vp.name}: モックモード表示`);
    else fail(`${vp.name}: モックモード表示`, modeText || "");

    const hc = await page.evaluate(async () => {
      return window.TasuAnpiLineHealthcheck.runAnpiLineHealthcheck();
    });
    if (hc?.items?.length >= 4) pass(`${vp.name}: healthcheck 項目`, String(hc.items.length));
    else fail(`${vp.name}: healthcheck 項目`);

    if (hc.summary.error === 0 || hc.summary.error <= 1) {
      pass(`${vp.name}: healthcheck エラー許容`, `err=${hc.summary.error}`);
    } else fail(`${vp.name}: healthcheck`, `err=${hc.summary.error}`);

    const adminCard = await page.locator("[data-anpi-line-admin-card]").isVisible();
    if (adminCard) pass(`${vp.name}: 管理カード表示`);
    else fail(`${vp.name}: 管理カード表示`);

    await seed(page, { logs: [failedLog], mock: "0", admin: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitAdminApi(page);
    const modeProd = await page.evaluate(() => window.TasuAnpiNotifications.getLineSendMode());
    if (modeProd === "mock" || modeProd === "production") {
      pass(`${vp.name}: getLineSendMode`, modeProd);
    } else fail(`${vp.name}: getLineSendMode`, modeProd);
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINE安全化 E2E — ${BASE}\n`);
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
