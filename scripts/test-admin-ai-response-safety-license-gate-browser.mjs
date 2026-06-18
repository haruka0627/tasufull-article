#!/usr/bin/env node
/**
 * AI運営秘書 Phase4 — Safety & License Gate E2E
 *   node scripts/test-admin-ai-response-safety-license-gate-browser.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "tasu_support_tickets_v1",
  "tasu_connect_issues_v1",
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_admin_ai_response_send_logs_v1",
  "tasu_admin_ai_response_dismissed_v1",
  "tasu_admin_ops_ai_response_activity_v1",
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
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function seed(page) {
  return page.evaluate(() => {
    window.TasuSupportTicketStore?.clearAllForTests?.();
    const svc = window.TasuSupportTicketService;
    if (!svc) return { ok: false, reason: "no support service" };
    const now = new Date().toISOString();

    svc.submitInquiry({
      user_id: "gate_low",
      title: "支払い確認",
      body: "支払い確認の状況を教えてください。",
    });

    window.TasuSupportTicketStore.saveTicket({
      id: "gate_electrical_001",
      title: "電気工事の依頼",
      body: "第二種電気工事士によるコンセント増設をお願いします。",
      user_id: "gate_high",
      source: "test",
      category: "admin_review",
      severity: "medium",
      status: "open",
      created_at: now,
      updated_at: now,
    });

    window.TasuSupportTicketStore.saveTicket({
      id: "gate_staffing_001",
      title: "建設職人の有料職業紹介",
      body: "建設工事の大工を有料職業紹介で紹介してください。",
      user_id: "gate_blocked",
      source: "test",
      category: "admin_review",
      severity: "medium",
      status: "open",
      created_at: now,
      updated_at: now,
    });

    return { ok: true };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(pageUrl("support-intake.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuSupportTicketService, { timeout: 15000 });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

  const seedRes = await seed(page);
  if (!seedRes.ok) fail(`seed: ${seedRes.reason}`);
  pass("Gateテストデータ投入");

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.TasuAdminAiResponseSafetyLicenseGate && window.TasuAdminAiResponsePlans,
    { timeout: 15000 }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.TasuAdminAiResponseSafetyLicenseGate, { timeout: 15000 });
  await page.evaluate(() => {
    window.TasuAdminOperationsDashboard.refresh();
    window.TasuAdminAiResponsePlans.renderPlansPanel();
  });

  const gatePanels = await page.locator("[data-ops-ai-response-gate]").count();
  if (gatePanels < 1) fail(`gate panels ${gatePanels}`);
  pass("AI対応案カードにSafety & License Gateが表示される");

  const gateText = await page.locator("[data-ops-ai-response-gate]").first().innerText();
  for (const label of ["安全判定", "資格/許可", "判定理由", "確認書類", "送信可否"]) {
    if (!gateText.includes(label)) fail(`gate card missing: ${label}`);
  }
  pass("Gateカードに安全・資格・理由・書類・送信可否がある");

  const plans = await page.evaluate(() => window.TasuAdminAiResponsePlans.buildResponsePlans());
  if (!plans.every((p) => p.safetyResult && p.licenseResult && p.gateLevel)) {
    fail("not all plans have gate evaluation");
  }
  pass("全対応案で送信前Gateが必ず走る");

  const lowPlan = plans.find(
    (p) => p.gateLevel === "low" && p.sendAllowed && p.eventType === "payment_pending"
  );
  if (!lowPlan) fail(`low payment plan missing: ${plans.map((p) => p.gateLevel + ":" + p.eventType).join(",")}`);
  pass("低リスク（支払い確認）プランが生成される");

  const electrical = plans.find((p) => String(p.aiReason || p.aiSuggestion || "").includes("電気工事"));
  if (!electrical) fail("electrical plan missing");
  if (electrical.licenseResult?.status !== "qualification_required") {
    fail(`electrical license ${electrical.licenseResult?.status}`);
  }
  if (!electrical.confirmOnly && electrical.gateLevel !== "high") {
    fail(`electrical gate ${electrical.gateLevel}`);
  }
  pass("電気工事は資格必須・確認のみ");

  const staffing = plans.find((p) => /有料職業紹介|建設職人/.test(`${p.aiReason}${p.aiSuggestion}`));
  if (!staffing) fail("staffing plan missing");
  if (!staffing.sendBlocked && staffing.gateLevel !== "prohibited") {
    fail(`staffing gate ${staffing.gateLevel} blocked=${staffing.sendBlocked}`);
  }
  const staffingBtn = page.locator(`[data-ops-ai-response-send][data-plan-id="${staffing.id}"]`);
  if (await staffingBtn.isEnabled()) fail("prohibited plan send should be disabled");
  const blockRes = await page.evaluate(
    (id) => window.TasuAdminAiResponsePlans.sendPlan(id),
    staffing.id
  );
  if (!blockRes.blocked) fail("prohibited sendPlan should return blocked");
  const blockedLog = await page.evaluate(
    (id) => window.TasuAdminAiResponsePlans.readSendLogs().find((l) => l.planId === id && l.action === "blocked"),
    staffing.id
  );
  if (!blockedLog?.safetyResult || !blockedLog?.licenseResult) fail("blocked log missing gate results");
  const blockedActivity = await page.evaluate(() =>
    window.TasuAdminAiResponsePlans.listOpsActivity().some((a) => a.type === "ai_response_blocked")
  );
  if (!blockedActivity) fail("ai_response_blocked activity missing");
  const blockedNotify = await page.evaluate(
    (id) =>
      (window.TasuTalkNotifications?.getAll?.() || []).find(
        (n) => String(n.source) === "ai_response_plan" && String(n.id).includes(id)
      ),
    staffing.id
  );
  if (blockedNotify) fail("blocked plan should not create TALK notification");
  pass("建設×有料職業紹介は送信不可・blocked履歴・TALK通知なし");

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
  const lowLog = await page.evaluate(() => window.TasuAdminAiResponsePlans.readSendLogs()[0]);
  if (!lowLog?.safetyResult || !lowLog?.licenseResult) fail("low send log missing gate results");
  if (lowLog.gateLevel !== "low") fail(`low log gate ${lowLog.gateLevel}`);
  pass("低リスク送信でログにsafetyResult/licenseResultが残る");

  await page.locator(`[data-ops-ai-response-send][data-plan-id="${electrical.id}"]`).click();
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-ops-ai-response-toast]");
      return t && !t.hidden && /確認のみ|Safety Gate/.test(t.textContent || "");
    },
    { timeout: 5000 }
  );
  const highLog = await page.evaluate(
    (planId) =>
      window.TasuAdminAiResponsePlans.readSendLogs().find((l) => l.planId === planId),
    electrical.id
  );
  if (!highLog || highLog.action !== "escalated") fail("electrical should escalate not send");
  const escalatedActivity = await page.evaluate(() =>
    window.TasuAdminAiResponsePlans.listOpsActivity().some((a) => a.type === "ai_response_escalated")
  );
  if (!escalatedActivity) fail("ai_response_escalated activity missing");
  const highNotify = await page.evaluate(
    (id) =>
      (window.TasuTalkNotifications?.getAll?.() || []).find(
        (n) => String(n.source) === "ai_response_plan" && String(n.id).includes(id)
      ),
    electrical.id
  );
  if (highNotify) fail("qualification_required should not create TALK notification");
  pass("資格必須案件は確認のみでTALK通知しない・escalated履歴あり");

  const marketGate = await page.evaluate(() => {
    const sample = window.TasuAdminAiResponseSafetyLicenseGate.detectServiceCategory({
      eventType: "inquiry_received",
      aiReason: "市場の出品について",
      aiSuggestion: "ショップ注文の確認",
    });
    return sample;
  });
  if (marketGate.id !== "market") fail(`market category ${marketGate.id}`);
  pass("市場カテゴリのLicenseルールが定義されている");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow390) fail("390px horizontal scroll");
  const gateVisible = await page.locator("[data-ops-ai-response-gate]").first().isVisible();
  if (!gateVisible) fail("gate not visible at 390px");
  pass("390pxでGate表示・操作可能");

  await browser.close();
  console.log("\nAll Safety & License Gate tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
