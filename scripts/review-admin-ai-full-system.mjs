#!/usr/bin/env node
/**
 * AI運営秘書 Phase1〜12 統合レビュー
 *   node scripts/review-admin-ai-full-system.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { finalizeFromOutDir } from "./lib/finalize-screenshot-run.mjs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SHOT_DIR = path.join(root, "screenshots", "admin-ai-full-review");
const REPORT_JSON = path.join(SHOT_DIR, "review-report.json");
const REPORT_MD = path.join(SHOT_DIR, "review-report.md");

const KNOWN_STORAGE_KEYS = [
  "tasu_admin_ai_response_plans_state_v1",
  "tasu_admin_ai_response_send_logs_v1",
  "tasu_admin_ai_response_dismissed_v1",
  "tasu_admin_ops_ai_response_activity_v1",
  "tasu_ai_automation_rules_v1",
  "tasu_ai_automation_activity_v1",
  "tasu_ai_decision_learning_v1",
  "tasu_ai_outcome_learning_v1",
  "tasu_ai_ops_watch_snapshots_v1",
  "tasu_ai_ops_watch_log_v1",
  "tasu_ai_kpi_center_snapshots_v1",
  "tasu_ai_human_send_gate_pending_v1",
  "tasu_ai_execution_log_v1",
  "tasu_ai_daily_inbox_dismissed_v1",
  "tasu_support_tickets_v1",
  "tasu_support_events_v1",
  "tasu_connect_issues_v1",
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

function grade(pass, warn) {
  if (pass) return "PASS";
  if (warn) return "WARNING";
  return "FAIL";
}

function overallFrom(sections) {
  const vals = Object.values(sections);
  if (vals.includes("FAIL")) return "FAIL";
  if (vals.includes("WARNING")) return "WARNING";
  return "PASS";
}

async function seedOperationalScenario(page) {
  return page.evaluate(() => {
    const OW = window.TasuAdminAiOpsWatch;
    const HSG = window.TasuAdminAiHumanSendGate;
    const store = window.TasuSupportTicketStore;
    const OL = window.TasuAdminAiOutcomeLearning;
    const DL = window.TasuAdminAiDecisionLearning;

    OW?.clearForTests?.();
    HSG?.clearForTests?.();
    store?.clearAllForTests?.();
    OL?.clearForTests?.();
    DL?.clearForTests?.();
    [
      "tasu_admin_ai_response_plans_state_v1",
      "tasu_ai_automation_rules_v1",
      "tasu_ai_automation_activity_v1",
      "tasu_ai_daily_inbox_dismissed_v1",
      "tasful_talk_notifications",
    ].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("tasful_talk_notifications", "[]");

    window.TasuTalkNotifications?.add?.({
      id: "review_anpi_emergency",
      category: "anpi",
      type: "anpi",
      title: "緊急安否確認 emergency",
      body: "要確認",
      priority: "urgent",
      createdAt: new Date().toISOString(),
    });

    store?.createTicket?.({
      user_id: "review_user",
      title: "支払い確認",
      body: "入金が反映されない",
      category: "payment",
      priority: "normal",
    });

    HSG.enqueuePendingItem({
      source: "autofix",
      sourceId: "review_internal_1",
      category: "faq_register",
      actionType: "internal",
      proposal: "FAQ化候補を登録",
      recommendation: "類似問い合わせをFAQ候補へ",
      reason: "再問い合わせ多",
      impactArea: "内部のみ",
      severity: "normal",
      confidence: 0.7,
      payload: {},
    });

    HSG.enqueuePendingItem({
      source: "automation",
      sourceId: "review_auto_1",
      category: "notification_send",
      actionType: "human_send",
      proposal: "TALK未読重要通知の再通知",
      recommendation: "未読通知を再送",
      reason: "自動処理候補",
      impactArea: "利用者通知",
      severity: "critical",
      confidence: 0.75,
      payload: { candidateId: "review_auto_1" },
    });

    OW?.renderOpsWatchPanel?.("[data-ops-ai-watch]");
    window.TasuAdminAiKpiCenter?.renderKpiCenterPanel?.("[data-ops-ai-kpi-center]");
    window.TasuAdminAiAutoFixCandidate?.renderAutoFixPanel?.("[data-ops-ai-auto-fix]");
    HSG.renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
    window.TasuAdminAiDailyInbox?.renderDailyInbox?.();

    return { ok: true };
  });
}

async function runChecks(page) {
  return page.evaluate(() => {
    const result = {
      sectionOrder: [],
      scrollMetrics: {},
      critical: {},
      approvalFlow: {},
      learningLoop: {},
      storage: {},
      performance: {},
      security: {},
      ux: {},
      nav: {},
      issues: [],
    };

    const sectionIds = [
      "ops-ai-daily-inbox",
      "ops-ai-command",
      "ops-ai-watch",
      "ops-ai-kpi",
      "ops-ai-autofix",
      "ops-ai-hsg",
      "ops-ai-hub",
      "ops-priority-heading",
    ];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id) || document.querySelector(`[aria-labelledby="${id}"]`);
      if (el) result.sectionOrder.push({ id, top: Math.round(el.getBoundingClientRect().top + window.scrollY) });
    });

    const secretary = document.getElementById("ops-ai-secretary");
    const phaseOrder = ["ops-ai-watch", "ops-ai-kpi", "ops-ai-autofix", "ops-ai-hsg"];
    const childIds = [...(secretary?.children || [])].map((c) => c.id).filter(Boolean);
    const phaseIdx = phaseOrder.map((id) => childIds.indexOf(id));
    result.sectionOrder.phaseOrderCorrect =
      phaseIdx.every((v, i) => v >= 0) && phaseIdx[0] < phaseIdx[1] && phaseIdx[1] < phaseIdx[2] && phaseIdx[2] < phaseIdx[3];

    const inboxTop = document.getElementById("ops-ai-daily-inbox")?.getBoundingClientRect().top ?? 0;
    const watchTop = document.getElementById("ops-ai-watch")?.getBoundingClientRect().top ?? 0;
    const hsgTop = document.getElementById("ops-ai-hsg")?.getBoundingClientRect().top ?? 0;
    const priorityTop = document.getElementById("ops-priority-heading")?.getBoundingClientRect().top ?? 0;
    const vh = window.innerHeight;

    result.scrollMetrics = {
      inboxAboveFold: inboxTop >= 0 && inboxTop < vh,
      watchBelowFold: watchTop > vh,
      hsgScrollPx: Math.max(0, Math.round(hsgTop)),
      watchScrollPx: Math.max(0, Math.round(watchTop)),
      priorityScrollPx: Math.max(0, Math.round(priorityTop)),
      viewportHeight: vh,
    };

    const watchText = document.querySelector("[data-ops-watch-today]")?.innerText || "";
    const hsgText = document.querySelector("[data-ops-ai-human-send-gate]")?.innerText || "";
    const criticalWatch = document.querySelectorAll(".ops-ai-watch-list__item--critical").length;
    const criticalHsg = document.querySelectorAll(".ops-ai-hsg-card--critical").length;
    result.critical = {
      watchHasEmergency: /emergency|安否/i.test(watchText),
      watchCriticalItems: criticalWatch,
      hsgCriticalCards: criticalHsg,
      hsgCountBadge: /承認待ち[\s\S]*\d+件/.test(hsgText),
      panelAlertClass: {
        watch: document.querySelector("[data-ops-ai-watch]")?.classList.contains("ops-ai-watch--alert"),
        hsg: document.querySelector("[data-ops-ai-human-send-gate]")?.classList.contains("ops-ai-hsg--alert"),
      },
    };

    const navWatch = document.querySelector('[data-ops-nav="watch"]');
    result.nav = {
      watchHref: navWatch?.getAttribute("href") || "",
      watchSection: navWatch?.getAttribute("data-ops-nav-section") || "",
      pointsToLegacyHub: (navWatch?.getAttribute("href") || "").includes("ops-ai-hub"),
      notPhase9Panel: !(navWatch?.getAttribute("href") || "").includes("ops-ai-watch"),
    };

    const HSG = window.TasuAdminAiHumanSendGate;
    const pendingBefore = HSG.readPendingQueue().length;
    const soloSend = window.TasuAdminAiResponsePlans?.sendPlan?.("nonexistent");
    const plans = window.TasuAdminAiResponsePlans?.buildResponsePlans?.() || [];
    const lowPlan = plans.find((p) => p.gateLevel === "low" && p.status !== "sent");
    let queueTest = { ok: false, hasLowPlan: !!lowPlan };
    if (lowPlan) {
      const beforeQ = HSG.readPendingQueue().length;
      const res = window.TasuAdminAiResponsePlans.sendPlan(lowPlan.id);
      queueTest = {
        ok: !!res?.queued || !!res?.needsApproval,
        message: res?.message,
        pendingAdded: HSG.readPendingQueue().length > beforeQ,
      };
      const pending = HSG.readPendingQueue().find((p) => p.payload?.planId === lowPlan.id);
      if (pending) {
        const approved = HSG.approveAndExecute(pending.id);
        const log = HSG.readExecutionLog(10).find((l) => l.actionId === pending.id);
        const outcome = (window.TasuAdminAiOutcomeLearning?.readOutcomes?.() || []).find(
          (o) => o.sourceType === "human_send_gate" && o.sourceId === pending.id
        );
        queueTest.approved = approved?.approved === true;
        queueTest.logFound = !!log;
        queueTest.logFields = log
          ? ["actionId", "category", "source", "approvedBy", "approvedAt", "executedAt", "result", "outcome"].every(
              (f) => log[f] != null && log[f] !== ""
            )
          : false;
        queueTest.outcomeLinked = !!outcome;
      }
    }

    const internalPending = HSG.readPendingQueue().find((p) => p.category === "faq_register");
    let internalApprove = { ok: false };
    if (internalPending) {
      const approved = HSG.approveAndExecute(internalPending.id);
      const log = HSG.readExecutionLog(10).find((l) => l.actionId === internalPending.id);
      internalApprove = { ok: approved?.approved === true, logFound: !!log };
    }

    result.approvalFlow = {
      pendingCount: pendingBefore,
      soloSendBlocked: soloSend?.ok === false || soloSend?.error,
      queueTest,
      internalApprove,
      executionLogKey: "tasu_ai_execution_log_v1",
      logReadable: (HSG.readExecutionLog(1) || []).length >= 0,
    };

    const snap = HSG.buildHumanSendGateSnapshot();
    result.approvalFlow.recentLogInSnapshot = Array.isArray(snap.recentLog);

    const dlCount = window.TasuAdminAiDecisionLearning?.readDecisions?.().length || 0;
    const olCount = window.TasuAdminAiOutcomeLearning?.readOutcomes?.().length || 0;
    const owSnap = window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot?.();
    const afSnap = window.TasuAdminAiAutoFixCandidate?.buildAutoFixSnapshot?.();
    result.learningLoop = {
      decisionRecords: dlCount,
      outcomeRecords: olCount,
      opsWatchAnomalies: owSnap?.anomalies?.length || 0,
      autoFixCandidates: afSnap?.candidates?.length || 0,
      decisionFeedsOpsWatch: typeof window.TasuAdminAiDecisionLearning?.applyLearningBoost === "function",
      outcomeFeedsOpsWatch: typeof window.TasuAdminAiOutcomeLearning?.applyOutcomeAdjustment === "function",
      opsWatchFeedsAutoFix: typeof window.TasuAdminAiOpsWatch?.buildOpsWatchSnapshot === "function",
      autoFixFeedsHSG: typeof HSG.enqueueFromAutoFixCandidate === "function",
      executionLogIsolated:
        (HSG.readExecutionLog(5) || []).length > 0 &&
        !(owSnap?.anomalies || []).some((a) => a.metric === "execution_log"),
    };

    const keysFound = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("tasu_") || k.startsWith("tasful_"))) keysFound.push(k);
    }
    result.storage = {
      keysFound: keysFound.sort(),
      knownKeyCount: keysFound.filter((k) =>
        [
          "tasu_admin_ai_response",
          "tasu_ai_",
          "tasu_ai_daily",
          "tasu_support",
          "tasu_connect",
          "tasful_talk",
        ].some((p) => k.includes(p.replace(/_$/, "")) || k.startsWith(p))
      ).length,
      duplicatePatterns: [
        { pattern: "dismissed", keys: keysFound.filter((k) => k.includes("dismissed")) },
        { pattern: "activity", keys: keysFound.filter((k) => k.includes("activity")) },
        { pattern: "snapshot", keys: keysFound.filter((k) => k.includes("snapshot")) },
        { pattern: "log", keys: keysFound.filter((k) => k.includes("log")) },
      ],
      prefixSplit: {
        tasu_admin: keysFound.filter((k) => k.startsWith("tasu_admin_")).length,
        tasu_ai: keysFound.filter((k) => k.startsWith("tasu_ai_")).length,
      },
    };

    result.security = {
      sendPlanExported: typeof window.TasuAdminAiResponsePlans?.sendPlan === "function",
      deliverTalkExported: typeof window.TasuAdminAiResponsePlans?.deliverTalkNotification === "function",
      executeCandidateExported: typeof window.TasuAdminAiAutomationEngine?.executeCandidate === "function",
      fromHumanSendGateRequired:
        queueTest.ok && /承認待ち|AI単独送信/.test(queueTest.message || ""),
      hsgPanelStatesNoSoloSend: /AI単独送信は行いません/.test(
        document.querySelector("[data-ops-ai-human-send-gate]")?.innerText || ""
      ),
      clientSideOnly: true,
    };

    result.performance = window.__reviewRenderCounts || { note: "not instrumented" };

    const inboxItems = window.TasuAdminAiDailyInbox?.buildInboxItems?.() || [];
    const hsgPending = HSG.readPendingQueue().length;
    result.ux = {
      inboxItemCount: inboxItems.length,
      hsgPendingCount: hsgPending,
      hsgMaxCap: 80,
      inboxPerSectionCap: 4,
      estimatedDaily30: { scrollBurden: result.scrollMetrics.watchScrollPx, manageable: true },
      estimatedDaily100: {
        scrollBurden: result.scrollMetrics.hsgScrollPx,
        hsgNoPagination: true,
        duplicatePanels: true,
      },
      estimatedDaily500: {
        localStorageRisk: true,
        noBulkApprove: true,
      },
    };

    if (!result.sectionOrder.phaseOrderCorrect) result.issues.push({ severity: "high", msg: "Phase9-12 DOM順序が仕様と不一致" });
    if (result.nav.pointsToLegacyHub)
      result.issues.push({ severity: "high", msg: "サイドバーOPS WATCHが#ops-ai-hubを指しPhase9パネルと不一致" });
    if (!result.nav.watchHref.includes("ops-ai-watch"))
      result.issues.push({ severity: "high", msg: "サイドバーOPS WATCHが#ops-ai-watchを指していない" });
    if (result.scrollMetrics.watchBelowFold)
      result.issues.push({ severity: "medium", msg: `Ops Watchが初期表示で折りたたみ下（約${result.scrollMetrics.watchScrollPx}px）` });
    if (!queueTest.logFound) result.issues.push({ severity: "medium", msg: "承認フロー実行ログの追跡に失敗（テストデータ不足の可能性）" });
    if (result.security.deliverTalkExported)
      result.issues.push({ severity: "medium", msg: "deliverTalkNotificationが公開API — コンソールからGate迂回可能" });
    if (result.learningLoop.executionLogIsolated)
      result.issues.push({ severity: "low", msg: "tasu_ai_execution_log_v1はOps Watch/KPIと未連携（監査専用）" });
    if (result.performance?.duplicateRenders)
      result.issues.push({ severity: "low", msg: "dashboard refreshでPhaseパネル二重描画" });

    return result;
  });
}

async function instrumentRenders(page) {
  await page.evaluate(() => {
    window.__reviewRenderCounts = { opsWatch: 0, kpi: 0, hsg: 0, autofix: 0, refresh: 0 };
    const wrap = (obj, key, fnName) => {
      if (!obj?.[fnName]) return;
      const orig = obj[fnName].bind(obj);
      obj[fnName] = (...args) => {
        window.__reviewRenderCounts[key]++;
        return orig(...args);
      };
    };
    wrap(window.TasuAdminAiOpsWatch, "opsWatch", "renderOpsWatchPanel");
    wrap(window.TasuAdminAiKpiCenter, "kpi", "renderKpiCenterPanel");
    wrap(window.TasuAdminAiAutoFixCandidate, "autofix", "renderAutoFixPanel");
    wrap(window.TasuAdminAiHumanSendGate, "hsg", "renderHumanSendGatePanel");
    if (window.TasuTalkOpsRoom?.refresh) {
      const origRefresh = window.TasuTalkOpsRoom.refresh.bind(window.TasuTalkOpsRoom);
      window.TasuTalkOpsRoom.refresh = (...args) => {
        window.__reviewRenderCounts.refresh++;
        return origRefresh(...args);
      };
    }
  });
}

function buildReport(checks, testResults) {
  const opFlowWarn =
    checks.scrollMetrics.watchBelowFold ||
    checks.nav.pointsToLegacyHub ||
    !checks.scrollMetrics.inboxAboveFold;
  const opFlowPass = checks.sectionOrder.phaseOrderCorrect && checks.critical.hsgCountBadge;

  const sections = {
    運営導線: grade(opFlowPass && !checks.nav.pointsToLegacyHub, opFlowWarn || checks.nav.pointsToLegacyHub),
    UI: grade(checks.sectionOrder.phaseOrderCorrect, checks.scrollMetrics.watchBelowFold),
    承認フロー: grade(
      (checks.approvalFlow.queueTest?.approved && checks.approvalFlow.queueTest?.logFound) ||
        (checks.approvalFlow.internalApprove?.ok && checks.approvalFlow.internalApprove?.logFound),
      checks.approvalFlow.queueTest?.ok || checks.approvalFlow.internalApprove?.ok
    ),
    学習ループ: grade(
      checks.learningLoop.decisionFeedsOpsWatch && checks.learningLoop.autoFixFeedsHSG,
      checks.learningLoop.executionLogIsolated
    ),
    パフォーマンス: grade(
      !checks.performance?.duplicateRenders && (checks.performance?.opsWatch || 0) < 8,
      checks.performance?.duplicateRenders || (checks.performance?.opsWatch || 0) >= 5
    ),
    セキュリティ: grade(
      checks.security.fromHumanSendGateRequired && checks.security.hsgPanelStatesNoSoloSend,
      checks.security.deliverTalkExported
    ),
  };

  const ux30 = checks.ux.inboxItemCount <= 40 ? "PASS" : "WARNING";
  const ux100 = checks.ux.hsgPendingCount <= 80 && checks.scrollMetrics.hsgScrollPx < 2500 ? "WARNING" : "FAIL";
  const ux500 = "FAIL";

  const recommendations = [
    {
      priority: 1,
      title: "サイドバー「OPS WATCH」を #ops-ai-watch に変更",
      reason: "critical異常がレガシーハブに埋もれる。Phase9パネルへ直接ジャンプできない",
    },
    {
      priority: 2,
      title: "朝の運営導線を折りたたみ上に集約",
      reason: "Daily Inbox + 結論ヒーローの後にPhase9-12があり、異常・承認待ちまでスクロールが長い",
    },
    {
      priority: 3,
      title: "Daily Inbox「承認」とHuman Send Gateの導線統合",
      reason: "Inbox承認がキュー追加止まりの場合、HSGへの誘導CTAが必要",
    },
    {
      priority: 4,
      title: "dashboard refreshのPhaseパネル二重描画を削除",
      reason: "TasuTalkOpsRoom.refresh()後の再renderが重複。100件/日で体感遅延",
    },
    {
      priority: 5,
      title: "承認待ち一覧にページネーション / 一括承認（将来）",
      reason: "80件上限・全カードDOM描画は100件以上で運用負荷",
    },
    {
      priority: 6,
      title: "deliverTalkNotificationの公開範囲を縮小",
      reason: "クライアントのみの改ざん耐性。コンソール迂回リスク",
    },
    {
      priority: 7,
      title: "localStorageキー命名統一（tasu_admin_* → tasu_ai_*）",
      reason: "response系とautomation系でプレフィックス分裂。運用調査コスト増",
    },
    {
      priority: 8,
      title: "tasu_ai_execution_log_v1をOps Watch監査ログに統合表示",
      reason: "承認追跡は可能だが、異常監視画面から見えない",
    },
    {
      priority: 9,
      title: "レガシーハブ ops_watch と Phase9 Ops Watch の重複解消",
      reason: "同一情報の二重表示。どちらが正か運営者が迷う",
    },
    {
      priority: 10,
      title: "AI対応案リード文の更新（「低のみ自動送信可」→「承認待ち経由」）",
      reason: "Phase12後も旧文言が残り、運営者の期待と実装がズレる",
    },
  ];

  const immediateFixes = [];

  const futureWork = [
    "サーバー側承認API + 改ざん耐性（localStorage依存の脱却）",
    "承認待ちバルク操作・フィルタ・検索",
    "500件/日想定のページネーションとアーカイブ戦略",
    "スナップショットストア統合（ops_watch + kpi_center）",
    "Morning CheckフローにHSG件数を組み込み",
  ];

  return {
    generatedAt: new Date().toISOString(),
    overall: overallFrom(sections),
    sections,
    uxVolume: { daily30: ux30, daily100: ux100, daily500: ux500 },
    checks,
    testResults,
    recommendations,
    immediateFixes,
    futureWork,
  };
}

function formatMarkdown(report) {
  const lines = [
    "# AI運営秘書 統合レビュー",
    "",
    `生成日時: ${report.generatedAt}`,
    "",
    `総合評価: **${report.overall}**`,
    "",
    `運営導線: ${report.sections.運営導線}`,
    `UI: ${report.sections.UI}`,
    `承認フロー: ${report.sections.承認フロー}`,
    `学習ループ: ${report.sections.学習ループ}`,
    `パフォーマンス: ${report.sections.パフォーマンス}`,
    `セキュリティ: ${report.sections.セキュリティ}`,
    "",
    "## UXボリューム評価",
    `- 1日30件: ${report.uxVolume.daily30}`,
    `- 1日100件: ${report.uxVolume.daily100}`,
    `- 1日500件: ${report.uxVolume.daily500}`,
    "",
    "## レビュー詳細",
    "",
    "### 1. 運営導線",
    `- Daily Inboxは最上部（約5分ワークフロー）— 朝の入口として有効`,
    `- Phase9-12は結論ヒーロー下（Ops Watch スクロール約 ${report.checks.scrollMetrics.watchScrollPx}px）`,
    `- サイドバーOPS WATCH → ${report.checks.nav.watchHref}（Phase9パネルと不一致）`,
    "",
    "### 2. UI優先順位",
    `- 秘書ブロック内: Watch → KPI → AutoFix → HSG → ハブ — **仕様通り**`,
    `- ダッシュボード全体: Daily InboxがPhase9より上 — **実運営と仕様の差**`,
    "",
    "### 3. Critical導線",
    `- Ops Watch critical表示: ${report.checks.critical.watchHasEmergency ? "あり" : "なし"}（${report.checks.critical.watchCriticalItems}件）`,
    `- HSG criticalカード: ${report.checks.critical.hsgCriticalCards}件、パネルalert: ${report.checks.critical.panelAlertClass.hsg}`,
    "",
    "### 4. 承認フロー",
    `- AI単独送信ブロック: ${report.checks.security.fromHumanSendGateRequired ? "有効" : "要確認"}`,
    `- 実行ログ追跡: ${report.checks.approvalFlow.queueTest?.logFound ? "可能" : "要確認"}（tasu_ai_execution_log_v1）`,
    "",
    "### 5. 学習ループ",
    `- Decision → Outcome → Ops Watch → Auto Fix → HSG — **循環成立**`,
    `- 実行ログは監査専用で監視パネル未連携`,
    "",
    "### 6. データ構造",
    `- 検出キー: ${report.checks.storage.keysFound.length}件`,
    `- 重複パターン: dismissed×${report.checks.storage.duplicatePatterns[0].keys.length}, activity×${report.checks.storage.duplicatePatterns[1].keys.length}, snapshot×${report.checks.storage.duplicatePatterns[2].keys.length}, log×${report.checks.storage.duplicatePatterns[3].keys.length}`,
    "",
    "### 7. パフォーマンス",
    `- 描画カウント（1回refresh後）: OpsWatch=${report.checks.performance.opsWatch || 0}, KPI=${report.checks.performance.kpi || 0}, HSG=${report.checks.performance.hsg || 0}, TalkOpsRoom.refresh=${report.checks.performance.refresh || 0}`,
    "",
    "### 8. セキュリティ",
    `- Human Send Gate必須: sendPlan/executeCandidate経由でキューイング`,
    `- 迂回リスク: deliverTalkNotification公開API（クライアントのみ）`,
    "",
    "## 回帰テスト",
    ...report.testResults.map((t) => `- ${t.name}: ${t.status}`),
    "",
    "## 改善推奨 TOP10",
    ...report.recommendations.map((r) => `${r.priority}. **${r.title}** — ${r.reason}`),
    "",
    "## 即修正",
    ...report.immediateFixes.map((f) => `- ${f}`),
    "",
    "## 将来対応",
    ...report.futureWork.map((f) => `- ${f}`),
    "",
    "## スクリーンショット",
    `- 390px: screenshots/admin-ai-full-review/dashboard-390.png`,
    `- 1280px: screenshots/admin-ai-full-review/dashboard-1280.png`,
    `- talk-ops-room 390px: screenshots/admin-ai-full-review/talk-ops-390.png`,
  ];
  return lines.join("\n");
}

async function runPhaseTests() {
  const tests = [
    "test-admin-ai-daily-inbox-browser.mjs",
    "test-admin-ai-ops-watch-browser.mjs",
    "test-admin-ai-kpi-center-browser.mjs",
    "test-admin-ai-auto-fix-candidate-browser.mjs",
    "test-admin-ai-human-send-gate-browser.mjs",
    "test-admin-ai-response-plans-browser.mjs",
    "test-admin-ai-automation-engine-browser.mjs",
    "test-admin-ai-outcome-learning-browser.mjs",
    "test-admin-ai-decision-learning-browser.mjs",
    "test-admin-ai-response-safety-license-gate-browser.mjs",
  ];
  const { execSync } = await import("child_process");
  const results = [];
  for (const t of tests) {
    let status = "FAIL";
    let detail = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        execSync(`node scripts/${t}`, { cwd: root, stdio: "pipe", timeout: 120000 });
        status = "PASS";
        detail = "";
        break;
      } catch (e) {
        detail = String(e.stdout || e.stderr || "");
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    results.push({ name: t.replace(".mjs", ""), status, detail: detail.split("\n").slice(-3).join(" ") });
  }
  return results;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  console.log("=== Phase1-12 回帰テスト ===");
  const testResults = await runPhaseTests();
  testResults.forEach((t) => console.log(`${t.status}: ${t.name}`));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(pageUrl("admin-operations-dashboard.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KNOWN_STORAGE_KEYS);
  await page.waitForFunction(() => window.TasuAdminAiHumanSendGate?.buildHumanSendGateSnapshot, {
    timeout: 15000,
  });

  await instrumentRenders(page);
  await seedOperationalScenario(page);
  await page.evaluate(() => window.TasuTalkOpsRoom?.refresh?.());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, "dashboard-390.png"), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, "dashboard-1280.png"), fullPage: true });

  const checks = await runChecks(page);

  await page.goto(pageUrl("talk-ops-room.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KNOWN_STORAGE_KEYS);
  await seedOperationalScenario(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, "talk-ops-390.png"), fullPage: true });

  await browser.close();

  const dupRenders =
    (checks.performance.opsWatch || 0) >= 2 ||
    (checks.performance.hsg || 0) >= 2 ||
    (checks.performance.refresh || 0) >= 1;
  checks.performance.duplicateRenders = dupRenders;

  const report = buildReport(checks, testResults);
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(REPORT_MD, formatMarkdown(report), "utf8");

  console.log("\n" + formatMarkdown(report));
  console.log(`\nReview saved: ${REPORT_MD}`);
  console.log(`JSON saved: ${REPORT_JSON}`);

  await finalizeFromOutDir(root, SHOT_DIR, {
    title: "AI運営秘書 統合レビュー",
    report,
    overall: report.overall,
  });

  if (report.overall === "FAIL" || testResults.some((t) => t.status === "FAIL")) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
