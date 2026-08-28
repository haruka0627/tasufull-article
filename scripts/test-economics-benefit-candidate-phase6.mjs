/**
 * Benefit Candidate policy tests — ADR-043 Accepted + Phase 7 amendment (no entitlement).
 */
import assert from "node:assert/strict";
import {
  computeBenefitBudget,
  resolveBenefitCost,
  buildBenefitCandidate,
  simulateBenefitGrid,
  simulateTlvCreatorCases,
  LOCKED_FINANCIAL_BASE,
  LOCKED_BENEFIT_RATE,
  LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY,
  LOCKED_BASE_RETAINED_CONTRIBUTION_TARGET,
  LOCKED_HIGH_CONTRIBUTION_MODEL,
  LOCKED_BENEFIT_COST_BASIS,
  LOCKED_PERIOD,
  LOCKED_PERIOD_TIMEZONE,
  LOCKED_BENEFIT_CARRYOVER,
  LOCKED_CASH_BENEFIT,
  LOCKED_V1_PRIMARY_DELIVERY,
  LOCKED_BENEFIT_COIN_STATUS,
  ADR043_LOCKED_POLICY,
  STATUS_ELIGIBILITY_DESIGN,
  PROFIT_STATUS,
} from "./lib/economics/index.mjs";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${name}`, e);
  }
}

const verifiedOpts = [
  {
    option_id: "a",
    normal_user_price: 1000,
    tasful_variable_cost: 300,
    benefit_cost: 300,
    cost_status: "VERIFIED",
  },
  {
    option_id: "b",
    normal_user_price: 3000,
    tasful_variable_cost: 700,
    benefit_cost: 700,
    cost_status: "VERIFIED",
  },
  {
    option_id: "c",
    normal_user_price: 5000,
    tasful_variable_cost: 2000,
    benefit_cost: 2000,
    cost_status: "VERIFIED",
  },
];

test("ADR043 locked policy constants Phase7", () => {
  assert.equal(LOCKED_FINANCIAL_BASE, "C_COMPLETE_ACTUAL_CONTRIBUTION_ONLY");
  assert.equal(LOCKED_BENEFIT_RATE, 0.15);
  assert.equal(LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY, 30000);
  assert.equal(LOCKED_BASE_RETAINED_CONTRIBUTION_TARGET, 0.85);
  assert.equal(LOCKED_HIGH_CONTRIBUTION_MODEL, "ONE_OPTION_PER_MONTH");
  assert.equal(
    LOCKED_BENEFIT_COST_BASIS,
    "VERIFIED_TASFUL_ATTRIBUTABLE_OPTION_COST",
  );
  assert.equal(LOCKED_PERIOD, "MONTHLY_PRIOR_CALENDAR");
  assert.equal(LOCKED_PERIOD_TIMEZONE, "Asia/Tokyo");
  assert.equal(LOCKED_BENEFIT_CARRYOVER, false);
  assert.equal(LOCKED_CASH_BENEFIT, false);
  assert.equal(LOCKED_V1_PRIMARY_DELIVERY, "VISIBLE_PREMIUM_OPTION_GRANT");
  assert.equal(LOCKED_BENEFIT_COIN_STATUS, "DEFERRED");
  assert.equal(ADR043_LOCKED_POLICY.unused_budget_to_coin, false);
  assert.equal(ADR043_LOCKED_POLICY.human_approval_required, true);
  assert.equal(ADR043_LOCKED_POLICY.automatic_grant, false);
  assert.equal(ADR043_LOCKED_POLICY.entitlement_implemented, false);
});

test("budget 15% on 30000 retains 85%", () => {
  const b = computeBenefitBudget(30000, LOCKED_BENEFIT_RATE);
  assert.equal(b.benefit_budget_jpy, 4500);
  assert.equal(b.retained_before_option_cost_jpy, 25500);
  assert.equal(b.retained_pct_before_option, 0.85);
});

test("non-positive contribution no budget", () => {
  const b = computeBenefitBudget(0, LOCKED_BENEFIT_RATE);
  assert.equal(b.eligible_for_budget, false);
  assert.equal(b.benefit_budget_jpy, 0);
});

test("negative contribution candidate no", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: -100,
    status: PROFIT_STATUS.COMPLETE_ACTUAL,
  });
  assert.equal(cand.candidate, false);
});

test("BOUNDARY 29999 not standard eligible", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 29999,
    status: PROFIT_STATUS.COMPLETE_ACTUAL,
  });
  assert.equal(cand.candidate, false);
  assert.equal(cand.reason, "below_minimum_contribution");
});

test("BOUNDARY 30000 standard benefit candidate", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 30000,
    status: PROFIT_STATUS.COMPLETE_ACTUAL,
    options: verifiedOpts,
  });
  assert.equal(cand.candidate, true);
  assert.equal(cand.granted, false);
  assert.equal(cand.benefit_budget_jpy, 4500);
  assert.equal(cand.minimum_contribution_jpy, 30000);
  assert.equal(cand.v1_primary_delivery, "VISIBLE_PREMIUM_OPTION_GRANT");
});

test("BOUNDARY 30001 standard benefit candidate", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 30001,
    status: PROFIT_STATUS.COMPLETE_ACTUAL,
  });
  assert.equal(cand.candidate, true);
  assert.equal(cand.granted, false);
});

test("option missing cost not eligible", () => {
  const c = resolveBenefitCost({
    option_id: "x",
    normal_user_price: 1000,
    tasful_variable_cost: null,
    cost_status: "UNKNOWN",
  });
  assert.equal(c.ok, false);
  assert.equal(c.error, "BENEFIT_OPTION_NOT_ELIGIBLE");
});

test("option cost_status not VERIFIED blocked", () => {
  const c = resolveBenefitCost({
    option_id: "y",
    normal_user_price: 1000,
    tasful_variable_cost: 200,
    benefit_cost: 200,
    cost_status: "ESTIMATED",
  });
  assert.equal(c.ok, false);
  assert.equal(c.reason, "cost_status_not_verified");
});

test("option cost under budget vs over budget", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 30000,
    status: PROFIT_STATUS.COMPLETE_ACTUAL,
    options: [
      ...verifiedOpts,
      {
        option_id: "expensive",
        normal_user_price: 50000,
        tasful_variable_cost: 10000,
        benefit_cost: 10000,
        cost_status: "VERIFIED",
      },
    ],
  });
  assert.equal(cand.candidate, true);
  assert.equal(cand.benefit_budget_jpy, 4500);
  assert.equal(cand.options.find((o) => o.option_id === "a").candidate, true);
  assert.equal(cand.options.find((o) => o.option_id === "b").candidate, true);
  assert.equal(cand.options.find((o) => o.option_id === "c").candidate, true);
  assert.equal(
    cand.options.find((o) => o.option_id === "expensive").candidate,
    false,
  );
  assert.equal(
    cand.options.find((o) => o.option_id === "expensive").reason,
    "over_budget",
  );
});

test("unused budget not coin and no carryover", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 30000,
    status: PROFIT_STATUS.COMPLETE_ACTUAL,
    options: [verifiedOpts[0]],
  });
  assert.equal(cand.benefit_budget_jpy, 4500);
  assert.equal(cand.options[0].benefit_cost_jpy, 300);
  assert.equal(cand.carryover, false);
  assert.equal(cand.cash_benefit, false);
  assert.equal(cand.unused_budget_to_coin, false);
  assert.equal(cand.benefit_coin, "DEFERRED");
});

test("estimated status not eligible", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 50000,
    status: PROFIT_STATUS.ESTIMATED,
  });
  assert.equal(cand.candidate, false);
  assert.equal(STATUS_ELIGIBILITY_DESIGN.ESTIMATED, "NOT_ELIGIBLE");
});

test("forecast status not eligible", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 50000,
    status: PROFIT_STATUS.FORECAST,
  });
  assert.equal(cand.candidate, false);
});

test("unavailable status not eligible", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 50000,
    status: PROFIT_STATUS.UNAVAILABLE,
  });
  assert.equal(cand.candidate, false);
});

test("partial actual human review only", () => {
  const cand = buildBenefitCandidate({
    contribution_profit_jpy: 50000,
    status: PROFIT_STATUS.PARTIAL_ACTUAL,
    financial_base: LOCKED_FINANCIAL_BASE,
  });
  assert.equal(cand.candidate, false);
  assert.equal(STATUS_ELIGIBILITY_DESIGN.PARTIAL_ACTUAL, "HUMAN_REVIEW_ONLY");
});

test("grid and tlv cases generate", () => {
  assert.ok(simulateBenefitGrid().length >= 24);
  const tlv = simulateTlvCreatorCases();
  assert.equal(tlv.length, 4);
  const small = tlv.find((c) => c.label === "SMALL_CREATOR");
  assert.equal(small.contribution_profit_jpy, null);
  assert.equal(small.profit_status, "PARTIAL_ACTUAL");
  assert.equal(small.gift_gmv_not_benefit_base, true);
});

console.log(`\nPHASE6_DESIGN TOTAL=${passed + failed} PASS=${passed} FAIL=${failed}`);
if (failed > 0) process.exit(1);
