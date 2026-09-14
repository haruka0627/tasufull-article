/**
 * Legacy Materials genre backfill V1 — index metadata only.
 * Unique structured evidence → write canonical genre ID.
 * Ambiguous / insufficient → leave unchanged. Never LLM/title guessing.
 */
import {
  SFX_LEGACY_UI_USAGE_MAP,
  getSfxSubgenre,
} from "./sfx-demand-genre-ssot.mjs";
import {
  IMAGE_LEGACY_UI_USAGE_MAP,
  getImageSubgenre,
} from "./image-demand-genre-ssot.mjs";
import {
  ILLUSTRATION_LEGACY_UI_USAGE_MAP,
  getIllustrationSubgenre,
} from "./illustration-demand-genre-ssot.mjs";
import {
  BACKGROUND_LEGACY_UI_USAGE_MAP,
  getBackgroundSubgenre,
} from "./background-demand-genre-ssot.mjs";
import {
  WEB_LEGACY_UI_USAGE_MAP,
  getWebSubgenre,
} from "./web-demand-genre-ssot.mjs";
import {
  CODE_LANGUAGES,
  CODE_LEGACY_UI_USAGE_MAP,
  getCodeSubgenre,
} from "./code-demand-genre-ssot.mjs";
import { getTextSubgenre } from "./text-demand-genre-ssot.mjs";
import {
  ICON_LEGACY_UI_USAGE_MAP,
  getIconSubgenre,
} from "./icon-demand-genre-ssot.mjs";
import {
  PRESENTATION_LEGACY_PURPOSE_MAP,
  getPresentationPurpose,
} from "./presentation-demand-genre-ssot.mjs";
import { getGenreCatalog } from "../materials-list-genre-filter-contract.mjs";

export const LEGACY_GENRE_BACKFILL_VERSION = "materials-legacy-genre-backfill-v1";

export const BACKFILL_STATUS = Object.freeze({
  ALREADY_VALID: "ALREADY_VALID",
  NORMALIZED_EXISTING: "NORMALIZED_EXISTING",
  BACKFILLED_DETERMINISTIC: "BACKFILLED_DETERMINISTIC",
  AMBIGUOUS_UNCHANGED: "AMBIGUOUS_UNCHANGED",
  INSUFFICIENT_METADATA: "INSUFFICIENT_METADATA",
  INVALID_REFERENCE: "INVALID_REFERENCE",
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
});

const PUBLIC_TYPES = Object.freeze([
  "sfx",
  "bgm",
  "image",
  "illustration",
  "background",
  "web",
  "code",
  "template",
  "icon",
  "presentation",
  "document",
  "tool",
]);

const CODE_LANGUAGE_BLOCK = new Set([
  ...Object.keys(CODE_LANGUAGES),
  ...Object.values(CODE_LANGUAGES).map((l) => String(l.label || "").toLowerCase()),
  "javascript",
  "typescript",
  "python",
  "sql",
  "js",
  "ts",
  "py",
]);

const GENERIC_TOKENS = new Set([
  "",
  "sfx",
  "image",
  "illustration",
  "background",
  "web",
  "web-material",
  "code",
  "code-material",
  "template",
  "icon",
  "presentation",
  "document",
  "png",
  "wav",
  "html",
  "css",
  "docx",
  "pptx",
  "ppt",
  "ja",
  "en",
  "シンプル",
  "generic",
  "general",
  "sound",
  "file",
  "data",
  "reader",
  "thumb",
  "interface",
  "office",
  "empty",
  "modern",
  "clean",
]);

function typeOf(item) {
  return String(item?.category_id || item?.asset_type || "").trim();
}

function norm(v) {
  return String(v || "").trim();
}

function lower(v) {
  return norm(v).toLowerCase();
}

export function catalogIds(categoryId) {
  return new Set(getGenreCatalog(categoryId).map((g) => g.id));
}

function legacyRows(categoryId) {
  if (categoryId === "sfx") return SFX_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "image") return IMAGE_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "illustration") return ILLUSTRATION_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "background") return BACKGROUND_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "web") return WEB_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "code") return CODE_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "icon") return ICON_LEGACY_UI_USAGE_MAP.map((r) => ({ token: r.legacy, ids: [...r.genre_ids] }));
  if (categoryId === "presentation") {
    return PRESENTATION_LEGACY_PURPOSE_MAP.map((r) => ({ token: r.legacy, ids: [r.purpose_id] }));
  }
  if (categoryId === "document") {
    return [
      { token: "メール", ids: ["businessemail"] },
      { token: "email", ids: ["businessemail"] },
      { token: "sns", ids: ["snspost"] },
      { token: "投稿", ids: ["snspost"] },
      { token: "お知らせ", ids: ["announcement"] },
      { token: "告知", ids: ["announcement"] },
    ];
  }
  return [];
}

function lookupSubgenreParent(categoryId, token) {
  const id = String(token || "").replace(/-/g, "_");
  if (!id) return null;
  if (categoryId === "sfx") return getSfxSubgenre(id)?.genre?.id || null;
  if (categoryId === "image") return getImageSubgenre(id)?.genre?.id || null;
  if (categoryId === "illustration") return getIllustrationSubgenre(id)?.genre?.id || null;
  if (categoryId === "background") return getBackgroundSubgenre(id)?.genre?.id || null;
  if (categoryId === "web") return getWebSubgenre(id)?.genre?.id || null;
  if (categoryId === "code") return getCodeSubgenre(id)?.genre?.id || null;
  if (categoryId === "icon") return getIconSubgenre(id)?.genre?.id || null;
  if (categoryId === "document") return getTextSubgenre(id)?.genre?.id || null;
  if (categoryId === "presentation") return getPresentationPurpose(id)?.id || null;
  return null;
}

function isBlockedLanguageToken(categoryId, token) {
  if (categoryId !== "code") return false;
  return CODE_LANGUAGE_BLOCK.has(lower(token));
}

function isGeneric(token) {
  return GENERIC_TOKENS.has(lower(token));
}

function mapToken(categoryId, token) {
  const t = norm(token);
  if (!t || isGeneric(t) || isBlockedLanguageToken(categoryId, t)) {
    return { ids: [], multi: false };
  }
  const ids = catalogIds(categoryId);
  if (ids.has(t)) return { ids: [t], multi: false };
  const parent = lookupSubgenreParent(categoryId, t);
  if (parent && ids.has(parent)) return { ids: [parent], multi: false };
  const rows = legacyRows(categoryId).filter((r) => lower(r.token) === lower(t));
  const all = new Set();
  for (const row of rows) row.ids.forEach((g) => all.add(g));
  if (all.size > 1) return { ids: [...all], multi: true };
  if (all.size === 1) return { ids: [...all], multi: false };
  return { ids: [], multi: false };
}

function structuredTokens(item) {
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  const out = [];
  const sub = norm(item?.subcategory);
  if (sub) out.push(sub);
  const purpose = norm(item?.purpose);
  if (purpose) out.push(purpose);
  const use = norm(item?.use_case);
  if (use) out.push(use);
  for (const tag of tags) {
    const t = norm(tag);
    if (t) out.push(t);
  }
  return out;
}

function slugPrefixCatalogHit(item, categoryId) {
  const ids = catalogIds(categoryId);
  const slug = lower(item?.slug);
  if (!slug) return null;
  for (const id of ids) {
    if (slug === id || slug.startsWith(`${id}-`)) return id;
  }
  return null;
}

export function classifyLegacyGenreBackfill(item) {
  const categoryId = typeOf(item);
  if (!PUBLIC_TYPES.includes(categoryId)) {
    return { status: BACKFILL_STATUS.UNSUPPORTED_TYPE, genre: "", reason: "unknown_type" };
  }
  const ids = catalogIds(categoryId);
  if (ids.size === 0) {
    return { status: BACKFILL_STATUS.UNSUPPORTED_TYPE, genre: "", reason: "no_catalog" };
  }

  const existing = norm(item?.genre) || (categoryId === "presentation" ? norm(item?.purpose) : "");
  if (existing && ids.has(existing)) {
    return { status: BACKFILL_STATUS.ALREADY_VALID, genre: existing, reason: "exact" };
  }
  if (existing) {
    const mapped = mapToken(categoryId, existing);
    if (mapped.multi) {
      return { status: BACKFILL_STATUS.AMBIGUOUS_UNCHANGED, genre: "", reason: "existing_multi", candidates: mapped.ids };
    }
    if (mapped.ids.length === 1 && ids.has(mapped.ids[0])) {
      return {
        status: BACKFILL_STATUS.NORMALIZED_EXISTING,
        genre: mapped.ids[0],
        reason: "alias",
        from: existing,
      };
    }
    return { status: BACKFILL_STATUS.INVALID_REFERENCE, genre: "", reason: "not_in_catalog", from: existing };
  }

  const hits = new Set();
  let multi = false;
  const candidates = new Set();
  for (const token of structuredTokens(item)) {
    const mapped = mapToken(categoryId, token);
    if (mapped.multi) {
      multi = true;
      mapped.ids.forEach((g) => candidates.add(g));
    } else {
      mapped.ids.forEach((g) => {
        if (ids.has(g)) hits.add(g);
      });
    }
  }
  const slugHit = slugPrefixCatalogHit(item, categoryId);
  if (slugHit) hits.add(slugHit);

  if (multi) {
    return {
      status: BACKFILL_STATUS.AMBIGUOUS_UNCHANGED,
      genre: "",
      reason: "multi_legacy_token",
      candidates: [...candidates],
    };
  }
  if (hits.size > 1) {
    return {
      status: BACKFILL_STATUS.AMBIGUOUS_UNCHANGED,
      genre: "",
      reason: "conflicting_unique_tokens",
      candidates: [...hits],
    };
  }
  if (hits.size === 1) {
    const genre = [...hits][0];
    return { status: BACKFILL_STATUS.BACKFILLED_DETERMINISTIC, genre, reason: "unique_structured" };
  }
  return { status: BACKFILL_STATUS.INSUFFICIENT_METADATA, genre: "", reason: "no_unique_token" };
}

export function applyClassification(item, classification) {
  if (
    classification.status !== BACKFILL_STATUS.BACKFILLED_DETERMINISTIC &&
    classification.status !== BACKFILL_STATUS.NORMALIZED_EXISTING
  ) {
    return { changed: false, item };
  }
  if (item.genre === classification.genre) return { changed: false, item };
  return { changed: true, item: { ...item, genre: classification.genre } };
}

export function scanItems(items) {
  const byStatus = {};
  for (const s of Object.values(BACKFILL_STATUS)) byStatus[s] = 0;
  const byType = {};
  const decisions = [];
  for (const item of items) {
    const t = typeOf(item) || "unknown";
    if (!byType[t]) {
      byType[t] = { total: 0, ...Object.fromEntries(Object.values(BACKFILL_STATUS).map((s) => [s, 0])) };
    }
    byType[t].total += 1;
    const c = classifyLegacyGenreBackfill(item);
    byStatus[c.status] += 1;
    byType[t][c.status] += 1;
    decisions.push({
      id: item.id,
      category_id: t,
      status: c.status,
      genre: c.genre,
      from: item.genre || "",
      reason: c.reason,
    });
  }
  return { byStatus, byType, decisions };
}

export function applyScan(items) {
  const next = [];
  let changed = 0;
  const frozen = [];
  for (const item of items) {
    const c = classifyLegacyGenreBackfill(item);
    const applied = applyClassification(item, c);
    if (applied.changed) changed += 1;
    next.push(applied.item);
    frozen.push({
      id: item.id,
      download_url: item.download_url,
      download_filename: item.download_filename,
      download_path: item.download_path,
      license: item.license,
      license_status: item.license_status,
      source_generator: item.source_generator,
    });
  }
  return { items: next, changed, frozen };
}

export function integrityFrozen(beforeItems, afterItems) {
  if (beforeItems.length !== afterItems.length) return { ok: false, reason: "count" };
  for (let i = 0; i < beforeItems.length; i += 1) {
    const a = beforeItems[i];
    const b = afterItems[i];
    if (a.id !== b.id) return { ok: false, reason: "id", id: a.id };
    if (a.download_url !== b.download_url) return { ok: false, reason: "download_url", id: a.id };
    if (a.download_filename !== b.download_filename) return { ok: false, reason: "download_filename", id: a.id };
    if (a.download_path !== b.download_path) return { ok: false, reason: "download_path", id: a.id };
    if (a.license !== b.license) return { ok: false, reason: "license", id: a.id };
    if (a.license_status !== b.license_status) return { ok: false, reason: "license_status", id: a.id };
    if (a.source_generator !== b.source_generator) return { ok: false, reason: "source_generator", id: a.id };
  }
  return { ok: true };
}

export function genreCounts(items, categoryId) {
  const ids = [...catalogIds(categoryId)];
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  let unclassified = 0;
  const rows = items.filter((it) => typeOf(it) === categoryId);
  for (const it of rows) {
    const g = norm(it.genre);
    if (g && Object.prototype.hasOwnProperty.call(counts, g)) counts[g] += 1;
    else unclassified += 1;
  }
  return { total: rows.length, counts, unclassified };
}

export function accountingOk(items, categoryId) {
  const { total, counts, unclassified } = genreCounts(items, categoryId);
  const classified = Object.values(counts).reduce((a, b) => a + b, 0);
  return classified + unclassified === total;
}

export const CODE_LANGUAGE_IS_NOT_GENRE = Object.freeze([...CODE_LANGUAGE_BLOCK]);
export { PUBLIC_TYPES };
