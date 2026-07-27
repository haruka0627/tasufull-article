#!/usr/bin/env node
/**
 * ANPI Phase 47 — Notification Runtime Core (local/staging one-shot)
 *
 * Example:
 *   node scripts/run-anpi-phase47-runtime-core.mjs --now 2026-07-27T00:01:00Z
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAnpiPhase47NotificationRuntimeCore } from "./lib/anpi-phase47-notification-runtime-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(root, ".env.staging.example");

function parseArgs(argv) {
  const out = {
    now: null,
    apiUrl: null,
    serviceKey: null,
    workerId: `anpi-phase47-${Date.now().toString(36)}`,
    stubMode: "success",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--now") out.now = argv[++i];
    else if (a === "--api-url") out.apiUrl = argv[++i];
    else if (a === "--service-key") out.serviceKey = argv[++i];
    else if (a === "--worker-id") out.workerId = argv[++i];
    else if (a === "--stub-mode") out.stubMode = argv[++i];
  }
  return out;
}

function readLocalSupabaseEnv() {
  // Prefer .dev.vars if present; otherwise fall back to environment variables.
  const candidates = [
    path.join(root, ".dev.vars"),
    path.join(root, ".env.local"),
    path.join(root, ".env.staging.local"),
  ];
  for (const p of candidates) {
    try {
      const txt = readFileSync(p, "utf8");
      const map = {};
      for (const line of txt.split(/\r?\n/g)) {
        const s = line.trim();
        if (!s || s.startsWith("#")) continue;
        const eq = s.indexOf("=");
        if (eq === -1) continue;
        const k = s.slice(0, eq).trim();
        const v = s.slice(eq + 1).trim();
        map[k] = v;
      }
      return {
        apiUrl: map.TASFUL_SUPABASE_URL || process.env.TASFUL_SUPABASE_URL,
        serviceKey: map.TASFUL_SUPABASE_SERVICE_ROLE_KEY || process.env.TASFUL_SUPABASE_SERVICE_ROLE_KEY,
        anonKey: map.TASFUL_SUPABASE_ANON_KEY || process.env.TASFUL_SUPABASE_ANON_KEY,
      };
    } catch {
      // ignore
    }
  }

  return {
    apiUrl: process.env.TASFUL_SUPABASE_URL,
    serviceKey: process.env.TASFUL_SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.TASFUL_SUPABASE_ANON_KEY,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.now) throw new Error("missing --now");

  const env = args.apiUrl && args.serviceKey
    ? { apiUrl: args.apiUrl, serviceKey: args.serviceKey }
    : readLocalSupabaseEnv();

  if (!env.apiUrl || !env.serviceKey) {
    // Avoid logging secrets; message should indicate missing env only.
    throw new Error("missing TASFUL_SUPABASE_URL or TASFUL_SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await runAnpiPhase47NotificationRuntimeCore({
    apiUrl: env.apiUrl,
    serviceKey: env.serviceKey,
    pNow: args.now,
    workerId: args.workerId,
    stubMode: args.stubMode,
  });

  const byKind = {};
  for (const p of res.processed || []) {
    byKind[p.kind] = (byKind[p.kind] || 0) + 1;
  }

  // Print only aggregate counts; do not print payloads.
  console.log(JSON.stringify({
    ok: true,
    now: args.now,
    processedCount: (res.processed || []).length,
    processedByKind: byKind,
    lateConfirmationCreatedCount: res.lateConfirmationCreatedCount || 0,
  }));
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});

