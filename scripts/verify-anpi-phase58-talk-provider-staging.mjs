#!/usr/bin/env node
/**
 * ANPI Phase 58 — Staging talk provider readiness probe.
 * Calls anpi_phase10_talk_write_health + real-mode hard-disable check.
 * Never enables real inbox writes. Never prints secrets.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeTalkProviderReadiness } from "./lib/anpi-phase58-talk-provider-readiness.mjs";
import { STAGING_SUPABASE_REF } from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_DIRTY_ENV = "C:/Users/rubih/tasufull-article/.env.staging";

function readEnvFile(filePath) {
  try {
    const map = {};
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 1) continue;
      map[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
    }
    return map;
  } catch {
    return {};
  }
}

async function main() {
  const fileEnv = {
    ...readEnvFile(path.join(root, ".env.staging")),
    ...readEnvFile(MAIN_DIRTY_ENV),
  };
  const apiUrl =
    process.env.ANPI_STAGING_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    fileEnv.TASFUL_SUPABASE_URL;
  const serviceKey =
    process.env.ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.TASFUL_SUPABASE_SERVICE_ROLE_KEY;

  if (!apiUrl || !serviceKey) {
    console.error("FAIL missing staging credentials");
    process.exitCode = 1;
    return;
  }

  const result = await probeTalkProviderReadiness({ apiUrl, serviceKey });
  const safe = {
    project_ref: result.project_ref,
    expected_ref: STAGING_SUPABASE_REF,
    foundation_ok: result.foundation_ok,
    design_ready: result.design_ready,
    staging_real_send_ready: result.staging_real_send_ready,
    production_real_send_ready: result.production_real_send_ready,
    canonical_path: result.canonical_path,
    official_room_id: result.official_room_id,
    target_url_policy: result.target_url_policy,
    periodic_runtime_provider: result.periodic_runtime_provider,
    real_mode_probe: result.real_mode_probe,
    findings: result.findings,
    templates: result.templates,
    kinds: result.kinds,
    contracts: result.contracts.map((c) => ({
      kind: c.kind,
      template_key: c.template_key,
      contract_ok: c.contract_ok,
    })),
    probed_at: result.probed_at,
  };
  console.log(JSON.stringify(safe, null, 2));

  if (!result.foundation_ok || !result.design_ready) {
    console.error("FAIL Phase 58 provider foundation not ready");
    process.exitCode = 1;
    return;
  }
  if (result.staging_real_send_ready || result.production_real_send_ready) {
    console.error("FAIL unexpected real-send ready flags");
    process.exitCode = 1;
    return;
  }
  console.log("PASS Phase 58 staging talk provider readiness (design foundation)");
}

main().catch((err) => {
  console.error("FAIL", String(err?.message || err).slice(0, 400));
  process.exitCode = 1;
});
