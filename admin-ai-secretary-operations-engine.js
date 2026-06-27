/**
 * AI 秘書 Phase 6 — Operations Engine（Insight · Priority · Suggestion 統合）
 */
(function (global) {
  "use strict";

  const SCHEMA = "ops_analysis_v1";
  const VERSION = "phase6-operations-engine";

  function getMod(name) {
    return global[name] || null;
  }

  /**
   * @param {object} [options]
   * @param {object} [options.provider]
   * @param {boolean} [options.useDeepSeek]
   */
  async function runAnalysis(options) {
    options = options || {};
    const DataProvider = getMod("TasuSecretaryOpsDataProvider");
    const Insight = getMod("TasuSecretaryInsightEngine");
    const Priority = getMod("TasuSecretaryPriorityEngine");
    const Suggestion = getMod("TasuSecretarySuggestionEngine");

    if (!DataProvider?.resolveProvider || !Insight?.analyzeSnapshots || !Priority?.classifyInsights) {
      return { ok: false, error: "operations_modules_missing", schema: SCHEMA };
    }

    const provider = options.provider || DataProvider.resolveProvider(options);
    const fetchResult = await provider.fetchSnapshots(options.ctx || {});

    if (!fetchResult?.ok) {
      return {
        ok: false,
        error: fetchResult?.error || "fetch_failed",
        schema: SCHEMA,
        providerId: fetchResult?.providerId || provider?.id,
      };
    }

    const insights = Insight.analyzeSnapshots(fetchResult.snapshots);
    const prioritized = Priority.sortForDisplay(Priority.classifyInsights(insights));
    const suggestions = Suggestion?.buildSuggestions
      ? Priority.sortForDisplay(Suggestion.buildSuggestions(prioritized))
      : [];
    const groups = Priority.groupByPriority(prioritized);

    return {
      ok: true,
      schema: SCHEMA,
      version: VERSION,
      generatedAt: new Date().toISOString(),
      providerId: fetchResult.providerId || provider.id,
      enrichment: fetchResult.enrichment || null,
      snapshots: fetchResult.snapshots,
      insights,
      insightSummary: Insight.summarize(insights),
      prioritized,
      groups,
      suggestions,
      suggestionSummary: Suggestion?.summarize?.(suggestions) || { total: 0 },
    };
  }

  let lastResult = null;

  async function refresh(options) {
    lastResult = await runAnalysis(options);
    return lastResult;
  }

  function getLastResult() {
    return lastResult;
  }

  global.TasuSecretaryOperationsEngine = {
    SCHEMA,
    VERSION,
    runAnalysis,
    refresh,
    getLastResult,
  };
})(typeof window !== "undefined" ? window : globalThis);
