#!/usr/bin/env node
/**
 * TASFUL AI — 横断 Monitoring / smoke（prod alias · Edge · Gateway · Media · Voice）
 *   node scripts/verify-tasful-ai-monitoring.mjs
 *   PAGES_BASE_URL=https://tasufull-article.pages.dev node --env-file=.env scripts/verify-tasful-ai-monitoring.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const startedAt = new Date().toISOString();

const suites = [
  { id: "final-phase", script: "test-tasful-ai-final-phase.mjs", label: "8788 unit · Final Phase" },
  { id: "prod-env", script: "verify-tasful-ai-production-environment.mjs", label: "Edge · Gateway providers" },
  { id: "quota-edge", script: "test-ai-workspace-quota-edge.mjs", label: "Quota Edge" },
  { id: "media-edge", script: "test-tasful-ai-media-generate-edge.mjs", label: "Media API Edge" },
  { id: "voice-edge", script: "test-voice-core-phase5c-edge-smoke.mjs", label: "Voice Realtime Edge" },
  { id: "web-search", script: "test-web-search-provider-edge.mjs", label: "Brave Web Search" },
];

const optional = [
  { id: "access-workspace", script: "verify-tasful-ai-access-workspace.mjs", label: "CF Access prod alias", needsEnv: true },
];

/** @type {{ id: string, label: string, exitCode: number, ok: boolean, skipped?: boolean }[]} */
const results = [];

function runScript(rel) {
  const r = spawnSync(process.execPath, [join(root, "scripts", rel)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    timeout: 300000,
  });
  return { exitCode: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

console.log("TASFUL AI Monitoring — cross-suite smoke\n");

for (const suite of suites) {
  const { exitCode, stdout, stderr } = runScript(suite.script);
  const ok = exitCode === 0;
  results.push({ id: suite.id, label: suite.label, exitCode, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${suite.label} (${suite.script}) exit=${exitCode}`);
  if (!ok && stderr) console.error(stderr.slice(0, 400));
  if (!ok && stdout) console.log(stdout.slice(-600));
}

for (const suite of optional) {
  if (suite.needsEnv && !process.env.CF_ACCESS_CLIENT_ID) {
    results.push({ id: suite.id, label: suite.label, exitCode: 0, ok: true, skipped: true });
    console.log(`SKIP: ${suite.label} — CF_ACCESS_CLIENT_ID not set`);
    continue;
  }
  const { exitCode } = runScript(suite.script);
  const ok = exitCode === 0;
  results.push({ id: suite.id, label: suite.label, exitCode, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${suite.label}`);
}

const failed = results.filter((r) => !r.ok && !r.skipped).length;
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  pagesBaseUrl: process.env.PAGES_BASE_URL || "(default 8788 / Edge live)",
  results,
  failed,
  go: failed === 0,
};

mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports/tasful-ai-monitoring-last.json"), JSON.stringify(report, null, 2));

console.log(`\nMonitoring summary: ${results.length - failed}/${results.length} PASS · Go=${report.go}`);
process.exit(failed > 0 ? 1 : 0);
