#!/usr/bin/env node
/**
 * TASFUL TALK Phase20 — 関連ブラウザテスト一括実行
 *
 *   node scripts/test-talk-all-browser.mjs
 *   node scripts/test-talk-all-browser.mjs --only test-talk-home-browser.mjs
 *   BASE_URL=http://127.0.0.1:8765 node scripts/test-talk-all-browser.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** @type {readonly { file: string; label: string; required: boolean }[]} */
const SUITE = [
  { file: "test-talk-home-browser.mjs", label: "home (tabs/AI/notify seed)", required: true },
  { file: "test-talk-dashboard-browser.mjs", label: "dashboard panel", required: true },
  { file: "test-talk-platform-notify-browser.mjs", label: "platform notify from detail", required: true },
  { file: "test-talk-category-phase13-browser.mjs", label: "category normalize", required: true },
  { file: "test-talk-notification-settings-browser.mjs", label: "notification settings", required: true },
  { file: "test-talk-notify-actions-browser.mjs", label: "notify card actions", required: true },
  { file: "test-talk-follow-notify-browser.mjs", label: "follow notify", required: true },
  { file: "test-talk-follow-filter-browser.mjs", label: "follow filter", required: true },
  { file: "test-talk-admin-notify-filter-browser.mjs", label: "admin notify filters", required: true },
  { file: "test-talk-simple-filters-browser.mjs", label: "simple user filters", required: true },
  { file: "test-talk-broadcast-drafts-browser.mjs", label: "broadcast drafts", required: true },
  { file: "test-talk-broadcast-send-browser.mjs", label: "broadcast send", required: true },
  { file: "test-talk-ai-draft-apply-browser.mjs", label: "AI draft apply to post", required: true },
  { file: "test-talk-chat-hub-browser.mjs", label: "chat hub", required: true },
  { file: "test-talk-quick-actions-browser.mjs", label: "quick actions", required: true },
  { file: "test-talk-unified-inbox-browser.mjs", label: "unified inbox", required: true },
  { file: "test-talk-notify-ux-browser.mjs", label: "notify UX / anpi realtime", required: true },
  { file: "test-talk-supabase-sync-browser.mjs", label: "supabase sync (STRICT when env set)", required: false, strictGate: true },
  { file: "test-talk-staging-multiuser-browser.mjs", label: "staging multi-user", required: false, strictGate: true },
  { file: "test-talk-phase20-routes-browser.mjs", label: "phase20 routes + resilience", required: true },
];

function parseOnlyArg(argv) {
  const idx = argv.indexOf("--only");
  if (idx === -1) return null;
  const val = argv[idx + 1];
  if (!val) return null;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function runScript(scriptPath, env) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        ms: Date.now() - started,
      });
    });
  });
}

async function main() {
  const only = parseOnlyArg(process.argv.slice(2));
  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8765";
  const strictOn = process.env.SUPABASE_STRICT === "1";
  const runMarker = `talk-all-${Date.now()}`;
  const env = {
    BASE_URL: baseUrl,
    SUPABASE_STRICT: strictOn ? "1" : "",
    TALK_TEST_MARKER: process.env.TALK_TEST_MARKER || runMarker,
  };

  console.log(
    `TASFUL TALK test suite — BASE_URL=${baseUrl} SUPABASE_STRICT=${strictOn ? "1" : "0"}\n`
  );
  const selected = (only
    ? SUITE.filter((s) => only.some((o) => s.file.includes(o) || s.label.includes(o)))
    : SUITE
  ).map((item) => ({
    ...item,
    required: item.strictGate ? strictOn : item.required,
  }));

  if (!selected.length) {
    console.error("No tests matched --only filter.");
    process.exitCode = 1;
    return;
  }

  /** @type {{ file: string; label: string; ok: boolean; ms: number; required: boolean; output: string }[]} */
  const results = [];

  for (const item of selected) {
    const scriptPath = path.join(__dirname, item.file);
    console.log(`\n========== ${item.file} (${item.label}) ==========`);
    const r = await runScript(scriptPath, env);
    const output = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
    if (output) console.log(output);
    const ok = r.code === 0;
    results.push({
      file: item.file,
      label: item.label,
      ok,
      ms: r.ms,
      required: item.required,
      output: output.slice(-1200),
    });
    console.log(ok ? `\n→ PASS (${r.ms}ms)` : `\n→ FAIL exit ${r.code} (${r.ms}ms)`);
  }

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const failedRequired = failed.filter((r) => r.required);
  const failedOptional = failed.filter((r) => !r.required);

  console.log("\n\n==================== SUMMARY ====================");
  console.log(`Passed: ${passed.length}/${results.length}`);
  passed.forEach((r) => console.log(`  ✓ ${r.file}`));

  if (failed.length) {
    console.log(`\nFailed: ${failed.length}`);
    failed.forEach((r) => {
      const tag = r.required ? "REQUIRED" : "optional";
      console.log(`  ✗ ${r.file} [${tag}]`);
    });
  }

  if (failedRequired.length) {
    process.exitCode = 1;
  } else if (failedOptional.length) {
    console.log("\nOptional test(s) failed — suite exit 0 (set STRICT_OPTIONAL=1 to fail).");
    if (process.env.STRICT_OPTIONAL === "1") process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
