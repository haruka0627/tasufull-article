#!/usr/bin/env node
/**
 * 安否ダッシュボード E2E
 *
 *   node scripts/test-anpi-dashboard-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const PAGE = "/anpi-dashboard.html";
const DASH = "/dashboard.html";
const STORAGE_CONTEXT = "tasu_anpi_user_context_v1";
const STORAGE_LOGS = "tasu_anpi_notification_logs_v1";

const SEED_CONTEXT = {
  user_id: "anpi_user_dash",
  user_name: "山田太郎",
  user_phone_masked: "09-***-5678",
  is_anpi_user: true,
  contract_holder_id: "holder_dash",
  contract_holder_name: "山田花子",
  contract_holder_relation: "娘",
  contract_holder_phone_masked: "03-***-5678",
  contract_holder_email: "hanako@example.com",
  contract_holder_contact_method: "tasful_chat",
  notify_channels: ["tasful_chat", "line"],
  notification_level: "important_only",
  consent: {
    no_auto_execution: true,
    self_confirm_required: true,
    tasful_no_guarantee: true,
    emergency_contact_required: true,
    agreed_at: new Date().toISOString(),
  },
  created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  updated_at: new Date(Date.now() - 3600000).toISOString(),
};

const SEED_LOGS = [
  {
    id: "dash_urgent_1",
    event_type: "urgent_keyword_detected",
    user_id: "anpi_user_dash",
    user_name: "山田太郎",
    contract_holder_id: "holder_dash",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】緊急キーワード",
    message: "息苦しい",
    status: "local_only",
    is_read: false,
    priority: "urgent",
    created_at: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "dash_urgent_2",
    event_type: "urgent_keyword_detected",
    user_id: "anpi_user_dash",
    user_name: "山田太郎",
    contract_holder_id: "holder_dash",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】緊急2",
    message: "倒れた",
    status: "local_only",
    is_read: false,
    priority: "urgent",
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "dash_call",
    event_type: "call_consent_accepted",
    user_id: "anpi_user_dash",
    user_name: "山田太郎",
    contract_holder_id: "holder_dash",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】電話（同意）",
    message: "電話同意",
    status: "local_only",
    is_read: true,
    priority: "high",
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "dash_ai",
    event_type: "ai_search",
    user_id: "anpi_user_dash",
    user_name: "山田太郎",
    contract_holder_id: "holder_dash",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】AI検索",
    message: "買い物代行",
    status: "local_only",
    is_read: true,
    priority: "normal",
    created_at: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: "dash_ai2",
    event_type: "ai_search",
    user_id: "anpi_user_dash",
    user_name: "山田太郎",
    contract_holder_id: "holder_dash",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】AI検索2",
    message: "見守り",
    status: "local_only",
    is_read: false,
    priority: "normal",
    created_at: new Date(Date.now() - 240000).toISOString(),
  },
  {
    id: "dash_extra",
    event_type: "call_consent_opened",
    user_id: "anpi_user_dash",
    user_name: "山田太郎",
    contract_holder_id: "holder_dash",
    contract_holder_name: "山田花子",
    contract_holder_relation: "娘",
    channel: "tasful_chat",
    title: "【TASFUL安否通知】電話（確認）",
    message: "確認",
    status: "local_only",
    is_read: false,
    priority: "medium",
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

async function seedRegistered(page, { logs = true } = {}) {
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
  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-anpi-dashboard-root]", { timeout: 15000 });
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
    await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 8000 });

    const unreg = await page.locator("[data-anpi-empty-unregistered]:not([hidden])").isVisible();
    const regCta = await page.locator('a[href="anpi-register.html"].anpi-dashboard-empty__cta').count();
    if (unreg && regCta > 0) pass(`${vp.name}: 未登録表示`);
    else fail(`${vp.name}: 未登録表示`);

    await page.waitForSelector('[data-anpi-summary-grid] [data-demo="true"]', { timeout: 8000 });

    const demoStatCards = await page.locator('[data-anpi-summary-grid] .anpi-stat-card[data-demo="true"]').count();
    const demoStatUser = await page.locator("[data-anpi-summary-user-name-card]").textContent();
    const demoStatSample = await page.locator("[data-anpi-stat-sample]:not([hidden])").count();
    if (
      demoStatCards === 4 &&
      demoStatUser?.includes("1,248") &&
      demoStatSample === 4
    ) {
      pass(`${vp.name}: 統計デモ表示`);
    } else {
      fail(
        `${vp.name}: 統計デモ表示`,
        `cards=${demoStatCards} user=${demoStatUser || ""} sample=${demoStatSample}`
      );
    }

    await seedRegistered(page, { logs: false });
    await gotoDashboard(page);
    await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 8000 });

    const demoRecent = await page.locator('[data-anpi-recent-list] [data-demo="true"]').count();
    const emptyRecent = await page.locator("[data-anpi-recent-empty]:not([hidden])").isVisible();
    if (demoRecent === 5 && !emptyRecent) pass(`${vp.name}: 通知デモ表示`);
    else fail(`${vp.name}: 通知デモ表示`, `demo=${demoRecent} empty=${emptyRecent}`);

    const urgentEmpty = await page.locator("[data-anpi-urgent-empty]:not([hidden])").isVisible();
    if (urgentEmpty) pass(`${vp.name}: 緊急0件メッセージ`);
    else fail(`${vp.name}: 緊急0件メッセージ`);

    await seedRegistered(page, { logs: true });
    await gotoDashboard(page);
    await page.waitForSelector("[data-anpi-dashboard-shell]:not([hidden])", { timeout: 8000 });

    const demoStatAfterReg = await page.locator('[data-anpi-summary-grid] .anpi-stat-card[data-demo="true"]').count();
    if (demoStatAfterReg === 0) pass(`${vp.name}: 統計デモ非表示（登録済）`);
    else fail(`${vp.name}: 統計デモ非表示（登録済）`, String(demoStatAfterReg));

    const userName = await page.locator("[data-anpi-summary-user-name-card]").textContent();
    if (userName?.includes("山田太郎")) pass(`${vp.name}: サマリー利用者名`);
    else fail(`${vp.name}: サマリー利用者名`, userName || "");

    const holderName = await page.locator("[data-anpi-summary-holder-name-card]").textContent();
    if (holderName?.includes("山田花子")) pass(`${vp.name}: サマリー契約者名`);
    else fail(`${vp.name}: サマリー契約者名`, holderName || "");

    const level = await page.locator("[data-anpi-summary-level]").textContent();
    if (level?.includes("重要")) pass(`${vp.name}: 通知レベル`);
    else fail(`${vp.name}: 通知レベル`, level || "");

    const channels = await page.locator("[data-anpi-summary-channels]").textContent();
    if (channels?.includes("TASFUL")) pass(`${vp.name}: 通知方法`);
    else fail(`${vp.name}: 通知方法`, channels || "");

    const lastAct = await page.locator("[data-anpi-summary-last-activity]").textContent();
    if (lastAct && lastAct !== "—" && (lastAct.includes("今日") || lastAct.includes("/"))) {
      pass(`${vp.name}: 最終活動日時`, lastAct.trim());
    } else {
      fail(`${vp.name}: 最終活動日時`, lastAct || "");
    }

    const unread = await page.locator("[data-anpi-summary-unread-card]").textContent();
    if (unread === "4") pass(`${vp.name}: 未読数`, unread);
    else fail(`${vp.name}: 未読数`, unread || "");

    const total = await page.locator("[data-anpi-summary-total-card]").textContent();
    if (total === "6") pass(`${vp.name}: 総通知数`, total);
    else fail(`${vp.name}: 総通知数`, total || "");

    const urgentCount = await page.locator("[data-anpi-summary-urgent]").textContent();
    if (urgentCount === "2") pass(`${vp.name}: 緊急通知数`, urgentCount);
    else fail(`${vp.name}: 緊急通知数`, urgentCount || "");

    const urgentItems = await page.locator("[data-anpi-urgent-list] .anpi-urgent-item").count();
    if (urgentItems === 2) pass(`${vp.name}: 緊急最新3件以内`, String(urgentItems));
    else fail(`${vp.name}: 緊急最新3件以内`, String(urgentItems));

    const recentItems = await page.locator("[data-anpi-recent-list] .anpi-recent-item").count();
    const demoInList = await page.locator('[data-anpi-recent-list] [data-demo="true"]').count();
    if (recentItems === 5 && demoInList === 0) pass(`${vp.name}: 最近の通知5件`, String(recentItems));
    else fail(`${vp.name}: 最近の通知5件`, `items=${recentItems} demo=${demoInList}`);

    const recentHref = await page
      .locator("[data-anpi-recent-list] .anpi-recent-item")
      .first()
      .getAttribute("href");
    if (recentHref === "anpi-notifications.html") pass(`${vp.name}: 通知センター導線`);
    else fail(`${vp.name}: 通知センター導線`, recentHref || "");

    const editLink = await page.locator('[data-anpi-action-grid] a[href="anpi-register.html"]').count();
    const aiLink = await page.locator('[data-anpi-action-grid] a[href="ai-workspace.html"]').count();
    if (editLink > 0 && aiLink > 0) pass(`${vp.name}: 登録編集・AI導線`);
    else fail(`${vp.name}: 登録編集・AI導線`);

    if (vp.name === "PC") {
      await page.goto(`${BASE}${DASH}`, { waitUntil: "domcontentloaded" });
      await page
        .waitForSelector('#dashSidebarNav a[href="anpi-dashboard.html"]', { timeout: 25000 })
        .catch(() => null);
      const dashLink = await page.locator('#dashSidebarNav a[href="anpi-dashboard.html"]').count();
      const regLink = await page.locator('#dashSidebarNav a[href="anpi-register.html"]').count();
      const centerLink = await page.locator('#dashSidebarNav a[href="anpi-notifications.html"]').count();
      if (dashLink && regLink && centerLink) pass(`${vp.name}: dashboard.js導線`);
      else fail(`${vp.name}: dashboard.js導線`);

      await page.waitForSelector('[data-dash-quick] a[href="anpi-dashboard.html"]', { timeout: 15000 }).catch(() => null);
      const quick = await page.locator('[data-dash-quick] a[href="anpi-dashboard.html"]').count();
      if (quick > 0) pass(`${vp.name}: クイックアクション`);
      else fail(`${vp.name}: クイックアクション`);
    }
  } finally {
    if (errors.length) fail(`${vp.name}: console error`, errors.slice(0, 2).join(" | "));
    else pass(`${vp.name}: console error なし`);
    await context.close();
  }
}

async function main() {
  console.log(`\n安否ダッシュボード E2E — ${BASE}${PAGE}\n`);
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
