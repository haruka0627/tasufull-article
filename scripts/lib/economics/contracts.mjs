/**
 * Economics Core V1 — contracts / enums (AD-041 · AD-042 · AD-040).
 * Deterministic financial truth only. No DB / Stripe / Secretary runtime.
 */

export const PRODUCTS = Object.freeze([
  "AI",
  "TLV",
  "SHORT",
  "MARKETPLACE",
  "SHOP_CONNECT",
  "BUILDER",
  "TALK",
  "SITE_AI",
  "PAID_OPTION",
]);

/** @typedef {'AI'|'TLV'|'SHORT'|'MARKETPLACE'|'SHOP_CONNECT'|'BUILDER'|'TALK'|'SITE_AI'|'PAID_OPTION'} ProductId */

export const ACTUALITY = Object.freeze({
  ACTUAL: "ACTUAL",
  VENDOR_REPORTED: "VENDOR_REPORTED",
  CALCULATED: "CALCULATED",
  ESTIMATED: "ESTIMATED",
  FORECAST: "FORECAST",
});

export const PROFIT_STATUS = Object.freeze({
  COMPLETE_ACTUAL: "COMPLETE_ACTUAL",
  PARTIAL_ACTUAL: "PARTIAL_ACTUAL",
  ESTIMATED: "ESTIMATED",
  FORECAST: "FORECAST",
  UNAVAILABLE: "UNAVAILABLE",
});

export const COST_TYPES = Object.freeze({
  PAYMENT_PROCESSING_COST: "PAYMENT_PROCESSING_COST",
  EXTERNAL_API_COST: "EXTERNAL_API_COST",
  STREAMING_COST: "STREAMING_COST",
  MEDIA_PROCESSING_COST: "MEDIA_PROCESSING_COST",
  STORAGE_COST: "STORAGE_COST",
  BANDWIDTH_COST: "BANDWIDTH_COST",
  CREATOR_DISTRIBUTION: "CREATOR_DISTRIBUTION",
  OPTION_VARIABLE_COST: "OPTION_VARIABLE_COST",
  BENEFIT_ACTUAL_COST: "BENEFIT_ACTUAL_COST",
  OTHER_ATTRIBUTABLE_VARIABLE_COST: "OTHER_ATTRIBUTABLE_VARIABLE_COST",
  SHARED_FIXED: "SHARED_FIXED",
  NON_PRODUCT_COST: "NON_PRODUCT_COST",
});

/** Cost types that enter Contribution Profit when present. */
export const CONTRIBUTION_COST_TYPES = Object.freeze([
  COST_TYPES.PAYMENT_PROCESSING_COST,
  COST_TYPES.EXTERNAL_API_COST,
  COST_TYPES.STREAMING_COST,
  COST_TYPES.MEDIA_PROCESSING_COST,
  COST_TYPES.STORAGE_COST,
  COST_TYPES.BANDWIDTH_COST,
  COST_TYPES.CREATOR_DISTRIBUTION,
  COST_TYPES.OPTION_VARIABLE_COST,
  COST_TYPES.BENEFIT_ACTUAL_COST,
  COST_TYPES.OTHER_ATTRIBUTABLE_VARIABLE_COST,
]);

export const REVENUE_TYPES = Object.freeze({
  SUBSCRIPTION: "SUBSCRIPTION",
  USAGE_PACK: "USAGE_PACK",
  TRANSACTION_FEE: "TRANSACTION_FEE",
  CHECKOUT_PLATFORM_FEE: "CHECKOUT_PLATFORM_FEE",
  GIFT_TIP: "GIFT_TIP",
  EXTENSION: "EXTENSION",
  PAID_OPTION: "PAID_OPTION",
  OTHER: "OTHER",
  REFUND: "REFUND",
  CHARGEBACK: "CHARGEBACK",
});

export const COST_CLASS = Object.freeze({
  DIRECT_VARIABLE: "DIRECT_VARIABLE",
  ALLOCATABLE_VARIABLE: "ALLOCATABLE_VARIABLE",
  SHARED_FIXED: "SHARED_FIXED",
  NON_PRODUCT_COST: "NON_PRODUCT_COST",
});

/**
 * Formal fee contracts (label only — runtime Stripe helpers unchanged).
 * AD-042 Shop · AD-030 Marketplace · AD-034 Builder unlocked.
 */
export const FEE_CONTRACTS = Object.freeze({
  SHOP_CONNECT: Object.freeze({
    fee_contract_id: "SHOP_CONNECT",
    rate: 0.1,
    minimum_jpy: null,
    ssot: "AD-042",
    charge_event: "CHECKOUT_APPLICATION_FEE",
  }),
  MARKETPLACE_GENERAL: Object.freeze({
    fee_contract_id: "MARKETPLACE_GENERAL",
    rate: 0.05,
    minimum_jpy: 550,
    ssot: "AD-030",
    charge_event: "COMPLETION_SUCCESS_FEE",
  }),
  MARKETPLACE_BUSINESS: Object.freeze({
    fee_contract_id: "MARKETPLACE_BUSINESS",
    rate: 0.1,
    minimum_jpy: 550,
    ssot: "AD-030/AD-033",
    charge_event: "COMPLETION_SUCCESS_FEE",
  }),
  PLATFORM_CONNECT_CATALOG: Object.freeze({
    fee_contract_id: "PLATFORM_CONNECT_CATALOG",
    rate: 0.05,
    minimum_jpy: 550,
    ssot: "catalog:platform_match_connect_rate",
    provisional: true,
    charge_event: "COMPLETION_SUCCESS_FEE",
  }),
  BUILDER_SUCCESS_FEE: Object.freeze({
    fee_contract_id: "BUILDER_SUCCESS_FEE",
    rate: null,
    minimum_jpy: null,
    candidates_pct: Object.freeze([8, 6, 5]),
    ssot: "AD-034/AD-042",
    status: "PRICING_SCENARIO_ONLY",
    runtime_applied: false,
  }),
});

/** User economic roles (a user may hold multiple). */
export const USER_ROLES = Object.freeze([
  "CUSTOMER",
  "SELLER",
  "CREATOR",
  "PROVIDER",
  "BUILDER_PARTNER",
  "AI_SUBSCRIBER",
  "SHORT_USER",
  "OTHER",
]);

export const ATTRIBUTION_STATUS = Object.freeze({
  ATTRIBUTED: "ATTRIBUTED",
  UNATTRIBUTED: "UNATTRIBUTED",
});

export const ADAPTER_STATUS = Object.freeze({
  FIXTURE_ADAPTER: "FIXTURE_ADAPTER",
  REAL_READ_ONLY_ADAPTER: "REAL_READ_ONLY_ADAPTER",
  NOT_CONNECTED: "NOT_CONNECTED",
  BLOCKED: "BLOCKED",
});

export const PERIOD_GRAINS = Object.freeze({
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
  ALL_TIME: "ALL_TIME",
});

/** Future read-only payloads for AI 運営秘書 (not wired). */
export const SECRETARY_PAYLOAD_TYPES = Object.freeze([
  "ECONOMICS_SUMMARY",
  "MARGIN_ALERT",
  "COST_ALERT",
  "FREE_OPENING_CANDIDATE",
  "USER_BENEFIT_CANDIDATE",
  "PRICING_REVIEW_CANDIDATE",
  "USER_CONTRIBUTION_SUMMARY",
]);

export function isProductId(value) {
  return PRODUCTS.includes(String(value || ""));
}

export function getFeeContract(id) {
  return FEE_CONTRACTS[id] || null;
}
