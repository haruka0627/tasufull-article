/**
 * AI 秘書 Phase 6 — Suggestion Engine（提案 · 質問 · 改善案 · Action 候補のみ）
 * 実行はしない — actionCandidates.executable は常に false
 */
(function (global) {
  "use strict";

  const SCHEMA = "ops_suggestion_v1";
  const SUGGESTION_TYPE = Object.freeze({
    PROPOSAL: "proposal",
    QUESTION: "question",
    IMPROVEMENT: "improvement",
  });

  const ACTION_KIND = Object.freeze({
    ANALYZE: "analyze",
    VIEW_DETAIL: "view_detail",
    OPEN_BUILDER: "open_builder",
    OPEN_PLATFORM: "open_platform",
    OPEN_TLV: "open_tlv",
    OPEN_MATERIALS: "open_materials",
  });

  const DOMAIN_ACTIONS = Object.freeze({
    builder: [
      { id: "analyze_cause", kind: ACTION_KIND.ANALYZE, label: "分析開始" },
      { id: "view_builder_detail", kind: ACTION_KIND.VIEW_DETAIL, label: "詳細を見る", href: "#ops-ai-daily-inbox" },
      { id: "open_builder", kind: ACTION_KIND.OPEN_BUILDER, label: "Builderを開く", href: "builder/index.html" },
    ],
    platform: [
      { id: "check_rules", kind: ACTION_KIND.ANALYZE, label: "ルールを確認" },
      { id: "view_platform_detail", kind: ACTION_KIND.VIEW_DETAIL, label: "詳細を見る", href: "#ops-content-gate" },
      { id: "open_platform", kind: ACTION_KIND.OPEN_PLATFORM, label: "Platformを開く", href: "index.html" },
    ],
    tlv: [
      { id: "check_traffic", kind: ACTION_KIND.ANALYZE, label: "広告流入を確認" },
      { id: "view_tlv_detail", kind: ACTION_KIND.VIEW_DETAIL, label: "詳細を見る", href: "live/tlv-admin.html" },
      { id: "open_tlv", kind: ACTION_KIND.OPEN_TLV, label: "TLVを開く", href: "live/" },
    ],
    materials: [
      { id: "analyze_downloads", kind: ACTION_KIND.ANALYZE, label: "分析開始" },
      { id: "view_materials_detail", kind: ACTION_KIND.VIEW_DETAIL, label: "詳細を見る", href: "#ops-ai-kpi" },
      { id: "open_materials", kind: ACTION_KIND.OPEN_MATERIALS, label: "Materialsを見る", href: "#ops-ai-kpi" },
    ],
  });

  const TEMPLATES = Object.freeze({
    "builder-inquiry_count-surge": {
      type: SUGGESTION_TYPE.QUESTION,
      headline: "Builder問い合わせが急増しています",
      body: "原因分析を実行しますか？",
    },
    "builder-conversion_rate-decline": {
      type: SUGGESTION_TYPE.IMPROVEMENT,
      headline: "Builder成約率が低下しています",
      body: "返信テンプレートと見積フローを確認しますか？",
    },
    "builder-reply_delay_hours-latency": {
      type: SUGGESTION_TYPE.IMPROVEMENT,
      headline: "Builder返信遅延が増えています",
      body: "優先対応キューを確認しますか？",
    },
    "platform-ng_post_count-surge": {
      type: SUGGESTION_TYPE.QUESTION,
      headline: "PlatformでNG投稿が増加しています",
      body: "ルールを確認しますか？",
    },
    "platform-post_count-decline": {
      type: SUGGESTION_TYPE.PROPOSAL,
      headline: "Platform投稿数が減少しています",
      body: "投稿促進キャンペーンの効果を確認しますか？",
    },
    "platform-talk_usage_rate-decline": {
      type: SUGGESTION_TYPE.IMPROVEMENT,
      headline: "Talk利用率が低下しています",
      body: "Talk導線と通知設定を確認しますか？",
    },
    "tlv-registration_rate-decline": {
      type: SUGGESTION_TYPE.QUESTION,
      headline: "TLV登録率が低下しています",
      body: "広告流入を確認しますか？",
    },
    "tlv-watch_time_minutes-decline": {
      type: SUGGESTION_TYPE.IMPROVEMENT,
      headline: "TLV視聴時間が減少しています",
      body: "コンテンツ配置とサムネイルを確認しますか？",
    },
    "materials-download_count-surge": {
      type: SUGGESTION_TYPE.PROPOSAL,
      headline: "Materialsダウンロードが急増しています",
      body: "人気資料の在庫と CDN 負荷を確認しますか？",
    },
    "materials-top_category_shift-shift": {
      type: SUGGESTION_TYPE.PROPOSAL,
      headline: "人気カテゴリに変化があります",
      body: "カテゴリ別レポートを確認しますか？",
    },
  });

  function templateKey(insight) {
    return `${insight.domain}-${insight.metricId}-${insight.kind}`;
  }

  function actionCandidatesFor(domain, insightId) {
    const base = DOMAIN_ACTIONS[domain] || [
      { id: "analyze", kind: ACTION_KIND.ANALYZE, label: "分析開始" },
      { id: "view_detail", kind: ACTION_KIND.VIEW_DETAIL, label: "詳細を見る" },
    ];
    return base.map((a) => ({
      ...a,
      insightId,
      executable: false,
      phase: "6-candidate-only",
    }));
  }

  function buildFromInsight(insight, priorityItem) {
    const key = templateKey(insight);
    const tpl = TEMPLATES[key] || {
      type: SUGGESTION_TYPE.PROPOSAL,
      headline: insight.title,
      body: `${insight.summary} — 詳細を確認しますか？`,
    };

    return {
      schema: SCHEMA,
      id: `sug-${insight.id}`,
      insightId: insight.id,
      domain: insight.domain,
      domainLabel: insight.domainLabel,
      type: tpl.type,
      headline: tpl.headline,
      body: tpl.body,
      priority: priorityItem?.priority || insight.severity,
      deltaPct: insight.deltaPct,
      actionCandidates: actionCandidatesFor(insight.domain, insight.id),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * @param {object[]} prioritizedItems — PriorityEngine output
   */
  function buildSuggestions(prioritizedItems) {
    return (Array.isArray(prioritizedItems) ? prioritizedItems : []).map((item) =>
      buildFromInsight(item.insight || item, item)
    );
  }

  function summarize(suggestions) {
    suggestions = Array.isArray(suggestions) ? suggestions : [];
    const byType = {};
    suggestions.forEach((s) => {
      byType[s.type] = (byType[s.type] || 0) + 1;
    });
    return {
      total: suggestions.length,
      byType,
      actionCount: suggestions.reduce((n, s) => n + (s.actionCandidates?.length || 0), 0),
    };
  }

  global.TasuSecretarySuggestionEngine = {
    SCHEMA,
    SUGGESTION_TYPE,
    ACTION_KIND,
    DOMAIN_ACTIONS,
    buildSuggestions,
    buildFromInsight,
    actionCandidatesFor,
    summarize,
  };
})(typeof window !== "undefined" ? window : globalThis);
