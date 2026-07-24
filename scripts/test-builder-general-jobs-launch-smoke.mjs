#!/usr/bin/env node
/**
 * Builder General Jobs — Launch Smoke (RL-08)
 *
 * P0〜P3 回帰 + RL-02 Staging live を一括実行
 *   node scripts/test-builder-general-jobs-launch-smoke.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "reports", "builder-general-jobs-launch-smoke");

const SCRIPTS = [
  { id: "P0-01", path: "scripts/test-builder-general-jobs-p0-01-repository.mjs" },
  { id: "P0-02", path: "scripts/test-builder-general-jobs-p0-02-repository-write.mjs" },
  { id: "P0-03", path: "scripts/test-builder-general-jobs-p0-03-authenticated-write-e2e.mjs" },
  { id: "P0-04", path: "scripts/test-builder-general-jobs-p0-04-talk-room-ensure.mjs" },
  { id: "P0-05", path: "scripts/test-builder-general-jobs-p0-05-supabase-read-notification-uuid.mjs" },
  { id: "RL-02", path: "scripts/test-builder-general-jobs-rl02-staging-live-e2e.mjs" },
  { id: "P1-W1", path: "scripts/test-builder-general-jobs-p1-wave1-admin-path.mjs" },
  { id: "P2-W3", path: "scripts/test-builder-general-jobs-p2-wave3-smoke.mjs" },
  { id: "P2-W4", path: "scripts/test-builder-general-jobs-p2-wave4-smoke.mjs" },
  { id: "P3", path: "scripts/test-builder-general-jobs-p3-smoke.mjs" },
];

let pass = 0;
let fail = 0;
const report = {
  phase: "RL-08-Launch-Smoke",
  timestamp: new Date().toISOString(),
  suites: [],
  decision: null,
};

function runSuite(spec) {
  const full = path.join(root, spec.path);
  if (!fs.existsSync(full)) {
    fail += 1;
    report.suites.push({ id: spec.id, path: spec.path, ok: false, status: null, detail: "missing" });
    console.error(`FAIL ${spec.id} — missing ${spec.path}`);
    return false;
  }
  const res = spawnSync(process.execPath, [full], { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const ok = res.status === 0;
  if (ok) {
    pass += 1;
    console.log(`PASS ${spec.id} · ${path.basename(spec.path)}`);
  } else {
    fail += 1;
    console.error(`FAIL ${spec.id} · ${path.basename(spec.path)} exit ${res.status}`);
    const tail = String(res.stderr || res.stdout || "")
      .split("\n")
      .slice(-8)
      .join("\n");
    if (tail) console.error(tail);
  }
  report.suites.push({ id: spec.id, path: spec.path, ok, status: res.status });
  return ok;
}

console.log("=== Builder Launch Smoke (RL-08) ===\n");

for (const spec of SCRIPTS) {
  runSuite(spec);
}

report.pass = pass;
report.fail = fail;
report.decision = fail === 0 ? "Go" : "No-Go";

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(report, null, 2));

console.log(`\n=== Launch Smoke: ${report.decision} (${pass}/${SCRIPTS.length} suites) ===`);
process.exit(fail === 0 ? 0 : 1);
