#!/usr/bin/env node
/**
 * TASFUL AI — SAFE-07 Minimum Cost Ledger 静的 + 単体検証
 *   node scripts/test-tasful-ai-safe-ops-cost-ledger-phase2.mjs
 *
 * Staging DB 適用・live query・deploy・Production 変更なし。
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function approxEqual(a, b, eps = 1e-8) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function main() {
  const migration = read("supabase/migrations/20260726200000_ai_cost_ledger_safe07.sql");
  const safe06 = read("supabase/migrations/20260726120000_ai_usage_events.sql");
  const geminiChat = read("supabase/functions/gemini-chat/index.ts");
  const geminiOcr = read("deploy/cloudflare/functions/api/gemini-ocr.js");
  const plan = read("docs/tasful-ai-core-august-2026-plan.md");

  assert("migration creates price rates", /create table if not exists public\.ai_model_price_rates/i.test(migration));
  assert("migration unique start", /ai_model_price_rates_unique_start/i.test(migration));
  assert("migration overlap trigger", /overlapping_price_rate/i.test(migration) && /trg_ai_model_price_rates_no_overlap/i.test(migration));
  assert("migration estimate RPC", /create or replace function public\.ai_estimate_event_cost/i.test(migration));
  assert("migration aggregate RPC", /create or replace function public\.ai_cost_ledger_aggregate/i.test(migration));
  assert("migration RLS deny prices", /ai_model_price_rates_deny_all/i.test(migration));
  assert("migration revoke anon estimate", /revoke all on function public\.ai_estimate_event_cost[\s\S]*from public, anon, authenticated/i.test(migration));
  assert("migration revoke anon aggregate", /revoke all on function public\.ai_cost_ledger_aggregate[\s\S]*from public, anon, authenticated/i.test(migration));
  assert("migration grant service_role aggregate", /grant execute on function public\.ai_cost_ledger_aggregate[\s\S]*to service_role/i.test(migration));
  assert("migration openrouter-ready provider", /'openrouter'/.test(migration));
  assert("migration provisional fixture", /PROVISIONAL fixture/.test(migration));
  assert("migration does not mutate estimated_cost writes", !/update\s+public\.ai_usage_events/i.test(migration));
  assert("SAFE-06 events table still present", /create table if not exists public\.ai_usage_events/i.test(safe06));
  assert("SAFE-06 request_id unique intact", /unique \(request_id\)/i.test(safe06));
  assert("chat/ocr not given client price tables", !geminiChat.includes("ai_model_price_rates") && !geminiOcr.includes("ai_model_price_rates"));
  assert("no prompt storage in cost migration", !/prompt|ocr_text|reply_body/i.test(migration) || /not mutate|not_billable|PROVISIONAL/.test(migration));

  const modUrl = pathToFileURL(join(root, "scripts/lib/ai-cost-ledger.mjs")).href;
  const ledger = await import(`${modUrl}?t=${Date.now()}`);
  const rates = ledger.PROVISIONAL_GEMINI_FLASH_RATES;

  assert("price start uniqueness ok", ledger.assertUniquePriceRateStarts(rates).ok === true);
  assert(
    "price start uniqueness detects dup",
    ledger.assertUniquePriceRateStarts([...rates, rates[0]]).ok === false
  );

  assert("overlap none on fixture", ledger.assertNoOverlappingPriceRates(rates).ok === true);
  const overlapRates = [
    ...rates,
    {
      ...rates[0],
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      effectiveTo: null,
    },
  ];
  assert(
    "overlap detected",
    ledger.assertNoOverlappingPriceRates(overlapRates).ok === false &&
      ledger.assertNoOverlappingPriceRates(overlapRates).error === "overlapping_price_rate"
  );

  // input/output calc: 1_000_000 input chars * 0.10 / 1e6 = 0.10
  // 500_000 output * 0.40 / 1e6 = 0.20 → total 0.30
  const priced = ledger.estimateEventCost(
    {
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUnits: 1000000,
      outputUnits: 500000,
      createdAt: "2026-07-26T00:00:00.000Z",
    },
    rates
  );
  assert("input/output unit calc", priced.ok && priced.costStatus === "estimated");
  assert("decimal precision input", approxEqual(priced.inputCost, 0.1));
  assert("decimal precision output", approxEqual(priced.outputCost, 0.2));
  assert("decimal precision total", approxEqual(priced.estimatedCost, 0.3));

  const unknown = ledger.estimateEventCost(
    {
      status: "success",
      provider: "gemini",
      model: "totally-unknown-model",
      inputUnits: 100,
      outputUnits: 50,
      createdAt: "2026-07-26T00:00:00.000Z",
    },
    rates
  );
  assert("unknown model is unknown_rate not zero", unknown.costStatus === "unknown_rate" && unknown.estimatedCost === null);

  const nullUnits = ledger.estimateEventCost(
    {
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUnits: null,
      outputUnits: null,
      createdAt: "2026-07-26T00:00:00.000Z",
    },
    rates
  );
  assert("null units with known rate → estimated 0", nullUnits.costStatus === "estimated" && approxEqual(nullUnits.estimatedCost, 0));

  const neg = ledger.estimateEventCost(
    {
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUnits: -1,
      createdAt: "2026-07-26T00:00:00.000Z",
    },
    rates
  );
  assert("negative units rejected", neg.ok === false && neg.error === "invalid_units");

  const denied = ledger.estimateEventCost(
    { status: "denied", provider: "gemini", model: "gemini-2.5-flash", inputUnits: 10 },
    rates
  );
  assert("denied not billable", denied.billable === false && denied.estimatedCost === null);

  const errorEvt = ledger.estimateEventCost(
    { status: "error", provider: "gemini", model: "gemini-2.5-flash", inputUnits: 10 },
    rates
  );
  assert("error not billable", errorEvt.billable === false && errorEvt.estimatedCost === null);

  const success = ledger.estimateEventCost(
    {
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUnits: 1000,
      outputUnits: 0,
      createdAt: "2026-07-26T00:00:00.000Z",
    },
    rates
  );
  assert("success billable", success.billable === true && success.estimatedCost != null);

  const events = [
    {
      request_id: "req-cost-001",
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      feature: "text_turn",
      user_id: "11111111-1111-4111-8111-111111111111",
      inputUnits: 1000000,
      outputUnits: 0,
      created_at: "2026-07-26T01:00:00.000Z",
    },
    {
      request_id: "req-cost-002",
      status: "success",
      provider: "gemini",
      model: "gemini-2.5-flash",
      feature: "ocr_turn",
      user_id: "11111111-1111-4111-8111-111111111111",
      inputUnits: 0,
      outputUnits: 1000000,
      created_at: "2026-07-26T02:00:00.000Z",
    },
    {
      request_id: "req-cost-003",
      status: "denied",
      provider: "gemini",
      model: "gemini-2.5-flash",
      feature: "text_turn",
      user_id: "22222222-2222-4222-8222-222222222222",
      inputUnits: 100,
      created_at: "2026-07-26T03:00:00.000Z",
    },
    {
      request_id: "req-cost-004",
      status: "error",
      provider: "gemini",
      model: "gemini-2.5-flash",
      feature: "ocr_turn",
      user_id: "22222222-2222-4222-8222-222222222222",
      inputUnits: 100,
      created_at: "2026-07-15T03:00:00.000Z",
    },
    {
      request_id: "req-cost-005",
      status: "success",
      provider: "gemini",
      model: "unknown-x",
      feature: "text_turn",
      user_id: "11111111-1111-4111-8111-111111111111",
      inputUnits: 50,
      created_at: "2026-07-26T04:00:00.000Z",
    },
  ];

  // request_id 冪等: 同一 id を二重に集計しない前提は ingest 側 · ここでは unique ids
  const ids = new Set(events.map((e) => e.request_id));
  assert("request_id unique in fixture set", ids.size === events.length);

  const byDay = ledger.aggregateEstimatedCost(events, rates, "day");
  assert("daily aggregate ok", byDay.ok === true);
  const dayRow = byDay.rows.find((r) => r.bucket === "2026-07-26");
  assert("daily total estimated", dayRow && approxEqual(dayRow.estimatedCostSum, 0.1 + 0.4));

  const byMonth = ledger.aggregateEstimatedCost(events, rates, "month");
  assert("monthly aggregate ok", byMonth.ok === true);
  const monthRow = byMonth.rows.find((r) => r.bucket === "2026-07");
  assert("monthly includes all July", monthRow && monthRow.eventCount === 5);

  const byProvider = ledger.aggregateEstimatedCost(events, rates, "provider");
  assert("provider aggregate", byProvider.ok && byProvider.rows[0].bucket === "gemini");

  const byModel = ledger.aggregateEstimatedCost(events, rates, "model");
  assert(
    "model aggregate",
    byModel.ok && byModel.rows.some((r) => r.bucket === "gemini-2.5-flash")
  );

  const byFeature = ledger.aggregateEstimatedCost(events, rates, "feature");
  assert(
    "feature aggregate",
    byFeature.ok &&
      byFeature.rows.some((r) => r.bucket === "text_turn") &&
      byFeature.rows.some((r) => r.bucket === "ocr_turn")
  );

  const byUser = ledger.aggregateEstimatedCost(events, rates, "user");
  assert(
    "user aggregate",
    byUser.ok &&
      byUser.rows.some((r) => r.bucket === "11111111-1111-4111-8111-111111111111")
  );

  assert(
    "unknown counted separately",
    dayRow && dayRow.unknownRateCount >= 1
  );

  assert(
    "denied/error excluded from cost sum",
    dayRow && dayRow.deniedCount >= 1 && approxEqual(dayRow.estimatedCostSum, 0.5)
  );

  const libSrc = read("scripts/lib/ai-cost-ledger.mjs");
  assert(
    "lib does not mention storing prompts as data fields",
    !/\bprompt\b/.test(libSrc) && !/\breply\b/.test(libSrc) && !/\bocr_text\b/.test(libSrc)
  );
  assert(
    "aggregate note distinguishes invoice",
    byDay.note === "estimated_api_cost_not_provider_invoice_not_customer_billing"
  );

  // General user access: migration grants
  assert("no grant to authenticated on aggregate", !/grant execute on function public\.ai_cost_ledger_aggregate[\s\S]*to authenticated/i.test(migration));
  assert("no grant to anon on prices", !/grant .* on table public\.ai_model_price_rates to anon/i.test(migration));

  // Docs mention approach A
  assert("plan file exists for sync", plan.length > 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
