import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = new URL("../supabase/migrations/20260827210000_tlv_deterministic_monthly_settlement_v1.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const lower = sql.toLowerCase();

assert.match(sql, /PRODUCTION \/ SHARED STAGING APPLY IS A HUMAN GATE/);
assert.match(sql, /Canonical financial ledger remains tlv\.revenue_ledger/);
assert.doesNotMatch(lower, /public\.live_tips/);
assert.doesNotMatch(lower, /stripe\s*\./);
assert.doesNotMatch(lower, /cron\.schedule|net\.http|http_post/);

for (const state of [
  "OPEN", "CALCULATED", "REVIEWABLE", "FINALIZED", "TRANSFER_PENDING",
  "TRANSFERRED", "TRANSFER_UNKNOWN", "PAID", "FAILED",
]) {
  assert.match(sql, new RegExp(`'${state}'`));
}

for (const table of ["monthly_settlements", "settlement_ledger_links", "settlement_state_events", "settlement_hold_events", "payout_log"]) {
  assert.match(lower, new RegExp(`alter table tlv\\.${table} enable row level security`));
  assert.match(lower, new RegExp(`alter table tlv\\.${table} force row level security`));
  assert.match(lower, new RegExp(`revoke all on table tlv\\.${table} from public, anon, authenticated`));
  assert.match(lower, new RegExp(`grant all on table tlv\\.${table} to service_role`));
}

assert.match(lower, /create policy monthly_settlements_creator_select[\s\S]*tlv\.is_creator_of\(creator_id\)/);
assert.match(lower, /create policy payout_log_creator_select[\s\S]*tlv\.is_creator_of\(creator_id\)/);
assert.match(lower, /create policy settlement_ledger_links_ops_select[\s\S]*tlv\.is_tlv_ops_admin\(\)/);
assert.match(lower, /create policy settlement_state_events_ops_select[\s\S]*tlv\.is_tlv_ops_admin\(\)/);
assert.doesNotMatch(lower, /create policy [^\n]+[\s\S]{0,100}for (insert|update|delete) to authenticated/);

assert.match(lower, /monthly_settlements_one_locked_period_idx/);
assert.match(lower, /monthly_settlements_creator_period_version_uniq/);
assert.match(lower, /finalized_settlement_delete_forbidden/);
assert.match(lower, /immutable_finalized_snapshot_changed/);
assert.match(lower, /same_status_snapshot_update_forbidden_create_new_version/);
assert.match(lower, /transition_audit_evidence_required/);
assert.match(lower, /initial_settlement_audit_evidence_required/);
assert.match(lower, /after insert or update on tlv\.monthly_settlements/);
assert.match(lower, /settlement_state_events[\s\S]*transition_key\s+text not null unique/);
assert.match(lower, /payout_log_transfer_idempotency_uniq/);
assert.match(lower, /create or replace function tlv\.transition_monthly_settlement/);
assert.match(lower, /transition_key_collision/);
assert.match(lower, /settlement_version_conflict/);
assert.match(lower, /'idempotent', true/);
assert.match(lower, /grant execute on function tlv\.transition_monthly_settlement\([\s\S]*to service_role/);

assert.match(lower, /tax_policy_status\s+text not null default 'not_configured'/);
assert.match(lower, /monthly_settlements_tax_fail_closed_chk check \(tax_policy_status = 'not_configured'\)/);
assert.match(lower, /settlement_id is null or \(base_rate is null and effective_rate is null and override_tier is null\)/);
assert.match(lower, /active_operational_hold_blocks_transfer/);
assert.match(lower, /retry_safety_or_idempotency_failed/);
assert.match(lower, /provider_no_transfer_confirmation_required/);
assert.match(lower, /external_payout_confirmed/);
assert.match(lower, /new\.transfer_instruction->>'environment' = 'production'/);
assert.match(lower, /not a second financial ledger/);
assert.match(lower, /carries no independent financial amount/);
assert.match(lower, /is_settlement_job_run/);
assert.match(lower, /at time zone 'asia\/tokyo'/);
assert.match(lower, /enforce_revenue_ledger_jst_period/);
assert.match(lower, /new\.ledger_month := v_economic_period/);
assert.match(lower, /adjustment_of_settlement_id/);
assert.match(lower, /payment_provider_event_id/);
assert.match(lower, /validate_monthly_settlement_carry_source/);
assert.match(lower, /creator_specific_finalized_carry_source_required/);
assert.match(lower, /current_settlement_hold_v1/);
assert.match(lower, /action in \('placed', 'released'\)/);
assert.match(lower, /action <> 'released' or approved_by is not null/);
assert.match(lower, /reject_append_only_financial_mutation/);
for (const table of ["revenue_ledger", "settlement_ledger_links", "settlement_state_events", "settlement_hold_events"]) {
  assert.match(lower, new RegExp(`${table}_append_only_guard`));
}
assert.match(lower, /settlement_revenue_ledger_input_v1/);
assert.match(lower, /security_invoker = true/);
assert.match(lower, /grant select on table tlv\.settlement_revenue_ledger_input_v1 to service_role/);
assert.match(lower, /revoke all on table tlv\.settlement_revenue_ledger_input_v1 from public, anon, authenticated/);
assert.match(lower, /sum\(a\.gross_allocated_jpy - a\.net_allocated_jpy\)/);
assert.match(lower, /verified_attributable_cost_evidence_ids/);

console.log("TLV_SETTLEMENT_SECURITY_CONTRACT_TEST: PASS");
console.log("CROSS_USER_POLICY: CREATOR_OWN_ONLY");
console.log("CLIENT_FINANCIAL_MUTATION: DENIED");
console.log("PRODUCTION_APPLY: NOT_EXECUTED");
