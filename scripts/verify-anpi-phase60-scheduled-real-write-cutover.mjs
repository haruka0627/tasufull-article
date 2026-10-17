#!/usr/bin/env node
/**
 * ANPI Phase 60 — Staging verify (assessment + live Cron soak evidence).
 * Does NOT flip provider. Does NOT enable real inbox writes via Cron.
 * Secrets never printed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessScheduledRealWriteCutoverReadiness } from "./lib/anpi-phase60-scheduled-real-write-cutover-readiness.mjs";
import { STAGING_SUPABASE_REF, PRODUCTION_SUPABASE_REF } from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_ENV = "C:/Users/rubih/tasufull-article/.env.staging";
const EVIDENCE = path.join(
  root,
  "reports",
  "anpi-phase60-scheduled-real-write-cutover-evidence.json"
);

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

function extractRef(apiUrl) {
  try {
    const host = new URL(String(apiUrl || "")).hostname || "";
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

async function rpc(apiUrl, serviceKey, name, args = {}) {
  const res = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

async function rest(apiUrl, serviceKey, pathQuery) {
  const res = await fetch(`${apiUrl}${pathQuery}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const fileEnv = { ...readEnvFile(path.join(root, ".env.staging")), ...readEnvFile(MAIN_ENV) };
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
  const envRef = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF || "";

  const assessment = assessScheduledRealWriteCutoverReadiness();
  const live = {
    project_ref: extractRef(apiUrl),
    env_ref: envRef,
    staging_ref_match: null,
    production_refused: extractRef(apiUrl) !== PRODUCTION_SUPABASE_REF,
    phase10_health: null,
    phase17_flag_off: null,
    recent_lease_rows: null,
    recent_delivery_providers: null,
    provider_validation_talk_local_only: null,
    anpi_phase17_test_markers: null,
  };

  if (!apiUrl || !serviceKey) {
    assessment.live = { ...live, error: "missing_staging_credentials" };
    assessment.verdict = "NOT_READY_NO_GO";
    fs.writeFileSync(EVIDENCE, JSON.stringify(assessment, null, 2), "utf8");
    console.error("FAIL missing staging credentials");
    process.exitCode = 1;
    return;
  }

  if (live.project_ref !== STAGING_SUPABASE_REF || (envRef && envRef !== STAGING_SUPABASE_REF)) {
    assessment.live = { ...live, error: "unexpected_project_ref" };
    fs.writeFileSync(EVIDENCE, JSON.stringify(assessment, null, 2), "utf8");
    console.error("FAIL unexpected project ref");
    process.exitCode = 1;
    return;
  }
  live.staging_ref_match = true;

  const health = await rpc(apiUrl, serviceKey, "anpi_phase10_talk_write_health");
  const h = Array.isArray(health.json) ? health.json[0] : health.json;
  live.phase10_health = {
    ok: health.ok && h?.ok === true,
    real_mode_enabled: h?.real_mode_enabled,
    production_send: h?.production_send,
    staging_send: h?.staging_send,
    user_facing_inbox_write: h?.user_facing_inbox_write,
  };

  const gate = await rest(
    apiUrl,
    serviceKey,
    "/rest/v1/anpi_phase17_insert_gate?id=eq.1&select=enabled,inserted_count,idempotency_key"
  );
  const g = Array.isArray(gate.json) ? gate.json[0] : null;
  live.phase17_flag_off = g?.enabled === false;

  // Recent Phase 48 lease / run rows (provider validation context)
  const runs = await rest(
    apiUrl,
    serviceKey,
    "/rest/v1/anpi_scheduler_runs?select=id,worker_id,error_safe,created_at&worker_id=like.anpi-p48-lease:cf-staging-*&order=created_at.desc&limit=5"
  );
  live.recent_lease_rows = {
    ok: runs.ok,
    count: Array.isArray(runs.json) ? runs.json.length : 0,
    sample: Array.isArray(runs.json)
      ? runs.json.map((r) => ({
          worker_id_prefix: String(r.worker_id || "").slice(0, 40),
          error_safe: r.error_safe,
          created_at: r.created_at,
        }))
      : [],
  };

  // Recent delivery providers must remain talk_local*
  const deliveries = await rest(
    apiUrl,
    serviceKey,
    "/rest/v1/anpi_notification_deliveries?select=provider,status,created_at&order=created_at.desc&limit=20"
  );
  const drows = Array.isArray(deliveries.json) ? deliveries.json : [];
  const providers = [...new Set(drows.map((d) => String(d.provider || "")).filter(Boolean))];
  const nonLocal = providers.filter((p) => !p.startsWith("talk_local"));
  live.recent_delivery_providers = {
    ok: deliveries.ok,
    providers,
    non_talk_local: nonLocal,
    talk_local_only: nonLocal.length === 0,
  };
  live.provider_validation_talk_local_only = nonLocal.length === 0;

  const markers = await rest(
    apiUrl,
    serviceKey,
    "/rest/v1/talk_notifications?select=id&source=eq.anpi_phase17_test&limit=5"
  );
  live.anpi_phase17_test_markers = {
    count: Array.isArray(markers.json) ? markers.json.length : null,
    clean: Array.isArray(markers.json) && markers.json.length === 0,
  };

  assessment.live = live;
  assessment.cutover_performed = false;
  assessment.cron_real_write_executions = 0;
  assessment.real_insert_count_via_cron = 0;
  assessment.rollback_to_stub = "not_required_still_on_talk_local";

  const liveOk =
    live.staging_ref_match &&
    live.production_refused &&
    live.phase10_health?.real_mode_enabled === false &&
    live.phase17_flag_off === true &&
    live.provider_validation_talk_local_only === true &&
    live.anpi_phase17_test_markers?.clean === true &&
    assessment.guard_matrix_ok === true;

  // Success criterion for Phase 60: correctly conclude NOT READY and prove Cron still stub-only.
  assessment.assessment_pass = liveOk && assessment.verdict === "NOT_READY_NO_GO";
  assessment.finished_at = new Date().toISOString();

  fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
  fs.writeFileSync(EVIDENCE, JSON.stringify(assessment, null, 2), "utf8");
  console.log(JSON.stringify(assessment, null, 2));

  if (!assessment.assessment_pass) {
    console.error("FAIL Phase 60 cutover readiness assessment");
    process.exitCode = 1;
    return;
  }
  console.log("PASS Phase 60: cutover NOT READY (NO-GO) — Cron remains talk_local*");
}

main().catch((err) => {
  console.error("FAIL", String(err?.message || err).slice(0, 400));
  process.exitCode = 1;
});
