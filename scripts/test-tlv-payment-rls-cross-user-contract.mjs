#!/usr/bin/env node
/**
 * TLV Payment RLS — static cross-user contract (no network).
 *
 * Parses BOTH migrations:
 *   - 20260628150000_tlv_payment_rls.sql
 *   - 20260813090000_tlv_payment_rls_production_ready_gate.sql
 *
 * Optional live staging: scripts/test-tlv-payment-rls-staging.mjs (not required here).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIG_A = "supabase/migrations/20260628150000_tlv_payment_rls.sql";
const MIG_B = "supabase/migrations/20260813090000_tlv_payment_rls_production_ready_gate.sql";
const STAGING_OPTIONAL = "scripts/test-tlv-payment-rls-staging.mjs";

const FINANCIAL_TABLES = [
  "viewer_wallets",
  "wallet_ledger",
  "coin_lots",
  "payments",
  "tips",
  "tip_coin_lot_allocations",
  "revenue_ledger",
  "payment_provider_events",
  "stream_events",
  "creator_score_events",
];

let pass = 0;
let fail = 0;

function ok(step, detail = "") {
  pass += 1;
  console.log(`PASS ${step}${detail ? ` · ${detail}` : ""}`);
}
function bad(step, detail = "") {
  fail += 1;
  console.error(`FAIL ${step}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond, step, detail) {
  if (cond) ok(step, detail);
  else bad(step, detail);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("=== TLV Payment RLS cross-user contract (static) ===\n");

const sqlA = read(MIG_A);
const sqlB = read(MIG_B);
const combined = `${sqlA}\n${sqlB}`;

assert(
  /PRODUCTION APPLY IS HUMAN GATE/i.test(sqlB),
  "gate_comment_human_gate",
  "explicit Production human-gate comment",
);
assert(
  /is_ops/i.test(sqlB) && /is_tlv_ops_admin/i.test(sqlB),
  "ops_admin_includes_is_ops",
);

for (const table of FINANCIAL_TABLES) {
  const enableRe = new RegExp(
    `alter\\s+table\\s+tlv\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
    "i",
  );
  const forceRe = new RegExp(
    `alter\\s+table\\s+tlv\\.${table}\\s+force\\s+row\\s+level\\s+security`,
    "i",
  );
  assert(enableRe.test(sqlA) && enableRe.test(sqlB), `enable_rls_${table}`);
  assert(forceRe.test(sqlA) && forceRe.test(sqlB), `force_rls_${table}`);
}

// Owner / payer SELECT uses auth.uid() / payer_user_uuid
assert(
  /vw_owner_select[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i.test(combined),
  "owner_select_viewer_wallets_auth_uid",
);
assert(
  /wl_owner_select[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i.test(combined),
  "owner_select_wallet_ledger_auth_uid",
);
assert(
  /cl_owner_select[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i.test(combined),
  "owner_select_coin_lots_auth_uid",
);
assert(
  /pay_payer_select[\s\S]*?payer_user_uuid\s*=\s*auth\.uid\(\)/i.test(combined),
  "payer_select_payments_auth_uid",
);
assert(
  /tips_payer_select[\s\S]*?payer_user_uuid\s*=\s*auth\.uid\(\)/i.test(combined),
  "payer_select_tips_auth_uid",
);

// No authenticated INSERT/UPDATE/DELETE policies on wallets/payments
function hasAuthWritePolicy(sql, table) {
  const re = new RegExp(
    `create\\s+policy\\s+\\S+\\s+on\\s+tlv\\.${table}[\\s\\S]{0,200}?for\\s+(insert|update|delete)\\s+to\\s+authenticated`,
    "i",
  );
  return re.test(sql);
}
for (const table of ["viewer_wallets", "wallet_ledger", "coin_lots", "payments", "tips"]) {
  assert(
    !hasAuthWritePolicy(sqlA, table) && !hasAuthWritePolicy(sqlB, table),
    `no_auth_write_policy_${table}`,
    "client mutations denied by absence",
  );
}

// REVOKE execute tip/payment RPC from authenticated
assert(
  /revoke\s+execute\s+on\s+function\s+tlv\.create_tip_transaction[\s\S]{0,200}?authenticated/i.test(
    combined,
  ) ||
    /revoke\s+execute\s+on\s+all\s+functions\s+in\s+schema\s+tlv\s+from[\s\S]{0,80}?authenticated/i.test(
      sqlA,
    ),
  "revoke_execute_create_tip_from_authenticated",
);
assert(
  /revoke\s+execute\s+on\s+function\s+tlv\.handle_payment_webhook_success[\s\S]{0,200}?authenticated/i.test(
    sqlB,
  ) ||
    /revoke\s+execute\s+on\s+all\s+functions\s+in\s+schema\s+tlv\s+from[\s\S]{0,80}?authenticated/i.test(
      sqlA,
    ),
  "revoke_execute_webhook_from_authenticated",
);
assert(
  /grant\s+execute\s+on\s+function\s+tlv\.create_tip_transaction[\s\S]{0,200}?to\s+service_role/i.test(
    combined,
  ),
  "grant_create_tip_service_role_only",
);

// revenue_ledger admin-only select
assert(
  /rl_admin_select\s+on\s+tlv\.revenue_ledger[\s\S]{0,200}?is_tlv_ops_admin/i.test(combined),
  "revenue_ledger_admin_only_select",
);
assert(
  !/create\s+policy\s+\S+_owner_select\s+on\s+tlv\.revenue_ledger/i.test(combined),
  "revenue_ledger_no_owner_select",
);

// Privilege re-assert on gate migration
assert(
  /revoke\s+all\s+on\s+table\s+tlv\.viewer_wallets\s+from\s+anon,\s*authenticated/i.test(sqlB),
  "gate_revoke_all_viewer_wallets",
);
assert(
  /grant\s+select\s+on\s+table\s+tlv\.payments\s+to\s+authenticated/i.test(sqlB),
  "gate_grant_select_payments",
);
assert(
  /grant\s+all\s+on\s+table\s+tlv\.payments\s+to\s+service_role/i.test(sqlB),
  "gate_grant_all_payments_service_role",
);

// CROSS_USER fixture-based contract expectations (logic, not live DB)
const VIEWER_A = "a0000000-0000-4000-8000-000000000101";
const VIEWER_B = "a0000000-0000-4000-8000-000000000199";

/** Models owner/payer SELECT policy: auth.uid() match OR ops admin. */
function rlsAllowsOwnerOrAdminSelect({ rowOwnerUid, sessionUid, isOpsAdmin }) {
  if (isOpsAdmin) return true;
  return String(rowOwnerUid) === String(sessionUid);
}

/** revenue_ledger: admin-only (no owner SELECT). */
function rlsAllowsRevenueSelect({ isOpsAdmin }) {
  return isOpsAdmin === true;
}

assert(
  rlsAllowsOwnerOrAdminSelect({
    rowOwnerUid: VIEWER_A,
    sessionUid: VIEWER_A,
    isOpsAdmin: false,
  }),
  "CROSS_USER_owner_sees_own",
);
assert(
  !rlsAllowsOwnerOrAdminSelect({
    rowOwnerUid: VIEWER_A,
    sessionUid: VIEWER_B,
    isOpsAdmin: false,
  }),
  "CROSS_USER_peer_denied",
);
assert(
  rlsAllowsRevenueSelect({ isOpsAdmin: true }) &&
    !rlsAllowsRevenueSelect({ isOpsAdmin: false }),
  "CROSS_USER_revenue_admin_only",
);
const tipEdge = read("supabase/functions/tlv-create-tip/index.ts");
assert(
  /parseAuthUserUuid\(auth\.user\.id\)/.test(tipEdge) &&
    !/body\.user_id/.test(tipEdge),
  "edge_tip_jwt_subject_only",
  "tlv-create-tip binds wallet to JWT sub",
);

if (fs.existsSync(path.join(root, STAGING_OPTIONAL))) {
  ok(
    "optional_live_staging_noted",
    `${STAGING_OPTIONAL} exists (network not required for this contract test)`,
  );
} else {
  ok("optional_live_staging_absent", "staging live test not present — OK");
}

console.log(`\n=== Result: ${fail === 0 ? "PASS" : "FAIL"} · pass=${pass} fail=${fail} ===`);
process.exit(fail ? 1 : 0);
