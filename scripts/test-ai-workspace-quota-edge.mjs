#!/usr/bin/env node
/**
 * TASFUL AI Workspace — Phase 2 quota Edge tests
 *   node scripts/test-ai-workspace-quota-edge.mjs
 *
 * Requires: sql/ai-workspace-usage-daily.sql applied · Edge functions deployed
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfgSrc = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
const base = cfgSrc.match(/url:\s*"([^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
const anonKey = cfgSrc.match(/anonKey:\s*"([^"]+)"/)?.[1] || "";

/** @type {{ name: string, ok: boolean, detail?: string }[]} */
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

async function post(fn, body) {
  const res = await fetch(`${base}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function tokyoDateKey() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function setupPlanUser(userId, planId) {
  const out = await post("stripe-e2e-simulate-genai-subscription", {
    user_id: userId,
    genai_plan: planId,
  });
  return out.status === 200 && out.data?.ok !== false;
}

async function main() {
  if (!base || !anonKey) {
    console.error("Missing Supabase config");
    process.exit(1);
  }

  const runId = Date.now().toString(36);
  const freeUser = `quota_e2e_free_${runId}`;
  const basicUser = `quota_e2e_basic_${runId}`;
  const proUser = `quota_e2e_pro_${runId}`;

  // --- quota edge reachable ---
  const ping = await post("ai-workspace-quota", {
    action: "status",
    user_id: freeUser,
    surface: "ai-workspace",
    feature: "text_turn",
  });
  assert("ai-workspace-quota edge reachable", ping.status === 200, `HTTP ${ping.status}`);

  if (ping.status !== 200) {
    console.error("\nEdge not deployed or migration missing — remaining tests skipped");
    writeReport(runId, results);
    process.exitCode = 1;
    return;
  }

  assert(
    "free plan dailyLimit = 5",
    Number(ping.data.dailyLimit) === 5,
    `limit=${ping.data.dailyLimit}`
  );
  assert(
    "free plan remaining = 5",
    Number(ping.data.remaining) === 5,
    `remaining=${ping.data.remaining}`
  );

  // --- consume until exhausted (free) ---
  for (let i = 0; i < 5; i++) {
    const c = await post("ai-workspace-quota", {
      action: "consume",
      user_id: freeUser,
      surface: "ai-workspace",
      feature: "text_turn",
    });
    if (c.status !== 200 || !c.data.ok) {
      fail(`free consume ${i + 1}/5`, `HTTP ${c.status}`);
      break;
    }
    if (i === 4) pass("free consume 5/5");
  }

  const depleted = await post("ai-workspace-quota", {
    action: "check",
    user_id: freeUser,
    surface: "ai-workspace",
    feature: "text_turn",
  });
  assert(
    "free check blocked at 5/5",
    depleted.data.allowed === false && depleted.data.error === "quota_exceeded",
    `allowed=${depleted.data.allowed}`
  );

  const consumeBlocked = await post("ai-workspace-quota", {
    action: "consume",
    user_id: freeUser,
    surface: "ai-workspace",
    feature: "text_turn",
  });
  assert(
    "free consume returns 402 when depleted",
    consumeBlocked.status === 402 && consumeBlocked.data.error === "quota_exceeded",
    `HTTP ${consumeBlocked.status}`
  );

  // --- chat edge 402 bypass prevention ---
  const chatBlocked = await post("openai-chat", {
    message: "quota block probe",
    history: [],
    surface: "ai-workspace",
    user_id: freeUser,
  });
  assert(
    "openai-chat 402 when workspace quota depleted",
    chatBlocked.status === 402 && chatBlocked.data.error === "quota_exceeded",
    `HTTP ${chatBlocked.status}`
  );

  // --- non-workspace surface skips quota ---
  const nonWs = await post("openai-chat", {
    message: "non workspace probe",
    history: [],
    user_id: freeUser,
  });
  assert(
    "non-workspace surface skips quota block",
    nonWs.status !== 402,
    `HTTP ${nonWs.status}`
  );

  // --- Standard (basic_300) limit 30 ---
  const basicOk = await setupPlanUser(basicUser, "genai_basic_300");
  if (basicOk) {
    const basicStatus = await post("ai-workspace-quota", {
      action: "status",
      user_id: basicUser,
      surface: "ai-workspace",
    });
    assert(
      "basic_300 dailyLimit = 30",
      Number(basicStatus.data.dailyLimit) === 30,
      `limit=${basicStatus.data.dailyLimit}`
    );
  } else {
    fail("basic_300 plan setup", "stripe-e2e-simulate unavailable");
  }

  // --- Pro (pro_980) limit 100 ---
  const proOk = await setupPlanUser(proUser, "genai_pro_980");
  if (proOk) {
    const proStatus = await post("ai-workspace-quota", {
      action: "status",
      user_id: proUser,
      surface: "ai-workspace",
    });
    assert(
      "pro_980 dailyLimit = 100",
      Number(proStatus.data.dailyLimit) === 100,
      `limit=${proStatus.data.dailyLimit}`
    );
  } else {
    fail("pro_980 plan setup", "stripe-e2e-simulate unavailable");
  }

  // --- error code unified ---
  assert(
    "error code quota_exceeded unified",
    chatBlocked.data.error === "quota_exceeded" && chatBlocked.data.feature === "text_turn",
    JSON.stringify(chatBlocked.data).slice(0, 120)
  );

  writeReport(runId, results);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) process.exitCode = 1;
}

function writeReport(runId, rows) {
  const outDir = join(root, "reports");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "tasful-ai-workspace-quota-edge-last.json");
  writeFileSync(
    out,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        runId,
        edgeBase: base,
        dateJst: tokyoDateKey(),
        results: rows,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
