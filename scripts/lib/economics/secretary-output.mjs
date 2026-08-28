/**
 * Economics Core V1 — future AI Secretary payload contracts (shapes only).
 * Does NOT wire admin-operations-dashboard or DeepSeek.
 */

import { SECRETARY_PAYLOAD_TYPES } from "./contracts.mjs";

/**
 * @param {string} type
 * @param {object} payload
 */
export function buildSecretaryEconomicsPayload(type, payload) {
  if (!SECRETARY_PAYLOAD_TYPES.includes(type)) {
    return { ok: false, error: "unknown_payload_type" };
  }
  return {
    ok: true,
    type,
    version: 1,
    read_only: true,
    llm_must_not_recalculate: true,
    auto_apply: false,
    requires_human_approval: true,
    wired_to_secretary_runtime: false,
    payload,
  };
}

export function buildEconomicsSummary(periodContribution) {
  return buildSecretaryEconomicsPayload("ECONOMICS_SUMMARY", periodContribution);
}

export function buildMarginAlert(alert) {
  return buildSecretaryEconomicsPayload("MARGIN_ALERT", alert);
}

export function buildCostAlert(alert) {
  return buildSecretaryEconomicsPayload("COST_ALERT", alert);
}

export function buildFreeOpeningCandidate(candidate) {
  return buildSecretaryEconomicsPayload("FREE_OPENING_CANDIDATE", candidate);
}

export function buildUserBenefitCandidate(candidate) {
  return buildSecretaryEconomicsPayload("USER_BENEFIT_CANDIDATE", candidate);
}
