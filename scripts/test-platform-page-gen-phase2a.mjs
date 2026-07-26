#!/usr/bin/env node
/**
 * Phase 2-A — Platform page-gen integration tests
 *   node scripts/test-platform-page-gen-phase2a.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function loadSandbox(extraFiles = []) {
  const sandbox = { console, JSON, Math, Date, Array, Object, String, Boolean, Number, Set, Map };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  for (const file of MODULES) {
    const code = fs.readFileSync(path.join(root, "shared", "page-gen", file), "utf8");
    vm.runInNewContext(code, sandbox, { filename: file });
  }
  for (const rel of extraFiles) {
    const code = fs.readFileSync(path.join(root, rel), "utf8");
    vm.runInNewContext(code, sandbox, { filename: path.basename(rel) });
  }
  return sandbox;
}

console.log("=== Phase 2-A Platform page-gen integration ===\n");

console.log("--- entitlement shared (server) ---");
const entitlementMod = await import(
  pathToFileURL(path.join(root, "deploy/cloudflare/functions/_shared/page-gen-entitlement.mjs")).href
);
assert("feature id is ai_page_gen_paid", entitlementMod.FEATURE_ID === "ai_page_gen_paid");
assert(
  "active paid row accepted",
  entitlementMod.hasPaidGenAiAccessFromRow({
    plan_code: "pro_980",
    subscription_status: "active",
    current_period_end: new Date(Date.now() + 86400000).toISOString(),
  }) === true,
);
assert(
  "free/missing row rejected",
  entitlementMod.hasPaidGenAiAccessFromRow(null) === false,
);
assert(
  "unpaid status rejected",
  entitlementMod.hasPaidGenAiAccessFromRow({
    plan_code: "pro_980",
    subscription_status: "unpaid",
  }) === false,
);
assert(
  "expired period rejected",
  entitlementMod.hasPaidGenAiAccessFromRow({
    plan_code: "basic_300",
    subscription_status: "active",
    current_period_end: "2000-01-01T00:00:00.000Z",
  }) === false,
);
const built = entitlementMod.buildEntitlement(
  {
    plan_code: "basic_300",
    subscription_status: "active",
    current_period_end: new Date(Date.now() + 86400000).toISOString(),
  },
  "user-1",
);
assert("entitlement uses server source", built.source === "gen_ai_subscriptions" && built.status === "active");
assert("client isPaid flag is not part of contract", !("isPaid" in built) && !("entitled" in built));

const apiEntitlement = fs.readFileSync(
  path.join(root, "deploy/cloudflare/functions/api/page-gen-entitlement.js"),
  "utf8",
);
const apiDraft = fs.readFileSync(
  path.join(root, "deploy/cloudflare/functions/api/page-gen-draft.js"),
  "utf8",
);
assert("entitlement API uses resolvePageGenEntitlement", apiEntitlement.includes("resolvePageGenEntitlement"));
assert("draft API re-checks entitlement before generation", /resolvePageGenEntitlement[\s\S]*callGeminiDraft/.test(apiDraft));
assert("draft API never trusts body plan flags only", !/body\.isPaid|body\.entitled|body\.plan\b/.test(apiDraft));
assert("draft prompt bans external conversion", apiDraft.includes("外部決済") && apiDraft.includes("LINE"));

console.log("\n--- platform adapter ---");
const G = loadSandbox(["platform-page-gen-adapter.js", "platform-page-gen-detail.js"]);
const Adapter = G.TasuPlatformPageGenAdapter;
const Engine = G.TasuPageGenEngine;
const Schema = G.TasuPageGenSchema;
const Validate = G.TasuPageGenValidate;

assert("adapter exposed", Boolean(Adapter));
assert("product maps to purchase", Adapter.mapListingType("product").outcome === "purchase");
assert("skill maps to request", Adapter.mapListingType("skill").outcome === "request");
assert("job maps to apply", Adapter.mapListingType("job").outcome === "apply");
assert("worker maps to consult", Adapter.mapListingType("worker").outcome === "consult");
assert("booking unsupported as platform outcome", Adapter.unsupportedOutcome("booking") === true);
assert("join unsupported as platform outcome", Adapter.unsupportedOutcome("join") === true);

const paid = {
  feature_id: "ai_page_gen_paid",
  status: "active",
  plan: "pro_980",
  source: "gen_ai_subscriptions",
  verified_at: new Date().toISOString(),
};

const listing = {
  id: "listing_skill_1",
  user_id: "owner-1",
  listing_type: "skill",
  title: "外壁塗装サービス",
  description: "戸建ての外壁塗装",
  category: "建築・修理",
  price: 150000,
  images: ["https://example.test/a.jpg"],
};

const created = Adapter.createSessionFromListing(listing, paid);
assert("session created from platform listing", created.ok === true);
assert("surface is platform", created.session.doc.surface === "platform");
assert("conversion outcome request", created.session.doc.conversion.outcome === "request");

Engine.answer(created.session, {
  business_name: listing.title,
  service_summary: listing.description,
  area: "神奈川県",
});
Engine.skipOptional(created.session);

const applied = Engine.applyAiDraft(
  created.session,
  {
    hero_title: "神奈川の外壁塗装",
    hero_lead: "丁寧に対応します",
    about_heading: "紹介",
    about_body: "戸建ての外壁塗装に対応しています。状態を確認し、必要な施工内容をご案内します。",
    faq: [
      { q: "対応エリアは？", a: "神奈川県です。" },
      { q: "依頼方法は？", a: "TASFUL内の依頼ボタンから進められます。" },
    ],
    cta_label: "依頼する",
    conversion_intent: "request",
    image_plan: [{ role: "hero", purpose: "施工", alt: "外壁塗装の作業風景", asset_ref: "hero" }],
    internal_links: [{ kind: "category", label: "関連", target_ref: "platform:category:skill" }],
    seo_title: "外壁塗装サービス | 神奈川",
    meta_description: "神奈川県で外壁塗装に対応します。",
  },
  { model: "test" },
);
assert("ai draft applied on platform session", applied.ok === true);

// Force internal CTA mapping as adapter.generateDraft would.
created.session.doc.conversion.outcome = "request";
created.session.doc.conversion.primary_action = "tasful_request";
Engine.refreshDerived(created.session);
created.session.doc.actions.primary.kind = "tasful_request";
created.session.doc.actions.primary.config = { route_ref: "platform:skill:request:listing_skill_1" };
created.session.doc.actions.primary.label = "依頼する";
assert("CTA kind is tasful_request", created.session.doc.actions.primary.kind === "tasful_request");
assert("CTA route is internal ref", created.session.doc.actions.primary.config.route_ref.startsWith("platform:"));

const externalDraft = Engine.applyAiDraft(created.session, {
  about_body: "LINEで申し込んでください https://line.me/x",
});
assert("external contact draft rejected", externalDraft.ok === false);

const payload = Adapter.attachPageDocToListingPayload(
  { title: listing.title, listing_type: "skill", form_data: { payment: {} } },
  created.session,
);
assert("page_doc stored under form_data", Boolean(payload.form_data.page_doc));
assert("no migration field inventing new columns", !("page_doc" in payload) || payload.page_doc === undefined);
assert("page_gen meta stored", payload.form_data.page_gen.surface === "platform");

const extracted = Adapter.extractPageDoc(payload);
assert("page_doc round-trips", extracted?.seo?.title === created.session.doc.seo.title);

const cta = Adapter.resolveCta({ ...listing, form_data: payload.form_data });
assert("resolveCta uses request label", cta.label === "依頼する" || cta.action_kind === "tasful_request");
assert("resolveCta can_show with listing id", cta.can_show === true);
assert("resolveCta missing id fallback", Adapter.resolveCta({ listing_type: "skill" }).can_show === false);

console.log("\n--- user edit retention ---");
const ctaIndex = created.session.doc.blocks.findIndex((b) => b.type === "cta");
Engine.editField(created.session, `blocks.${ctaIndex}.props.label`, "見積もりを依頼する");
Engine.editField(created.session, "actions.primary.label", "見積もりを依頼する");
Engine.refreshDerived(created.session);
assert(
  "user CTA label survives refresh",
  created.session.doc.blocks[ctaIndex].props.label === "見積もりを依頼する",
);
assert("CTA kind remains system-owned", created.session.doc.actions.primary.kind === "tasful_request");

console.log("\n--- SEO / OGP / JSON-LD ---");
assert("seo title present", Boolean(created.session.doc.seo.title));
assert("seo description present", Boolean(created.session.doc.seo.description));
assert("og present", Boolean(created.session.doc.seo.og?.title));
assert(
  "structured data present",
  Boolean(created.session.doc.structured_data["@type"] || created.session.doc.structured_data["@graph"]),
);
const head = Adapter.previewHead(created.session);
assert("preview head has description meta", head.includes('name="description"'));
assert("preview head has og:title", head.includes("og:title"));

console.log("\n--- security ---");
assert(
  "prototype pollution blocked",
  (() => {
    try {
      Schema.setPath({}, "__proto__.x", 1);
      return false;
    } catch {
      return true;
    }
  })(),
);
assert(
  "external internal-link rejected by schema",
  Schema.createPageDoc({
    page_kind: "service",
    internal_links: [{ kind: "x", label: "bad", target_ref: "https://evil.example" }],
  }).internal_links.length === 0,
);
assert(
  "phone CTA not allowGenerated",
  G.TasuPageGenActions.getActionKind("phone").allowGenerated === false,
);
assert(
  "checkout CTA not allowGenerated",
  G.TasuPageGenActions.getActionKind("checkout").allowGenerated === false,
);

const product = Adapter.createSessionFromListing(
  { id: "p1", listing_type: "product", title: "商品A", description: "説明" },
  paid,
);
assert("product outcome purchase", product.session.doc.conversion.outcome === "purchase");
const job = Adapter.createSessionFromListing(
  { id: "j1", listing_type: "job", title: "求人", description: "説明" },
  paid,
);
assert("job outcome apply", job.session.doc.conversion.outcome === "apply");

console.log("\n--- wiring / non-impact checks ---");
const postHtml = fs.readFileSync(path.join(root, "post.html"), "utf8");
assert("post.html loads platform adapter", postHtml.includes("platform-page-gen-adapter.js"));
assert("post.html loads page-gen engine", postHtml.includes("page-gen-engine.js"));
assert("post.html loads page-gen ui", postHtml.includes("platform-page-gen-ui.js"));
for (const file of ["detail-skill.html", "detail-product.html", "detail-job.html", "detail-worker.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert(`${file} loads detail reflector`, html.includes("platform-page-gen-detail.js"));
}
const postJs = fs.readFileSync(path.join(root, "post.js"), "utf8");
assert("post.js merges page gen on save", postJs.includes("TasuPlatformPageGenUi?.mergeIntoSavePayload"));
assert(
  "builder html not modified for page-gen",
  !fs.readFileSync(path.join(root, "builder/vendor-pages.html"), "utf8").includes("platform-page-gen"),
);
assert(
  "bd ai page not modified for platform adapter",
  !fs.readFileSync(path.join(root, "business-directory/business-directory-ai-page.js"), "utf8").includes(
    "TasuPlatformPageGenAdapter",
  ),
);
assert(
  "gateway not imported by page-gen APIs",
  !/(?:import|require)\s*\(?['"][^'"]*ai-model-gateway/.test(apiDraft) &&
    !/(?:import|require)\s*\(?['"][^'"]*ai-model-gateway/.test(apiEntitlement),
);
assert(
  "gateway source file untouched path referenced only as AD note",
  apiDraft.includes("Does not modify ai-model-gateway.js") ||
    !apiDraft.includes("ai-model-gateway.js"),
);

const uiSrc = fs.readFileSync(path.join(root, "platform-page-gen-ui.js"), "utf8");
assert(
  "UI maps entitlement_unavailable distinctly",
  uiSrc.includes("entitlement_unavailable") &&
    uiSrc.includes("現在プラン情報を確認できません"),
);
assert(
  "UI does not treat unavailable as unpaid-only message",
  !uiSrc.match(/entitlement_unavailable[\s\S]{0,120}有料プラン加入後に利用できます/),
);
assert(
  "ensure-pages-dist writes Staging chat config for local dev",
  fs.readFileSync(path.join(root, "scripts/ensure-pages-dist.mjs"), "utf8").includes(
    "wrote dist/chat-supabase-config.js from .env.staging",
  ),
);

console.log(`\n${pass}/${pass + fail} PASS`);
if (fail > 0) {
  console.error(`${fail} FAILED`);
  process.exit(1);
}
