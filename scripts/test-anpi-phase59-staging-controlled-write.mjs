#!/usr/bin/env node
/**
 * ANPI Phase 59 — unit tests (no network).
 */

import assert from "node:assert/strict";
import {
  assertStagingApiUrl,
  assertEnvProjectRef,
  validatePhase58ShapeContract,
  evaluateRowShape,
  ANPI_P59_STAGING_REF,
  ANPI_P59_PRODUCTION_REF,
  ANPI_P59_IDEMPOTENCY_KEY,
  ANPI_P59_TARGET_URL,
  ANPI_P59_TYPE,
} from "./lib/anpi-phase59-staging-controlled-write.mjs";

function pass(name) {
  console.log(`PASS ${name}`);
}

async function main() {
  {
    assert.equal(
      assertStagingApiUrl(`https://${ANPI_P59_STAGING_REF}.supabase.co`),
      ANPI_P59_STAGING_REF
    );
    assert.throws(
      () => assertStagingApiUrl(`https://${ANPI_P59_PRODUCTION_REF}.supabase.co`),
      /production/
    );
    assert.throws(() => assertStagingApiUrl("https://evil.example"), /unexpected/);
    pass("A_project_ref_allowlist");
  }

  {
    assert.equal(assertEnvProjectRef(ANPI_P59_STAGING_REF), ANPI_P59_STAGING_REF);
    assert.throws(() => assertEnvProjectRef(ANPI_P59_PRODUCTION_REF), /production/);
    pass("B_env_ref_guard");
  }

  {
    const v = validatePhase58ShapeContract();
    assert.equal(v.ok, true);
    assert.equal(v.contract.idempotency_key, ANPI_P59_IDEMPOTENCY_KEY);
    pass("C_phase58_contract");
  }

  {
    const ok = evaluateRowShape({
      id: "anpi-p17-abc",
      type: ANPI_P59_TYPE,
      target_url: ANPI_P59_TARGET_URL,
      source: "anpi_phase17_test",
      title: "安否確認のお願い",
      body: "本日の安否確認をお願いします。",
    });
    assert.equal(ok.ok, true);
    const bad = evaluateRowShape({
      id: "anpi-p17-abc",
      type: "chat",
      target_url: "https://evil",
      source: "other",
      title: "x",
      body: "https://evil",
    });
    assert.equal(bad.ok, false);
    pass("D_row_shape");
  }

  console.log("Phase 59 unit tests: all PASS");
}

main().catch((err) => {
  console.error("FAIL", String(err?.stack || err).slice(0, 800));
  process.exitCode = 1;
});
