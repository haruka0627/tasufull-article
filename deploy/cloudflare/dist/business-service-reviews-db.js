/**
 * 業務サービス取引レビュー（localStorage）
 */
(function () {
  "use strict";

  const LOCAL_KEY = "tasu_business_service_reviews_v1";
  const MAX_REVIEWS = 2000;

  function nowIso() {
    return new Date().toISOString();
  }

  function loadRaw() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveRaw(list) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, MAX_REVIEWS)));
    } catch (err) {
      console.warn("[BusinessServiceReviews] save failed:", err);
    }
  }

  function clampRating(value) {
    const n = Math.round(Number(value) || 0);
    if (n < 1 || n > 5) return null;
    return n;
  }

  function mapRow(row) {
    if (!row || typeof row !== "object") return null;
    const rating = clampRating(row.rating);
    if (rating == null) return null;
    return {
      id: String(row.id || ""),
      deal_id: String(row.deal_id || ""),
      service_id: String(row.service_id || ""),
      provider_id: String(row.provider_id || ""),
      client_id: String(row.client_id || ""),
      rating,
      comment: String(row.comment ?? "").trim(),
      created_at: row.created_at || nowIso(),
      updated_at: row.updated_at || row.created_at || nowIso(),
    };
  }

  function normalizePayload(payload, existing) {
    const rating = clampRating(payload?.rating ?? existing?.rating);
    if (rating == null) throw new Error("評価は1〜5で選択してください");
    return {
      deal_id: String(payload?.deal_id ?? existing?.deal_id ?? "").trim(),
      service_id: String(payload?.service_id ?? existing?.service_id ?? "").trim(),
      provider_id: String(payload?.provider_id ?? existing?.provider_id ?? "").trim(),
      client_id: String(payload?.client_id ?? existing?.client_id ?? "").trim(),
      rating,
      comment: String(payload?.comment ?? existing?.comment ?? "").trim(),
    };
  }

  function listReviews() {
    return loadRaw()
      .map(mapRow)
      .filter(Boolean)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function getReviewsByServiceId(serviceId) {
    const sid = String(serviceId || "").trim();
    if (!sid) return [];
    return listReviews().filter((r) => r.service_id === sid);
  }

  function getReviewsByProviderId(providerId) {
    const pid = String(providerId || "").trim();
    if (!pid) return [];
    return listReviews().filter((r) => r.provider_id === pid);
  }

  function getReviewByDealId(dealId) {
    const did = String(dealId || "").trim();
    if (!did) return null;
    const row = loadRaw().find((r) => String(r.deal_id) === did);
    return mapRow(row);
  }

  function createReview(payload) {
    const body = normalizePayload(payload);
    const gate = window.TasuPlatformContentGate?.applyReviewGate?.(body.comment);
    if (gate && !gate.ok) {
      throw new Error(gate.error || "レビュー内容に禁止事項が含まれています");
    }
    if (!body.deal_id) throw new Error("deal_id が必要です");
    if (!body.service_id) throw new Error("service_id が必要です");
    if (getReviewByDealId(body.deal_id)) {
      throw new Error("この取引にはすでにレビューが投稿されています");
    }

    const now = nowIso();
    const record = {
      id: `bsrev_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      ...body,
      created_at: now,
      updated_at: now,
    };
    const list = loadRaw();
    list.unshift(record);
    saveRaw(list);
    return mapRow(record);
  }

  function updateReview(id, patch) {
    const key = String(id || "").trim();
    if (!key) return null;
    const list = loadRaw();
    const idx = list.findIndex((r) => String(r.id) === key);
    if (idx < 0) return null;

    const existing = mapRow(list[idx]);
    const body = normalizePayload({ ...existing, ...(patch || {}) }, existing);
    const gate = window.TasuPlatformContentGate?.applyReviewGate?.(body.comment);
    if (gate && !gate.ok) {
      throw new Error(gate.error || "レビュー内容に禁止事項が含まれています");
    }
    const now = nowIso();
    list[idx] = {
      ...list[idx],
      ...body,
      id: key,
      created_at: list[idx].created_at || now,
      updated_at: now,
    };
    saveRaw(list);
    return mapRow(list[idx]);
  }

  function upsertReviewByDealId(dealId, payload) {
    const did = String(dealId || "").trim();
    if (!did) throw new Error("deal_id が必要です");
    const existing = getReviewByDealId(did);
    if (existing) {
      return updateReview(existing.id, { ...payload, deal_id: did });
    }
    return createReview({ ...payload, deal_id: did });
  }

  /**
   * @param {object[]} reviews
   */
  function summarizeReviews(reviews) {
    const list = (reviews || []).map(mapRow).filter(Boolean);
    const emptyBreakdown = [5, 4, 3, 2, 1].map((star) => ({ star, pct: 0 }));
    if (!list.length) {
      return { average: 0, count: 0, breakdown: emptyBreakdown };
    }
    const count = list.length;
    const sum = list.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / count) * 10) / 10;
    const breakdown = [5, 4, 3, 2, 1].map((star) => {
      const n = list.filter((r) => r.rating === star).length;
      return { star, pct: Math.round((n / count) * 100) };
    });
    return { average, count, breakdown };
  }

  function getServiceRatingStats(serviceId) {
    return summarizeReviews(getReviewsByServiceId(serviceId));
  }

  function getProviderRatingStats(providerId) {
    return summarizeReviews(getReviewsByProviderId(providerId));
  }

  function toDisplayCard(review) {
    const r = mapRow(review);
    if (!r) return null;
    const date = String(r.created_at || "").slice(0, 10) || "—";
    return {
      name: "ご利用者",
      rating: r.rating,
      text: r.comment || "（コメントなし）",
      date,
    };
  }

  /**
   * 詳細ページ reviews パネル用
   * @param {object[]} reviews
   */
  function buildShowcaseFromReviews(reviews) {
    const list = (reviews || []).map(mapRow).filter(Boolean);
    const stats = summarizeReviews(list);
    const cards = [...list]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(toDisplayCard)
      .filter(Boolean);
    return {
      average: stats.count > 0 ? stats.average : 0,
      count: stats.count,
      breakdown: stats.breakdown,
      cards,
    };
  }

  window.TasuBusinessServiceReviewsDb = {
    LOCAL_KEY,
    listReviews,
    getReviewsByServiceId,
    getReviewsByProviderId,
    getReviewByDealId,
    createReview,
    updateReview,
    upsertReviewByDealId,
    summarizeReviews,
    getServiceRatingStats,
    getProviderRatingStats,
    buildShowcaseFromReviews,
    toDisplayCard,
  };
})();
