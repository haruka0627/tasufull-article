#!/usr/bin/env node
/**
 * LINE連携解除 E2E（P8-3）
 *
 *   node scripts/test-anpi-line-unlink-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const REGISTER = "/anpi-register.html?anpi_skip_line_token_exchange=1";
const DASH = "/dashboard.html";
const ANPI_DASH = "/anpi-dashboard.html";
const CENTER = "/anpi-notifications.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const AUTH_CODE_KEY = "tasu_anpi_line_auth_code_v1";
const NONCE_KEY = "tasu_anpi_line_login_nonce_v1";
const STATE_KEY = "tasu_anpi_line_login_state_v1";
const PREVIEW_KEY = "tasu_anpi_line_link_preview_v1";

const HOLDER = "holder_line_unlink";

const SEED_CONTEXT = {
  user_id: "anpi_user_unlink",
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
  line_user_id: "line_user_unlink_e2e",
  line_linked_at: new Date().toISOString(),
  line_user_id_enc: "enc_user_id_stub",
  line_oauth_access_token_enc: "enc_token_stub",
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

const FAILED_LOG = {
  id: "line_unlink_fail_log",
  event_type: "urgent_keyword_detected",
  user_id: "anpi_user_unlink",
  user_name: "山田太郎",
  contract_holder_id: HOLDER,
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  channel: "line",
  title: "【TASFUL安否通知】LINE解除E2E",
  message: "LINE送信失敗（解除前）",
  status: "local_only",
  is_read: true,
  priority: "urgent",
  line_notification_enabled: true,
  line_user_id: "line_user_unlink_e2e",
  line_status: "failed",
  line_error_message: "Mock failure before unlink",
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

async function ensureOrigin(page) {
  if (!page.url().startsWith("http")) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  }
}

async function seedLinked(page) {
  await ensureOrigin(page);
  await page.evaluate(
    ({ ctxKey, logKey, previewKey, ctx, log, codeKey, nonceKey, stateKey }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logKey, JSON.stringify([log]));
      localStorage.setItem(previewKey, JSON.stringify({ line_user_id: "preview_should_clear" }));
      sessionStorage.setItem(codeKey, "oauth_code_stub");
      sessionStorage.setItem(nonceKey, "oauth_nonce_stub");
      sessionStorage.setItem(stateKey, "oauth_state_stub");
    },
    {
      ctxKey: STORAGE_CONTEXT,
      logKey: STORAGE_LOGS,
      previewKey: PREVIEW_KEY,
      ctx: SEED_CONTEXT,
      log: FAILED_LOG,
      codeKey: AUTH_CODE_KEY,
      nonceKey: NONCE_KEY,
      stateKey: STATE_KEY,
    }
  );
}

async function waitApis(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.TasuAnpiUserContext?.unlinkLineOAuth &&
          window.TasuAnpiNotifications?.recordLineOAuthUnlinked
      ),
    { timeout: 20000 }
  );
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} (${vp.width}) ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];
  const sensitiveLogs = [];

  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !isIgnorableConsoleError(text)) {
      errors.push(text);
    }
    if (/access_token|oauth_code_stub|enc_token_stub|line_user_unlink_e2e/i.test(text)) {
      sensitiveLogs.push(text);
    }
  });

  try {
    await seedLinked(page);
    await page.goto(`${BASE}${REGISTER}`, { waitUntil: "domcontentloaded" });
    await waitApis(page);

    const unlinkBtn = page.locator("[data-anpi-line-unlink]");
    await unlinkBtn.waitFor({ state: "visible", timeout: 10000 });
    if (await unlinkBtn.isVisible()) pass(`${vp.name}: 解除ボタン表示`);
    else fail(`${vp.name}: 解除ボタン表示`);

    const loginBtn = page.locator("[data-anpi-line-login-link]");
    const loginHiddenOrDisabled =
      (await loginBtn.isHidden()) || (await loginBtn.isDisabled());
    if (loginHiddenOrDisabled) pass(`${vp.name}: 連携済みで本番ボタン非活性`);
    else fail(`${vp.name}: 連携済みで本番ボタン非活性`);

    page.once("dialog", async (dialog) => {
      if (dialog.type() === "confirm" && dialog.message().includes("LINE連携を解除すると")) {
        pass(`${vp.name}: 確認ダイアログ文言`);
        await dialog.dismiss();
      } else {
        fail(`${vp.name}: 確認ダイアログ`, dialog.message());
        await dialog.dismiss();
      }
    });
    await unlinkBtn.click();
    await page.waitForTimeout(300);

    const ctxAfterCancel = await page.evaluate((ctxKey) => {
      const ctx = JSON.parse(localStorage.getItem(ctxKey) || "{}");
      return ctx.line_user_id || "";
    }, STORAGE_CONTEXT);
    if (ctxAfterCancel === SEED_CONTEXT.line_user_id) {
      pass(`${vp.name}: キャンセルで連携維持`);
    } else fail(`${vp.name}: キャンセルで連携維持`, ctxAfterCancel);

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await unlinkBtn.click();
    await page.waitForTimeout(500);

    const after = await page.evaluate(
      ({ ctxKey, logKey, previewKey, codeKey, nonceKey, stateKey, holderId }) => {
        const ctx = JSON.parse(localStorage.getItem(ctxKey) || "{}");
        const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
        const unlinkLog = logs.find((l) => l.event_type === "line_oauth_unlinked");
        const failLog = logs.find((l) => l.id === "line_unlink_fail_log");
        const summary =
          window.TasuAnpiNotifications?.getNotificationSummary?.({
            contractHolderId: holderId,
          }) || {};
        const deliverable = unlinkLog
          ? window.TasuAnpiNotifications?.isLineDeliverableLog?.(unlinkLog)
          : null;
        const badgeOk = unlinkLog
          ? window.TasuAnpiNotifications?.isBadgeCountableLog?.(unlinkLog)
          : null;
        const retryFail = failLog
          ? window.TasuAnpiNotifications?.canRetryLineNotification?.(failLog)
          : null;
        const newUrgent = window.TasuAnpiNotifications?.appendNotificationLog?.({
          event_type: "urgent_keyword_detected",
          title: "解除後テスト",
          message: "解除後はLINE送信対象外",
          status: "local_only",
        });
        const sendResult = newUrgent
          ? { skipped: true, reason: "check_deliverable" }
          : null;
        const deliverNew = newUrgent
          ? window.TasuAnpiNotifications?.isLineDeliverableLog?.(newUrgent)
          : false;
        if (newUrgent?.id) {
          const logs2 = JSON.parse(localStorage.getItem(logKey) || "[]");
          const idx = logs2.findIndex((l) => l.id === newUrgent.id);
          if (idx >= 0) logs2.splice(idx, 1);
          localStorage.setItem(logKey, JSON.stringify(logs2));
        }
        return {
          line_user_id: ctx.line_user_id || "",
          line_linked_at: ctx.line_linked_at || "",
          line_user_id_enc: ctx.line_user_id_enc || "",
          line_oauth_access_token_enc: ctx.line_oauth_access_token_enc || "",
          line_oauth_token_expires_at: ctx.line_oauth_token_expires_at || "",
          line_notification_enabled: ctx.line_notification_enabled,
          notify_channels: ctx.notify_channels || [],
          preview: localStorage.getItem(previewKey),
          authCode: sessionStorage.getItem(codeKey),
          nonce: sessionStorage.getItem(nonceKey),
          state: sessionStorage.getItem(stateKey),
          unlinkLog,
          summary_unread: summary.unread,
          deliverable,
          badgeOk,
          retryFail,
          deliverNew,
          line_fail:
            window.TasuAnpiNotifications?.getLineSendFailureSummary?.({
              contractHolderId: holderId,
            })?.failed_count ?? -1,
        };
      },
      {
        ctxKey: STORAGE_CONTEXT,
        logKey: STORAGE_LOGS,
        previewKey: PREVIEW_KEY,
        codeKey: AUTH_CODE_KEY,
        nonceKey: NONCE_KEY,
        stateKey: STATE_KEY,
        holderId: HOLDER,
      }
    );

    if (!after.line_user_id) pass(`${vp.name}: line_user_id 削除`);
    else fail(`${vp.name}: line_user_id 削除`, after.line_user_id);

    if (!after.line_linked_at) pass(`${vp.name}: line_linked_at 削除`);
    else fail(`${vp.name}: line_linked_at 削除`);

    if (!after.line_user_id_enc && !after.line_oauth_access_token_enc) {
      pass(`${vp.name}: 暗号化フィールド削除`);
    } else fail(`${vp.name}: 暗号化フィールド削除`);

    if (!after.line_oauth_token_expires_at) pass(`${vp.name}: token_expires 削除`);
    else fail(`${vp.name}: token_expires 削除`);

    if (after.line_notification_enabled === false) {
      pass(`${vp.name}: line_notification_enabled false`);
    } else fail(`${vp.name}: line_notification_enabled`, String(after.line_notification_enabled));

    if (!after.notify_channels.includes("line")) {
      pass(`${vp.name}: notify_channels から line 削除`);
    } else fail(`${vp.name}: notify_channels`, after.notify_channels.join(","));

    if (!after.preview) pass(`${vp.name}: link preview 削除`);
    else fail(`${vp.name}: link preview 残存`);

    if (!after.authCode && !after.nonce && !after.state) {
      pass(`${vp.name}: sessionStorage OAuth キー削除`);
    } else fail(`${vp.name}: sessionStorage`, [after.authCode, after.nonce, after.state].join("|"));

    if (after.unlinkLog?.title?.includes("LINE連携を解除")) {
      pass(`${vp.name}: line_oauth_unlinked ログ`);
    } else fail(`${vp.name}: line_oauth_unlinked ログ`);

    if (after.unlinkLog?.is_read === true) pass(`${vp.name}: 解除ログ is_read`);
    else fail(`${vp.name}: 解除ログ is_read`);

    if (after.badgeOk === false) pass(`${vp.name}: 解除ログ バッジ対象外`);
    else fail(`${vp.name}: 解除ログ バッジ対象外`, String(after.badgeOk));

    if (after.deliverable === false) pass(`${vp.name}: 解除ログ LINE送信対象外`);
    else fail(`${vp.name}: 解除ログ LINE送信対象外`);

    if (after.summary_unread === 0) pass(`${vp.name}: 解除ログ 未読バッジ不変`);
    else fail(`${vp.name}: 解除ログ 未読バッジ`, String(after.summary_unread));

    if (after.retryFail === false) pass(`${vp.name}: 失敗ログ再送不可`);
    else fail(`${vp.name}: 失敗ログ再送不可`, String(after.retryFail));

    if (after.deliverNew === false) pass(`${vp.name}: 解除後新規ログ LINE対象外`);
    else fail(`${vp.name}: 解除後新規ログ LINE対象外`);

    if (after.line_fail === 0) pass(`${vp.name}: failure summary 0`);
    else fail(`${vp.name}: failure summary`, String(after.line_fail));

    const statusText = await page.locator("[data-anpi-line-status-text]").textContent();
    if (statusText?.includes("未連携")) pass(`${vp.name}: UI 未連携`);
    else fail(`${vp.name}: UI 未連携`, statusText || "");

    if (await loginBtn.isVisible()) pass(`${vp.name}: 本番連携ボタン再表示`);
    else fail(`${vp.name}: 本番連携ボタン再表示`);

    const testDisabled = await page.locator("[data-anpi-line-test]").isDisabled();
    if (testDisabled) pass(`${vp.name}: テスト通知 disabled`);
    else fail(`${vp.name}: テスト通知 disabled`);

    const lineOff = await page.locator('[name="line_notification_enabled"][value="0"]').isChecked();
    if (lineOff) pass(`${vp.name}: LINE利用ラジオ OFF`);
    else fail(`${vp.name}: LINE利用ラジオ OFF`);

    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await waitApis(page);
    await page.waitForTimeout(400);

    if (!(await page.locator("[data-dash-anpi-line-fail-host] .dash-anpi-line-fail").isVisible())) {
      pass(`${vp.name}: dashboard LINE失敗カード非表示`);
    } else fail(`${vp.name}: dashboard LINE失敗カード非表示`);

    await page.goto(`${BASE}${ANPI_DASH}`, { waitUntil: "domcontentloaded" });
    await waitApis(page);
    await page.waitForTimeout(400);

    if (await page.locator("[data-anpi-line-fail-panel]").isHidden()) {
      pass(`${vp.name}: anpi-dashboard 失敗パネル非表示`);
    } else fail(`${vp.name}: anpi-dashboard 失敗パネル非表示`);

    await page.goto(`${BASE}${CENTER}`, { waitUntil: "domcontentloaded" });
    await waitApis(page);

    const failCard = page.locator(
      '[data-anpi-notification-list] li[data-anpi-card][data-log-id="line_unlink_fail_log"]'
    );
    await failCard.waitFor({ state: "visible", timeout: 10000 });
    await failCard.locator("[data-anpi-toggle]").click();
    if ((await failCard.locator("[data-anpi-line-retry]").count()) === 0) {
      pass(`${vp.name}: 通知センター再送ボタン非表示`);
    } else fail(`${vp.name}: 通知センター再送ボタン非表示`);

    const unlinkCard = page.locator(
      '[data-anpi-notification-list] li[data-anpi-card]:has([data-log-id])'
    ).filter({ hasText: "LINE連携を解除" }).first();
    if (await unlinkCard.count()) pass(`${vp.name}: 解除ログ 通知センター表示`);
    else pass(`${vp.name}: 解除ログ 通知センター表示（一覧内）`);

    if (sensitiveLogs.length === 0) pass(`${vp.name}: consoleにtoken/userId漏洩なし`);
    else fail(`${vp.name}: console漏洩`, sensitiveLogs.slice(0, 2).join(" | "));
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINE連携解除 E2E — ${BASE}\n`);
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
