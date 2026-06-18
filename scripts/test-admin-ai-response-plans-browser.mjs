#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 Phase2/3 — AI対応案 E2E（TALK通知・運営履歴）
 *   node scripts/test-admin-ai-response-plans-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_ai_ops_cases_v1",
  "tasful:builder:partner_evaluations:v1",
  "tasful:builder:partner_visibility:v1",
  "tasu_admin_connect_resolved_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_admin_ai_response_send_logs_v1",
  "tasu_admin_ai_response_dismissed_v1",
  "tasu_admin_ops_ai_response_activity_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasful_talk_notifications",
];

function pageUrl(rel) {
  const [pathname, query] = String(rel || "").split("?");
  const base = process.env.BUILDER_BASE_URL;
  if (base) {
    const url = `${base.replace(/\/$/, "")}/${pathname.replace(/^\//, "")}`;
    return query ? `${url}?${query}` : url;
  }
  const fileHref = pathToFileURL(path.join(root, pathname)).href;
  return query ? `${fileHref.split("?")[0]}?${query}` : fileHref;
}

function fail(msg) {
  console.error("FAIL:", msg);
  closeAllBrowsers().finally(() => process.exit(1));
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seedSupport(page) {
  return page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support service" };

    const now = new Date().toISOString();
    const ticketId = "resp_connect_ticket_001";
    window.TasuSupportTicketStore.saveTicket({
      id: ticketId,
      title: "[Connect] 本人確認の追加情報",
      body: "Stripe Connect additional information required. verification documents needed.",
      user_id: "resp_test",
      source: "support_intake",
      category: "connect_issue",
      severity: "high",
      status: "needs_review",
      created_at: now,
      updated_at: now,
    });
    window.TasuSupportTicketStore.saveConnectIssue({
      id: "resp_conn_issue_001",
      user_id: "resp_test",
      stripe_account_id: "acct_resp_test",
      stripe_event_type: "account.updated",
      issue_type: "requirements_past_due",
      severity: "high",
      status: "open",
      detected_reason: "Connect account requires additional verification documents.",
      recommended_action: "Review in Stripe Dashboard",
      admin_required: true,
      ticket_id: ticketId,
      created_at: now,
      resolved_at: null,
    });

    svc.submitInquiry({
      user_id: "resp_test",
      title: "支払い確認",
      body: "決済の確認状況を教えてください。",
    });
    svc.submitInquiry({
      user_id: "resp_test",
      title: "返金希望",
      body: "全額返金をお願いします。",
    });
    svc.submitInquiry({
      user_id: "resp_test",
      title: "通報",
      body: "不適切な出品を通報します。",
    });

    return { ok: true };
  });
}

async function seedDashboardExtras(page) {
  return page.evaluate(() => {
    window.TasuAiOpsCaseStore?.clearAllForTests?.();
    window.TasuBuilderPartnerEval?.clearAllForTests?.();

    const cBan = window.TasuAiOpsCaseStore?.createCaseFromInput?.(
      {
        title: "BAN候補",
        body: "アカウント停止とBANを検討してください。",
        status: "needs_review",
      },
      false
    );
    if (!cBan) return { ok: false, reason: "ai ops case" };

    globalThis.__BUILDER_DEMO_PARTNER_NAMES__ = [
      { display_name: "テスト非表示工務", partner_id: "demo-hide-resp" },
    ];
    const hideRes = window.TasuBuilderPartnerEval.applyPartnerHideStatus({
      partner_name: "テスト非表示工務",
      reason: "E2E",
    });
    if (!hideRes.ok) return { ok: false, reason: hideRes.error || "hide failed" };

    const now = new Date().toISOString();
    window.TasuTalkNotifications?.add?.({
      id: "resp-anpi-001",
      type: "anpi",
      category: "anpi",
      title: "安否未応答テスト",
      body: "安否確認に未応答の利用者がいます。",
      priority: "urgent",
      targetUrl: "anpi-dashboard.html",
      createdAt: now,
    });

    return { ok: true, banId: cBan.id };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();

  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seedRes = await seedSupport(page);
  if (!seedRes.ok) fail(`seed support: ${seedRes.reason}`);
  pass("Supportテストデータ投入");

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiResponsePlans, { timeout: 15000 });

  const seedDash = await seedDashboardExtras(page);
  if (!seedDash.ok) fail(`seed dashboard: ${seedDash.reason}`);
  pass("AI運営・Builder・安否テストデータ投入");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiResponsePlans, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminOperationsDashboard.refresh();
    window.TasuAdminAiResponsePlans.renderPlansPanelSync?.();
  });
  await page.waitForTimeout(100);

  const sectionTitle = await page.locator("#ops-response-heading").textContent();
  if (!sectionTitle?.includes("AI対応案")) fail(`section title: ${sectionTitle}`);
  pass("司令塔にAI対応案セクションがある");

  const cardCount = await page.locator("[data-ops-ai-response-card]").count();
  if (cardCount < 3) fail(`response cards ${cardCount}`);
  pass("対応案カードが複数生成される");

  const plans = await page.evaluate(() => window.TasuAdminAiResponsePlans.buildResponsePlans());
  const eventTypes = new Set(plans.map((p) => p.eventType));
  for (const expected of [
    "connect_incomplete",
    "refund_consultation",
    "report",
    "listing_hide_candidate",
    "anpi_no_response",
  ]) {
    if (!eventTypes.has(expected)) fail(`missing eventType ${expected}: ${[...eventTypes].join(",")}`);
  }
  pass("Connect / Support / 通報 / Builder / 安否から対応案が生成される");

  const highPlan = plans.find((p) => p.confirmOnly || p.gateLevel === "high");
  if (!highPlan) fail("no high risk plan");
  if (highPlan.primaryActionLabel !== "確認") fail(`high risk primary ${highPlan.primaryActionLabel}`);
  pass("高リスクは送信ではなく確認扱い");

  const gateOnCard = await page.locator("[data-ops-ai-response-gate]").first().innerText();
  if (!/安全判定|資格\/許可|判定理由|送信可否/.test(gateOnCard)) fail(`gate UI: ${gateOnCard.slice(0, 80)}`);
  pass("カードに安全・資格Gateが表示される");

  const lowOrMed =
    plans.find(
      (p) =>
        p.gateLevel === "low" &&
        p.sendAllowed &&
        p.status === "draft" &&
        p.targetUserId &&
        ["payment_pending", "inquiry_received", "deadline_reminder"].includes(p.eventType)
    ) ||
    plans.find((p) => p.gateLevel === "medium" && p.sendAllowed && p.status === "draft");
  if (!lowOrMed) fail("no draft low/medium plan");
  const sendBtn = page.locator(
    `[data-ops-ai-response-send][data-plan-id="${lowOrMed.id}"]`
  );
  if (!(await sendBtn.count())) fail("send button missing");
  const sendLabel = await sendBtn.textContent();
  if (sendLabel !== "送信") fail(`send label ${sendLabel}`);
  pass("低・中リスクカードに送信ボタンがある");

  for (const label of ["編集", "保留"]) {
    const btn = page.locator(`[data-ops-ai-response-card] button:has-text("${label}")`).first();
    if (!(await btn.count())) fail(`button missing: ${label}`);
  }
  pass("各カードに編集・保留ボタンがある");

  await page.locator(`[data-ops-ai-response-edit][data-plan-id="${lowOrMed.id}"]`).click();
  await page.waitForFunction(
    () => {
      const m = document.querySelector("[data-ops-ai-response-modal]");
      return m && !m.hidden;
    },
    { timeout: 5000 }
  );
  const editedText = "E2E編集後の返信案です。担当よりご連絡します。";
  await page.locator("[data-ops-ai-response-modal-draft]").fill(editedText);
  await page.locator("[data-ops-ai-response-modal-save]").click();
  await page.waitForFunction(
    () => {
      const m = document.querySelector("[data-ops-ai-response-modal]");
      return m && m.hidden;
    },
    { timeout: 5000 }
  );

  const afterEdit = await page.evaluate(
    (id) => window.TasuAdminAiResponsePlans.buildResponsePlans().find((p) => p.id === id),
    lowOrMed.id
  );
  if (afterEdit?.aiDraftMessage !== editedText) fail(`edit not saved: ${afterEdit?.aiDraftMessage}`);
  pass("編集モーダルで返信案を変更できる");

  await page.waitForSelector(
    `[data-ops-ai-response-send][data-plan-id="${lowOrMed.id}"]:not([disabled])`,
    { timeout: 10000 }
  );
  await page.locator(`[data-ops-ai-response-send][data-plan-id="${lowOrMed.id}"]`).click();
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-ops-ai-response-toast]");
      return t && !t.hidden && /承認待ち|送信/.test(t.textContent || "");
    },
    { timeout: 10000 }
  );

  await page.evaluate(
    (planId) => {
      const HSG = window.TasuAdminAiHumanSendGate;
      const pending = HSG.readPendingQueue().find((p) => p.payload?.planId === planId) || HSG.readPendingQueue()[0];
      if (pending) HSG.approveAndExecute(pending.id);
    },
    lowOrMed.id
  );

  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-ops-ai-response-toast]");
      const logs = window.TasuAdminAiResponsePlans?.readSendLogs?.() || [];
      return (
        (t && !t.hidden && /TALK通知|完了|承認/.test(t.textContent || "")) ||
        logs.some((l) => l.mode === "talk_notification")
      );
    },
    { timeout: 15000 }
  );
  const logs = await page.evaluate(() => window.TasuAdminAiResponsePlans.readSendLogs());
  if (!logs.length) fail("send log empty");
  if (!logs[0].note?.includes("TALK通知")) fail(`send log note: ${logs[0].note}`);
  if (logs[0].mode !== "talk_notification") fail(`send log mode: ${logs[0].mode}`);
  if (!logs[0].safetyResult || !logs[0].licenseResult) fail("send log missing gate results");
  const notify = await page.evaluate(
    (id) =>
      (window.TasuTalkNotifications?.getAll?.() || []).find(
        (n) => String(n.source) === "ai_response_plan" && String(n.id).includes(id)
      ),
    lowOrMed.id
  );
  if (!notify) fail("TALK notification not created");
  if (!notify.title?.includes("【運営】")) fail(`notify title: ${notify.title}`);
  const activity = await page.evaluate(() => window.TasuAdminAiResponsePlans.listOpsActivity());
  if (!activity.some((a) => a.type === "ai_response_sent")) fail("ops activity missing sent");
  const sentCard = await page
    .locator(`[data-ops-ai-response-card][data-plan-id="${lowOrMed.id}"]`)
    .innerText();
  if (!sentCard.includes("送信済み")) fail(`sent status: ${sentCard.slice(0, 120)}`);
  pass("送信でTALK通知・運営履歴・送信ログが残る");

  await page.goto(pageUrl("talk-home.html?tab=notify&userId=resp_test&talkDev=1"), {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.waitForFunction(() => window.TasuTalkData?.getNotifications, { timeout: 30000 });
  const notifyId = `talk-n-ai-response-${lowOrMed.id}`;
  const centerCheck = await page.evaluate((id) => {
    const inStore = (window.TasuTalkNotifications?.getAll?.() || []).some(
      (n) => String(n.id) === id && String(n.source) === "ai_response_plan"
    );
    const rows =
      window.TasuTalkData?.getNotifications?.({
        filter: "all",
        applySettings: false,
        showMuted: true,
      }) || [];
    const inCenter = rows.some((n) => String(n.id) === id);
    return {
      inStore,
      inCenter,
      effectiveUid: window.TasuChatUserIdentity?.getEffectiveUserId?.() || "",
      titles: rows.slice(0, 5).map((n) => n.title),
    };
  }, notifyId);
  if (!centerCheck.inStore) fail("TALK notification not in store on notify page");
  if (!centerCheck.inCenter) {
    fail(
      `notification not in notify center pipeline uid=${centerCheck.effectiveUid} titles=${centerCheck.titles.join("|")}`
    );
  }
  pass("通知センターでAI対応案のTALK通知を確認できる");

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiResponsePlans, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminOperationsDashboard.refresh();
    window.TasuAdminAiResponsePlans.renderPlansPanel();
  });

  const highPlanFresh = await page.evaluate(() =>
    window.TasuAdminAiResponsePlans.buildResponsePlans().find(
      (p) => p.confirmOnly || p.gateLevel === "high"
    )
  );
  if (!highPlanFresh) fail("no high risk plan after notify check");
  const highId = highPlanFresh.id;
  const highSend = page.locator(`[data-ops-ai-response-send][data-plan-id="${highId}"]`);
  if (!(await highSend.count())) fail(`high risk send button missing: ${highId}`);
  await highSend.click();
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-ops-ai-response-toast]");
      return t && !t.hidden && /確認のみ|Safety Gate|要確認/.test(t.textContent || "");
    },
    { timeout: 5000 }
  );
  const highLogs = await page.evaluate(() => window.TasuAdminAiResponsePlans.readSendLogs());
  const escalated = highLogs.find((l) => l.planId === highId && l.action === "escalated");
  if (!escalated) fail("high risk escalated log missing");
  const highNotify = await page.evaluate(
    (id) =>
      (window.TasuTalkNotifications?.getAll?.() || []).find(
        (n) => String(n.source) === "ai_response_plan" && String(n.id).includes(id)
      ),
    highId
  );
  if (highNotify) fail("high risk should not create TALK notification");
  const escalatedActivity = await page.evaluate(() =>
    window.TasuAdminAiResponsePlans.listOpsActivity().some((a) => a.type === "ai_response_escalated")
  );
  if (!escalatedActivity) fail("high risk ops activity missing");
  const highCard = await page
    .locator(`[data-ops-ai-response-card][data-plan-id="${highId}"]`)
    .innerText();
  if (!highCard.includes("要確認")) fail(`high risk card: ${highCard.slice(0, 120)}`);
  pass("高リスク確認はTALK通知せず運営履歴のみ記録される");

  await page.evaluate(() => {
    const fold = document.getElementById("ops-ai-activity-fold");
    if (fold) fold.open = true;
    window.TasuAdminOperationsDashboard.refresh();
  });
  const activityPanel = await page.locator("[data-ops-dash-activity]").innerText();
  if (!/AI対応/.test(activityPanel)) fail(`dashboard activity: ${activityPanel.slice(0, 120)}`);
  pass("司令塔の運営履歴にAI対応が表示される");

  const holdTarget = await page.evaluate(
    ({ sentId, escalatedId }) =>
      window.TasuAdminAiResponsePlans.buildResponsePlans().find(
        (p) => p.id !== sentId && p.id !== escalatedId && p.status === "draft"
      ),
    { sentId: lowOrMed.id, escalatedId: highId }
  );
  if (holdTarget) {
    await page.locator(`[data-ops-ai-response-hold][data-plan-id="${holdTarget.id}"]`).click();
    await page.waitForFunction(
      (id) => !document.querySelector(`[data-ops-ai-response-card][data-plan-id="${id}"]`),
      holdTarget.id,
      { timeout: 5000 }
    );
    const stillThere = await page
      .locator(`[data-ops-ai-response-card][data-plan-id="${holdTarget.id}"]`)
      .count();
    if (stillThere) fail(`hold did not remove plan ${holdTarget.id}`);
    pass("保留で一覧から外れる");
  } else {
    pass("保留対象なし（スキップ）");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow390 = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  if (overflow390) fail("390px horizontal scroll detected");
  const responseVisible = await page.locator("#ops-ai-response").isVisible();
  if (!responseVisible) fail("AI対応案が390pxで非表示");
  const modalBtn = page.locator("[data-ops-ai-response-edit]").first();
  if (await modalBtn.isEnabled()) {
    await modalBtn.click();
    const modalW = await page.locator(".ops-ai-response-modal__panel").boundingBox();
    if (!modalW || modalW.width > 390) fail(`modal width ${modalW?.width}`);
    await page.locator("[data-ops-ai-response-modal-close]").first().click();
  }
  pass("390pxで操作できる");

    });
  console.log("\nAll AI response plan tests passed.");
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
