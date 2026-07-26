#!/usr/bin/env node
/**
 * Create / validate gitignored .env.staging from .env.staging.example.
 *
 * Usage:
 *   node scripts/lib/create-env-staging.mjs --help
 *   node scripts/lib/create-env-staging.mjs --dry-run
 *   node scripts/lib/create-env-staging.mjs --validate-only
 *   node scripts/lib/create-env-staging.mjs --force [--fetch-keys]
 *
 * Safety:
 * - Never prints secret values (TURN shared secret, service_role, anon, passwords)
 * - Refuses Production refs / hosts
 * - Overwrite requires --force
 * - Generated .env.staging is gitignored
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getStagingRef, getProductionRef } from "./supabase-env.mjs";
import {
  STAGING_ENV_EXAMPLE,
  STAGING_ENV_FILE,
  isSecretKey,
  listEnvMatrix,
  loadEnvFile,
  parseEnvText,
  redactValue,
  summarizeValidation,
  validateTalkVoiceStagingEnv,
} from "./talk-voice-staging-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = new Set(process.argv.slice(2));

function printHelp() {
  console.log(`create-env-staging.mjs — Staging .env helper (TALK Voice Phase 2)

Flags:
  --help             Show this help
  --dry-run          Show planned write (secrets redacted) · no file write
  --validate-only    Validate existing .env.staging · no write
  --force            Required to overwrite an existing .env.staging
  --fetch-keys       Optionally fill Staging anon/service_role via supabase CLI
  --allow-placeholders  Treat example placeholders as OK for structural dry-run

Environment matrix (required/optional):`);
  for (const row of listEnvMatrix()) {
    console.log(
      `  ${row.required ? "REQUIRED" : "OPTIONAL "}  ${row.key}${row.secret ? "  [secret]" : ""}  — ${row.description}`,
    );
  }
  console.log(`
Target: ${path.relative(root, STAGING_ENV_FILE)} (gitignored)
Example: ${path.relative(root, STAGING_ENV_EXAMPLE)}
Staging ref: ${getStagingRef()}
Production ref (rejected as target): ${getProductionRef()}
`);
}

function fetchStagingApiKeys(stagingRef) {
  const productionRef = getProductionRef();
  if (stagingRef === productionRef) {
    throw new Error("refuses to fetch keys for Production project ref");
  }
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "projects", "api-keys", "--project-ref", stagingRef],
    { encoding: "utf8", cwd: root, shell: process.platform === "win32" },
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (out.toLowerCase().includes(productionRef) && !out.includes(stagingRef)) {
    throw new Error("CLI output did not clearly target Staging — abort");
  }
  const anon = out.match(/anon\s+\|\s+(eyJ[^\s]+)/)?.[1] || "";
  const service = out.match(/service_role\s+\|\s+(eyJ[^\s]+)/)?.[1] || "";
  if (!anon || !service) {
    throw new Error(`Failed to fetch Staging API keys for ref ${stagingRef} (values not printed)`);
  }
  return { anon, service };
}

function applyFetchedKeys(lines, anon, service) {
  return lines.map((line) => {
    if (line.startsWith("SUPABASE_ANON_KEY=")) return `SUPABASE_ANON_KEY=${anon}`;
    if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) return `SUPABASE_SERVICE_ROLE_KEY=${service}`;
    if (line.startsWith("TASFUL_SUPABASE_ANON_KEY=")) return `TASFUL_SUPABASE_ANON_KEY=${anon}`;
    return line;
  });
}

function printRedactedPreview(map) {
  const keys = Object.keys(map).sort();
  for (const key of keys) {
    console.log(`${key}=${redactValue(key, map[key])}`);
  }
}

function main() {
  if (argv.has("--help") || argv.has("-h")) {
    printHelp();
    process.exit(0);
  }

  const dryRun = argv.has("--dry-run");
  const validateOnly = argv.has("--validate-only");
  const force = argv.has("--force");
  const fetchKeys = argv.has("--fetch-keys");
  const allowPlaceholders = argv.has("--allow-placeholders");

  if (validateOnly) {
    const existing = loadEnvFile(STAGING_ENV_FILE);
    if (!existing) {
      console.error(`FAIL: ${path.relative(root, STAGING_ENV_FILE)} not found`);
      console.error("missing_or_placeholder=(all required — run --dry-run / --force first)");
      process.exit(1);
    }
    const result = validateTalkVoiceStagingEnv(existing, {
      requireSecretsFilled: true,
      allowPlaceholders: false,
    });
    console.log(summarizeValidation(result));
    if (!result.ok) {
      console.error("VALIDATE_ONLY: FAIL (secret values not shown)");
      process.exit(1);
    }
    console.log("VALIDATE_ONLY: PASS");
    process.exit(0);
  }

  if (!fs.existsSync(STAGING_ENV_EXAMPLE)) {
    console.error(`Missing template: ${STAGING_ENV_EXAMPLE}`);
    process.exit(1);
  }

  const stagingRef = getStagingRef();
  let lines = fs.readFileSync(STAGING_ENV_EXAMPLE, "utf8").split(/\r?\n/);
  let fetched = false;

  if (fetchKeys) {
    try {
      const { anon, service } = fetchStagingApiKeys(stagingRef);
      lines = applyFetchedKeys(lines, anon, service);
      fetched = true;
      console.log(`fetch-keys: Staging anon/service_role filled for ref=${stagingRef} (values not printed)`);
    } catch (err) {
      console.error(`fetch-keys failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  const text = `${lines.join("\n").replace(/\n+$/, "")}\n`;
  const map = parseEnvText(text);

  if (containsProductionInMap(map)) {
    console.error("FAIL: template/output contains Production host or ref — abort");
    process.exit(1);
  }

  const structural = validateTalkVoiceStagingEnv(map, {
    requireSecretsFilled: false,
    allowPlaceholders: true,
  });
  // For dry-run of empty template, report missing secrets as expected NOTES.
  const missingSecrets = structural.missing.filter((k) => isSecretKey(k) || k === "TALK_VOICE_TURN_HOST" || k === "TALK_VOICE_TURN_REALM");

  console.log(`target=${path.relative(root, STAGING_ENV_FILE)}`);
  console.log(`staging_ref=${stagingRef}`);
  console.log(`fetch_keys=${fetched}`);
  console.log("--- redacted preview ---");
  printRedactedPreview(map);
  console.log("--- validation (placeholders allowed for structural template) ---");
  const soft = validateTalkVoiceStagingEnv(map, {
    requireSecretsFilled: false,
    allowPlaceholders: allowPlaceholders || dryRun || !fetched,
  });
  console.log(summarizeValidation(soft));
  if (missingSecrets.length) {
    console.log(`NOTE: fill before Staging execution (values not shown): ${missingSecrets.join(",")}`);
  }

  if (dryRun) {
    console.log("DRY_RUN: no file written");
    process.exit(0);
  }

  if (fs.existsSync(STAGING_ENV_FILE) && !force) {
    console.error(`FAIL: ${path.relative(root, STAGING_ENV_FILE)} exists — pass --force to overwrite`);
    process.exit(1);
  }

  fs.writeFileSync(STAGING_ENV_FILE, text, "utf8");
  console.log(`WROTE ${path.relative(root, STAGING_ENV_FILE)} (gitignored · secrets not logged)`);

  const after = loadEnvFile(STAGING_ENV_FILE);
  const hard = validateTalkVoiceStagingEnv(after || {}, {
    requireSecretsFilled: true,
    allowPlaceholders: false,
  });
  if (!hard.ok) {
    console.log("POST_WRITE: incomplete — fill missing required secrets locally, then --validate-only");
    console.log(`missing_or_placeholder=${hard.missing.join(",")}`);
    process.exit(0);
  }
  console.log("POST_WRITE: validation PASS");
  process.exit(0);
}

function containsProductionInMap(map) {
  const productionRef = getProductionRef();
  for (const [key, value] of Object.entries(map)) {
    if (key === "BD_PRODUCTION_PROJECT_REF") continue;
    const v = String(value || "");
    if (v.includes(productionRef) && !key.includes("PRODUCTION")) return true;
    if (/tasufull-article\.pages\.dev/i.test(v)) return true;
  }
  return false;
}

main();
