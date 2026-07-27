#!/usr/bin/env node
/**
 * ANPI Phase 58 — Talk provider readiness unit tests (no network).
 */

import assert from "node:assert/strict";
import {
  buildAndValidateKindContracts,
  evaluateTalkWriteHealth,
  isAllowedRuntimeProvider,
  validateRuntimeProviders,
  ANPI_NOTIFY_KINDS,
  ANPI_OFFICIAL_ROOM_ID,
  ANPI_TARGET_URL_POLICY,
  assertStagingOrLocalApi,
} from "./lib/anpi-phase58-talk-provider-readiness.mjs";
import { validateContract, buildNotificationContract } from "./lib/anpi-talk-contract.mjs";
import { PRODUCTION_SUPABASE_REF, STAGING_SUPABASE_REF } from "./lib/anpi-phase48-scheduled-runtime.mjs";

function pass(name) {
  console.log(`PASS ${name}`);
}

function healthyPayload(over = {}) {
  return {
    ok: true,
    adapter: "talk_write_path",
    talk_table_present: true,
    target_url_policy: "fixed_hash_no_url",
    production_send: false,
    staging_send: false,
    user_facing_inbox_write: false,
    real_mode_enabled: false,
    push: false,
    realtime: false,
    identity_mapping: "anpi_resolve_talk_user_id",
    sidecar_ledger: true,
    ...over,
  };
}

async function main() {
  {
    const rows = buildAndValidateKindContracts();
    assert.equal(rows.length, ANPI_NOTIFY_KINDS.length);
    assert.ok(rows.every((r) => r.contract_ok));
    pass("A_all_kind_contracts");
  }

  {
    const bad = buildNotificationContract({
      id: "00000000-0000-4000-8000-000000000099",
      kind: "initial",
      check_id: "00000000-0000-4000-8000-000000000001",
      subject_user_id: "00000000-0000-4000-8000-000000000002",
      attempt_count: 1,
      idempotency_key: "anpi:bad:1",
    });
    const dirtyUrl = { ...bad, url: "https://evil.example" };
    assert.equal(validateContract(dirtyUrl), "anpi_contract_forbidden_content");
    assert.equal(validateContract({ ...bad, url: "relative" }), "anpi_contract_forbidden_field");
    pass("B_forbid_url_field");
  }

  {
    assert.equal(isAllowedRuntimeProvider("talk_local_stub"), true);
    assert.equal(isAllowedRuntimeProvider("talk_local_adapter"), true);
    assert.equal(isAllowedRuntimeProvider("talk_write"), false);
    assert.equal(isAllowedRuntimeProvider("talk_write", { allowWriteProvider: true }), true);
    assert.equal(isAllowedRuntimeProvider("email_external"), false);
    const v = validateRuntimeProviders(["talk_local_stub", "sms"], {});
    assert.equal(v.ok, false);
    pass("C_provider_allowlist");
  }

  {
    const ev = evaluateTalkWriteHealth(healthyPayload());
    assert.equal(ev.foundation_ok, true);
    assert.equal(ev.design_ready, true);
    assert.equal(ev.staging_real_send_ready, false);
    assert.equal(ev.production_real_send_ready, false);
    assert.equal(ev.official_room_id, ANPI_OFFICIAL_ROOM_ID);
    assert.equal(ev.target_url_policy, ANPI_TARGET_URL_POLICY);
    pass("D_health_evaluate_pass");
  }

  {
    const ev = evaluateTalkWriteHealth(healthyPayload({ production_send: true }));
    assert.equal(ev.foundation_ok, false);
    pass("E_reject_production_send_flag");
  }

  {
    assert.equal(
      assertStagingOrLocalApi(`https://${STAGING_SUPABASE_REF}.supabase.co`),
      STAGING_SUPABASE_REF
    );
    assert.throws(
      () => assertStagingOrLocalApi(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`),
      /production/
    );
    pass("F_staging_local_url_guards");
  }

  console.log("Phase 58 talk provider readiness tests: all PASS");
}

main().catch((err) => {
  console.error("FAIL", String(err?.stack || err).slice(0, 800));
  process.exitCode = 1;
});
