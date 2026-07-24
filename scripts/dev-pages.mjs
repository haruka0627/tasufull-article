#!/usr/bin/env node
/**
 * wrangler pages dev — CWD を deploy/cloudflare/dist にして Functions をマウント
 *
 * Pages Functions の env 正本: dist/.dev.vars（.env.staging 優先同期 · AD P5-7c）
 * repo root .env は Production Supabase を含むため --env-file に使わない。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncPagesDevVars } from "./lib/sync-pages-dev-vars.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");

syncPagesDevVars(DIST);
const DEV_VARS = path.join(DIST, ".dev.vars");
if (!fs.existsSync(DEV_VARS)) {
  console.error("[dev-pages] missing dist/.dev.vars — run npm run dev (ensure-pages-dist) first");
  process.exit(1);
}

const port = process.env.PAGES_DEV_PORT || "8788";
const args = [
  "wrangler",
  "pages",
  "dev",
  ".",
  "--port",
  port,
  "--ip",
  "127.0.0.1",
  "--compatibility-date",
  "2026-06-24",
  "--env-file",
  DEV_VARS,
];

const child = spawn("npx", args, {
  cwd: DIST,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
