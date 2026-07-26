/**
 * Platform Page Gen Adapter
 *
 * Bridges Platform listings ↔ Phase 1 TasuPageGenEngine.
 * Does not embed Platform rules into the common engine.
 */
(function (global) {
  "use strict";

  const SURFACE = "platform";
  const ENDPOINTS = Object.freeze({
    entitlement: "/api/page-gen-entitlement",
    draft: "/api/page-gen-draft",
  });

  /** Real Platform destinations only (booking/join intentionally omitted). */
  const TYPE_MAP = Object.freeze({
    product: {
      page_kind: "shop",
      outcome: "purchase",
      cta_label: "購入する",
      action_kind: "tasful_purchase",
      tasful_flow: "tasful_marketplace_checkout",
      route_builder: (listing) => `platform:product:checkout:${listing?.id || ""}`,
      required_ids: ["listing_id"],
    },
    skill: {
      page_kind: "service",
      outcome: "request",
      cta_label: "依頼する",
      action_kind: "tasful_request",
      tasful_flow: "tasful_request",
      route_builder: (listing) => `platform:skill:request:${listing?.id || ""}`,
      required_ids: ["listing_id"],
    },
    job: {
      page_kind: "service",
      outcome: "apply",
      cta_label: "応募する",
      action_kind: "tasful_apply",
      tasful_flow: "tasful_job_apply",
      route_builder: (listing) => `platform:job:apply:${listing?.id || ""}`,
      required_ids: ["listing_id"],
    },
    worker: {
      page_kind: "service",
      outcome: "consult",
      cta_label: "相談する",
      action_kind: "talk_start",
      tasful_flow: "tasful_talk",
      route_builder: (listing) => `platform:worker:talk:${listing?.id || ""}`,
      required_ids: ["listing_id"],
    },
  });

  function Engine() {
    return global.TasuPageGenEngine;
  }
  function Schema() {
    return global.TasuPageGenSchema;
  }

  function normalizeListingType(value) {
    const t = String(value || "").trim();
    if (TYPE_MAP[t]) return t;
    return "";
  }

  function mapListingType(listingType) {
    return TYPE_MAP[normalizeListingType(listingType)] || null;
  }

  function unsupportedOutcome(outcome) {
    return ["booking", "join"].includes(String(outcome || ""));
  }

  function readAuthToken() {
    return (async () => {
      try {
        const client =
          global.TasuSupabaseClient?.getClient?.() ||
          global.supabase ||
          null;
        if (client?.auth?.getSession) {
          const { data } = await client.auth.getSession();
          const token = data?.session?.access_token;
          if (token) return String(token);
        }
      } catch {
        /* ignore */
      }
      return (
        global.TASU_SUPABASE_SESSION?.access_token ||
        global.TasuChatAuth?.accessToken ||
        ""
      );
    })();
  }

  async function postJson(url, body) {
    const token = await readAuthToken();
    if (!token) {
      return { ok: false, error: "auth_required", http: 401 };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return {
      ok: res.ok && data?.ok === true,
      http: res.status,
      error: data?.error || (res.ok ? null : "request_failed"),
      data,
    };
  }

  function listingToFacts(listing) {
    const l = listing || {};
    return {
      business_name: l.title || l.worker_display_name || "",
      service_summary: l.description || l.product_description || l.summary || "",
      area: l.worker_area || l.area || l.location || "",
      price_text:
        l.price != null
          ? String(l.price)
          : l.worker_price_amount != null
            ? String(l.worker_price_amount)
            : l.salary_amount != null
              ? String(l.salary_amount)
              : "",
      hours_text: l.hours || l.worker_availability || "",
      strengths: l.tags || l.worker_support_tags || [],
      images: Array.isArray(l.images)
        ? l.images
        : l.image_url
          ? [l.image_url]
          : l.thumbnail_url
            ? [l.thumbnail_url]
            : [],
    };
  }

  function internalLinkCandidates(listingType, listing) {
    const map = mapListingType(listingType);
    if (!map) return [];
    const id = listing?.id || "new";
    const candidates = [
      {
        kind: "listing",
        label: "この掲載ページ",
        target_ref: `platform:listing:${id}`,
      },
      {
        kind: "category",
        label: "関連カテゴリ",
        target_ref: `platform:category:${listingType}`,
      },
    ];
    if (listingType === "product") {
      candidates.push({
        kind: "checkout",
        label: "購入手続き",
        target_ref: map.route_builder(listing),
      });
    }
    if (listingType === "job") {
      candidates.push({
        kind: "apply",
        label: "応募フロー",
        target_ref: map.route_builder(listing),
      });
    }
    if (listingType === "skill") {
      candidates.push({
        kind: "request",
        label: "依頼フロー",
        target_ref: map.route_builder(listing),
      });
    }
    if (listingType === "worker") {
      candidates.push({
        kind: "talk",
        label: "相談（Talk）",
        target_ref: map.route_builder(listing),
      });
    }
    return candidates;
  }

  function applyPlatformMapping(session) {
    const map = session?.platform?.mapping;
    if (!map || !session?.doc) return session;
    session.doc.conversion = {
      ...(session.doc.conversion || {}),
      outcome: map.outcome,
      primary_action: map.action_kind,
      label: map.cta_label,
      tasful_flow: map.tasful_flow,
    };
    Engine().refreshDerived(session);
    if (session.doc.actions?.primary) {
      session.doc.actions.primary.kind = map.action_kind;
      session.doc.actions.primary.config = {
        ...(session.doc.actions.primary.config || {}),
        route_ref: map.route_builder({ id: session.platform.listing_id }),
      };
      if (!global.TasuPageGenProvenance?.isLocked?.(session.doc, "actions.primary.label")) {
        session.doc.actions.primary.label = map.cta_label;
      }
    }
    return session;
  }

  function createSessionFromListing(listing, entitlement) {
    const listingType = normalizeListingType(listing?.listing_type);
    const map = mapListingType(listingType);
    if (!map) {
      return { ok: false, error: "unsupported_listing_type" };
    }
    const facts = listingToFacts(listing);
    // Interview.createSession only merges nested `doc` — top-level profile/
    // conversion are ignored by the common engine.
    const session = Engine().startSession({
      surface: SURFACE,
      page_kind: map.page_kind,
      service_type: listingType,
      category: { name: listing?.category || listingType },
      entitlement,
      internalLinkCandidates: internalLinkCandidates(listingType, listing),
      entity: {
        listing_id: listing?.id || null,
        owner_id: listing?.user_id || null,
        slug: listing?.slug || "",
      },
      doc: {
        conversion: { outcome: map.outcome },
        profile: {
          name: facts.business_name,
          summary: facts.service_summary,
          areas: facts.area ? [facts.area] : [],
          price_text: facts.price_text,
          hours_text: facts.hours_text,
          strengths: Array.isArray(facts.strengths) ? facts.strengths : [],
          images: (facts.images || []).map((url) =>
            typeof url === "string" ? { url, alt: "" } : url,
          ),
        },
      },
    });
    session.platform = {
      listing_type: listingType,
      mapping: map,
      listing_id: listing?.id || null,
    };
    applyPlatformMapping(session);
    return { ok: true, session, mapping: map };
  }

  async function checkEntitlement() {
    const result = await postJson(ENDPOINTS.entitlement, {});
    if (!result.ok) {
      return {
        ok: false,
        error: result.error || "paid_entitlement_required",
        http: result.http,
        entitlement: result.data?.entitlement || null,
        stage: "entitlement",
      };
    }
    return { ok: true, entitlement: result.data.entitlement };
  }

  async function generateDraft(session, options) {
    const access = Engine().checkEntitlement(session);
    if (!access.ok) {
      return { ok: false, error: access.error?.code || "paid_entitlement_required", stage: "entitlement" };
    }
    const facts = {};
    (session.doc.profile ? ["name", "summary", "price_text", "hours_text"] : []).forEach(() => {});
    facts.business_name = session.doc.profile?.name || "";
    facts.service_summary = session.doc.profile?.summary || "";
    facts.area = (session.doc.profile?.areas || []).join("、");
    facts.price_text = session.doc.profile?.price_text || "";
    facts.hours_text = session.doc.profile?.hours_text || "";
    facts.strengths = session.doc.profile?.strengths || [];

    const body = {
      listing_type: session.platform?.listing_type || "",
      outcome: session.platform?.mapping?.outcome || session.doc.conversion?.outcome || "",
      facts,
      allowed_internal_targets: session.internalLinkCandidates || [],
      instruction: options?.instruction || "",
      review_pass: options?.reviewPass ? 1 : 0,
      review_issues: options?.reviewIssues || [],
    };

    const result = await postJson(ENDPOINTS.draft, body);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error || "generation_failed",
        http: result.http,
        stage: result.data?.stage || "generation",
        entitlement: result.data?.entitlement || null,
      };
    }

    const apply = options?.reviewPass
      ? Engine().applySelfReview(session, result.data.draft, { model: result.data.model })
      : Engine().applyAiDraft(session, result.data.draft, { model: result.data.model });

    if (!apply.ok) {
      return { ok: false, error: "draft_rejected", stage: "validation", detail: apply };
    }

    // Force Platform outcome / internal CTA after AI (system-owned kind).
    applyPlatformMapping(session);

    return {
      ok: true,
      session,
      apply,
      needsAutoImprove: apply.needsAutoImprove,
      quality: session.doc.quality,
    };
  }

  async function generateWithReview(session) {
    const first = await generateDraft(session, { reviewPass: false });
    if (!first.ok) return first;
    if (!first.needsAutoImprove) return { ok: true, passes: 1, session, first, review: null };
    const review = await generateDraft(session, {
      reviewPass: true,
      reviewIssues: session.doc.quality?.issues || [],
      instruction: "品質課題だけを改善してください。",
    });
    if (!review.ok) return { ok: false, passes: 1, session, first, review, error: review.error };
    return { ok: true, passes: 2, session, first, review };
  }

  /** Persist PageDoc into listing form_data without schema migration. */
  function attachPageDocToListingPayload(payload, session) {
    const next = { ...(payload || {}) };
    const formData =
      next.form_data && typeof next.form_data === "object" ? { ...next.form_data } : {};
    formData.page_doc = Schema().cloneDoc(session.doc);
    formData.page_gen = {
      surface: SURFACE,
      listing_type: session.platform?.listing_type || "",
      outcome: session.doc.conversion?.outcome || "",
      quality_overall: session.doc.quality?.overall || 0,
      updated_at: Schema().nowIso(),
    };
    next.form_data = formData;

    // Mirror SEO into listing fields when empty / unlocked.
    if (session.doc.seo?.title) next.title = next.title || session.doc.seo.title;
    if (session.doc.seo?.description) {
      next.description = next.description || session.doc.seo.description;
    }
    return next;
  }

  function extractPageDoc(listing) {
    const doc = listing?.form_data?.page_doc;
    if (!doc) return null;
    try {
      return Schema().migrateDoc(doc);
    } catch {
      return null;
    }
  }

  function resolveCta(listing) {
    const listingType = normalizeListingType(listing?.listing_type);
    const map = mapListingType(listingType);
    if (!map) return null;
    const doc = extractPageDoc(listing);
    const label =
      doc?.actions?.primary?.label ||
      doc?.conversion?.label ||
      map.cta_label;
    return {
      listing_type: listingType,
      outcome: map.outcome,
      label,
      action_kind: map.action_kind,
      tasful_flow: map.tasful_flow,
      route_ref: map.route_builder(listing),
      required_ids: map.required_ids,
      missing_ids: listing?.id ? [] : ["listing_id"],
      can_show: Boolean(listing?.id),
      fallback: listing?.id
        ? null
        : "掲載を保存するとCTAが有効になります",
    };
  }

  function previewHtml(session) {
    return Engine().preview(session, { includeStructuredData: false });
  }

  function previewHead(session) {
    return Engine().previewHead(session);
  }

  function editField(session, path, value) {
    return Engine().editField(session, path, value);
  }

  global.TasuPlatformPageGenAdapter = {
    SURFACE,
    ENDPOINTS,
    TYPE_MAP,
    normalizeListingType,
    mapListingType,
    unsupportedOutcome,
    listingToFacts,
    internalLinkCandidates,
    createSessionFromListing,
    applyPlatformMapping,
    checkEntitlement,
    generateDraft,
    generateWithReview,
    attachPageDocToListingPayload,
    extractPageDoc,
    resolveCta,
    previewHtml,
    previewHead,
    editField,
  };
})(typeof window !== "undefined" ? window : globalThis);
