#!/usr/bin/env node
/**
 * Page Gen common engine — Phase 1 unit tests
 *   node scripts/test-page-gen-engine-phase1.mjs
 *
 * Loads the shared browser modules in a VM sandbox (same pattern as
 * scripts/test-business-directory-page-renderer-phase3a.mjs) and exercises
 * schema, slots, interview, provenance, validation, SEO, renderer, history,
 * actions, listing mapping, prompt building, intent routing and the engine.
 * No network, no DB, no surface integration.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;

function ok(label, detail = "") {
  pass += 1;
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function bad(label, detail = "") {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function assert(label, cond, detail = "") {
  if (cond) ok(label, detail);
  else bad(label, detail);
}

function throws(label, fn) {
  try {
    fn();
    bad(label, "expected throw");
  } catch {
    ok(label);
  }
}

const MODULES = [
  "page-gen-registry.js",
  "page-gen-blocks.js",
  "page-gen-schema.js",
  "page-gen-slots.js",
  "page-gen-provenance.js",
  "page-gen-validate.js",
  "page-gen-seo.js",
  "page-gen-actions.js",
  "page-gen-entitlement.js",
  "page-gen-conversion.js",
  "page-gen-quality.js",
  "page-gen-renderer.js",
  "page-gen-history.js",
  "page-gen-listing.js",
  "page-gen-prompt.js",
  "page-gen-intent.js",
  "page-gen-interview.js",
  "page-gen-component.js",
  "page-gen-engine.js",
];

function loadEngine() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  sandbox.JSON = JSON;
  sandbox.Math = Math;
  sandbox.Date = Date;
  for (const file of MODULES) {
    const code = fs.readFileSync(path.join(root, "shared", "page-gen", file), "utf8");
    vm.runInNewContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

console.log("=== Page Gen common engine — Phase 1 ===\n");

console.log("--- load ---");
const G = loadEngine();
MODULES.forEach((file) => {
  const name =
    "Tasu" +
    file
      .replace(/\.js$/, "")
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
  assert(`module exposed ${name}`, Boolean(G[name]));
});

const {
  TasuPageGenRegistry: Registry,
  TasuPageGenSchema: Schema,
  TasuPageGenBlocks: Blocks,
  TasuPageGenSlots: Slots,
  TasuPageGenInterview: Interview,
  TasuPageGenProvenance: Prov,
  TasuPageGenValidate: Validate,
  TasuPageGenSeo: Seo,
  TasuPageGenRenderer: Renderer,
  TasuPageGenHistory: History,
  TasuPageGenActions: Actions,
  TasuPageGenEntitlement: Entitlement,
  TasuPageGenConversion: Conversion,
  TasuPageGenQuality: Quality,
  TasuPageGenListing: ListingMap,
  TasuPageGenPrompt: Prompt,
  TasuPageGenIntent: IntentMod,
  TasuPageGenComponent: Component,
  TasuPageGenEngine: Engine,
} = G;

// --- registry -------------------------------------------------------------
console.log("\n--- registry (taxonomy) ---");
assert("built-in page kinds", Registry.listPageKinds().length >= 3);
assert("vendor kind vertical", Registry.getPageKind("vendor").vertical === "construction");
assert("surface ai route separation", Registry.resolveAiRoute("builder") === "builder_ai");
assert("platform route is gateway", Registry.resolveAiRoute("platform") === "gateway");
assert("bd route is bd_edge", Registry.resolveAiRoute("business_directory") === "bd_edge");
assert("kind allowed check", Registry.isKindAllowedOnSurface("vendor", "builder") === true);
assert("kind blocked check", Registry.isKindAllowedOnSurface("vendor", "business_directory") === false);
assert(
  "action allowed per surface",
  Registry.isActionAllowedOnSurface("contact_reveal", "builder") === true &&
    Registry.isActionAllowedOnSurface("contact_reveal", "platform") === false,
);

Registry.registerVertical({ id: "travel", label: "旅行", keywords: ["旅行", "宿"] });
Registry.registerPageKind({
  id: "tour",
  label: "ツアーページ",
  vertical: "travel",
  jsonLdType: "TouristTrip",
  keywords: ["ツアー", "旅行"],
  slots: ["business_name", "service_summary", "area", "price_text"],
  blocks: ["hero", "about", "pricing", "faq", "cta"],
  actions: { primary: "booking_request" },
});
assert("future vertical registered", Boolean(Registry.getVertical("travel")));
assert("future kind registered", Registry.getPageKind("tour").jsonLdType === "TouristTrip");
assert("future kind listed by vertical", Registry.listPageKinds("travel").length === 1);
throws("registerPageKind requires id", () => Registry.registerPageKind({}));

// --- schema ---------------------------------------------------------------
console.log("\n--- schema (PageDoc) ---");
const emptyDoc = Schema.createPageDoc({ surface: "builder", page_kind: "vendor" });
assert("doc_version", emptyDoc.doc_version === Schema.DOC_VERSION);
assert("vertical inferred from kind", emptyDoc.vertical === "construction");
assert("default blocks from kind", emptyDoc.blocks.length === Registry.getPageKind("vendor").blocks.length);
assert("default status draft", emptyDoc.meta.status === "draft");
assert("publish_status default draft", emptyDoc.meta.publish_status === "draft");
assert(
  "unknown fields dropped",
  Schema.createPageDoc({ surface: "builder", page_kind: "vendor", evil: 1 }).evil === undefined,
);
assert(
  "areas accept comma string",
  Schema.createPageDoc({ page_kind: "vendor", profile: { areas: "神奈川県, 東京都" } }).profile.areas.length === 2,
);
assert(
  "seo title clamped",
  Schema.createPageDoc({ page_kind: "vendor", seo: { title: "あ".repeat(200) } }).seo.title.length ===
    Schema.LIMITS.SEO_TITLE,
);
const contractDoc = Schema.createPageDoc({
  page_kind: "vendor",
  media_plan: [{ role: "hero", purpose: "品質", alt: "施工中の職人", asset_ref: "hero" }],
  internal_links: [
    { kind: "category", label: "関連", target_ref: "builder:category:painting" },
    { kind: "external", label: "禁止", target_ref: "https://outside.example" },
  ],
});
assert("media plan normalized", contractDoc.media_plan.length === 1 && contractDoc.media_plan[0].alt);
assert("external internal-link dropped", contractDoc.internal_links.length === 1);
const pathDoc = {};
Schema.setPath(pathDoc, "a.b.0.c", "x");
assert("setPath creates array segment", Array.isArray(pathDoc.a.b) && pathDoc.a.b[0].c === "x");
assert("getPath reads nested", Schema.getPath(pathDoc, "a.b.0.c") === "x");
assert("getPath missing is undefined", Schema.getPath(pathDoc, "a.zz.q") === undefined);
throws("setPath blocks prototype pollution", () => Schema.setPath({}, "__proto__.polluted", true));
assert("migrateDoc normalizes v0", Schema.migrateDoc({ page_kind: "vendor" }).doc_version === Schema.DOC_VERSION);
const migratedV1 = Schema.migrateDoc({ doc_version: 1, page_kind: "vendor" });
assert("v1 migrates to v2 contracts", migratedV1.doc_version === 2 && Array.isArray(migratedV1.media_plan));
throws("migrateDoc rejects future version", () => Schema.migrateDoc({ doc_version: 99 }));

// --- blocks ---------------------------------------------------------------
console.log("\n--- blocks ---");
assert("block types registered", Blocks.listBlockTypes().length >= 11);
const faqBlock = Blocks.createBlock("faq", {
  items: [
    { q: "Q1", a: "A1" },
    { question: "Q2", answer: "A2" },
    { q: "", a: "dropped" },
  ],
});
assert("faq alias q/a normalized", faqBlock.props.items.length === 2);
assert("empty faq item dropped", faqBlock.props.items.every((it) => it.q && it.a));
assert("isBlockEmpty true for blank hero", Blocks.isBlockEmpty(Blocks.createBlock("hero", {})) === true);
assert("textPaths exposed", Blocks.textPaths("hero").includes("title"));
Blocks.registerBlockType({
  id: "itinerary",
  label: "行程",
  textPaths: ["heading"],
  normalize: (p) => ({ heading: String(p.heading || ""), days: Array.isArray(p.days) ? p.days : [] }),
  isEmpty: (p) => !p.days.length,
});
assert("future block type registered", Boolean(Blocks.getBlockType("itinerary")));

// --- slots ----------------------------------------------------------------
console.log("\n--- slots ---");
const vendorSlots = Slots.listSlots("vendor");
assert("vendor slots resolved", vendorSlots.length === 6);
assert(
  "must slots first-class",
  vendorSlots.filter((s) => s.importance === Slots.IMPORTANCE.MUST).length === 3,
);
const slotDoc = Schema.createPageDoc({ surface: "builder", page_kind: "vendor" });
assert("missing must slots at start", Slots.missingSlots(slotDoc, "vendor", "must").length === 3);
Slots.applySlotValue(slotDoc, "area", "神奈川県、東京都");
assert("list slot coerced", slotDoc.profile.areas.length === 2);
assert("isFilled true after apply", Slots.isFilled(slotDoc, Slots.getSlot("area")) === true);
throws("registerSlot requires path", () => Slots.registerSlot({ id: "x" }));

// --- interview ------------------------------------------------------------
console.log("\n--- interview state machine ---");
const session = Interview.createSession({ surface: "builder", page_kind: "vendor" });
let step = Interview.next(session);
assert("first turn asks must", step.phase === "must" && step.question.prompts.length === 3);
assert("batch capped at 3", step.question.slotIds.length <= Interview.MAX_QUESTIONS_PER_TURN);
assert("must prompts flagged required", step.question.prompts.every((p) => p.required));
assert("not done initially", step.done === false);
assert("cannot generate yet", Interview.canGenerate(session) === false);

const answered = Interview.applyAnswers(session, {
  business_name: "タスフル塗装",
  service_summary: "戸建ての外壁塗装・防水工事",
  area: "神奈川県全域",
});
assert("3 answers applied", answered.applied.length === 3);
assert("can generate after must", Interview.canGenerate(session) === true);
step = Interview.next(session);
assert("second turn is optional should", step.phase === "should" && step.question.optional === true);
assert("should prompts not required", step.question.prompts.every((p) => !p.required));
assert(
  "could slots never asked",
  step.question.slotIds.every((id) => Slots.getSlot(id).importance !== Slots.IMPORTANCE.COULD),
);
assert("empty answer rejected", Interview.applyAnswers(session, { price_text: "  " }).rejected.length === 1);
assert("unknown slot rejected", Interview.applyAnswers(session, { nope: "x" }).rejected[0].reason === "unknown_slot");
step = Interview.skipOptional(session);
assert("done after skipping optional", step.done === true);
assert("progress reports must filled", step.progress.mustFilled === step.progress.mustTotal);
assert("answers marked as user", Prov.sourceOf(session.doc, "profile.name") === "user");
assert("user answers locked", Prov.isLocked(session.doc, "profile.name") === true);

// --- provenance -----------------------------------------------------------
console.log("\n--- provenance ---");
const provDoc = Schema.createPageDoc({ surface: "builder", page_kind: "vendor" });
Prov.applyUserEdit(provDoc, "profile.name", "ユーザー入力");
const merge = Prov.applyAiPatch(
  provDoc,
  { "profile.name": "AI上書き", "profile.summary": "AI要約" },
  { model: "test-model" },
);
assert("locked path skipped", merge.skipped.some((s) => s.path === "profile.name" && s.reason === "locked"));
assert("unlocked path applied", merge.applied.includes("profile.summary"));
assert("user value preserved", provDoc.profile.name === "ユーザー入力");
assert("ai value written", provDoc.profile.summary === "AI要約");
assert("ai source recorded", Prov.sourceOf(provDoc, "profile.summary") === "ai");
Prov.unlock(provDoc, "profile.name");
const merge2 = Prov.applyAiPatch(provDoc, { "profile.name": "AI再上書き" }, { model: "test-model" });
assert(
  "still skipped while user-authored",
  merge2.skipped.some((s) => s.path === "profile.name" && s.reason === "user_authored"),
);
const merge3 = Prov.applyAiPatch(provDoc, { "profile.name": "強制上書き" }, { force: true });
assert("force overwrites", merge3.applied.includes("profile.name") && provDoc.profile.name === "強制上書き");
const scoped = Prov.applyAiPatch(
  provDoc,
  { "profile.summary": "scoped", "profile.price_text": "1万円" },
  { paths: ["profile.summary"] },
);
assert("scoped regeneration limits paths", scoped.applied.length === 1 && scoped.applied[0] === "profile.summary");
assert("provenance summary counts", Prov.summary(provDoc).total >= 2);

// --- validation -----------------------------------------------------------
console.log("\n--- validation ---");
assert(
  "html in ai draft rejected",
  Validate.validateAiDraft({ hero_title: "<b>危険</b>" }).errors.some((e) => e.code === "html_forbidden"),
);
assert(
  "email in ai draft rejected",
  Validate.validateAiDraft({ about_body: "連絡は a@b.co まで" }).errors.some((e) => e.code === "contact_forbidden"),
);
assert(
  "phone in ai draft rejected",
  Validate.validateAiDraft({ about_body: "090-1234-5678" }).errors.some((e) => e.code === "contact_forbidden"),
);
assert(
  "url in ai draft rejected",
  Validate.validateAiDraft({ about_body: "https://example.com" }).errors.some((e) => e.code === "contact_forbidden"),
);
assert(
  "javascript scheme rejected",
  Validate.validateAiDraft({ cta_label: "javascript:alert(1)" }).errors.some(
    (e) => e.code === "script_url_forbidden",
  ),
);
assert(
  "banned phrase rejected",
  (() => {
    const r = Validate.validateAiDraft({ about_body: "絶対に安いです" });
    return r.ok === false && r.errors.some((e) => e.code === "banned_phrase");
  })(),
);
assert("clean draft passes", Validate.validateAiDraft({ hero_title: "外壁塗装", about_body: "丁寧に対応します" }).ok);
assert("sanitizeText strips tags", Validate.sanitizeText("<p>あ</p>") === "あ");

const badSurfaceDoc = Schema.createPageDoc({ surface: "business_directory", page_kind: "vendor" });
assert(
  "kind not allowed on surface",
  Validate.validateDoc(badSurfaceDoc).errors.some((e) => e.code === "kind_not_allowed"),
);
const draftDoc = Schema.createPageDoc({ surface: "builder", page_kind: "vendor" });
assert(
  "publish blocked without must slots",
  Validate.validateDoc(draftDoc, { forPublish: true }).errors.some((e) => e.code === "slot_required"),
);

// --- SEO ------------------------------------------------------------------
console.log("\n--- SEO builder ---");
const seoDoc = Schema.cloneDoc(session.doc);
const seo = Seo.buildSeo(seoDoc);
assert("title composed", seo.title.includes("タスフル塗装"));
assert("title within limit", seo.title.length <= Schema.LIMITS.SEO_TITLE);
assert("description within limit", seo.description.length <= Schema.LIMITS.SEO_DESCRIPTION);
assert("keywords built", seo.keywords.length > 0);
const longDoc = Schema.cloneDoc(seoDoc);
longDoc.profile.name = "あ".repeat(120);
assert("long title clamped with ellipsis", Seo.buildSeo(longDoc).title.length <= Schema.LIMITS.SEO_TITLE);
seoDoc.blocks = seoDoc.blocks.map((b) =>
  b.type === "faq" ? { ...b, props: { items: [{ q: "Q", a: "A" }] } } : b,
);
const ld = Seo.buildStructuredData(seoDoc);
assert("json-ld graph with faq", Array.isArray(ld["@graph"]) && ld["@graph"][1]["@type"] === "FAQPage");
assert("json-ld type from registry", ld["@graph"][0]["@type"] === "LocalBusiness");
assert(
  "json-ld type for future kind",
  Seo.buildStructuredData(Schema.createPageDoc({ page_kind: "tour", surface: "platform" }))["@type"] ===
    "TouristTrip",
);

// --- actions --------------------------------------------------------------
console.log("\n--- actions ---");
const actionDoc = Schema.cloneDoc(session.doc);
Actions.applyActions(actionDoc);
assert("primary from kind default", actionDoc.actions.primary.kind === "tasful_request");
assert("secondary from kind default", actionDoc.actions.secondary.kind === "talk_start");
assert("action valid on builder", Actions.validateActions(actionDoc).ok === true);
const badActionDoc = Schema.cloneDoc(actionDoc);
badActionDoc.surface = "platform";
badActionDoc.actions.primary = Actions.normalizeAction("contact_reveal");
assert(
  "action rejected on wrong surface",
  Actions.validateActions(badActionDoc).errors.some((e) => e.code === "action_not_allowed"),
);
const payDoc = Schema.cloneDoc(actionDoc);
Actions.applyActions(payDoc, { payment: { kind: "checkout", config: {} } });
assert(
  "external checkout forbidden",
  Actions.validateActions(payDoc).errors.some((e) => e.code === "external_action_forbidden"),
);
assert("booking kind available for future verticals", Boolean(Actions.getActionKind("booking_request")));
assert("generated purchase uses TASFUL flow", Actions.getActionKind("tasful_purchase").tasfulFlow === "tasful_marketplace_checkout");
assert("phone CTA cannot be generated", Actions.getActionKind("phone").allowGenerated === false);

// --- paid entitlement / conversion / quality -----------------------------
console.log("\n--- paid entitlement / conversion / quality ---");
const paid = {
  feature_id: Entitlement.FEATURE_ID,
  status: "active",
  plan: "pro",
  source: "test",
  verified_at: new Date().toISOString(),
};
assert("active paid entitlement accepted", Entitlement.check(paid).ok === true);
assert("missing entitlement rejected", Entitlement.check(null).error.code === "paid_entitlement_required");
assert(
  "expired entitlement rejected",
  Entitlement.check({ ...paid, expires_at: "2000-01-01T00:00:00.000Z" }).ok === false,
);
const conversionDoc = Schema.createPageDoc({ surface: "builder", page_kind: "vendor" });
Conversion.apply(conversionDoc);
assert("vendor outcome is request", conversionDoc.conversion.outcome === "request");
assert("vendor CTA label is request", conversionDoc.actions.primary.label === "依頼する");
assert("vendor CTA is internal", Conversion.isInternalAction(conversionDoc.actions.primary));
const shopConversion = Schema.createPageDoc({ surface: "business_directory", page_kind: "shop" });
Conversion.apply(shopConversion);
assert("shop outcome is purchase", shopConversion.conversion.outcome === "purchase");
assert("shop purchase uses TASFUL checkout", shopConversion.actions.primary.kind === "tasful_purchase");
const qualityDoc = Schema.cloneDoc(conversionDoc);
Seo.applySeo(qualityDoc);
Seo.applyStructuredData(qualityDoc);
const quality = Quality.apply(qualityDoc);
assert("quality exposes five dimensions", Object.keys(quality.scores).length === 5);
assert("quality score bounded", quality.overall >= 0 && quality.overall <= 100);
assert("thin page requests improvement", Quality.needsAutoImprove(qualityDoc) === true);
Quality.markReviewed(qualityDoc);
assert("review attempt capped at one", qualityDoc.quality.review_attempts === 1);
assert("second review prohibited", Quality.needsAutoImprove(qualityDoc) === false);
Quality.registerDimension({ id: "trust", weight: 0.1, score: () => 88 });
const extendedQuality = Quality.apply(qualityDoc);
assert("quality dimensions are extensible", extendedQuality.scores.trust === 88);
assert("extended quality survives schema normalization", Schema.normalizeDoc(qualityDoc).quality.scores.trust === 88);

// --- renderer -------------------------------------------------------------
console.log("\n--- renderer ---");
const renderDoc = Schema.cloneDoc(session.doc);
renderDoc.profile.images = [{ url: "https://example.test/hero.jpg", alt: "" }];
renderDoc.media_plan = [{ role: "hero", purpose: "メイン", alt: "外壁を塗装する職人", asset_ref: "hero" }];
renderDoc.internal_links = [{ kind: "category", label: "関連サービス", target_ref: "platform:category:painting" }];
renderDoc.blocks = [
  Blocks.createBlock("hero", { title: "外壁塗装<script>alert(1)</script>", lead: "神奈川で対応" }, "b1"),
  Blocks.createBlock("faq", { items: [{ q: "料金は？", a: "15万円〜が目安です" }] }, "b2"),
  Blocks.createBlock("about", {}, "b3"),
  Blocks.createBlock("related_links", { items: renderDoc.internal_links }, "b4"),
  Blocks.createBlock("cta", { label: "依頼する", action: "tasful_request" }, "b5"),
];
Actions.applyActions(renderDoc);
Conversion.apply(renderDoc);
const html = Renderer.render(renderDoc, { preview: true });
assert("script tag escaped", !html.includes("<script>alert(1)</script>"));
assert("escaped entity present", html.includes("&lt;script&gt;"));
assert("preview banner rendered", html.includes("pg-preview-banner"));
assert("ai disclaimer rendered", html.includes("pg-ai-disclaimer"));
assert("faq section rendered", html.includes("pg-section--faq"));
assert("AI image ALT rendered", html.includes('alt="外壁を塗装する職人"'));
assert("internal link rendered without href", html.includes('data-pg-internal-ref="platform:category:painting"') && !html.includes('href="platform:'));
assert("CTA carries TASFUL flow", html.includes("data-pg-tasful-flow="));
assert("empty about block skipped", !html.includes('data-pg-block-type="about"'));
assert("no raw angle from data", !/<\s*script[^>]*>alert/.test(html));
const ldHtml = Renderer.render(
  { ...renderDoc, structured_data: { "@type": "LocalBusiness", name: "</script>" } },
  { includeStructuredData: true },
);
assert("json-ld script escapes closing tag", !ldHtml.includes("</script>\""));
assert("renderHead builds meta", Renderer.renderHead(seoDoc).includes('name="description"'));
assert("safeUrl blocks javascript", Renderer.safeUrl("javascript:alert(1)") === "");
assert("safeUrl allows https", Renderer.safeUrl("https://a.example/x") === "https://a.example/x");

// --- history --------------------------------------------------------------
console.log("\n--- history ---");
const hist = History.createHistory({ max: 3 });
const histDoc = Schema.cloneDoc(session.doc);
History.push(hist, histDoc, { reason: "save" });
histDoc.profile.summary = "第2版";
History.push(hist, histDoc, { reason: "save" });
assert("versions increment", History.list(hist).map((e) => e.version).join(",") === "1,2");
const restored = History.restore(hist, 1);
assert("restore returns earlier doc", restored.profile.summary !== "第2版");
assert("restore unknown version null", History.restore(hist, 99) === null);
const diff = History.diffVersions(hist, 1, 2);
assert("diff finds changed path", diff.some((d) => d.path === "profile.summary"));
assert("diff ignores updated_at", !diff.some((d) => d.path === "meta.updated_at"));
histDoc.profile.summary = "第3版";
History.push(hist, histDoc, { reason: "save" });
histDoc.profile.summary = "第4版";
History.push(hist, histDoc, { reason: "save" });
assert("max entries trimmed", hist.entries.length === 3);
assert("history round-trips", History.deserialize(History.serialize(hist)).entries.length === 3);

// --- listing mapping ------------------------------------------------------
console.log("\n--- listing data ---");
const listingDoc = Schema.cloneDoc(session.doc);
Seo.applySeo(listingDoc);
const listing = ListingMap.toListingData(listingDoc);
assert("listing carries taxonomy", listing.page_kind === "vendor" && listing.vertical === "construction");
assert("listing publish_status draft", listing.publish_status === "draft");
assert("listing tags built", Array.isArray(listing.tags));
assert("slug generated", ListingMap.slugify("タスフル 塗装 Co.").length > 0);
assert("public summary hides owner", ListingMap.toPublicSummary(listingDoc).owner_id === undefined);
const mapped = ListingMap.toMappedListingData(listingDoc);
assert("field map applied", mapped.title === listingDoc.seo.title);

// --- prompt ---------------------------------------------------------------
console.log("\n--- prompt ---");
const req = Prompt.buildDraftRequest(session.doc);
assert("prompt is provider neutral", !("model" in req) && !("endpoint" in req));
assert("prompt carries ai_route", req.ai_route === "builder_ai");
assert("prompt requests json", req.response_format === "json_object");
assert("prompt schema no additional props", Prompt.DRAFT_SCHEMA.additionalProperties === false);
assert("prompt constraints ban html", req.constraints.some((c) => c.includes("HTML")));
assert("prompt bans external conversion routes", req.constraints.some((c) => c.includes("外部決済")));
assert("prompt schema includes image plan", Boolean(Prompt.DRAFT_SCHEMA.properties.image_plan));
assert("prompt schema includes internal links", Boolean(Prompt.DRAFT_SCHEMA.properties.internal_links));
assert("prompt schema includes conversion intent", Boolean(Prompt.DRAFT_SCHEMA.properties.conversion_intent));
assert("prompt includes facts", req.user.includes("タスフル塗装"));
const scopedReq = Prompt.buildDraftRequest(session.doc, { scope: "block", blockType: "faq" });
assert("scoped prompt mentions block", scopedReq.user.includes("faq"));
const patch = Prompt.draftToPatch(
  { hero_title: "外壁塗装のプロ", faq: [{ q: "Q", a: "A" }], seo_title: "T", meta_description: "D" },
  session.doc,
);
assert("patch targets block path", Object.keys(patch).some((p) => /^blocks\.\d+\.props\.title$/.test(p)));
assert("patch targets seo", patch["seo.title"] === "T" && patch["seo.description"] === "D");
const fallback = Prompt.buildFallbackDraft(session.doc);
assert("fallback draft is deterministic", fallback.fallback === true && fallback.hero_title === "タスフル塗装");
assert("fallback draft passes guard", Validate.validateAiDraft(fallback).ok === true);
const reviewReq = Prompt.buildReviewRequest(session.doc, { overall: 70, scores: {}, issues: [{ code: "x", message: "改善" }] });
assert("self-review request limited to one pass", reviewReq.review_pass === 1 && reviewReq.max_review_passes === 1);

// --- intent routing -------------------------------------------------------
console.log("\n--- intent routing (TASFUL AI entry) ---");
const r1 = IntentMod.route("外壁塗装のページを作りたい");
assert("create intent detected", r1.intent === "create_page");
assert("routes to builder", r1.surface === "builder");
assert("keeps builder_ai route", r1.aiRoute === "builder_ai");
assert("page_kind inferred", r1.page_kind === "vendor");
assert("no confirmation needed", r1.needsConfirmation === false);

const r2 = IntentMod.route("お店のページを作りたい");
assert("shop routes to business_directory", r2.surface === "business_directory");
assert("bd kind is shop", r2.page_kind === "shop");
assert("bd route preserved", r2.aiRoute === "bd_edge");

const r3 = IntentMod.route("ページを作りたい");
assert("ambiguous needs confirmation", r3.needsConfirmation === true);
const dis = IntentMod.buildDisambiguation(r3);
assert("disambiguation asks surface", dis.field === "surface" && dis.options.length >= 2);
const r3b = IntentMod.resolveWithChoice(r3, "surface", "platform");
assert("choice resolves surface", r3b.surface === "platform" && r3b.aiRoute === "gateway");
assert(
  "still asks page_kind when surface offers several",
  r3b.needsConfirmation === true && r3b.reasons.includes("page_kind_unknown"),
);
const dis2 = IntentMod.buildDisambiguation(r3b);
assert(
  "disambiguation asks allowed page kinds",
  dis2.field === "page_kind" && dis2.options.every((o) => Registry.isKindAllowedOnSurface(o.value, "platform")),
);
const r3c = IntentMod.resolveWithChoice(r3b, "page_kind", "service");
assert("choice clears confirmation", r3c.needsConfirmation === false && r3c.vertical === "local_service");
assert(
  "surface hint forces route",
  IntentMod.route("外壁塗装のページを作りたい", { surfaceHint: "platform" }).surface === "platform",
);
assert("edit intent detected", IntentMod.route("ページの文章を書き直したい").intent === "edit_page");
assert("publish intent detected", IntentMod.route("ページを公開したい").intent === "publish_page");
assert("unrelated text unknown", IntentMod.route("今日の天気は？").intent === "unknown");

// --- component ------------------------------------------------------------
console.log("\n--- component ---");
assert("no dom in node", Component.hasDom() === false);
const qHtml = Component.questionHtml(Interview.next(Interview.createSession({ surface: "builder", page_kind: "vendor" })).question);
assert("question html has inputs", qHtml.includes("data-pg-slot="));
assert("question html escapes", !qHtml.includes("<script"));
assert("preview html delegates renderer", Component.previewHtml(renderDoc).includes("pg-preview-banner"));
assert("mountPreview degrades without dom", Component.mountPreview(null, renderDoc).ok === false);
assert(
  "validation html lists errors",
  Component.validationHtml({ ok: false, errors: [{ message: "エラー" }], warnings: [] }).includes("エラー"),
);
assert("progress html renders bar", Component.progressHtml({ ratio: 0.5, mustFilled: 2, mustTotal: 3 }).includes("pg-progress"));

// --- engine end-to-end ----------------------------------------------------
console.log("\n--- engine (end-to-end, no AI call) ---");
const entry = Engine.resolveEntry("外壁塗装のページを作りたい");
assert("entry ready", entry.ready === true && entry.disambiguation === null);
const blocked = Engine.startFromRoute(entry.route);
assert("generation blocked without paid entitlement", Engine.buildAiRequest(blocked).error.code === "paid_entitlement_required");
assert("regeneration blocked without paid entitlement", Engine.buildRegenerateRequest(blocked).error.code === "paid_entitlement_required");
assert("publish blocked without paid entitlement", Engine.publish(blocked).validation.errors.some((e) => e.code === "paid_entitlement_required"));
const paintingLinks = [
  { kind: "category", label: "外壁塗装の関連サービス", target_ref: "builder:services:painting" },
];
const s = Engine.startFromRoute(entry.route, {
  entitlement: paid,
  internalLinkCandidates: paintingLinks,
});
assert("session doc surface", s.doc.surface === "builder");
assert("session has history", s.history.entries.length === 0);
assert("paid entitlement active in session", Engine.checkEntitlement(s).ok === true);
Engine.answer(s, {
  business_name: "タスフル塗装",
  service_summary: "戸建ての外壁塗装",
  area: "神奈川県全域",
});
assert("engine can generate", Engine.canGenerate(s) === true);

const aiRequest = Engine.buildAiRequest(s);
assert("engine builds request only", typeof aiRequest.system === "string" && typeof aiRequest.user === "string");

const applied = Engine.applyAiDraft(
  s,
  {
    hero_title: "神奈川の外壁塗装",
    hero_lead: "自社施工で丁寧に対応します",
    about_heading: "紹介",
    about_body: "戸建ての外壁塗装と防水工事に対応しています。",
    faq: [{ q: "対応エリアは？", a: "神奈川県全域です。" }],
    cta_label: "相談する",
    conversion_intent: "request",
    image_plan: [{ role: "hero", purpose: "施工品質を伝える", alt: "戸建て外壁を塗装する職人", asset_ref: "hero" }],
    internal_links: [{ kind: "category", label: "外壁塗装の関連サービス", target_ref: "builder:services:painting" }],
    seo_title: "タスフル塗装 | 外壁塗装",
    meta_description: "神奈川県全域で外壁塗装に対応しています。",
  },
  { model: "test-model" },
);
assert("ai draft applied", applied.ok === true && applied.applied.length > 0);
assert("doc records model", s.doc.meta.model === "test-model");
assert("seo rebuilt", s.doc.seo.title.length > 0);
assert("structured data rebuilt", Boolean(s.doc.structured_data["@graph"] || s.doc.structured_data["@type"]));
assert("conversion outcome applied", s.doc.conversion.outcome === "request");
assert("optimal CTA selected", s.doc.actions.primary.kind === "tasful_request" && s.doc.actions.primary.label === "依頼する");
assert("image plan and ALT applied", s.doc.media_plan[0].alt === "戸建て外壁を塗装する職人");
assert("internal links applied", s.doc.internal_links[0].target_ref === "builder:services:painting");
assert("prompt carries only host allowlisted links", aiRequest.context.allowed_internal_targets.length === 1);
assert("first draft requests one self-review", applied.needsAutoImprove === true && applied.reviewRequest.review_pass === 1);

const unknownLink = Engine.applyAiDraft(s, {
  internal_links: [{ kind: "admin", label: "禁止リンク", target_ref: "builder:admin:secret" }],
});
assert(
  "unknown internal link rejected",
  unknownLink.ok === false && unknownLink.validation.errors[0].code === "internal_link_not_allowed",
);

const unsafe = Engine.applyAiDraft(s, { hero_title: "<img src=x onerror=1>" });
assert("unsafe draft rejected", unsafe.ok === false);
assert("doc unchanged after rejection", !JSON.stringify(s.doc).includes("onerror"));

Engine.editField(s, "blocks.0.props.title", "手直しタイトル");
const ctaIndex = s.doc.blocks.findIndex((block) => block.type === "cta");
Engine.editField(s, `blocks.${ctaIndex}.props.label`, "見積もりを依頼する");
Engine.editField(s, "actions.primary.label", "見積もりを依頼する");
const regen = Engine.applyAiDraft(s, { hero_title: "AI再生成", about_body: "AI本文" }, { model: "m2" });
assert("user edit preserved on regenerate", s.doc.blocks[0].props.title === "手直しタイトル");
assert("user CTA label survives derived refresh", s.doc.blocks[ctaIndex].props.label === "見積もりを依頼する");
assert("user action label survives derived refresh", s.doc.actions.primary.label === "見積もりを依頼する");
assert("CTA kind remains system-owned", s.doc.actions.primary.kind === "tasful_request");
assert("regenerate reports skip", regen.skipped.some((x) => x.reason === "locked"));

const faqIndex = s.doc.blocks.findIndex((block) => block.type === "faq");
assert("faq block present for retention test", faqIndex >= 0);
Engine.editField(s, `blocks.${faqIndex}.props.items.0.a`, "テスト用に手動編集した回答です。");
const faqRegen = Engine.applyAiDraft(
  s,
  {
    faq: [
      { q: "対応エリアは？", a: "AIが上書きしようとした回答" },
      { q: "追加Q", a: "追加Aは許可されてよい" },
    ],
  },
  { model: "m3" },
);
assert(
  "user FAQ answer preserved on regenerate",
  s.doc.blocks[faqIndex].props.items[0].a === "テスト用に手動編集した回答です。",
);
assert(
  "locked FAQ answer path skipped",
  faqRegen.skipped.some((x) => x.path === `blocks.${faqIndex}.props.items.0.a` && x.reason === "locked"),
);
assert(
  "unlocked FAQ item can still update",
  s.doc.blocks[faqIndex].props.items[1]?.a === "追加Aは許可されてよい" ||
    faqRegen.applied.some((p) => p === `blocks.${faqIndex}.props.items.1.a`),
);

const improved = Engine.applySelfReview(
  s,
  {
    about_body:
      "戸建ての外壁塗装と防水工事に対応しています。現地の状態を確認し、必要な施工内容と料金の目安をご案内します。施工前後の流れや気になる点もTASFUL内で相談でき、依頼まで迷わず進められます。",
    faq: [
      { q: "対応エリアは？", a: "神奈川県全域です。" },
      { q: "依頼前に相談できますか？", a: "TASFUL内の相談導線から確認できます。" },
    ],
    image_plan: [{ role: "hero", purpose: "施工品質を伝える", alt: "戸建て外壁を塗装する職人", asset_ref: "hero" }],
    internal_links: [{ kind: "category", label: "外壁塗装の関連サービス", target_ref: "builder:services:painting" }],
  },
  { model: "review-model" },
);
assert("self-review improvement applied once", improved.ok === true && s.doc.quality.review_attempts === 1);
assert("second self-review rejected", Engine.applySelfReview(s, { about_body: "再レビュー" }).error.code === "self_review_limit");
assert("user edit survives self-review", s.doc.blocks[0].props.title === "手直しタイトル");

const auto = Engine.startFromRoute(entry.route, {
  entitlement: paid,
  internalLinkCandidates: paintingLinks,
});
Engine.answer(auto, {
  business_name: "自動レビュー塗装",
  service_summary: "外壁塗装",
  area: "東京都",
});
let adapterCalls = 0;
const autoResult = await Engine.generateWithReview(auto, async (_request, meta) => {
  adapterCalls += 1;
  if (meta.pass === 0) {
    return {
      hero_title: "自動レビュー塗装",
      hero_lead: "外壁塗装に対応します",
      about_body: "外壁塗装に対応します。",
      faq: [{ q: "相談できますか？", a: "TASFUL内で相談できます。" }],
      conversion_intent: "request",
      image_plan: [{ role: "hero", purpose: "施工紹介", alt: "外壁塗装の施工風景", asset_ref: "hero" }],
      internal_links: [{ kind: "category", label: "関連サービス", target_ref: "builder:services:painting" }],
      seo_title: "自動レビュー塗装 | 外壁塗装",
      meta_description: "東京都で外壁塗装に対応します。",
    };
  }
  return {
    about_body:
      "東京都で戸建ての外壁塗装に対応しています。状態を確認して施工内容をご案内し、TASFUL内で相談から依頼まで進められます。",
    faq: [
      { q: "相談できますか？", a: "TASFUL内で相談できます。" },
      { q: "依頼方法は？", a: "ページの依頼ボタンから進められます。" },
    ],
  };
});
assert("automatic self-review uses exactly two passes", autoResult.ok === true && autoResult.passes === 2 && adapterCalls === 2);
assert("automatic review cannot loop", auto.doc.quality.review_attempts === 1);

const noChange = Engine.startFromRoute(entry.route, { entitlement: paid });
Engine.answer(noChange, {
  business_name: "変更なしテスト",
  service_summary: "外壁塗装",
  area: "東京都",
});
Engine.applyAiDraft(noChange, {
  hero_title: "変更なしテスト",
  hero_lead: "外壁塗装",
  about_body: "外壁塗装に対応します。",
  seo_title: "変更なしテスト",
  meta_description: "東京都で外壁塗装に対応します。",
});
const noChangeReview = Engine.applySelfReview(noChange, { ignored_field: "変更なし" });
assert("empty self-review does not consume pass", noChangeReview.error.code === "self_review_no_change");
assert("empty self-review keeps attempt zero", noChange.doc.quality.review_attempts === 0);

const validation = Engine.validate(s, { forPublish: true });
assert("publish validation passes", validation.ok === true, JSON.stringify(validation.errors));
const previewHtmlOut = Engine.preview(s);
assert("preview renders", previewHtmlOut.includes("pg-page"));
assert("preview head is noindex", Engine.previewHead(s).includes('content="noindex"'));

Engine.saveDraft(s, { label: "初回" });
assert("draft saved to history", s.history.entries.length === 1);

const published = Engine.publish(s);
assert("publish ok", published.ok === true);
assert("publish status", s.doc.meta.status === "published");
assert("listing publish_status public", published.listing.publish_status === "public");
assert("publish_at set", Boolean(published.listing.publish_at));

const bdEntry = Engine.resolveEntry("お店のページを作りたい");
const bd = Engine.startFromRoute(bdEntry.route, { entitlement: paid });
Engine.answer(bd, { business_name: "タスフル商店", service_summary: "地元の食品販売", area: "横浜市" });
Engine.applyFallbackDraft(bd);
Engine.applySelfReview(bd, {
  about_body: "横浜市で地元の食品を販売しています。商品情報を確認し、TASFUL内で購入手続きまで進められます。",
  faq: [
    { q: "購入方法は？", a: "TASFUL内の購入ボタンから手続きできます。" },
    { q: "商品について相談できますか？", a: "TASFUL内のお問い合わせをご利用ください。" },
  ],
});
const bdPublish = Engine.publish(bd);
assert(
  "bd publish requires review",
  bdPublish.ok === false && bdPublish.validation.errors.some((e) => e.code === "review_required"),
);
Engine.requestReview(bd);
Engine.approveReview(bd);
assert("bd publish after approval", Engine.publish(bd).ok === true);

Engine.unpublish(bd);
assert("unpublish state", bd.doc.meta.status === "unpublished");
assert("unpublish listing private", ListingMap.toListingData(bd.doc).publish_status === "private");

const exported = Engine.exportSession(s);
const imported = Engine.importSession(exported);
assert("session round-trips", imported.doc.profile.name === s.doc.profile.name);
assert("history round-trips in session", imported.history.entries.length === s.history.entries.length);
assert("entitlement round-trips in session", Engine.checkEntitlement(imported).ok === true);

const restoreResult = Engine.restoreVersion(s, 1);
assert("restore version ok", restoreResult.ok === true);
assert("restore unknown fails", Engine.restoreVersion(s, 999).ok === false);

// --- future extension smoke ----------------------------------------------
console.log("\n--- future vertical smoke (travel/tour) ---");
const tour = Engine.startSession({ surface: "platform", page_kind: "tour", entitlement: paid });
Engine.answer(tour, { business_name: "タスフル旅行", service_summary: "日帰りバスツアー", area: "関東" });
Engine.applyFallbackDraft(tour);
assert("future kind session works", tour.doc.page_kind === "tour" && tour.doc.vertical === "travel");
assert("future kind renders", Engine.preview(tour).includes("pg-page"));
assert(
  "future kind json-ld",
  (tour.doc.structured_data["@graph"]?.[0] || tour.doc.structured_data)["@type"] === "TouristTrip",
);

console.log(`\n${pass}/${pass + fail} PASS`);
if (fail > 0) {
  console.error(`${fail} FAILED`);
  process.exit(1);
}
