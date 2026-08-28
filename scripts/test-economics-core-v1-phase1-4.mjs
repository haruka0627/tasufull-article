/**
 * Economics Core V1 Phase 1–4 — unit / contract tests (AD-041).
 */
import assert from "node:assert/strict";
import {
  PRODUCTS,
  FEE_CONTRACTS,
  PROFIT_STATUS,
  COST_TYPES,
  normalizeFxAmount,
  normalizeEconomicsEvent,
  dedupeRecords,
  adaptFixtureEvents,
  aggregateRevenue,
  aggregateVariableCosts,
  computeContributionProfit,
  resolveTlvTipSplit,
  computeTlvTipDistribution,
  computeShopConnectPlatformFee,
  simulateBuilderSuccessFee,
  simulateBuilderProgressiveFee,
  lookupCostContract,
  createCostContractCandidate,
  SHOP_CONNECT_SAMPLE_EVENTS,
  buildEconomicsSummary,
} from "./lib/economics/index.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

function must(raw) {
  const r = normalizeEconomicsEvent(raw);
  assert.equal(r.ok, true, r.error || "normalize failed");
  return r.record;
}

// --- Product support ---
test("products include required ids", () => {
  for (const id of [
    "AI",
    "TLV",
    "SHORT",
    "MARKETPLACE",
    "SHOP_CONNECT",
    "BUILDER",
    "TALK",
    "SITE_AI",
    "PAID_OPTION",
  ]) {
    assert.ok(PRODUCTS.includes(id), id);
  }
});

// --- A. Revenue ---
test("revenue zero", () => {
  const agg = aggregateRevenue([]);
  assert.equal(agg.PERIOD_REVENUE.net_jpy, 0);
  assert.equal(agg.PERIOD_REVENUE.event_count, 0);
});

test("revenue one event", () => {
  const rec = must({
    product: "AI",
    source_id: "r1",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 1000,
    direction: "revenue",
    revenue_type: "SUBSCRIPTION",
  });
  const agg = aggregateRevenue([rec], { period: "2026-08", product: "AI" });
  assert.equal(agg.PERIOD_REVENUE.net_jpy, 1000);
  assert.equal(agg.PRODUCT_REVENUE.net_jpy, 1000);
});

test("revenue duplicate source_id", () => {
  const a = must({
    product: "AI",
    source_id: "dup",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 1000,
    direction: "revenue",
  });
  const b = must({
    product: "AI",
    source_id: "dup",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 2000,
    direction: "revenue",
  });
  const agg = aggregateRevenue([a, b]);
  assert.equal(agg.PERIOD_REVENUE.net_jpy, 2000);
  assert.equal(dedupeRecords([a, b]).length, 1);
});

test("revenue refund deducted", () => {
  const rev = must({
    product: "MARKETPLACE",
    source_id: "m1",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 5000,
    direction: "revenue",
    revenue_type: "TRANSACTION_FEE",
  });
  const ref = must({
    product: "MARKETPLACE",
    source_id: "m1_ref",
    source: "t",
    occurred_at: "2026-08-02T00:00:00Z",
    source_currency: "JPY",
    source_amount: 1000,
    direction: "refund",
    revenue_type: "REFUND",
  });
  const agg = aggregateRevenue([rev, ref]);
  assert.equal(agg.PERIOD_REVENUE.gross_jpy, 5000);
  assert.equal(agg.PERIOD_REVENUE.refunds_jpy, 1000);
  assert.equal(agg.PERIOD_REVENUE.net_jpy, 4000);
});

test("revenue multi-product filter", () => {
  const ai = must({
    product: "AI",
    source_id: "a",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 100,
    direction: "revenue",
  });
  const tlv = must({
    product: "TLV",
    source_id: "b",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 200,
    direction: "revenue",
  });
  assert.equal(aggregateRevenue([ai, tlv], { product: "AI" }).PERIOD_REVENUE.net_jpy, 100);
  assert.equal(aggregateRevenue([ai, tlv], { product: "TLV" }).PERIOD_REVENUE.net_jpy, 200);
});

test("revenue multi-user", () => {
  const u1 = must({
    product: "SHORT",
    user_id: "u1",
    source_id: "s1",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 300,
    direction: "revenue",
  });
  const u2 = must({
    product: "SHORT",
    user_id: "u2",
    source_id: "s2",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 700,
    direction: "revenue",
  });
  assert.equal(aggregateRevenue([u1, u2], { user_id: "u1" }).PERIOD_REVENUE.net_jpy, 300);
  assert.equal(aggregateRevenue([u1, u2], { user_id: "u2" }).USER_ATTRIBUTABLE_REVENUE.net_jpy, 700);
});

test("revenue month boundary", () => {
  const jul = must({
    product: "AI",
    source_id: "j",
    source: "t",
    occurred_at: "2026-07-31T23:00:00Z",
    period: "2026-07",
    source_currency: "JPY",
    source_amount: 10,
    direction: "revenue",
  });
  const aug = must({
    product: "AI",
    source_id: "a",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 20,
    direction: "revenue",
  });
  assert.equal(aggregateRevenue([jul, aug], { period: "2026-07" }).PERIOD_REVENUE.net_jpy, 10);
  assert.equal(aggregateRevenue([jul, aug], { period: "2026-08" }).PERIOD_REVENUE.net_jpy, 20);
});

// --- B. Cost ---
test("cost API / payment / streaming / creator", () => {
  const rows = [
    must({
      product: "AI",
      source_id: "c1",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 50,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
    must({
      product: "AI",
      source_id: "c2",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 30,
      direction: "cost",
      cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
    must({
      product: "TLV",
      source_id: "c3",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 40,
      direction: "cost",
      cost_type: COST_TYPES.STREAMING_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
    must({
      product: "TLV",
      source_id: "c4",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 800,
      direction: "cost",
      cost_type: COST_TYPES.CREATOR_DISTRIBUTION,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const ai = aggregateVariableCosts(rows, { product: "AI", period: "2026-08" });
  assert.equal(ai.total_variable_cost_jpy, 80);
  const tlv = aggregateVariableCosts(rows, { product: "TLV", period: "2026-08" });
  assert.equal(tlv.total_variable_cost_jpy, 840);
});

test("cost missing required → UNAVAILABLE not zero", () => {
  const revOnly = must({
    product: "TLV",
    source_id: "r",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 1000,
    direction: "revenue",
  });
  const costs = aggregateVariableCosts([revOnly], {
    product: "TLV",
    period: "2026-08",
    required_cost_types: [COST_TYPES.STREAMING_COST],
  });
  assert.equal(costs.total_variable_cost_jpy, null);
  assert.ok(costs.unavailable_cost_types.includes(COST_TYPES.STREAMING_COST));
  assert.equal(costs.by_type[COST_TYPES.STREAMING_COST].status, "UNAVAILABLE");
  assert.equal(costs.by_type[COST_TYPES.STREAMING_COST].amount_jpy, null);
});

test("cost estimated flagged", () => {
  const c = must({
    product: "AI",
    source_id: "e1",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 10,
    direction: "cost",
    cost_type: COST_TYPES.EXTERNAL_API_COST,
    cost_class: "DIRECT_VARIABLE",
    actuality: "ESTIMATED",
  });
  const costs = aggregateVariableCosts([c], { product: "AI" });
  assert.deepEqual(costs.estimated_cost_types, [COST_TYPES.EXTERNAL_API_COST]);
  assert.equal(costs.total_variable_cost_jpy, 10);
});

test("cost duplicate ignored", () => {
  const a = must({
    product: "AI",
    source_id: "dupc",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 10,
    direction: "cost",
    cost_type: COST_TYPES.EXTERNAL_API_COST,
    cost_class: "DIRECT_VARIABLE",
  });
  const b = must({
    product: "AI",
    source_id: "dupc",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    source_currency: "JPY",
    source_amount: 99,
    direction: "cost",
    cost_type: COST_TYPES.EXTERNAL_API_COST,
    cost_class: "DIRECT_VARIABLE",
  });
  assert.equal(aggregateVariableCosts([a, b]).total_variable_cost_jpy, 99);
});

// --- C. Contribution ---
test("contribution positive / zero / negative", () => {
  const make = (rev, cost) => {
    const records = [
      must({
        product: "SHOP_CONNECT",
        source_id: `r_${rev}`,
        source: "t",
        occurred_at: "2026-08-01T00:00:00Z",
        period: "2026-08",
        source_currency: "JPY",
        source_amount: rev,
        direction: "revenue",
        fee_contract_id: "SHOP_CONNECT",
      }),
      must({
        product: "SHOP_CONNECT",
        source_id: `c_${cost}`,
        source: "t",
        occurred_at: "2026-08-01T00:00:00Z",
        period: "2026-08",
        source_currency: "JPY",
        source_amount: cost,
        direction: "cost",
        cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
        cost_class: "DIRECT_VARIABLE",
      }),
    ];
    return computeContributionProfit({
      records,
      product: "SHOP_CONNECT",
      period: "2026-08",
    }).PERIOD_CONTRIBUTION_PROFIT;
  };
  assert.equal(make(1000, 300).contribution_profit_jpy, 700);
  assert.equal(make(1000, 1000).contribution_profit_jpy, 0);
  assert.equal(make(1000, 1200).contribution_profit_jpy, -200);
  assert.equal(make(1000, 300).PROFIT_STATUS, PROFIT_STATUS.COMPLETE_ACTUAL);
});

test("contribution partial actual when streaming missing", () => {
  const records = [
    must({
      product: "TLV",
      source_id: "tr",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 1000,
      direction: "revenue",
    }),
    must({
      product: "TLV",
      source_id: "tp",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 50,
      direction: "cost",
      cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const out = computeContributionProfit({
    records,
    product: "TLV",
    period: "2026-08",
    required_cost_types: [COST_TYPES.STREAMING_COST],
  }).PERIOD_CONTRIBUTION_PROFIT;
  assert.equal(out.contribution_profit_jpy, null);
  assert.equal(out.PROFIT_STATUS, PROFIT_STATUS.PARTIAL_ACTUAL);
});

test("contribution estimated status", () => {
  const records = [
    must({
      product: "AI",
      source_id: "er",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 100,
      direction: "revenue",
    }),
    must({
      product: "AI",
      source_id: "ec",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 20,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: "DIRECT_VARIABLE",
      actuality: "ESTIMATED",
    }),
  ];
  const out = computeContributionProfit({
    records,
    product: "AI",
    period: "2026-08",
  }).PERIOD_CONTRIBUTION_PROFIT;
  assert.equal(out.contribution_profit_jpy, 80);
  assert.equal(out.PROFIT_STATUS, PROFIT_STATUS.ESTIMATED);
});

// --- D. TLV tip boundaries ---
test("tlv progressive tip 4999999", () => {
  const s = resolveTlvTipSplit(4_999_999);
  assert.equal(s.creator_pct, 80);
  assert.equal(s.tasful_pct, 20);
  const d = computeTlvTipDistribution(4_999_999);
  assert.equal(d.creator_distribution_jpy + d.tasful_share_jpy, 4_999_999);
});

test("tlv progressive tip 5000000 is still entirely first bracket", () => {
  const s = resolveTlvTipSplit(5_000_000);
  assert.equal(s.creator_pct, 80);
  assert.equal(s.tasful_pct, 20);
  assert.equal(computeTlvTipDistribution(5_000_000).creator_distribution_jpy, 4_000_000);
});

test("tlv progressive tip 9999999", () => {
  const s = resolveTlvTipSplit(9_999_999);
  assert.equal(s.creator_pct, 90);
  assert.equal(s.tasful_pct, 10);
  assert.equal(computeTlvTipDistribution(9_999_999).creator_distribution_jpy, 8_499_999);
});

test("tlv progressive tip 10000000 is still second marginal bracket", () => {
  const s = resolveTlvTipSplit(10_000_000);
  assert.equal(s.creator_pct, 90);
  assert.equal(s.tasful_pct, 10);
  assert.equal(computeTlvTipDistribution(10_000_000).creator_distribution_jpy, 8_500_000);
});

test("tlv progressive tip 30m and 100m examples", () => {
  const thirty = computeTlvTipDistribution(30_000_000);
  assert.equal(thirty.creator_distribution_jpy, 27_500_000);
  assert.equal(thirty.tasful_share_jpy, 2_500_000);
  const hundred = computeTlvTipDistribution(100_000_000);
  assert.equal(hundred.creator_distribution_jpy, 96_800_000);
  assert.equal(hundred.tasful_share_jpy, 3_200_000);
  assert.equal(hundred.bracket_breakdown.length, 4);
});

// --- E. Shop Connect ---
test("shop connect fee contract 10% min none", () => {
  assert.equal(FEE_CONTRACTS.SHOP_CONNECT.fee_contract_id, "SHOP_CONNECT");
  assert.equal(FEE_CONTRACTS.SHOP_CONNECT.rate, 0.1);
  assert.equal(FEE_CONTRACTS.SHOP_CONNECT.minimum_jpy, null);
  const fee = computeShopConnectPlatformFee(10_000);
  assert.equal(fee.tasful_revenue_jpy, 1000);
  assert.equal(fee.minimum_jpy, null);
  assert.equal(fee.fee_contract_id, "SHOP_CONNECT");
});

test("shop connect sample contribution", () => {
  const { records, errors } = adaptFixtureEvents(SHOP_CONNECT_SAMPLE_EVENTS);
  assert.equal(errors.length, 0);
  const out = computeContributionProfit({
    records,
    product: "SHOP_CONNECT",
    period: "2026-08",
  }).PERIOD_CONTRIBUTION_PROFIT;
  assert.equal(out.attributable_revenue_jpy, 1000);
  assert.equal(out.attributable_variable_cost_jpy, 364);
  assert.equal(out.contribution_profit_jpy, 636);
  assert.equal(out.PROFIT_STATUS, PROFIT_STATUS.COMPLETE_ACTUAL);
});

// --- F. FX ---
test("fx valid USD", () => {
  const fx = normalizeFxAmount({
    source_currency: "USD",
    source_amount: 10,
    fx_rate: 150,
    fx_source: "VENDOR",
    fx_timestamp: "2026-08-01T00:00:00Z",
  });
  assert.equal(fx.normalized_jpy, 1500);
  assert.equal(fx.fx_status, "ACTUAL");
});

test("fx missing rate", () => {
  const fx = normalizeFxAmount({ source_currency: "USD", source_amount: 10 });
  assert.equal(fx.normalized_jpy, null);
  assert.equal(fx.fx_status, "MISSING");
});

test("fx unsupported currency", () => {
  const fx = normalizeFxAmount({
    source_currency: "XYZ",
    source_amount: 10,
    fx_rate: 2,
  });
  assert.equal(fx.normalized_jpy, null);
  assert.equal(fx.fx_status, "UNSUPPORTED_CURRENCY");
});

// --- Builder scenario only ---
test("builder 8/6/5 scenario only", () => {
  const s = simulateBuilderSuccessFee(100_000, 8);
  assert.equal(s.ok, true);
  assert.equal(s.fee_jpy, 8000);
  assert.equal(s.status, "PRICING_SCENARIO_ONLY");
  assert.equal(s.runtime_applied, false);
  assert.equal(simulateBuilderProgressiveFee(100_000, []).ok, false);
});

// --- Cost contract / radar ---
test("cost contract candidate not auto-applied", () => {
  const cand = createCostContractCandidate({
    vendor: "openai",
    service: "api",
    sku_or_model: "gpt-test",
    billing_unit: "1k_tokens",
    currency: "USD",
    unit_cost: 0.01,
    effective_from: "2026-08-01",
    source: "daily_radar",
  });
  assert.equal(cand.verification_status, "CANDIDATE");
  assert.equal(cand.auto_apply, false);
  const found = lookupCostContract([cand], {
    vendor: "openai",
    service: "api",
    sku_or_model: "gpt-test",
  });
  assert.ok(found);
});

test("secretary payload shape only", () => {
  const p = buildEconomicsSummary({ contribution_profit_jpy: 1 });
  assert.equal(p.ok, true);
  assert.equal(p.wired_to_secretary_runtime, false);
  assert.equal(p.llm_must_not_recalculate, true);
});

console.log(`\nTOTAL=${passed + failed} PASS=${passed} FAIL=${failed}`);
if (failed > 0) process.exit(1);
