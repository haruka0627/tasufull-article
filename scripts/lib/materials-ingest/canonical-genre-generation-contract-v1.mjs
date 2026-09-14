/**
 * Canonical genre contract for NEW Materials generation.
 * Reuses getGenreCatalog / category-policy. Does not invent a second taxonomy.
 * Legacy empty genre stays empty (ingest). Generation requires a canonical ID.
 */
import {
  blockedGenerationReason,
  policyForPublicId,
} from "../../../Materials-CommonRunner/lib/auto-supply/category-policy.mjs";
import { CODE_LANGUAGES } from "./code-demand-genre-ssot.mjs";
import { getGenreCatalog } from "../materials-list-genre-filter-contract.mjs";

export const CANONICAL_GENRE_CONTRACT_VERSION = "materials-canonical-genre-generation-v1";

export const GENRE_ERROR = Object.freeze({
  REQUIRED: "GENRE_REQUIRED",
  NOT_CANONICAL: "GENRE_NOT_CANONICAL",
  LANGUAGE_IS_NOT_GENRE: "LANGUAGE_IS_NOT_GENRE",
  STYLE_IS_NOT_GENRE: "STYLE_IS_NOT_GENRE",
  SUBCATEGORY_IS_NOT_GENRE: "SUBCATEGORY_IS_NOT_GENRE",
  FORMAT_IS_NOT_GENRE: "FORMAT_IS_NOT_GENRE",
  PARITY_MISMATCH: "PLANNED_GENERATED_INDEXED_GENRE_MISMATCH",
  GENERATOR_NOT_EXECUTABLE: "GENERATOR_NOT_EXECUTABLE",
  MALFORMED: "GENRE_MALFORMED",
});

export const LANGUAGE_OR_FORMAT_IDS = Object.freeze([
  ...Object.keys(CODE_LANGUAGES),
  "javascript",
  "typescript",
  "python",
  "sql",
  "csv",
  "json",
  "js",
  "ts",
  "html",
  "css",
]);

export const STYLE_NOT_GENRE_IDS = Object.freeze([
  "シンプル",
  "simple",
  "clean",
  "cute",
  "minimal",
  "heavy",
]);

export const TEMPLATE_GENERATOR_CATEGORY_TO_GENRE = Object.freeze({
  BUSINESS_CARD: "名刺",
  POP: "POP",
  FLYER: "チラシ",
  MENU_PRICE_LIST: "メニュー・料金表",
  SHOP_CARD: "ショップカード",
});

export const GENERATOR_GATE_CATEGORY = Object.freeze({
  sfx: "sfx",
  web: "web",
  code: "code",
  document: "document",
  text: "document",
  presentation: "presentation",
  image: "image",
  illustration: "illustration",
  background: "background",
  icon: "icon",
  template: "template",
  bgm: "bgm",
  tool: "tool",
});

export function canonicalGenreIds(categoryId) {
  return new Set(getGenreCatalog(categoryId).map((g) => g.id));
}

export function plannedGenreFromSpec(categoryId, spec = {}) {
  const cat = String(categoryId || "");
  if (cat === "presentation") {
    return String(spec.genre || spec.purpose || "").trim();
  }
  return String(spec.genre || "").trim();
}

function fail(code, extra = {}) {
  return {
    ok: false,
    code,
    genre: "",
    fallbackUsed: false,
    ...extra,
  };
}

export function assertCanonicalGenre({
  categoryId,
  genre,
  language,
  style,
  subcategory,
  mode = "generation",
} = {}) {
  const cat = String(categoryId || "").trim();
  const raw = genre == null ? "" : String(genre).trim();
  if (/[\u0000-\u001f]/.test(String(genre ?? "")) || /[<>{}]/.test(raw)) {
    return fail(GENRE_ERROR.MALFORMED, { categoryId: cat, requested: String(genre ?? "") });
  }
  if (!raw) {
    if (mode === "ingest") {
      return { ok: true, genre: "", code: null, optionalEmpty: true };
    }
    return fail(GENRE_ERROR.REQUIRED, { categoryId: cat });
  }
  const allow = canonicalGenreIds(cat);
  if (allow.has(raw)) {
    return { ok: true, genre: raw, code: null, fallbackUsed: false };
  }
  const lower = raw.toLowerCase();
  if (LANGUAGE_OR_FORMAT_IDS.includes(lower) || LANGUAGE_OR_FORMAT_IDS.includes(raw)) {
    return fail(GENRE_ERROR.LANGUAGE_IS_NOT_GENRE, { categoryId: cat, requested: raw, language: language || raw });
  }
  if (raw === "csv" || raw === "json" || lower === "csv" || lower === "json") {
    return fail(GENRE_ERROR.FORMAT_IS_NOT_GENRE, { categoryId: cat, requested: raw });
  }
  if (STYLE_NOT_GENRE_IDS.includes(raw) || STYLE_NOT_GENRE_IDS.includes(lower)) {
    return fail(GENRE_ERROR.STYLE_IS_NOT_GENRE, { categoryId: cat, requested: raw, style: style || raw });
  }
  if (subcategory && raw === String(subcategory)) {
    return fail(GENRE_ERROR.SUBCATEGORY_IS_NOT_GENRE, { categoryId: cat, requested: raw, subcategory });
  }
  if (language && raw === String(language)) {
    return fail(GENRE_ERROR.LANGUAGE_IS_NOT_GENRE, { categoryId: cat, requested: raw, language });
  }
  if (style && raw === String(style)) {
    return fail(GENRE_ERROR.STYLE_IS_NOT_GENRE, { categoryId: cat, requested: raw, style });
  }
  return fail(GENRE_ERROR.NOT_CANONICAL, { categoryId: cat, requested: raw });
}

export function inspectIngestGenre(categoryId, genre) {
  return assertCanonicalGenre({ categoryId, genre, mode: "ingest" });
}

export function mergeSpecPreservingPlannedGenre(meta = {}, specMeta = null) {
  const planned = String(meta?.genre || "").trim();
  if (!specMeta) return { ...meta };
  const merged = { ...meta, ...specMeta };
  if (planned) merged.genre = planned;
  return merged;
}

export function assertGenreParity({ planned, generated, indexed } = {}) {
  const p = String(planned || "").trim();
  const g = String(generated || "").trim();
  const i = String(indexed || "").trim();
  if (!p || !g || !i || p !== g || g !== i) {
    return fail(GENRE_ERROR.PARITY_MISMATCH, { planned: p, generated: g, indexed: i });
  }
  return { ok: true, planned: p, generated: g, indexed: i, code: null };
}

export function attachGenerationGenreEvidence({
  categoryId,
  planned,
  generated,
  indexed,
} = {}) {
  const plannedCheck = assertCanonicalGenre({ categoryId, genre: planned, mode: "generation" });
  if (!plannedCheck.ok) return plannedCheck;
  const generatedCheck = assertCanonicalGenre({ categoryId, genre: generated, mode: "generation" });
  if (!generatedCheck.ok) return generatedCheck;
  const indexedCheck = assertCanonicalGenre({ categoryId, genre: indexed, mode: "generation" });
  if (!indexedCheck.ok) return indexedCheck;
  return assertGenreParity({ planned, generated, indexed });
}

export function appendCanonicalGenreGateReasons(candidate, categoryId) {
  const spec = candidate?.spec || candidate || {};
  const genre = plannedGenreFromSpec(categoryId, spec);
  const result = assertCanonicalGenre({
    categoryId,
    genre,
    language: spec.language || candidate?.language,
    style: spec.style,
    subcategory: spec.subcategory,
    mode: "generation",
  });
  if (result.ok) return [];
  return [result.code];
}

export function executableGenerationStatus(categoryId, opts = {}) {
  const cat = String(categoryId || "").trim();
  const policy = policyForPublicId(cat);
  if (!policy) {
    return {
      executable: false,
      status: "GENERATOR_CONTRACT_MISSING",
      reason: "UNKNOWN_CATEGORY",
    };
  }
  if (opts.allowLocalProbe === true && policy.readiness === "READY") {
    return {
      executable: true,
      status: "GENERATOR_READY",
      reason: "LOCAL_PROBE_PERMITTED",
      dailyQuotaEligible: policy.auto_generation === true,
      readiness: policy.readiness,
    };
  }
  const blocked = blockedGenerationReason(policy);
  if (blocked) {
    const status =
      policy.readiness === "EXCLUDED"
        ? "GENERATOR_DISABLED"
        : policy.auto_generation === false && policy.readiness === "READY"
          ? "GENERATOR_DISABLED"
          : "GENERATOR_BLOCKED";
    return {
      executable: false,
      status,
      reason: blocked,
      readiness: policy.readiness,
    };
  }
  return {
    executable: true,
    status: "GENERATOR_READY",
    reason: null,
    dailyQuotaEligible: true,
    readiness: policy.readiness,
  };
}

export function assertExecutableGeneration(categoryId, opts = {}) {
  const status = executableGenerationStatus(categoryId, opts);
  if (!status.executable) {
    return fail(GENRE_ERROR.GENERATOR_NOT_EXECUTABLE, {
      categoryId,
      ...status,
    });
  }
  return { ok: true, ...status };
}

export function countGenre(items, categoryId, genreId) {
  return (items || []).filter(
    (it) =>
      (it.category_id === categoryId || it.asset_type === categoryId) &&
      String(it.genre || "") === String(genreId),
  ).length;
}

export function emptyGenreIds(items) {
  return (items || [])
    .filter((it) => !String(it.genre || "").trim())
    .map((it) => it.id)
    .sort();
}
