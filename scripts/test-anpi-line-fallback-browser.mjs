#!/usr/bin/env node
/**
 * LINE送信失敗フォールバック E2E（P7-4）
 *
 *   node scripts/test-anpi-line-fallback-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const DASH = "/dashboard.html";
const ANPI_DASH = "/anpi-dashboard.html";
const CENTER = "/anpi-notifications.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";
const MOCK_KEY = "tasu_anpi_line_send_mock_v1";

const HOLDER = "holder_line_fail";

const SEED_CONTEXT = {
  user_id: "anpi_user_line_fail",
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
  line_user_id: "line_user_fail_e2e",
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

const FAILED_LOG = {
  id: "line_fail_e2e_log",
  event_type: "urgent_keyword_detected",
  user_id: "anpi_user_line_fail",
  user_name: "山田太郎",
  contract_holder_id: HOLDER,
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  channel: "line",
  title: "【TASFUL安否通知】LINE失敗E2E",
  message: "LINE送信失敗フォールバック検証",
  status: "local_only",
  is_read: true,
  priority: "urgent",
  line_notification_enabled: true,
  line_user_id: "line_user_fail_e2e",
  line_preview_sent_at: null,
  line_sent_at: null,
  line_status: "failed",
  line_error_message: "Mock LINE send failed for E2E",
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

async function seedFailed(page) {
  await ensureOrigin(page);
  await page.evaluate(
    ({ ctxKey, logKey, ctx, log }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logKey, JSON.stringify([log]));
      localStorage.removeItem("tasu_anpi_line_send_mock_v1");
    },
    { ctxKey: STORAGE_CONTEXT, logKey: STORAGE_LOGS, ctx: SEED_CONTEXT, log: FAILED_LOG }
  );
}

async function waitAnpiApis(page) {
  await page.waitForFunction(
    () => Boolean(window.TasuAnpiNotifications?.getLineSendFailureSummary),
    { timeout: 15000 }
  );
}

async function getBadgeCounts(page) {
  return page.evaluate((holderId) => {
    const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
    const filtered = logs.filter((l) => l.contract_holder_id === holderId);
    const countable = filtered.filter((l) => l.event_type !== "line_notification_preview");
    const unread = countable.filter((l) => !l.is_read).length;
    const urgent = countable.filter(
      (l) => l.priority === "urgent" || l.event_type === "urgent_keyword_detected"
    ).length;
    const summary =
      window.TasuAnpiNotifications?.getNotificationSummary?.({
        contractHolderId: holderId,
      }) || {};
    return {
      unread,
      urgent,
      summary_unread: summary.unread ?? -1,
      summary_urgent: summary.urgent ?? -1,
      line_fail:
        window.TasuAnpiNotifications?.getLineSendFailureSummary?.({
          contractHolderId: holderId,
        })?.failed_count ?? -1,
    };
  }, HOLDER);
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
    await seedFailed(page);

    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await waitAnpiApis(page);
    await page.waitForFunction(
      () => {
        const host = document.querySelector("[data-dash-anpi-line-fail-host]");
        return host && !host.hidden && host.querySelector(".dash-anpi-line-fail");
      },
      { timeout: 15000 }
    );

    const countsBefore = await getBadgeCounts(page);
    if (countsBefore.line_fail === 1) pass(`${vp.name}: failure summary 1件`);
    else fail(`${vp.name}: failure summary`, String(countsBefore.line_fail));

    const dashLineCard = page.locator("[data-dash-anpi-line-fail-host] .dash-anpi-line-fail");
    if (await dashLineCard.isVisible()) pass(`${vp.name}: dashboard LINE失敗カード`);
    else fail(`${vp.name}: dashboard LINE失敗カード`);

    const dashTitle = await dashLineCard.locator(".dash-anpi-line-fail__title").textContent();
    if (dashTitle?.includes("LINE通知の送信に失敗")) {
      pass(`${vp.name}: dashboard 見出し`);
    } else fail(`${vp.name}: dashboard 見出し`, dashTitle || "");

    await page.goto(`${BASE}${ANPI_DASH}`, { waitUntil: "domcontentloaded" });
    await waitAnpiApis(page);
    await page.waitForSelector("[data-anpi-line-fail-panel]:not([hidden])", { timeout: 15000 });

    const anpiPanel = page.locator("[data-anpi-line-fail-panel]:not([hidden])");
    if (await anpiPanel.isVisible()) pass(`${vp.name}: anpi-dashboard LINE失敗パネル`);
    else fail(`${vp.name}: anpi-dashboard LINE失敗パネル`);

    const panelTitle = await anpiPanel.locator(".anpi-line-fail-panel__title").textContent();
    if (panelTitle?.includes("外部通知")) pass(`${vp.name}: anpi-dashboard 外部通知ラベル`);
    else fail(`${vp.name}: anpi-dashboard 外部通知ラベル`, panelTitle || "");

    const urgentPanel = page.locator(".anpi-urgent-panel");
    const linePanel = page.locator(".anpi-line-fail-panel");
    const urgentBox = await urgentPanel.boundingBox();
    const lineBox = await linePanel.boundingBox();
    if (urgentBox && lineBox && lineBox.y > urgentBox.y) {
      pass(`${vp.name}: 緊急パネルとLINE失敗パネル分離`);
    } else if (!urgentBox && lineBox) {
      pass(`${vp.name}: 緊急パネルとLINE失敗パネル分離`);
    } else {
      fail(`${vp.name}: 緊急パネルとLINE失敗パネル分離`);
    }

    await page.goto(`${BASE}${CENTER}`, { waitUntil: "domcontentloaded" });
    await waitAnpiApis(page);

    const card = page.locator(
      '[data-anpi-notification-list] li[data-anpi-card][data-log-id="line_fail_e2e_log"]'
    );
    await card.waitFor({ state: "visible", timeout: 15000 });

    const failBadge = card.locator(".anpi-line-status--failed .anpi-line-status__badge");
    if ((await failBadge.textContent())?.includes("LINE送信失敗")) {
      pass(`${vp.name}: 通知センター LINE送信失敗バッジ`);
    } else fail(`${vp.name}: 通知センター LINE送信失敗バッジ`);

    const errText = card.locator(".anpi-line-status__error");
    if ((await errText.textContent())?.includes("Mock LINE send failed")) {
      pass(`${vp.name}: line_error_message 表示`);
    } else fail(`${vp.name}: line_error_message 表示`);

    await card.locator("[data-anpi-toggle]").click();

    const retryBtn = card.locator("[data-anpi-line-retry]");
    if (await retryBtn.isVisible()) pass(`${vp.name}: LINE再送ボタン`);
    else fail(`${vp.name}: LINE再送ボタン`);

    await page.evaluate(() => {
      localStorage.setItem("tasu_anpi_line_send_mock_v1", "1");
    });

    await retryBtn.click();
    await page.waitForFunction(
      () => {
        const logs = JSON.parse(localStorage.getItem("tasu_anpi_notification_logs_v1") || "[]");
        const log = logs.find((l) => l.id === "line_fail_e2e_log");
        return log?.line_status === "sent";
      },
      { timeout: 10000 }
    );

    const logAfter = await page.evaluate((logKey) => {
      const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
      return logs.find((l) => l.id === "line_fail_e2e_log");
    }, STORAGE_LOGS);

    if (logAfter?.line_status === "sent") pass(`${vp.name}: 再送後 line_status sent`);
    else fail(`${vp.name}: 再送後 line_status`, logAfter?.line_status);

    if (logAfter?.line_sent_at) pass(`${vp.name}: 再送後 line_sent_at`);
    else fail(`${vp.name}: 再送後 line_sent_at`);

    await page.waitForTimeout(400);

    const sentBadge = card.locator(".anpi-line-status--sent .anpi-line-status__badge");
    if ((await sentBadge.textContent())?.includes("LINE送信済み")) {
      pass(`${vp.name}: LINE送信済み表示`);
    } else fail(`${vp.name}: LINE送信済み表示`);

    if ((await card.locator("[data-anpi-line-retry]").count()) === 0) {
      pass(`${vp.name}: 再送ボタン非表示`);
    } else fail(`${vp.name}: 再送ボタン非表示`);

    await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
    await waitAnpiApis(page);
    await page.waitForTimeout(600);

    if (!(await page.locator("[data-dash-anpi-line-fail-host] .dash-anpi-line-fail").isVisible())) {
      pass(`${vp.name}: dashboard 失敗カード消滅`);
    } else fail(`${vp.name}: dashboard 失敗カード消滅`);

    await page.goto(`${BASE}${ANPI_DASH}`, { waitUntil: "domcontentloaded" });
    await waitAnpiApis(page);
    await page.waitForTimeout(600);

    if (await page.locator("[data-anpi-line-fail-panel]").isHidden()) {
      pass(`${vp.name}: anpi-dashboard 失敗パネル非表示`);
    } else fail(`${vp.name}: anpi-dashboard 失敗パネル非表示`);

    const countsAfter = await getBadgeCounts(page);
    if (countsAfter.summary_unread === countsBefore.summary_unread) {
      pass(`${vp.name}: 未読サマリー不変`, String(countsAfter.summary_unread));
    } else {
      fail(
        `${vp.name}: 未読サマリー不変`,
        `${countsBefore.summary_unread}->${countsAfter.summary_unread}`
      );
    }

    if (countsAfter.line_fail === 0) pass(`${vp.name}: failure summary 0件`);
    else fail(`${vp.name}: failure summary 再送後`, String(countsAfter.line_fail));

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    if (!overflow) pass(`${vp.name}: 横スクロールなし`);
    else fail(`${vp.name}: 横スクロール`);
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINE送信失敗フォールバック E2E — ${BASE}\n`);
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
