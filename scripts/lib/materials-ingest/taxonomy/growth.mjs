/**
 * Auto Taxonomy Growth — middle/small/genre/tag only.
 * Top-level categories FIXED. No auto delete/merge.
 */
import {
  TAXONOMY_POLICY,
} from "../existing-register/ssot.mjs";

export const TAXONOMY_GROWTH_VERSION = "materials-taxonomy-auto-growth-v1";

/** Display name → internal slug normalization + synonyms. */
export const TAXONOMY_SYNONYMS = Object.freeze({
  lofi: ["lo-fi", "lo fi", "lofi", "ローファイ", "ろーふぁい"],
  cinematic: ["cinematic", "シネマティック", "映画風"],
  vlog: ["vlog", "ブイログ", "Vlog"],
  business: ["business", "ビジネス", "企業", "corporate"],
  office: ["office", "オフィス", "事務所"],
  cafe: ["cafe", "café", "カフェ"],
  cyber: ["cyber", "cyberpunk", "サイバー", "サイバーパンク"],
});

export function normalizeTaxonomySlug(raw) {
  const s = String(raw || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  for (const [canon, aliases] of Object.entries(TAXONOMY_SYNONYMS)) {
    const normAliases = aliases.map((a) =>
      String(a)
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, "-"),
    );
    if (s === canon || normAliases.includes(s)) return canon;
  }
  return s;
}

export function displayNameForSlug(slug) {
  const map = {
    lofi: "Lo-fi",
    cinematic: "Cinematic",
    vlog: "Vlog",
    business: "Business",
    office: "Office",
    cafe: "Cafe",
    cyber: "Cyber",
  };
  if (map[slug]) return map[slug];
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Demand signal contract — do not invent live values.
 */
export const DEMAND_SIGNAL_CONTRACT = Object.freeze({
  search_count: "CONNECTED_OR_PARTIAL",
  zero_result_search: "AVAILABLE_LATER",
  download_count: "CONNECTED_OR_PARTIAL",
  favorite_count: "AVAILABLE_LATER",
  inventory_shortage: "CONNECTED",
  user_survey_request: "AVAILABLE_LATER",
  category_demand: "CONNECTED_VIA_DEMAND_ENGINE_V1",
  tag_demand: "AVAILABLE_LATER",
  notes: {
    user_survey_request:
      "Survey alone NEVER creates taxonomy. Combine with search/download/inventory weights later.",
  },
});

/**
 * Create taxonomy candidate. 1 asset alone → reject.
 */
export function evaluateTaxonomyCandidate(input = {}) {
  const scope = String(input.scope || "genre");
  const topLevel = String(input.top_level || "");
  const rawName = String(input.name || input.slug || "");
  const slug = normalizeTaxonomySlug(rawName);
  const assetCount = Number(input.asset_count) || 0;
  const existingSlugs = new Set(
    (input.existing_slugs || []).map((s) => normalizeTaxonomySlug(s)),
  );
  const licenseSafe = input.license_safe !== false;
  const contentSafe = input.content_safe !== false;
  const mappingValid = input.mapping_valid !== false;

  const report = {
    scope,
    top_level: topLevel,
    raw_name: rawName,
    slug,
    display_name: displayNameForSlug(slug),
    asset_count: assetCount,
    CANDIDATE_VALID: false,
    DUPLICATE_CATEGORY: false,
    NAME_NORMALIZED: Boolean(slug),
    MINIMUM_STOCK_MET: assetCount >= TAXONOMY_POLICY.MINIMUM_STOCK_PUBLIC,
    LICENSE_SAFE: licenseSafe,
    CONTENT_SAFE: contentSafe,
    MAPPING_VALID: mappingValid,
    PUBLISH: false,
    HOLD_REASON: null,
  };

  if (!TAXONOMY_POLICY.AUTO_ADD_SCOPE.includes(scope)) {
    report.HOLD_REASON = "scope_not_auto_addable";
    return report;
  }
  if (!slug) {
    report.HOLD_REASON = "name_not_normalizable";
    return report;
  }
  if (existingSlugs.has(slug)) {
    report.DUPLICATE_CATEGORY = true;
    report.HOLD_REASON = "synonym_or_duplicate_taxonomy";
    return report;
  }
  if (assetCount < TAXONOMY_POLICY.MIN_ASSETS_FOR_CANDIDATE) {
    report.HOLD_REASON = "below_min_assets_for_candidate";
    return report;
  }
  if (!report.MINIMUM_STOCK_MET) {
    report.HOLD_REASON = "minimum_stock_not_met";
    return report;
  }
  if (!licenseSafe) {
    report.HOLD_REASON = "license_unknown_or_unsafe";
    return report;
  }
  if (!contentSafe) {
    report.HOLD_REASON = "content_unsafe";
    return report;
  }
  if (!mappingValid) {
    report.HOLD_REASON = "mapping_invalid";
    return report;
  }

  report.CANDIDATE_VALID = true;
  report.PUBLISH = true;
  return report;
}

/**
 * Weight survey signal — never alone sufficient.
 */
export function combineDemandSignals(signals = {}) {
  const survey = Number(signals.user_survey_request) || 0;
  const search = Number(signals.search_count) || 0;
  const downloads = Number(signals.download_count) || 0;
  const shortage = Number(signals.inventory_shortage) || 0;
  const score =
    search * 0.35 + downloads * 0.25 + shortage * 0.3 + survey * 0.1;
  return {
    score: Number(score.toFixed(4)),
    survey_alone_creates_category: false,
    sufficient_for_candidate_review: score >= 3 && (search > 0 || downloads > 0 || shortage > 0),
    note: "Survey weight capped; requires other signals",
  };
}

export { TAXONOMY_POLICY };
