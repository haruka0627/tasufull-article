/**
 * Platform — AIおすすめスコア・短い理由（🏅 AIおすすめ）
 * Platform専用AIは作らず、表示・入口のみ。詳細相談は TASFUL AI へ。
 */
(function (global) {
  "use strict";

  const WEIGHTS = Object.freeze({
    rating: 25,
    replySpeed: 15,
    verified: 15,
    license: 12,
    area: 15,
    trackRecord: 10,
    popular: 10,
    price: 10,
    aiScore: 8,
  });

  const REASON_LABELS = Object.freeze({
    area: "ご希望地域",
    budget: "ご予算内",
    rating: "高評価",
    verified: "本人確認済",
    license: "資格確認済",
    reply: "返信速度が速い",
    popular: "人気",
    instant: "即対応",
    nearby: "近く",
  });

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function pickArea(listing, ctx) {
    return (
      listing?.area ||
      listing?.service_area ||
      listing?.worker_area ||
      listing?.prefecture ||
      ctx?.area ||
      ""
    );
  }

  function scoreListing(listing, ctx) {
    const reasons = [];
    let score = 0;

    const rating = num(listing?.review_average ?? listing?.rating, 0);
    if (rating >= 4.3) {
      score += WEIGHTS.rating;
      reasons.push({ key: "rating", text: REASON_LABELS.rating });
    }

    const replyMin = num(listing?.reply_minutes ?? listing?.avg_reply_minutes, NaN);
    if (Number.isFinite(replyMin) && replyMin <= 60) {
      score += WEIGHTS.replySpeed;
      reasons.push({ key: "reply", text: REASON_LABELS.reply });
    }

    if (listing?.identity_verified || listing?.kyc_verified || listing?.verified) {
      score += WEIGHTS.verified;
      reasons.push({ key: "verified", text: REASON_LABELS.verified });
    }

    if (listing?.license_verified || listing?.has_license || /資格|許可/.test(String(listing?.badges || ""))) {
      score += WEIGHTS.license;
      reasons.push({ key: "license", text: REASON_LABELS.license });
    }

    const area = pickArea(listing, ctx);
    const wantArea = String(ctx?.area || "").trim();
    if (wantArea && area && String(area).includes(wantArea)) {
      score += WEIGHTS.area;
      reasons.push({ key: "area", text: REASON_LABELS.area });
    }

    const deals = num(listing?.deals_count ?? listing?.popular, 0);
    if (deals >= 10) {
      score += WEIGHTS.trackRecord;
      reasons.push({ key: "popular", text: REASON_LABELS.popular });
    }

    const budget = num(ctx?.budgetMax, NaN);
    const price = num(listing?.price ?? listing?.price_amount, NaN);
    if (Number.isFinite(budget) && Number.isFinite(price) && price <= budget) {
      score += WEIGHTS.price;
      reasons.push({ key: "budget", text: REASON_LABELS.budget });
    }

    if (/即|instant|sameDay/i.test(String(listing?.availability || listing?.speed || ""))) {
      reasons.push({ key: "instant", text: REASON_LABELS.instant });
      score += 5;
    }

    score += Math.min(WEIGHTS.aiScore, Math.round(rating * 1.5));

    return { score, reasons: dedupeReasons(reasons).slice(0, 5) };
  }

  function dedupeReasons(reasons) {
    const seen = new Set();
    return reasons.filter((r) => {
      if (seen.has(r.key)) return false;
      seen.add(r.key);
      return true;
    });
  }

  function isRecommended(listing, ctx, threshold) {
    const min = Number.isFinite(threshold) ? threshold : 35;
    return scoreListing(listing, ctx).score >= min;
  }

  function formatReasons(reasons) {
    return (reasons || []).map((r) => `✓ ${r.text}`);
  }

  function rankListings(listings, ctx) {
    return (listings || [])
      .map((listing) => {
        const { score, reasons } = scoreListing(listing, ctx);
        return { listing, score, reasons, recommended: score >= 35 };
      })
      .sort((a, b) => b.score - a.score);
  }

  global.TasuPlatformAiRecommend = {
    WEIGHTS,
    REASON_LABELS,
    scoreListing,
    isRecommended,
    formatReasons,
    rankListings,
  };
})(typeof window !== "undefined" ? window : globalThis);
