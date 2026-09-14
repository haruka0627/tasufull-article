/**
 * Materials Generator Router V2 — HOW to generate, not WHAT.
 * Planner remains SSOT for category/genre/style/use-case/format.
 */
import { CATEGORY_POLICY_BY_PUBLIC_ID } from "../../../Materials-CommonRunner/lib/auto-supply/category-policy.mjs";

export const GENERATOR_ROUTER_V2_VERSION = "materials-generator-router-v2";

/** family → route. Decisions reuse existing engines; BGM stays BLOCKED_LICENSE. */
export const FAMILY_ROUTES = Object.freeze({
  image: Object.freeze({
    family: "image",
    public_id: "image",
    generator: "ComfyUI-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "local_comfyui",
    local_execution: "CONDITIONAL_GPU",
    live_generation: false,
  }),
  illustration: Object.freeze({
    family: "illustration",
    public_id: "illustration",
    generator: "ComfyUI-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "local_comfyui",
    local_execution: "CONDITIONAL_GPU",
    live_generation: false,
  }),
  background: Object.freeze({
    family: "background",
    public_id: "background",
    generator: "ComfyUI-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "local_comfyui",
    local_execution: "CONDITIONAL_GPU",
    live_generation: false,
  }),
  icon: Object.freeze({
    family: "icon",
    public_id: "icon",
    generator: "ComfyUI-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "local_comfyui",
    local_execution: "CONDITIONAL_GPU",
    live_generation: false,
  }),
  template: Object.freeze({
    family: "template",
    public_id: "template",
    generator: "Template-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  pop: Object.freeze({
    family: "pop",
    public_id: "template",
    generator: "Template-AutoGenerator",
    decision: "REPLACE_GENERATOR",
    new_generator: "html_print_pop",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  business_card: Object.freeze({
    family: "business_card",
    public_id: "template",
    generator: "Template-AutoGenerator",
    decision: "REPLACE_GENERATOR",
    new_generator: "html_print_business_card",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  flyer: Object.freeze({
    family: "flyer",
    public_id: "template",
    generator: "Template-AutoGenerator",
    decision: "REPLACE_GENERATOR",
    new_generator: "html_print_flyer",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  document: Object.freeze({
    family: "document",
    public_id: "document",
    generator: "Text-Materials-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
    note: "quota EXCLUDED — local/QA only",
  }),
  presentation: Object.freeze({
    family: "presentation",
    public_id: "presentation",
    generator: "Presentation-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  web: Object.freeze({
    family: "web",
    public_id: "web",
    generator: "Web-Materials-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  code: Object.freeze({
    family: "code",
    public_id: "code",
    generator: "Code-Materials-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "tasful_local",
    local_execution: "YES",
    live_generation: false,
  }),
  sfx: Object.freeze({
    family: "sfx",
    public_id: "sfx",
    generator: "SFX-AutoGenerator",
    decision: "KEEP_AND_FIX",
    license_status: "tasful_procedural",
    local_execution: "YES",
    live_generation: false,
  }),
  bgm: Object.freeze({
    family: "bgm",
    public_id: "bgm",
    generator: "BGM-AutoGenerator",
    decision: "BLOCKED",
    license_status: "BLOCKED_LICENSE",
    local_execution: "NO",
    live_generation: false,
  }),
});

export function routeFamily(family) {
  const id = String(family || "").trim().toLowerCase().replace(/-/g, "_");
  const aliases = {
    "web-material": "web",
    "code-material": "code",
    "business-card": "business_card",
    "text": "document",
  };
  const key = aliases[id] || id;
  return FAMILY_ROUTES[key] || null;
}

export function routeFromAssetType(assetType) {
  const at = String(assetType || "");
  if (at === "web-material") return FAMILY_ROUTES.web;
  if (at === "code-material") return FAMILY_ROUTES.code;
  return routeFamily(at);
}

export function assertPlannerNotGenerator(policy) {
  const gen = String(policy?.generator || "");
  return gen !== "MaterialsPlanner" && gen !== "DemandEngine";
}

export function policyGeneratorMatchesRoute(publicId) {
  const policy = CATEGORY_POLICY_BY_PUBLIC_ID[publicId];
  const route = routeFamily(publicId);
  if (!policy || !route) return { ok: false, reason: "unknown_family" };
  if (route.decision === "BLOCKED") {
    return { ok: policy.readiness === "BLOCKED_LICENSE" || policy.auto_generation === false, route, policy };
  }
  return { ok: policy.generator === route.generator, route, policy };
}
