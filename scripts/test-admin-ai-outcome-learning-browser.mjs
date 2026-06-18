#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 Phase8 — Outcome Learning E2E
 *   node scripts/test-admin-ai-outcome-learning-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
  "tasu_admin_connect_resolved_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_admin_ai_response_send_logs_v1",
  "tasu_admin_ai_response_dismissed_v1",
  "tasu_admin_ops_ai_response_activity_v1",
  "tasu_ai_daily_inbox_dismissed_v1",
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

async function seed(page) {
  return page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    window.TasuAdminAiDecisionLearning?.clearForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();
    localStorage.removeItem("tasu_admin_ai_response_dismissed_v1");

    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support" };

    const res = svc.submitInquiry({
      user_id: "outcome_test",
      title: "支払い確認",
      body: "支払い状況を教えてください。",
    });

    const OL = window.TasuAdminAiOutcomeLearning;
    for (let i = 0; i < 12; i++) {
      OL.recordOutcome({
        sourceType: "response_plan",
        sourceId: `seed_${i}`,
        eventType: "payment_pending",
        category: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        actionType: "sent",
        finalMessage: "お支払い状況を確認いたします。",
        outcome: i < 11 ? "resolved" : "reopened",
        outcomeReason: i < 11 ? "解決済み" : "再問い合わせ",
        userId: "outcome_test",
        resolvedAt: new Date().toISOString(),
      });
    }

    return { ok: true, ticketId: res.ticket?.id };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seedRes = await seed(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  pass("Outcomeテストデータ投入");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiOutcomeLearning, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminOperationsDashboard.refresh();
    window.TasuAdminAiResponsePlans.renderPlansPanel();
    window.TasuAdminAiAutomationEngine.renderAutomationPanel();
    window.TasuAdminAiDailyInbox.renderDailyInbox();
  });

  const stats = await page.evaluate(() =>
    window.TasuAdminAiOutcomeLearning.summarizeSimilarOutcomes({
      eventType: "payment_pending",
      riskLevel: "low",
      gateLevel: "low",
    })
  );
  if (stats.resolved < 10) fail(`resolved count: ${stats.resolved}`);
  if (stats.resolvedRate < 0.85) fail(`resolved rate: ${stats.resolvedRate}`);
  pass("類似 outcome の集計ができる");

  const rec = await page.evaluate(() =>
    window.TasuAdminAiOutcomeLearning.getOutcomeRecommendation({
      eventType: "payment_pending",
      riskLevel: "low",
      gateLevel: "low",
    })
  );
  if (!rec.promote) fail(`high resolved should promote: ${rec.label}`);
  pass("高解決率で自動実行候補を推奨");

  const lowPlan = await page.evaluate(() => {
    const plans = window.TasuAdminAiResponsePlans.buildResponsePlans();
    return plans.find((p) => p.gateLevel === "low" && p.eventType === "payment_pending");
  });
  if (!lowPlan) fail("no low risk payment plan");

  const beforePending = await page.evaluate(() =>
    window.TasuAdminAiOutcomeLearning.readOutcomes().filter((o) => o.outcome === "unknown").length
  );
  await page.locator(`[data-ops-ai-response-send][data-plan-id="${lowPlan.id}"]`).click();
  await page.waitForFunction(
    () => (window.TasuAdminAiHumanSendGate?.readPendingQueue?.() || []).length > 0,
    { timeout: 10000 }
  );
  await page.evaluate(
    (planId) => {
      const HSG = window.TasuAdminAiHumanSendGate;
      const pending = HSG.readPendingQueue().find((p) => p.payload?.planId === planId) || HSG.readPendingQueue()[0];
      if (pending) HSG.approveAndExecute(pending.id);
    },
    lowPlan.id
  );
  await page.waitForTimeout(400);
  const afterSend = await page.evaluate(() => window.TasuAdminAiOutcomeLearning.readOutcomes());
  const pending = afterSend.find((o) => o.outcome === "unknown" && o.sourceType === "response_plan");
  if (!pending) fail("pending outcome not created after send");
  for (const field of ["id", "sourceType", "eventType", "actionType", "createdAt"]) {
    if (!pending[field]) fail(`pending missing ${field}`);
  }
  if (/0\d{9,}/.test(pending.finalMessage + pending.outcomeReason)) fail("PII may be stored");
  pass("送信後に outcome pending が作成される");

  await page.evaluate(
    (ticketId) => {
      const store = window.TasuSupportTicketStore;
      const ticket = store.getTicket(ticketId);
      if (!ticket) return;
      ticket.status = "resolved";
      ticket.resolved_at = new Date().toISOString();
      store.saveTicket(ticket);
    },
    seedRes.ticketId
  );
  await page.evaluate(() => window.TasuAdminAiOutcomeLearning.syncAll());
  const resolvedOutcome = await page.evaluate(() =>
    window.TasuAdminAiOutcomeLearning.readOutcomes().find((o) => o.outcome === "resolved" && o.sourceType === "response_plan")
  );
  if (!resolvedOutcome) fail("resolved outcome not recorded");
  pass("Supportチケット解決で resolved が記録される");

  await page.evaluate(() => {
    window.TasuSupportTicketService.submitInquiry({
      user_id: "outcome_test",
      title: "支払い確認の再問い合わせ",
      body: "先日の支払い確認について再度質問です。",
    });
    window.TasuAdminAiOutcomeLearning.syncAll();
  });
  const reopened = await page.evaluate(() =>
    window.TasuAdminAiOutcomeLearning.readOutcomes().some((o) => o.outcome === "reopened")
  );
  if (!reopened) fail("reopened not detected");
  pass("再問い合わせで reopened が記録される");

  await page.evaluate(() => {
    window.TasuSupportTicketStore.saveTicket({
      id: "outcome_complaint_001",
      title: "通報テスト",
      body: "クレームと通報です。",
      user_id: "outcome_test",
      source: "support_intake",
      category: "abuse_or_policy",
      severity: "critical",
      status: "open",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    window.TasuAdminAiOutcomeLearning.syncAll();
  });
  const complaint = await page.evaluate(() =>
    window.TasuAdminAiOutcomeLearning.readOutcomes().some((o) => o.outcome === "complaint")
  );
  if (!complaint) fail("complaint not recorded");
  pass("通報・高リスクで complaint が記録される");

  const outcomeOnCard = await page.locator("[data-ops-ai-response-card] [data-ops-ai-outcome]").count();
  if (outcomeOnCard < 1) fail("outcome section missing on card");
  const cardText = await page.locator("[data-ops-ai-response-card] [data-ops-ai-outcome]").first().innerText();
  if (!cardText.includes("過去結果")) fail(`card outcome: ${cardText.slice(0, 80)}`);
  if (!cardText.includes("解決率")) fail(`card stats: ${cardText}`);
  pass("AI対応案カードに過去結果が表示される");

  const inboxOutcome = await page.locator("[data-ops-inbox-item] [data-ops-ai-outcome], [data-ops-inbox-item] .ops-ai-inbox-item__outcome").count();
  if (inboxOutcome < 1) fail("inbox outcome missing");
  pass("Daily Inbox に outcome が反映される");

  const reopenedStats = await page.evaluate(() => {
    window.TasuAdminAiOutcomeLearning.clearForTests();
    const OL = window.TasuAdminAiOutcomeLearning;
    for (let i = 0; i < 6; i++) {
      OL.recordOutcome({
        eventType: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        outcome: i < 2 ? "reopened" : "resolved",
        actionType: "sent",
        finalMessage: "テスト",
      });
    }
    return OL.getOutcomeRecommendation({
      eventType: "payment_pending",
      riskLevel: "low",
      gateLevel: "low",
    });
  });
  if (!reopenedStats.downgrade) fail(`reopened downgrade: ${reopenedStats.label}`);
  pass("再問い合わせ率が高いと承認待ちへ下げる");

  await page.evaluate(() => {
    window.TasuAdminAiDecisionLearning.clearForTests();
    window.TasuAdminAiOutcomeLearning.clearForTests();
    const DL = window.TasuAdminAiDecisionLearning;
    const OL = window.TasuAdminAiOutcomeLearning;
    for (let i = 0; i < 4; i++) {
      DL.recordDecision({
        eventType: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        operatorAction: "approved",
      });
      OL.recordOutcome({
        eventType: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        outcome: "resolved",
        actionType: "sent",
        finalMessage: "確認しました",
      });
    }
    window.TasuAdminAiAutomationEngine.renderAutomationPanel();
  });
  const autoLabel = await page.evaluate(() => {
    const c = window.TasuAdminAiAutomationEngine.buildAutomationCandidates().find(
      (x) => x.eventType === "payment_pending" && x.riskLevel === "low"
    );
    return c ? `${c.autoExecutable}|${c.autoExecutableLabel}|${c.learningBoost?.promote}` : "none";
  });
  if (!/true|学習昇格|自動実行可/.test(autoLabel)) fail(`automation outcome boost: ${autoLabel}`);
  pass("低リスク高解決率のみ自動処理候補へ昇格");

  const width = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-ai-outcome]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (width > 390) fail(`outcome width ${width}px`);
  pass("390pxで過去結果表示が収まる");

    });
  console.log("\nAll Outcome Learning tests passed.");
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
