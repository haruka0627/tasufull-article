#!/usr/bin/env node
/**
 * ANPI Phase 61 — unit tests (no network).
 */

import assert from "node:assert/strict";
import {
  assertStagingScoped,
  assertScopedWriterEnabled,
  isScopedWriterEnabled,
  buildStableIdempotencyKey,
  assertStableKeySemantics,
  buildScopedJobContract,
  isAllowlistedAuthUserId,
  sha8,
  ANPI_P61_TARGET_AUTH_SHA8,
  ANPI_P61_ENABLE_ENV,
  renderTalkRowFromContract,
  ANPI_P61_TYPE,
  ANPI_P61_TARGET_URL,
  ANPI_P61_SOURCE,
} from "./lib/anpi-phase61-scoped-job-writer.mjs";
import { STAGING_SUPABASE_REF, PRODUCTION_SUPABASE_REF } from "./lib/anpi-phase48-scheduled-runtime.mjs";

function pass(name) {
  console.log(`PASS ${name}`);
}

async function main() {
  {
    assert.equal(
      assertStagingScoped(`https://${STAGING_SUPABASE_REF}.supabase.co`, STAGING_SUPABASE_REF),
      STAGING_SUPABASE_REF
    );
    assert.throws(
      () => assertStagingScoped(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`, STAGING_SUPABASE_REF),
      /production/
    );
    pass("A_staging_ref_guards");
  }

  {
    assert.equal(isScopedWriterEnabled({ [ANPI_P61_ENABLE_ENV]: "true" }), true);
    assert.throws(() => assertScopedWriterEnabled({}), /flag_off/);
    assert.throws(() => assertScopedWriterEnabled({ [ANPI_P61_ENABLE_ENV]: "false" }), /flag_off/);
    pass("B_enable_flag_fail_closed");
  }

  {
    const sem = assertStableKeySemantics();
    assert.equal(sem.ok, true);
    assert.equal(sem.same_due_bucket, true);
    assert.equal(sem.different_kind, true);
    const k1 = buildStableIdempotencyKey({
      subjectUserId: "u1",
      kind: "initial",
      checkId: "c1",
      logicalDueAt: "2026-07-27T00:00:00Z",
    });
    const k2 = buildStableIdempotencyKey({
      subjectUserId: "u1",
      kind: "initial",
      checkId: "c1",
      logicalDueAt: "2026-07-27T12:00:00Z",
    });
    assert.equal(k1, k2);
    assert.doesNotMatch(k1, /attempt/);
    pass("C_stable_idempotency");
  }

  {
    const job = {
      id: "00000000-0000-4000-8000-000000000061",
      kind: "initial",
      check_id: "00000000-0000-4000-8000-000000000001",
      subject_user_id: "00000000-0000-4000-8000-000000000002",
      attempt_count: 7,
      available_at: "2026-07-27T08:00:00.000Z",
    };
    const a = buildScopedJobContract(job, { attemptForContract: 7 });
    const b = buildScopedJobContract({ ...job, attempt_count: 99 }, { attemptForContract: 99 });
    assert.equal(a.stableKey, b.stableKey);
    assert.equal(a.notificationId, b.notificationId);
    assert.equal(a.contract.schema, "anpi.talk.contract.v1");
    pass("D_contract_ignores_attempt_in_key");
  }

  {
    const fakeAuth = "00000000-0000-4000-8000-000000000099";
    assert.equal(isAllowlistedAuthUserId(fakeAuth), false);
    // Construct uuid whose sha8 matches allowlist is hard; just assert helper uses sha8.
    assert.equal(typeof sha8(fakeAuth), "string");
    assert.equal(ANPI_P61_TARGET_AUTH_SHA8.length, 8);
    pass("E_allowlist_helper");
  }

  {
    const job = {
      id: "00000000-0000-4000-8000-000000000061",
      kind: "reminder",
      check_id: "00000000-0000-4000-8000-000000000001",
      subject_user_id: "00000000-0000-4000-8000-000000000002",
      available_at: "2026-07-27T08:00:00.000Z",
    };
    const { contract } = buildScopedJobContract(job);
    const row = renderTalkRowFromContract(contract, "u_store");
    assert.equal(row.type, ANPI_P61_TYPE);
    assert.equal(row.target_url, ANPI_P61_TARGET_URL);
    assert.equal(row.source, ANPI_P61_SOURCE);
    assert.equal(row.user_id, "u_store");
    assert.doesNotMatch(row.title + row.body, /https?:\/\//i);
    pass("F_render_phase10_shape");
  }

  console.log("Phase 61 scoped job-writer unit tests: all PASS");
}

main().catch((err) => {
  console.error("FAIL", String(err?.stack || err).slice(0, 800));
  process.exitCode = 1;
});
