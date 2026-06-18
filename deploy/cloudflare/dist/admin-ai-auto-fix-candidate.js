/**
 * AI運営秘書 Phase11 — Auto Fix Candidate
 * Phase5〜10 の結果を統合し改善候補を提示する（候補提示のみ。自動適用は行わない）。
 */
(function (global) {
  "use strict";

  const THRESHOLDS = Object.freeze({
    reopenedWarning: 0.15,
    reopenedCritical: 0.25,
    resolvedWarning: 0.7,
    resolvedCritical: 0.5,
    complaintWarning: 1,
    complaintCritical: 3,
    connectFailWarning: 3,
    connectFailCritical: 5,
    autoFailWarning: 0.15,
    autoFailCritical: 0.25,
    faqCategoryCount: 5,
    builderRejectWarning: 2,
  });

  const SEV_ORDER = { critical: 0, warning: 1, normal: 2 };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearForTests() {
    /* stateless module */
  }

  function pickSeverity(...levels) {
    for (const sev of ["critical", "warning", "normal"]) {
      if (levels.includes(sev)) return sev;
    }
    return "normal";
  }

  function makeCandidate(partial) {
    return {
      id: partial.id || `afc_${partial.source}_${partial.category}_${Math.random().toString(36).slice(2, 8)}`,
      source: partial.source,
      category: partial.category,
      severity: partial.severity || "normal",
      recommendation: partial.recommendation,
      reason: partial.reason,
      impactArea: partial.impactArea || partial.source,
      confidence: partial.confidence ?? 0.7,
      metrics: partial.metrics || {},
      detail: partial.detail || "",
    };
  }

  function collectAutoFixSignals() {
    const OW = global.TasuAdminAiOpsWatch;
    const KC = global.TasuAdminAiKpiCenter;
    const metrics = OW?.collectCurrentMetrics?.() || {};
    const previous = OW?.getPreviousMetrics?.() || null;
    const opsAnomalies = OW?.rankOpsAnomalies?.(OW.detectOpsAnomalies?.(metrics, previous) || []) || [];
    const kpi = KC?.collectKpiMetrics?.() || {};
    const kpiDeltas =
      KC?.compareKpiWithPrevious?.(kpi, readKpiPrevious(KC)) || {};

    const outcomes = global.TasuAdminAiOutcomeLearning?.readOutcomes?.() || [];
    const autoOutcomes = outcomes.filter(
      (o) => o.sourceType === "automation" || o.actionType === "auto_executed"
    );
    const autoFailed = autoOutcomes.filter((o) => o.outcome === "reopened" || o.outcome === "complaint").length;
    const autoTotal = autoOutcomes.length || 1;
    const automationFailureRate = autoFailed / autoTotal;

    const autoActivity = global.TasuAdminAiAutomationEngine?.readActivity?.() || [];
    const automationCandidates = global.TasuAdminAiAutomationEngine?.buildAutomationCandidates?.() || [];

    const tickets = global.TasuSupportTicketStore?.listTickets?.() || [];
    const byCategory = {};
    tickets.forEach((t) => {
      const c = t.category || "general";
      byCategory[c] = (byCategory[c] || 0) + 1;
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    const decisions = global.TasuAdminAiDecisionLearning?.readDecisions?.() || [];
    const badDecisions = decisions.filter(
      (d) => d.operatorAction === "approved" && /reopened|complaint|escalated/i.test(String(d.outcome || d.note || ""))
    ).length;

    const prevEscalated = previous?.outcome?.escalated || 0;
    const escalatedDelta = (metrics.outcome?.escalated || 0) - prevEscalated;

    return {
      metrics,
      previous,
      kpi,
      kpiDeltas: kpiDeltas,
      opsAnomalies,
      opsWatchStatusMap: KC?.getOpsWatchStatusMap?.() || {},
      reopenedRate: metrics.outcome?.reopenedRate || kpi.reopenedRate || 0,
      resolutionRate: metrics.outcome?.resolvedRate || kpi.resolutionRate || 0,
      complaint: metrics.support?.complaint || kpi.reports || 0,
      escalated: metrics.outcome?.escalated || 0,
      escalatedDelta,
      connectFailures:
        (metrics.connect?.identityFail || 0) +
        (metrics.connect?.gateNg || 0) +
        (metrics.connect?.payoutErrors || 0),
      automationFailureRate,
      automationRate: kpi.automationRate || 0,
      postAutoReopened: metrics.automation?.postReopened || 0,
      builderRejections: metrics.builder?.rejection || kpi.builderRejections || 0,
      builderPending: metrics.builder?.pendingReview || kpi.builderPending || 0,
      topCategory,
      byCategory,
      badDecisions,
      automationCandidates,
      autoActivityCount: autoActivity.length,
    };
  }

  function severityFromOpsAnomalies(anomalies, source, type) {
    const hit = anomalies.find((a) => a.source === source && (!type || a.type === type));
    if (!hit) return null;
    return hit.severity === "critical" ? "critical" : hit.severity === "warning" ? "warning" : "normal";
  }

  function generateAutoFixCandidates(signals) {
    const s = signals || collectAutoFixSignals();
    const candidates = [];
    const TH = THRESHOLDS;

    const reopenedSev = pickSeverity(
      s.reopenedRate >= TH.reopenedCritical ? "critical" : null,
      s.reopenedRate >= TH.reopenedWarning ? "warning" : null,
      severityFromOpsAnomalies(s.opsAnomalies, "outcome", "reopened_rate"),
      severityFromOpsAnomalies(s.opsAnomalies, "automation", "post_auto_reopened")
    );
    if (reopenedSev !== "normal" || s.postAutoReopened >= 1) {
      const sev =
        reopenedSev !== "normal"
          ? reopenedSev
          : s.postAutoReopened >= 2
            ? "warning"
            : "normal";
      if (sev !== "normal" || s.postAutoReopened >= 1) {
        candidates.push(
          makeCandidate({
            source: "automation",
            category: "automation_exclude",
            severity: sev === "normal" && s.postAutoReopened >= 1 ? "warning" : sev,
            recommendation: "自動返信を承認待ちへ戻す",
            reason: `再問い合わせ率 ${Math.round(s.reopenedRate * 100)}%`,
            impactArea: "Support / Automation",
            confidence: Math.min(0.95, 0.6 + s.reopenedRate),
            metrics: {
              reopenedRate: s.reopenedRate,
              postAutoReopened: s.postAutoReopened,
              automationFailureRate: s.automationFailureRate,
            },
            detail:
              "Automation Engine 実行後に reopened が発生しています。Phase12 で承認フロー付き適用が可能になるまで、候補として保持します。",
          })
        );
        candidates.push(
          makeCandidate({
            source: "automation",
            category: "automation_pause",
            severity: sev === "normal" && s.postAutoReopened >= 1 ? "warning" : sev,
            recommendation: "自動化候補から一時除外",
            reason: `自動処理後の再問い合わせ ${s.postAutoReopened}件`,
            impactArea: "Automation",
            confidence: 0.75,
            metrics: { postAutoReopened: s.postAutoReopened },
            detail: "自動昇格候補を一時的に除外する提案です（今回は実行しません）。",
          })
        );
      }
    }

    const autoFailSev = pickSeverity(
      s.automationFailureRate >= TH.autoFailCritical ? "critical" : null,
      s.automationFailureRate >= TH.autoFailWarning ? "warning" : null
    );
    if (autoFailSev !== "normal") {
      candidates.push(
        makeCandidate({
          source: "automation",
          category: "automation_failure_rate",
          severity: autoFailSev,
          recommendation: "自動化候補から一時除外",
          reason: `自動化失敗率 ${Math.round(s.automationFailureRate * 100)}%`,
          impactArea: "Automation",
          confidence: 0.8,
          metrics: { automationFailureRate: s.automationFailureRate },
          detail: "自動処理後の complaint / reopened が閾値を超えています。",
        })
      );
    }

    const resolvedSev = pickSeverity(
      s.resolutionRate > 0 && s.resolutionRate < TH.resolvedCritical ? "critical" : null,
      s.resolutionRate > 0 && s.resolutionRate < TH.resolvedWarning ? "warning" : null,
      severityFromOpsAnomalies(s.opsAnomalies, "outcome", "low_resolved_rate")
    );
    if (resolvedSev !== "normal") {
      candidates.push(
        makeCandidate({
          source: "outcome",
          category: "approval_rollback",
          severity: resolvedSev,
          recommendation: "承認待ちへ戻す",
          reason: `解決率 ${Math.round(s.resolutionRate * 100)}%`,
          impactArea: "Support / Outcome",
          confidence: 0.82,
          metrics: { resolutionRate: s.resolutionRate },
          detail: "Outcome Learning により解決率が低下しています。自動実行候補の見直しを推奨します。",
        })
      );
    }

    const complaintSev = pickSeverity(
      s.complaint >= TH.complaintCritical ? "critical" : null,
      s.complaint >= TH.complaintWarning ? "warning" : null,
      severityFromOpsAnomalies(s.opsAnomalies, "support", "complaint")
    );
    if (complaintSev !== "normal") {
      candidates.push(
        makeCandidate({
          source: "outcome",
          category: "complaint_review",
          severity: complaintSev,
          recommendation: "該当カテゴリを要判断へ昇格",
          reason: `complaint ${s.complaint}件`,
          impactArea: "Support",
          confidence: 0.85,
          metrics: { complaint: s.complaint },
          detail: "通報・クレーム系 outcome が増加しています。",
        })
      );
    }

    if (s.escalatedDelta > 0 || s.escalated >= 2) {
      const sev = s.escalated >= 3 ? "warning" : "warning";
      candidates.push(
        makeCandidate({
          source: "outcome",
          category: "escalated_increase",
          severity: severityFromOpsAnomalies(s.opsAnomalies, "outcome", "escalated") || sev,
          recommendation: "要判断キューを優先確認",
          reason: `escalated ${s.escalated}件${s.escalatedDelta > 0 ? "（増加）" : ""}`,
          impactArea: "Support",
          confidence: 0.7,
          metrics: { escalated: s.escalated, escalatedDelta: s.escalatedDelta },
        })
      );
    }

    if (s.badDecisions >= 2) {
      candidates.push(
        makeCandidate({
          source: "decision",
          category: "learning_reeval",
          severity: s.badDecisions >= 4 ? "warning" : "normal",
          recommendation: "学習データ再評価",
          reason: `承認後の結果悪化 ${s.badDecisions}件`,
          impactArea: "Decision Learning",
          confidence: 0.72,
          metrics: { badDecisions: s.badDecisions },
          detail: "Decision Learning で承認後に reopened / complaint が発生したパターンがあります。",
        })
      );
    }

    const dl = global.TasuAdminAiDecisionLearning;
    if (dl?.applyLearningBoost) {
      (s.automationCandidates || []).forEach((c) => {
        const boost = dl.applyLearningBoost(c);
        const outcome = global.TasuAdminAiOutcomeLearning?.applyOutcomeAdjustment?.(c);
        if (boost?.promote === false && (outcome?.downgrade || outcome?.blockPromote)) {
          candidates.push(
            makeCandidate({
              source: "decision",
              category: "automation_degraded",
              severity: outcome?.upgrade ? "critical" : "warning",
              recommendation: "学習データ再評価",
              reason: outcome?.label || boost?.recommendation || "自動昇格不可",
              impactArea: "Automation / Decision",
              confidence: 0.78,
              metrics: { eventType: c.eventType, ruleName: c.ruleName },
              detail: `ルール: ${c.ruleName || c.eventType}`,
            })
          );
        }
      });
    }

    const connectSev = pickSeverity(
      s.connectFailures >= TH.connectFailCritical ? "critical" : null,
      s.connectFailures >= TH.connectFailWarning ? "warning" : null,
      severityFromOpsAnomalies(s.opsAnomalies, "connect", "identity_fail"),
      severityFromOpsAnomalies(s.opsAnomalies, "connect", "identity_spike")
    );
    if (connectSev !== "normal") {
      candidates.push(
        makeCandidate({
          source: "connect",
          category: "identity_guide",
          severity: connectSev,
          recommendation: "本人確認ガイド改善",
          reason: `本人確認失敗 ${s.connectFailures}件`,
          impactArea: "Connect",
          confidence: 0.8,
          metrics: { connectFailures: s.connectFailures },
          detail: "Connect本人確認・Gate・出金周りの失敗が増加しています。",
        })
      );
    }

    if (s.topCategory && s.topCategory[1] >= TH.faqCategoryCount) {
      candidates.push(
        makeCandidate({
          source: "support",
          category: "faq_candidate",
          severity: s.topCategory[1] >= TH.faqCategoryCount * 2 ? "warning" : "normal",
          recommendation: "FAQ化候補",
          reason: `同一問い合わせ ${s.topCategory[1]}件（${s.topCategory[0]}）`,
          impactArea: "Support",
          confidence: 0.65,
          metrics: { category: s.topCategory[0], count: s.topCategory[1] },
          detail: "同一カテゴリの問い合わせが集中しています。",
        })
      );
    }

    if (s.builderRejections >= TH.builderRejectWarning) {
      candidates.push(
        makeCandidate({
          source: "builder",
          category: "form_improvement",
          severity: s.builderRejections >= 4 ? "warning" : "normal",
          recommendation: "入力フォーム改善",
          reason: `完了報告差し戻し ${s.builderRejections}件`,
          impactArea: "Builder",
          confidence: 0.68,
          metrics: { builderRejections: s.builderRejections, builderPending: s.builderPending },
          detail: "Builder審査の差し戻しが増加しています。",
        })
      );
    }

    const marketCancelled = s.metrics?.market?.cancelled || s.kpi?.marketCancelled || 0;
    if (marketCancelled >= 2) {
      candidates.push(
        makeCandidate({
          source: "market",
          category: "cancel_increase",
          severity: marketCancelled >= 3 ? "warning" : "normal",
          recommendation: "キャンセル理由の確認と出品者連絡フロー見直し",
          reason: `市場キャンセル ${marketCancelled}件`,
          impactArea: "Market",
          confidence: 0.8,
          metrics: { marketCancelled },
          detail: "市場注文のキャンセルが増加しています。",
        })
      );
    }

    (s.opsAnomalies || []).forEach((a) => {
      if (a.recommendedActions?.length && !candidates.some((c) => c.reason === a.reason)) {
        const existing = candidates.find(
          (c) => c.source === a.source && c.recommendation === a.recommendedActions[0]
        );
        if (!existing && a.severity !== "normal") {
          candidates.push(
            makeCandidate({
              source: a.source,
              category: `ops_watch_${a.type}`,
              severity: a.severity,
              recommendation: a.recommendedActions[0],
              reason: a.title,
              impactArea: a.source,
              confidence: 0.85,
              metrics: { metric: a.metric, current: a.current, previous: a.previous },
              detail: a.reason,
            })
          );
        }
      }
    });

    return candidates;
  }

  function rankAutoFixCandidates(candidates) {
    return [...candidates].sort(
      (a, b) =>
        (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) ||
        (b.confidence ?? 0) - (a.confidence ?? 0)
    );
  }

  function buildAnalysis(candidates, signals) {
    const lines = [];
    if (
      candidates.some((c) => c.source === "automation" || c.category?.includes("automation"))
    ) {
      lines.push("再問い合わせ率上昇のため Support 自動化候補を見直してください");
    }
    if (candidates.some((c) => c.source === "connect")) {
      lines.push("Connect本人確認失敗が増加しています");
    }
    if (candidates.some((c) => c.source === "builder")) {
      lines.push("Builder差し戻し率が上昇しています");
    }
    if (candidates.some((c) => c.source === "outcome" && c.category === "approval_rollback")) {
      lines.push("Outcome Learning により解決率低下 — 承認待ちへの戻しを検討してください");
    }
    if (candidates.some((c) => c.source === "decision")) {
      lines.push("Decision Learning の承認結果に悪化傾向があります");
    }
    if (candidates.some((c) => c.source === "support" && c.category === "faq_candidate")) {
      lines.push("同一カテゴリ問い合わせの集中 — FAQ化を検討してください");
    }
    if (!lines.length) {
      lines.push("現時点で重大な改善候補は限定的 — 監視を継続してください");
    }
    return lines;
  }

  function readKpiPrevious(KC) {
    try {
      const key = global.TasuAdminAiOpsWatch?.yesterdayKey?.() || "";
      const raw = global.localStorage.getItem(KC?.KPI_SNAPSHOT_KEY || "tasu_ai_kpi_center_snapshots_v1");
      const snaps = raw ? JSON.parse(raw) : {};
      return snaps[key]?.summary || null;
    } catch {
      return null;
    }
  }

  function alignSeverityWithPhases(candidates, signals) {
    return candidates.map((c) => {
      let sev = c.severity;
      const opsMap = signals.opsWatchStatusMap || {};
      if (c.source === "connect" && opsMap.connectFailures) {
        sev = pickSeverity(sev, opsMap.connectFailures);
      }
      if ((c.source === "automation" || c.source === "outcome") && opsMap.reopenedRate) {
        sev = pickSeverity(sev, opsMap.reopenedRate);
      }
      if (c.source === "outcome" && opsMap.resolutionRate) {
        sev = pickSeverity(sev, opsMap.resolutionRate);
      }
      if ((c.source === "support" || c.source === "outcome") && opsMap.reports) {
        sev = pickSeverity(sev, opsMap.reports);
      }
      (signals.opsAnomalies || []).forEach((a) => {
        if (a.source === c.source && a.severity === "critical") sev = "critical";
        else if (a.source === c.source && a.severity === "warning" && sev !== "critical") sev = "warning";
      });
      return { ...c, severity: sev };
    });
  }

  function buildAutoFixSnapshot() {
    const signals = collectAutoFixSignals();
    const raw = generateAutoFixCandidates(signals);
    const aligned = alignSeverityWithPhases(raw, signals);
    const candidates = rankAutoFixCandidates(aligned);
    const analysis = buildAnalysis(candidates, signals);

    return {
      generatedAt: new Date().toISOString(),
      signals,
      analysis,
      summary: {
        candidateCount: candidates.length,
        criticalCount: candidates.filter((c) => c.severity === "critical").length,
        warningCount: candidates.filter((c) => c.severity === "warning").length,
        normalCount: candidates.filter((c) => c.severity === "normal").length,
      },
      candidates,
    };
  }

  function severityLabel(sev) {
    if (sev === "critical") return "critical";
    if (sev === "warning") return "warning";
    return "normal";
  }

  function renderCandidateCard(c, idx) {
    const confPct = Math.round((c.confidence || 0) * 100);
    return (
      `<article class="ops-ai-autofix-card ops-ai-autofix-card--${esc(c.severity)}" data-autofix-candidate="${esc(c.id)}">` +
      `<header class="ops-ai-autofix-card__head">` +
      `<span class="ops-ai-autofix-card__source">${esc(c.source)}</span>` +
      `<span class="ops-ai-autofix-card__severity ops-ai-autofix-card__severity--${esc(c.severity)}">${esc(severityLabel(c.severity))}</span>` +
      `</header>` +
      `<h4 class="ops-ai-autofix-card__rec">${esc(c.recommendation)}</h4>` +
      `<p class="ops-ai-autofix-card__reason">${esc(c.reason)}</p>` +
      `<dl class="ops-ai-autofix-card__meta">` +
      `<div><dt>影響</dt><dd>${esc(c.impactArea)}</dd></div>` +
      `<div><dt>confidence</dt><dd>${confPct}%</dd></div>` +
      `</dl>` +
      `<details class="ops-ai-autofix-card__details">` +
      `<summary class="ops-ai-autofix-card__detail-btn" data-autofix-detail>詳細</summary>` +
      `<p class="ops-ai-autofix-card__detail-body">${esc(c.detail || c.reason)}</p>` +
      `</details>` +
      `<button type="button" class="ops-ai-autofix-card__queue-btn" data-autofix-queue="${esc(c.id)}">承認待ちへ送る</button>` +
      `</article>`
    );
  }

  function renderAutoFixPanel(target) {
    const host =
      typeof target === "string"
        ? global.document?.querySelector(target)
        : target || global.document?.querySelector("[data-ops-ai-auto-fix]");
    if (!host) return;

    const snap = buildAutoFixSnapshot();
    const { candidates, analysis, summary } = snap;

    if (!candidates.length) {
      host.innerHTML =
        `<header class="ops-ai-autofix__head">` +
        `<h2 class="ops-ai-autofix__title" id="ops-ai-autofix-heading">Auto Fix Candidate</h2>` +
        `<p class="ops-ai-autofix__sub">AIが改善候補を提案しています</p>` +
        `</header>` +
        `<p class="ops-ai-autofix-empty">現在、自動修正候補はありません</p>`;
      host.dataset.autofixReady = "1";
      return;
    }

    const analysisHtml =
      `<section class="ops-ai-autofix-analysis" data-autofix-analysis>` +
      `<h3 class="ops-ai-autofix-analysis__title">AI分析</h3>` +
      `<ul class="ops-ai-autofix-analysis__list">${analysis
        .map((line) => `<li>${esc(line)}</li>`)
        .join("")}</ul>` +
      `</section>`;

    const cardsHtml = candidates.map(renderCandidateCard).join("");

    host.innerHTML =
      `<header class="ops-ai-autofix__head">` +
      `<div class="ops-ai-autofix__title-row">` +
      `<h2 class="ops-ai-autofix__title" id="ops-ai-autofix-heading">Auto Fix Candidate</h2>` +
      `<span class="ops-ai-autofix__badges">` +
      (summary.criticalCount
        ? `<span class="ops-ai-autofix-badge ops-ai-autofix-badge--critical">critical ${summary.criticalCount}</span>`
        : "") +
      (summary.warningCount
        ? `<span class="ops-ai-autofix-badge ops-ai-autofix-badge--warning">warning ${summary.warningCount}</span>`
        : "") +
      `<span class="ops-ai-autofix-badge ops-ai-autofix-badge--count">${summary.candidateCount}件</span>` +
      `</span></div>` +
      `<p class="ops-ai-autofix__sub">AIが改善候補を提案しています</p>` +
      `</header>` +
      analysisHtml +
      `<div class="ops-ai-autofix__grid" data-autofix-grid>${cardsHtml}</div>`;

    host.dataset.autofixReady = "1";
    host.classList.toggle("ops-ai-autofix--alert", summary.criticalCount + summary.warningCount > 0);

    host.querySelectorAll("[data-autofix-detail]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
      });
    });

    host.querySelectorAll("[data-autofix-queue]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cid = btn.getAttribute("data-autofix-queue");
        const candidate = candidates.find((c) => c.id === cid);
        if (candidate && global.TasuAdminAiHumanSendGate?.enqueueFromAutoFixCandidate) {
          global.TasuAdminAiHumanSendGate.enqueueFromAutoFixCandidate(candidate);
          global.TasuAdminAiHumanSendGate.renderHumanSendGatePanel("[data-ops-ai-human-send-gate]");
        }
      });
    });
  }

  let renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderAutoFixPanel("[data-ops-ai-auto-fix]");
    }, 50);
  }

  function init() {
    scheduleRender();
    const events = [
      "tasu:support-tickets-updated",
      "tasu:admin-ai-outcome-learning-updated",
      "tasu:admin-ai-automation-updated",
      "tasu:admin-ai-decision-learning-updated",
      "tasu:admin-connect-resolved",
      "tasu:builder-partner-eval-changed",
      "tasu:stripe-connect-ingested",
      "tasu:admin-ai-ops-watch-updated",
      "tasful-talk-notifications-changed",
      "tasu-market-events-changed",
    ];
    events.forEach((ev) => global.addEventListener(ev, scheduleRender));
  }

  global.TasuAdminAiAutoFixCandidate = {
    THRESHOLDS,
    clearForTests,
    collectAutoFixSignals,
    generateAutoFixCandidates,
    rankAutoFixCandidates,
    buildAutoFixSnapshot,
    renderAutoFixPanel,
    init,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
