#!/usr/bin/env node
/**
 * ANPI Phase 65 — prod idempotency + runtime pause unit tests (no network).
 */

import assert from "node:assert/strict";
import {
  ANPI_PROD_KEY_PREFIX,
  ANPI_STAGING_KEY_PREFIX,
  buildProdStableIdempotencyKey,
  notificationIdFromProdKey,
  assertProdKeySemantics,
  simulateReclaimAfterPartialFailure,
  sha8,
} from "./lib/anpi-prod-stable-idempotency.mjs";
import {
  resolveClaimMode,
  isLegacyClaimAllowed,
  assertSafeConfigTransition,
  simulateFlagOffRace,
  FORCED_PAUSE_ORDER,
} from "./lib/anpi-runtime-pause.mjs";

function pass(name) {
  console.log(`PASS ${name}`);
}

function main() {
  {
    const sem = assertProdKeySemantics();
    assert.equal(sem.ok, true);
    assert.ok(sem.sample.startsWith(ANPI_PROD_KEY_PREFIX));
    assert.equal(sem.sample.includes(ANPI_STAGING_KEY_PREFIX), false);
    pass("A_prod_key_semantics");
  }

  {
    const k = buildProdStableIdempotencyKey({
      subjectUserId: "u1",
      kind: "initial",
      checkId: "c1",
      logicalDueAt: "2026-07-28T01:00:00Z",
    });
    assert.throws(
      () =>
        buildProdStableIdempotencyKey({
          subjectUserId: "u1",
          kind: "initial",
          checkId: "c1",
          logicalDueAt: "not-a-date",
        }),
      /due/
    );
    const id = notificationIdFromProdKey(k);
    assert.match(id, /^anpi-prod-[a-f0-9]+$/);
    assert.throws(() => notificationIdFromProdKey("anpi:p61:v1:x"), /prod_prefix/);
    pass("B_prod_id_and_malformed");
  }

  {
    const job = {
      subject_user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      kind: "initial",
      check_id: "11111111-2222-3333-4444-555555555555",
      available_at: "2026-07-28T12:00:00.000Z",
      attempt_count: 9,
    };
    const r = simulateReclaimAfterPartialFailure(job);
    assert.equal(r.same_key, true);
    assert.equal(r.same_notification_id, true);
    assert.equal(r.attempt_ignored, true);
    assert.equal(sha8(job.subject_user_id).length, 8);
    pass("C_reclaim_partial_failure");
  }

  {
    assert.equal(
      resolveClaimMode({
        ANPI_STAGING_RUNTIME_ENABLED: "true",
        ANPI_P62_SCOPED_CRON_PATH: "true",
      }),
      "scoped"
    );
    assert.equal(
      resolveClaimMode({
        ANPI_STAGING_RUNTIME_ENABLED: "true",
        ANPI_P62_SCOPED_CRON_PATH: "false",
        ANPI_ALLOW_LEGACY_CLAIM: "true",
      }),
      "legacy"
    );
    assert.equal(
      resolveClaimMode({
        ANPI_STAGING_RUNTIME_ENABLED: "true",
        ANPI_P62_SCOPED_CRON_PATH: "false",
        ANPI_ALLOW_LEGACY_CLAIM: "false",
      }),
      "none"
    );
    assert.equal(
      resolveClaimMode({
        ANPI_STAGING_RUNTIME_ENABLED: "false",
        ANPI_P62_SCOPED_CRON_PATH: "true",
        ANPI_ALLOW_LEGACY_CLAIM: "true",
      }),
      "none"
    );
    pass("D_claim_modes");
  }

  {
    assert.equal(isLegacyClaimAllowed({ ANPI_ENVIRONMENT: "production" }), false);
    assert.equal(isLegacyClaimAllowed({ ANPI_ENVIRONMENT: "staging" }), true);
    assert.equal(
      isLegacyClaimAllowed({ ANPI_ENVIRONMENT: "production", ANPI_ALLOW_LEGACY_CLAIM: "true" }),
      true
    );
    pass("E_legacy_default_by_env");
  }

  {
    const bad = assertSafeConfigTransition({
      runtimeEnabled: true,
      changingScopedFlags: true,
      inflightLeaseCount: 0,
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.blockers.includes("anpi_pause_required_before_config_change"));
    const good = assertSafeConfigTransition({
      runtimeEnabled: false,
      changingScopedFlags: true,
      inflightLeaseCount: 0,
      inflightProcessingJobs: 0,
    });
    assert.equal(good.ok, true);
    pass("F_safe_transition");
  }

  {
    const raceUnsafe = simulateFlagOffRace({
      runtimeEnabled: true,
      scopedBefore: true,
      scopedAfter: false,
      allowLegacyClaim: true,
    });
    assert.equal(raceUnsafe.legacy_would_claim, true);
    assert.equal(raceUnsafe.safe_if_legacy_disallowed, false);

    const raceSafe = simulateFlagOffRace({
      runtimeEnabled: true,
      scopedBefore: true,
      scopedAfter: false,
      allowLegacyClaim: false,
    });
    assert.equal(raceSafe.legacy_would_claim, false);
    assert.equal(raceSafe.safe_if_legacy_disallowed, true);

    const paused = simulateFlagOffRace({
      runtimeEnabled: false,
      scopedBefore: true,
      scopedAfter: false,
      allowLegacyClaim: true,
    });
    assert.equal(paused.mode_during_flip, "none");
    assert.equal(paused.safe_if_legacy_disallowed, true);
    pass("G_phase63_race_mitigation");
  }

  {
    assert.equal(FORCED_PAUSE_ORDER[0], "runtime_pause");
    assert.ok(FORCED_PAUSE_ORDER.includes("confirm_inflight_zero"));
    pass("H_forced_order");
  }

  console.log("ALL PASS anpi-phase65-prod-readiness");
}

main();
