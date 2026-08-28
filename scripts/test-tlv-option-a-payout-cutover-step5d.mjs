import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260827230000_tlv_option_a_zero_legacy_payout_cutover_v1.sql", import.meta.url),
  "utf8",
);
const settlementMigration = readFileSync(
  new URL("../supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", import.meta.url),
  "utf8",
);
const fixture = readFileSync(
  new URL("./sql/tlv-step5d-option-a-isolated-db-verify.sql", import.meta.url),
  "utf8",
);
const negativeGuard = readFileSync(
  new URL("./sql/tlv-step5d-option-a-nonzero-guard-fixture.sql", import.meta.url),
  "utf8",
);
const lower = migration.toLowerCase();
const migrationChain = `${settlementMigration}\n${migration}`.toLowerCase();

assert.match(lower, /drop constraint if exists payout_log_score_monthly_fk/);
assert.match(lower, /^begin;[\s\S]*lock table tlv\.payout_log[\s\S]*commit;\s*$/m);
assert.match(lower, /lock table tlv\.payout_log in access exclusive mode/);
assert.match(lower, /if exists \(select 1 from tlv\.payout_log\)/);
assert.match(lower, /option_a_requires_zero_legacy_payout_log/);
assert.match(lower, /canonical_settlement_required_for_payout/);
assert.match(lower, /canonical_payout_financial_identity_immutable/);
assert.doesNotMatch(lower, /protect_legacy_payout_score_reference/);
assert.doesNotMatch(lower, /legacy_payout_score_parent/);
assert.doesNotMatch(lower, /historical_legacy_payout/);
assert.doesNotMatch(lower, /creator_score_monthly/);
assert.match(lower, /create or replace function tlv\.create_canonical_settlement_payout/);
assert.match(lower, /create or replace function tlv\.transition_canonical_settlement_payout/);
assert.match(lower, /security definer[\s\S]*set search_path = pg_catalog, tlv/);
assert.match(lower, /new\.creator_id <> v_settlement\.creator_id/);
assert.match(lower, /new\.month_id <> v_settlement\.settlement_period/);
assert.match(lower, /new\.total_payout_jpy <> v_settlement\.payout_amount_jpy/);
assert.match(lower, /canonical_payout_legacy_rate_forbidden/);
assert.match(lower, /canonical_payout_creation_correlation_required/);
assert.match(lower, /payout_log_creation_key_uniq/);
assert.match(migrationChain, /payout_log_settlement_uniq/);
assert.match(lower, /payout_log_provider_correlation_uniq/);
assert.match(migrationChain, /payout_log_provider_transfer_uniq/);
assert.match(migrationChain, /payout_log_provider_payout_uniq/);
assert.match(lower, /canonical provider transfer identifier owner/);
assert.match(lower, /derived state-machine reference; canonical execution owner is tlv\.payout_log/);
assert.match(lower, /settlement_provider_reference_mismatch/);
assert.doesNotMatch(lower, /if v_payout\.payout_creation_key is null then return null/);
assert.match(lower, /deferrable initially deferred/);
assert.match(lower, /payment_reversals_settlement_hold_bridge/);
assert.match(lower, /insert into tlv\.settlement_hold_events/);
assert.match(lower, /new\.reversal_kind not in \('refund', 'dispute_open', 'dispute_lost'\)/);
assert.match(lower, /return old;[\s\S]*canonical_payout_trusted_writer_required/);
assert.match(lower, /revoke execute on function tlv\.transition_monthly_settlement[\s\S]*from service_role/);
assert.match(lower, /grant execute on function tlv\.create_canonical_settlement_payout[\s\S]*to service_role/);
assert.match(lower, /grant execute on function tlv\.transition_canonical_settlement_payout[\s\S]*to service_role/);
assert.match(lower, /capture_processing_provider_event_context/);
assert.match(lower, /adjustment_provider_event_context_required/);
assert.match(lower, /revenue_ledger_adjustment_provider_tip_uniq/);

for (const role of ["public", "anon", "authenticated"]) {
  assert.match(lower, new RegExp(`revoke execute on function tlv\\.create_canonical_settlement_payout[\\s\\S]*${role}`));
  assert.match(lower, new RegExp(`revoke execute on function tlv\\.transition_canonical_settlement_payout[\\s\\S]*${role}`));
}

assert.match(negativeGuard, /insert into tlv\.payout_log[\s\S]*2026-08/);
assert.doesNotMatch(negativeGuard, /\bsettlement_id\b/);
assert.match(fixture, /option_a baseline is not zero-payout/i);
assert.match(fixture, /legacy score compatibility function remains/i);
assert.match(fixture, /dummy score row created/);
assert.match(fixture, /canonical creator\/period\/amount parity/);
assert.match(fixture, /canonical_payout_creator_mismatch/);
assert.match(fixture, /canonical_payout_period_mismatch/);
assert.match(fixture, /canonical_payout_amount_mismatch/);
assert.match(fixture, /duplicate_settlement_payout_creation/);
assert.match(fixture, /tr_step5d_03/);
assert.match(fixture, /corr_step5d_04/);
assert.match(fixture, /po_step5d_05/);
assert.match(fixture, /canonical refund hold bridge/);
assert.match(fixture, /direct hold shape mutated canonical payout/);
assert.match(fixture, /creator a sees creator b payout/i);
assert.match(fixture, /STEP5D_DB_VERIFY_PASS/);

assert.doesNotMatch(lower, /stripe\.(transfers|payouts)|fetch\s*\(|https?:\/\//);
assert.doesNotMatch(lower, /drop table\s+tlv\.(payout_log|creator_score_monthly|monthly_settlements)/);
assert.doesNotMatch(lower, /truncate\s+tlv\.(payout_log|creator_score_monthly|monthly_settlements)/);

console.log("TLV_OPTION_A_PAYOUT_CUTOVER_STEP5D_CONTRACT: PASS");
console.log("PRODUCTION_CHANGED: NO");
console.log("FINANCIAL_TRANSACTION_EXECUTED: NO");
