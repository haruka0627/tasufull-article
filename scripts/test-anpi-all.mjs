#!/usr/bin/env node
/**
 * 安否・LINE 関連 E2E 一括実行
 *
 *   node scripts/test-anpi-all.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SUITES = [
  "test-anpi-register-browser.mjs",
  "test-anpi-notifications-browser.mjs",
  "test-ai-anpi-notification-browser.mjs",
  "test-anpi-dashboard-browser.mjs",
  "test-anpi-notification-badge-browser.mjs",
  "test-anpi-line-notification-log-browser.mjs",
  "test-anpi-line-send-browser.mjs",
  "test-anpi-line-fallback-browser.mjs",
  "test-anpi-line-safety-browser.mjs",
  "test-anpi-line-login-browser.mjs",
  "test-anpi-line-token-browser.mjs",
  "test-anpi-line-unlink-browser.mjs",
  "test-anpi-line-admin-browser.mjs",
  "test-anpi-context-supabase-browser.mjs",
  "test-anpi-notification-log-supabase-browser.mjs",
  "test-anpi-identity-linking-browser.mjs",
  "test-anpi-rls-production-browser.mjs",
];

function runSuite(name) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", name)], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on("close", (code) => {
      const elapsed = Date.now() - started;
      const m = out.match(/(\d+)\/(\d+)\s+OK/i) || out.match(/(\d+)\/(\d+)\s+passed/i);
      const pass = m ? Number(m[1]) : code === 0 ? 1 : 0;
      const total = m ? Number(m[2]) : code === 0 ? 1 : 1;
      resolve({
        name,
        code: code ?? 1,
        pass,
        fail: code === 0 ? total - pass : total - pass || 1,
        total,
        elapsedMs: elapsed,
        ok: code === 0,
      });
    });
  });
}

async function main() {
  const t0 = Date.now();
  console.log(`\n=== 安否 E2E 一括実行 (${SUITES.length} suites) ===\n`);

  const results = [];
  for (const suite of SUITES) {
    console.log(`\n>>>>>>>> ${suite} <<<<<<<<\n`);
    results.push(await runSuite(suite));
  }

  const totalPass = results.reduce((s, r) => s + (r.ok ? r.pass : 0), 0);
  const totalFail = results.filter((r) => !r.ok).length;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n=== 集約結果 ===\n");
  results.forEach((r) => {
    const status = r.ok ? "PASS" : "FAIL";
    console.log(
      `  ${status}  ${r.name}  (${(r.elapsedMs / 1000).toFixed(1)}s)${r.ok ? `  ${r.pass}/${r.total}` : ""}`
    );
  });
  console.log(`\nスイート: PASS ${results.length - totalFail} / FAIL ${totalFail}`);
  console.log(`実行時間: ${elapsed}s\n`);

  if (totalFail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
