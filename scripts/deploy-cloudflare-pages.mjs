#!/usr/bin/env node
/**
 * NB-1C — Cloudflare Pages Production デプロイ（Direct Upload）
 *
 * 前提: CLOUDFLARE_API_TOKEN（Account · Cloudflare Pages Edit）
 *
 *   $env:TASFUL_SUPABASE_URL="https://ddojquacsyqesrjhcvmn.supabase.co"
 *   $env:TASFUL_SUPABASE_ANON_KEY="<anon public>"
 *   $env:CLOUDFLARE_API_TOKEN="<token>"
 *   node scripts/deploy-cloudflare-pages.mjs
 *
 * 成功後:
 *   node scripts/smoke-cloudflare-pages.mjs --base https://tasufull-article.pages.dev
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "deploy", "cloudflare", "dist");
const FUNCTIONS_MARKER = path.join(DIST, "functions", "api", "secretary-deepseek-chat.js");
const PROJECT = process.env.CF_PAGES_PROJECT_NAME || "tasufull-article";
const BRANCH = process.env.CF_PAGES_BRANCH || "main";

function fail(msg) {
  console.error(`[deploy-pages] ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd || ROOT, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
  fail(
    "CLOUDFLARE_API_TOKEN is required. Create at https://dash.cloudflare.com/profile/api-tokens (Pages Edit)."
  );
}
if (!process.env.TASFUL_SUPABASE_URL?.trim() || !process.env.TASFUL_SUPABASE_ANON_KEY?.trim()) {
  fail("TASFUL_SUPABASE_URL and TASFUL_SUPABASE_ANON_KEY are required for build.");
}

console.log("[deploy-pages] build…");
run("node", ["deploy/cloudflare/stage-cloudflare-pages.mjs"]);

console.log(`[deploy-pages] upload → project=${PROJECT} branch=${BRANCH}`);
console.log(`[deploy-pages] cwd=${DIST}`);
console.log(`[deploy-pages] target=. (static + dist/functions for Pages Functions)`);
if (!fs.existsSync(FUNCTIONS_MARKER)) {
  fail(`Pages Functions marker missing: ${path.relative(ROOT, FUNCTIONS_MARKER)} — run build first`);
}
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
    BRANCH,
    "--commit-dirty=true",
  ],
  { cwd: DIST }
);

const base = `https://${PROJECT}.pages.dev`;
console.log(`\n[deploy-pages] OK — Production URL (typical): ${base}`);
console.log(`[deploy-pages] smoke: node scripts/smoke-cloudflare-pages.mjs --base ${base}`);
