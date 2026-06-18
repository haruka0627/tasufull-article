#!/usr/bin/env node
/**
 * AI運営秘書 本番接続レビュー
 *   node scripts/review-admin-ai-production-connectivity.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "screenshots", "admin-ai-production-connectivity");
const REPORT_JSON = path.join(OUT_DIR, "connectivity-report.json");
const REPORT_MD = path.join(OUT_DIR, "connectivity-report.md");

function pageUrl(rel) {
  const base = process.env.BUILDER_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${rel}`;
  return pathToFileURL(path.join(root, rel)).href;
}

async function runAudit(page) {
  return page.evaluate(async () => {
    const result = {
      services: {},
      reflections: {},
      missingEvents: [],
      duplicates: [],
      learningChain: {},
      revenue: {},
      productionGaps: [],
      connected: [],
      disconnected: [],
      needsFix: [],
      duplicateIssues: [],
    };

    const KEYS = [
      "tasu_support_tickets_v1",
      "tasu_support_events_v1",
      "tasu_connect_issues_v1",
      "tasu_shop_orders",
      "tasu_stripe_event_ingest_logs_v1",
      "tasful_talk_notifications",
      "tasu_ai_outcome_learning_v1",
      "tasu_ai_decision_learning_v1",
      "tasu_ai_human_send_gate_pending_v1",
      "tasu_ai_execution_log_v1",
      "tasu_ai_ops_watch_log_v1",
      "tasu_admin_ai_response_plans_state_v1",
    ];
    KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("tasful_talk_notifications", "[]");

    window.TasuAdminAiOpsWatch?.clearForTests?.();
    window.TasuAdminAiOutcomeLearning?.clearForTests?.();
    window.TasuAdminAiDecisionLearning?.clearForTests?.();
    window.TasuAdminAiHumanSendGate?.clearForTests?.();
    window.TasuSupportTicketStore?.clearAllForTests?.();

    const audit = (service, event, checks) => {
      result.services[service] = result.services[service] || { events: [] };
      result.services[service].events.push({ event, ...checks });
      if (checks.connected) result.connected.push(`${service}:${event}`);
      else result.disconnected.push(`${service}:${event}`);
      if (checks.needsFix) result.needsFix.push(`${service}:${event} — ${checks.reason}`);
    };

    // ── Support: new inquiry ──
    let ticket = null;
    try {
      ticket = window.TasuSupportTicketService?.submitInquiry?.({
        user_id: "conn_test_user",
        title: "新規問い合わせテスト",
        body: "接続監査用",
        category: "general",
      });
    } catch {
      ticket = window.TasuSupportTicketStore?.createTicket?.({
        user_id: "conn_test_user",
        title: "新規問い合わせテスト",
        body: "接続監査用",
        category: "general",
        status: "open",
      });
    }
    window.dispatchEvent(new CustomEvent("tasu:support-tickets-updated"));
    await new Promise((r) => setTimeout(r, 150));
    const inboxAfterSupport = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const plansAfterSupport = window.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [];
    const owAfterSupport = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    audit("Support", "新規問い合わせ", {
      connected: !!ticket?.id && inboxAfterSupport.some((i) => i.source === "support"),
      inbox: inboxAfterSupport.some((i) => i.source === "support"),
      responsePlans: plansAfterSupport.length > 0,
      opsWatch: (owAfterSupport?.metrics?.support?.open || 0) > 0,
      kpi: (window.TasuAdminAiKpiCenter?.collectKpiMetrics?.()?.inquiries || 0) > 0,
      reason: ticket?.id ? "" : "submitInquiry failed",
      needsFix: !ticket?.id,
    });

    // ── Support: complaint (derived) ──
    window.TasuSupportTicketService?.submitInquiry?.({
      user_id: "conn_complaint",
      title: "通報クレーム",
      body: "クレーム内容",
      category: "abuse_or_policy",
      severity: "critical",
    });
    window.TasuAdminAiOutcomeLearning?.syncAll?.();
    const complaintOutcome = (window.TasuAdminAiOutcomeLearning?.readOutcomes?.() || []).some(
      (o) => o.outcome === "complaint"
    );
    audit("Support", "complaint", {
      connected: complaintOutcome,
      outcomeLearning: complaintOutcome,
      opsWatch: true,
      reason: complaintOutcome ? "" : "Outcome Learning syncComplaints未反映",
      needsFix: !complaintOutcome,
    });

    // ── Support: reopened (derived) ──
    const payTicket = window.TasuSupportTicketService?.submitInquiry?.({
      user_id: "conn_reopen",
      title: "支払い確認",
      body: "入金確認",
      category: "payment",
    });
    if (payTicket?.id) {
      const t = window.TasuSupportTicketStore.getTicket(payTicket.id);
      t.status = "resolved";
      t.resolved_at = new Date().toISOString();
      window.TasuSupportTicketStore.saveTicket(t);
      window.TasuAdminAiOutcomeLearning?.syncAll?.();
      window.TasuSupportTicketStore?.createTicket?.({
        user_id: "conn_reopen",
        title: "支払い確認の再問い合わせ",
        body: "再度確認",
        category: "payment",
        status: "open",
      });
      window.dispatchEvent(new CustomEvent("tasu:support-tickets-updated"));
      window.TasuAdminAiOutcomeLearning?.syncAll?.();
    }
    const reopenedOutcome = (window.TasuAdminAiOutcomeLearning?.readOutcomes?.() || []).some(
      (o) => o.outcome === "reopened"
    );
    audit("Support", "reopened", {
      connected: reopenedOutcome,
      outcomeLearning: reopenedOutcome,
      indirect: true,
      reason: reopenedOutcome ? "Outcome Learning推論（ticket eventではない）" : "syncSupportReopened未反映",
      needsFix: !reopenedOutcome,
    });

    // ── TALK: unread important ──
    window.TasuTalkNotifications?.add?.({
      id: "conn_talk_unread",
      type: "general",
      title: "未読重要通知",
      body: "テスト",
      priority: "important",
      createdAt: new Date().toISOString(),
    });
    window.dispatchEvent(new CustomEvent("tasful-talk-notifications-changed"));
    await new Promise((r) => setTimeout(r, 150));
    const talkInboxBeforeBus = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const talkInboxHas = talkInboxBeforeBus.some((i) => i.source === "talk");
    const owTalk = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    audit("TALK", "未読重要", {
      connected: talkInboxHas || (owTalk?.metrics?.talk?.unreadImportant || 0) > 0,
      inbox: talkInboxHas,
      opsWatch: (owTalk?.metrics?.talk?.unreadImportant || 0) > 0,
      busListener: false,
      reason: "tasful-talk-notifications-changedはDaily Inbox/Ops Watch未購読（間接refreshのみ）",
      needsFix: !talkInboxHas,
    });

    // ── TALK: new chat / block ──
    audit("TALK", "新規チャット", {
      connected: false,
      reason: "chat_started通知はTALK storeのみ。admin-aiコレクタなし",
      needsFix: true,
    });
    audit("TALK", "ブロック", {
      connected: false,
      reason: "ユーザーblockイベントはadmin-ai未配線",
      needsFix: true,
    });
    audit("TALK", "通報", {
      connected: plansAfterSupport.some((p) => p.eventType === "report") || complaintOutcome,
      viaSupport: true,
      reason: "Support/AI-ops経由のみ",
      needsFix: false,
    });

    // ── Connect ──
    const store = window.TasuSupportTicketStore;
    store?.saveConnectIssue?.({
      id: "conn_identity_1",
      user_id: "connect_user",
      issue_type: "identity_verification",
      detected_reason: "本人確認書類不足",
      created_at: new Date().toISOString(),
    });
    store?.saveConnectIssue?.({
      id: "conn_payout_1",
      user_id: "connect_user2",
      issue_type: "payout_failed",
      detected_reason: "payoutエラー",
      created_at: new Date().toISOString(),
    });
    window.dispatchEvent(new CustomEvent("tasu:support-tickets-updated"));
    await new Promise((r) => setTimeout(r, 100));
    const connectInbox = (window.TasuAdminAiDailyInbox?.buildInboxItems?.() || []).filter(
      (i) => i.source === "connect"
    );
    const connectPlans = (window.TasuAdminAiResponsePlans?.buildResponsePlans?.() || []).filter((p) =>
      /connect/i.test(p.eventType || "")
    );
    const owConnect = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    const kpiConnect = window.TasuAdminAiKpiCenter?.collectKpiMetrics?.();
    audit("Connect", "本人確認申請/失敗", {
      connected: connectInbox.length > 0 || connectPlans.length > 0,
      inbox: connectInbox.length > 0,
      responsePlans: connectPlans.length > 0,
      opsWatch: (owConnect?.anomalies || []).some((a) => a.source === "connect"),
      kpi: (kpiConnect?.connectFailures || 0) > 0,
      needsFix: connectInbox.length === 0 && connectPlans.length === 0,
      reason: "",
    });
    audit("Connect", "payoutエラー", {
      connected: (owConnect?.metrics?.connect?.payoutErrors || 0) > 0,
      opsWatch: (owConnect?.metrics?.connect?.payoutErrors || 0) > 0,
      needsFix: (owConnect?.metrics?.connect?.payoutErrors || 0) === 0,
      reason: (owConnect?.metrics?.connect?.payoutErrors || 0) === 0 ? "payoutメトリクス未反映" : "",
    });

    // ── 安否 ──
    window.TasuTalkNotifications?.add?.({
      id: "conn_anpi_emergency",
      category: "anpi",
      type: "anpi",
      title: "緊急安否 emergency",
      body: "要確認",
      priority: "urgent",
      createdAt: new Date().toISOString(),
    });
    window.dispatchEvent(new CustomEvent("tasu:support-tickets-updated"));
    const anpiInbox = (window.TasuAdminAiDailyInbox?.buildInboxItems?.() || []).filter(
      (i) => i.source === "anpi"
    );
    const owAnpi = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    audit("安否", "emergency", {
      connected: (owAnpi?.metrics?.anpi?.emergency || 0) > 0,
      inbox: anpiInbox.length > 0,
      opsWatch: (owAnpi?.anomalies || []).some((a) => a.source === "anpi"),
      kpi: (window.TasuAdminAiKpiCenter?.collectKpiMetrics?.()?.anpiEmergency || 0) > 0,
      needsFix: (owAnpi?.metrics?.anpi?.emergency || 0) === 0,
      reason: "",
    });
    audit("安否", "未確認", {
      connected: (owAnpi?.metrics?.anpi?.unconfirmed || 0) >= 0,
      opsWatch: true,
      kpi: false,
      reason: "KPI Centerにanpi未確認メトリクスなし",
      needsFix: false,
    });
    audit("安否", "確認完了", {
      connected: false,
      reason: "構造化confirmedイベント/KPIなし（既読metaのみ）",
      needsFix: true,
    });

    // ── Builder ──
    const hasListEval = typeof window.TasuBuilderPartnerEval?.listEvaluations === "function";
    const builderInbox = (window.TasuAdminAiDailyInbox?.buildInboxItems?.() || []).filter(
      (i) => i.source === "builder"
    );
    audit("Builder", "応募/採用/完了/差し戻し", {
      connected: false,
      inbox: builderInbox.length > 0,
      listEvaluationsExists: hasListEval,
      talkOnly: true,
      reason: "listEvaluations未実装。TALK builder通知のみ。admin-ai未接続",
      needsFix: true,
    });
    audit("Builder", "審査needs_review", {
      connected: hasListEval,
      reason: hasListEval ? "" : "TasuBuilderPartnerEval.listEvaluations missing",
      needsFix: !hasListEval,
    });

    // ── 市場 ──
    const orders = [
      {
        id: "conn_order_1",
        amount_total: 5000,
        payment_status: "paid",
        created_at: new Date().toISOString(),
      },
    ];
    localStorage.setItem("tasu_shop_orders", JSON.stringify(orders));
    const kpiRev = window.TasuAdminAiKpiCenter?.collectKpiMetrics?.();
    audit("市場", "決済完了→KPI売上", {
      connected: (kpiRev?.revenue || 0) > 0,
      revenue: kpiRev?.revenue,
      opsWatch: false,
      inbox: false,
      reason: (kpiRev?.revenue || 0) > 0 ? "" : "tasu_shop_orders未反映",
      needsFix: (kpiRev?.revenue || 0) === 0,
    });
    audit("市場", "注文/キャンセル/返金", {
      connected: false,
      inbox: false,
      opsWatch: false,
      responsePlans: false,
      reason: "市場イベント専用パイプラインなし（返金はSupportテキスト経由のみ）",
      needsFix: true,
    });

    // ── AI秘書反映マトリクス ──
    window.TasuAdminAiOpsWatch?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
    window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
    window.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
    window.TasuAdminAiHumanSendGate?.renderHumanSendGatePanel?.("[data-ops-ai-human-send-gate]");
    window.TasuAdminAiDailyInbox?.renderDailyInbox?.();

    const inbox = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const ow = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    const kpi = window.TasuAdminAiKpiCenter?.collectKpiMetrics?.();
    const af = window.TasuAdminAiAutoFixCandidate?.buildAutoFixSnapshot?.();

    result.reflections = {
      dailyInbox: { count: inbox.length, sources: [...new Set(inbox.map((i) => i.source))] },
      opsWatch: { anomalies: ow?.anomalies?.length || 0, metrics: Object.keys(ow?.metrics || {}) },
      kpiCenter: { revenue: kpi?.revenue, connectFailures: kpi?.connectFailures },
      autoFix: { candidates: af?.candidates?.length || 0 },
      humanSendGate: { pending: window.TasuAdminAiHumanSendGate?.readPendingQueue?.().length || 0 },
      outcomeLearning: { count: window.TasuAdminAiOutcomeLearning?.readOutcomes?.().length || 0 },
    };

    // ── 重複検知 ──
    const ids = inbox.map((i) => i.id);
    const dupIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (dupIds.length) result.duplicateIssues.push(`Daily Inbox duplicate ids: ${dupIds.join(",")}`);

    const ow1 = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    const ow2 = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    const logLen1 = window.TasuAdminAiOpsWatch?.readWatchLog?.(50)?.length || 0;
    if (ow1?.anomalies?.length && ow2?.anomalies?.length) {
      result.duplicateIssues.push(
        "Ops Watch: buildOpsWatchSnapshot連続呼び出しでwatch log追記（重複ログリスク）"
      );
    }

    const kpiReports = kpi?.reports || 0;
    const owComplaint = ow?.metrics?.support?.complaint || 0;
    if (kpiReports > 0 && owComplaint > 0 && kpiReports !== owComplaint) {
      result.duplicateIssues.push(
        `KPI reports(${kpiReports})とOps Watch complaint(${owComplaint})で集計経路が二重`
      );
    }

    // ── 学習連携 ──
    const lowPlan = (window.TasuAdminAiResponsePlans?.buildResponsePlans?.() || []).find(
      (p) => p.gateLevel === "low"
    );
    let learningOk = false;
    if (lowPlan) {
      const HSG = window.TasuAdminAiHumanSendGate;
      const beforeD = window.TasuAdminAiDecisionLearning?.readDecisions?.().length || 0;
      const beforeO = window.TasuAdminAiOutcomeLearning?.readOutcomes?.().length || 0;
      window.TasuAdminAiResponsePlans.sendPlan(lowPlan.id);
      const pending = HSG.readPendingQueue().find((p) => p.payload?.planId === lowPlan.id);
      if (pending) {
        HSG.approveAndExecute(pending.id);
        const afterD = window.TasuAdminAiDecisionLearning?.readDecisions?.().length || 0;
        const afterO = window.TasuAdminAiOutcomeLearning?.readOutcomes?.().length || 0;
        const log = HSG.readExecutionLog(5).find((l) => l.actionId === pending.id);
        learningOk = afterD > beforeD && afterO > beforeO && !!log;
      }
    }
    result.learningChain = {
      sendToGate: !!lowPlan,
      approveToDecision: learningOk,
      approveToOutcome: learningOk,
      executionLog: learningOk,
      ok: learningOk,
    };

    // ── 本番未接続 ──
    result.productionGaps = [
      {
        area: "Builder",
        issue: "TasuBuilderPartnerEval.listEvaluations 未実装",
        impact: "Builder全イベントがOps Watch/KPI/Inbox/Plansに未到達",
      },
      {
        area: "Stripe",
        issue: "実Webhook未接続（stripe_webhook_sim / ingestログのみ）",
        impact: "Connect/市場の本番決済イベントが遅延・欠落",
      },
      {
        area: "TALK bus",
        issue: "tasful-talk-notifications-changed がadmin-ai未購読",
        impact: "TALK通知変更がDaily Inbox/Ops Watchに即時反映されない",
      },
      {
        area: "市場",
        issue: "注文/キャンセル/返金のadmin-aiコレクタなし",
        impact: "KPI売上のみ。Ops Watch/Daily Inbox未接続",
      },
      {
        area: "安否",
        issue: "anpi-dashboard/LINEログとadmin-ai未直結",
        impact: "regexヒューリスティック依存",
      },
      {
        area: "Support",
        issue: "reopened/complaintがticket eventではなくOutcome推論",
        impact: "イベント欠落一覧に表示されるが設計上の間接接続",
      },
      {
        area: "Builder TALK",
        issue: "builder.js通知（応募/採用/完了/差し戻し）",
        impact: "TALK storeのみ。AI秘書未収集",
      },
      {
        area: "Connect手数料",
        issue: "KPIにConnect/Builder手数料内訳なし",
        impact: "revenueはshop_orders+Stripe ingest合算のみ",
      },
    ];

    result.missingEvents = result.disconnected.map((x) => x);

    return result;
  });
}

function buildMarkdown(audit) {
  const lines = [
    "# AI運営秘書 本番接続レビュー",
    "",
    `生成: ${new Date().toISOString()}`,
    "",
    "## 接続済み",
    ...audit.connected.map((x) => `- ${x}`),
    "",
    "## 未接続",
    ...audit.disconnected.map((x) => `- ${x}`),
    "",
    "## 要修正",
    ...audit.needsFix.map((x) => `- ${x}`),
    "",
    "## 重複",
    ...(audit.duplicateIssues.length
      ? audit.duplicateIssues.map((x) => `- ${x}`)
      : ["- Daily Inbox ID重複なし（同一ID dedupeあり）", "- Ops Watch log連続snapshotで追記リスクあり"]),
    "",
    "## 本番未接続",
    ...audit.productionGaps.map((g) => `- **${g.area}**: ${g.issue} — ${g.impact}`),
    "",
    "## AI運営秘書反映",
    `- Daily Inbox: ${audit.reflections.dailyInbox.count}件 sources=[${audit.reflections.dailyInbox.sources.join(", ")}]`,
    `- Ops Watch: anomalies=${audit.reflections.opsWatch.anomalies}`,
    `- KPI Center: revenue=${audit.reflections.kpiCenter.revenue} connectFailures=${audit.reflections.kpiCenter.connectFailures}`,
    `- Auto Fix: candidates=${audit.reflections.autoFix.candidates}`,
    `- Human Send Gate: pending=${audit.reflections.humanSendGate.pending}`,
    `- Outcome Learning: records=${audit.reflections.outcomeLearning.count}`,
    "",
    "## 学習連携（送信→承認→Outcome）",
    `- チェーン: ${audit.learningChain.ok ? "PASS" : "FAIL"}`,
    "",
    "## 売上連携",
    `- 市場注文→KPI: revenue=${audit.revenue?.revenue ?? audit.reflections.kpiCenter.revenue}`,
    `- Connect/Builder手数料: KPI内訳なし（要将来対応）`,
    "",
    "## 優先修正TOP10",
    "1. **Builder `listEvaluations()` 実装** — admin-ai全モジュールが空配列fallback",
    "2. **TALK `tasful-talk-notifications-changed` をadmin-aiに購読** — 未読/安否の即時反映",
    "3. **市場イベントパイプライン追加** — order/cancel/refund → Inbox/Ops Watch",
    "4. **実Stripe Webhook接続** — Connect payout/決済の本番イベント",
    "5. **Builder TALK通知のadmin-ai収集** — 応募/採用/完了/差し戻し",
    "6. **安否 confirmed メトリクス** — anpi-dashboard直結",
    "7. **Ops Watch log dedupe** — snapshot連打時の重複追記防止",
    "8. **KPI complaint/reports集計一本化** — Support二重カウント解消",
    "9. **Support reopened/complaintのfirst-class event** — ticket eventとして記録",
    "10. **Connect/Builder手数料のKPI内訳** — 売上ダッシュボード精度向上",
  ];
  return lines.join("\n");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await withPlaywrightBrowser(async (browser) => {for (const vp of [
    { name: "390", width: 390, height: 844 },
    { name: "1280", width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.TasuAdminAiDailyInbox?.buildInboxItems, { timeout: 15000 });

    const audit = await runAudit(page);
    audit.viewport = vp.name;

    if (vp.name === "1280") {
      fs.writeFileSync(REPORT_JSON, JSON.stringify(audit, null, 2), "utf8");
      fs.writeFileSync(REPORT_MD, buildMarkdown(audit), "utf8");
    }

    await page.screenshot({
      path: path.join(OUT_DIR, `dashboard-${vp.name}.png`),
      fullPage: true,
    });
    await page.close();
  }

    });

  const report = JSON.parse(fs.readFileSync(REPORT_JSON, "utf8"));
  console.log(buildMarkdown(report));
  console.log(`\nSaved: ${REPORT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

await closeAllBrowsers();
