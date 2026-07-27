#!/usr/bin/env node
/**
 * ANPI Phase 66 — Production adapter + readiness gate tests (no network / no secrets).
 */

import assert from "node:assert/strict";
import {
  resolveProdCfSchedulerConfig,
  validateProdCfSchedulerEnv,
  buildProdCfExecutionId,
  buildProdCfSchedulerLog,
  runAnpiProdCfScheduledTick,
  CF_PRODUCTION_ENV,
} from "./lib/anpi-phase66-production-cloudflare-scheduler-adapter.mjs";
import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";
import { resolveClaimMode } from "./lib/anpi-runtime-pause.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function pass(name) {
  console.log(`PASS ${name}`);
}

function prodEnv(over = {}) {
  return {
    ANPI_ENVIRONMENT: CF_PRODUCTION_ENV,
    ANPI_PRODUCTION_PROJECT_REF: PRODUCTION_SUPABASE_REF,
    ANPI_PRODUCTION_RUNTIME_ENABLED: "true",
    ANPI_NOTIFICATION_PROVIDER: "talk_local",
    ANPI_PRODUCTION_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    ANPI_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: "test-prod-service-role-not-real",
    ANPI_ALLOW_LEGACY_CLAIM: "false",
    ANPI_P62_SCOPED_CRON_PATH: "true",
    ANPI_P61_SCOPED_WRITER_ENABLED: "true",
    ...over,
  };
}

async function main() {
  {
    const g = validateProdCfSchedulerEnv(resolveProdCfSchedulerConfig(prodEnv()));
    assert.equal(g.ok, true);
    pass("A_validate_production_ok");
  }

  {
    const g = validateProdCfSchedulerEnv(
      resolveProdCfSchedulerConfig(prodEnv({ ANPI_ENVIRONMENT: "staging" }))
    );
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_env_not_production");
    pass("B_reject_staging_env");
  }

  {
    const g = validateProdCfSchedulerEnv(
      resolveProdCfSchedulerConfig(
        prodEnv({ ANPI_PRODUCTION_PROJECT_REF: STAGING_SUPABASE_REF })
      )
    );
    assert.equal(g.ok, false);
    pass("C_reject_staging_ref");
  }

  {
    const g = validateProdCfSchedulerEnv(
      resolveProdCfSchedulerConfig(prodEnv({ ANPI_ALLOW_LEGACY_CLAIM: "true" }))
    );
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_prod_legacy_claim_forbidden");
    pass("D_reject_legacy_claim");
  }

  {
    const g = validateProdCfSchedulerEnv(
      resolveProdCfSchedulerConfig(
        prodEnv({
          ANPI_PRODUCTION_SUPABASE_URL: `https://${STAGING_SUPABASE_REF}.supabase.co`,
        })
      )
    );
    assert.equal(g.ok, false);
    pass("E_reject_staging_url");
  }

  {
    const g = validateProdCfSchedulerEnv(
      resolveProdCfSchedulerConfig(prodEnv({ ANPI_PRODUCTION_RUNTIME_ENABLED: "false" }))
    );
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_scheduler_disabled");
    pass("F_disabled_is_fail_closed");
  }

  {
    const id = buildProdCfExecutionId(Date.now());
    assert.match(id, /^cf-anpi-prod-/);
    assert.doesNotMatch(id, /staging/);
    pass("G_execution_id_prod_prefix");
  }

  {
    const log = buildProdCfSchedulerLog({
      executionId: "cf-anpi-prod-x",
      trigger: "cloudflare_cron",
      scheduledTime: new Date().toISOString(),
      cron: "*/5 * * * *",
      projectRef: PRODUCTION_SUPABASE_REF,
      provider: "talk_local",
      status: "SKIPPED",
      lease: null,
      summary: null,
      errorCode: null,
    });
    assert.equal(log.environment, "production");
    assert.equal(log.project_ref, PRODUCTION_SUPABASE_REF);
    pass("H_log_environment_production");
  }

  {
    const tick = await runAnpiProdCfScheduledTick({
      env: prodEnv({ ANPI_PRODUCTION_RUNTIME_ENABLED: "false" }),
      trigger: "diagnostic",
    });
    assert.equal(tick.ok, false);
    assert.equal(tick.errorCode, "anpi_cf_scheduler_disabled");
    pass("I_tick_paused_no_runtime_call");
  }

  {
    const mode = resolveClaimMode({
      ANPI_ENVIRONMENT: "production",
      ANPI_PRODUCTION_RUNTIME_ENABLED: "true",
      ANPI_P62_SCOPED_CRON_PATH: "false",
      ANPI_ALLOW_LEGACY_CLAIM: "false",
    });
    assert.equal(mode, "none");
    pass("J_prod_flag_off_is_none_not_legacy");
  }

  {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const docs = [
      path.join(root, "docs", "anpi-phase66-production-canary.md"),
      path.join(root, "sql", "anpi-phase66-production-readonly-audit.sql"),
      path.join(root, "sql", "anpi-phase66-canary-allowlist-template.sql"),
    ];
    for (const f of docs) {
      assert.ok(fs.existsSync(f), `missing ${f}`);
    }
    const ssot = fs.readFileSync(docs[0], "utf8");
    assert.match(ssot, /WAITING_HUMAN|NO-GO|STOPPED/);
    assert.match(ssot, /ddojquacsyqesrjhcvmn/);
    assert.match(ssot, /ANPI_PRODUCTION_CANARY: NOT_STARTED/);
    assert.doesNotMatch(ssot, /ANPI_PRODUCTION_CANARY:\s*PASS/);
    pass("K_docs_present_and_nogo");
  }

  console.log("ALL PASS anpi-phase66-production-canary-prep");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
