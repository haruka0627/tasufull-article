#!/usr/bin/env node
/**
 * ANPI Phase 2 Data Foundation repository verification.
 *
 * Static verification only. This does not apply a migration or replace the
 * DB-backed SQL test in supabase/tests/anpi_phase2_data_foundation.sql.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260727020000_anpi_phase2_data_foundation.sql",
);
const sqlTestPath = path.join(root, "supabase", "tests", "anpi_phase2_data_foundation.sql");
const prdPath = path.join(root, "docs", "ANPI_PRD.md");
const reportPath = path.join(root, "reports", "anpi-phase2-data-foundation.md");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error.message);
  }
}

function readRequired(file) {
  assert.equal(fs.existsSync(file), true, `missing ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

const migration = readRequired(migrationPath);
const sqlTest = readRequired(sqlTestPath);
const prd = readRequired(prdPath);
const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "";

const tables = [
  "anpi_settings",
  "anpi_check_instances",
  "anpi_contacts",
  "anpi_contact_invitations",
  "anpi_notification_deliveries",
  "anpi_audit_logs",
];
const canonicalStatuses = [
  "scheduled",
  "notified",
  "reminded",
  "overdue",
  "contact_notified",
  "confirmed",
  "confirmed_late",
  "paused",
  "cancelled",
];

check("migration file exists at collision-free timestamp", () => {
  assert.match(path.basename(migrationPath), /^20260727020000_anpi_phase2_data_foundation\.sql$/);
});

check("DB-backed SQL test exists", () => {
  assert.match(sqlTest, /ANPI Phase 2 DB-backed test/);
  assert.match(sqlTest, /rollback;/i);
});

for (const table of tables) {
  check(`creates ${table}`, () => {
    assert.match(migration, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  });
  check(`enables RLS on ${table}`, () => {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  });
}

check("canonical status vocabulary is complete", () => {
  for (const status of canonicalStatuses) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
});

check("delivery_failed is excluded from check status constraint", () => {
  const statusConstraint = migration.match(
    /constraint anpi_check_instances_status_check[\s\S]*?\)\s*,/,
  )?.[0];
  assert.ok(statusConstraint);
  assert.doesNotMatch(statusConstraint, /delivery_failed/);
  assert.match(migration, /delivery_failed is intentionally excluded/);
});

check("daily check natural key is unique", () => {
  assert.match(
    migration,
    /unique \(subject_user_id, local_check_date\)/i,
  );
});

check("scheduler RPC uses conflict-safe idempotency", () => {
  assert.match(migration, /function public\.anpi_create_daily_check/);
  assert.match(migration, /on conflict \(subject_user_id, local_check_date\)/i);
  assert.match(migration, /grant execute[\s\S]*anpi_create_daily_check[\s\S]*to service_role/i);
  assert.match(
    migration,
    /revoke all[\s\S]*anpi_create_daily_check[\s\S]*from public, anon, authenticated/i,
  );
});

check("timezone is fixed to Asia/Tokyo", () => {
  assert.match(migration, /timezone text not null default 'Asia\/Tokyo'/);
  assert.match(migration, /timezone = 'Asia\/Tokyo'/);
  assert.match(
    migration,
    /local_check_date = \(scheduled_at at time zone 'Asia\/Tokyo'\)::date/,
  );
});

check("weekdays validator rejects duplicates and out-of-range values", () => {
  assert.match(migration, /anpi_phase2_valid_weekdays/);
  assert.match(migration, /array\[1, 2, 3, 4, 5, 6, 7\]/);
  assert.match(migration, /count\(distinct value\)/);
  assert.match(
    migration,
    /grant execute on function public\.anpi_phase2_valid_weekdays\(smallint\[\]\)[\s\S]*to authenticated, service_role/,
  );
});

check("reminder count has a safe upper bound", () => {
  assert.match(migration, /reminder_count between 0 and 2/);
});

check("one current setting per subject", () => {
  assert.match(migration, /anpi_settings_one_current_per_subject_idx/);
  assert.match(migration, /where deleted_at is null/);
});

check("confirm RPC is auth-bound and idempotent", () => {
  assert.match(migration, /function public\.anpi_confirm_check/);
  assert.match(migration, /v_check\.subject_user_id <> auth\.uid\(\)/);
  assert.match(migration, /v_check\.status in \('confirmed', 'confirmed_late'\)/);
  assert.match(migration, /select v_check\.id[\s\S]*true;/);
  assert.match(migration, /anpi_check_not_today/);
});

check("late confirmation is explicit", () => {
  assert.match(
    migration,
    /when v_check\.status = 'contact_notified' then 'confirmed_late'/,
  );
});

check("terminal and invalid transitions are guarded", () => {
  assert.match(migration, /anpi_phase2_transition_allowed/);
  assert.doesNotMatch(
    migration.match(
      /function public\.anpi_phase2_transition_allowed[\s\S]*?\$\$;/,
    )?.[0] ?? "",
    /p_old_status = 'confirmed'/,
  );
  assert.match(migration, /anpi_invalid_status_transition/);
});

check("notified may transition directly to overdue", () => {
  const body =
    migration.match(
      /function public\.anpi_phase2_transition_allowed[\s\S]*?\$\$;/,
    )?.[0] ?? "";
  assert.match(
    body,
    /p_old_status = 'notified' and p_new_status in \('reminded', 'overdue', 'confirmed', 'cancelled'\)/,
  );
  assert.match(sqlTest, /ASSERTION FAILED:[\s\S]*30 notified->overdue|30 notified->overdue allowed/);
});

check("confirmation timestamp is immutable after first success", () => {
  assert.match(migration, /anpi_confirmed_at_immutable/);
  assert.match(migration, /old\.confirmed_at is not null/);
});

check("identity and idempotency columns are immutable", () => {
  assert.match(migration, /anpi_phase2_guard_immutable_identity/);
  for (const error of [
    "anpi_setting_identity_immutable",
    "anpi_check_identity_immutable",
    "anpi_contact_identity_immutable",
    "anpi_invitation_identity_immutable",
    "anpi_delivery_identity_immutable",
  ]) {
    assert.match(migration, new RegExp(error));
  }
});

check("contact activation requires accepted consent", () => {
  assert.match(migration, /anpi_contacts_active_consent_check/);
  assert.match(migration, /accepted_at is not null/);
  assert.match(migration, /revoked_at is null/);
  assert.match(migration, /deleted_at is null/);
});

check("invitation stores SHA-256-shaped hash only", () => {
  assert.match(migration, /token_hash text not null/);
  assert.match(migration, /\^\[0-9a-f\]\{64\}\$/);
  assert.doesNotMatch(migration, /\braw_token\b|\btoken_plaintext\b/i);
});

check("invitation is expiring and single-use", () => {
  assert.match(migration, /expires_at timestamptz not null/);
  assert.match(migration, /num_nonnulls\(accepted_at, declined_at, revoked_at\) <= 1/);
  assert.match(migration, /anpi_invitation_already_used/);
  assert.match(migration, /v_invitation\.invitee_user_id <> auth\.uid\(\)/);
  assert.match(
    migration,
    /update public\.anpi_contact_invitations[\s\S]*set revoked_at = now\(\)/,
  );
});

check("contact delivery has a database consent gate", () => {
  assert.match(migration, /anpi_phase2_guard_contact_delivery/);
  assert.match(migration, /anpi_contact_not_notification_eligible/);
  assert.match(migration, /c\.status = 'active'/);
  assert.match(migration, /c\.subject_user_id = v_subject/);
  assert.match(
    migration,
    /before insert or update of check_id, contact_id, recipient_user_id, kind/,
  );
  assert.match(sqlTest, /ASSERTION FAILED: 18 cross-subject contact delivery accepted/);
  assert.match(sqlTest, /ASSERTION FAILED: 18 check_id rebind accepted/);
});

check("delivery statuses kinds and channels are constrained", () => {
  for (const value of ["queued", "sent", "delivered", "failed", "skipped", "cancelled"]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
  for (const value of [
    "initial",
    "reminder",
    "contact_unconfirmed",
    "late_confirmation",
    "system_notice",
  ]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
  for (const value of ["talk", "line", "push", "email", "sms"]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
});

check("delivery idempotency includes recipient", () => {
  assert.match(
    migration,
    /unique \(\s*check_id,\s*recipient_user_id,\s*channel,\s*kind\s*\)/,
  );
});

check("audit payload is safe and append-only", () => {
  assert.match(migration, /old_values_safe jsonb/);
  assert.match(migration, /new_values_safe jsonb/);
  assert.doesNotMatch(migration, /grant (?:select|update|delete)[^;]*anpi_audit_logs to authenticated/i);
  assert.match(migration, /no tokens or plaintext contact PII/i);
});

check("SECURITY DEFINER functions pin search_path", () => {
  const functions = [
    "anpi_phase2_write_safe_audit",
    "anpi_confirm_check",
    "anpi_create_daily_check",
    "anpi_respond_contact_invitation",
    "anpi_revoke_contact",
    "anpi_contact_check_summary",
    "anpi_contact_invitation_summaries",
  ];
  for (const name of functions) {
    const body = migration.match(
      new RegExp(
        `create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`,
        "i",
      ),
    )?.[0];
    assert.ok(body, `missing function ${name}`);
    assert.match(body, /security definer/i);
    assert.match(body, /set search_path = pg_catalog, public/i);
  }
});

check("public and anon execute are revoked from user RPCs", () => {
  for (const signature of [
    "anpi_confirm_check\\(uuid, text\\)",
    "anpi_respond_contact_invitation\\(uuid, text, boolean\\)",
    "anpi_revoke_contact\\(uuid\\)",
    "anpi_contact_check_summary\\(uuid\\)",
    "anpi_contact_invitation_summaries\\(\\)",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${signature}\\s+from public, anon`,
        "i",
      ),
    );
  }
});

check("general clients cannot mutate checks deliveries or audit", () => {
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete)[^;]*anpi_check_instances to authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete)[^;]*anpi_notification_deliveries to authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant [^;]*anpi_audit_logs to authenticated/i,
  );
});

check("contact summary exposes only minimal fields", () => {
  const body = migration.match(
    /function public\.anpi_contact_check_summary[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(body);
  assert.match(body, /check_id uuid[\s\S]*local_check_date date[\s\S]*status text[\s\S]*confirmed_at/);
  assert.doesNotMatch(body, /owner_user_id|setting_id|scheduled_at/);
  assert.doesNotMatch(body, /'overdue'/);
  assert.match(body, /'contact_notified', 'confirmed_late'/);
  assert.match(sqlTest, /25 overdue hidden from active contact/);
  assert.match(sqlTest, /25 active contact sees contact_notified summary only/);
});

check("auth denial tests assert concrete error messages", () => {
  assert.match(sqlTest, /request\.jwt\.claims/);
  assert.match(sqlTest, /anpi_check_not_accessible/);
  assert.match(sqlTest, /anpi_invitation_not_accessible/);
  assert.match(sqlTest, /ASSERTION FAILED: 12 unexpected privilege error/);
  assert.match(sqlTest, /ASSERTION FAILED: 17 unexpected privilege error/);
});

check("invitation summary never exposes token_hash", () => {
  const body = migration.match(
    /function public\.anpi_contact_invitation_summaries[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(body);
  assert.doesNotMatch(
    body.match(/returns table \([\s\S]*?\)\s*language/i)?.[0] ?? "",
    /token_hash/,
  );
  assert.doesNotMatch(
    migration,
    /grant select[^;]*anpi_contact_invitations to authenticated/i,
  );
});

check("legacy mapping is non-destructive", () => {
  assert.match(migration, /anpi_legacy_check_status_mapping/);
  assert.match(migration, /\('pending', 'scheduled', 'safe_mapping'\)/);
  assert.match(migration, /\('no_response', 'overdue', 'manual_review_no_auto_update'\)/);
  assert.match(migration, /does not rewrite frozen legacy rows/i);
});

check("legacy tables are never altered or dropped", () => {
  assert.doesNotMatch(
    migration,
    /\b(?:alter|drop|truncate)\s+table\s+(?:public\.)?(?:anpi_user_contexts|anpi_check_sessions|anpi_notification_logs|anpi_no_response_audit_log)\b/i,
  );
  assert.doesNotMatch(migration, /\bupdate\s+(?:public\.)?anpi_(?:user_contexts|check_sessions|notification_logs)\b/i);
});

check("migration has no production apply command", () => {
  assert.doesNotMatch(
    migration,
    /\bsupabase\s+(?:db\s+push|migration\s+up|link)\b|\bwrangler\s+deploy\b/i,
  );
});

check("migration has no obvious secret value", () => {
  assert.doesNotMatch(
    migration,
    /eyJ[a-zA-Z0-9_-]{20,}|sk_(?:live|test)_[a-zA-Z0-9]+|Bearer\s+[a-zA-Z0-9._-]+|BEGIN (?:RSA |EC )?PRIVATE KEY/i,
  );
});

check("Phase 2 scope contains no UI API TALK or dist file", () => {
  const phase2Files = [
    path.relative(root, migrationPath),
    path.relative(root, sqlTestPath),
    "scripts/test-anpi-phase2-data-foundation.mjs",
    "docs/ANPI_PRD.md",
    "reports/anpi-phase2-data-foundation.md",
  ];
  for (const file of phase2Files) {
    assert.doesNotMatch(file, /\.(?:html|css)$/i);
    assert.doesNotMatch(file, /deploy[\\/]cloudflare[\\/]dist/i);
    assert.doesNotMatch(file, /talk-|anpi-line|functions[\\/]api/i);
  }
});

check("DB-backed test declares all 30 required assertions", () => {
  for (let number = 1; number <= 30; number += 1) {
    assert.match(
      sqlTest,
      new RegExp(`(?:ASSERTION FAILED: ${number}\\b|'${number} )`),
      `missing assertion ${number}`,
    );
  }
  assert.match(sqlTest, /DB-backed assertions: 30 PASS/);
});

check("PRD retains canonical button-check policy", () => {
  assert.match(prd, /「無事です」ボタン/);
  assert.match(prd, /delivery_failed.*インスタンス状態に混ぜない/);
  assert.match(prd, /UNIQUE \(subject_user_id, local_check_date\)/);
});

check("PRD records local-only Phase 2 status", () => {
  assert.match(prd, /Phase 2 Data Foundation[\s\S]*Implemented locally[\s\S]*not deployed/i);
});

check("implementation report exists and records no migration apply", () => {
  assert.match(report, /ANPI Phase 2 — Data Foundation/);
  assert.match(report, /migration.*未適用/i);
  assert.match(report, /Production[\s\S]{0,80}未適用/i);
});

console.log(`\nANPI Phase 2 repository verification: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
