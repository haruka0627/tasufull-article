/**
 * AI運営秘書 Phase9 — Ops Watch
 * 問い合わせ・Connect・Builder・安否・TALK・Outcome の異常増加を検知し提案する（監視のみ）。
 */
(function (global) {
  "use strict";

  const SNAPSHOT_KEY = "tasu_ai_ops_watch_snapshots_v1";
  const LOG_KEY = "tasu_ai_ops_watch_log_v1";
  const MAX_LOG = 100;

  const THRESHOLDS = Object.freeze({
    deltaWarning: 1.5,
    deltaCritical: 2.5,
    reopenedRateWarning: 0.15,
    resolvedRateWarning: 0.7,
    connectIdentityWarning: 3,
  });

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, data) {
    global.localStorage.setItem(key, JSON.stringify(data));
  }

  function todayKey(d) {
    const x = d || new Date();
    return x.toISOString().slice(0, 10);
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  }

  function readSnapshots() {
    const raw = readJson(SNAPSHOT_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function saveDailySnapshot(metrics) {
    const snaps = readSnapshots();
    const key = todayKey();
    snaps[key] = { at: new Date().toISOString(), metrics };
    const keys = Object.keys(snaps).sort().slice(-14);
    const trimmed = {};
    keys.forEach((k) => {
      trimmed[k] = snaps[k];
    });
    writeJson(SNAPSHOT_KEY, trimmed);
  }

  function getPreviousMetrics() {
    const prev = readSnapshots()[yesterdayKey()];
    return prev?.metrics || null;
  }

  function clearForTests() {
    writeJson(SNAPSHOT_KEY, {});
    writeJson(LOG_KEY, []);
  }

  function appendWatchLog(entries) {
    if (!entries?.length) return;
    const list = readJson(LOG_KEY, []);
    const day = todayKey();
    const existingKeys = new Set(
      list.map((row) =>
        `${row.kind || row.source || ""}|${row.type || ""}|${row.severity || ""}|${row.metric || ""}|${String(row.at || "").slice(0, 10) || day}`
      )
    );
    const now = new Date().toISOString();
    entries.forEach((a) => {
      const key = `${a.source}|${a.type}|${a.severity}|${a.metric}|${day}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      list.unshift({
        at: now,
        kind: a.source,
        type: a.type,
        severity: a.severity,
        metric: a.metric,
        current: a.current,
        previous: a.previous,
        reason: a.reason,
        title: a.title,
      });
    });
    writeJson(LOG_KEY, list.slice(0, MAX_LOG));
  }

  function readWatchLog(limit) {
    const arr = readJson(LOG_KEY, []);
    return (Array.isArray(arr) ? arr : []).slice(0, limit || 20);
  }

  function deltaRate(current, previous) {
    const cur = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev <= 0) return cur > 0 ? (cur >= 2 ? 2.5 : 1.0) : 0;
    return (cur - prev) / prev;
  }

  function isToday(iso) {
    return String(iso || "").slice(0, 10) === todayKey();
  }

  function isComplaintTicket(t) {
    return (
      ["abuse_or_policy", "legal_or_risk"].includes(t.category) ||
      t.severity === "critical" ||
      /通報|クレーム|complaint/i.test(`${t.title}\n${t.body}`)
    );
  }

  function collectComplaintReports(options) {
    const todayOnly = options?.todayOnly !== false;
    const store = global.TasuSupportTicketStore;
    const tickets = store?.listTickets?.() || [];
    const outcomes = global.TasuAdminAiOutcomeLearning?.readOutcomes?.() || [];
    const seen = new Set();
    let count = 0;

    tickets.forEach((t) => {
      if (!isComplaintTicket(t)) return;
      if (todayOnly && !isToday(t.created_at) && !isToday(t.updated_at)) return;
      const id = String(t.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      count += 1;
    });

    outcomes
      .filter((o) => o.outcome === "complaint")
      .forEach((o) => {
        if (todayOnly && !isToday(o.created_at) && !isToday(o.recordedAt) && !isToday(o.at)) return;
        const id = String(o.relatedTicketId || o.ticketId || o.id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        count += 1;
      });

    outcomes
      .filter((o) => o.outcome === "complaint")
      .forEach((o) => {
        if (todayOnly && !isToday(o.created_at) && !isToday(o.recordedAt) && !isToday(o.at)) return;
        const id = String(o.relatedTicketId || o.ticketId || o.id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        count += 1;
      });

    (store?.listLifecycleEvents?.({ todayOnly }) || [])
      .filter((e) => e.event_type === "support_complaint")
      .forEach((e) => {
        const id = String(e.ticket_id || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        count += 1;
      });

    return count;
  }

  function collectSupportReopenedCount(options) {
    const todayOnly = options?.todayOnly !== false;
    const store = global.TasuSupportTicketStore;
    const eventCount = store?.countLifecycleEvents?.("support_reopened", { todayOnly }) || 0;
    if (eventCount > 0) return eventCount;
    const outcomes = global.TasuAdminAiOutcomeLearning?.readOutcomes?.() || [];
    return outcomes.filter((o) => {
      if (o.outcome !== "reopened") return false;
      if (todayOnly && !isToday(o.created_at) && !isToday(o.at)) return false;
      return true;
    }).length;
  }

  function collectRevenueBreakdown() {
    const today = todayKey();
    const seen = new Set();
    let marketRevenue = 0;
    let marketCount = 0;
    let connectRevenue = 0;
    let connectCount = 0;
    let builderRevenue = 0;
    let builderCount = 0;
    let refundAmount = 0;
    let cancelCount = 0;

    const marketEvents = global.TasuMarketEventStore?.listMarketEvents?.() || [];
    marketEvents.forEach((e) => {
      const at = String(e.created_at || "").slice(0, 10);
      if (at !== today) return;
      if (e.event_type === "payment_completed" && e.channel !== "shop_stripe") {
        const id = String(e.order_id || e.id || "");
        if (!id || seen.has(`mkt_${id}`)) return;
        const amt = Number(e.amount) || 0;
        if (amt <= 0) return;
        seen.add(`mkt_${id}`);
        marketRevenue += amt;
        marketCount += 1;
      }
      if (e.event_type === "refund_completed") {
        refundAmount += Number(e.amount) || 0;
      }
      if (e.event_type === "order_cancelled") cancelCount += 1;
    });

    const orders = readJson("tasu_shop_orders", []);
    (Array.isArray(orders) ? orders : []).forEach((o) => {
      const at = String(o.created_at || o.paid_at || "").slice(0, 10);
      if (at !== today) return;
      const fee = Number(o.platform_fee_amount) || 0;
      if (fee > 0) {
        connectRevenue += fee;
        connectCount += 1;
      }
    });

    const stripeLogs = readJson("tasu_stripe_event_ingest_logs_v1", []);
    (Array.isArray(stripeLogs) ? stripeLogs : []).forEach((log) => {
      const at = String(log.created_at || "").slice(0, 10);
      if (at !== today) return;
      if (String(log.event_type || "") === "charge.refunded") {
        refundAmount += Number(log.amount) || 0;
      }
    });

    const fees = global.TasuPlatformChatFee?.readAllFees?.() || [];
    fees.forEach((row) => {
      if (String(row.status || "").toLowerCase() !== "paid") return;
      const at = String(row.paidAt || row.paid_at || row.updatedAt || "").slice(0, 10);
      if (at !== today) return;
      const amt = Number(row.feeAmount || row.amount || row.platform_fee_amount) || 0;
      if (amt <= 0) return;
      const cat = String(row.category || row.categoryKey || "").toLowerCase();
      if (cat === "builder") {
        builderRevenue += amt;
        builderCount += 1;
      } else {
        connectRevenue += amt;
        connectCount += 1;
      }
    });

    const totalRevenue = marketRevenue + connectRevenue + builderRevenue;
    return {
      marketRevenue,
      marketCount,
      connectRevenue,
      connectCount,
      builderRevenue,
      builderCount,
      totalRevenue,
      refundAmount,
      cancelCount,
    };
  }

  function collectCurrentMetrics() {
    const store = global.TasuSupportTicketStore;
    const tickets = store?.listTickets?.() || [];
    const openStatuses = new Set(["open", "ai_replied"]);
    const openTickets = tickets.filter((t) => openStatuses.has(t.status));
    const byCategory = {};
    openTickets.forEach((t) => {
      const c = t.category || "general";
      byCategory[c] = (byCategory[c] || 0) + 1;
    });

    const complaintCount = collectComplaintReports({ todayOnly: true });
    const supportReopenedCount = collectSupportReopenedCount({ todayOnly: true });

    const highRiskCount = tickets.filter(
      (t) => t.severity === "high" || t.severity === "critical"
    ).length;

    const connectIssues = store?.listConnectIssues?.() || [];
    const connectItems = global.TasuAdminConnectAiSupport?.buildConnectActionItems?.() || [];
    const identityFail = connectIssues.filter((i) =>
      /本人確認|identity|verification|document|requirements_past_due/i.test(
        `${i.issue_type}\n${i.detected_reason}`
      )
    ).length;
    const payoutErrors = connectIssues.filter((i) =>
      /payout|出金|売上受取|transfer/i.test(`${i.issue_type}\n${i.detected_reason}`)
    ).length;
    const gateNg = connectItems.filter(
      (i) => i.severity === "high" || i.severity === "critical"
    ).length;

    const userRetries = {};
    connectIssues.forEach((i) => {
      const u = i.user_id || "";
      if (!u) return;
      userRetries[u] = (userRetries[u] || 0) + 1;
    });
    const connectRetryFail = Object.values(userRetries).filter((n) => n >= 2).length;

    const builderEvals = global.TasuBuilderPartnerEval?.listEvaluations?.() || [];
    const builderPending = builderEvals.filter((e) => e.status === "needs_review").length;
    const builderReject = builderEvals.filter(
      (e) =>
        e.event_type === "rejection" ||
        /差し戻し|再提出|reject|却下/i.test(String(e.reason || e.summary || e.note || ""))
    ).length;

    const notifyStore = global.TasuTalkNotifications;
    const allNotify = notifyStore?.getAll?.() || [];
    const unreadImportant = allNotify.filter((n) => {
      const unread = notifyStore?.isUnread?.(n) !== false && !n.readAt;
      const imp = ["important", "urgent", "high"].includes(String(n.priority || "").toLowerCase());
      return unread && imp;
    }).length;
    const deliveryFail = allNotify.filter((n) => n.deliveryFailed || n.status === "failed").length;

    const notifyByType = {};
    allNotify.forEach((n) => {
      const t = n.type || "general";
      notifyByType[t] = (notifyByType[t] || 0) + 1;
    });

    const anpiItems = global.TasuTalkOpsAssistant?.collectAnpiItems?.() || [];
    const anpiText = (i) => `${i.meta || ""} ${i.title || ""}`;
    const anpiUnconfirmed = anpiItems.filter((i) => /未確認|未読|未応答/.test(anpiText(i))).length;
    const anpiEmergency = anpiItems.filter((i) =>
      /emergency|緊急|critical/i.test(anpiText(i))
    ).length;
    const anpiConfirmed = (notifyStore?.getAll?.() || [])
      .filter((n) => {
        const cat = String(n.category || "").toLowerCase();
        const type = String(n.type || "").toLowerCase();
        if (cat !== "anpi" && type !== "anpi") return false;
        const text = `${n.title || ""} ${n.body || ""} ${n.meta || ""}`;
        return /確認済|確認完了|confirmed|応答あり|安否確認完了/i.test(text);
      }).length;

    const revenueBreakdown = collectRevenueBreakdown();

    const outcomes = global.TasuAdminAiOutcomeLearning?.readOutcomes?.() || [];
    const known = outcomes.filter((o) => o.outcome && o.outcome !== "unknown");
    const resolvedN = known.filter((o) => o.outcome === "resolved").length;
    const reopenedN = known.filter((o) => o.outcome === "reopened").length;
    const complaintN = known.filter((o) => o.outcome === "complaint").length;
    const escalatedN = known.filter((o) => o.outcome === "escalated").length;
    const knownN = known.length || 1;
    const autoReopened = outcomes.filter(
      (o) => o.sourceType === "automation" && o.outcome === "reopened"
    ).length;

    const decisionBad = (global.TasuAdminAiDecisionLearning?.readDecisions?.() || []).filter(
      (d) => d.operatorAction === "dismissed" || d.operatorAction === "blocked"
    ).length;

    const marketMetrics = global.TasuMarketEventStore?.collectMarketMetrics?.() || {
      orderCreated: 0,
      paymentCompleted: 0,
      cancelled: 0,
      refundRequested: 0,
      refundCompleted: 0,
      todayRevenue: 0,
    };

    return {
      support: {
        open: openTickets.length,
        complaint: complaintCount,
        highRisk: highRiskCount,
        reopened: supportReopenedCount,
        byCategory,
      },
      connect: {
        identityFail,
        gateNg,
        payoutErrors,
        retryFail: connectRetryFail,
        pending: connectItems.length,
      },
      builder: {
        pendingReview: builderPending,
        rejection: builderReject,
      },
      talk: {
        unreadImportant,
        deliveryFail,
        notifyByType,
      },
      anpi: {
        unconfirmed: anpiUnconfirmed,
        emergency: anpiEmergency,
        confirmed: anpiConfirmed,
        total: anpiItems.length,
      },
      outcome: {
        resolvedRate: resolvedN / knownN,
        reopenedRate: reopenedN / knownN,
        complaint: complaintN,
        escalated: escalatedN,
        reopened: reopenedN,
        resolved: resolvedN,
      },
      automation: {
        postReopened: autoReopened,
      },
      decision: {
        degraded: decisionBad,
      },
      market: marketMetrics,
      revenue: revenueBreakdown,
    };
  }

  function makeAnomaly(partial) {
    const current = Number(partial.current) || 0;
    const previous = Number(partial.previous) || 0;
    return {
      id: partial.id || `ow_${partial.source}_${partial.type}_${Math.random().toString(36).slice(2, 8)}`,
      source: partial.source,
      type: partial.type,
      severity: partial.severity,
      title: partial.title,
      metric: partial.metric,
      current,
      previous,
      deltaRate: deltaRate(current, previous),
      reason: partial.reason,
      recommendedActions: partial.recommendedActions || [],
      detectedAt: new Date().toISOString(),
    };
  }

  function detectOpsAnomalies(metrics, previous) {
    const anomalies = [];
    const prev = previous || {};
    const m = metrics;
    const p = (path, fallback) => {
      const parts = path.split(".");
      let v = prev;
      for (const k of parts) {
        v = v?.[k];
      }
      return v ?? fallback ?? 0;
    };

    const pushDelta = (cfg) => {
      const cur = cfg.current;
      const prv = cfg.previous ?? p(cfg.prevPath, 0);
      const rate = deltaRate(cur, prv);
      let severity = null;
      if (cfg.criticalIf?.(cur, prv, rate)) severity = "critical";
      else if (rate >= THRESHOLDS.deltaCritical) severity = "critical";
      else if (cfg.warningIf?.(cur, prv, rate)) severity = "warning";
      else if (rate >= THRESHOLDS.deltaWarning) severity = "warning";
      else if (cfg.absCritical?.(cur)) severity = "critical";
      else if (cfg.absWarning?.(cur)) severity = "warning";
      if (!severity) return;
      anomalies.push(
        makeAnomaly({
          source: cfg.source,
          type: cfg.type,
          severity,
          title: cfg.title(rate, cur, prv),
          metric: cfg.metric,
          current: cur,
          previous: prv,
          reason: cfg.reason(rate, cur, prv),
          recommendedActions: cfg.actions,
        })
      );
    };

    pushDelta({
      source: "support",
      type: "open_increase",
      metric: "support.open",
      current: m.support.open,
      prevPath: "support.open",
      title: (r) => `Support未対応 ${r >= 1.5 ? "+" + Math.round(r * 100) + "%" : "増加"}`,
      reason: (r, c, pv) =>
        `open/ai_replied が ${pv} → ${c}（${r >= 0 ? "+" : ""}${Math.round(r * 100)}%）`,
      actions: ["未対応キューを確認する", "同一カテゴリのテンプレ返信を見直す"],
      warningIf: (c) => c >= 3,
    });

    if (m.support.complaint >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "support",
          type: "complaint",
          severity: "warning",
          title: `Support complaint ${m.support.complaint}件`,
          metric: "support.complaint",
          current: m.support.complaint,
          previous: p("support.complaint", 0),
          reason: "通報・高リスク・クレーム系チケットを検知",
          recommendedActions: ["要判断キューで個別確認", "自動返信を承認待ちへ戻す候補を確認"],
        })
      );
    }

    if (m.support.highRisk >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "support",
          type: "high_risk",
          severity: "critical",
          title: `Support high risk ${m.support.highRisk}件`,
          metric: "support.highRisk",
          current: m.support.highRisk,
          previous: p("support.highRisk", 0),
          reason: "高リスク・重大チケットが存在",
          recommendedActions: ["AI運営センターで優先確認"],
        })
      );
    }

    if (m.support.reopened >= 1) {
      const sev =
        m.support.reopened >= 4 || m.outcome.reopenedRate >= THRESHOLDS.reopenedRateWarning
          ? "warning"
          : "normal";
      if (sev !== "normal") {
        anomalies.push(
          makeAnomaly({
            source: "support",
            type: "reopened",
            severity: sev,
            title: `Support reopened ${m.support.reopened}件`,
            metric: "support.reopened",
            current: m.support.reopened,
            previous: p("support.reopened", 0),
            reason: "Outcome Learning で再問い合わせを検知",
            recommendedActions: ["該当カテゴリの自動返信を承認待ちへ戻す", "Connect案内文を見直す"],
          })
        );
      }
    }

    if (m.connect.identityFail >= THRESHOLDS.connectIdentityWarning) {
      anomalies.push(
        makeAnomaly({
          source: "connect",
          type: "identity_fail",
          severity: "warning",
          title: `Connect本人確認失敗 ${m.connect.identityFail}件`,
          metric: "connect.identityFail",
          current: m.connect.identityFail,
          previous: p("connect.identityFail", 0),
          reason: "本人確認・書類不備の Connect 問題が増加",
          recommendedActions: ["本人確認ガイドを表示する", "Connect案内文を見直す"],
        })
      );
    }

    pushDelta({
      source: "connect",
      type: "identity_spike",
      metric: "connect.identityFail",
      current: m.connect.identityFail,
      prevPath: "connect.identityFail",
      title: (r) => `Connect本人確認失敗 +${Math.round(r * 100)}%`,
      reason: (r, c, pv) => `本人確認失敗 ${pv} → ${c}`,
      actions: ["Connect対応画面で未完了を確認"],
      absWarning: (c) => c >= 1 && c < THRESHOLDS.connectIdentityWarning,
    });

    if (m.connect.gateNg >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "connect",
          type: "gate_ng",
          severity: "warning",
          title: `Connect Gate NG ${m.connect.gateNg}件`,
          metric: "connect.gateNg",
          current: m.connect.gateNg,
          previous: p("connect.gateNg", 0),
          reason: "license/identity gate による運営確認が必要",
          recommendedActions: ["Connect本人確認フローを確認"],
        })
      );
    }

    if (m.connect.payoutErrors >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "connect",
          type: "payout_error",
          severity: "warning",
          title: `Connect payout/出金エラー ${m.connect.payoutErrors}件`,
          metric: "connect.payoutErrors",
          current: m.connect.payoutErrors,
          previous: p("connect.payoutErrors", 0),
          reason: "売上受取・出金関連の Connect 問題",
          recommendedActions: ["Stripe Connect ダッシュボードを確認"],
        })
      );
    }

    if (m.builder.pendingReview >= 3) {
      anomalies.push(
        makeAnomaly({
          source: "builder",
          type: "approval_backlog",
          severity: "warning",
          title: `Builder承認待ち ${m.builder.pendingReview}件`,
          metric: "builder.pendingReview",
          current: m.builder.pendingReview,
          previous: p("builder.pendingReview", 0),
          reason: "審査待ちが滞留",
          recommendedActions: ["Builder審査画面で優先確認"],
        })
      );
    }

    if (m.outcome.reopenedRate >= THRESHOLDS.reopenedRateWarning && m.outcome.reopened >= 2) {
      anomalies.push(
        makeAnomaly({
          source: "outcome",
          type: "reopened_rate",
          severity: "warning",
          title: `再問い合わせ率 ${Math.round(m.outcome.reopenedRate * 100)}%`,
          metric: "outcome.reopenedRate",
          current: Math.round(m.outcome.reopenedRate * 100),
          previous: Math.round((p("outcome.reopenedRate", 0) || 0) * 100),
          reason: "Outcome Learning — 再問い合わせ率が閾値超過",
          recommendedActions: ["自動化候補を承認待ちへ戻す候補として確認", "返信テンプレを見直す"],
        })
      );
    }

    if (m.outcome.resolvedRate < THRESHOLDS.resolvedRateWarning && m.outcome.resolved + m.outcome.reopened >= 3) {
      anomalies.push(
        makeAnomaly({
          source: "outcome",
          type: "low_resolved_rate",
          severity: "warning",
          title: `解決率 ${Math.round(m.outcome.resolvedRate * 100)}%`,
          metric: "outcome.resolvedRate",
          current: Math.round(m.outcome.resolvedRate * 100),
          previous: Math.round((p("outcome.resolvedRate", 1) || 1) * 100),
          reason: "Outcome Learning — 解決率が70%未満",
          recommendedActions: ["要判断案件を優先確認", "自動実行候補の見直し"],
        })
      );
    }

    if (m.outcome.complaint >= 1 && m.support.complaint < 1) {
      anomalies.push(
        makeAnomaly({
          source: "support",
          type: "complaint",
          severity: "warning",
          title: `complaint ${m.outcome.complaint}件`,
          metric: "support.complaint",
          current: m.outcome.complaint,
          previous: p("support.complaint", 0),
          reason: "クレーム・通報系 outcome を検知",
          recommendedActions: ["該当案件を要判断へ昇格"],
        })
      );
    }

    if (m.outcome.escalated >= 2) {
      anomalies.push(
        makeAnomaly({
          source: "outcome",
          type: "escalated",
          severity: "warning",
          title: `Outcome escalated ${m.outcome.escalated}件`,
          metric: "outcome.escalated",
          current: m.outcome.escalated,
          previous: p("outcome.escalated", 0),
          reason: "運営確認へのエスカレーションが増加",
          recommendedActions: ["司令塔の要判断を優先"],
        })
      );
    }

    if (m.automation.postReopened >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "automation",
          type: "post_auto_reopened",
          severity: "warning",
          title: `自動処理後の再問い合わせ ${m.automation.postReopened}件`,
          metric: "automation.postReopened",
          current: m.automation.postReopened,
          previous: p("automation.postReopened", 0),
          reason: "Automation Engine 実行後に reopened が発生",
          recommendedActions: ["該当自動化を承認待ちへ戻す候補として表示", "ルール見直しを検討"],
        })
      );
    }

    if (m.talk.unreadImportant >= 3) {
      anomalies.push(
        makeAnomaly({
          source: "talk",
          type: "unread_important",
          severity: "warning",
          title: `TALK重要未読 ${m.talk.unreadImportant}件`,
          metric: "talk.unreadImportant",
          current: m.talk.unreadImportant,
          previous: p("talk.unreadImportant", 0),
          reason: "重要通知の未読が増加",
          recommendedActions: ["通知センターで確認"],
        })
      );
    }

    if (m.talk.deliveryFail >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "talk",
          type: "delivery_fail",
          severity: "warning",
          title: `TALK通知配送失敗 ${m.talk.deliveryFail}件`,
          metric: "talk.deliveryFail",
          current: m.talk.deliveryFail,
          previous: p("talk.deliveryFail", 0),
          reason: "通知配送失敗を検知",
          recommendedActions: ["通知ログを確認"],
        })
      );
    }

    if (m.anpi.emergency >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "anpi",
          type: "emergency",
          severity: "critical",
          title: `安否 emergency ${m.anpi.emergency}件`,
          metric: "anpi.emergency",
          current: m.anpi.emergency,
          previous: p("anpi.emergency", 0),
          reason: "緊急安否が未対応",
          recommendedActions: ["安否 emergency を最優先で確認する"],
        })
      );
    }

    if (m.anpi.unconfirmed >= 2) {
      anomalies.push(
        makeAnomaly({
          source: "anpi",
          type: "unconfirmed",
          severity: "warning",
          title: `安否未確認 ${m.anpi.unconfirmed}件`,
          metric: "anpi.unconfirmed",
          current: m.anpi.unconfirmed,
          previous: p("anpi.unconfirmed", 0),
          reason: "安否未確認・未応答が増加",
          recommendedActions: ["安否ダッシュボードで確認"],
        })
      );
    }

    if ((m.market?.refundRequested || 0) >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "market",
          type: "refund_requested",
          severity: "warning",
          title: `市場返金申請 ${m.market.refundRequested}件`,
          metric: "market.refundRequested",
          current: m.market.refundRequested,
          previous: p("market.refundRequested", 0),
          reason: "市場注文の返金申請を検知",
          recommendedActions: ["返金相談チケットを確認", "注文履歴で個別判断"],
        })
      );
    }

    if ((m.market?.refundCompleted || 0) >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "market",
          type: "refund_completed",
          severity: "warning",
          title: `市場返金完了 ${m.market.refundCompleted}件`,
          metric: "market.refundCompleted",
          current: m.market.refundCompleted,
          previous: p("market.refundCompleted", 0),
          reason: "市場注文の返金完了を検知",
          recommendedActions: ["返金記録を確認", "KPI売上への影響を確認"],
        })
      );
    }

    if ((m.market?.cancelled || 0) >= 2) {
      anomalies.push(
        makeAnomaly({
          source: "market",
          type: "order_cancelled",
          severity: "warning",
          title: `市場キャンセル ${m.market.cancelled}件`,
          metric: "market.cancelled",
          current: m.market.cancelled,
          previous: p("market.cancelled", 0),
          reason: "市場注文のキャンセルが増加",
          recommendedActions: ["キャンセル理由を確認", "出品者への連絡フローを見直す"],
        })
      );
    } else if ((m.market?.cancelled || 0) >= 1) {
      anomalies.push(
        makeAnomaly({
          source: "market",
          type: "order_cancelled",
          severity: "normal",
          title: `市場キャンセル ${m.market.cancelled}件`,
          metric: "market.cancelled",
          current: m.market.cancelled,
          previous: p("market.cancelled", 0),
          reason: "市場注文のキャンセルを検知",
          recommendedActions: ["注文履歴で確認"],
        })
      );
    }

    const dl = global.TasuAdminAiDecisionLearning;
    if (dl?.applyLearningBoost) {
      const candidates = global.TasuAdminAiAutomationEngine?.buildAutomationCandidates?.() || [];
      candidates.forEach((c) => {
        const boost = dl.applyLearningBoost(c);
        const outcome = global.TasuAdminAiOutcomeLearning?.applyOutcomeAdjustment?.(c);
        if (boost?.promote === false && (outcome?.downgrade || outcome?.upgrade)) {
          anomalies.push(
            makeAnomaly({
              source: "decision",
              type: "automation_degraded",
              severity: outcome?.upgrade ? "critical" : "warning",
              title: `自動化判定悪化: ${c.ruleName || c.eventType}`,
              metric: "decision.degraded",
              current: 1,
              previous: 0,
              reason: outcome?.label || boost?.recommendation || "学習結果により自動昇格不可",
              recommendedActions: ["承認待ちへ戻す候補として確認"],
            })
          );
        }
      });
    }

    return anomalies;
  }

  function rankOpsAnomalies(anomalies) {
    const order = { critical: 0, warning: 1, normal: 2 };
    return [...anomalies].sort(
      (a, b) =>
        (order[a.severity] ?? 9) - (order[b.severity] ?? 9) ||
        (b.deltaRate ?? 0) - (a.deltaRate ?? 0)
    );
  }

  function buildOpsWatchRecommendations(anomalies) {
    const recs = [];
    const seen = new Set();
    anomalies.forEach((a, idx) => {
      (a.recommendedActions || []).forEach((action, j) => {
        const key = action;
        if (seen.has(key)) return;
        seen.add(key);
        recs.push({
          id: `rec_${a.source}_${idx}_${j}`,
          priority: a.severity === "critical" ? 0 : a.severity === "warning" ? 1 : 2,
          title: action,
          reason: a.reason,
          actionType: a.source,
        });
      });
    });
    recs.sort((a, b) => a.priority - b.priority);
    return recs.slice(0, 8);
  }

  function buildAnalysis(anomalies) {
    const sources = [...new Set(anomalies.map((a) => a.source))];
    const causes = [];
    if (anomalies.some((a) => a.source === "connect")) causes.push("Connect本人確認・Gate・出金周りの詰まり");
    if (anomalies.some((a) => a.source === "outcome" || a.source === "automation"))
      causes.push("自動処理・AI対応後の再問い合わせ増");
    if (anomalies.some((a) => a.source === "anpi")) causes.push("安否未確認・緊急対応の滞留");
    if (anomalies.some((a) => a.source === "support")) causes.push("Support未対応・通報・高リスクの増加");
    if (!causes.length) causes.push("特定の集中原因は未検出 — 個別監視を継続");

    const impact =
      anomalies.some((a) => a.severity === "critical")
        ? "運営対応の遅延・クレーム拡大リスクあり"
        : anomalies.length
          ? "一部カテゴリで対応品質の低下傾向"
          : "現時点で重大な影響は限定的";

    const priority = anomalies[0]?.severity === "critical" ? "最優先（critical）" : anomalies.length ? "要確認（warning）" : "通常";

    return {
      causes,
      impact,
      priority,
      domains: sources.length ? sources.join(" / ") : "—",
    };
  }

  function buildOpsWatchSnapshot() {
    const metrics = collectCurrentMetrics();
    const previous = getPreviousMetrics();
    const raw = detectOpsAnomalies(metrics, previous);
    const anomalies = rankOpsAnomalies(raw);
    const recommendations = buildOpsWatchRecommendations(anomalies);
    const analysis = buildAnalysis(anomalies);

    if (anomalies.length) appendWatchLog(anomalies);
    saveDailySnapshot(metrics);

    const watchedSources = [
      "support",
      "connect",
      "builder",
      "talk",
      "anpi",
      "outcome",
      "automation",
      "decision",
      "market",
    ];

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        criticalCount: anomalies.filter((a) => a.severity === "critical").length,
        warningCount: anomalies.filter((a) => a.severity === "warning").length,
        normalCount: anomalies.filter((a) => a.severity === "normal").length,
        watchedSources,
        connectRevenue: metrics.revenue?.connectRevenue || 0,
        builderRevenue: metrics.revenue?.builderRevenue || 0,
        totalRevenue: metrics.revenue?.totalRevenue || 0,
      },
      metrics,
      previous,
      anomalies,
      analysis,
      recommendations,
      log: readWatchLog(12),
    };
  }

  function severityIcon(severity) {
    if (severity === "critical") return "🚨";
    if (severity === "warning") return "⚠";
    return "✓";
  }

  function renderOpsWatchPanel(target) {
    const host =
      typeof target === "string"
        ? global.document?.querySelector(target)
        : target || global.document?.querySelector("[data-ops-ai-watch]");
    if (!host) return;

    const snap = buildOpsWatchSnapshot();
    const { anomalies, analysis, recommendations, log, summary } = snap;

    const todayHtml = anomalies.length
      ? `<ul class="ops-ai-watch-list">${anomalies
          .slice(0, 8)
          .map(
            (a) =>
              `<li class="ops-ai-watch-list__item ops-ai-watch-list__item--${esc(a.severity)}">` +
              `<span class="ops-ai-watch-list__icon">${severityIcon(a.severity)}</span>` +
              `<span class="ops-ai-watch-list__text">${esc(a.title)}</span>` +
              `</li>`
          )
          .join("")}</ul>`
      : `<p class="ops-ai-watch-empty">現在、大きな異常はありません</p>`;

    const analysisHtml =
      `<dl class="ops-ai-watch-analysis">` +
      `<div><dt>原因候補</dt><dd>${esc(analysis.causes.join(" / "))}</dd></div>` +
      `<div><dt>影響範囲</dt><dd>${esc(analysis.impact)}</dd></div>` +
      `<div><dt>優先度</dt><dd>${esc(analysis.priority)}</dd></div>` +
      `<div><dt>担当領域</dt><dd>${esc(analysis.domains)}</dd></div>` +
      `</dl>`;

    const recHtml = recommendations.length
      ? `<ul class="ops-ai-watch-recs">${recommendations
          .map(
            (r) =>
              `<li class="ops-ai-watch-recs__item">` +
              `<span class="ops-ai-watch-recs__title">${esc(r.title)}</span>` +
              `<span class="ops-ai-watch-recs__reason">${esc(r.reason)}</span>` +
              `</li>`
          )
          .join("")}</ul>`
      : `<p class="ops-ai-watch-empty">推奨対応はありません — 監視継続</p>`;

    const logHtml = (log.length ? log : anomalies.slice(0, 5))
      .map((entry) => {
        const at = entry.at || entry.detectedAt || snap.generatedAt;
        const sev = entry.severity || "normal";
        return (
          `<li class="ops-ai-watch-log__item ops-ai-watch-log__item--${esc(sev)}">` +
          `<time class="ops-ai-watch-log__time">${esc(String(at).slice(11, 16))}</time>` +
          `<span class="ops-ai-watch-log__kind">${esc(entry.kind || entry.source || "—")}</span>` +
          `<span class="ops-ai-watch-log__metric">${esc(entry.metric || entry.title || "")}</span>` +
          `<span class="ops-ai-watch-log__vals">${esc(String(entry.current ?? ""))}/${esc(String(entry.previous ?? ""))}</span>` +
          `</li>`
        );
      })
      .join("");

    host.innerHTML =
      `<header class="ops-ai-watch__head">` +
      `<div class="ops-ai-watch__title-row">` +
      `<h2 class="ops-ai-watch__title" id="ops-ai-watch-heading">Ops Watch</h2>` +
      `<span class="ops-ai-watch__badges">` +
      (summary.criticalCount
        ? `<span class="ops-ai-watch-badge ops-ai-watch-badge--critical">critical ${summary.criticalCount}</span>`
        : "") +
      (summary.warningCount
        ? `<span class="ops-ai-watch-badge ops-ai-watch-badge--warning">warning ${summary.warningCount}</span>`
        : "") +
      `</span></div>` +
      `<p class="ops-ai-watch__sub">今日の異常・悪化傾向をAIが監視しています</p>` +
      `</header>` +
      `<div class="ops-ai-watch__grid">` +
      `<article class="ops-ai-watch-card" data-ops-watch-today>` +
      `<h3 class="ops-ai-watch-card__title">今日の異常</h3>` +
      todayHtml +
      `</article>` +
      `<article class="ops-ai-watch-card" data-ops-watch-analysis>` +
      `<h3 class="ops-ai-watch-card__title">AI分析</h3>` +
      analysisHtml +
      `</article>` +
      `<article class="ops-ai-watch-card" data-ops-watch-recommendations>` +
      `<h3 class="ops-ai-watch-card__title">推奨対応</h3>` +
      recHtml +
      `</article>` +
      `<article class="ops-ai-watch-card ops-ai-watch-card--log" data-ops-watch-log-panel>` +
      `<h3 class="ops-ai-watch-card__title">監視ログ</h3>` +
      `<ul class="ops-ai-watch-log">${logHtml || `<li class="ops-ai-watch-empty">ログなし</li>`}</ul>` +
      `</article>` +
      `</div>`;

    host.dataset.opsWatchReady = "1";
    host.classList.toggle("ops-ai-watch--alert", summary.criticalCount + summary.warningCount > 0);

    try {
      global.dispatchEvent(new CustomEvent("tasu:admin-ai-ops-watch-updated", { detail: snap }));
    } catch {
      /* ignore */
    }
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderOpsWatchPanel("[data-ops-ai-watch]");
    }, 50);
  }

  function init() {
    scheduleRender();
    const events = [
      "tasu:support-tickets-updated",
      "tasu:admin-ai-outcome-learning-updated",
      "tasu:admin-ai-automation-updated",
      "tasu:admin-connect-resolved",
      "tasu:builder-partner-eval-changed",
      "tasful-talk-notifications-changed",
      "tasu-market-events-changed",
      "tasu:support-lifecycle-event",
    ];
    events.forEach((ev) => global.addEventListener(ev, scheduleRender));
  }

  global.TasuAdminAiOpsWatch = {
    SNAPSHOT_KEY,
    LOG_KEY,
    THRESHOLDS,
    clearForTests,
    collectCurrentMetrics,
    collectComplaintReports,
    collectSupportReopenedCount,
    collectRevenueBreakdown,
    isComplaintTicket,
    getPreviousMetrics,
    deltaRate,
    todayKey,
    yesterdayKey,
    detectOpsAnomalies,
    rankOpsAnomalies,
    buildOpsWatchRecommendations,
    buildOpsWatchSnapshot,
    renderOpsWatchPanel,
    readWatchLog,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
