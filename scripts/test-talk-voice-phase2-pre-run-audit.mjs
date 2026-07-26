#!/usr/bin/env node
/**
 * TALK Voice Phase 2 — Staging pre-run audit checks (side-effect free).
 * No DB apply · no coturn mutation · no push/deploy · no secret output.
 *
 *   node scripts/test-talk-voice-phase2-pre-run-audit.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getProductionRef, getStagingRef } from "./lib/supabase-env.mjs";
import {
  isPlaceholder,
  validateTalkVoiceStagingEnv,
} from "./lib/talk-voice-staging-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingRef = getStagingRef();
const productionRef = getProductionRef();
const AUDIT = path.join(root, "reports", "talk-voice-phase2-staging-pre-run-audit.md");

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const REQUIRED_SECTIONS = [
  "Executive verdict",
  "Git baseline",
  "Preparation artifact audit",
  "Environment readiness",
  "Secret readiness",
  "Migration readiness",
  "coturn readiness",
  "TLS 443 readiness",
  "Distributed rate-limit readiness",
  "Browser E2E readiness",
  "Execution sequence",
  "Human approval gates",
  "Blocking issues",
  "Non-blocking issues",
  "Exact next action",
  "Commands intentionally NOT executed",
  "Safety confirmation",
];

check("audit report exists", () => {
  assert.ok(fs.existsSync(AUDIT), "pre-run audit report missing");
});

check("audit report has all 17 required sections", () => {
  const text = fs.readFileSync(AUDIT, "utf8");
  for (const s of REQUIRED_SECTIONS) {
    assert.ok(text.includes(s), `missing section: ${s}`);
  }
});

check("audit report contains no secret-like values", () => {
  const text = fs.readFileSync(AUDIT, "utf8");
  assert.doesNotMatch(text, /eyJ[a-zA-Z0-9_-]{20,}/, "JWT-like token present");
  assert.doesNotMatch(text, /sk_live_[A-Za-z0-9]+/, "Stripe live key present");
  assert.doesNotMatch(text, /whsec_[A-Za-z0-9]{16,}/, "webhook secret present");
  assert.doesNotMatch(text, /-----BEGIN[^-]*PRIVATE KEY-----/, "private key present");
  // secret env keys must appear only as names/status, never as `KEY=<value>`
  assert.doesNotMatch(text, /TALK_VOICE_TURN_SHARED_SECRET=\S+/, "shared secret value present");
});

check("audit report enumerates execution gates A..M", () => {
  const text = fs.readFileSync(AUDIT, "utf8");
  for (const g of ["A. Secrets prep", "E. Migration apply", "H. coturn config apply", "K. Browser E2E", "M. Staging release verdict"]) {
    assert.ok(text.includes(g), `missing gate: ${g}`);
  }
});

check("audit report lists mandatory STOP gates", () => {
  const text = fs.readFileSync(AUDIT, "utf8");
  for (const g of [
    "Production ref detected",
    "Secret missing or placeholder",
    "Unrelated pending migration undecided",
    "Credential API fails open",
    "cannot confirm a relay candidate",
  ]) {
    assert.ok(text.toLowerCase().includes(g.toLowerCase()), `missing stop gate: ${g}`);
  }
});

check("audit report records not-executed commands", () => {
  const text = fs.readFileSync(AUDIT, "utf8");
  for (const c of ["git push", "supabase db push", "coturn", "git commit"]) {
    assert.ok(text.includes(c), `missing not-executed command: ${c}`);
  }
});

check("audit report documents SQL-not-migration mechanics", () => {
  const text = fs.readFileSync(AUDIT, "utf8");
  assert.ok(/not.*registered.*migration|not applied by `supabase db push`/i.test(text));
});

check("production ref rejected by validator", () => {
  const env = baseEnv({ SUPABASE_PROJECT_REF: productionRef });
  const r = validateTalkVoiceStagingEnv(env);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.code === "production_ref" || i.code === "wrong_project_ref"));
});

check("production origin rejected by validator", () => {
  const env = baseEnv({
    TALK_VOICE_STAGING_ALLOWED_ORIGINS: "https://tasufull-article.pages.dev,http://127.0.0.1:8788",
  });
  const r = validateTalkVoiceStagingEnv(env);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.code === "production_origin" || i.code === "production_value"));
});

check("placeholder detection works", () => {
  assert.equal(isPlaceholder(""), true);
  assert.equal(isPlaceholder("REPLACE_WITH_PUBLIC_IP"), true);
  assert.equal(isPlaceholder("turn.staging.tasful.example.invalid"), true);
  assert.equal(isPlaceholder("turn.staging.example.test"), false);
});

check(".env.staging is gitignored and untracked", () => {
  const ignore = spawnSync("git", ["check-ignore", ".env.staging"], { cwd: root, encoding: "utf8" });
  assert.equal(ignore.status, 0, ".env.staging not gitignored");
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", ".env.staging"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(tracked.status, 0, ".env.staging is git-tracked");
});

check("preflight script contains no executed migration/coturn/push commands", () => {
  const text = fs.readFileSync(path.join(root, "scripts/preflight-talk-voice-phase2-staging.mjs"), "utf8");
  // spawnSync usage must not invoke supabase/turnserver/git push
  assert.doesNotMatch(text, /spawnSync\([^)]*supabase/);
  assert.doesNotMatch(text, /spawnSync\([^)]*turnserver/);
  assert.doesNotMatch(text, /spawnSync\([^)]*git[^)]*push/);
});

function baseEnv(overrides = {}) {
  return {
    SUPABASE_PROJECT_REF: stagingRef,
    SUPABASE_URL: `https://${stagingRef}.supabase.co`,
    SUPABASE_ANON_KEY: "eyJhbGciOiJtestanonkeypaddingpaddingpaddingpad",
    SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJtestservicekeypaddingpaddingpadding",
    BD_PRODUCTION_PROJECT_REF: productionRef,
    TASFUL_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
    TASFUL_SUPABASE_ANON_KEY: "eyJhbGciOiJtestanonkeypaddingpaddingpaddingpad",
    TALK_VOICE_STAGING_HOSTNAME: "turn-staging.example.test",
    TALK_VOICE_STAGING_ALLOWED_ORIGINS: "http://127.0.0.1:8788",
    TALK_VOICE_STAGING_JWT_ISSUER: `https://${stagingRef}.supabase.co/auth/v1`,
    TALK_VOICE_STAGING_JWT_AUDIENCE: "authenticated",
    TALK_VOICE_SELF_HOSTED_TURN_ENABLED: "false",
    TALK_VOICE_CONNECTION_TELEMETRY_ENABLED: "false",
    TALK_VOICE_TURN_HOST: "turn.staging.example.test",
    TALK_VOICE_TURN_UDP_PORT: "3478",
    TALK_VOICE_TURN_TCP_PORT: "3478",
    TALK_VOICE_TURN_TLS_PORT: "443",
    TALK_VOICE_TURN_REALM: "turn.staging.example.test",
    TALK_VOICE_TURN_SHARED_SECRET: "staging-turn-test-secret-do-not-use-in-prod-01",
    TALK_VOICE_TURN_TLS_CERT_PATH: "/run/secrets/talk_turn_fullchain.pem",
    TALK_VOICE_TURN_TLS_KEY_PATH: "/run/secrets/talk_turn_privkey.pem",
    TALK_VOICE_TURN_CREDENTIAL_API_URL: "http://127.0.0.1:8788/api/talk-voice-turn-credentials",
    TALK_VOICE_TELEMETRY_SINK: "session_columns",
    ...overrides,
  };
}

if (process.exitCode && process.exitCode !== 0) {
  console.error(`\nFAILED (passed partial=${passed})`);
  process.exit(process.exitCode);
}
console.log(`\nAll pre-run audit checks passed (${passed})`);
