/**
 * Economics Core V1 Phase 5 — User Contribution + read-only adapters.
 */
import assert from "node:assert/strict";
import {
  PROFIT_STATUS,
  COST_TYPES,
  FEE_CONTRACTS,
  adaptFixtureEvents,
  SHOP_CONNECT_SAMPLE_EVENTS,
  normalizeEconomicsEvent,
  computeUserContribution,
  computeUserContributionLedger,
  reconcilePlatformToUsers,
  adaptShopConnectCheckouts,
  adaptTlvTipEvents,
  adaptAiUsageEvents,
  adaptMarketplaceFees,
  adaptBuilderScenarioRows,
  simulateBuilderSuccessFee,
  buildBenefitEconomicsInput,
  monthlyPeriodBounds,
  PRODUCT_ADAPTER_REGISTRY,
  resolveTlvTipSplit,
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

// A. User attribution
test("user one user contribution", () => {
  const records = [
    must({
      product: "AI",
      user_id: "u1",
      user_role: "AI_SUBSCRIBER",
      source_id: "a1",
      source: "t",
      occurred_at: "2026-08-05T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 1000,
      direction: "revenue",
    }),
    must({
      product: "AI",
      user_id: "u1",
      source_id: "c1",
      source: "t",
      occurred_at: "2026-08-05T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 200,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const u = computeUserContribution({ records, user_id: "u1", period: "2026-08" });
  assert.equal(u.revenue_jpy, 1000);
  assert.equal(u.variable_cost_jpy, 200);
  assert.equal(u.contribution_profit_jpy, 800);
  assert.ok(u.roles.includes("AI_SUBSCRIBER"));
});

test("user multiple users + unattributed", () => {
  const records = [
    must({
      product: "AI",
      user_id: "u1",
      source_id: "a",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 100,
      direction: "revenue",
    }),
    must({
      product: "AI",
      user_id: "u2",
      source_id: "b",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 50,
      direction: "revenue",
    }),
    must({
      product: "AI",
      user_id: null,
      source_id: "c",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 25,
      direction: "revenue",
    }),
  ];
  const ledger = computeUserContributionLedger({ records, period: "2026-08" });
  assert.equal(ledger.user_count, 2);
  assert.equal(ledger.has_unattributed, true);
  assert.equal(ledger.unattributed.revenue_jpy, 25);
  assert.equal(ledger.unattributed.attribution_status, "UNATTRIBUTED");
});

test("same user multiple products and roles", () => {
  const records = [
    must({
      product: "AI",
      user_id: "ux",
      user_role: "AI_SUBSCRIBER",
      source_id: "r1",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 500,
      direction: "revenue",
    }),
    must({
      product: "SHOP_CONNECT",
      user_id: "ux",
      user_role: "SELLER",
      source_id: "r2",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 1000,
      direction: "revenue",
      fee_contract_id: "SHOP_CONNECT",
    }),
    must({
      product: "AI",
      user_id: "ux",
      source_id: "c1",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 100,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
    must({
      product: "SHOP_CONNECT",
      user_id: "ux",
      source_id: "c2",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 364,
      direction: "cost",
      cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const u = computeUserContribution({ records, user_id: "ux", period: "2026-08" });
  assert.equal(u.products.AI.contribution_profit_jpy, 400);
  assert.equal(u.products.SHOP_CONNECT.contribution_profit_jpy, 636);
  assert.equal(u.contribution_profit_jpy, 1036);
  assert.ok(u.roles.includes("AI_SUBSCRIBER"));
  assert.ok(u.roles.includes("SELLER"));
});

// B. Refund
test("refund clears contribution", () => {
  const records = [
    must({
      product: "MARKETPLACE",
      user_id: "s1",
      source_id: "f1",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 10000,
      direction: "revenue",
    }),
    must({
      product: "MARKETPLACE",
      user_id: "s1",
      source_id: "f1r",
      source: "t",
      occurred_at: "2026-08-02T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 10000,
      direction: "refund",
      revenue_type: "REFUND",
    }),
    must({
      product: "MARKETPLACE",
      user_id: "s1",
      source_id: "pc",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 0,
      direction: "cost",
      cost_type: COST_TYPES.PAYMENT_PROCESSING_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const u = computeUserContribution({ records, user_id: "s1", period: "2026-08" });
  assert.equal(u.revenue_jpy, 0);
  assert.equal(u.contribution_profit_jpy, 0);
});

test("partial refund", () => {
  const records = [
    must({
      product: "MARKETPLACE",
      user_id: "s1",
      source_id: "f2",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 1000,
      direction: "revenue",
    }),
    must({
      product: "MARKETPLACE",
      user_id: "s1",
      source_id: "f2r",
      source: "t",
      occurred_at: "2026-08-02T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 400,
      direction: "refund",
      revenue_type: "REFUND",
    }),
  ];
  const u = computeUserContribution({ records, user_id: "s1", period: "2026-08" });
  assert.equal(u.revenue_jpy, 600);
});

test("duplicate source ignored", () => {
  const a = must({
    product: "AI",
    user_id: "u1",
    source_id: "dup",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 10,
    direction: "revenue",
  });
  const b = must({
    product: "AI",
    user_id: "u1",
    source_id: "dup",
    source: "t",
    occurred_at: "2026-08-01T00:00:00Z",
    period: "2026-08",
    source_currency: "JPY",
    source_amount: 99,
    direction: "revenue",
  });
  const u = computeUserContribution({ records: [a, b], user_id: "u1", period: "2026-08" });
  assert.equal(u.revenue_jpy, 99);
});

// C. Cost / negative / missing
test("negative contribution preserved", () => {
  const records = [
    must({
      product: "AI",
      user_id: "u1",
      source_id: "nr",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 500,
      direction: "revenue",
    }),
    must({
      product: "AI",
      user_id: "u1",
      source_id: "nc",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 700,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const u = computeUserContribution({ records, user_id: "u1", period: "2026-08" });
  assert.equal(u.contribution_profit_jpy, -200);
});

test("missing required cost → PARTIAL_ACTUAL not zero", () => {
  const records = [
    must({
      product: "TLV",
      user_id: "c1",
      source_id: "tr",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 1000,
      direction: "revenue",
    }),
  ];
  const u = computeUserContribution({
    records,
    user_id: "c1",
    period: "2026-08",
    required_cost_types: [COST_TYPES.STREAMING_COST],
  });
  assert.equal(u.contribution_profit_jpy, null);
  assert.equal(u.status, PROFIT_STATUS.PARTIAL_ACTUAL);
  assert.equal(u.missing_cost_zero_forbidden, true);
});

test("estimated status", () => {
  const records = [
    must({
      product: "AI",
      user_id: "u1",
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
      user_id: "u1",
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
  const u = computeUserContribution({ records, user_id: "u1", period: "2026-08" });
  assert.equal(u.status, PROFIT_STATUS.ESTIMATED);
});

// D. Reconciliation / multiparty
test("reconciliation user + unattributed = platform", () => {
  const records = [
    must({
      product: "AI",
      user_id: "u1",
      source_id: "1",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 100,
      direction: "revenue",
    }),
    must({
      product: "AI",
      user_id: null,
      source_id: "2",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 40,
      direction: "revenue",
    }),
    must({
      product: "AI",
      user_id: "u1",
      source_id: "3",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "JPY",
      source_amount: 10,
      direction: "cost",
      cost_type: COST_TYPES.EXTERNAL_API_COST,
      cost_class: "DIRECT_VARIABLE",
    }),
  ];
  const rec = reconcilePlatformToUsers({ records, period: "2026-08" });
  assert.equal(rec.ok, true);
  assert.equal(rec.PLATFORM_REVENUE, 140);
  assert.equal(rec.USER_ATTRIBUTED_PLUS_UNATTRIBUTED_REVENUE, 140);
});

test("marketplace fee counted once (not double payer+seller)", () => {
  const adapted = adaptMarketplaceFees([
    {
      id: "mp1",
      fee_jpy: 550,
      seller_id: "seller_a",
      payer_id: "buyer_b",
      payment_processing_cost_jpy: 50,
      occurred_at: "2026-08-01T00:00:00Z",
    },
  ]);
  assert.equal(adapted.records.filter((r) => r.direction === "revenue").length, 1);
  const ledger = computeUserContributionLedger({
    records: adapted.records,
    period: "2026-08",
  });
  assert.equal(ledger.user_count, 1);
  assert.equal(ledger.users[0].revenue_jpy, 550);
  const rec = reconcilePlatformToUsers({ records: adapted.records, period: "2026-08" });
  assert.equal(rec.ok, true);
});

// E. Shop Connect
test("shop connect GMV 10000 → contribution 636", () => {
  const adapted = adaptShopConnectCheckouts([
    {
      id: "sc1",
      seller_id: "seller_fixture_01",
      gmv_jpy: 10000,
      payment_processing_cost_jpy: 364,
      occurred_at: "2026-08-10T12:00:00.000Z",
    },
  ]);
  const u = computeUserContribution({
    records: adapted.records,
    user_id: "seller_fixture_01",
    period: "2026-08",
  });
  assert.equal(u.revenue_jpy, 1000);
  assert.equal(u.variable_cost_jpy, 364);
  assert.equal(u.contribution_profit_jpy, 636);
  assert.equal(FEE_CONTRACTS.SHOP_CONNECT.rate, 0.1);
  assert.equal(FEE_CONTRACTS.SHOP_CONNECT.minimum_jpy, null);

  const fixture = adaptFixtureEvents(SHOP_CONNECT_SAMPLE_EVENTS);
  const u2 = computeUserContribution({
    records: fixture.records,
    user_id: "seller_fixture_01",
    period: "2026-08",
  });
  assert.equal(u2.contribution_profit_jpy, 636);
});

// F. Builder scenario excluded
test("builder 8/6/5 excluded from actual contribution", () => {
  const scenario = simulateBuilderSuccessFee(100000, 8);
  assert.equal(scenario.status, "PRICING_SCENARIO_ONLY");
  const adapted = adaptBuilderScenarioRows([{ id: "scen1", amount: 100000 }]);
  assert.equal(adapted.records.length, 0);
  assert.equal(adapted.included_in_actual_contribution, false);
  const u = computeUserContribution({
    records: adapted.records,
    user_id: "partner1",
    period: "2026-08",
  });
  assert.equal(u.revenue_jpy, 0);
  assert.equal(u.contribution_profit_jpy, 0);
});

// G. TLV AD-040
test("tlv tip adapter uses AD-040 progressive marginal brackets", () => {
  assert.equal(resolveTlvTipSplit(4_999_999).creator_pct, 80);
  assert.equal(resolveTlvTipSplit(5_000_000).creator_pct, 80);
  assert.equal(resolveTlvTipSplit(5_000_001).creator_pct, 90);
  assert.equal(resolveTlvTipSplit(10_000_000).creator_pct, 90);
  assert.equal(resolveTlvTipSplit(10_000_001).creator_pct, 95);
  assert.equal(resolveTlvTipSplit(30_000_001).creator_pct, 99);
  const adapted = adaptTlvTipEvents([
    {
      id: "tip1",
      creator_id: "creator1",
      net_amount_jpy: 10000,
      source_table: "tlv.revenue_ledger",
      occurred_at: "2026-08-01T00:00:00Z",
    },
  ]);
  const u = computeUserContribution({
    records: adapted.records,
    user_id: "creator1",
    period: "2026-08",
  });
  // Adapter emits canonical Net only. Creator distribution is deferred to the
  // monthly settlement engine to prevent row/event rounding.
  assert.equal(u.revenue_jpy, 10000);
  assert.equal(u.variable_cost_jpy, 0);
  assert.equal(u.contribution_profit_jpy, 10000);
  assert.equal(adapted.creator_distribution_deferred_to_monthly_settlement, true);
});

// H. Status enum coverage already above; UNAVAILABLE via FX
test("status UNAVAILABLE when FX missing on revenue", () => {
  const records = [
    must({
      product: "AI",
      user_id: "u1",
      source_id: "fx1",
      source: "t",
      occurred_at: "2026-08-01T00:00:00Z",
      period: "2026-08",
      source_currency: "USD",
      source_amount: 10,
      direction: "revenue",
    }),
  ];
  const u = computeUserContribution({ records, user_id: "u1", period: "2026-08" });
  assert.equal(u.status, PROFIT_STATUS.UNAVAILABLE);
});

test("ai usage adapter shape + benefit input", () => {
  const adapted = adaptAiUsageEvents([
    {
      request_id: "req12345678",
      user_id: "u1",
      feature: "chat",
      provider: "gemini",
      estimated_cost: 12,
      currency: "JPY",
      created_at: "2026-08-01T00:00:00Z",
    },
  ]);
  assert.equal(adapted.status, "REAL_READ_ONLY_ADAPTER");
  assert.equal(adapted.connected, false);
  assert.equal(adapted.records[0].cost_type, COST_TYPES.EXTERNAL_API_COST);
  const u = computeUserContribution({
    records: [
      must({
        product: "AI",
        user_id: "u1",
        source_id: "rev",
        source: "t",
        occurred_at: "2026-08-01T00:00:00Z",
        period: "2026-08",
        source_currency: "JPY",
        source_amount: 100,
        direction: "revenue",
      }),
      ...adapted.records,
    ],
    user_id: "u1",
    period: "2026-08",
  });
  const benefit = buildBenefitEconomicsInput(u);
  assert.equal(benefit.ok, true);
  assert.equal(benefit.eligibility_decision, null);
  assert.equal(benefit.benefit_eligibility_implemented, false);
});

test("monthly period bounds Asia/Tokyo", () => {
  const b = monthlyPeriodBounds("2026-08");
  assert.equal(b.ok, true);
  assert.equal(b.timezone, "Asia/Tokyo");
  assert.ok(b.period_start);
  assert.ok(b.period_end);
});

test("adapter registry honest statuses", () => {
  assert.equal(PRODUCT_ADAPTER_REGISTRY.SHOP_CONNECT.connected, false);
  assert.equal(PRODUCT_ADAPTER_REGISTRY.BUILDER.status, "NOT_CONNECTED");
  assert.equal(PRODUCT_ADAPTER_REGISTRY.TALK.status, "NOT_CONNECTED");
  assert.equal(PRODUCT_ADAPTER_REGISTRY.AI.status, "REAL_READ_ONLY_ADAPTER");
});

console.log(`\nPHASE5 TOTAL=${passed + failed} PASS=${passed} FAIL=${failed}`);
if (failed > 0) process.exit(1);
