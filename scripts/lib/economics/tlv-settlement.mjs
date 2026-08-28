/**
 * TLV deterministic monthly settlement core.
 *
 * Pure functions only: no DB writes, provider calls, tax inference, or clock reads.
 * Canonical money input is tlv.revenue_ledger, grouped by creator and JST month.
 */

import { createHash } from "node:crypto";
import { toJstMonthKey } from "./period.mjs";
import { computeTlvTipDistribution } from "./tlv-tip.mjs";

export const SETTLEMENT_STATUS = Object.freeze({
  OPEN: "OPEN",
  CALCULATED: "CALCULATED",
  REVIEWABLE: "REVIEWABLE",
  FINALIZED: "FINALIZED",
  TRANSFER_PENDING: "TRANSFER_PENDING",
  TRANSFERRED: "TRANSFERRED",
  TRANSFER_UNKNOWN: "TRANSFER_UNKNOWN",
  PAID: "PAID",
  FAILED: "FAILED",
});

export const TLV_SETTLEMENT_POLICY = Object.freeze({
  calculation_version: "tlv_settlement.progressive.v2",
  policy_version: "tlv_financial_policy.progressive.2026-08-28.v1",
  timezone: "Asia/Tokyo",
  currency: "JPY",
  minimum_payout_jpy: 1_000,
  standard_hold_days: 30,
  carry_forward_expiry: null,
  tax_policy_status: "NOT_CONFIGURED",
  membership_status: "NOT_ENABLED",
  ads_status: "NOT_ENABLED",
  canonical_source_table: "tlv.revenue_ledger",
  job_schedule_jst: "day 1 06:00",
  scheduler_utc_strategy: "daily 21:00 UTC with JST day-1 runtime gate",
});

const TRANSITIONS = Object.freeze({
  OPEN: ["CALCULATED"],
  CALCULATED: ["REVIEWABLE"],
  REVIEWABLE: ["FINALIZED"],
  FINALIZED: ["TRANSFER_PENDING"],
  TRANSFER_PENDING: ["TRANSFERRED", "TRANSFER_UNKNOWN", "FAILED"],
  TRANSFER_UNKNOWN: ["TRANSFERRED", "FAILED"],
  FAILED: ["TRANSFER_PENDING"],
  TRANSFERRED: ["PAID"],
  PAID: [],
});

const IMMUTABLE_FINALIZED_FIELDS = Object.freeze([
  "id",
  "creator_id",
  "settlement_period",
  "timezone",
  "calculation_version",
  "policy_version",
  "version",
  "currency",
  "source_ledger_ids",
  "source_correlations",
  "gross_jpy",
  "provider_payment_fee_jpy",
  "refund_jpy",
  "chargeback_jpy",
  "creator_attributed_net_jpy",
  "eligible_net_basis_jpy",
  "revenue_share_model",
  "applied_marginal_bracket",
  "creator_marginal_share_rate_pct",
  "tasful_marginal_retained_rate_pct",
  "creator_effective_share_rate_pct",
  "tasful_effective_share_rate_pct",
  "revenue_share_brackets",
  "creator_amount_before_rounding_jpy",
  "rounding_residual_jpy",
  "creator_payable_current_period_jpy",
  "carry_forward_in_jpy",
  "carry_forward_source_settlement_id",
  "carry_forward_out_jpy",
  "final_creator_payable_jpy",
  "payout_amount_jpy",
  "hold",
  "verified_attributable_cost_jpy",
  "verified_attributable_cost_evidence_ids",
  "attributable_cost_status",
  "tasful_retained_revenue_jpy",
  "contribution_profit_jpy",
  "tax_policy_status",
  "created_at",
  "calculated_at",
  "financial_snapshot_hash",
  "finalized_at",
  "finalized_by",
  "finalization_key",
  "finalized_snapshot_hash",
]);

function fail(error, details = null) {
  return { ok: false, error, ...(details ? { details } : {}) };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function uuidFromDigest(hex) {
  const chars = hex.slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ["8", "9", "a", "b"][Number.parseInt(chars[16], 16) % 4];
  const raw = chars.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function validIso(value) {
  const text = String(value || "").trim();
  return text && !Number.isNaN(new Date(text).getTime()) ? text : null;
}

function validMonth(value) {
  const text = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function safeInteger(value) {
  return Number.isSafeInteger(value);
}

function safeAdd(total, amount) {
  const next = total + amount;
  return Number.isSafeInteger(next) ? next : null;
}

function normalizeHold(hold = {}) {
  const active = hold.active === true;
  return {
    active,
    reason: active ? String(hold.reason || "UNSPECIFIED") : null,
    started_at: active ? validIso(hold.started_at) : null,
    evidence_ids: active
      ? [...new Set((hold.evidence_ids || []).map(String).filter(Boolean))].sort()
      : [],
    release_requires_human_approval: active,
    auto_release: false,
  };
}

/** Resolve the preceding JST month only at the canonical 1st 06:00 JST run. */
export function resolveSettlementJobTarget(runAt) {
  const at = validIso(runAt);
  if (!at) return fail("invalid_run_at");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TLV_SETTLEMENT_POLICY.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(at)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  if (parts.day !== "01" || parts.hour !== "06" || parts.minute !== "00") {
    return fail("outside_canonical_settlement_job_window");
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return { ok: true, settlement_period: `${previousYear}-${String(previousMonth).padStart(2, "0")}`, timezone: TLV_SETTLEMENT_POLICY.timezone };
}

/** Resolve economic and recognition month for a late event. */
export function resolveLateEventPeriod(input = {}) {
  const occurredAt = validIso(input.occurred_at);
  if (!occurredAt) return fail("invalid_occurred_at");
  const economicPeriod = toJstMonthKey(occurredAt);
  if (!input.original_period_finalized) {
    return {
      ok: true,
      economic_period: economicPeriod,
      recognition_period: economicPeriod,
      append_only_adjustment: false,
      original_period_reopened: false,
    };
  }
  const nextOpen = validMonth(input.next_open_period);
  if (!nextOpen || nextOpen <= economicPeriod) {
    return fail("next_open_period_required_for_finalized_late_event");
  }
  return {
    ok: true,
    economic_period: economicPeriod,
    recognition_period: nextOpen,
    append_only_adjustment: true,
    original_period_reopened: false,
  };
}

/** A 30-day elapsed hold escalates; it never auto-releases. */
export function evaluateSettlementHold(input = {}) {
  const hold = normalizeHold(input.hold);
  const asOf = validIso(input.as_of);
  if (!asOf) return fail("invalid_as_of");
  if (!hold.active) return { ok: true, hold, escalation_required: false };
  if (!hold.started_at) return fail("active_hold_started_at_required");

  const releaseAt = validIso(input.release?.released_at);
  const approver = String(input.release?.approved_by || "").trim();
  const evidence = [...new Set((input.release?.evidence_ids || []).map(String).filter(Boolean))].sort();
  if (releaseAt && approver && evidence.length > 0) {
    return {
      ok: true,
      hold: {
        ...hold,
        active: false,
        released_at: releaseAt,
        release_approved_by: approver,
        release_evidence_ids: evidence,
      },
      escalation_required: false,
    };
  }

  const elapsedMs = new Date(asOf).getTime() - new Date(hold.started_at).getTime();
  return {
    ok: true,
    hold,
    escalation_required: elapsedMs >= TLV_SETTLEMENT_POLICY.standard_hold_days * 86_400_000,
  };
}

function normalizeLedgerRow(row, creatorId, settlementPeriod) {
  const sourceId = String(row?.id || "").trim();
  if (!sourceId) return fail("source_ledger_id_required");
  if (row.source_table !== TLV_SETTLEMENT_POLICY.canonical_source_table) {
    return fail("noncanonical_financial_source", { source_id: sourceId });
  }
  if (String(row.creator_id || "") !== creatorId) {
    return fail("cross_creator_ledger_row", { source_id: sourceId });
  }
  const occurredAt = validIso(row.occurred_at || row.created_at);
  if (!occurredAt) return fail("invalid_ledger_occurred_at", { source_id: sourceId });
  const economicPeriod = toJstMonthKey(occurredAt);
  const recognitionPeriod = validMonth(row.recognition_period) || economicPeriod;
  const kind = String(row.event_kind || row.ledger_type || "TIP").toUpperCase();
  if (["MEMBERSHIP", "ADS", "AD", "AD_SHARE"].includes(kind)) {
    return fail("feature_not_enabled", { source_id: sourceId, event_kind: kind });
  }
  if (recognitionPeriod !== settlementPeriod) {
    return fail("ledger_row_outside_settlement_period", { source_id: sourceId, recognition_period: recognitionPeriod });
  }
  if (recognitionPeriod !== economicPeriod && kind !== "ADJUSTMENT") {
    return fail("late_event_must_be_append_only_adjustment", { source_id: sourceId });
  }

  const dispositionFields = [
    row.settlement_disposition,
    row.disposition_event_id,
    row.disposition_classification,
    row.disposition_source_role,
  ];
  const hasDispositionEvidence = dispositionFields.some((value) => value != null && String(value).trim() !== "");
  if (hasDispositionEvidence) {
    const disposition = String(row.settlement_disposition || "").toUpperCase();
    const classification = String(row.disposition_classification || "").toUpperCase();
    const eventId = String(row.disposition_event_id || "").trim();
    const role = String(row.disposition_source_role || "").toUpperCase();
    if (disposition !== "EXCLUDE_SYNTHETIC_QA") {
      return fail("unsupported_settlement_disposition", { source_id: sourceId });
    }
    if (classification !== "SYNTHETIC_QA"
      || !eventId
      || !["ORIGINAL_SOURCE", "ACCOUNTING_NEUTRALIZATION"].includes(role)
      || row.disposition_evidence_valid !== true
      || row.disposition_complete !== true) {
      return fail("incomplete_settlement_disposition_evidence", { source_id: sourceId });
    }
    if (role === "ORIGINAL_SOURCE" && !["GIFT", "EXTENSION"].includes(kind)) {
      return fail("synthetic_qa_source_role_mismatch", { source_id: sourceId });
    }
    if (role === "ACCOUNTING_NEUTRALIZATION") {
      const adjustmentKind = String(row.adjustment_kind || "").toUpperCase();
      const rawGross = Number(row.gross_amount_jpy);
      const rawFee = Number(row.provider_payment_fee_jpy ?? row.fee_amount_jpy ?? 0);
      const rawNet = Number(row.net_amount_jpy);
      if (kind !== "ADJUSTMENT"
        || adjustmentKind !== "SYNTHETIC_QA_NEUTRALIZATION"
        || ![rawGross, rawFee, rawNet].every(safeInteger)
        || rawFee !== 0
        || rawGross >= 0
        || rawNet !== rawGross) {
        return fail("invalid_synthetic_qa_neutralization", { source_id: sourceId });
      }
    }
    return {
      ok: true,
      row: {
        source_id: sourceId,
        occurred_at: occurredAt,
        economic_period: economicPeriod,
        recognition_period: recognitionPeriod,
        event_kind: kind,
        excluded_self_funding: false,
        excluded_financial_disposition: true,
        financial_disposition: {
          event_id: eventId,
          classification,
          disposition,
          source_role: role,
        },
        amounts: { gross_jpy: 0, provider_payment_fee_jpy: 0, refund_jpy: 0, chargeback_jpy: 0, net_jpy: 0 },
        correlation: canonicalize({
          revenue_ledger_id: sourceId,
          disposition_event_id: eventId,
          disposition_source_role: role,
        }),
      },
    };
  }
  if (row.settlement_input_reconciled === false) {
    return fail("unreconciled_canonical_ledger_input", { source_id: sourceId });
  }

  const rawGross = Number(row.gross_amount_jpy ?? 0);
  const rawFee = Number(row.provider_payment_fee_jpy ?? row.fee_amount_jpy ?? 0);
  const rawNet = Number(row.net_amount_jpy);
  if (![rawGross, rawFee, rawNet].every(safeInteger)) {
    return fail("invalid_jpy_amount", { source_id: sourceId });
  }
  let amounts;
  if (kind === "ADJUSTMENT") {
    const inferredKind = String(
      row.adjustment_kind
        || (String(row.notes || "").startsWith("refund:") ? "REFUND" : "")
        || (String(row.notes || "").startsWith("chargeback:") ? "CHARGEBACK" : ""),
    ).toUpperCase();
    if (inferredKind === "SYNTHETIC_QA_NEUTRALIZATION") {
      return fail("synthetic_qa_neutralization_requires_disposition", { source_id: sourceId });
    }
    if (!["REFUND", "CHARGEBACK"].includes(inferredKind)) {
      return fail("adjustment_kind_required", { source_id: sourceId });
    }
    if (rawFee !== 0 || rawGross >= 0 || rawNet !== rawGross) {
      return fail("invalid_append_only_reversal", { source_id: sourceId });
    }
    amounts = {
      gross_jpy: 0,
      provider_payment_fee_jpy: 0,
      refund_jpy: inferredKind === "REFUND" ? Math.abs(rawNet) : 0,
      chargeback_jpy: inferredKind === "CHARGEBACK" ? Math.abs(rawNet) : 0,
      net_jpy: rawNet,
    };
  } else {
    if (![rawGross, rawFee, rawNet].every(nonnegativeInteger) || rawNet !== rawGross - rawFee) {
      return fail("creator_attributed_net_mismatch", { source_id: sourceId, expected_net_jpy: rawGross - rawFee });
    }
    amounts = {
      gross_jpy: rawGross,
      provider_payment_fee_jpy: rawFee,
      refund_jpy: 0,
      chargeback_jpy: 0,
      net_jpy: rawNet,
    };
  }

  const correlation = canonicalize({
    payment_provider_event_id: row.payment_provider_event_id || null,
    payment_provider_event_ids: [...new Set((row.payment_provider_event_ids || []).map(String).filter(Boolean))].sort(),
    payment_id: row.payment_id || null,
    coin_lot_id: row.coin_lot_id || null,
    coin_lot_ids: [...new Set((row.coin_lot_ids || []).map(String).filter(Boolean))].sort(),
    tip_id: row.tip_id || null,
    revenue_ledger_id: sourceId,
    adjustment_of_settlement_id: row.adjustment_of_settlement_id || null,
  });
  return {
    ok: true,
    row: {
      source_id: sourceId,
      occurred_at: occurredAt,
      economic_period: economicPeriod,
      recognition_period: recognitionPeriod,
      event_kind: kind,
      excluded_self_funding: row.self_gift_excluded === true || (row.payer_id != null && String(row.payer_id) === creatorId),
      excluded_financial_disposition: false,
      financial_disposition: null,
      amounts,
      correlation,
    },
  };
}

/**
 * Calculate one creator-month immutable financial snapshot candidate.
 * The caller supplies all timestamps so calculation is replayable.
 */
export function calculateTlvMonthlySettlement(input = {}) {
  const creatorId = String(input.creator_id || "").trim();
  const settlementPeriod = validMonth(input.settlement_period);
  const calculatedAt = validIso(input.calculated_at);
  const version = Number(input.version ?? 1);
  if (!creatorId) return fail("creator_id_required");
  if (!settlementPeriod) return fail("invalid_settlement_period");
  if (!calculatedAt) return fail("calculated_at_required");
  if (!Number.isSafeInteger(version) || version < 1) return fail("invalid_version");
  if (!Array.isArray(input.ledger_rows)) return fail("ledger_rows_required");
  if (!nonnegativeInteger(Number(input.carry_forward_in_jpy ?? 0))) {
    return fail("invalid_carry_forward_in");
  }

  const byId = new Map();
  for (const raw of input.ledger_rows) {
    const normalized = normalizeLedgerRow(raw, creatorId, settlementPeriod);
    if (!normalized.ok) return normalized;
    const prior = byId.get(normalized.row.source_id);
    if (prior && stableJson(prior) !== stableJson(normalized.row)) {
      return fail("conflicting_duplicate_ledger_id", { source_id: normalized.row.source_id });
    }
    byId.set(normalized.row.source_id, normalized.row);
  }
  const rows = [...byId.values()].sort((a, b) => a.source_id.localeCompare(b.source_id));

  const totals = { gross_jpy: 0, provider_payment_fee_jpy: 0, refund_jpy: 0, chargeback_jpy: 0, net_jpy: 0 };
  const excluded = [];
  const excludedFinancial = [];
  for (const row of rows) {
    if (row.excluded_financial_disposition) {
      excludedFinancial.push({ source_id: row.source_id, ...row.financial_disposition });
      continue;
    }
    if (row.excluded_self_funding) {
      excluded.push(row.source_id);
      continue;
    }
    for (const key of Object.keys(totals)) {
      const next = safeAdd(totals[key], row.amounts[key]);
      if (next == null) return fail("jpy_total_overflow", { field: key });
      totals[key] = next;
    }
  }
  if (totals.gross_jpy - totals.provider_payment_fee_jpy - totals.refund_jpy - totals.chargeback_jpy !== totals.net_jpy) {
    return fail("aggregate_creator_attributed_net_mismatch");
  }
  if (totals.net_jpy < 0) return fail("negative_creator_attributed_net_requires_future_recovery");
  if (totals.net_jpy > Math.floor(Number.MAX_SAFE_INTEGER / 100)) {
    return fail("creator_attributed_net_exceeds_exact_cent_precision");
  }

  const distribution = computeTlvTipDistribution(totals.net_jpy);
  const carryIn = Number(input.carry_forward_in_jpy ?? 0);
  const carrySource = input.carry_forward_source || null;
  if (carryIn > 0) {
    if (!carrySource
      || !String(carrySource.settlement_id || "").trim()
      || String(carrySource.creator_id || "") !== creatorId
      || Number(carrySource.carry_forward_out_jpy) !== carryIn
      || ![SETTLEMENT_STATUS.FINALIZED, SETTLEMENT_STATUS.TRANSFER_PENDING, SETTLEMENT_STATUS.TRANSFERRED, SETTLEMENT_STATUS.TRANSFER_UNKNOWN, SETTLEMENT_STATUS.PAID, SETTLEMENT_STATUS.FAILED].includes(String(carrySource.status || ""))) {
      return fail("creator_specific_finalized_carry_source_required");
    }
  } else if (carrySource != null) {
    return fail("zero_carry_must_not_have_source");
  }
  const combinedPayable = safeAdd(distribution.creator_distribution_jpy, carryIn);
  if (combinedPayable == null) return fail("jpy_total_overflow", { field: "final_creator_payable_jpy" });
  const minimumMet = combinedPayable >= TLV_SETTLEMENT_POLICY.minimum_payout_jpy;
  const payoutAmount = minimumMet ? combinedPayable : 0;
  const carryOut = minimumMet ? 0 : combinedPayable;

  const costStatus = String(input.attributable_cost_status || "UNAVAILABLE").toUpperCase();
  const verifiedCost = input.verified_attributable_cost_jpy;
  const costEvidenceIds = [...new Set((input.verified_attributable_cost_evidence_ids || []).map(String).filter(Boolean))].sort();
  if (costStatus === "COMPLETE_ACTUAL" && !nonnegativeInteger(Number(verifiedCost))) {
    return fail("verified_attributable_cost_required");
  }
  if (costStatus === "COMPLETE_ACTUAL" && costEvidenceIds.length === 0) {
    return fail("verified_attributable_cost_evidence_required");
  }
  if (costStatus !== "COMPLETE_ACTUAL" && verifiedCost != null) {
    return fail("unverified_cost_must_not_be_deducted");
  }
  if (costStatus !== "COMPLETE_ACTUAL" && costEvidenceIds.length > 0) {
    return fail("cost_evidence_without_complete_actual_cost");
  }
  const tasfulRetained = totals.net_jpy - distribution.creator_distribution_jpy;
  const contribution = costStatus === "COMPLETE_ACTUAL" ? tasfulRetained - Number(verifiedCost) : null;
  const hold = normalizeHold(input.hold);
  if (hold.active && !hold.started_at) return fail("active_hold_started_at_required");

  const sourceIds = rows.map((row) => row.source_id);
  const correlations = rows.map((row) => row.correlation);
  const createdAt = validIso(input.created_at) || calculatedAt;
  const financialPayload = {
    creator_id: creatorId,
    settlement_period: settlementPeriod,
    timezone: TLV_SETTLEMENT_POLICY.timezone,
    calculation_version: TLV_SETTLEMENT_POLICY.calculation_version,
    policy_version: TLV_SETTLEMENT_POLICY.policy_version,
    version,
    currency: TLV_SETTLEMENT_POLICY.currency,
    source_ledger_ids: sourceIds,
    source_correlations: correlations,
    excluded_self_funding_ledger_ids: excluded,
    excluded_financial_disposition_ledger_ids: excludedFinancial.map((entry) => entry.source_id),
    financial_disposition_evidence: excludedFinancial,
    gross_jpy: totals.gross_jpy,
    provider_payment_fee_jpy: totals.provider_payment_fee_jpy,
    refund_jpy: totals.refund_jpy,
    chargeback_jpy: totals.chargeback_jpy,
    creator_attributed_net_jpy: totals.net_jpy,
    eligible_net_basis_jpy: totals.net_jpy,
    revenue_share_model: distribution.revenue_share_model,
    applied_marginal_bracket: distribution.band,
    creator_marginal_share_rate_pct: distribution.creator_pct,
    tasful_marginal_retained_rate_pct: distribution.tasful_pct,
    creator_effective_share_rate_pct: distribution.creator_effective_share_rate_pct,
    tasful_effective_share_rate_pct: distribution.tasful_effective_share_rate_pct,
    revenue_share_brackets: distribution.bracket_breakdown,
    creator_amount_before_rounding_jpy: distribution.creator_amount_before_rounding_jpy,
    rounding_residual_jpy: distribution.rounding_residual_jpy,
    creator_payable_current_period_jpy: distribution.creator_distribution_jpy,
    carry_forward_in_jpy: carryIn,
    carry_forward_source_settlement_id: carryIn > 0 ? String(carrySource.settlement_id) : null,
    carry_forward_out_jpy: carryOut,
    final_creator_payable_jpy: combinedPayable,
    payout_amount_jpy: payoutAmount,
    minimum_payout_met: minimumMet,
    hold,
    verified_attributable_cost_jpy: costStatus === "COMPLETE_ACTUAL" ? Number(verifiedCost) : null,
    verified_attributable_cost_evidence_ids: costEvidenceIds,
    attributable_cost_status: costStatus,
    tasful_retained_revenue_jpy: tasfulRetained,
    contribution_profit_jpy: contribution,
    tax_policy_status: TLV_SETTLEMENT_POLICY.tax_policy_status,
    created_at: createdAt,
    calculated_at: calculatedAt,
  };
  const financialHash = digest(financialPayload);
  const snapshot = {
    id: uuidFromDigest(digest({ creator_id: creatorId, settlement_period: settlementPeriod, version, financial_hash: financialHash })),
    status: SETTLEMENT_STATUS.CALCULATED,
    ...financialPayload,
    financial_snapshot_hash: financialHash,
    non_tax_core_calculated: true,
    transfer_eligible_non_tax: minimumMet && !hold.active,
    production_transfer_eligible: false,
    production_transfer_blocker: "TAX_POLICY_NOT_CONFIGURED",
    calculation_transition_key: `tlv_settlement_calculation_${financialHash}`,
    calculation_evidence: {
      financial_snapshot_hash: financialHash,
      source_ledger_ids: sourceIds,
      calculation_version: TLV_SETTLEMENT_POLICY.calculation_version,
      policy_version: TLV_SETTLEMENT_POLICY.policy_version,
    },
    last_transition_key: `tlv_settlement_calculation_${financialHash}`,
    last_transition_at: calculatedAt,
    last_transition_actor: String(input.calculated_by || "tlv_settlement_engine_v1"),
    last_transition_evidence: {
      financial_snapshot_hash: financialHash,
      source_ledger_ids: sourceIds,
    },
  };
  return { ok: true, snapshot };
}

export function markSettlementReviewable(snapshot, review = {}) {
  if (snapshot?.status !== SETTLEMENT_STATUS.CALCULATED) return fail("calculated_snapshot_required");
  const reviewedAt = validIso(review.reviewed_at);
  const reviewedBy = String(review.reviewed_by || "").trim();
  if (!reviewedAt || !reviewedBy) return fail("review_evidence_required");
  const transitionKey = String(review.transition_key || `tlv_settlement_review_${digest({ id: snapshot.id, reviewed_at: reviewedAt, reviewed_by: reviewedBy })}`);
  return { ok: true, snapshot: {
    ...snapshot,
    status: SETTLEMENT_STATUS.REVIEWABLE,
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
    last_transition_key: transitionKey,
    last_transition_at: reviewedAt,
    last_transition_actor: reviewedBy,
    last_transition_evidence: { review_completed: true, evidence_ids: [...new Set((review.evidence_ids || []).map(String).filter(Boolean))].sort() },
  } };
}

export function finalizeSettlement(snapshot, finalization = {}) {
  const key = String(finalization.finalization_key || "").trim();
  if (snapshot?.status === SETTLEMENT_STATUS.FINALIZED) {
    return snapshot.finalization_key === key ? { ok: true, snapshot, idempotent: true } : fail("already_finalized_with_different_key");
  }
  if (snapshot?.status !== SETTLEMENT_STATUS.REVIEWABLE) return fail("reviewable_snapshot_required");
  const finalizedAt = validIso(finalization.finalized_at);
  const approvedBy = String(finalization.approved_by || "").trim();
  if (!finalizedAt || !approvedBy || !key) return fail("finalization_evidence_required");
  return {
    ok: true,
    snapshot: {
      ...snapshot,
      status: SETTLEMENT_STATUS.FINALIZED,
      finalized_at: finalizedAt,
      finalized_by: approvedBy,
      finalization_key: key,
      finalized_snapshot_hash: digest({ financial_snapshot_hash: snapshot.financial_snapshot_hash, finalized_at: finalizedAt, finalized_by: approvedBy }),
      last_transition_key: key,
      last_transition_at: finalizedAt,
      last_transition_actor: approvedBy,
      last_transition_evidence: { finalization_key: key, financial_snapshot_hash: snapshot.financial_snapshot_hash },
    },
    idempotent: false,
  };
}

export function assertFinalizedSnapshotImmutable(previous, next) {
  if (!previous || ![SETTLEMENT_STATUS.FINALIZED, SETTLEMENT_STATUS.TRANSFER_PENDING, SETTLEMENT_STATUS.TRANSFERRED, SETTLEMENT_STATUS.TRANSFER_UNKNOWN, SETTLEMENT_STATUS.PAID, SETTLEMENT_STATUS.FAILED].includes(previous.status)) {
    return fail("finalized_previous_snapshot_required");
  }
  const changed = IMMUTABLE_FINALIZED_FIELDS.filter((field) => stableJson(previous[field]) !== stableJson(next?.[field]));
  return changed.length ? fail("immutable_finalized_snapshot_changed", { fields: changed }) : { ok: true };
}

export function buildTransferInstruction(snapshot, input = {}) {
  if (snapshot?.status !== SETTLEMENT_STATUS.FINALIZED && snapshot?.status !== SETTLEMENT_STATUS.FAILED) {
    return fail("finalized_or_retryable_failed_settlement_required");
  }
  const binding = String(input.provider_account_binding || "").trim();
  if (!binding) return fail("provider_account_binding_required");
  if (!snapshot.minimum_payout_met || snapshot.payout_amount_jpy < TLV_SETTLEMENT_POLICY.minimum_payout_jpy) return fail("minimum_payout_not_met");
  const evaluatedHold = input.hold_evaluation;
  if (evaluatedHold && evaluatedHold.ok !== true) return fail("invalid_hold_evaluation");
  const currentHold = evaluatedHold?.hold || snapshot.hold;
  if (currentHold?.active) return fail("active_hold_blocks_transfer");
  if (snapshot.hold?.active && !evaluatedHold?.hold?.released_at) {
    return fail("explicit_hold_release_evidence_required");
  }
  const environment = String(input.environment || "test").toLowerCase();
  if (environment === "production" && snapshot.tax_policy_status !== "EXPERT_APPROVED") {
    return fail("tax_policy_not_configured");
  }
  const identity = {
    settlement_id: snapshot.id,
    creator_id: snapshot.creator_id,
    provider_account_binding: binding,
    amount_jpy: snapshot.payout_amount_jpy,
    currency: snapshot.currency,
    policy_version: snapshot.policy_version,
  };
  const correlationId = uuidFromDigest(digest({ type: "tlv_settlement_transfer", ...identity }));
  return {
    ok: true,
    instruction: {
      ...identity,
      amount: snapshot.payout_amount_jpy,
      correlation_id: correlationId,
      idempotency_key: `tlv_settlement_${digest(identity)}`,
      provider_execution_performed: false,
      environment,
      hold_evidence: evaluatedHold?.hold || snapshot.hold,
    },
  };
}

export function transitionSettlement(snapshot, input = {}) {
  const to = String(input.to_status || "").toUpperCase();
  if (!Object.values(SETTLEMENT_STATUS).includes(to)) return fail("invalid_target_status");
  if (snapshot?.status === to) {
    return snapshot.last_transition_key && snapshot.last_transition_key === input.transition_key
      ? { ok: true, snapshot, idempotent: true }
      : fail("duplicate_status_without_matching_idempotency_key");
  }
  if (!(TRANSITIONS[snapshot?.status] || []).includes(to)) return fail("invalid_state_transition", { from: snapshot?.status, to });
  const transitionKey = String(input.transition_key || "").trim();
  const at = validIso(input.transitioned_at);
  const actor = String(input.actor_id || "").trim();
  const evidence = [...new Set((input.evidence_ids || []).map(String).filter(Boolean))].sort();
  if (!transitionKey || !at || !actor || evidence.length === 0) return fail("transition_evidence_required");
  if (to === SETTLEMENT_STATUS.TRANSFER_PENDING) {
    if (!input.transfer_instruction || input.transfer_instruction.settlement_id !== snapshot.id) return fail("matching_transfer_instruction_required");
    if (snapshot.status === SETTLEMENT_STATUS.FAILED && input.retry_safe !== true) return fail("retry_safety_confirmation_required");
  }
  if (to === SETTLEMENT_STATUS.TRANSFERRED && !String(input.provider_transfer_id || "").trim()) return fail("provider_transfer_evidence_required");
  if (to === SETTLEMENT_STATUS.TRANSFER_UNKNOWN && !String(input.provider_correlation_id || "").trim()) return fail("provider_correlation_required");
  if (to === SETTLEMENT_STATUS.FAILED && input.provider_confirmed_no_transfer !== true) {
    return fail("provider_no_transfer_confirmation_required");
  }
  if (to === SETTLEMENT_STATUS.PAID && (!String(input.provider_payout_id || "").trim() || input.external_payout_confirmed !== true)) {
    return fail("external_payout_success_evidence_required");
  }
  const next = {
    ...snapshot,
    status: to,
    last_transition_key: transitionKey,
    last_transition_at: at,
    last_transition_actor: actor,
    last_transition_evidence_ids: evidence,
    last_transition_evidence: {
      evidence_ids: evidence,
      provider_transfer_id: input.provider_transfer_id || null,
      provider_correlation_id: input.provider_correlation_id || null,
      provider_payout_id: input.provider_payout_id || null,
      retry_safe: input.retry_safe === true,
      provider_confirmed_no_transfer: input.provider_confirmed_no_transfer === true,
      external_payout_confirmed: input.external_payout_confirmed === true,
    },
    ...(input.transfer_instruction ? { transfer_instruction: input.transfer_instruction } : {}),
    ...(input.provider_transfer_id ? { provider_transfer_id: String(input.provider_transfer_id) } : {}),
    ...(input.provider_correlation_id ? { provider_correlation_id: String(input.provider_correlation_id) } : {}),
    ...(input.provider_payout_id ? { provider_payout_id: String(input.provider_payout_id) } : {}),
  };
  const immutable = assertFinalizedSnapshotImmutable(snapshot, next);
  if (!immutable.ok && snapshot.status !== SETTLEMENT_STATUS.OPEN && snapshot.status !== SETTLEMENT_STATUS.CALCULATED && snapshot.status !== SETTLEMENT_STATUS.REVIEWABLE) return immutable;
  return { ok: true, snapshot: next, idempotent: false };
}

export function buildSettlementReconciliation(snapshot, input = {}) {
  if (!snapshot?.id || !Array.isArray(snapshot.source_correlations)) return fail("settlement_snapshot_required");
  const chains = snapshot.source_correlations.map((correlation) => ({
    provider_event_id: correlation.payment_provider_event_id,
    provider_event_ids: correlation.payment_provider_event_ids,
    payment_id: correlation.payment_id,
    coin_lot_id: correlation.coin_lot_id,
    tip_id: correlation.tip_id,
    revenue_ledger_id: correlation.revenue_ledger_id,
    settlement_id: snapshot.id,
    payout_log_id: input.payout_log_id || null,
    provider_transfer_id: input.provider_transfer_id || snapshot.provider_transfer_id || null,
  }));
  if (chains.some((chain) => !chain.revenue_ledger_id)) return fail("revenue_ledger_correlation_required");
  return {
    ok: true,
    canonical_ledger: TLV_SETTLEMENT_POLICY.canonical_source_table,
    second_financial_ledger_created: false,
    chains,
  };
}
