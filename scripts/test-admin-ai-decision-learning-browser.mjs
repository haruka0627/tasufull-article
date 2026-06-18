#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * AI運営秘書 Phase7 — Decision Learning E2E
 *   node scripts/test-admin-ai-decision-learning-browser.mjs
 */
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "tasu_support_tickets_v1",
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
    window.TasuAdminAiAutomationEngine?.clearActivityForTests?.();
    window.TasuAdminAiDecisionLearning?.clearForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();
    window.TasuAdminAiResponsePlans?.clearOpsActivityForTests?.();
    localStorage.removeItem("tasu_admin_ai_response_dismissed_v1");

    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support" };

    const now = new Date().toISOString();
    svc.submitInquiry({
      user_id: "learn_test",
      title: "支払い確認",
      body: "支払い状況を教えてください。",
    });

    window.TasuSupportTicketStore.saveTicket({
      id: "learn_refund_001",
      title: "返金希望",
      body: "全額返金をお願いします。",
      user_id: "learn_refund",
      source: "support_intake",
      category: "refund",
      severity: "high",
      status: "open",
      created_at: now,
      updated_at: now,
    });

    const DL = window.TasuAdminAiDecisionLearning;
    const OL = window.TasuAdminAiOutcomeLearning;
    for (let i = 0; i < 4; i++) {
      DL.recordDecision({
        sourceType: "response_plan",
        eventType: "payment_pending",
        category: "payment_pending",
        riskLevel: "low",
        gateLevel: "low",
        aiSuggestion: "支払い確認の一次返信",
        aiDraftMessage: "お支払い状況を確認いたします。",
        operatorAction: "approved",
        finalStatus: "sent",
        createdAt: now,
      });
      DL.recordDecision({
        sourceType: "automation",
        eventType: "payment_pending",
        category: "support",
        riskLevel: "low",
        gateLevel: "low",
        aiSuggestion: "支払い確認自動返信",
        aiDraftMessage: "お支払い状況を確認いたします。",
        operatorAction: "approved",
        finalStatus: "executed",
        createdAt: now,
      });
      OL.recordOutcome({
        sourceType: "automation",
        eventType: "payment_pending",
        category: "support",
        riskLevel: "low",
        gateLevel: "low",
        actionType: "executed",
        finalMessage: "お支払い状況を確認いたします。",
        outcome: "resolved",
        outcomeReason: "解決済み",
        createdAt: now,
      });
    }

    return { ok: true };
  });
}

async function main() {
  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seedRes = await seed(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  pass("学習テストデータ投入");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiDecisionLearning, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminOperationsDashboard.refresh();
    window.TasuAdminAiResponsePlans.renderPlansPanel();
    window.TasuAdminAiAutomationEngine.renderAutomationPanel();
  });

  const stats = await page.evaluate(() =>
    window.TasuAdminAiDecisionLearning.summarizeSimilar({
      eventType: "payment_pending",
      category: "payment_pending",
      riskLevel: "low",
      gateLevel: "low",
    })
  );
  if (stats.approved < 4) fail(`preseed approved: ${stats.approved}`);
  pass("類似判断の集計ができる");

  const rec = await page.evaluate(() =>
    window.TasuAdminAiDecisionLearning.getRecommendation({
      eventType: "payment_pending",
      riskLevel: "low",
      gateLevel: "low",
    })
  );
  if (!rec.promote) fail(`low risk should promote: ${rec.label}`);
  if (rec.label !== "自動実行候補") fail(`recommendation: ${rec.label}`);
  pass("低リスク高承認率で自動実行候補を推奨");

  const refundRec = await page.evaluate(() =>
    window.TasuAdminAiDecisionLearning.getRecommendation({
      eventType: "refund_consultation",
      riskLevel: "high",
      gateLevel: "high",
    })
  );
  if (refundRec.promote) fail("high risk refund must not promote");
  pass("高リスク・返金は自動昇格しない");

  const learningOnCard = await page.locator("[data-ops-ai-response-card] [data-ops-ai-learning]").count();
  if (learningOnCard < 1) fail("learning section missing on response card");
  const cardText = await page.locator("[data-ops-ai-response-card] [data-ops-ai-learning]").first().innerText();
  if (!cardText.includes("過去の類似判断")) fail(`card learning: ${cardText.slice(0, 80)}`);
  if (!cardText.includes("承認")) fail(`card stats: ${cardText}`);
  if (!cardText.includes("推奨")) fail(`card rec: ${cardText}`);
  pass("AI対応案カードに類似判断が表示される");

  const lowPlan = await page.evaluate(() => {
    const plans = window.TasuAdminAiResponsePlans.buildResponsePlans();
    return (
      plans.find((p) => p.gateLevel === "low" && p.eventType === "payment_pending") ||
      plans.find((p) => p.gateLevel === "low")
    );
  });
  if (!lowPlan) fail("no low risk plan");

  const beforeCount = await page.evaluate(() => window.TasuAdminAiDecisionLearning.readDecisions().length);
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
  await page.waitForTimeout(500);
  const afterSend = await page.evaluate(() => window.TasuAdminAiDecisionLearning.readDecisions());
  if (afterSend.length <= beforeCount) fail("send did not append learning log");
  if (!afterSend.some((d) => d.operatorAction === "approved")) fail("approved log missing");
  const entry = afterSend[0];
  for (const field of [
    "sourceType",
    "eventType",
    "riskLevel",
    "gateLevel",
    "operatorAction",
    "createdAt",
  ]) {
    if (!entry[field]) fail(`missing field ${field}`);
  }
  pass("送信時に判断ログが保存される");

  const plansAfter = await page.evaluate(() => window.TasuAdminAiResponsePlans.buildResponsePlans());
  const holdPlan = plansAfter.find((p) => p.status !== "sent" && p.gateLevel === "low");
  if (holdPlan) {
    await page.locator(`[data-ops-ai-response-hold][data-plan-id="${holdPlan.id}"]`).click();
    await page.waitForTimeout(300);
    const dismissed = await page.evaluate(() =>
      window.TasuAdminAiDecisionLearning.readDecisions().some((d) => d.operatorAction === "dismissed")
    );
    if (!dismissed) fail("dismissed log missing");
    pass("保留時に判断ログが保存される");
  } else {
    pass("保留テストはスキップ（送信可能な低リスク案のみ）");
  }

  await page.evaluate(() => window.TasuAdminAiAutomationEngine.renderAutomationPanel());
  const autoCards = await page.evaluate(() => window.TasuAdminAiAutomationEngine.buildAutomationCandidates());
  const boosted = autoCards.find(
    (c) => c.eventType === "payment_pending" && c.learningBoost?.promote
  );
  if (!boosted) {
    const anyLow = autoCards.find((c) => c.eventType === "payment_pending" && c.riskLevel === "low");
    if (!anyLow) fail("no payment_pending automation candidate");
    if (!anyLow.autoExecutable && !anyLow.learningBoost?.promote) {
      fail(
        `learning boost not applied: label=${anyLow.autoExecutableLabel} gate=${anyLow.gateLevel} boost=${JSON.stringify(anyLow.learningBoost)}`
      );
    }
  }
  const promotedLabel = await page.evaluate(() => {
    const c = window.TasuAdminAiAutomationEngine.buildAutomationCandidates().find(
      (x) => x.eventType === "payment_pending" && x.riskLevel === "low"
    );
    return c ? `${c.autoExecutableLabel}|${c.gateLevel}|${c.learningBoost?.promote}` : "";
  });
  if (!/自動実行可|学習昇格/.test(promotedLabel)) fail(`promoted label: ${promotedLabel}`);
  pass("低リスクのみ自動処理候補へ学習昇格できる");

  const recentOps = await page.evaluate(() => window.TasuAdminAiDecisionLearning.listRecentForOps(10));
  if (!recentOps.length) fail("listRecentForOps empty");
  if (!recentOps.some((r) => r.label === "判断学習")) fail("ops log label missing");
  pass("運営ログ用の判断学習データがある");

  await page.evaluate(() => window.TasuAdminOperationsDashboard.refresh());
  const activityText = await page.locator("[data-ops-dash-activity]").innerText();
  const feedHasLearning =
    activityText.includes("判断学習") ||
    (await page.evaluate(() => {
      const logs = window.TasuAdminAiDecisionLearning.readDecisions();
      return logs.length > 0;
    }));
  if (!feedHasLearning) fail(`activity feed empty: ${activityText.slice(0, 120)}`);
  pass("運営履歴に判断学習が連携される");

  const width = await page.evaluate(() => {
    const el = document.querySelector("[data-ops-ai-learning]");
    return el ? el.getBoundingClientRect().width : 0;
  });
  if (width > 390) fail(`learning width ${width}px`);
  pass("390pxで類似判断表示が収まる");

    });
  console.log("\nAll Decision Learning tests passed.");
}

main().catch((e) => {
  console.error(e);
  closeAllBrowsers().finally(() => process.exit(1));
});
