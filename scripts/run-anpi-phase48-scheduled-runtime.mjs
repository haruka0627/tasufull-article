#!/usr/bin/env node
/**
 * ANPI Phase 48 窶・Staging scheduled runtime CLI / CI entrypoint
 *
 * Examples:
 *   ANPI_STAGING_RUNTIME_ENABLED=true \
 *   ANPI_STAGING_PROJECT_REF=ahlxuyvhzqdqaojiywmu \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/run-anpi-phase48-scheduled-runtime.mjs
 *
 *   # Local unit harness (no-op when disabled):
 *   node scripts/run-anpi-phase48-scheduled-runtime.mjs --allow-disabled-noop --project-ref local
 *
 * Never prints secrets.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAnpiPhase48ScheduledRuntime,
  STAGING_SUPABASE_REF,
} from "./lib/anpi-phase48-scheduled-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {
    now: null,
    apiUrl: null,
    serviceKey: null,
    projectRef: null,
    enabled: null,
    workerId: `anpi-p48-${Date.now().toString(36)}`,
    stubMode: "success",
    allowDisabledNoop: false,
    summaryOut: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--now") out.now = argv[++i];
    else if (a === "--api-url") out.apiUrl = argv[++i];
    else if (a === "--service-key") out.serviceKey = argv[++i];
    else if (a === "--project-ref") out.projectRef = argv[++i];
    else if (a === "--enabled") out.enabled = argv[++i];
    else if (a === "--worker-id") out.workerId = argv[++i];
    else if (a === "--stub-mode") out.stubMode = argv[++i];
    else if (a === "--allow-disabled-noop") out.allowDisabledNoop = true;
    else if (a === "--summary-out") out.summaryOut = argv[++i];
  }
  return out;
}

function readEnvFile(filePath) {
  try {
    const txt = fs.readFileSync(filePath, "utf8");
    const map = {};
    for (const line of txt.split(/\r?\n/g)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq === -1) continue;
      map[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
    }
    return map;
  } catch {
    return {};
  }
}

function resolveConfig(args) {
  const fileEnv = {
    ...readEnvFile(path.join(root, ".env.staging")),
    ...readEnvFile(path.join(root, ".env.local")),
  };

  const apiUrl =
    args.apiUrl ||
    process.env.ANPI_STAGING_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.TASFUL_SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    fileEnv.TASFUL_SUPABASE_URL ||
    null;

  const serviceKey =
    args.serviceKey ||
    process.env.ANPI_STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TASFUL_SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.TASFUL_SUPABASE_SERVICE_ROLE_KEY ||
    null;

  const projectRef =
    args.projectRef ||
    process.env.ANPI_STAGING_PROJECT_REF ||
    process.env.SUPABASE_PROJECT_REF ||
    fileEnv.SUPABASE_PROJECT_REF ||
    STAGING_SUPABASE_REF;

  const enabled =
    args.enabled ||
    process.env.ANPI_STAGING_RUNTIME_ENABLED ||
    fileEnv.ANPI_STAGING_RUNTIME_ENABLED ||
    "";

  return { apiUrl, serviceKey, projectRef, enabled };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = resolveConfig(args);

  let summary;
  try {
    summary = await runAnpiPhase48ScheduledRuntime({
      apiUrl: cfg.apiUrl,
      serviceKey: cfg.serviceKey,
      projectRef: cfg.projectRef,
      enabled: cfg.enabled,
      pNow: args.now || new Date().toISOString(),
      workerId: args.workerId,
      stubMode: args.stubMode,
      failIfDisabled: !args.allowDisabledNoop,
      holderId: args.workerId,
    });
  } catch (e) {
    summary = e?.summary || {
      phase: 48,
      status: "FAIL",
      overall_status: "FAIL",
      reason: String(e?.message || e).slice(0, 160),
    };
    if (args.summaryOut) {
      try {
        fs.writeFileSync(args.summaryOut, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
      } catch {
        // ignore
      }
    }
    console.log(JSON.stringify(summary));
    process.exit(1);
  }

  if (args.summaryOut) {
    fs.writeFileSync(args.summaryOut, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(summary));

  if (summary.overall_status === "FAIL" || summary.status === "FAIL") {
    process.exit(1);
  }
  // SKIPPED (disabled / lease busy) is exit 0 for schedule soft-skip when allow-disabled-noop,
  // and also 0 for lease busy so overlapping GHA does not page as hard failure.
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e?.message || e).slice(0, 300));
  process.exit(1);
});
