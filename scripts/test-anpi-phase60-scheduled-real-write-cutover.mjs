#!/usr/bin/env node
/**
 * ANPI Phase 60 — unit tests (no network). Cutover readiness assessment only.
 */

import assert from "node:assert/strict";
import {
  assessScheduledRealWriteCutoverReadiness,
  evaluateProposedProviderCutover,
  buildCutoverGuardMatrix,
  ANPI_P60_CUTOVER_VERDICT,
  ANPI_P60_BLOCKERS,
} from "./lib/anpi-phase60-scheduled-real-write-cutover-readiness.mjs";

function pass(name) {
  console.log(`PASS ${name}`);
}

async function main() {
  {
    const a = assessScheduledRealWriteCutoverReadiness();
    assert.equal(a.verdict, ANPI_P60_CUTOVER_VERDICT);
    assert.equal(a.cutover_performed, false);
    assert.equal(a.cron_real_write_executions, 0);
    assert.equal(a.real_insert_count_via_cron, 0);
    assert.ok(ANPI_P60_BLOCKERS.length >= 4);
    pass("A_verdict_not_ready");
  }

  {
    const local = evaluateProposedProviderCutover("talk_local");
    assert.equal(local.passes_cf_talk_local_prefix, true);
    assert.equal(local.allowed_as_periodic_runtime_today, true);
    assert.equal(local.cutover_ready, false);

    const write = evaluateProposedProviderCutover("talk_write");
    assert.equal(write.passes_cf_talk_local_prefix, false);
    assert.equal(write.allowed_as_periodic_runtime_today, false);
    assert.equal(write.flip_alone_enables_inbox_write, false);
    assert.equal(write.cutover_ready, false);
    pass("B_provider_flip_is_not_cutover");
  }

  {
    const matrix = buildCutoverGuardMatrix();
    assert.ok(matrix.every((r) => r.pass));
    const rejected = matrix.find((r) => r.name === "talk_write_rejected");
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "anpi_cf_provider_not_talk_local");
    pass("C_guard_matrix");
  }

  {
    const a = assessScheduledRealWriteCutoverReadiness();
    assert.equal(a.guard_matrix_ok, true);
    assert.ok(a.blockers.includes("no_test_identity_filter_on_claim"));
    pass("D_blockers_listed");
  }

  console.log("Phase 60 cutover readiness tests: all PASS");
}

main().catch((err) => {
  console.error("FAIL", String(err?.stack || err).slice(0, 800));
  process.exitCode = 1;
});
