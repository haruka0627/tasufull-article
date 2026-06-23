/**
 * TASFUL MATCH Edge JWT stub — unit tests (Deno runner via Node launcher)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function ok(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

function bad(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

function runDeno(scriptPath, args = []) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["deno", "run", "--allow-read", scriptPath, ...args],
    { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" },
  );
  return result;
}

console.log("TASFUL MATCH Edge JWT stub tests\n");

console.log("1) JWT helper unit tests (Deno)");
const unit = runDeno(path.join("scripts", "test-match-edge-jwt-stub-runner.ts"));
if (unit.status === 0) {
  for (const line of (unit.stdout || "").split("\n").filter(Boolean)) {
    if (line.startsWith("PASS:")) ok(line.slice(5).trim());
    else if (line.startsWith("FAIL:")) bad(line.slice(5).trim());
  }
} else {
  bad(`Deno unit runner failed (exit ${unit.status})`);
  if (unit.stderr) console.error(unit.stderr);
  if (unit.stdout) console.error(unit.stdout);
}

console.log("\n2) deno check — match Edge Functions");
const checkTargets = [
  "supabase/functions/_shared/match-auth.ts",
  "supabase/functions/_shared/match-core.ts",
  "supabase/functions/match-record-swipe/index.ts",
  "supabase/functions/match-list-pairs/index.ts",
  "supabase/functions/match-ensure-talk-room/index.ts",
  "supabase/functions/match-submit-report/index.ts",
  "supabase/functions/match-block-user/index.ts",
  "supabase/functions/match-submit-verification/index.ts",
  "supabase/functions/match-admin-review/index.ts",
  "supabase/functions/match-moderation-log/index.ts",
];

const check = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["deno", "check", ...checkTargets],
  { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" },
);

if (check.status === 0) ok("deno check PASS (10 files)");
else {
  bad(`deno check FAILED (exit ${check.status})`);
  if (check.stderr) console.error(check.stderr);
}

console.log("\n3) Static scan — no fetch / DB in match-auth.ts");
const authSrc = fs.readFileSync(
  path.join(ROOT, "supabase/functions/_shared/match-auth.ts"),
  "utf8",
);
const forbidden = [/fetch\s*\(/, /createClient/, /\.from\s*\(/];
const hits = forbidden.filter((re) => re.test(authSrc)).map((re) => String(re));
if (hits.length === 0) ok("match-auth.ts has no fetch / createClient / .from(");
else bad(`match-auth.ts unexpected patterns: ${hits.join(", ")}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
