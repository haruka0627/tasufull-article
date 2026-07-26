/**
 * TASFUL Page Gen — PageDoc schema (Phase 1 common engine)
 *
 * PageDoc is the only contract between AI output, editors, renderer and
 * listing mappers. AI never produces HTML; it fills PageDoc fields.
 */
(function (global) {
  "use strict";

  const Registry = global.TasuPageGenRegistry;

  const DOC_VERSION = 2;

  const STATUS = Object.freeze({
    DRAFT: "draft",
    REVIEW: "review",
    PUBLISHED: "published",
    UNPUBLISHED: "unpublished",
  });

  const PUBLISH_STATUS = Object.freeze({
    DRAFT: "draft",
    PUBLIC: "public",
    PRIVATE: "private",
  });

  const SOURCE = Object.freeze({
    AI: "ai",
    USER: "user",
    SYSTEM: "system",
    IMPORT: "import",
  });

  const LIMITS = Object.freeze({
    SEO_TITLE: 60,
    SEO_DESCRIPTION: 160,
    SUMMARY: 400,
    BODY: 8000,
    HEADING: 80,
    FAQ_ITEMS: 8,
    FAQ_Q: 120,
    FAQ_A: 600,
    BLOCKS: 30,
  });

  function isPlainObject(v) {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
  }

  function splitPath(path) {
    return String(path || "")
      .split(".")
      .filter((s) => s !== "");
  }

  function getPath(obj, path) {
    const parts = splitPath(path);
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      cur = Array.isArray(cur) ? cur[Number(part)] : cur[part];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    const parts = splitPath(path);
    if (!parts.length) return obj;
    if (parts.some((part) => part === "__proto__" || part === "prototype" || part === "constructor")) {
      throw new Error("unsafe path segment");
    }
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      const nextKey = parts[i + 1];
      if (cur[key] == null || (typeof cur[key] !== "object")) {
        cur[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  function trimText(value, max) {
    const s = String(value ?? "").replace(/\r\n/g, "\n").trim();
    if (!max || s.length <= max) return s;
    return s.slice(0, max);
  }

  function toStringArray(value, max) {
    const list = Array.isArray(value)
      ? value
      : String(value ?? "")
          .split(/[,、\n]/)
          .map((s) => s.trim());
    const out = list.map((s) => String(s ?? "").trim()).filter(Boolean);
    return typeof max === "number" ? out.slice(0, max) : out;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}${rand}`;
  }

  function normalizeCategory(raw) {
    if (!raw) return { id: null, name: "", path: [] };
    if (typeof raw === "string") return { id: null, name: trimText(raw, 80), path: [] };
    return {
      id: raw.id ? String(raw.id) : null,
      name: trimText(raw.name, 80),
      path: toStringArray(raw.path, 5),
    };
  }

  function normalizeProfile(raw) {
    const p = isPlainObject(raw) ? raw : {};
    return {
      name: trimText(p.name, 120),
      summary: trimText(p.summary, LIMITS.SUMMARY),
      body: trimText(p.body, LIMITS.BODY),
      areas: toStringArray(p.areas, 20),
      price_text: trimText(p.price_text, 200),
      hours_text: trimText(p.hours_text, 200),
      strengths: toStringArray(p.strengths, 10),
      certifications: toStringArray(p.certifications, 10),
      contact: {
        policy: trimText(p.contact?.policy, 200),
        phone: trimText(p.contact?.phone, 40),
        email: trimText(p.contact?.email, 120),
        website_url: trimText(p.contact?.website_url, 300),
      },
      images: Array.isArray(p.images)
        ? p.images
            .filter((img) => img && (img.url || img.src))
            .slice(0, 12)
            .map((img) => ({
              url: String(img.url || img.src),
              alt: trimText(img.alt, 120),
            }))
        : [],
    };
  }

  function normalizeSeo(raw) {
    const s = isPlainObject(raw) ? raw : {};
    return {
      title: trimText(s.title, LIMITS.SEO_TITLE),
      description: trimText(s.description, LIMITS.SEO_DESCRIPTION),
      keywords: toStringArray(s.keywords, 12),
      canonical: trimText(s.canonical, 300),
      noindex: Boolean(s.noindex),
      og: {
        title: trimText(s.og?.title, LIMITS.SEO_TITLE),
        description: trimText(s.og?.description, LIMITS.SEO_DESCRIPTION),
        image: trimText(s.og?.image, 300),
      },
    };
  }

  function normalizeMediaPlan(raw) {
    return (Array.isArray(raw) ? raw : [])
      .slice(0, 12)
      .map((item) => ({
        role: trimText(item?.role, 40),
        purpose: trimText(item?.purpose, 240),
        alt: trimText(item?.alt, 120),
        asset_ref: trimText(item?.asset_ref, 160),
      }))
      .filter((item) => item.role && item.alt);
  }

  function normalizeInternalLinks(raw) {
    return (Array.isArray(raw) ? raw : [])
      .slice(0, 12)
      .map((item) => ({
        kind: trimText(item?.kind, 40),
        label: trimText(item?.label, 80),
        target_ref: trimText(item?.target_ref, 160),
      }))
      .filter((item) => item.label && item.target_ref && !/^(?:https?:|mailto:|tel:|\/\/)/i.test(item.target_ref));
  }

  function normalizeConversion(raw) {
    const c = isPlainObject(raw) ? raw : {};
    return {
      outcome: trimText(c.outcome, 40),
      rationale: trimText(c.rationale, 240),
      primary_action: trimText(c.primary_action, 40),
      label: trimText(c.label, 40),
      tasful_flow: trimText(c.tasful_flow, 80),
    };
  }

  function normalizeQuality(raw) {
    const q = isPlainObject(raw) ? raw : {};
    const scores = isPlainObject(q.scores) ? q.scores : {};
    const score = (value) => Math.max(0, Math.min(100, Number(value) || 0));
    const normalizedScores = {};
    Object.keys(scores).slice(0, 20).forEach((key) => {
      if (/^[a-z][a-z0-9_]{0,39}$/i.test(key)) normalizedScores[key] = score(scores[key]);
    });
    return {
      scores: normalizedScores,
      overall: score(q.overall),
      issues: Array.isArray(q.issues) ? q.issues.slice(0, 20).map((issue) => ({ ...issue })) : [],
      publish_ready: Boolean(q.publish_ready),
      review_status: trimText(q.review_status, 40) || "pending",
      review_attempts: Math.max(0, Math.min(1, Number(q.review_attempts) || 0)),
      reviewed_at: q.reviewed_at ? String(q.reviewed_at) : null,
    };
  }

  function normalizeEntity(raw) {
    const e = isPlainObject(raw) ? raw : {};
    return {
      owner_id: e.owner_id ? String(e.owner_id) : null,
      listing_id: e.listing_id ? String(e.listing_id) : null,
      slug: trimText(e.slug, 120),
    };
  }

  function normalizeActions(raw) {
    const a = isPlainObject(raw) ? raw : {};
    const one = (v) => {
      if (!v) return null;
      if (typeof v === "string") return { kind: v, label: "", config: {} };
      return {
        kind: String(v.kind || ""),
        label: trimText(v.label, 40),
        config: isPlainObject(v.config) ? { ...v.config } : {},
      };
    };
    return {
      primary: one(a.primary),
      secondary: one(a.secondary),
      booking: one(a.booking),
      payment: one(a.payment),
      inquiry: one(a.inquiry),
    };
  }

  function normalizeBlocks(raw, kindId) {
    const Blocks = global.TasuPageGenBlocks;
    const list = Array.isArray(raw) ? raw : [];
    const normalized = list.slice(0, LIMITS.BLOCKS).map((b, i) => {
      const type = String(b?.type || "");
      const props = Blocks?.normalizeProps ? Blocks.normalizeProps(type, b?.props) : { ...(b?.props || {}) };
      return {
        id: String(b?.id || `b${i + 1}`),
        type,
        visible: b?.visible === false ? false : true,
        props,
      };
    });
    if (normalized.length) return normalized;
    if (Blocks?.defaultBlocksForKind) return Blocks.defaultBlocksForKind(kindId);
    return [];
  }

  function normalizeMeta(raw) {
    const m = isPlainObject(raw) ? raw : {};
    const status = Object.values(STATUS).includes(m.status) ? m.status : STATUS.DRAFT;
    return {
      status,
      version: Number.isFinite(m.version) ? Number(m.version) : 0,
      review_state: trimText(m.review_state, 40) || "none",
      publish_status: Object.values(PUBLISH_STATUS).includes(m.publish_status)
        ? m.publish_status
        : PUBLISH_STATUS.DRAFT,
      publish_at: m.publish_at ? String(m.publish_at) : null,
      created_at: m.created_at ? String(m.created_at) : nowIso(),
      updated_at: m.updated_at ? String(m.updated_at) : nowIso(),
      generator: trimText(m.generator, 80) || "page-gen",
      model: trimText(m.model, 80),
    };
  }

  /** Creates a normalized PageDoc. Unknown fields are dropped by design. */
  function createPageDoc(input) {
    const src = isPlainObject(input) ? input : {};
    const pageKind = String(src.page_kind || "service");
    const kindDef = Registry?.getPageKind ? Registry.getPageKind(pageKind) : null;
    const doc = {
      doc_version: DOC_VERSION,
      id: String(src.id || makeId("page")),
      surface: String(src.surface || ""),
      vertical: String(src.vertical || kindDef?.vertical || ""),
      page_kind: pageKind,
      service_type: trimText(src.service_type, 80),
      category: normalizeCategory(src.category),
      locale: String(src.locale || "ja-JP"),
      entity: normalizeEntity(src.entity),
      profile: normalizeProfile(src.profile),
      blocks: normalizeBlocks(src.blocks, pageKind),
      seo: normalizeSeo(src.seo),
      structured_data: isPlainObject(src.structured_data) ? { ...src.structured_data } : {},
      media_plan: normalizeMediaPlan(src.media_plan),
      internal_links: normalizeInternalLinks(src.internal_links),
      conversion: normalizeConversion(src.conversion),
      actions: normalizeActions(src.actions),
      quality: normalizeQuality(src.quality),
      provenance: isPlainObject(src.provenance) ? { ...src.provenance } : {},
      meta: normalizeMeta(src.meta),
    };
    return doc;
  }

  function normalizeDoc(doc) {
    return createPageDoc(doc);
  }

  function cloneDoc(doc) {
    return JSON.parse(JSON.stringify(doc));
  }

  /** Version upgrade path. Each step must be additive and lossless. */
  function migrateDoc(doc) {
    if (!isPlainObject(doc)) return createPageDoc({});
    let next = { ...doc };
    const from = Number(next.doc_version || 0);
    if (from > DOC_VERSION) {
      throw new Error(`doc_version ${from} is newer than supported ${DOC_VERSION}`);
    }
    if (from < 1) next.doc_version = 1;
    if (from < 2) {
      next.doc_version = 2;
      next.media_plan = Array.isArray(next.media_plan) ? next.media_plan : [];
      next.internal_links = Array.isArray(next.internal_links) ? next.internal_links : [];
      next.conversion = isPlainObject(next.conversion) ? next.conversion : {};
      next.quality = isPlainObject(next.quality) ? next.quality : {};
    }
    return normalizeDoc(next);
  }

  function touch(doc) {
    if (doc?.meta) doc.meta.updated_at = nowIso();
    return doc;
  }

  global.TasuPageGenSchema = {
    DOC_VERSION,
    STATUS,
    PUBLISH_STATUS,
    SOURCE,
    LIMITS,
    isPlainObject,
    splitPath,
    getPath,
    setPath,
    trimText,
    toStringArray,
    nowIso,
    makeId,
    createPageDoc,
    normalizeDoc,
    cloneDoc,
    migrateDoc,
    touch,
  };
})(typeof window !== "undefined" ? window : globalThis);
