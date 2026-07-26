/**
 * TASFUL Page Gen — deterministic quality score and review policy.
 *
 * Scores are explainable heuristics, not business outcomes. They prepare the
 * contract for a future UI while the one-pass AI review uses concrete issues.
 */
(function (global) {
  "use strict";

  function B() {
    return global.TasuPageGenBlocks;
  }

  const REVIEW_LIMIT = 1;
  const AUTO_IMPROVE_THRESHOLD = 85;
  const dimensions = new Map();

  function clamp(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function block(doc, type) {
    return (doc?.blocks || []).find((item) => item.type === type && item.visible !== false);
  }

  function textLength(doc) {
    return (doc?.blocks || []).reduce((sum, item) => {
      if (item.visible === false) return sum;
      return (
        sum +
        B()
          .textPaths(item.type)
          .reduce((subtotal, path) => subtotal + String(item.props?.[path] || "").length, 0)
      );
    }, 0);
  }

  function scoreSeo(doc, issues) {
    let score = 0;
    if (doc?.seo?.title) score += 30;
    else issues.push({ code: "seo_title_missing", dimension: "seo", message: "SEOタイトルを追加してください" });
    if (doc?.seo?.description) score += 30;
    else issues.push({ code: "seo_description_missing", dimension: "seo", message: "meta descriptionを追加してください" });
    if (doc?.seo?.og?.title && doc?.seo?.og?.description) score += 15;
    if (doc?.structured_data && Object.keys(doc.structured_data).length) score += 15;
    if ((doc?.internal_links || []).length) score += 10;
    return clamp(score);
  }

  function scoreReadability(doc, issues) {
    const about = String(block(doc, "about")?.props?.body || "");
    const sentences = about.split(/[。！？\n]/).map((s) => s.trim()).filter(Boolean);
    const average = sentences.length ? about.length / sentences.length : 0;
    let score = about.length >= 80 ? 55 : about.length ? 30 : 0;
    if (average > 0 && average <= 80) score += 30;
    else if (average > 80) issues.push({ code: "sentence_too_long", dimension: "readability", message: "文章を短く区切って読みやすくしてください" });
    if (block(doc, "faq")?.props?.items?.length >= 2) score += 15;
    return clamp(score);
  }

  function scoreCta(doc, issues) {
    const primary = doc?.actions?.primary;
    let score = 0;
    if (primary?.kind) score += 35;
    else issues.push({ code: "cta_missing", dimension: "cta", message: "主要CTAを設定してください", critical: true });
    const def = global.TasuPageGenActions?.getActionKind(primary?.kind);
    if (def?.allowGenerated && def?.tasfulFlow) score += 45;
    else if (primary) issues.push({ code: "cta_not_internal", dimension: "cta", message: "CTAをTASFUL内部フローへ接続してください", critical: true });
    if (block(doc, "cta")?.props?.label || primary?.label) score += 20;
    return clamp(score);
  }

  function scoreCompleteness(doc, issues) {
    let score = 0;
    if (doc?.profile?.name) score += 15;
    if (doc?.profile?.summary) score += 15;
    if (textLength(doc) >= 120) score += 25;
    else issues.push({ code: "content_thin", dimension: "completeness", message: "本文の情報量を増やしてください" });
    if (block(doc, "services")?.props?.items?.length || doc?.service_type) score += 15;
    if (block(doc, "faq")?.props?.items?.length >= 2) score += 15;
    if ((doc?.media_plan || []).length) score += 15;
    else issues.push({ code: "media_plan_missing", dimension: "completeness", message: "画像構成とALT案を追加してください" });
    return clamp(score);
  }

  function scoreConversion(doc, issues) {
    let score = scoreCta(doc, issues) * 0.6;
    if (doc?.conversion?.outcome) score += 20;
    else issues.push({ code: "outcome_missing", dimension: "conversion", message: "ページの成果目標を設定してください" });
    if ((doc?.internal_links || []).length) score += 20;
    else issues.push({ code: "internal_links_missing", dimension: "conversion", message: "関連するTASFUL内導線を追加してください" });
    return clamp(score);
  }

  function registerDimension(def) {
    const id = String(def?.id || "").trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(id)) throw new Error("quality dimension id required");
    if (typeof def.score !== "function") throw new Error(`quality dimension ${id} requires score`);
    const weight = Number(def.weight);
    dimensions.set(id, {
      id,
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      score: def.score,
    });
    return dimensions.get(id);
  }

  function listDimensions() {
    return Array.from(dimensions.values()).map(({ id, weight }) => ({ id, weight }));
  }

  registerDimension({ id: "seo", weight: 0.2, score: scoreSeo });
  registerDimension({ id: "readability", weight: 0.15, score: scoreReadability });
  registerDimension({ id: "cta", weight: 0.25, score: (doc) => scoreCta(doc, []) });
  registerDimension({ id: "completeness", weight: 0.2, score: scoreCompleteness });
  registerDimension({ id: "conversion", weight: 0.2, score: scoreConversion });

  function evaluate(doc) {
    const issues = [];
    const scores = {};
    let weighted = 0;
    let totalWeight = 0;
    dimensions.forEach((dimension) => {
      scores[dimension.id] = clamp(dimension.score(doc, issues));
      weighted += scores[dimension.id] * dimension.weight;
      totalWeight += dimension.weight;
    });
    const overall = clamp(totalWeight ? weighted / totalWeight : 0);
    return {
      scores,
      overall,
      issues,
      publish_ready: !issues.some((issue) => issue.critical),
    };
  }

  function apply(doc) {
    const previous = doc.quality || {};
    const result = evaluate(doc);
    doc.quality = {
      ...result,
      review_status: previous.review_status || "pending",
      review_attempts: Number(previous.review_attempts || 0),
      reviewed_at: previous.reviewed_at || null,
    };
    if (result.overall >= AUTO_IMPROVE_THRESHOLD && !result.issues.length) {
      doc.quality.review_status = "not_needed";
    }
    return doc.quality;
  }

  function needsAutoImprove(doc) {
    const quality = doc?.quality || apply(doc);
    return (
      quality.review_attempts < REVIEW_LIMIT &&
      quality.review_status === "pending" &&
      (quality.overall < AUTO_IMPROVE_THRESHOLD || quality.issues.length > 0)
    );
  }

  function markReviewed(doc) {
    const quality = apply(doc);
    quality.review_attempts = Math.min(REVIEW_LIMIT, Number(quality.review_attempts || 0) + 1);
    quality.review_status = "improved";
    quality.reviewed_at = new Date().toISOString();
    return quality;
  }

  global.TasuPageGenQuality = {
    REVIEW_LIMIT,
    AUTO_IMPROVE_THRESHOLD,
    registerDimension,
    listDimensions,
    evaluate,
    apply,
    needsAutoImprove,
    markReviewed,
  };
})(typeof window !== "undefined" ? window : globalThis);
