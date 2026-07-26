/**
 * TASFUL Page Gen — engine facade (Phase 1 common engine)
 *
 * Orchestrates: entry intent → interview → PageDoc → listing data → SEO →
 * FAQ → action wiring → preview → publish. It never calls an AI provider or
 * a database; hosts pass model output in and persist what comes out.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }
  function R() {
    return global.TasuPageGenRegistry;
  }
  function Intent() {
    return global.TasuPageGenIntent;
  }
  function Interview() {
    return global.TasuPageGenInterview;
  }
  function Prov() {
    return global.TasuPageGenProvenance;
  }
  function Validate() {
    return global.TasuPageGenValidate;
  }
  function Seo() {
    return global.TasuPageGenSeo;
  }
  function Actions() {
    return global.TasuPageGenActions;
  }
  function Renderer() {
    return global.TasuPageGenRenderer;
  }
  function History() {
    return global.TasuPageGenHistory;
  }
  function Listing() {
    return global.TasuPageGenListing;
  }
  function Prompt() {
    return global.TasuPageGenPrompt;
  }
  function Entitlement() {
    return global.TasuPageGenEntitlement;
  }
  function Conversion() {
    return global.TasuPageGenConversion;
  }
  function Quality() {
    return global.TasuPageGenQuality;
  }

  /** Entry point for TASFUL AI: text in, routing descriptor out. */
  function resolveEntry(text, options) {
    const routed = Intent().route(text, options);
    return {
      route: routed,
      disambiguation: Intent().buildDisambiguation(routed),
      ready: !routed.needsConfirmation,
    };
  }

  function startSession(input) {
    const session = Interview().createSession(input);
    session.history = History().createHistory({ max: input?.historyMax });
    session.entitlement = Entitlement().normalize(input?.entitlement);
    session.internalLinkCandidates = (Array.isArray(input?.internalLinkCandidates)
      ? input.internalLinkCandidates
      : []
    )
      .slice(0, 30)
      .map((item) => ({
        target_ref: String(item?.target_ref || ""),
        label: String(item?.label || ""),
        kind: String(item?.kind || ""),
      }))
      .filter((item) => item.target_ref);
    session.lastValidation = null;
    refreshDerived(session);
    return session;
  }

  /** Starts a session directly from a resolved route descriptor. */
  function startFromRoute(routed, input) {
    if (!routed || routed.needsConfirmation) {
      throw new Error("route is not resolved; call resolveEntry and answer the disambiguation first");
    }
    return startSession({
      surface: routed.surface,
      page_kind: routed.page_kind,
      vertical: routed.vertical,
      service_type: routed.service_type,
      ...(input || {}),
    });
  }

  function answer(session, answers) {
    const result = Interview().applyAnswers(session, answers);
    refreshDerived(session);
    return result;
  }

  function skipOptional(session) {
    const state = Interview().skipOptional(session);
    refreshDerived(session);
    return state;
  }

  function canGenerate(session) {
    return Interview().canGenerate(session);
  }

  /** Provider-neutral request payload; the caller performs the AI call. */
  function buildAiRequest(session, options) {
    const access = Entitlement().check(session.entitlement);
    if (!access.ok) return { ok: false, error: access.error };
    return Prompt().buildDraftRequest(session.doc, {
      ...(options || {}),
      internalLinkCandidates: session.internalLinkCandidates,
    });
  }

  /**
   * Applies model output. Rejects unsafe drafts, respects locked fields.
   * @param {object} session
   * @param {object} draft raw model JSON
   * @param {{ model?: string, scope?: string, paths?: string[], force?: boolean }} [options]
   */
  function applyAiDraft(session, draft, options) {
    const access = Entitlement().check(session.entitlement);
    if (!access.ok) {
      return { ok: false, error: access.error, validation: null, applied: [], skipped: [] };
    }
    const guard = Validate().validateAiDraft(draft);
    if (!guard.ok) {
      session.lastValidation = guard;
      return { ok: false, validation: guard, applied: [], skipped: [] };
    }
    const allowedTargets = new Set(session.internalLinkCandidates.map((item) => item.target_ref));
    const unknownTarget = (draft.internal_links || []).find(
      (item) => !allowedTargets.has(String(item?.target_ref || "")),
    );
    if (unknownTarget) {
      const validation = {
        ok: false,
        errors: [{
          code: "internal_link_not_allowed",
          message: "許可されていないTASFUL内部リンクです",
          path: "internal_links",
        }],
        warnings: [],
      };
      session.lastValidation = validation;
      return { ok: false, validation, applied: [], skipped: [] };
    }
    const patch = Prompt().draftToPatch(draft, session.doc);
    const merge = Prov().applyAiPatch(session.doc, patch, {
      model: options?.model,
      paths: options?.paths,
      force: options?.force,
    });
    session.doc = S().normalizeDoc(session.doc);
    session.doc.meta.model = S().trimText(options?.model, 80) || session.doc.meta.model;
    refreshDerived(session);
    if (options?.reviewPass && merge.applied.length) Quality().markReviewed(session.doc);
    if (options?.reviewPass && !merge.applied.length) {
      return {
        ok: false,
        error: { code: "self_review_no_change", message: "AI自己レビューで改善が適用されませんでした" },
        validation: Validate().validateDoc(session.doc),
        ...merge,
      };
    }
    session.lastValidation = Validate().validateDoc(session.doc);
    const needsAutoImprove = !options?.reviewPass && Quality().needsAutoImprove(session.doc);
    return {
      ok: true,
      validation: session.lastValidation,
      ...merge,
      warnings: guard.warnings,
      quality: session.doc.quality,
      needsAutoImprove,
      reviewRequest: needsAutoImprove
        ? Prompt().buildReviewRequest(session.doc, session.doc.quality, {
            internalLinkCandidates: session.internalLinkCandidates,
          })
        : null,
    };
  }

  function applyFallbackDraft(session) {
    const draft = Prompt().buildFallbackDraft(session.doc);
    return applyAiDraft(session, draft, { model: "fallback" });
  }

  /** Rebuilds everything that must stay deterministic. */
  function refreshDerived(session) {
    const doc = session.doc;
    Actions().applyActions(doc);
    Conversion().apply(doc, doc.conversion);
    Seo().applySeo(doc, { title: doc.seo?.title, description: doc.seo?.description });
    Seo().applyStructuredData(doc);
    Quality().apply(doc);
    Prov().markSystem(doc, "structured_data");
    S().touch(doc);
    return doc;
  }

  function editField(session, path, value) {
    Prov().applyUserEdit(session.doc, path, value);
    refreshDerived(session);
    return session.doc;
  }

  function lockField(session, path) {
    return Prov().lock(session.doc, path);
  }

  function unlockField(session, path) {
    return Prov().unlock(session.doc, path);
  }

  /** Regeneration request for one scope; locked fields stay untouched later. */
  function buildRegenerateRequest(session, options) {
    const access = Entitlement().check(session.entitlement);
    if (!access.ok) return { ok: false, error: access.error };
    const scope = options?.scope || Prompt().SCOPE.PAGE;
    return Prompt().buildDraftRequest(session.doc, {
      scope,
      blockType: options?.blockType,
      path: options?.path,
      instruction: options?.instruction,
      internalLinkCandidates: session.internalLinkCandidates,
    });
  }

  function buildSelfReviewRequest(session) {
    const access = Entitlement().check(session.entitlement);
    if (!access.ok) return { ok: false, error: access.error };
    if (!Quality().needsAutoImprove(session.doc)) return null;
    return Prompt().buildReviewRequest(session.doc, session.doc.quality, {
      internalLinkCandidates: session.internalLinkCandidates,
    });
  }

  function applySelfReview(session, draft, options) {
    if (!Quality().needsAutoImprove(session.doc)) {
      return {
        ok: false,
        error: { code: "self_review_limit", message: "AI自己レビューは1回だけ実行できます" },
      };
    }
    return applyAiDraft(session, draft, { ...(options || {}), reviewPass: true });
  }

  /**
   * Provider-neutral two-pass orchestration. The host supplies its existing
   * surface adapter; this engine invokes it once for generation and at most
   * once more when the deterministic quality review requests improvement.
   */
  async function generateWithReview(session, invoke, options) {
    if (typeof invoke !== "function") {
      return { ok: false, error: { code: "ai_adapter_required", message: "AI adapter is required" } };
    }
    const request = buildAiRequest(session, options);
    if (request?.ok === false) return request;
    const draft = await invoke(request, { pass: 0, purpose: "page_gen_draft" });
    const first = applyAiDraft(session, draft, options);
    if (!first.ok || !first.needsAutoImprove) {
      return { ok: first.ok, passes: 1, first, review: null, doc: session.doc };
    }
    const improvedDraft = await invoke(first.reviewRequest, {
      pass: 1,
      purpose: "page_gen_self_review",
    });
    const review = applySelfReview(session, improvedDraft, options);
    return { ok: review.ok, passes: 2, first, review, doc: session.doc };
  }

  function setEntitlement(session, entitlement) {
    session.entitlement = Entitlement().normalize(entitlement);
    return Entitlement().check(session.entitlement);
  }

  function checkEntitlement(session) {
    return Entitlement().check(session.entitlement);
  }

  function preview(session, options) {
    return Renderer().render(session.doc, { preview: true, ...(options || {}) });
  }

  function previewHead(session) {
    const doc = S().cloneDoc(session.doc);
    doc.seo.noindex = true;
    return Renderer().renderHead(doc);
  }

  function validate(session, options) {
    const docResult = Validate().validateDoc(session.doc, options);
    const actionResult = Actions().validateActions(session.doc);
    const merged = Validate().mergeResults(docResult, {
      ok: actionResult.ok,
      errors: actionResult.errors,
      warnings: actionResult.warnings,
    });
    if (options?.forPublish) {
      const access = Entitlement().check(session.entitlement);
      if (!access.ok) {
        merged.ok = false;
        merged.errors.push({ ...access.error, path: "entitlement" });
      }
    }
    session.lastValidation = merged;
    return merged;
  }

  function saveDraft(session, options) {
    session.doc.meta.status = S().STATUS.DRAFT;
    const entry = History().push(session.history, session.doc, {
      label: options?.label,
      reason: options?.reason || "save",
    });
    return { entry, doc: session.doc };
  }

  function requestReview(session) {
    const result = validate(session, { forPublish: true });
    if (!result.ok) return { ok: false, validation: result };
    session.doc.meta.status = S().STATUS.REVIEW;
    session.doc.meta.review_state = "requested";
    History().push(session.history, session.doc, { reason: "review_request" });
    return { ok: true, validation: result, doc: session.doc };
  }

  function approveReview(session) {
    session.doc.meta.review_state = "approved";
    return session.doc;
  }

  /**
   * @param {object} session
   * @param {{ publishAt?: string }} [options]
   */
  function publish(session, options) {
    const result = validate(session, { forPublish: true });
    if (!result.ok) return { ok: false, validation: result };

    const surface = R().getSurface(session.doc.surface);
    if (surface?.requiresReview && session.doc.meta.review_state !== "approved") {
      const validation = {
        ok: false,
        errors: [{ code: "review_required", message: "審査の承認が必要です", path: "meta.review_state" }],
        warnings: result.warnings,
      };
      session.lastValidation = validation;
      return { ok: false, validation };
    }

    session.doc.meta.status = S().STATUS.PUBLISHED;
    session.doc.meta.publish_at = options?.publishAt || S().nowIso();
    session.doc.seo.noindex = false;
    refreshDerived(session);
    const entry = History().push(session.history, session.doc, { reason: "publish" });
    return { ok: true, validation: result, doc: session.doc, entry, listing: Listing().toListingData(session.doc) };
  }

  function unpublish(session) {
    session.doc.meta.status = S().STATUS.UNPUBLISHED;
    const entry = History().push(session.history, session.doc, { reason: "unpublish" });
    return { ok: true, doc: session.doc, entry, listing: Listing().toListingData(session.doc) };
  }

  function restoreVersion(session, version) {
    const restored = History().restore(session.history, version);
    if (!restored) return { ok: false, reason: "version_not_found" };
    session.doc = restored;
    refreshDerived(session);
    History().push(session.history, session.doc, { reason: `restore_v${version}` });
    return { ok: true, doc: session.doc };
  }

  function listingData(session) {
    return Listing().toMappedListingData(session.doc);
  }

  function exportSession(session) {
    return JSON.stringify({
      doc: session.doc,
      history: session.history,
      asked: session.asked,
      skipped: session.skipped,
      shouldBatchOffered: session.shouldBatchOffered,
      entitlement: session.entitlement,
      internalLinkCandidates: session.internalLinkCandidates,
    });
  }

  function importSession(json) {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    const session = startSession({
      doc: S().migrateDoc(parsed?.doc),
      entitlement: parsed?.entitlement,
      internalLinkCandidates: parsed?.internalLinkCandidates,
    });
    session.history = History().deserialize(parsed?.history || History().createHistory());
    session.asked = Array.isArray(parsed?.asked) ? parsed.asked : [];
    session.skipped = Array.isArray(parsed?.skipped) ? parsed.skipped : [];
    session.shouldBatchOffered = Boolean(parsed?.shouldBatchOffered);
    return session;
  }

  global.TasuPageGenEngine = {
    resolveEntry,
    startSession,
    startFromRoute,
    answer,
    skipOptional,
    canGenerate,
    buildAiRequest,
    applyAiDraft,
    applyFallbackDraft,
    refreshDerived,
    editField,
    lockField,
    unlockField,
    buildRegenerateRequest,
    buildSelfReviewRequest,
    applySelfReview,
    generateWithReview,
    setEntitlement,
    checkEntitlement,
    preview,
    previewHead,
    validate,
    saveDraft,
    requestReview,
    approveReview,
    publish,
    unpublish,
    restoreVersion,
    listingData,
    exportSession,
    importSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
