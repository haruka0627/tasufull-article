#!/usr/bin/env node
/**
 * ANPI Phase 56 — Cloudflare scheduler adapter safety tests (no network / no secrets).
 */

import assert from "node:assert/strict";
import {
  resolveCfSchedulerConfig,
  validateCfSchedulerEnv,
  buildCfExecutionId,
  buildCfSchedulerLog,
  runAnpiCfScheduledTick,
  CF_STAGING_ENV,
} from "./lib/anpi-phase56-cloudflare-scheduler-adapter.mjs";
import {
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";

function pass(name) {
  console.log(`PASS ${name}`);
}

function stagingEnv(over = {}) {
  return {
    ANPI_ENVIRONMENT: CF_STAGING_ENV,
    ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
    ANPI_STAGING_RUNTIME_ENABLED: "true",
    ANPI_NOTIFICATION_PROVIDER: "talk_local",
    ANPI_STAGING_SUPABASE_URL: `https://${STAGING_SUPABASE_REF}.supabase.co`,
    ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-role-not-real",
    ...over,
  };
}

async function main() {
  // A — resolve + validate happy path
  {
    const cfg = resolveCfSchedulerConfig(stagingEnv());
    const g = validateCfSchedulerEnv(cfg);
    assert.equal(g.ok, true);
    pass("A_validate_staging_ok");
  }

  // B — wrong environment
  {
    const g = validateCfSchedulerEnv(resolveCfSchedulerConfig(stagingEnv({ ANPI_ENVIRONMENT: "production" })));
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_env_not_staging");
    pass("B_reject_non_staging_env");
  }

  // C — wrong / production project ref
  {
    const g1 = validateCfSchedulerEnv(
      resolveCfSchedulerConfig(stagingEnv({ ANPI_STAGING_PROJECT_REF: "otherref1234567890ab" }))
    );
    assert.equal(g1.ok, false);
    const g2 = validateCfSchedulerEnv(
      resolveCfSchedulerConfig(stagingEnv({ ANPI_STAGING_PROJECT_REF: PRODUCTION_SUPABASE_REF }))
    );
    assert.equal(g2.ok, false);
    pass("C_reject_bad_project_ref");
  }

  // D — disabled scheduler
  {
    const g = validateCfSchedulerEnv(
      resolveCfSchedulerConfig(stagingEnv({ ANPI_STAGING_RUNTIME_ENABLED: "false" }))
    );
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_scheduler_disabled");
    pass("D_reject_disabled");
  }

  // E — invalid provider
  {
    const g = validateCfSchedulerEnv(
      resolveCfSchedulerConfig(stagingEnv({ ANPI_NOTIFICATION_PROVIDER: "email_external" }))
    );
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_provider_not_talk_local");
    pass("E_reject_non_talk_local_provider");
  }

  // F — production URL refused
  {
    const g = validateCfSchedulerEnv(
      resolveCfSchedulerConfig(
        stagingEnv({
          ANPI_STAGING_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
        })
      )
    );
    assert.equal(g.ok, false);
    assert.equal(g.code, "anpi_cf_refusing_production_endpoint");
    pass("F_reject_production_url");
  }

  // G — execution id shape
  {
    const id = buildCfExecutionId("2026-07-27T12:00:00.000Z");
    assert.match(id, /^cf-anpi-staging-\d+-[0-9a-f]+$/);
    pass("G_execution_id_shape");
  }

  // H — log redaction (no service key field)
  {
    const log = buildCfSchedulerLog({
      executionId: "cf-anpi-staging-1-abcd",
      trigger: "cloudflare_cron",
      scheduledTime: "2026-07-27T12:00:00.000Z",
      cron: "*/5 * * * *",
      projectRef: STAGING_SUPABASE_REF,
      provider: "talk_local",
      status: "PASS",
      lease: "acquired",
      summary: { jobsProcessed: 0, jobsFailed: 0, provider_validation: "PASS", overall_status: "PASS" },
    });
    const raw = JSON.stringify(log);
    assert.equal(log.service, "anpi-scheduler");
    assert.equal(log.platform, "cloudflare");
    assert.equal(log.environment, "staging");
    assert.ok(!raw.includes("service-role"));
    assert.ok(!raw.includes("SERVICE_ROLE"));
    assert.ok(!raw.includes("eyJ"));
    pass("H_structured_log_safe");
  }

  // I — tick stops before runtime when guard fails
  {
    let called = false;
    const result = await runAnpiCfScheduledTick({
      env: stagingEnv({ ANPI_ENVIRONMENT: "prod" }),
      trigger: "cloudflare_cron",
      scheduledTime: Date.now(),
      cron: "*/5 * * * *",
      runRuntime: async () => {
        called = true;
        return { overall_status: "PASS", status: "PASS", lease: "acquired" };
      },
    });
    assert.equal(called, false);
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "anpi_cf_env_not_staging");
    pass("I_guard_blocks_runtime");
  }

  // J — tick calls runtime when guards pass; lease busy is ok skip
  {
    let called = false;
    const result = await runAnpiCfScheduledTick({
      env: stagingEnv(),
      trigger: "cloudflare_cron",
      scheduledTime: "2026-07-27T12:05:00.000Z",
      cron: "*/5 * * * *",
      runRuntime: async (args) => {
        called = true;
        assert.equal(args.projectRef, STAGING_SUPABASE_REF);
        assert.equal(args.enabled, "true");
        assert.ok(String(args.workerId).startsWith("cf-anpi-staging-"));
        return {
          overall_status: "SKIPPED",
          status: "SKIPPED",
          lease: "busy",
          provider_validation: "skipped",
          jobsProcessed: 0,
          jobsFailed: 0,
        };
      },
    });
    assert.equal(called, true);
    assert.equal(result.ok, true);
    assert.equal(result.log.lease_acquired, false);
    assert.equal(result.log.status, "SKIPPED");
    pass("J_runtime_invoked_lease_skip_ok");
  }

  // K — runtime PASS maps to log PASS
  {
    const result = await runAnpiCfScheduledTick({
      env: stagingEnv(),
      trigger: "cloudflare_diagnostic",
      runRuntime: async () => ({
        overall_status: "PASS",
        status: "PASS",
        lease: "acquired",
        provider_validation: "PASS",
        jobsProcessed: 2,
        jobsFailed: 0,
      }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.log.status, "PASS");
    assert.equal(result.log.lease_acquired, true);
    assert.equal(result.log.processed_count, 2);
    assert.equal(result.log.trigger, "cloudflare_diagnostic");
    pass("K_runtime_pass_logging");
  }

  console.log("Phase 56 Cloudflare scheduler tests: all PASS");
}

main().catch((err) => {
  console.error("FAIL", String(err?.stack || err).slice(0, 800));
  process.exitCode = 1;
});
