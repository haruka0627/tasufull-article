#!/usr/bin/env node
/**
 * TASFUL AI Phase 4 — Usage Gauge 静的 + 計算検証
 *   node scripts/test-tasful-ai-usage-gauge-phase4.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildUsageGauge,
  resolveGaugeStatus,
  nextTokyoResetIso,
  tokyoPeriodStartIso,
  parseTokyoDateKey,
  sanitizePublicUsageResponse,
  GAUGE_THRESHOLDS,
} from "./lib/ai-usage-gauge.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(name, cond, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
}
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const usageJs = read("ai-workspace-usage.js");
const gaugeJs = read("ai-workspace-usage-gauge.js");
const quotaTs = read("supabase/functions/_shared/ai-workspace-quota.ts");
const gaugeTs = read("supabase/functions/_shared/ai-usage-gauge.ts");
const html = read("ai-workspace.html");
const settings = read("ai-workspace-settings.js");
const billing = read("ai-workspace-billing-settings.js");

assert("gauge browser module", /TasuAiUsageGauge/.test(gaugeJs));
assert("html loads gauge", html.includes("ai-workspace-usage-gauge.js"));
assert("usage getGaugeSnapshot", usageJs.includes("getGaugeSnapshot"));
assert("usage compact meter", usageJs.includes("ai-workspace-usage__meter"));
assert("quota attaches usage", quotaTs.includes("attachUsageGaugeToStatus"));
assert("quota JWT mismatch reject", quotaTs.includes("user_mismatch"));
assert("quota hides SQL errors", quotaTs.includes("usage_unavailable") && !/error\.message/.test(quotaTs.split("handleWorkspaceQuotaAction")[1] || ""));
assert("edge gauge no cost fields", !/unit_price|estimated_cost/.test(gaugeTs));
assert("billing daily label", settings.includes("本日の利用状況"));
assert("billing drops demo 4-bars default path", billing.includes("getLiveUsageSnapshot"));
assert("no cost in public payload builder", !/profit|unit_price/.test(gaugeJs));

// --- calc cases ---
assert("unused 0%", buildUsageGauge({ used: 0, limit: 100 }).displayPercent === 0);
assert("unused status comfortable", buildUsageGauge({ used: 0, limit: 100 }).status === "comfortable");

const mid = buildUsageGauge({ used: 50, limit: 100 });
assert("50%", mid.displayPercent === 50 && mid.status === "normal");

const e75 = buildUsageGauge({ used: 75, limit: 100 });
assert("75%", e75.displayPercent === 75 && e75.status === "elevated");

const low = buildUsageGauge({ used: 90, limit: 100 });
assert("90%", low.displayPercent === 90 && low.status === "low");

const full = buildUsageGauge({ used: 100, limit: 100, allowed: false });
assert("100% stopped", full.displayPercent === 100 && full.status === "stopped" && full.canExecute === false);

const over = buildUsageGauge({ used: 120, limit: 100, allowed: false });
assert("over 100% display capped", over.displayPercent === 100 && over.usageRatio === 1.2);
assert("over remaining non-negative", over.remaining === 0);

assert("limit 0 stopped", buildUsageGauge({ used: 0, limit: 0 }).status === "stopped");
assert("limit null unavailable", buildUsageGauge({ used: 3, limit: null }).status === "unavailable");
assert("usage null unavailable", buildUsageGauge({ used: null, limit: 10 }).status === "unavailable");
assert("negative used clamped", buildUsageGauge({ used: -5, limit: 10 }).periodUsed === 0);

const dec = buildUsageGauge({ used: 1, limit: 3 });
assert("decimal ratio", Math.abs(dec.usageRatio - 1 / 3) < 1e-9);

assert("threshold constants single source", GAUGE_THRESHOLDS.comfortableMax === 0.49);

assert("month end reset", nextTokyoResetIso("2026/01/31") === "2026-02-01T00:00:00+09:00");
assert("leap day", nextTokyoResetIso("2024/02/28") === "2024-02-29T00:00:00+09:00");
assert("after leap", nextTokyoResetIso("2024/02/29") === "2024-03-01T00:00:00+09:00");
assert("non-leap feb", nextTokyoResetIso("2025/02/28") === "2025-03-01T00:00:00+09:00");
assert("period start", tokyoPeriodStartIso("2026/07/26") === "2026-07-26T00:00:00+09:00");
assert("parse tokyo key", parseTokyoDateKey("2026/07/26")?.d === 26);

const statusNear = resolveGaugeStatus(0.995, { canExecute: true });
assert("99.5% near_limit", statusNear === "near_limit");

const cleaned = sanitizePublicUsageResponse({
  ok: true,
  usage: {
    ...buildUsageGauge({ used: 2, limit: 10 }),
    unit_price: 9.99,
    estimated_cost: 1,
    prompt: "secret",
  },
});
assert("sanitize drops cost", !("unit_price" in cleaned.usage) && !("estimated_cost" in cleaned.usage));
assert("sanitize drops prompt", !("prompt" in cleaned.usage));

assert("remaining formula", buildUsageGauge({ used: 42, limit: 100 }).remaining === 58);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exitCode = 1;
