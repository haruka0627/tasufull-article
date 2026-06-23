#!/usr/bin/env node
/**
 * MATCH core E2E smoke — swipe · pairs · list · TALK bridge wiring
 *
 *   node scripts/smoke-match-core-e2e.mjs
 *   node scripts/smoke-match-core-e2e.mjs --live --functions-base https://xxx.supabase.co/functions/v1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

function checkStaticWiring() {
  const apiPath = path.join(ROOT, "match", "match-api.js");
  const wiringPath = path.join(ROOT, "match", "match-wiring.js");
  const corePath = path.join(ROOT, "match", "match-core-wiring.js");
  const listHtml = path.join(ROOT, "match", "match-list.html");
  const coreTs = path.join(ROOT, "supabase", "functions", "_shared", "match-core.ts");
  const listFn = path.join(ROOT, "supabase", "functions", "match-list-pairs", "index.ts");

  const apiSrc = fs.readFileSync(apiPath, "utf8");
  const wiringSrc = fs.readFileSync(wiringPath, "utf8");
  const listSrc = fs.readFileSync(listHtml, "utf8");

  if (!fs.existsSync(corePath)) {
    fail("match-core-wiring.js", "missing");
    return;
  }
  pass("match-core-wiring.js", "present");

  if (!apiSrc.includes("listPairs") || !apiSrc.includes('"match-list-pairs"')) {
    fail("match-api listPairs", "edge path missing");
  } else {
    pass("match-api listPairs", "match-list-pairs registered");
  }

  if (!apiSrc.includes('mode: "client_stub"') || !apiSrc.includes("return success({ pairs: [] })")) {
    fail("client_stub listPairs", "stub default broken");
  } else {
    pass("client_stub listPairs", "empty pairs preserved");
  }

  if (!wiringSrc.includes("result.matched && result.pair_id")) {
    fail("swipe matched redirect", "missing talk-bridge redirect");
  } else {
    pass("swipe matched redirect", "match-talk-bridge.html?pair_id=");
  }

  if (!listSrc.includes("match-core-wiring.js")) {
    fail("match-list.html scripts", "match-core-wiring.js not included");
  } else {
    pass("match-list.html scripts", "core wiring loaded");
  }

  if (!fs.existsSync(coreTs) || !fs.existsSync(listFn)) {
    fail("edge functions", "match-core.ts or match-list-pairs missing");
  } else {
    pass("edge functions", "match-core + match-list-pairs");
  }
}

async function runLiveEdgeSmoke(functionsBase) {
  const base = functionsBase.replace(/\/$/, "");

  async function post(name, body, token) {
    const res = await fetch(`${base}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  const swipeStub = await post(
    "match-record-swipe",
    { target_user_id: "00000000-0000-4000-8000-000000000002", action: "like" },
    "stub-match-token",
  );
  if (swipeStub.status === 200 && swipeStub.json.ok && swipeStub.json.mode === "stub") {
    pass("live record-swipe stub token", "mode=stub");
  } else {
    fail("live record-swipe stub token", JSON.stringify(swipeStub));
  }

  const listStub = await post("match-list-pairs", {}, "stub-match-token");
  if (listStub.status === 200 && listStub.json.ok && Array.isArray(listStub.json.pairs)) {
    pass("live list-pairs stub token", `pairs=${listStub.json.pairs.length}`);
  } else {
    fail("live list-pairs stub token", JSON.stringify(listStub));
  }

  const noAuth = await post("match-list-pairs", {}, "");
  if (noAuth.status === 401) {
    pass("live list-pairs anon", "401");
  } else {
    fail("live list-pairs anon", `status ${noAuth.status}`);
  }
}

async function main() {
  const live = process.argv.includes("--live");
  const functionsBase = parseArg("--functions-base") || process.env.MATCH_FUNCTIONS_BASE;

  console.log("smoke-match-core-e2e\n");

  checkStaticWiring();

  if (live && functionsBase) {
    await runLiveEdgeSmoke(functionsBase);
  } else {
    pass("live edge", "skipped (use --live --functions-base URL)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSmoke result: ${failed.length ? "FAIL" : "PASS"} (${results.length} checks)`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
