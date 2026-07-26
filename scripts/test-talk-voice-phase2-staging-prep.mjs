#!/usr/bin/env node
/**
 * TALK Voice Phase 2 — Staging prep unit / negative tests (no DB apply · no coturn).
 *
 *   node scripts/test-talk-voice-phase2-staging-prep.mjs
 *   node scripts/test-talk-voice-phase2-staging-prep.mjs --skip-http
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  getProductionRef,
  getStagingRef,
} from "./lib/supabase-env.mjs";
import {
  STAGING_ENV_EXAMPLE,
  parseEnvText,
  redactValue,
  validateTalkVoiceStagingEnv,
} from "./lib/talk-voice-staging-env.mjs";
import {
  E2E_ASSERTION_KEYS,
  E2E_ROUTE_MATRIX,
  describeE2EPlan,
} from "./lib/talk-voice-phase2-e2e-matrix.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipHttp = process.argv.includes("--skip-http");
const stagingRef = getStagingRef();
const productionRef = getProductionRef();

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

function baseValidEnv(overrides = {}) {
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
    TALK_VOICE_RATE_LIMIT_ENABLED: "true",
    TALK_VOICE_RATE_LIMIT_FAIL_CLOSED: "true",
    TALK_VOICE_RATE_LIMIT_NAMESPACE: "staging",
    TALK_VOICE_RATE_LIMIT_HASH_KEY: "staging-rate-limit-hash-key-32chars-min!",
    ...overrides,
  };
}

check("example file has no live secrets", () => {
  const text = fs.readFileSync(STAGING_ENV_EXAMPLE, "utf8");
  assert.doesNotMatch(text, /eyJ[a-zA-Z0-9_-]{20,}/);
  assert.doesNotMatch(text, /sk_live_/);
  assert.match(text, /REQUIRED/);
  assert.match(text, /OPTIONAL/);
  assert.match(text, /TALK_VOICE_TURN_SHARED_SECRET=/);
  const map = parseEnvText(text);
  assert.equal(map.SUPABASE_PROJECT_REF, stagingRef);
  assert.equal(map.TALK_VOICE_TURN_SHARED_SECRET, "");
  assert.ok(!String(map.SUPABASE_URL).includes(productionRef));
});

check("valid staging env passes", () => {
  const result = validateTalkVoiceStagingEnv(baseValidEnv());
  assert.equal(result.ok, true, summarize(result));
});

check("production hostname rejected", () => {
  const result = validateTalkVoiceStagingEnv(
    baseValidEnv({
      TALK_VOICE_STAGING_HOSTNAME: "tasufull-article.pages.dev",
      TALK_VOICE_STAGING_ALLOWED_ORIGINS: "https://tasufull-article.pages.dev,http://127.0.0.1:8788",
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "bad_hostname" || i.code === "production_origin" || i.code === "production_value"));
});

check("production supabase URL rejected", () => {
  const result = validateTalkVoiceStagingEnv(
    baseValidEnv({
      SUPABASE_URL: `https://${productionRef}.supabase.co`,
      TASFUL_SUPABASE_URL: `https://${productionRef}.supabase.co`,
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "production_value" || i.code === "wrong_supabase_url"));
});

check("production project ref rejected", () => {
  const result = validateTalkVoiceStagingEnv(
    baseValidEnv({ SUPABASE_PROJECT_REF: productionRef }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "production_ref" || i.code === "wrong_project_ref"));
});

check("missing TURN shared secret rejected", () => {
  const result = validateTalkVoiceStagingEnv(
    baseValidEnv({ TALK_VOICE_TURN_SHARED_SECRET: "" }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("TALK_VOICE_TURN_SHARED_SECRET"));
});

check("short TURN shared secret rejected without printing value", () => {
  const secret = "too-short-secret";
  const result = validateTalkVoiceStagingEnv(baseValidEnv({ TALK_VOICE_TURN_SHARED_SECRET: secret }));
  assert.equal(result.ok, false);
  const summary = summarize(result);
  assert.ok(!summary.includes(secret));
  assert.equal(redactValue("TALK_VOICE_TURN_SHARED_SECRET", secret), `set(len=${secret.length})`);
});

check("wrong JWT issuer rejected", () => {
  const result = validateTalkVoiceStagingEnv(
    baseValidEnv({
      TALK_VOICE_STAGING_JWT_ISSUER: `https://${productionRef}.supabase.co/auth/v1`,
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "wrong_issuer" || i.code === "production_value"));
});

check("missing local origin rejected", () => {
  const result = validateTalkVoiceStagingEnv(
    baseValidEnv({ TALK_VOICE_STAGING_ALLOWED_ORIGINS: "https://preview.example.test" }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "missing_local_origin"));
});

check("TLS port must be 443 for matrix", () => {
  const result = validateTalkVoiceStagingEnv(baseValidEnv({ TALK_VOICE_TURN_TLS_PORT: "5349" }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.key === "TALK_VOICE_TURN_TLS_PORT"));
});

check("e2e matrix has four forced routes + assertions", () => {
  const plan = describeE2EPlan();
  assert.equal(plan.contextsMinimum, 2);
  assert.equal(plan.mockPassForbidden, true);
  assert.equal(E2E_ROUTE_MATRIX.length >= 4, true);
  assert.ok(E2E_ASSERTION_KEYS.includes("relay_protocol"));
  assert.ok(E2E_ASSERTION_KEYS.includes("hangup_cleanup_ice_closed"));
  assert.deepEqual(
    E2E_ROUTE_MATRIX.map((r) => r.id),
    ["direct_p2p", "turn_udp", "turn_tcp", "turn_tls_443"],
  );
});

check("create-env-staging --dry-run exits 0 and redacts", () => {
  const r = spawnSync(process.execPath, ["scripts/lib/create-env-staging.mjs", "--dry-run"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /DRY_RUN: no file written/);
  assert.match(r.stdout, /TALK_VOICE_TURN_SHARED_SECRET=\(empty\)|TALK_VOICE_TURN_SHARED_SECRET=set\(len=/);
  assert.doesNotMatch(r.stdout, /eyJhbGciOi/);
});

check("create-env-staging --help lists required matrix", () => {
  const r = spawnSync(process.execPath, ["scripts/lib/create-env-staging.mjs", "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /REQUIRED\s+TALK_VOICE_TURN_SHARED_SECRET/);
  assert.match(r.stdout, /OPTIONAL\s+TALK_VOICE_TURN_FORCE_RELAY_TEST/);
});

check("dist parity for TURN function mirrors", () => {
  const pairs = [
    [
      "deploy/cloudflare/functions/api/talk-voice-turn-credentials.js",
      "deploy/cloudflare/dist/functions/api/talk-voice-turn-credentials.js",
    ],
    [
      "deploy/cloudflare/functions/_shared/talk-voice-turn.mjs",
      "deploy/cloudflare/dist/functions/_shared/talk-voice-turn.mjs",
    ],
    [
      "deploy/cloudflare/functions/_shared/talk-voice-rate-limit.mjs",
      "deploy/cloudflare/dist/functions/_shared/talk-voice-rate-limit.mjs",
    ],
  ];
  for (const [a, b] of pairs) {
    const left = fs.readFileSync(path.join(root, a), "utf8");
    const right = fs.readFileSync(path.join(root, b), "utf8");
    assert.equal(left, right, `${a} !== ${b}`);
  }
  assert.ok(fs.existsSync(path.join(root, "deploy/cloudflare/dist/scripts/talk-call-turn-client.js")));
  assert.ok(fs.existsSync(path.join(root, "deploy/cloudflare/dist/scripts/talk-voice-core/telemetry.js")));
});

check("gitignore covers .env.staging", () => {
  const gi = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(gi, /^\.env\.staging$/m);
});

async function httpChecks() {
  if (skipHttp) {
    console.log("SKIP HTTP smoke (--skip-http)");
    return;
  }
  try {
    const talk = await fetch("http://127.0.0.1:8788/talk-home", { redirect: "follow" });
    assert.equal(talk.status, 200);
    const html = await talk.text();
    assert.match(html, /talk-call-turn-client\.js/);
    assert.match(html, /talk-voice-core\/telemetry\.js/);
    console.log("PASS 8788 talk-home 200 + scripts");
    passed += 1;
  } catch (err) {
    console.error("FAIL 8788 talk-home 200 + scripts");
    console.error(err);
    process.exitCode = 1;
  }

  try {
    const res = await fetch("http://127.0.0.1:8788/api/talk-voice-turn-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.text();
    assert.equal(res.status, 401);
    assert.match(body, /auth_required/);
    console.log("PASS credential endpoint unauthorized => 401");
    passed += 1;
  } catch (err) {
    console.error("FAIL credential endpoint unauthorized => 401");
    console.error(err);
    process.exitCode = 1;
  }
}

function summarize(result) {
  return result.issues.map((i) => `${i.code}:${i.key || ""}`).join(",");
}

await httpChecks();

if (process.exitCode && process.exitCode !== 0) {
  console.error(`\nFAILED (passed partial=${passed})`);
  process.exit(process.exitCode);
}
console.log(`\nAll staging-prep checks passed (${passed})`);
