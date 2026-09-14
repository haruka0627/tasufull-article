/**
 * Canonical Generation Spec V2 — reuse existing planner fields.
 * Does not invent a parallel genre taxonomy.
 */
export const GENERATION_SPEC_V2_VERSION = "materials-generation-spec-v2";

export const SPEC_TOKENS = Object.freeze({
  web: "TASFUL_WEB_SPEC",
  code: "TASFUL_CODE_SPEC",
  presentation: "TASFUL_PRES_SPEC",
  template: "TASFUL_TPL_SPEC",
  sfx: "TASFUL_SFX_SPEC",
  image: "TASFUL_IMG_SPEC",
  illustration: "TASFUL_ILL_SPEC",
  background: "TASFUL_BG_SPEC",
  icon: "TASFUL_ICON_SPEC",
  document: "TASFUL_TEXT_SPEC",
});

export const PLANNER_SPEC_FIELDS = Object.freeze([
  "category",
  "genre",
  "style",
  "use_case",
  "format",
]);

export function grabSpecPairs(raw, token) {
  const text = String(raw || "");
  if (token && !text.includes(token)) return null;
  const out = {};
  const re = /([a-z_]+)=([a-z0-9_]+)/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return Object.keys(out).length ? out : null;
}

export function specHonoredDimensions(spec = {}) {
  return PLANNER_SPEC_FIELDS.filter((k) => {
    const v = spec[k] ?? spec[k === "format" ? "output_type" : k];
    return Boolean(String(v || "").trim());
  });
}

export function dimensionLoss(spec = {}) {
  const missing = PLANNER_SPEC_FIELDS.filter((k) => {
    if (k === "category") return !String(spec.category || spec.asset_type || spec.genre || "").trim();
    if (k === "format") return !String(spec.format || spec.output_type || spec.asset_form || spec.layout_type || "").trim();
    return !String(spec[k] || "").trim();
  });
  return { ok: missing.length === 0, missing };
}
