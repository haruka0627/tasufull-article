/**
 * TASFUL OPS WATCH — TASFUL TALK 通知カード配信（コンパクト本文・24h集約）
 */
(function (global) {
  "use strict";

  const NOTIFY_TARGET = "talk-home.html?tab=notify";
  const SOURCE = "ops_watch";
  const SECTION_MAX = 100;
  const AGGREGATE_MS = 24 * 60 * 60 * 1000;

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  const IMPORTANCE_LABEL = {
    high: "高",
    medium: "中",
    low: "低",
  };

  const IMPORTANCE_RANK = { high: 3, medium: 2, low: 1 };

  function priorityFromImportance(importance) {
    const imp = String(importance || "medium").toLowerCase();
    if (imp === "high") return "important";
    if (imp === "low") return "normal";
    return "important";
  }

  function truncateText(text, max) {
    const limit = Number(max) > 0 ? Number(max) : SECTION_MAX;
    const s = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!s) return "";
    if (s.length <= limit) return s;
    return `${s.slice(0, limit - 1)}…`;
  }

  function ensureCardReportFields(card) {
    const row = card || {};
    const category =
      global.TasuOpsWatchCategories?.getCategory?.(row.categoryId) || {
        id: row.categoryId,
        label: pickStr(row.categoryLabel) || "監視",
        tasfulRelevance: "",
      };
    const Analyzer = global.TasuOpsWatchAnalyzer;
    if (Analyzer?.ensureReportQuality) {
      return Analyzer.ensureReportQuality(row, category, { results: row.sources || [] });
    }
    const fb = Analyzer?.REPORT_FALLBACK || {};
    return {
      ...row,
      summary: pickStr(row.summary) || fb.summary || "情報を取得しましたが、要約を生成できませんでした。",
      tasfulImpact:
        pickStr(row.tasfulImpact) ||
        fb.tasfulImpact ||
        "現時点でTASFULへの直接的な影響は確認されていません。",
      recommendedAction: pickStr(row.recommendedAction) || fb.recommendedAction || "監視継続",
    };
  }

  function normalizeImportance(importance) {
    const imp = String(importance || "medium").toLowerCase();
    return IMPORTANCE_RANK[imp] ? imp : "medium";
  }

  function maxImportance(a, b) {
    const ia = normalizeImportance(a);
    const ib = normalizeImportance(b);
    return (IMPORTANCE_RANK[ia] || 2) >= (IMPORTANCE_RANK[ib] || 2) ? ia : ib;
  }

  function importanceLabel(importance) {
    const imp = normalizeImportance(importance);
    return IMPORTANCE_LABEL[imp] || imp;
  }

  function formatAnalysisSourceLine(card) {
    const src = String(card.analysisSource || card.analyzerProvider || "template").toLowerCase();
    const label = src === "ai" ? "AI" : "template fallback";
    return `analysis: ${label}`;
  }

  /**
   * 通知一覧用コンパクト本文
   * @param {object} card
   * @param {{ articleCount?: number, aggregated?: boolean }} [opts]
   */
  function formatCompactNotificationBody(card, opts) {
    const ensured = ensureCardReportFields(card);
    const imp = importanceLabel(ensured.importance);
    const count = Math.max(
      0,
      Number(opts?.articleCount ?? ensured.searchResultCount ?? ensured.sources?.length ?? 0)
    );
    const lines = ["【OPS WATCH】", "", imp];
    if (opts?.aggregated === true && count > 0) {
      lines.push("", `検出記事数: ${count}件`);
    } else if (count > 1) {
      lines.push("", `検出記事数: ${count}件`);
    }
    lines.push(
      "",
      "■概要",
      truncateText(ensured.summary) || ensured.summary,
      "",
      "■TASFULへの影響",
      truncateText(ensured.tasfulImpact) || ensured.tasfulImpact,
      "",
      "■推奨アクション",
      truncateText(ensured.recommendedAction) || ensured.recommendedAction,
      "",
      "詳細は別画面またはモーダル"
    );
    return lines.join("\n");
  }

  /** @deprecated 互換用 — コンパクト本文へ委譲 */
  function formatNotificationBody(card, opts) {
    return formatCompactNotificationBody(card, opts);
  }

  function buildOpsWatchDetail(card) {
    const row = ensureCardReportFields(card || {});
    return {
      analysisSource: formatAnalysisSourceLine(row).replace(/^analysis:\s*/i, ""),
      summary: pickStr(row.summary),
      tasfulImpact: pickStr(row.tasfulImpact),
      recommendedAction: pickStr(row.recommendedAction),
      introductionProposal: pickStr(row.introductionProposal) || "",
      sources: Array.isArray(row.sources) ? row.sources : [],
      searchResultCount: Number(row.searchResultCount) || 0,
      searchUsed: row.searchUsed === true,
      searchFailed: Boolean(row.searchFailed),
      categoryId: pickStr(row.categoryId),
      categoryLabel: pickStr(row.categoryLabel),
      headline: pickStr(row.headline),
      importance: normalizeImportance(row.importance),
      isNewService: Boolean(row.isNewService),
      newServiceName: pickStr(row.newServiceName) || "",
    };
  }

  function buildNotificationTitle(card, articleCount) {
    const count = Number(articleCount) || 0;
    if (count > 1) {
      const imp = normalizeImportance(card.importance);
      const prefix = imp === "high" ? "【重要】" : "";
      return `${prefix}${pickStr(card.categoryLabel) || "監視"}`.slice(0, 120);
    }
    const imp = normalizeImportance(card.importance);
    let prefix = "";
    if (imp === "high") prefix = "【重要】";
    else if (card.isNewService) prefix = "【新規】";
    return `${prefix}${pickStr(card.headline) || `${card.categoryLabel} 監視レポート`}`.slice(
      0,
      120
    );
  }

  function readNotifications() {
    if (typeof global.TasuTalkNotifications?.getAll === "function") {
      return global.TasuTalkNotifications.getAll();
    }
    if (typeof global.TasuTalkData?.getNotifications === "function") {
      return global.TasuTalkData.getNotifications({ filter: "all", applySettings: false });
    }
    return [];
  }

  function isOpsWatchRow(n) {
    return String(n?.source || "").toLowerCase() === SOURCE;
  }

  function withinAggregateWindow(n, now) {
    const t = Date.parse(String(n?.updatedAt || n?.createdAt || ""));
    return Number.isFinite(t) && now - t < AGGREGATE_MS;
  }

  function findCategoryAggregateNotification(categoryId) {
    const cid = pickStr(categoryId);
    if (!cid) return null;
    const now = Date.now();
    return (
      readNotifications().find(
        (n) =>
          isOpsWatchRow(n) &&
          String(n.opsWatchKind || "") === "category" &&
          String(n.opsWatchCategoryId || "") === cid &&
          !n.hiddenAt &&
          withinAggregateWindow(n, now)
      ) || null
    );
  }

  function findDailySummaryNotification() {
    const now = Date.now();
    return (
      readNotifications().find(
        (n) =>
          isOpsWatchRow(n) &&
          (n.opsWatchKind === "daily_summary" || String(n.title || "").includes("日次サマリー")) &&
          !n.hiddenAt &&
          withinAggregateWindow(n, now)
      ) || null
    );
  }

  function uniqueCardIds(ids, nextId) {
    const out = [];
    (Array.isArray(ids) ? ids : []).forEach((id) => {
      const s = String(id || "").trim();
      if (s && !out.includes(s)) out.push(s);
    });
    const add = String(nextId || "").trim();
    if (add && !out.includes(add)) out.push(add);
    return out;
  }

  function countArticles(existingCount, card) {
    const add = Math.max(
      1,
      Number(card?.searchResultCount) || Number(card?.sources?.length) || 1
    );
    return Math.max(0, Number(existingCount) || 0) + add;
  }

  function pushNotification(input) {
    const Platform = global.TasuTalkPlatformNotify;
    if (Platform?.pushNotification) return Platform.pushNotification(input);
    if (global.TasuTalkNotifications?.add) return global.TasuTalkNotifications.add(input);
    return null;
  }

  function formatDailySummaryCompactBody(stats, fullBody) {
    const s = stats || {};
    const lines = [
      "【OPS WATCH】",
      "",
      (s.high || 0) > 0 ? "高" : "中",
      "",
      "■概要",
      truncateText(
        `日次実行 ${s.categoriesRun ?? 0}カテゴリ · 通知 ${s.talkNotifications ?? 0}件 · 重要 ${s.high ?? 0} / 中 ${s.medium ?? 0} / 低 ${s.low ?? 0}`
      ) ||
        `日次実行 ${s.categoriesRun ?? 0}カテゴリ · 通知 ${s.talkNotifications ?? 0}件`,
      "",
      "■TASFULへの影響",
      truncateText(
        (s.newServiceCandidates || 0) > 0
          ? `新規導入候補 ${s.newServiceCandidates}件。要確認。`
          : "本日の重大変更はサマリー内の件数を確認してください。"
      ) || "現時点でTASFULへの直接的な影響は確認されていません。",
      "",
      "■推奨アクション",
      truncateText(
        (s.searchFailed || 0) > 0
          ? `検索失敗 ${s.searchFailed}件あり。OPS WATCH 管理画面で再実行を検討。`
          : "各カテゴリ通知の詳細モーダルで差分を確認。"
      ) || "監視継続",
      "",
      "詳細は別画面またはモーダル",
    ];
    if (fullBody) {
      lines.push("", "---", String(fullBody).slice(0, 800));
    }
    return lines.join("\n");
  }

  /**
   * 日次サマリー通知（24h以内は1件に更新・最上位ピン）
   * @param {{ stats?: object, body?: string, runAt?: string }} payload
   */
  function deliverDailySummary(payload) {
    const stats = payload?.stats || {};
    const fullBody =
      pickStr(payload?.body) ||
      (global.TasuOpsWatchDaily?.formatDailySummaryBody
        ? global.TasuOpsWatchDaily.formatDailySummaryBody(stats)
        : "【OPS WATCH 日次サマリー】");
    const body = formatDailySummaryCompactBody(stats, fullBody);

    if (
      !global.TasuTalkPlatformNotify?.pushNotification &&
      !global.TasuTalkNotifications?.add
    ) {
      return { skipped: true, reason: "no_notify_sink" };
    }

    const existing = findDailySummaryNotification();
    const now = new Date().toISOString();
    const notification = pushNotification({
      id: existing?.id,
      type: "system",
      title: "【OPS WATCH 日次サマリー】",
      body,
      targetUrl: NOTIFY_TARGET,
      priority: (stats.high || 0) > 0 ? "important" : "normal",
      source: SOURCE,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      readAt: existing?.readAt || null,
      opsWatchKind: "daily_summary",
      opsWatchPinned: true,
      opsWatchImportance: (stats.high || 0) > 0 ? "high" : "medium",
      opsWatchDetail: { kind: "daily_summary", stats, fullBody },
    });

    try {
      global.dispatchEvent(
        new CustomEvent("tasu:ops-watch-daily-summary", {
          detail: { notification, stats },
        })
      );
    } catch {
      /* ignore */
    }

    return { notification, skipped: false, stats, aggregated: Boolean(existing) };
  }

  /**
   * @param {object} card — TasuOpsWatchStore 正規化済みカード
   * @returns {{ notification: object|null, card: object|null, skipped?: boolean, reason?: string, aggregated?: boolean }}
   */
  function deliverOpsWatchCard(card, options) {
    const imp = normalizeImportance(card?.importance);
    if (imp === "low" && options?.forceNotify !== true) {
      return { notification: null, card, skipped: true, reason: "low_importance" };
    }
    const Store = global.TasuOpsWatchStore;
    const row = Store?.normalizeCard?.(card) || card;
    if (!row?.id) return { notification: null, card: null, skipped: true, reason: "invalid_card" };

    if (
      !global.TasuTalkPlatformNotify?.pushNotification &&
      !global.TasuTalkNotifications?.add
    ) {
      return { notification: null, card: row, skipped: true, reason: "no_notify_sink" };
    }

    const existing = findCategoryAggregateNotification(row.categoryId);
    const now = new Date().toISOString();
    const cardIds = uniqueCardIds(existing?.opsWatchCardIds, row.id);
    const articleCount = countArticles(existing?.opsWatchArticleCount, row);
    const mergedImportance = existing
      ? maxImportance(existing.opsWatchImportance, row.importance)
      : imp;
    const mergedCard = ensureCardReportFields({ ...row, importance: mergedImportance });
    const aggregated = cardIds.length > 1;
    const body = formatCompactNotificationBody(mergedCard, {
      articleCount,
      aggregated,
    });

    const notification = pushNotification({
      id: existing?.id,
      type: "system",
      title: buildNotificationTitle(mergedCard, articleCount),
      body,
      targetUrl: NOTIFY_TARGET,
      priority: priorityFromImportance(mergedImportance),
      source: SOURCE,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      readAt: existing?.readAt || null,
      opsWatchKind: "category",
      opsWatchCategoryId: row.categoryId,
      opsWatchImportance: mergedImportance,
      opsWatchCardIds: cardIds,
      opsWatchArticleCount: articleCount,
      opsWatchDetail: buildOpsWatchDetail(mergedCard),
      opsWatchPinned: false,
    });

    const notifiedAt = now;
    const linked = {
      ...row,
      notificationId: pickStr(notification?.id, row.notificationId),
      notifiedAt,
    };
    Store?.upsertCard?.(linked);

    try {
      global.dispatchEvent(
        new CustomEvent("tasu:ops-watch-notified", {
          detail: { card: linked, notification, aggregated },
        })
      );
    } catch {
      /* ignore */
    }

    return { notification, card: linked, skipped: false, aggregated };
  }

  global.TasuTalkOpsWatchNotify = {
    NOTIFY_TARGET,
    SOURCE,
    SECTION_MAX,
    AGGREGATE_MS,
    truncateText,
    formatCompactNotificationBody,
    formatNotificationBody,
    buildOpsWatchDetail,
    buildNotificationTitle,
    priorityFromImportance,
    findCategoryAggregateNotification,
    deliverOpsWatchCard,
    deliverDailySummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
