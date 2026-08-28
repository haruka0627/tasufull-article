/**
 * Economics Core V1 — public API (AD-041 Phase 1–5).
 * Deterministic financial truth. No Stripe / DB mutation / Secretary runtime.
 */

export {
  PRODUCTS,
  ACTUALITY,
  PROFIT_STATUS,
  COST_TYPES,
  CONTRIBUTION_COST_TYPES,
  REVENUE_TYPES,
  COST_CLASS,
  FEE_CONTRACTS,
  SECRETARY_PAYLOAD_TYPES,
  USER_ROLES,
  ATTRIBUTION_STATUS,
  ADAPTER_STATUS,
  PERIOD_GRAINS,
  isProductId,
  getFeeContract,
} from "./contracts.mjs";

export { normalizeFxAmount } from "./fx.mjs";
export {
  lookupCostContract,
  createCostContractCandidate,
  estimateCostFromContract,
} from "./cost-contract.mjs";
export { normalizeEconomicsEvent, dedupeRecords } from "./normalize.mjs";
export { aggregateRevenue } from "./revenue.mjs";
export { aggregateVariableCosts } from "./costs.mjs";
export { computeContributionProfit, buildEconomicsSummaryPayload } from "./contribution.mjs";
export {
  TLV_REVENUE_SHARE_MODEL,
  TLV_PROGRESSIVE_BRACKETS,
  resolveTlvTipSplit,
  computeTlvTipDistribution,
} from "./tlv-tip.mjs";
export {
  TLV_SETTLEMENT_POLICY,
  SETTLEMENT_STATUS,
  calculateTlvMonthlySettlement,
  resolveSettlementJobTarget,
  resolveLateEventPeriod,
  evaluateSettlementHold,
  markSettlementReviewable,
  finalizeSettlement,
  transitionSettlement,
  buildTransferInstruction,
  buildSettlementReconciliation,
  assertFinalizedSnapshotImmutable,
} from "./tlv-settlement.mjs";
export { computeShopConnectPlatformFee } from "./shop-connect.mjs";
export {
  simulateBuilderSuccessFee,
  simulateBuilderProgressiveFee,
} from "./builder-scenario.mjs";
export { adaptFixtureEvents } from "./adapters/fixture.mjs";
export {
  buildSecretaryEconomicsPayload,
  buildEconomicsSummary,
  buildMarginAlert,
  buildCostAlert,
  buildFreeOpeningCandidate,
  buildUserBenefitCandidate,
} from "./secretary-output.mjs";
export { SHOP_CONNECT_SAMPLE_EVENTS } from "./fixtures/shop-connect-sample.mjs";

export {
  ECONOMICS_TIMEZONE,
  toJstDateString,
  toJstMonthKey,
  monthlyPeriodBounds,
  dailyPeriodBounds,
  resolvePeriodBounds,
  filterRecordsByPeriod,
} from "./period.mjs";
export {
  resolveAttributionStatus,
  computeUserContribution,
  computeUserContributionLedger,
} from "./user-contribution.mjs";
export { reconcilePlatformToUsers } from "./reconciliation.mjs";
export { buildBenefitEconomicsInput } from "./benefit-economics-input.mjs";
export { adaptAiUsageEvents } from "./adapters/ai-usage.mjs";
export { adaptShortVideoCostEvents } from "./adapters/short-video-cost.mjs";
export { adaptTlvTipEvents } from "./adapters/tlv-tip.mjs";
export { adaptShopConnectCheckouts } from "./adapters/shop-connect.mjs";
export { adaptMarketplaceFees } from "./adapters/marketplace.mjs";
export { adaptBuilderScenarioRows, adaptBuilderFormalFees } from "./adapters/builder.mjs";
export { PRODUCT_ADAPTER_REGISTRY, getProductAdapterStatus } from "./adapters/registry.mjs";

export {
  BENEFIT_FINANCIAL_BASE_CANDIDATES,
  RECOMMENDED_FINANCIAL_BASE,
  LOCKED_FINANCIAL_BASE,
  BENEFIT_RATE_SCENARIOS,
  RECOMMENDED_BENEFIT_RATE,
  LOCKED_BENEFIT_RATE,
  MINIMUM_CONTRIBUTION_SCENARIOS_JPY,
  SIMULATION_DEFAULT_MINIMUM_JPY,
  LOCKED_MINIMUM_MONTHLY_CONTRIBUTION_JPY,
  LOCKED_BASE_RETAINED_CONTRIBUTION_TARGET,
  BENEFIT_PERIOD_CANDIDATES,
  RECOMMENDED_PERIOD,
  LOCKED_PERIOD,
  LOCKED_PERIOD_TIMEZONE,
  LOCKED_BENEFIT_CARRYOVER,
  LOCKED_CASH_BENEFIT,
  LOCKED_V1_PRIMARY_DELIVERY,
  LOCKED_BENEFIT_COIN_STATUS,
  STATUS_ELIGIBILITY_DESIGN,
  BENEFIT_COST_BASIS,
  RECOMMENDED_BENEFIT_COST_BASIS,
  LOCKED_BENEFIT_COST_BASIS,
  HIGH_CONTRIBUTION_MODELS,
  RECOMMENDED_HIGH_CONTRIBUTION_MODEL,
  LOCKED_HIGH_CONTRIBUTION_MODEL,
  ADR043_LOCKED_POLICY,
  computeBenefitBudget,
  resolveBenefitCost,
  buildBenefitCandidate,
  simulateBenefitGrid,
  simulateTlvCreatorCases,
  compareFinancialBases,
  comparePeriods,
} from "./benefit-candidate-design.mjs";
