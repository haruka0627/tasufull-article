/**
 * TASFUL OPS WATCH — 検索 → 分析 → 通知（Phase2: 日次・重要度別）
 */
(function (global) {
  "use strict";

  const PHASE = "phase2";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizeSearchPrep(category, raw) {
    const prep = raw && typeof raw === "object" ? raw : {};
    const results = Array.isArray(prep.results) ? prep.results : [];
    const searchMessage = pickStr(prep.searchMessage, prep.search_message);
    const searchFailed =
      prep.searchFailed === true ||
      (prep.fallback_used === true && results.length === 0) ||
      /cors_or_network|network_error|not_configured/i.test(searchMessage);

    return {
      ...prep,
      results,
      searchQuery: pickStr(prep.searchQuery, prep.search_query) || category.searchQuery,
      searchUsed: Boolean(prep.searchUsed && results.length > 0),
      searchResultCount: results.length,
      searchFailed,
      searchMessage: searchMessage || (searchFailed ? "search_failed" : ""),
      fallback_used: Boolean(prep.fallback_used || searchFailed),
    };
  }

  function shouldDeliverToTalk(card, options) {
    if (options?.skipNotify) return false;
    if (options?.forceNotify === true) return true;
    if (card?.searchFailed && options?.forceNotifyOnSearchFail !== false) return true;
    const imp = String(card?.importance || "medium").toLowerCase();
    return imp === "high" || imp === "medium";
  }

  async function runSearchForCategory(category) {
    const Orchestrator = global.TasuAiSearchOrchestrator;
    const Serper = global.TasuSerperSearchService;
    const query = category.searchQuery;

    try {
      if (Orchestrator?.prepare) {
        const prep = await Orchestrator.prepare({
          userText: query,
          modeId: "ops-watch",
          forceSearch: true,
          skipLog: true,
        });
        return normalizeSearchPrep(category, prep);
      }

      const searchRes = Serper?.search
        ? await Serper.search(query)
        : { ok: false, results: [], query, provider: "serper", message: "no_serper" };
      return normalizeSearchPrep(category, {
        searchUsed: Boolean(searchRes.ok && searchRes.results?.length),
        searchQuery: searchRes.query || query,
        searchProvider: searchRes.provider || "serper",
        searchResultCount: (searchRes.results || []).length,
        results: searchRes.results || [],
        fallback_used: !searchRes.ok,
        searchFailed: !searchRes.ok,
        searchMessage: searchRes.message || "",
      });
    } catch (err) {
      console.warn("[TasuOpsWatch] runSearchForCategory failed:", err);
      return normalizeSearchPrep(category, {
        results: [],
        searchUsed: false,
        searchQuery: query,
        searchFailed: true,
        searchMessage: pickStr(err?.message) || "search_exception",
        fallback_used: true,
      });
    }
  }

  function buildWatchCard(category, prep, analysis) {
    const Store = global.TasuOpsWatchStore;
    const sources = (prep?.results || []).slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
    }));

    const ensured =
      global.TasuOpsWatchAnalyzer?.ensureReportQuality?.(analysis, category, prep) || analysis;

    const card = Store.normalizeCard({
      categoryId: category.id,
      categoryLabel: category.label,
      headline: pickStr(ensured.headline) || `${category.label} 監視`,
      summary: ensured.summary,
      importance: ensured.importance,
      tasfulImpact: ensured.tasfulImpact,
      recommendedAction: ensured.recommendedAction,
      introductionProposal: ensured.introductionProposal,
      isNewService: ensured.isNewService,
      newServiceName: ensured.newServiceName,
      searchQuery: prep.searchQuery || category.searchQuery,
      searchUsed: Boolean(prep.searchUsed),
      searchFailed: Boolean(prep.searchFailed),
      searchResultCount: prep.searchResultCount || sources.length,
      sources,
      analyzerProvider: ensured.analyzerProvider || ensured.analysisSource || "template",
      analysisSource: ensured.analysisSource || ensured.analyzerProvider || "template",
      createdAt: new Date().toISOString(),
    });

    card.fingerprint = Store.fingerprintForCard(card);
    if (prep.searchFailed) {
      card.fingerprint = `${card.fingerprint}-search-fail-${Date.now()}`;
    }
    return card;
  }

  async function analyzeCategory(category, prep) {
    const Analyzer = global.TasuOpsWatchAnalyzer;
    try {
      if (Analyzer?.analyze) return await Analyzer.analyze(category, prep);
    } catch (err) {
      console.warn("[TasuOpsWatch] analyze failed:", err);
    }
    if (prep.searchFailed && Analyzer?.analyzeSearchFailure) {
      return Analyzer.analyzeSearchFailure(category, prep);
    }
    const fallback = {
      headline: `${category.label} 監視`,
      summary: "分析を完了できませんでした。",
      importance: "low",
      tasfulImpact: "",
      recommendedAction: "",
      analysisSource: "template",
    };
    return (
      global.TasuOpsWatchAnalyzer?.ensureReportQuality?.(fallback, category, prep) || {
        ...fallback,
        tasfulImpact:
          category.tasfulRelevance ||
          "現時点でTASFULへの直接的な影響は確認されていません。",
        recommendedAction: "監視継続",
      }
    );
  }

  async function deliverCard(card, options) {
    const Store = global.TasuOpsWatchStore;
    const Notify = global.TasuTalkOpsWatchNotify;

    if (!shouldDeliverToTalk(card, options)) {
      return { skipped: true, reason: "low_importance_card_only", card };
    }

    const fp = card.fingerprint;
    const dedupeHours =
      options?.dedupeHours !== undefined
        ? options.dedupeHours
        : options?.forceNotify
          ? 0
          : Store.DEFAULT_DEDUPE_HOURS;

    if (!options?.forceNotify && Store.wasNotifiedRecently(fp, dedupeHours)) {
      return { skipped: true, reason: "dedupe", fingerprint: fp, card };
    }

    if (Notify?.deliverOpsWatchCard) {
      const notifyResult = Notify.deliverOpsWatchCard(card, options);
      if (!notifyResult.skipped) Store.markNotified(fp);
      return notifyResult;
    }
    return { skipped: true, reason: "no_notify_sink", card };
  }

  /**
   * @param {string} categoryId
   * @param {object} [options]
   */
  async function runCategory(categoryId, options) {
    const Cats = global.TasuOpsWatchCategories;
    const Store = global.TasuOpsWatchStore;
    const category = Cats?.getCategory?.(categoryId);

    if (!category) {
      return { ok: false, reason: "unknown_category", categoryId, error: "unknown_category" };
    }

    try {
      const prep = await runSearchForCategory(category);
      const analysis = await analyzeCategory(category, prep);
      const card = buildWatchCard(category, prep, analysis);
      Store.upsertCard(card);

      const notifyOptions = {
        ...options,
        forceNotify:
          options?.forceNotify === true ||
          (prep.searchFailed &&
            options?.forceNotifyOnSearchFail !== false &&
            String(card.importance).toLowerCase() !== "low"),
      };

      const notifyResult = await deliverCard(card, notifyOptions);

      Store.recordCategoryRun(category.id, {
        importance: card.importance,
        searchUsed: card.searchUsed,
        searchResultCount: card.searchResultCount,
        searchFailed: prep.searchFailed,
        notified: !notifyResult.skipped,
        talkSkippedReason: notifyResult.reason || "",
      });

      return {
        ok: true,
        phase: PHASE,
        categoryId: category.id,
        card,
        search: {
          used: prep.searchUsed,
          failed: prep.searchFailed,
          query: prep.searchQuery,
          resultCount: prep.searchResultCount,
          message: prep.searchMessage || "",
          fallback_used: prep.fallback_used,
        },
        notify: notifyResult,
      };
    } catch (err) {
      console.warn("[TasuOpsWatch] runCategory error:", err);
      const errMsg = pickStr(err?.message) || "run_category_exception";
      try {
        const prep = normalizeSearchPrep(category, {
          searchFailed: true,
          searchMessage: errMsg,
          results: [],
        });
        const analysis = await analyzeCategory(category, prep);
        const card = buildWatchCard(category, prep, analysis);
        Store.upsertCard(card);
        const notifyResult = await deliverCard(card, {
          ...options,
          forceNotify: String(card.importance).toLowerCase() !== "low",
        });
        return {
          ok: true,
          phase: PHASE,
          categoryId: category.id,
          card,
          search: { used: false, failed: true, message: errMsg },
          notify: notifyResult,
          recoveredFromError: true,
          error: errMsg,
        };
      } catch (inner) {
        return {
          ok: false,
          phase: PHASE,
          categoryId: category.id,
          error: errMsg,
          fatal: pickStr(inner?.message) || "recovery_failed",
        };
      }
    }
  }

  /**
   * @param {object} [options]
   */
  async function runAll(options) {
    const ids =
      Array.isArray(options?.categoryIds) && options.categoryIds.length
        ? options.categoryIds
        : global.TasuOpsWatchCategories?.listCategories?.().map((c) => c.id) || [];

    const results = [];
    for (const id of ids) {
      try {
        results.push(await runCategory(id, options));
      } catch (err) {
        results.push({
          ok: false,
          categoryId: id,
          error: pickStr(err?.message) || "run_category_throw",
        });
      }
    }

    const Daily = global.TasuOpsWatchDaily;
    const stats = Daily?.aggregateRunResults
      ? Daily.aggregateRunResults(results)
      : {
          categoriesRun: results.length,
          talkNotifications: results.filter((r) => r.notify && !r.notify.skipped).length,
        };

    let summaryBody = Daily?.formatDailySummaryBody?.(stats) || "";
    let summaryNotify = null;
    if (options?.dailyRun && global.TasuTalkOpsWatchNotify?.deliverDailySummary) {
      summaryNotify = global.TasuTalkOpsWatchNotify.deliverDailySummary({
        stats,
        body: summaryBody,
        runAt: new Date().toISOString(),
      });
    }

    const okCount = results.filter((r) => r.ok).length;

    return {
      ok: okCount > 0,
      phase: PHASE,
      total: results.length,
      okCount,
      failedCount: results.length - okCount,
      notified: stats.talkNotifications,
      searchFailed: stats.searchFailed,
      stats,
      summaryBody,
      summaryNotify,
      results,
    };
  }

  function listCards() {
    return global.TasuOpsWatchStore?.readCards?.() || [];
  }

  function getCard(id) {
    return global.TasuOpsWatchStore?.getCard?.(id) || null;
  }

  function clearForTests() {
    global.TasuOpsWatchStore?.clearForTests?.();
    try {
      global.localStorage?.removeItem(global.TasuOpsWatchDaily?.LAST_AUTO_RUN_KEY);
    } catch {
      /* ignore */
    }
  }

  global.TasuOpsWatch = {
    PHASE,
    runCategory,
    runAll,
    listCards,
    getCard,
    runSearchForCategory,
    buildWatchCard,
    normalizeSearchPrep,
    shouldDeliverToTalk,
    deliverCard,
    clearForTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
