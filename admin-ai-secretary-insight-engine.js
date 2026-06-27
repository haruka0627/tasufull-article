/**
 * AI 秘書 Phase 6 — Insight Engine（集約 · 分析 · 異常検知 · 提案候補の種）
 */
(function (global) {
  "use strict";

  const SCHEMA = "ops_insight_v1";
  const { pctDelta } = global.TasuSecretaryOpsDataProvider || {};

  const RULES = Object.freeze([
    {
      domain: "builder",
      metricId: "inquiry_count",
      kind: "surge",
      title: "問い合わせ急増",
      minDeltaPct: 25,
      severity: "warning",
    },
    {
      domain: "builder",
      metricId: "conversion_rate",
      kind: "decline",
      title: "成約率低下",
      maxDeltaPct: -15,
      severity: "critical",
      invert: true,
    },
    {
      domain: "builder",
      metricId: "reply_delay_hours",
      kind: "latency",
      title: "返信遅延",
      minDeltaPct: 30,
      severity: "warning",
    },
    {
      domain: "platform",
      metricId: "post_count",
      kind: "decline",
      title: "投稿数減少",
      maxDeltaPct: -15,
      severity: "warning",
      invert: true,
    },
    {
      domain: "platform",
      metricId: "talk_usage_rate",
      kind: "decline",
      title: "Talk利用率低下",
      maxDeltaPct: -15,
      severity: "warning",
      invert: true,
    },
    {
      domain: "platform",
      metricId: "ng_post_count",
      kind: "surge",
      title: "NG投稿増加",
      minDeltaPct: 50,
      severity: "critical",
    },
    {
      domain: "tlv",
      metricId: "registration_rate",
      kind: "decline",
      title: "登録率低下",
      maxDeltaPct: -20,
      severity: "warning",
      invert: true,
    },
    {
      domain: "tlv",
      metricId: "watch_time_minutes",
      kind: "decline",
      title: "視聴時間減少",
      maxDeltaPct: -20,
      severity: "warning",
      invert: true,
    },
    {
      domain: "materials",
      metricId: "download_count",
      kind: "surge",
      title: "ダウンロード急増",
      minDeltaPct: 40,
      severity: "info",
    },
    {
      domain: "materials",
      metricId: "top_category_shift",
      kind: "shift",
      title: "人気カテゴリ変化",
      minDeltaPct: 20,
      severity: "info",
    },
  ]);

  function findMetric(snapshot, metricId) {
    return (snapshot?.metrics || []).find((m) => m.id === metricId) || null;
  }

  function buildInsightId(domain, metricId, kind) {
    return `insight-${domain}-${metricId}-${kind}`;
  }

  function evaluateRule(rule, snapshot) {
    const m = findMetric(snapshot, rule.metricId);
    if (!m) return null;

    const delta = Number.isFinite(m.deltaPct) ? m.deltaPct : pctDelta?.(m.value, m.baseline) ?? 0;
    let triggered = false;

    if (rule.invert) {
      triggered = rule.maxDeltaPct != null && delta <= rule.maxDeltaPct;
    } else if (rule.minDeltaPct != null) {
      triggered = delta >= rule.minDeltaPct;
    }

    if (!triggered) return null;

    const unit = m.unit ? ` ${m.unit}` : "";
    return {
      schema: SCHEMA,
      id: buildInsightId(snapshot.domain, rule.metricId, rule.kind),
      domain: snapshot.domain,
      domainLabel: snapshot.label,
      kind: rule.kind,
      type: delta >= 0 ? "anomaly_up" : "anomaly_down",
      severity: rule.severity,
      title: rule.title,
      summary: `${m.label}: ${m.value}${unit}（基準 ${m.baseline}${unit} · ${delta >= 0 ? "+" : ""}${delta}%）`,
      metricId: rule.metricId,
      deltaPct: delta,
      evidence: [
        { label: "current", value: m.value },
        { label: "baseline", value: m.baseline },
        { label: "deltaPct", value: delta },
      ],
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * @param {import('./admin-ai-secretary-ops-data-provider').OpsDomainSnapshotV1[]} snapshots
   * @returns {object[]}
   */
  function analyzeSnapshots(snapshots) {
    snapshots = Array.isArray(snapshots) ? snapshots : [];
    const insights = [];

    snapshots.forEach((snap) => {
      RULES.filter((r) => r.domain === snap.domain).forEach((rule) => {
        const insight = evaluateRule(rule, snap);
        if (insight) insights.push(insight);
      });
    });

    return insights;
  }

  function summarize(insights) {
    insights = Array.isArray(insights) ? insights : [];
    const byDomain = {};
    const bySeverity = { critical: 0, warning: 0, info: 0 };
    insights.forEach((i) => {
      byDomain[i.domain] = (byDomain[i.domain] || 0) + 1;
      if (bySeverity[i.severity] != null) bySeverity[i.severity] += 1;
    });
    return { total: insights.length, byDomain, bySeverity };
  }

  global.TasuSecretaryInsightEngine = {
    SCHEMA,
    RULES,
    analyzeSnapshots,
    summarize,
    evaluateRule,
  };
})(typeof window !== "undefined" ? window : globalThis);
