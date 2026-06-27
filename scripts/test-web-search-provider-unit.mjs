#!/usr/bin/env node
/**
 * Web search provider unit tests
 *   node scripts/test-web-search-provider-unit.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runner = join(root, "scripts", "test-web-search-provider-unit-runner.ts");

const r = spawnSync("npx", ["tsx", runner], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status === null ? 1 : r.status);
