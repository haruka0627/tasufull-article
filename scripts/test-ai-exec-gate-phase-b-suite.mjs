#!/usr/bin/env node
/**
 * AI Execution Gate — Phase B6 suite runner (B1–B5 + B6 integration)
 *   node scripts/test-ai-exec-gate-phase-b-suite.mjs
 *
 * Evidence only — no new Gate features.
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tests = [
  "scripts/test-ai-exec-gate-phase-b1-constants.mjs",
  "scripts/test-ai-exec-gate-phase-b2-db.mjs",
  "scripts/test-ai-exec-gate-phase-b3-api.mjs",
  "scripts/test-ai-exec-gate-phase-b4-executor.mjs",
  "scripts/test-ai-exec-gate-phase-b5-dashboard.mjs",
  "scripts/test-ai-exec-gate-phase-b6-integration.mjs",
];

const summary = [];
let failed = 0;

for (const rel of tests) {
  console.log(`\n======== RUN ${rel} ========`);
  const r = spawnSync(process.execPath, [join(root, rel)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  process.stdout.write(out);
  const code = r.status == null ? 1 : r.status;
  const passMarks = (out.match(/✓/g) || []).length;
  const failMarks = (out.match(/✗/g) || []).length;
  summary.push({
    command: `node ${rel}`,
    exit: code,
    passMarks,
    failMarks,
  });
  if (code !== 0) failed += 1;
}

console.log("\n======== SUITE SUMMARY ========");
for (const s of summary) {
  console.log(
    `${s.exit === 0 ? "PASS" : "FAIL"} exit=${s.exit} ✓≈${s.passMarks} ✗=${s.failMarks} :: ${s.command}`
  );
}
console.log(
  failed === 0
    ? `\nSUITE PASSED (${summary.length} commands)`
    : `\nSUITE FAILED (${failed}/${summary.length})`
);
process.exit(failed === 0 ? 0 : 1);
