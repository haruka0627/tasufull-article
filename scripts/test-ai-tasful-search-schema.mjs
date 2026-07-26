#!/usr/bin/env node
/**
 * TASFUL AI Search Schema + Intent unit tests (no browser)
 *   node scripts/test-ai-tasful-search-schema.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}

function boot() {
  const mock = {
    location: { href: "http://127.0.0.1:8788/ai-workspace.html", origin: "http://127.0.0.1:8788" },
    document: { readyState: "complete" },
    addEventListener: () => {},
  };
  Object.assign(globalThis, mock);
  globalThis.window = globalThis;
  for (const file of [
    "ai-workspace-search-intent.js",
    "ai-tasful-search-schema.js",
    "ai-intent-router.js",
  ]) {
    eval(readFileSync(join(root, file), "utf8"));
  }
  return {
    Schema: globalThis.TasuAiTasfulSearchSchema,
    Intent: globalThis.TasuAiIntentRouter,
    SearchIntent: globalThis.TasuAiWorkspaceSearchIntent,
  };
}

function main() {
  const { Schema, Intent, SearchIntent } = boot();
  assert("schema exported", Boolean(Schema?.validate));
  assert("intent exported", Boolean(Intent?.classifyIntent));

  // --- Schema ---
  const ok = Schema.validate({
    action: "search",
    vertical: "marketplace",
    query: "古着 ジャケット",
    location: "東京都",
    dateFrom: "2026-07-26",
    dateTo: "2026-07-27",
    priceMin: 1000,
    priceMax: 3000,
    sort: "price_asc",
    missingRequiredFields: [],
  });
  assert("schema valid", ok.ok && ok.value.query === "古着 ジャケット");
  assert("schema vertical marketplace", ok.value.vertical === "marketplace");

  const longQ = "あ".repeat(400);
  const long = Schema.validate({ action: "search", query: longQ, sort: "relevance" });
  assert("schema query max 300", long.ok && long.value.query.length === 300);

  const badVert = Schema.validate({ action: "search", vertical: "booking", query: "x" });
  assert("schema unknown vertical → null", badVert.ok && badVert.value.vertical === null);

  const badSort = Schema.validate({ action: "search", query: "x", sort: "magic" });
  assert("schema unknown sort → relevance", badSort.ok && badSort.value.sort === "relevance");

  const neg = Schema.validate({ action: "search", query: "x", priceMin: -10, priceMax: -1 });
  assert("schema negative price → null", neg.ok && neg.value.priceMin == null && neg.value.priceMax == null);

  const swap = Schema.validate({
    action: "search",
    query: "x",
    priceMin: 5000,
    priceMax: 1000,
  });
  assert(
    "schema price min/max swap",
    swap.ok && swap.value.priceMin === 1000 && swap.value.priceMax === 5000
  );

  const badDate = Schema.validate({
    action: "search",
    query: "x",
    dateFrom: "2026-13-40",
    dateTo: "not-a-date",
  });
  assert("schema bad date → null", badDate.ok && badDate.value.dateFrom == null && badDate.value.dateTo == null);

  assert("schema reject null", Schema.validate(null).ok === false);
  assert("schema reject array", Schema.validate([]).ok === false);
  assert("schema reject string", Schema.validate("search").ok === false);

  const polluted = Schema.validate(
    JSON.parse('{"action":"search","query":"ok","__proto__":{"polluted":true}}')
  );
  assert("schema proto key ignored", polluted.ok && polluted.value.query === "ok");
  assert("schema no prototype pollution", Object.prototype.polluted === undefined);

  const fromText = Schema.fromUserText("3000円以下の古着ジャケットを探して", {
    intent: "product_search",
  });
  assert(
    "fromUserText marketplace",
    fromText.ok && fromText.value.vertical === "marketplace" && fromText.value.action === "search"
  );
  assert(
    "fromUserText priceMax",
    fromText.ok && fromText.value.priceMax === 3000,
    `priceMax=${fromText.value?.priceMax}`
  );

  const vague = Schema.fromUserText("商品を探して", { intent: "product_search" });
  assert(
    "fromUserText missing query",
    vague.ok && vague.value.missingRequiredFields.includes("query")
  );

  // --- Intent ---
  const product = Intent.classifyIntent("こういう商品ある？ 古着 ジャケット");
  assert("intent product_search", product.intent === "product_search");

  const shop = Intent.classifyIntent("近所のカフェ店舗を探して");
  assert(
    "intent shop_search",
    shop.intent === "shop_search" || shop.intent === "product_search",
    shop.intent
  );

  const service = Intent.classifyIntent("エアコン掃除できる業者ある？");
  assert("intent service_request", service.intent === "service_request");
  const serviceSchema = Schema.fromUserText("東京の清掃業者", { intent: "service_request" });
  assert(
    "fromUserText platform business_service",
    serviceSchema.ok &&
      serviceSchema.value.vertical === "platform" &&
      serviceSchema.value.type === "business_service" &&
      serviceSchema.value.action === "search",
    JSON.stringify(serviceSchema.value)
  );
  assert(
    "intentToType service_request",
    Schema.intentToType("service_request") === "business_service"
  );
  assert("intentToType repair_request stays unmapped", Schema.intentToType("repair_request") == null);
  assert("intentToType delivery_request stays unmapped", Schema.intentToType("delivery_request") == null);
  assert("intentToType worker_request", Schema.intentToType("worker_request") === "worker");
  assert("intentToType job_search", Schema.intentToType("job_search") === "job");
  assert("intentToType skill_request", Schema.intentToType("skill_request") === "skill");
  assert("intentToType product_search", Schema.intentToType("product_search") == null);

  const bizValidate = Schema.validate({
    action: "search",
    vertical: "platform",
    type: "business_service",
    query: "東京の清掃業者",
    location: "東京",
    category: "cleaning",
    sort: "relevance",
  });
  assert(
    "schema platform business_service",
    bizValidate.ok &&
      bizValidate.value.type === "business_service" &&
      bizValidate.value.category === "cleaning",
    JSON.stringify(bizValidate.value)
  );

  const skillIntent = Intent.classifyIntent("動画編集のスキル探して");
  assert("intent skill_request", skillIntent.intent === "skill_request");
  const skillSchema = Schema.fromUserText("動画編集サービス", { intent: "skill_request" });
  assert(
    "fromUserText platform skill",
    skillSchema.ok &&
      skillSchema.value.vertical === "platform" &&
      skillSchema.value.type === "skill" &&
      skillSchema.value.action === "search",
    JSON.stringify(skillSchema.value)
  );
  const skillValidate = Schema.validate({
    action: "search",
    vertical: "platform",
    type: "skill",
    query: "動画編集サービス",
    category: "video_editing",
    location: "東京",
    priceMin: 3000,
    priceMax: 30000,
    sort: "relevance",
  });
  assert(
    "schema platform skill",
    skillValidate.ok &&
      skillValidate.value.type === "skill" &&
      skillValidate.value.category === "video_editing" &&
      skillValidate.value.priceMin === 3000 &&
      skillValidate.value.priceMax === 30000,
    JSON.stringify(skillValidate.value)
  );

  // skill / worker mutual misfire
  assert(
    "skill vs worker: ワーカー探して → worker",
    Intent.classifyIntent("明日手伝ってくれるワーカー探して").intent === "worker_request"
  );
  const workerSchema = Schema.fromUserText("東京で清掃を頼めるワーカー探して", {
    intent: "worker_request",
    hints: { location: "東京", category: "cleaning" },
  });
  assert(
    "fromUserText platform worker",
    workerSchema.ok &&
      workerSchema.value.vertical === "platform" &&
      workerSchema.value.type === "worker" &&
      workerSchema.value.category === "cleaning" &&
      workerSchema.value.action === "search",
    JSON.stringify(workerSchema.value)
  );
  const workerValidate = Schema.validate({
    action: "search",
    vertical: "platform",
    type: "worker",
    query: "清掃ワーカー",
    location: "東京",
    category: "cleaning",
    priceMax: 12000,
    sort: "relevance",
  });
  assert(
    "schema platform worker",
    workerValidate.ok &&
      workerValidate.value.type === "worker" &&
      workerValidate.value.category === "cleaning" &&
      workerValidate.value.priceMax === 12000,
    JSON.stringify(workerValidate.value)
  );
  assert(
    "skill vs worker: 動画編集探して → skill",
    Intent.classifyIntent("動画編集できる人探して").intent === "skill_request"
  );

  const negatives = [
    ["バグの原因を探して", "none"],
    ["このコードから問題を探して", "none"],
    ["仕事の探し方を教えて", "none"],
    ["おすすめの探し方は？", "none"],
    ["検索機能について説明して", "none"],
    ["文章を要約して", "none"],
    ["求人コードを直して", "none"],
    ["依頼文を要約して", "none"],
    ["求人ページのバグを探して", "none"],
    ["サービス説明を書いて", "none"],
    ["この文章から募集条件を抽出して", "none"],
    ["業者の探し方を教えて", "none"],
    ["業務サービスのコードを直して", "none"],
  ];
  for (const [text, expect] of negatives) {
    const r = Intent.classifyIntent(text);
    assert(`intent negative: ${text}`, r.intent === expect, r.intent);
    assert(
      `shouldUseCrossSearch false: ${text}`,
      Intent.shouldUseCrossSearch("cross-matching", text) === false
    );
  }

  // Phase 1 / Phase 2 regressions
  const productReg = Intent.classifyIntent("こういう商品ある？ 古着 ジャケット");
  assert("regression product_search", productReg.intent === "product_search");
  const productSchemaReg = Schema.fromUserText("こういう商品ある？ 古着 ジャケット", {
    intent: "product_search",
  });
  assert(
    "regression marketplace schema",
    productSchemaReg.ok &&
      productSchemaReg.value.vertical === "marketplace" &&
      productSchemaReg.value.type == null
  );

  const jobIntent = Intent.classifyIntent("求人探したい 動画編集");
  assert("intent job_search", jobIntent.intent === "job_search");
  const jobSchema = Schema.fromUserText("求人探したい 動画編集", { intent: "job_search" });
  assert(
    "fromUserText platform job",
    jobSchema.ok &&
      jobSchema.value.vertical === "platform" &&
      jobSchema.value.type === "job" &&
      jobSchema.value.action === "search",
    JSON.stringify(jobSchema.value)
  );
  assert("regression job_search intent", jobIntent.intent === "job_search");

  assert(
    "探して alone → none",
    Intent.classifyIntent("探して").intent === "none"
  );
  assert(
    "empty → none",
    Intent.classifyIntent("").intent === "none"
  );
  assert(
    "product shouldUseCrossSearch",
    Intent.shouldUseCrossSearch("chat", "3000円以下の商品を探して") === true
  );

  const bounds = SearchIntent.extractPriceBounds("予算5000円以下");
  assert("price bounds max", bounds.priceMax === 5000);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
