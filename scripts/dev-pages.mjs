#!/usr/bin/env node
/**
 * wrangler pages dev — CWD を deploy/cloudflare/dist にして Functions をマウント
 * （repo ルートから dist パス指定だと ./functions が見つからない）
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "deploy/cloudflare/dist");
const ENV_FILE = path.join(ROOT, ".env");

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
  ENV_FILE,
];

const child = spawn("npx", args, {
  cwd: DIST,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
