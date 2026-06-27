#!/usr/bin/env node
/**
 * TASFUL AI Workspace Phase 2 — client quota unit tests (no Edge · no jsdom)
 *   node scripts/test-ai-workspace-quota-unit.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

function bootUsage() {
  const storage = {};
  const mock = {
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => {
        storage[k] = String(v);
      },
      removeItem: (k) => {
        delete storage[k];
      },
    },
    location: { search: "" },
    document: {
      readyState: "complete",
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {},
    },
    addEventListener: () => {},
    __TASU_WORKSPACE_USAGE_TEST__: true,
    __TASU_WORKSPACE_USAGE_PHASE2__: false,
    TASU_CHAT_SUPABASE_CONFIG: { url: "https://example.supabase.co", currentUserId: "u_unit" },
    TasuStripeGenAiConfig: {
      FREE_PLAN: { plan: "free", label: "無料枠", dailyTextLimit: 5 },
    },
    fetch: async () => ({ status: 500, json: async () => ({}) }),
  };
  Object.assign(globalThis, mock);
  globalThis.window = globalThis;
  const src = readFileSync(join(root, "ai-workspace-usage.js"), "utf8");
  eval(src);
  return { U: globalThis.TasuAiWorkspaceUsage, storage };
}

async function main() {
  const { U, storage } = bootUsage();
  assert("TasuAiWorkspaceUsage exported", Boolean(U?.canUse));
  assert("phase2 disabled in test mode", U.isPhase2ServerEnabled() === false);

  const today = U.getUsage().date;
  U.applyServerStatusToCache({
    dailyLimit: 30,
    remaining: 28,
    used: 2,
    planCode: "basic_300",
    planLabel: "スタンダード",
  });
  assert("cache apply remaining", U.getDailyRemaining() === 28, `rem=${U.getDailyRemaining()}`);
  assert("cache apply limit", U.getDailyLimit() === 30, `lim=${U.getDailyLimit()}`);

  U.consumeLocal("text_turn");
  assert("local consume decrements cache", U.getDailyRemaining() === 27, `rem=${U.getDailyRemaining()}`);

  assert(
    "shouldChargeTurn rejects 402",
    U.shouldChargeTurn({ usedRemote: true, reply: "x", apiHttpStatus: 402 }) === false
  );
  assert(
    "shouldChargeTurn accepts remote",
    U.shouldChargeTurn({ usedRemote: true, reply: "ok", apiHttpStatus: 200 }) === true
  );

  storage[U.STORAGE_USAGE] = JSON.stringify({ date: today, textTurnUsed: 5 });
  storage.tasu_genai_plan = JSON.stringify({ plan: "free", label: "無料枠", dailyTextLimit: 5 });
  U.applyServerStatusToCache({ dailyLimit: 5, remaining: 0, used: 5 });
  assert("canUse false when depleted", U.canUse("text_turn") === false);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
