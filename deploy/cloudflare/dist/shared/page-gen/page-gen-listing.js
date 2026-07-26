/**
 * TASFUL Page Gen — listing data mapper (Phase 1 common engine)
 *
 * Converts PageDoc into a surface-neutral listing payload. Field naming is
 * driven by the page_kind's listingFieldMap, so integrating a new surface
 * means declaring a map — not editing this file.
 * No persistence, no network.
 */
(function (global) {
  "use strict";

  function S() {
    return global.TasuPageGenSchema;
  }

  function R() {
    return global.TasuPageGenRegistry;
  }

  function slugify(value) {
    const base = String(value ?? "")
      .toLowerCase()
      .replace(/[\s\u3000]+/g, "-")
      .replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return base.slice(0, 80);
  }

  function tagsFrom(doc) {
    const out = [];
    const push = (v) => {
      const s = S().trimText(v, 40);
      if (s && !out.includes(s)) out.push(s);
    };
    push(doc?.category?.name);
    push(doc?.service_type);
    (doc?.profile?.areas || []).slice(0, 5).forEach(push);
    (doc?.profile?.strengths || []).slice(0, 5).forEach(push);
    return out.slice(0, 15);
  }

  function publishState(doc) {
    const schema = S();
    const status = doc?.meta?.status;
    if (status === schema.STATUS.PUBLISHED) {
      return {
        publish_status: schema.PUBLISH_STATUS.PUBLIC,
        publish_at: doc?.meta?.publish_at || schema.nowIso(),
      };
    }
    if (status === schema.STATUS.UNPUBLISHED) {
      return { publish_status: schema.PUBLISH_STATUS.PRIVATE, publish_at: doc?.meta?.publish_at || null };
    }
    return { publish_status: schema.PUBLISH_STATUS.DRAFT, publish_at: null };
  }

  /** Base payload every surface can consume. */
  function toListingData(doc) {
    const schema = S();
    const state = publishState(doc);
    const title = schema.trimText(doc?.seo?.title || doc?.profile?.name, 120);
    return {
      page_id: doc?.id || null,
      listing_id: doc?.entity?.listing_id || null,
      owner_id: doc?.entity?.owner_id || null,
      slug: doc?.entity?.slug || slugify(doc?.profile?.name),
      surface: doc?.surface || "",
      vertical: doc?.vertical || "",
      page_kind: doc?.page_kind || "",
      service_type: doc?.service_type || "",
      category_id: doc?.category?.id || null,
      category_name: doc?.category?.name || "",
      title,
      summary: schema.trimText(doc?.profile?.summary, schema.LIMITS.SUMMARY),
      description: schema.trimText(doc?.profile?.body || doc?.profile?.summary, schema.LIMITS.BODY),
      areas: (doc?.profile?.areas || []).slice(0, 20),
      price_text: schema.trimText(doc?.profile?.price_text, 200),
      hours_text: schema.trimText(doc?.profile?.hours_text, 200),
      tags: tagsFrom(doc),
      image_url: doc?.profile?.images?.[0]?.url || null,
      seo_title: doc?.seo?.title || "",
      meta_description: doc?.seo?.description || "",
      publish_status: state.publish_status,
      publish_at: state.publish_at,
      doc_version: doc?.doc_version || null,
      page_version: doc?.meta?.version || 0,
    };
  }

  /**
   * Applies the page_kind's listingFieldMap on top of the base payload.
   * Map shape: { targetField: "doc.path" }
   */
  function toMappedListingData(doc, extraMap) {
    const base = toListingData(doc);
    const kind = R().getPageKind(doc?.page_kind);
    const map = { ...(kind?.listingFieldMap || {}), ...(extraMap || {}) };
    const mapped = { ...base };
    Object.keys(map).forEach((target) => {
      const value = S().getPath(doc, map[target]);
      if (value !== undefined) mapped[target] = value;
    });
    return mapped;
  }

  /** Fields a surface may safely expose publicly (no owner/contact leakage). */
  function toPublicSummary(doc) {
    const data = toListingData(doc);
    return {
      page_id: data.page_id,
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      areas: data.areas,
      price_text: data.price_text,
      category_name: data.category_name,
      image_url: data.image_url,
      page_kind: data.page_kind,
      publish_status: data.publish_status,
    };
  }

  global.TasuPageGenListing = {
    slugify,
    publishState,
    toListingData,
    toMappedListingData,
    toPublicSummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
