#!/usr/bin/env node
/**
 * LINE通知プレビューログ E2E
 *
 *   node scripts/test-anpi-line-notification-log-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const PAGE = "/anpi-register.html";
const DASH = "/dashboard.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";

const SEED_CONTEXT = {
  user_id: "anpi_user_line",
  user_name: "山田太郎",
  user_phone_masked: "09-***-5678",
  is_anpi_user: true,
  contract_holder_id: "holder_line",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_phone_masked: "03-***-5678",
  contract_holder_email: "hanako@example.com",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "important_only",
  line_notification_enabled: true,
  line_user_id: "line_user_e2e_test",
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

const SEED_CALL_LOG = {
  id: "line_e2e_call",
  event_type: "call_consent_accepted",
  user_id: "anpi_user_line",
  user_name: "山田太郎",
  contract_holder_id: "holder_line",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  channel: "tasful_chat",
  title: "【TASFUL安否通知】電話（同意）",
  message: "既存ログ",
  status: "local_only",
  is_read: false,
  priority: "high",
  created_at: new Date(Date.now() - 120000).toISOString(),
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

async function seed(page) {
  await ensureOrigin(page);
  await page.evaluate(
    ({ ctxKey, logKey, ctx, callLog }) => {
      localStorage.setItem(ctxKey, JSON.stringify(ctx));
      localStorage.setItem(logKey, JSON.stringify([callLog]));
    },
    {
      ctxKey: STORAGE_CONTEXT,
      logKey: STORAGE_LOGS,
      ctx: SEED_CONTEXT,
      callLog: SEED_CALL_LOG,
    }
  );
}

async function gotoRegister(page) {
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-anpi-line-test]", { timeout: 15000 });
}

async function runViewport(browser, vp) {
  console.log(`\n======== ${vp.name} ========`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];
  let previewEventFired = false;

  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsoleError(msg.text())) {
      errors.push(msg.text());
    }
  });

  await page.exposeFunction("__anpiLinePreviewSeen", () => {
    previewEventFired = true;
  });

  try {
    await seed(page);
    await gotoRegister(page);

    await page.evaluate(() => {
      window.addEventListener("tasful:anpi-notification-line-preview", () => {
        window.__anpiLinePreviewSeen?.();
      });
    });

    const summaryBefore = await page.evaluate((logKey) => {
      const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
      return {
        total: logs.length,
        unread: logs.filter((l) => !l.is_read).length,
      };
    }, STORAGE_LOGS);

    await page.click("[data-anpi-line-enable]");
    await page.click("[data-anpi-line-test]");
    await page.waitForSelector(".anpi-register-line-feedback.is-success:not([hidden])", {
      timeout: 8000,
    });
    pass(`${vp.name}: テスト通知UI反応`);

    if (previewEventFired) pass(`${vp.name}: tasful:anpi-notification-line-preview`);
    else fail(`${vp.name}: tasful:anpi-notification-line-preview`);

    const logState = await page.evaluate((logKey) => {
      const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
      const preview = logs.find((l) => l.event_type === "line_notification_preview");
      const call = logs.find((l) => l.id === "line_e2e_call");
      return { preview, call, logs };
    }, STORAGE_LOGS);

    if (logState.preview?.line_preview_sent_at) {
      pass(`${vp.name}: line_preview_sent_at`, logState.preview.line_preview_sent_at.slice(0, 19));
    } else {
      fail(`${vp.name}: line_preview_sent_at`);
    }

    if (logState.preview?.line_status === "pending") pass(`${vp.name}: line_status pending`);
    else fail(`${vp.name}: line_status pending`, logState.preview?.line_status);

    if (logState.preview?.line_sent_at == null || logState.preview?.line_sent_at === "") {
      pass(`${vp.name}: line_sent_at null`);
    } else {
      fail(`${vp.name}: line_sent_at null`, String(logState.preview?.line_sent_at));
    }

    if (logState.preview?.line_notification_enabled === true) {
      pass(`${vp.name}: line_notification_enabled`);
    } else {
      fail(`${vp.name}: line_notification_enabled`);
    }

    if (logState.preview?.line_user_id === "line_user_e2e_test") {
      pass(`${vp.name}: line_user_id`);
    } else {
      fail(`${vp.name}: line_user_id`, logState.preview?.line_user_id);
    }

    if (logState.call?.event_type === "call_consent_accepted" && logState.call?.is_read === false) {
      pass(`${vp.name}: 既存ログ維持`);
    } else {
      fail(`${vp.name}: 既存ログ維持`);
    }

    const summaryAfter = await page.evaluate(
      ({ logKey, holderId }) => {
        const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
        const filtered = logs.filter((l) => l.contract_holder_id === holderId);
        const countable = filtered.filter((l) => l.event_type !== "line_notification_preview");
        return {
          total: filtered.length,
          unread: countable.filter((l) => !l.is_read).length,
        };
      },
      { logKey: STORAGE_LOGS, holderId: "holder_line" }
    );

    if (summaryAfter.unread === summaryBefore.unread) {
      pass(`${vp.name}: バッジ用未読変化なし`, String(summaryAfter.unread));
    } else {
      fail(
        `${vp.name}: バッジ用未読変化なし`,
        `${summaryBefore.unread} -> ${summaryAfter.unread}`
      );
    }

    if (vp.name === "PC") {
      await page.evaluate(
        ({ logKey, callLog, preview }) => {
          const list = [preview, callLog].filter(Boolean);
          localStorage.setItem(logKey, JSON.stringify(list));
        },
        { logKey: STORAGE_LOGS, callLog: logState.call, preview: logState.preview }
      );
      await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
      await page
        .waitForSelector("#dashSidebarNav", { timeout: 25000 })
        .catch(() => null);
      await page.waitForTimeout(1200);
      const badgeState = await page.evaluate(() =>
        window.TasuAnpiNotificationBadge?.getAnpiBadgeState?.()
      );
      const urgentCard = await page.locator("[data-dash-anpi-urgent-host]:not([hidden])").isVisible();
      if (badgeState?.unread_count === 1) {
        pass(`${vp.name}: dashboard未読バッジ維持`, String(badgeState.unread_count));
      } else {
        fail(`${vp.name}: dashboard未読バッジ`, String(badgeState?.unread_count));
      }
      if (!urgentCard) pass(`${vp.name}: 緊急カード非表示`);
      else fail(`${vp.name}: 緊急カード非表示`);
    }
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\nLINEプレビューログ E2E — ${BASE}${PAGE}\n`);
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
