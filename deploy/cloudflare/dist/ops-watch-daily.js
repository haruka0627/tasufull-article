/**
 * TASFUL OPS WATCH Phase2 — 日次実行ロジック（ブラウザ / Cron 共通）
 *
 * 将来: Supabase Edge Cron（例: 毎朝 9:00 JST）から
 *   runDailyOpsWatch({ watchApi, notifyApi, storage })
 * を呼び出す想定。DOM / window には依存しない。
 */
(function (global) {
  "use strict";

  const PHASE = "phase2";
  const LAST_AUTO_RUN_KEY = "tasu_ops_watch_last_auto_run_at";
  const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  /** @returns {{ getItem: (k:string)=>string|null, setItem: (k:string,v:string)=>void }} */
  function noopStorage() {
    return {
      getItem: () => null,
      setItem: () => {},
    };
  }

  function resolveStorage(storage) {
    if (storage && typeof storage.getItem === "function") return storage;
    if (typeof global.localStorage !== "undefined") {
      return {
        getItem: (k) => global.localStorage.getItem(k),
        setItem: (k, v) => global.localStorage.setItem(k, v),
      };
    }
    return noopStorage();
  }

  function resolveIntervalMs(options) {
    const test = global.__TASU_OPS_WATCH_TEST_INTERVAL_MS__;
    if (Number(test) > 0) return Number(test);
    return Number(options?.intervalMs) > 0 ? Number(options.intervalMs) : DEFAULT_INTERVAL_MS;
  }

  /**
   * 前回実行から interval 以上経過しているか
   * @param {number} [now]
   * @param {object} [storage]
   * @param {{ intervalMs?: number, force?: boolean }} [options]
   */
  function shouldRunDailyOpsWatch(now, storage, options) {
    if (options?.force === true) return true;
    const store = resolveStorage(storage);
    const at = pickStr(store.getItem(LAST_AUTO_RUN_KEY));
    if (!at) return true;
    const prev = new Date(at).getTime();
    if (!Number.isFinite(prev)) return true;
    const elapsed = (Number(now) > 0 ? Number(now) : Date.now()) - prev;
    return elapsed >= resolveIntervalMs(options);
  }

  /**
   * @param {string|number} [at] ISO string or timestamp
   * @param {object} [storage]
   */
  function markDailyOpsWatchRun(at, storage) {
    const store = resolveStorage(storage);
    const iso =
      typeof at === "number"
        ? new Date(at).toISOString()
        : pickStr(at) || new Date().toISOString();
    store.setItem(LAST_AUTO_RUN_KEY, iso);
    return iso;
  }

  function readLastAutoRunAt(storage) {
    return pickStr(resolveStorage(storage).getItem(LAST_AUTO_RUN_KEY)) || null;
  }

  function aggregateRunResults(results) {
    const list = Array.isArray(results) ? results : [];
    const stats = {
      categoriesRun: list.length,
      cardsSaved: 0,
      talkNotifications: 0,
      high: 0,
      medium: 0,
      low: 0,
      searchFailed: 0,
      newServiceCandidates: 0,
      failedCategories: [],
      lowCategoryLabels: [],
      categoryErrors: [],
    };

    list.forEach((r) => {
      if (!r?.ok) {
        stats.failedCategories.push(pickStr(r?.categoryId) || "unknown");
        if (pickStr(r?.error)) stats.categoryErrors.push(`${r.categoryId}: ${r.error}`);
        return;
      }
      const card = r.card || {};
      stats.cardsSaved += 1;
      const imp = String(card.importance || "medium").toLowerCase();
      if (imp === "high") stats.high += 1;
      else if (imp === "low") stats.low += 1;
      else stats.medium += 1;

      if (r.search?.failed) stats.searchFailed += 1;
      if (card.isNewService) stats.newServiceCandidates += 1;

      if (r.notify && !r.notify.skipped) stats.talkNotifications += 1;
      else if (imp === "low") stats.lowCategoryLabels.push(pickStr(card.categoryLabel, r.categoryId));
    });

    return stats;
  }

  function formatDailySummaryBody(stats) {
    const s = stats || {};
    const lines = [
      "【OPS WATCH 日次サマリー】",
      "",
      `実行カテゴリ: ${s.categoriesRun ?? 0}`,
      `通知生成: ${s.talkNotifications ?? 0}`,
      `重要: ${s.high ?? 0}`,
      `中: ${s.medium ?? 0}`,
      `低: ${s.low ?? 0}`,
      `検索失敗: ${s.searchFailed ?? 0}`,
      `新規導入候補: ${s.newServiceCandidates ?? 0}`,
    ];
    if (s.failedCategories?.length) {
      lines.push(`失敗カテゴリ: ${s.failedCategories.join(", ")}`);
    }
    if (s.lowCategoryLabels?.length) {
      lines.push(
        `低重要度（TALK未通知・カードのみ）: ${s.lowCategoryLabels.slice(0, 8).join("、")}${
          s.lowCategoryLabels.length > 8 ? ` 他${s.lowCategoryLabels.length - 8}件` : ""
        }`
      );
    }
    lines.push("", "※ 低重要度はストアに保存。詳細は各カテゴリ通知または OPS WATCH 管理から確認。");
    return lines.join("\n").slice(0, 1200);
  }

  /**
   * @param {{
   *   watchApi?: object,
   *   notifyApi?: object,
   *   storage?: object,
   *   now?: number,
   *   force?: boolean,
   *   skipMarkRun?: boolean,
   *   categoryIds?: string[],
   *   forceNotify?: boolean,
   * }} [options]
   */
  async function runDailyOpsWatch(options) {
    const Watch = options?.watchApi || global.TasuOpsWatch;
    const Notify = options?.notifyApi || global.TasuTalkOpsWatchNotify;
    if (!Watch?.runAll) {
      return { ok: false, reason: "no_watch_api", phase: PHASE };
    }

    const e2eIds = global.__OPS_WATCH_E2E_CATEGORY_IDS__;
    const runOptions = {
      dailyRun: true,
      categoryIds:
        options?.categoryIds ||
        (Array.isArray(e2eIds) && e2eIds.length ? e2eIds : undefined),
      forceNotify: options?.forceNotify === true,
      dedupeHours: options?.forceNotify ? 0 : undefined,
    };

    const batch = await Watch.runAll(runOptions);
    const stats = batch?.stats || aggregateRunResults(batch?.results);
    const summaryBody = batch?.summaryBody || formatDailySummaryBody(stats);
    const summaryNotify = batch?.summaryNotify || null;

    if (!options?.skipMarkRun) {
      markDailyOpsWatchRun(options?.now || Date.now(), options?.storage);
    }

    return {
      ok: batch?.ok !== false,
      phase: PHASE,
      ranAt: new Date().toISOString(),
      batch,
      stats,
      summaryBody,
      summaryNotify,
    };
  }

  /**
   * 自動実行判定のみ（実行しない）
   */
  function evaluateAutoRun(storage, options) {
    const now = Number(options?.now) > 0 ? Number(options.now) : Date.now();
    const should = shouldRunDailyOpsWatch(now, storage, options);
    return {
      shouldRun: should,
      lastRunAt: readLastAutoRunAt(storage),
      intervalMs: resolveIntervalMs(options),
      now: new Date(now).toISOString(),
    };
  }

  global.TasuOpsWatchDaily = {
    PHASE,
    LAST_AUTO_RUN_KEY,
    DEFAULT_INTERVAL_MS,
    shouldRunDailyOpsWatch,
    markDailyOpsWatchRun,
    readLastAutoRunAt,
    runDailyOpsWatch,
    evaluateAutoRun,
    aggregateRunResults,
    formatDailySummaryBody,
    resolveStorage,
  };
})(typeof window !== "undefined" ? window : globalThis);
