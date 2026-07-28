#!/usr/bin/env node
/**
 * Diff & Approve — Staging Pages Preview deploy (NOT production branch).
 *
 *   node --env-file=.env scripts/deploy-diff-approve-staging-preview.mjs
 *
 * Uses CLOUDFLARE_API_TOKEN from .env, Supabase Staging from .env.staging.
 * Deploys to --branch=diff-approve-staging-readonly (Preview env).
 * Never targets CF_PAGES_BRANCH=cf-pages-deploy.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");
const PREVIEW_BRANCH = "diff-approve-staging-readonly";
const PROJECT = "tasufull-article";
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const PRODUCTION_BRANCH = "cf-pages-deploy";

function loadEnvFile(rel) {
  const p = path.join(ROOT, rel);
  const o = {};
  if (!existsSync(p)) return o;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

function fail(msg) {
  console.error(`[diff-approve-preview-deploy] ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd || ROOT,
    shell: process.platform === "win32",
    env: opts.env || process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const rootEnv = loadEnvFile(".env");
const stagingEnv = loadEnvFile(".env.staging");

const token = String(
  process.env.CLOUDFLARE_API_TOKEN || rootEnv.CLOUDFLARE_API_TOKEN || ""
).trim();
if (!token) fail("CLOUDFLARE_API_TOKEN required (.env)");

const stagingUrl = String(
  stagingEnv.TASFUL_SUPABASE_URL || stagingEnv.SUPABASE_URL || ""
)
  .trim()
  .replace(/\/$/, "");
const stagingAnon = String(
  stagingEnv.TASFUL_SUPABASE_ANON_KEY || stagingEnv.SUPABASE_ANON_KEY || ""
).trim();
const stagingService = String(stagingEnv.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!stagingUrl.includes(STAGING_REF)) {
  fail(`Staging URL must include ${STAGING_REF}`);
}
if (stagingUrl.includes(PRODUCTION_REF)) {
  fail("Refusing Production Supabase URL");
}
if (!stagingAnon || !stagingService) {
  fail("Staging anon + service role required in .env.staging");
}

if (PREVIEW_BRANCH === PRODUCTION_BRANCH) {
  fail("Preview branch must not equal production branch");
}

const skipBuild = process.argv.includes("--skip-build");
const skipFlags = process.argv.includes("--skip-flags");

process.env.CLOUDFLARE_API_TOKEN = token;
process.env.TASFUL_SUPABASE_URL = stagingUrl;
process.env.TASFUL_SUPABASE_ANON_KEY = stagingAnon;
process.env.SUPABASE_URL = stagingUrl;
process.env.SUPABASE_ANON_KEY = stagingAnon;
process.env.SUPABASE_SERVICE_ROLE_KEY = stagingService;
delete process.env.CF_PAGES_BRANCH;

console.log(`[diff-approve-preview-deploy] project=${PROJECT}`);
console.log(`[diff-approve-preview-deploy] branch=${PREVIEW_BRANCH} (Preview · not ${PRODUCTION_BRANCH})`);
console.log(`[diff-approve-preview-deploy] supabase_ref=${STAGING_REF}`);

if (!skipBuild) {
  console.log("[diff-approve-preview-deploy] build:pages…");
  run("npm", ["run", "build:pages"], {
    env: {
      ...process.env,
      TASFUL_SUPABASE_URL: stagingUrl,
      TASFUL_SUPABASE_ANON_KEY: stagingAnon,
    },
  });
} else {
  console.log("[diff-approve-preview-deploy] skip build");
}

// Ensure Functions marker
const marker = path.join(DIST, "functions/api/ai-diff-approve/proposals.js");
if (!existsSync(marker)) fail(`Missing ${marker}`);

// Patch dist/.dev.vars for local parity notes (not used by remote Pages; Preview env set via API)
const devVarsPath = path.join(DIST, ".dev.vars");
if (existsSync(devVarsPath)) {
  let text = readFileSync(devVarsPath, "utf8");
  const lines = [
    "DIFF_APPROVE_READ_ENABLED=true",
    "DIFF_APPROVE_APPLY_ENABLED=false",
    "DIFF_APPROVE_PERSISTENCE_ENABLED=true",
    "AI_EXEC_GATE_ENVIRONMENT=staging",
  ];
  for (const line of lines) {
    const key = line.split("=")[0];
    if (!new RegExp(`^${key}=`, "m").test(text)) {
      text += `\n${line}`;
    } else {
      text = text.replace(new RegExp(`^${key}=.*$`, "m"), line);
    }
  }
  writeFileSync(devVarsPath, text.endsWith("\n") ? text : text + "\n", "utf8");
}

async function ensurePreviewFlags() {
  const who = await fetch("https://api.cloudflare.com/client/v4/accounts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const whoJson = await who.json();
  if (!who.ok) {
    fail(`Cloudflare accounts API ${who.status}`);
  }
  const accounts = whoJson.result || [];
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  if (!accountId) {
    accountId = accounts[0]?.id || "";
  }
  if (!accountId) fail("CLOUDFLARE_ACCOUNT_ID unresolved");

  const getRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${PROJECT}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const getJson = await getRes.json();
  if (!getRes.ok) fail(`Pages project get ${getRes.status}`);

  const deploymentConfigs = getJson.result?.deployment_configs || {};
  const preview = deploymentConfigs.preview?.env_vars || {};
  const production = deploymentConfigs.production?.env_vars || {};

  const prodRead = production.DIFF_APPROVE_READ_ENABLED?.value;
  if (prodRead === "true" || prodRead === "1") {
    console.warn(
      "[diff-approve-preview-deploy] WARN: Production has DIFF_APPROVE_READ_ENABLED=true (unexpected)"
    );
  }

  // Only upsert flag keys — never resend existing secret blobs (avoids wiping).
  const flagVars = {
    DIFF_APPROVE_READ_ENABLED: { type: "plain_text", value: "true" },
    DIFF_APPROVE_APPLY_ENABLED: { type: "plain_text", value: "false" },
    DIFF_APPROVE_PERSISTENCE_ENABLED: { type: "plain_text", value: "true" },
    AI_EXEC_GATE_ENVIRONMENT: { type: "plain_text", value: "staging" },
  };

  const hasStagingUrl =
    typeof preview.TASFUL_SUPABASE_URL?.value === "string" &&
    preview.TASFUL_SUPABASE_URL.value.includes(STAGING_REF);
  if (!hasStagingUrl) {
    console.warn(
      "[diff-approve-preview-deploy] NOTE: Preview TASFUL_SUPABASE_URL not confirmed Staging via API (may still be set as secret)"
    );
  }

  const patchRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${PROJECT}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deployment_configs: {
          preview: {
            env_vars: flagVars,
          },
        },
      }),
    }
  );
  const patchJson = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) {
    console.error(JSON.stringify({ errors: patchJson.errors || patchJson }, null, 2));
    console.warn(
      `[diff-approve-preview-deploy] WARN: Preview env patch failed ${patchRes.status} — continuing (flags may already be set)`
    );
    return accountId;
  }
  console.log("[diff-approve-preview-deploy] Preview env flags set (READ=true APPLY=false)");
  return accountId;
}

let accountId = "skipped";
if (!skipFlags) {
  try {
    accountId = await ensurePreviewFlags();
  } catch (e) {
    console.warn(
      `[diff-approve-preview-deploy] WARN: flag ensure failed (${e.message}) — continuing deploy`
    );
  }
} else {
  console.log("[diff-approve-preview-deploy] skip flags");
}

console.log("[diff-approve-preview-deploy] wrangler pages deploy…");
run(
  "npx",
  [
    "wrangler",
    "pages",
    "deploy",
    ".",
    "--project-name",
    PROJECT,
    "--branch",
    PREVIEW_BRANCH,
    "--commit-dirty=true",
  ],
  {
    cwd: DIST,
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
  }
);

const previewAlias = `https://${PREVIEW_BRANCH}.${PROJECT}.pages.dev`;
console.log(`\n[diff-approve-preview-deploy] OK`);
console.log(`[diff-approve-preview-deploy] preview_alias=${previewAlias}`);
console.log(`[diff-approve-preview-deploy] account=${accountId.slice(0, 8)}…`);
writeFileSync(
  path.join(ROOT, "reports", "diff-approve-staging-preview-url.txt"),
  `${previewAlias}\n`,
  "utf8"
);
