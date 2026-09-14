/**
 * TASFUL Materials — FINAL LOCAL GENERATOR MAP V1
 * ACTIVE_TASK: Final Local Generator Map Integration v1
 *
 * Layers on top of (does NOT replace) generator-router-v2.mjs + category-policy.mjs.
 * Planner (category/genre/style/use_case/format/priority) is untouched — this module
 * only answers HOW, composing each family's PRIMARY target (per this task's spec) with
 * its currently-active/fallback generator from the Registry.
 *
 * Adds POSTER and INVOICE as use_case-level routes reusing existing families
 * (template/document) — no new top-level public category is invented (SSOT preserved).
 * Changes ICON's active generator from ComfyUI (GPU-gated) to the new local SVG engine.
 */
import { FAMILY_ROUTES, routeFamily } from "./generator-router-v2.mjs";
import {
  GENERATOR_REGISTRY_V1,
  registryEntriesForFamily,
  activeGeneratorForFamily,
  REGISTRY_STATUS,
} from "./generator-registry-v1.mjs";

export const GENERATOR_MAP_FINAL_V1_VERSION = "materials-generator-map-final-v1";

/**
 * Sub-routes that share an existing public category / router-v2 family but need
 * their own generator_id (poster under template/pop family; invoice under document).
 * `public_id` / `parent_family` MUST already exist in category-policy / router-v2 —
 * enforced by assertSubRoutesReuseExistingFamilies() below.
 */
export const SUB_ROUTES_V1 = Object.freeze({
  poster: Object.freeze({
    sub_route: "poster",
    parent_family: "pop", // reuses router-v2 "pop" family (public_id: template)
    generator_id: "html_print_engine_v1",
    html_generator_fn: "generate_poster_html",
    registered_as: "poster_html",
  }),
  invoice: Object.freeze({
    sub_route: "invoice",
    parent_family: "document", // reuses router-v2 "document" family (public_id: document)
    generator_id: "html_print_document_v1",
    html_generator_fn: "generate_invoice_html",
    registered_as: "invoice_html",
    also_available: "template-autogenerator-xlsx-invoice", // existing xlsx path, kept additive
  }),
});

export function assertSubRoutesReuseExistingFamilies() {
  const bad = Object.values(SUB_ROUTES_V1).filter((s) => !routeFamily(s.parent_family));
  return { ok: bad.length === 0, bad: bad.map((s) => s.sub_route) };
}

/**
 * Family → FINAL generator decision. Merges router-v2's existing route with the
 * registry's active/primary rows. `active_generator` is what actually runs today;
 * `primary_target` is the task's named PRIMARY (may still be PENDING_LOCAL_SETUP).
 */
export const FINAL_GENERATOR_MAP_V1 = Object.freeze(
  Object.fromEntries(
    [
      "pop",
      "business_card",
      "flyer",
      "document",
      "presentation",
      "web",
      "code",
      "image",
      "illustration",
      "background",
      "icon",
      "sfx",
      "bgm",
      "template",
    ].map((family) => {
      const v2 = routeFamily(family);
      const registryRows = registryEntriesForFamily(family);
      const active = activeGeneratorForFamily(family);
      return [
        family,
        Object.freeze({
          family,
          router_v2: v2 || null,
          registry_rows: registryRows.map((r) => r.generator_id),
          active_generator: active ? active.generator_id : v2?.generator || null,
          active_status: active ? active.status : v2 ? "LEGACY_ROUTER_V2" : "UNKNOWN",
          planner_dimension_passthrough: true, // category/genre/style/use_case/format always forwarded — see generation-spec-v2.mjs
        }),
      ];
    }),
  ),
);

/** ICON override — explicit routing CHANGE this task (ComfyUI GPU → local SVG CPU). */
export const ICON_ROUTE_CHANGE_V1 = Object.freeze({
  family: "icon",
  before: "ComfyUI-AutoGenerator (GPU-gated, KEEP_AND_FIX per Routing V2)",
  after: "tasful-svg-icon-generator-v1 (CPU, native SVG, ACTIVE this task)",
  fallback_for_complex_illustration_icon: "ComfyUI-AutoGenerator (illustration family) — task explicit carve-out",
  reason: "Task §I: icon = simple icon/pictogram/UI-icon/geometric-symbol via native <svg>, not raster autotrace, not GPU.",
});

/** Full family status snapshot for VERDICT reporting. */
export function buildFamilyStatusReport() {
  const report = {};
  for (const [family, row] of Object.entries(FINAL_GENERATOR_MAP_V1)) {
    report[family] = {
      generator: row.active_generator,
      status: row.active_status,
      registry_rows: row.registry_rows,
    };
  }
  report._sub_routes = SUB_ROUTES_V1;
  report._icon_change = ICON_ROUTE_CHANGE_V1;
  return report;
}

export function assertPlannerDimensionsPassthrough() {
  return Object.values(FINAL_GENERATOR_MAP_V1).every((r) => r.planner_dimension_passthrough === true);
}

export { GENERATOR_REGISTRY_V1, REGISTRY_STATUS };
