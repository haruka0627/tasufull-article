#!/usr/bin/env node
/**
 * ANPI Phase 57 — Cloudflare Cron continuity check (staging).
 *
 * Reads recent anpi_scheduler_runs lease rows for cf-staging holders.
 * Never prints secrets. Uses .env.staging or env vars.
 *
 * Exit 0 when ≥2 successful lease cycles found in the lookback window.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STAGING_SUPABASE_REF, PRODUCTION_SUPABASE_REF } from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOOKBACK_MS = 45 * 60 * 1000;
const MIN_PASS = 2;

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

function resolveConfig() {
  const fileEnv = {
    ...readEnvFile(path.join(root, ".env.staging")),
    ...readEnvFile(path.join(root, ".env.local")),
  };
  const apiUrl =
    process.env.ANPI_STAGING_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    fileEnv.TASFUL_SUPABASE_URL ||
    null;
  const serviceKey =
    process.env.ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.TASFUL_SUPABASE_SERVICE_ROLE_KEY ||
    null;
  return { apiUrl, serviceKey };
}

async function main() {
  const { apiUrl, serviceKey } = resolveConfig();
  if (!apiUrl || !serviceKey) {
    console.error("FAIL missing staging SUPABASE_URL / SERVICE_ROLE_KEY");
    process.exitCode = 1;
    return;
  }
  if (apiUrl.includes(PRODUCTION_SUPABASE_REF)) {
    console.error("FAIL refusing Production endpoint");
    process.exitCode = 1;
    return;
  }
  if (!apiUrl.includes(STAGING_SUPABASE_REF)) {
    console.error("FAIL unexpected project host (staging ref required)");
    process.exitCode = 1;
    return;
  }

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const q =
    `anpi_scheduler_runs?started_at=gte.${encodeURIComponent(since)}` +
    `&worker_id=like.anpi-p48-lease:cf-staging-*` +
    `&select=id,worker_id,started_at,finished_at,error_safe&order=started_at.asc&limit=50`;
  const res = await fetch(`${apiUrl}/rest/v1/${q}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  const text = await res.text();
  let rows = [];
  try {
    rows = text ? JSON.parse(text) : [];
  } catch {
    rows = [];
  }
  if (!res.ok) {
    console.error("FAIL lease query", String(text).slice(0, 200));
    process.exitCode = 1;
    return;
  }

  const okRows = (Array.isArray(rows) ? rows : []).filter(
    (r) => r.finished_at && (r.error_safe == null || r.error_safe === "")
  );

  const summary = {
    lookback_minutes: LOOKBACK_MS / 60000,
    since,
    project_ref: STAGING_SUPABASE_REF,
    lease_rows: okRows.length,
    min_required: MIN_PASS,
    samples: okRows.slice(-5).map((r) => ({
      started_at: r.started_at,
      finished_at: r.finished_at,
      worker_id: String(r.worker_id || "").slice(0, 80),
    })),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (okRows.length < MIN_PASS) {
    console.error(`FAIL need ≥${MIN_PASS} successful cf-staging leases in lookback`);
    process.exitCode = 1;
    return;
  }
  console.log("PASS Phase 57 Cloudflare Cron continuity");
}

main().catch((err) => {
  console.error("FAIL", String(err?.message || err).slice(0, 300));
  process.exitCode = 1;
});
