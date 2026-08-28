import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const record = read("docs/TLV_PRODUCTION_OPERATIONAL_CONTROL_RECORD.md");
const inventory = read("reports/tlv-step5l-prod-gate-04-writer-inventory.md");
const freezeSql = read("reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql");
const tipRuntime = read("supabase/functions/_shared/tlv-create-tip.ts");
const webhookRuntime = read("supabase/functions/_shared/tlv-payment-webhook.ts");
const liveSchema = read("supabase/migrations/20260628100000_live_p0_schema.sql");
const liveCounts = read("supabase/migrations/20260629100000_live_p0_counts.sql");
const securityEvents = read("supabase/functions/live-security-events/index.ts");
const monetizationAdmin = read("supabase/functions/live-monetization-admin/index.ts");
const environments = read("docs/supabase-environments.md");

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, pass: false });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

check("authoritative_control_identity_and_parent", () => {
  assert.match(record, /TLV-STEP5L-PROD-GATE04-CHECKPOINT-V1/);
  assert.match(record, /959436e8514f0eb22951cc3aa24f1293bf113486/);
  assert.match(record, /CONTROL_CONTRACT_COMPLETE_EXECUTION_BINDING_REQUIRED/);
});

check("canonical_money_writers_are_inventoried", () => {
  for (const token of [
    "TLV_TIP_RPC",
    "TLV_PAYMENT_WEBHOOK_SUCCESS",
    "TLV_PAYMENT_REFUND",
    "TLV_PAYMENT_DISPUTE",
    "LEGACY_PUBLIC_LIVE_TIP",
    "TLV_AD_ATTRIBUTION",
    "TLV_MONETIZATION_ADMIN",
    "MANUAL_SERVICE_ROLE_SQL",
  ]) assert.ok(inventory.includes(token), token);
});

check("runtime_evidence_matches_inventory", () => {
  assert.match(tipRuntime, /rpc\("create_tip_transaction"/);
  for (const rpc of ["handle_payment_webhook_success", "handle_payment_refund", "handle_payment_dispute"])
    assert.ok(webhookRuntime.includes(rpc), rpc);
  assert.match(liveSchema, /grant select, insert on public\.live_tips to authenticated/);
  assert.match(liveCounts, /after insert on public\.live_tips/);
  assert.match(securityEvents, /live_ad_impression_events/);
  assert.match(monetizationAdmin, /live_ad_rpm_settings/);
});

check("circuit_breaker_not_misrepresented_as_tlv_freeze", () => {
  assert.match(inventory, /NOT_WIRED_TO_TLV_PAYMENT_PATH/);
  for (const source of [tipRuntime, webhookRuntime]) {
    assert.doesNotMatch(source, /security-circuit-breaker|assertFinancialCircuit/);
  }
});

check("transactional_share_lock_is_reversible_and_dump_compatible", () => {
  assert.match(record, /POSTGRESQL_TRANSACTIONAL_SHARE_LOCK_V1/);
  assert.match(record, /compatible with the `ACCESS SHARE` lock used by `pg_dump`/);
  assert.match(record, /normal unfreeze is `ROLLBACK`/);
  assert.match(record, /session loss automatically releases all locks/);
});

check("freeze_sql_has_no_persistent_mutation", () => {
  const executable = freezeSql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(executable, /begin;/i);
  assert.match(executable, /lock table %s in share mode/i);
  assert.match(executable, /other_granted_conflicting_locks/i);
  assert.match(executable, /writer_sessions_blocked_by_freeze_pid/i);
  assert.doesNotMatch(executable, /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|commit)\b/i);
  assert.doesNotMatch(executable, /\brollback\s*;/i);
});

check("required_and_auxiliary_lock_sets_are_complete", () => {
  const required = [
    "tlv.creators", "tlv.streams", "tlv.payments", "tlv.tips", "tlv.revenue_ledger",
    "tlv.gauge_state", "tlv.stream_events", "tlv.creator_score_events", "tlv.payout_log",
    "tlv.viewer_wallets", "tlv.coin_lots", "tlv.payment_provider_events",
    "tlv.tip_coin_lot_allocations", "tlv.wallet_ledger", "tlv.payment_reversals",
    "public.live_tips", "public.live_broadcasts",
  ];
  const auxiliary = [
    "public.live_ad_impression_events", "public.live_video_view_events", "public.live_videos",
    "public.live_creator_monetization", "public.live_ad_rpm_settings",
    "public.live_monetization_audit_logs", "public.live_creator_profiles", "public.live_risk_flags",
  ];
  for (const relation of [...required, ...auxiliary]) assert.ok(freezeSql.includes(`'${relation}'`), relation);
  assert.match(freezeSql, /GATE04_REQUIRED_RELATION_MISSING/);
});

check("four_operational_roles_and_separation_are_defined", () => {
  for (const role of ["Operator", "Independent Reviewer", "Recovery Owner", "Cleanup Owner"])
    assert.ok(record.includes(role), role);
  assert.match(record, /different identity from Operator/);
});

check("freeze_evidence_contract_is_secret_free", () => {
  for (const token of [
    "freeze started", "writers stopped", "window maintained", "emergency capability",
    "normal unfreeze", "post-unfreeze health",
  ]) assert.ok(record.includes(token), token);
  assert.match(record, /no credential, token, connection string/);
});

check("backup_storage_is_fail_closed_not_invented", () => {
  assert.match(record, /No approved encrypted external backup destination or retention period is identified/);
  assert.match(record, /outside the Repository/);
  assert.match(record, /encrypted in transit and at rest/);
  assert.match(record, /explicit retention duration/);
  assert.match(record, /SHA-256 and byte size/);
  assert.match(record, /HUMAN_BINDING_REQUIRED/);
});

check("credential_delivery_is_non_disclosing_and_staging_mcp_denied", () => {
  assert.match(record, /No approved Gate 04 Production DB credential route is identified/);
  assert.match(record, /Shared Staging-only and must never be repointed to Production/);
  assert.match(record, /never typed into a recorded command, chat, report, repository file, shell history/);
  assert.doesNotMatch(record, /postgres(?:ql)?:\/\//i);
});

check("pitr_and_scope_boundaries_are_preserved", () => {
  assert.match(environments, /PITR/);
  assert.match(record, /PITR is disabled/);
  assert.match(record, /does not enable PITR/);
  for (const token of ["Settlement", "payout", "refund", "transfer", "deploy", "Gate 05"])
    assert.ok(record.includes(token), token);
});

const failed = checks.filter((entry) => !entry.pass);
console.log(`TLV_GATE04_OPERATIONAL_CONTROL_STATIC: ${failed.length ? "FAIL" : "PASS"} (${checks.length - failed.length}/${checks.length})`);
if (failed.length) process.exit(1);
