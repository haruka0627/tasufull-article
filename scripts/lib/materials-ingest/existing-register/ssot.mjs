/**
 * Materials Existing Asset Register + Taxonomy Growth SSOT V1.
 * Separate from READY-5 Daily Auto Growth (do not change those caps/scheduler).
 *
 * Caps decision (Cursor):
 * - Image existing register: 30 valid/day
 * - Icon existing register: 30 valid/day
 * - Existing-register GLOBAL: 60 (Image+Icon)
 * - SEPARATE from READY-5 GLOBAL 150 (generation vs registration budgets)
 */
export const EXISTING_REGISTER_VERSION =
  "materials-existing-register-taxonomy-bgm-license-v1";

export const CURSOR_RECOMMENDED_IMAGE_ICON_DAILY_CAP = Object.freeze({
  IMAGE_VALID_PER_DAY: 30,
  ICON_VALID_PER_DAY: 30,
  EXISTING_REGISTER_GLOBAL_PER_DAY: 60,
  SEPARATE_FROM_READY5_GLOBAL_150: true,
  SEPARATE_FROM_NEW_GENERATION_QUOTA: true,
  rationale:
    "Registration is Drive→index work and remains separate from NEW generation (one category/day, shortage-driven max 30). The existing-register global 60 prevents Image+Icon double-burst.",
});

export const PER_TYPE_DAILY_MAX = Object.freeze({
  image: 30,
  icon: 30,
  illustration: 30,
  background: 30,
});

export const EXISTING_REGISTER_GLOBAL_MAX = 120;

export const PROVENANCE = Object.freeze({
  CONFIRMED: "PROVENANCE_CONFIRMED",
  INFERABLE: "PROVENANCE_INFERABLE",
  UNKNOWN: "PROVENANCE_UNKNOWN",
});

/** Auto-register allow rules. */
export const PROVENANCE_AUTO_RULE = Object.freeze({
  [PROVENANCE.CONFIRMED]: "AUTO_REGISTER",
  [PROVENANCE.INFERABLE]: "AUTO_REGISTER_IF_PACKAGE_EVIDENCE",
  [PROVENANCE.UNKNOWN]: "HOLD",
});

export const NEW_GENERATION_POLICY = Object.freeze({
  image: "LOCAL_FREE_COMFYUI_AUTHORIZED",
  icon: "LOCAL_FREE_COMFYUI_AUTHORIZED",
  illustration: "LOCAL_FREE_COMFYUI_AUTHORIZED",
  background: "LOCAL_FREE_COMFYUI_AUTHORIZED",
  paid_api: "FORBIDDEN",
  NEW_GENERATION_CHANGED: true,
  note: "Local ComfyUI free generation authorized; paid API / cloud GPU still forbidden",
});

export const TAXONOMY_POLICY = Object.freeze({
  TOP_LEVEL_FIXED: true,
  AUTO_ADD_SCOPE: Object.freeze([
    "middle_category",
    "small_category",
    "genre",
    "use_case",
    "theme",
    "style",
    "tag",
  ]),
  AUTO_DELETE_MERGE: false,
  MINIMUM_STOCK_PUBLIC: 5,
  MIN_ASSETS_FOR_CANDIDATE: 5,
  SYNONYM_NORMALIZATION: true,
});

export const MEDIA_EXTS = Object.freeze({
  image: Object.freeze([".png", ".jpg", ".jpeg", ".webp", ".gif"]),
  icon: Object.freeze([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]),
  illustration: Object.freeze([".png", ".jpg", ".jpeg", ".webp", ".gif"]),
  background: Object.freeze([".png", ".jpg", ".jpeg", ".webp", ".gif"]),
});

export const CONFIRMED_PROVIDERS = Object.freeze([
  "comfyui-local",
  "ComfyUI-AutoGenerator",
  "comfyui",
]);
