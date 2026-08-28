import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const record = read("docs/TLV_PRODUCTION_OPERATIONAL_CONTROL_RECORD.md");
const inventory = read("reports/tlv-step5l-prod-gate-04-writer-inventory.md");
const sql = read("reports/sql/tlv-step5l-prod-gate-04-writer-freeze-control.sql");

const attacks = [];
function attack(name, fn) {
  try {
    fn();
    attacks.push({ name, resisted: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    attacks.push({ name, resisted: false });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

attack("legacy_direct_tip_bypass_is_locked", () => {
  assert.ok(sql.includes("'public.live_tips'"));
  assert.ok(sql.includes("'public.live_broadcasts'"));
});

attack("provider_event_fallback_bypass_is_locked", () => {
  assert.ok(sql.includes("'tlv.payment_provider_events'"));
  assert.match(inventory, /webhook fallback helper/);
});

attack("refund_and_dispute_side_tables_are_locked", () => {
  for (const relation of ["tlv.payment_reversals", "tlv.payout_log", "tlv.creators", "tlv.revenue_ledger"])
    assert.ok(sql.includes(`'${relation}'`), relation);
});

attack("ads_and_admin_attribution_drift_is_locked", () => {
  for (const relation of ["public.live_ad_impression_events", "public.live_ad_rpm_settings", "public.live_creator_monetization"])
    assert.ok(sql.includes(`'${relation}'`), relation);
});

attack("missing_core_relation_fails_closed", () => {
  assert.match(sql, /if coalesce\(cardinality\(missing\), 0\) > 0/);
  assert.match(sql, /raise exception 'GATE04_REQUIRED_RELATION_MISSING/);
});

attack("noninteractive_session_misuse_is_denied", () => {
  assert.match(sql, /INTERACTIVE PSQL ONLY/);
  assert.match(record, /noninteractive client that exits immediately is invalid/);
});

attack("lock_session_loss_auto_unfreezes", () => {
  assert.match(record, /session loss automatically releases all locks/);
  assert.match(record, /terminate.*recorded freeze PID/is);
});

attack("production_canary_write_is_forbidden", () => {
  assert.match(record, /No canary `INSERT`, `UPDATE`, or `DELETE` is permitted in Production/);
});

attack("provider_race_is_disclosed_not_hidden", () => {
  assert.match(record, /Provider\/API requests may time out and retry/);
  assert.match(record, /external initiation is not a DB write/);
});

attack("checkpoint_gap_invalidates_backup", () => {
  assert.match(record, /any gap invalidates checkpoint/);
  assert.match(record, /unexpected drift/);
});

attack("queued_writer_is_proved_blocked_not_claimed_absent", () => {
  assert.match(record, /queued writer lock is ungranted and blocked by the recorded freeze PID/);
  assert.match(sql, /other_granted_conflicting_locks/);
  assert.match(sql, /writer_sessions_blocked_by_freeze_pid/);
});

attack("operator_cannot_self_approve", () => {
  assert.match(record, /cannot approve own Evidence/);
  assert.match(record, /must be a different identity from Operator/);
});

attack("backup_destination_and_retention_not_fabricated", () => {
  assert.match(record, /No approved encrypted external backup destination or retention period is identified/);
  assert.doesNotMatch(record, /retention (?:is|=) \d+ days/i);
});

attack("credential_exfiltration_is_denied", () => {
  assert.match(record, /never typed into a recorded command, chat, report, repository file, shell history/);
  assert.doesNotMatch(record, /(?:password|token|secret)\s*[=:]\s*[A-Za-z0-9._-]{12,}/i);
  assert.doesNotMatch(record, /postgres(?:ql)?:\/\//i);
});

attack("staging_and_candidate_migrations_cannot_enter_gate04", () => {
  assert.match(record, /Shared Staging ref is an explicit deny/);
  assert.match(inventory, /CANDIDATE_NOT_PRODUCTION/);
  assert.match(record, /does not authorize a migration/);
});

const failed = attacks.filter((entry) => !entry.resisted);
console.log(`TLV_GATE04_OPERATIONAL_CONTROL_RED_TEAM: ${failed.length ? "FAIL" : "PASS"} (${attacks.length - failed.length}/${attacks.length})`);
if (failed.length) process.exit(1);
