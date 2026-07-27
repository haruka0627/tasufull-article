#!/usr/bin/env node
/**
 * ANPI Phase 62 — scoped Cron path unit tests (no network).
 */

import assert from "node:assert/strict";
import {
  isScopedCronPathEnabled,
  assertScopedCronEnv,
  ANPI_P62_SCOPED_CRON_ENV,
} from "./lib/anpi-phase62-scoped-cron-path.mjs";
import {
  resolveCfSchedulerConfig,
  validateCfSchedulerEnv,
  runAnpiCfScheduledTick,
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
    ANPI_ENVIRONMENT: "staging",
    ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
    ANPI_STAGING_RUNTIME_ENABLED: "true",
    ANPI_NOTIFICATION_PROVIDER: "talk_local",
    ANPI_STAGING_SUPABASE_URL: `https://${STAGING_SUPABASE_REF}.supabase.co`,
    ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-role-not-real",
    ANPI_P62_SCOPED_CRON_PATH: "false",
    ANPI_P61_SCOPED_WRITER_ENABLED: "false",
    ...over,
  };
}

async function main() {
  {
    assert.equal(isScopedCronPathEnabled({}), false);
    assert.equal(isScopedCronPathEnabled({ [ANPI_P62_SCOPED_CRON_ENV]: "false" }), false);
    assert.equal(isScopedCronPathEnabled({ [ANPI_P62_SCOPED_CRON_ENV]: "true" }), true);
    pass("A_flag_default_off");
  }

  {
    assert.doesNotThrow(() =>
      assertScopedCronEnv({
        ANPI_ENVIRONMENT: "staging",
        ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
        ANPI_NOTIFICATION_PROVIDER: "talk_local",
      })
    );
    assert.throws(
      () =>
        assertScopedCronEnv({
          ANPI_ENVIRONMENT: "production",
          ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
          ANPI_NOTIFICATION_PROVIDER: "talk_local",
        }),
      /not_staging/
    );
    assert.throws(
      () =>
        assertScopedCronEnv({
          ANPI_ENVIRONMENT: "staging",
          ANPI_STAGING_PROJECT_REF: PRODUCTION_SUPABASE_REF,
          ANPI_NOTIFICATION_PROVIDER: "talk_local",
        }),
      /production|not_staging/
    );
    assert.throws(
      () =>
        assertScopedCronEnv({
          ANPI_ENVIRONMENT: "staging",
          ANPI_STAGING_PROJECT_REF: STAGING_SUPABASE_REF,
          ANPI_NOTIFICATION_PROVIDER: "talk_write",
        }),
      /talk_local/
    );
    pass("B_env_fail_closed");
  }

  {
    const cfgOff = resolveCfSchedulerConfig(stagingEnv());
    assert.equal(cfgOff.scopedCronPath, "false");
    assert.equal(cfgOff.scopedWriter, "false");
    const cfgOn = resolveCfSchedulerConfig(
      stagingEnv({
        ANPI_P62_SCOPED_CRON_PATH: "true",
        ANPI_P61_SCOPED_WRITER_ENABLED: "true",
      })
    );
    assert.equal(cfgOn.scopedCronPath, "true");
    assert.equal(cfgOn.scopedWriter, "true");
    assert.equal(validateCfSchedulerEnv(cfgOn).ok, true);
    pass("C_cf_config_exposes_flags");
  }

  {
    let sawEnv = null;
    const result = await runAnpiCfScheduledTick({
      env: stagingEnv({
        ANPI_P62_SCOPED_CRON_PATH: "true",
        ANPI_P61_SCOPED_WRITER_ENABLED: "true",
      }),
      trigger: "unit",
      runRuntime: async (args) => {
        sawEnv = args.env;
        return {
          status: "PASS",
          overall_status: "PASS",
          lease: "acquired",
          jobsProcessed: 0,
          jobsFailed: 0,
          provider_validation: "SCOPED_SKIP",
          scoped_cron_path: true,
          mode: "scoped_cron",
        };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(sawEnv.ANPI_P62_SCOPED_CRON_PATH, "true");
    assert.equal(sawEnv.ANPI_P61_SCOPED_WRITER_ENABLED, "true");
    assert.equal(sawEnv.ANPI_NOTIFICATION_PROVIDER, "talk_local");
    assert.equal(result.log.scoped_cron_path, true);
    assert.equal(result.log.mode, "scoped_cron");
    pass("D_cf_tick_passes_scoped_env");
  }

  {
    let sawEnv = null;
    await runAnpiCfScheduledTick({
      env: stagingEnv(),
      trigger: "unit",
      runRuntime: async (args) => {
        sawEnv = args.env;
        return {
          status: "PASS",
          overall_status: "PASS",
          lease: "acquired",
          jobsProcessed: 0,
          jobsFailed: 0,
          provider_validation: "PASS",
          scoped_cron_path: false,
          mode: "legacy_stub",
        };
      },
    });
    assert.equal(sawEnv.ANPI_P62_SCOPED_CRON_PATH, "false");
    assert.equal(isScopedCronPathEnabled(sawEnv), false);
    pass("E_flag_off_legacy_path_env");
  }

  console.log("ALL PASS anpi-phase62-scoped-cron-path");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
