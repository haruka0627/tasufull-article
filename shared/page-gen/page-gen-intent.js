/**
 * TASFUL Page Gen — entry intent routing (Phase 1 common engine)
 *
 * Single entry point for "○○のページを作りたい" from TASFUL AI.
 * Routing is deterministic and returns a descriptor only; each surface still
 * executes its own AI route afterwards (AD-002 · AD-003 unchanged).
 */
(function (global) {
  "use strict";

  function R() {
    return global.TasuPageGenRegistry;
  }

  const INTENT = Object.freeze({
    CREATE_PAGE: "create_page",
    EDIT_PAGE: "edit_page",
    PUBLISH_PAGE: "publish_page",
    UNKNOWN: "unknown",
  });

  const CREATE_PATTERNS = [
    /ページ.*(作|つく|生成|制作)/,
    /(ホームページ|hp|サイト|lp|ランディング).*(作|つく|欲|ほし)/i,
    /(掲載|出品|登録).*(したい|作)/,
  ];
  const EDIT_PATTERNS = [/ページ.*(修正|編集|直|変更|書き直)/, /(文章|説明|faq).*(直|変更|書き直)/i];
  const PUBLISH_PATTERNS = [/ページ.*(公開|出す|反映)/, /公開.*(したい|して)/];

  /** Keyword hints per surface. Extended by registering new surfaces + hints. */
  const surfaceHints = new Map([
    ["builder", ["工事", "塗装", "外壁", "リフォーム", "職人", "工務店", "建設", "施工", "業者"]],
    ["business_directory", ["店舗", "お店", "ショップ", "飲食", "美容", "サロン", "販売店", "掲載"]],
    ["platform", ["サービス", "出品", "スキル", "代行", "依頼", "商品"]],
  ]);

  function registerSurfaceHints(surfaceId, keywords) {
    const id = String(surfaceId || "");
    const current = surfaceHints.get(id) || [];
    surfaceHints.set(id, current.concat(Array.isArray(keywords) ? keywords : [keywords]).filter(Boolean));
    return surfaceHints.get(id);
  }

  function normalizeText(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim();
  }

  function detectIntent(text) {
    const s = normalizeText(text);
    if (!s) return { intent: INTENT.UNKNOWN, confidence: 0, text: s };
    if (PUBLISH_PATTERNS.some((re) => re.test(s))) {
      return { intent: INTENT.PUBLISH_PAGE, confidence: 0.8, text: s };
    }
    if (EDIT_PATTERNS.some((re) => re.test(s))) {
      return { intent: INTENT.EDIT_PAGE, confidence: 0.8, text: s };
    }
    if (CREATE_PATTERNS.some((re) => re.test(s))) {
      return { intent: INTENT.CREATE_PAGE, confidence: 0.9, text: s };
    }
    return { intent: INTENT.UNKNOWN, confidence: 0.2, text: s };
  }

  function scoreKeywords(text, keywords) {
    const s = String(text || "");
    let score = 0;
    const hits = [];
    (keywords || []).forEach((kw) => {
      if (kw && s.includes(kw)) {
        score += 1;
        hits.push(kw);
      }
    });
    return { score, hits };
  }

  /** Infers vertical / page_kind / service_type from free text. */
  function inferTaxonomy(text) {
    const s = normalizeText(text);
    const kindScores = R()
      .listPageKinds()
      .map((kind) => {
        const kw = scoreKeywords(s, kind.keywords);
        const vertical = R().getVertical(kind.vertical);
        const vkw = scoreKeywords(s, vertical?.keywords || []);
        return { kind, score: kw.score * 2 + vkw.score, hits: kw.hits.concat(vkw.hits) };
      })
      .sort((a, b) => b.score - a.score);

    const best = kindScores[0];
    if (!best || best.score === 0) {
      return { page_kind: null, vertical: null, service_type: "", confidence: 0, hits: [], candidates: [] };
    }
    const serviceType = best.hits[0] || "";
    const total = kindScores.reduce((sum, k) => sum + k.score, 0) || 1;
    return {
      page_kind: best.kind.id,
      vertical: best.kind.vertical,
      service_type: serviceType,
      confidence: Math.min(0.95, best.score / total),
      hits: best.hits,
      candidates: kindScores.filter((k) => k.score > 0).map((k) => ({ page_kind: k.kind.id, score: k.score })),
    };
  }

  function inferSurface(text, taxonomy, options) {
    const s = normalizeText(text);
    const allowed = Array.isArray(options?.availableSurfaces) && options.availableSurfaces.length
      ? options.availableSurfaces.map(String)
      : R().listSurfaces().map((x) => x.id);

    const scored = allowed
      .map((id) => {
        const hint = scoreKeywords(s, surfaceHints.get(id) || []);
        const kindBonus = taxonomy?.page_kind && R().isKindAllowedOnSurface(taxonomy.page_kind, id) ? 1 : 0;
        return { surface: id, score: hint.score * 2 + kindBonus, hits: hint.hits };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runnerUp = scored[1];
    const ambiguous = !best || best.score === 0 || (runnerUp && best.score === runnerUp.score);
    return { best, scored, ambiguous };
  }

  /**
   * Picks a page_kind for a surface. Auto-selects only when the surface
   * offers a single kind; otherwise the caller must ask.
   */
  function resolvePageKind(surface, inferredKind) {
    if (!surface) return inferredKind || null;
    if (inferredKind && R().isKindAllowedOnSurface(inferredKind, surface)) return inferredKind;
    const allowed = R().getSurface(surface)?.allowedKinds || [];
    return allowed.length === 1 ? allowed[0] : null;
  }

  /**
   * Resolves an entry utterance into a routing descriptor.
   * @param {string} text
   * @param {{ surfaceHint?: string, availableSurfaces?: string[] }} [options]
   */
  function route(text, options) {
    const intent = detectIntent(text);
    const taxonomy = inferTaxonomy(text);

    const forced = options?.surfaceHint ? String(options.surfaceHint) : "";
    const surfaceInfo = inferSurface(text, taxonomy, options);
    const surface = forced || (surfaceInfo.ambiguous ? null : surfaceInfo.best?.surface || null);

    const pageKind = resolvePageKind(surface, taxonomy.page_kind);

    const reasons = [];
    if (intent.intent === INTENT.UNKNOWN) reasons.push("intent_unclear");
    if (!surface) reasons.push("surface_ambiguous");
    if (!pageKind) reasons.push("page_kind_unknown");

    return {
      intent: intent.intent,
      intentConfidence: intent.confidence,
      surface,
      aiRoute: surface ? R().resolveAiRoute(surface) : null,
      page_kind: pageKind,
      vertical: taxonomy.vertical || (pageKind ? R().getPageKind(pageKind)?.vertical : null) || null,
      service_type: taxonomy.service_type || "",
      needsConfirmation: reasons.length > 0,
      reasons,
      candidates: {
        surfaces: surfaceInfo.scored.filter((x) => x.score > 0),
        pageKinds: taxonomy.candidates,
      },
      text: intent.text,
    };
  }

  /** Question payload used when routing is ambiguous. */
  function buildDisambiguation(routed) {
    if (!routed?.needsConfirmation) return null;
    if (routed.reasons.includes("surface_ambiguous")) {
      const options = (routed.candidates.surfaces.length
        ? routed.candidates.surfaces.map((x) => x.surface)
        : R().listSurfaces().map((x) => x.id)
      ).map((id) => ({ value: id, label: R().getSurface(id)?.label || id }));
      return { field: "surface", question: "どちらのサービスでページを作りますか？", options };
    }
    if (routed.reasons.includes("page_kind_unknown")) {
      const options = R()
        .listPageKinds()
        .filter((k) => !routed.surface || R().isKindAllowedOnSurface(k.id, routed.surface))
        .map((k) => ({ value: k.id, label: k.label }));
      return { field: "page_kind", question: "どんなページを作りますか？", options };
    }
    return { field: "intent", question: "ページを新しく作りますか？", options: [
      { value: INTENT.CREATE_PAGE, label: "新しく作る" },
      { value: INTENT.EDIT_PAGE, label: "既存ページを直す" },
    ] };
  }

  /** Fills a missing routing field from a user choice. */
  function resolveWithChoice(routed, field, value) {
    const next = { ...routed, candidates: { ...routed.candidates } };
    if (field === "surface") {
      next.surface = String(value);
      next.aiRoute = R().resolveAiRoute(next.surface);
      next.page_kind = resolvePageKind(next.surface, next.page_kind);
      next.vertical = next.page_kind ? R().getPageKind(next.page_kind)?.vertical || null : null;
    } else if (field === "page_kind") {
      next.page_kind = String(value);
      next.vertical = R().getPageKind(next.page_kind)?.vertical || next.vertical;
    } else if (field === "intent") {
      next.intent = String(value);
    }
    const reasons = [];
    if (next.intent === INTENT.UNKNOWN) reasons.push("intent_unclear");
    if (!next.surface) reasons.push("surface_ambiguous");
    if (!next.page_kind) reasons.push("page_kind_unknown");
    next.reasons = reasons;
    next.needsConfirmation = reasons.length > 0;
    return next;
  }

  global.TasuPageGenIntent = {
    INTENT,
    detectIntent,
    inferTaxonomy,
    route,
    buildDisambiguation,
    resolveWithChoice,
    registerSurfaceHints,
  };
})(typeof window !== "undefined" ? window : globalThis);
