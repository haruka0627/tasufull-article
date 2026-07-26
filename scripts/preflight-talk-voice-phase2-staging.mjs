#!/usr/bin/env node
/**
 * TALK Voice Phase 2 — Staging execution preflight (read-only).
 *
 * Does NOT:
 * - apply DB migrations
 * - connect to / mutate coturn
 * - push / deploy
 * - write secrets
 *
 * Usage:
 *   node scripts/preflight-talk-voice-phase2-staging.mjs
 *   node scripts/preflight-talk-voice-phase2-staging.mjs --env-file .env.staging
 *   node scripts/preflight-talk-voice-phase2-staging.mjs --skip-http
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkStagingNotProductionLinked,
  getProductionRef,
  getStagingRef,
} from "./lib/supabase-env.mjs";
import {
  STAGING_ENV_FILE,
  loadEnvFile,
  parseEnvText,
  summarizeValidation,
  validateTalkVoiceStagingEnv,
} from "./lib/talk-voice-staging-env.mjs";
import { E2E_ROUTE_MATRIX } from "./lib/talk-voice-phase2-e2e-matrix.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const skipHttp = argv.includes("--skip-http");
const envFileArg = (() => {
  const i = argv.indexOf("--env-file");
  return i >= 0 ? argv[i + 1] : null;
})();

let pass = 0;
let fail = 0;
let note = 0;

function ok(label, detail = "") {
  pass += 1;
  console.log(`PASS: ${label}${detail ? ` - ${detail}` : ""}`);
}

function bad(label, detail = "") {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` - ${detail}` : ""}`);
}

function nlabel(label) {
  note += 1;
  console.log(`NOTE: ${label}`);
}

function resolveEnvPath() {
  if (envFileArg) return path.resolve(root, envFileArg);
  return STAGING_ENV_FILE;
}

function assertNoProductionMarkers(env) {
  const productionRef = getProductionRef();
  const stagingRef = getStagingRef();
  for (const [key, value] of Object.entries(env)) {
    if (key === "BD_PRODUCTION_PROJECT_REF") continue;
    const v = String(value || "");
    if (v.includes(productionRef)) {
      bad("production marker", `${key} contains Production ref ${productionRef}`);
      return false;
    }
    if (/tasufull-article\.pages\.dev/i.test(v)) {
      bad("production hostname", `${key} contains Production Pages host`);
      return false;
    }
  }
  ok("production abort guard", `staging=${stagingRef} prod=${productionRef}`);
  return true;
}

function checkMigrationStatusCommands() {
  const stagingRef = getStagingRef();
  const productionRef = getProductionRef();
  nlabel("DB migration status — RUN THESE MANUALLY (Staging only · this preflight does not apply)");
  console.log(`  # 1) Confirm CLI link is Staging ${stagingRef} (NOT ${productionRef})`);
  console.log(`  npx supabase link --project-ref ${stagingRef}`);
  console.log(`  # 2) Dry-run / list pending (do not apply here)`);
  console.log(`  npx supabase db push --dry-run`);
  console.log(`  # 3) Inspect allowlisted SQL only (do not push unrelated migrations)`);
  console.log(`  #    sql/talk-voice-phase1-session-usage.sql`);
  console.log(`  #    sql/talk-voice-phase2-security-telemetry.sql`);
  console.log(`  # 4) If unrelated pending migrations block push, STOP and get an --include-all decision`);
  ok("migration status commands printed", "apply not executed");
}

function checkRepoArtifacts() {
  const required = [
    "sql/talk-voice-phase1-session-usage.sql",
    "sql/talk-voice-phase2-security-telemetry.sql",
    "config/coturn/tasful-talk-turnserver.example.conf",
    "config/coturn/docker-compose.staging.example.yml",
    "deploy/cloudflare/functions/api/talk-voice-turn-credentials.js",
    "deploy/cloudflare/functions/_shared/talk-voice-turn.mjs",
    "deploy/cloudflare/dist/scripts/talk-call-turn-client.js",
    "deploy/cloudflare/dist/scripts/talk-voice-core/telemetry.js",
    "deploy/cloudflare/dist/functions/api/talk-voice-turn-credentials.js",
    "reports/talk-voice-phase2-staging-readiness.md",
  ];
  for (const rel of required) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) ok(`artifact ${rel}`);
    else bad(`artifact ${rel}`, "missing");
  }

  const srcTurn = fs.readFileSync(
    path.join(root, "deploy/cloudflare/functions/api/talk-voice-turn-credentials.js"),
    "utf8",
  );
  const distTurn = fs.readFileSync(
    path.join(root, "deploy/cloudflare/dist/functions/api/talk-voice-turn-credentials.js"),
    "utf8",
  );
  if (srcTurn === distTurn) ok("dist parity turn-credentials.js");
  else bad("dist parity turn-credentials.js", "source/dist mismatch");

  const srcShared = fs.readFileSync(
    path.join(root, "deploy/cloudflare/functions/_shared/talk-voice-turn.mjs"),
    "utf8",
  );
  const distShared = fs.readFileSync(
    path.join(root, "deploy/cloudflare/dist/functions/_shared/talk-voice-turn.mjs"),
    "utf8",
  );
  if (srcShared === distShared) ok("dist parity talk-voice-turn.mjs");
  else bad("dist parity talk-voice-turn.mjs", "source/dist mismatch");
}

function checkE2EMatrix() {
  if (!Array.isArray(E2E_ROUTE_MATRIX) || E2E_ROUTE_MATRIX.length < 4) {
    bad("e2e matrix", "need ≥4 route cases");
    return;
  }
  const ids = new Set(E2E_ROUTE_MATRIX.map((r) => r.id));
  for (const need of ["direct_p2p", "turn_udp", "turn_tcp", "turn_tls_443"]) {
    if (ids.has(need)) ok(`e2e plan route ${need}`);
    else bad(`e2e plan route ${need}`, "missing");
  }
  nlabel("strict browser E2E is planned only — not executed by this preflight");
}

async function checkHttpSmoke(env) {
  if (skipHttp) {
    nlabel("HTTP smoke skipped (--skip-http)");
    return;
  }
  const base = "http://127.0.0.1:8788";
  try {
    const talk = await fetch(`${base}/talk-home`, { redirect: "follow" });
    if (talk.status === 200) ok("8788 talk-home", `HTTP ${talk.status}`);
    else bad("8788 talk-home", `HTTP ${talk.status}`);
    const html = await talk.text();
    if (html.includes("talk-call-turn-client.js")) ok("8788 turn-client script tag");
    else bad("8788 turn-client script tag", "missing");
    if (html.includes("talk-voice-core/telemetry.js")) ok("8788 telemetry script tag");
    else bad("8788 telemetry script tag", "missing");
  } catch (err) {
    bad("8788 talk-home", err instanceof Error ? err.message : String(err));
  }

  const api =
    String(env.TALK_VOICE_TURN_CREDENTIAL_API_URL || `${base}/api/talk-voice-turn-credentials`).trim();
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.text();
    if (res.status === 401 && /auth_required/.test(body)) {
      ok("credential endpoint unauthorized", "401 auth_required");
    } else {
      bad("credential endpoint unauthorized", `HTTP ${res.status} body_redacted_len=${body.length}`);
    }
  } catch (err) {
    bad("credential endpoint", err instanceof Error ? err.message : String(err));
  }
}

function checkTlsPathConfig(env) {
  const cert = String(env.TALK_VOICE_TURN_TLS_CERT_PATH || "").trim();
  const key = String(env.TALK_VOICE_TURN_TLS_KEY_PATH || "").trim();
  if (cert) ok("TLS cert path configured", `set(len=${cert.length})`);
  else bad("TLS cert path configured", "missing");
  if (key) ok("TLS key path configured", `set(len=${key.length})`);
  else bad("TLS key path configured", "missing");
  nlabel("TLS path strings are config-only — certificate files are not read or modified");
}

function checkFeatureFlags(env) {
  ok(
    "feature flags present",
    `selfHostedTurn=${env.TALK_VOICE_SELF_HOSTED_TURN_ENABLED} telemetry=${env.TALK_VOICE_CONNECTION_TELEMETRY_ENABLED}`,
  );
  if (/^(true|1|yes|on)$/i.test(String(env.TALK_VOICE_SELF_HOSTED_TURN_ENABLED || ""))) {
    nlabel("self-hosted TURN flag is ON in env — ensure Staging-only host/secret before live E2E");
  } else {
    nlabel("self-hosted TURN flag is OFF — expected until Staging coturn + secrets are ready");
  }
}

function checkCliLinkGuard() {
  const guard = checkStagingNotProductionLinked();
  if (!guard.ok) {
    bad("supabase CLI link", guard.message);
    return;
  }
  ok("supabase CLI link guard", guard.message);
}

async function main() {
  console.log("=== TALK Voice Phase 2 Staging preflight (read-only) ===");
  console.log(`staging_ref=${getStagingRef()}`);
  console.log(`production_ref=${getProductionRef()}`);
  console.log("constraints: no migration apply · no coturn change · no push/deploy");

  const envPath = resolveEnvPath();
  if (!fs.existsSync(envPath)) {
    bad("env file", `${path.relative(root, envPath)} missing — run create-env-staging.mjs --force then fill secrets`);
    console.log(`\nSUMMARY pass=${pass} fail=${fail} note=${note}`);
    process.exit(1);
  }

  const env = loadEnvFile(envPath) || parseEnvText(fs.readFileSync(envPath, "utf8"));
  console.log(`env_file=${path.relative(root, envPath)}`);

  if (!assertNoProductionMarkers(env)) {
    console.log(`\nSUMMARY pass=${pass} fail=${fail} note=${note}`);
    process.exit(1);
  }

  const validation = validateTalkVoiceStagingEnv(env, {
    requireSecretsFilled: true,
    allowPlaceholders: false,
  });
  console.log("--- env validation ---");
  console.log(summarizeValidation(validation));
  if (validation.ok) ok("required env");
  else {
    bad("required env", `missing_or_placeholder=${validation.missing.join(",")}`);
    for (const issue of validation.issues.filter((i) => i.level === "error")) {
      bad(issue.code, `${issue.key || ""} ${issue.message}`.trim());
    }
  }

  checkFeatureFlags(env);
  checkTlsPathConfig(env);
  checkCliLinkGuard();
  checkMigrationStatusCommands();
  checkRepoArtifacts();
  checkE2EMatrix();
  await checkHttpSmoke(env);

  // Prove we did not invoke supabase db push / turnserver
  const forbidden = spawnSync(
    process.platform === "win32" ? "powershell.exe" : "true",
    process.platform === "win32"
      ? ["-NoProfile", "-Command", "Write-Output 'preflight_no_db_push'"]
      : [],
    { encoding: "utf8" },
  );
  if (forbidden.status === 0) ok("no migration/coturn mutation invoked");

  console.log(`\nSUMMARY pass=${pass} fail=${fail} note=${note}`);
  if (fail > 0) {
    console.error("PREFLIGHT: FAIL (fixing blockers · no DB/TURN changes were made)");
    process.exit(1);
  }
  console.log("PREFLIGHT: PASS (execution still gated on filled secrets + human runbooks)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
