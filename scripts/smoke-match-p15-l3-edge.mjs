#!/usr/bin/env node
/**
 * P15-L3 Edge smoke — deploy + linked ref verification + L9 regression
 *
 *   node scripts/smoke-match-p15-l3-edge.mjs
 *   node scripts/smoke-match-p15-l3-edge.mjs --skip-deploy
 *   node scripts/smoke-match-p15-l3-edge.mjs --skip-deploy --skip-grants
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWLIST_SLOTS,
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipGrants = process.argv.includes("--skip-grants");

export const P15_EDGE_FUNCTIONS = Object.freeze([
  "match-favorite",
  "match-unfavorite",
  "match-list-favorites",
  "match-record-profile-view",
  "match-list-profile-views",
  "match-save-search",
  "match-list-saved-searches",
  "match-delete-saved-search",
  "match-get-compatibility",
  "match-get-profile-completeness",
  "match-update-activity",
]);

const L9_FUNCTIONS = Object.freeze([
  "match-record-swipe",
  "match-list-pairs",
  "match-ensure-talk-room",
  "match-submit-report",
  "match-block-user",
  "match-submit-verification",
  "match-admin-review",
  "match-moderation-log",
]);

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

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function parseCliJson(out) {
  const jsonMatch = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

async function authFetch(cfg, { method, pathSuffix, body, bearer }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${bearer || cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function loginT1(cfg) {
  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: slotByName("T1").email, password: cfg.password },
  });
  if (!res.ok || !res.data?.access_token) throw new Error(`T1 login HTTP ${res.status}`);
  return res.data.access_token;
}

async function loginT2(cfg) {
  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: slotByName("T2").email, password: cfg.password },
  });
  if (!res.ok || !res.data?.access_token) throw new Error(`T2 login HTTP ${res.status}`);
  return res.data.access_token;
}

async function edgePost(cfg, functionName, body, token, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }
    if (res.status !== 502 || attempt === retries) {
      return { status: res.status, json, text };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("edgePost retry exhausted");
}

function assertNo5xx(label, status) {
  if (status >= 500) throw new Error(`${label} HTTP ${status}`);
}

function assertNoRawTimestamps(json, label) {
  const blob = JSON.stringify(json ?? {});
  if (/last_active_at/i.test(blob)) {
    throw new Error(`${label} leaked last_active_at in response`);
  }
}

function deployP15Functions() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...P15_EDGE_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout).slice(0, 800));
  }
}

function verifyP15Listed() {
  const r = runSupabaseCli(["functions", "list", "--project-ref", PROJECT_REF, "-o", "json"]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(combined.slice(0, 400));
  const start = combined.indexOf("[");
  const end = combined.lastIndexOf("]");
  if (start < 0) throw new Error("functions list parse failed");
  const list = JSON.parse(combined.slice(start, end + 1));
  const slugs = new Set(list.map((f) => f.slug || f.name));
  const missing = P15_EDGE_FUNCTIONS.filter((n) => !slugs.has(n));
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
}

async function runP15Smoke(cfg, t1, t2) {
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const noAuth = await fetch(`${cfg.url}/functions/v1/match-favorite`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: "t2" }),
  });
  assertNo5xx("no auth", noAuth.status);
  if (noAuth.status !== 401) throw new Error(`no auth expected 401 got ${noAuth.status}`);

  const fav = await edgePost(cfg, "match-favorite", { target_user_id: "t2", source: "profile" }, t1);
  assertNo5xx("match-favorite", fav.status);
  if (fav.status !== 200 || fav.json?.ok !== true) throw new Error(`favorite ${fav.status}`);
  assertNoRawTimestamps(fav.json, "match-favorite");

  const listFav = await edgePost(cfg, "match-list-favorites", { limit: 10 }, t1);
  assertNo5xx("match-list-favorites", listFav.status);
  if (listFav.status !== 200 || !Array.isArray(listFav.json?.items)) {
    throw new Error(`list-favorites ${listFav.status}`);
  }
  assertNoRawTimestamps(listFav.json, "match-list-favorites");

  const unfav = await edgePost(cfg, "match-unfavorite", { target_user_id: "t2" }, t1);
  if (unfav.status !== 200 || unfav.json?.unfavorited !== true) {
    throw new Error(`unfavorite ${unfav.status}`);
  }

  const recordView = await edgePost(
    cfg,
    "match-record-profile-view",
    { viewed_user_id: "t2", source: "profile_detail" },
    t1,
  );
  if (recordView.status !== 200 || recordView.json?.recorded !== true) {
    throw new Error(`record-profile-view ${recordView.status} ${recordView.text?.slice(0, 200)}`);
  }

  const listViews = await edgePost(cfg, "match-list-profile-views", { limit: 10 }, t2);
  if (listViews.status !== 200 || !Array.isArray(listViews.json?.items)) {
    throw new Error(`list-profile-views ${listViews.status}`);
  }
  assertNoRawTimestamps(listViews.json, "match-list-profile-views");
  if (listViews.json.items.length < 1) throw new Error("T2 incoming footprint missing");

  const save = await edgePost(
    cfg,
    "match-save-search",
    {
      name: "smoke-search",
      filters_json: { age_min: 25, verified_only: true },
      is_default: true,
    },
    t1,
  );
  if (save.status !== 200 || !save.json?.search_id) throw new Error(`save-search ${save.status}`);

  const listSearch = await edgePost(cfg, "match-list-saved-searches", {}, t1);
  if (listSearch.status !== 200 || !Array.isArray(listSearch.json?.items)) {
    throw new Error(`list-saved-searches ${listSearch.status}`);
  }

  const delSearch = await edgePost(
    cfg,
    "match-delete-saved-search",
    { id: save.json.search_id },
    t1,
  );
  if (delSearch.status !== 200 || delSearch.json?.deleted !== true) {
    throw new Error(`delete-saved-search ${delSearch.status}`);
  }

  const completeness = await edgePost(cfg, "match-get-profile-completeness", {}, t1);
  if (completeness.status !== 200 || typeof completeness.json?.percent !== "number") {
    throw new Error(`get-profile-completeness ${completeness.status} ${completeness.text?.slice(0, 200)}`);
  }
  assertNoRawTimestamps(completeness.json, "match-get-profile-completeness");

  const compat = await edgePost(cfg, "match-get-compatibility", { target_user_id: "t2" }, t1);
  assertNo5xx("match-get-compatibility", compat.status);
  if (compat.status !== 200 && compat.status !== 404) {
    throw new Error(`get-compatibility ${compat.status}`);
  }
  assertNoRawTimestamps(compat.json, "match-get-compatibility");

  const activity = await edgePost(cfg, "match-update-activity", {}, t1);
  if (activity.status !== 200 || !activity.json?.activity_label) {
    throw new Error(`update-activity ${activity.status} ${activity.text?.slice(0, 200)}`);
  }
  assertNoRawTimestamps(activity.json, "match-update-activity");
  if ("last_active_at" in (activity.json ?? {})) {
    throw new Error("update-activity returned last_active_at");
  }
}

async function runL9Regression(cfg, t1) {
  const warm = await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1);
  if (warm.status !== 200) throw new Error(`L9 swipe ${warm.status}`);

  const self = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t1);
  if (self.status !== 422) throw new Error(`L9 self swipe ${self.status}`);

  for (const [name, body] of [
    ["match-submit-report", { reported_user_id: "t2", reason: "harassment", detail: "p15 smoke" }],
    ["match-block-user", { blocked_user_id: "t3", reason: "smoke" }],
    ["match-submit-verification", { verification_type: "phone", metadata: {} }],
  ]) {
    const res = await edgePost(cfg, name, body, t1);
    if (res.status !== 200 || res.json?.ok !== true) throw new Error(`L9 ${name} ${res.status}`);
  }

  const admin = await edgePost(
    cfg,
    "match-admin-review",
    {
      target_type: "report",
      target_id: "00000000-0000-4000-8000-000000000001",
      action: "dismiss",
      note: "smoke",
    },
    t1,
  );
  if (admin.status !== 403) throw new Error(`L9 admin ${admin.status}`);
}

async function main() {
  const cfg = loadL7Config();
  console.log(`P15-L3 Edge smoke · ref=${PROJECT_REF}`);

  try {
    const post = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", "sql/match-p15-l1-post-gates.sql"]);
    const row = parseCliJson(`${post.stdout}\n${post.stderr}`)?.rows?.[0];
    if (post.status !== 0 || !row) throw new Error("post-gates query failed");
    if (Number(row.p15_table_count) !== 6 || Number(row.core_policy_count) !== 20) {
      throw new Error("post-gates baseline mismatch");
    }
    pass("P15-L1 post-gates baseline", "p15_table_count=6 core_policy_count=20");
  } catch (e) {
    fail("P15-L1 post-gates baseline", e.message);
    process.exit(1);
  }

  if (!skipGrants) {
    try {
      const gr = runSupabaseCli([
        "db",
        "query",
        "--linked",
        "--yes",
        "-f",
        "supabase/migrations/20260622200000_match_p15_l3_rpc_grants.sql",
      ]);
      if (gr.status !== 0) throw new Error((gr.stderr || gr.stdout).slice(0, 400));
      pass("RPC GRANT migration", "20260622200000_match_p15_l3_rpc_grants.sql");
    } catch (e) {
      fail("RPC GRANT migration", e.message);
      process.exit(1);
    }
  } else {
    pass("RPC GRANT migration", "skipped");
  }

  if (!skipDeploy) {
    try {
      deployP15Functions();
      pass("Deploy P15 Edge", `${P15_EDGE_FUNCTIONS.length} functions`);
    } catch (e) {
      fail("Deploy P15 Edge", e.message);
      console.log("\nJudgment: BLOCKED_WITH_REASON — deploy failed; smoke not run");
      process.exit(1);
    }
  } else {
    pass("Deploy P15 Edge", "skipped (--skip-deploy)");
  }

  try {
    verifyP15Listed();
    pass("Functions list", `${P15_EDGE_FUNCTIONS.length} P15 ACTIVE`);
  } catch (e) {
    fail("Functions list", e.message);
    process.exit(1);
  }

  let t1;
  let t2;
  try {
    t1 = await loginT1(cfg);
    t2 = await loginT2(cfg);
    pass("T1/T2 login", "JWT acquired");
  } catch (e) {
    fail("T1/T2 login", e.message);
    process.exit(1);
  }

  try {
    await runP15Smoke(cfg, t1, t2);
    pass("P15 remote smoke", "11 functions · no last_active_at leak");
  } catch (e) {
    fail("P15 remote smoke", e.message);
    process.exit(1);
  }

  try {
    await runL9Regression(cfg, t1);
    pass("L9 regression", "swipe/report/block/verification/admin 403");
  } catch (e) {
    fail("L9 regression", e.message);
    process.exit(1);
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nSmoke result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_P15_L4_UI");
}

main().catch((e) => {
  console.error(e);
  console.log("Judgment: BLOCKED_WITH_REASON");
  process.exit(1);
});
