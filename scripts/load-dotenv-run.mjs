#!/usr/bin/env node
/** Load repo .env into process.env, then run: node scripts/load-dotenv-run.mjs <script.mjs> */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^\s*([^#=]+)=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1].trim()] = v;
  }
}

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/load-dotenv-run.mjs <script.mjs> [args...]");
  process.exit(1);
}

const r = spawnSync("node", [target, ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: true,
});
process.exit(r.status ?? 1);
