#!/usr/bin/env node
/**
 * Diff & Approve — Decision Write E2E (API + UI static + Apply isolation)
 *   node scripts/test-diff-approve-staging-decision-write-e2e.mjs
 *
 * Uses Staging DB via .env.staging. Optional --base for HTTP GET regression.
 * No Production · No Apply · No Provider.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const REPORT = path.join(
  ROOT,
  "reports/diff-approve-staging-decision-write-e2e-summary.json"
);

let pass = 0;
let fail = 0;
const failures = [];

function ok(label) {
  pass += 1;
  console.log(`  ✓ ${label}`);
}
function bad(label, detail) {
  fail += 1;
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

function loadEnvFile(rel) {
  const p = path.join(ROOT, rel);
  const o = {};
  if (!existsSync(p)) return o;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

const staging = loadEnvFile(".env.staging");
const url = String(staging.TASFUL_SUPABASE_URL || staging.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const service = String(staging.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const anon = String(
  staging.TASFUL_SUPABASE_ANON_KEY || staging.SUPABASE_ANON_KEY || ""
).trim();

if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF) || !service) {
  console.error("FAIL: Staging .env.staging required");
  process.exit(1);
}

console.log("0) Unit suite");
const unit = spawnSync(
  process.execPath,
  [path.join(ROOT, "scripts/test-diff-approve-staging-decision-write.mjs")],
  { cwd: ROOT, encoding: "utf8" }
);
if (unit.status === 0) ok("unit+staging suite PASS");
else bad("unit+staging suite", unit.stdout?.slice(-200) || String(unit.status));

console.log("\n1) UI static / Apply isolation");
const html = readFileSync(path.join(ROOT, "admin-diff-approve.html"), "utf8");
const css = readFileSync(path.join(ROOT, "admin-diff-approve.css"), "utf8");
const client = readFileSync(
  path.join(ROOT, "admin-diff-approve-client.js"),
  "utf8"
);
const route = readFileSync(
  path.join(
    ROOT,
    "deploy/cloudflare/functions/api/ai-diff-approve/[id]/decision.js"
  ),
  "utf8"
);
if (/STAGING/.test(html) && /DECISION WRITE/.test(html) && /NO APPLY/.test(html)) {
  ok("badges STAGING / DECISION WRITE / NO APPLY");
} else bad("badges");
if (!/>\s*Apply\s*</i.test(html) && !/Force Approve|Bypass|Retry Apply/.test(html + client)) {
  ok("no Apply/Force/Bypass UI");
} else bad("forbidden UI present");
if (/dda-badge--write/.test(css) && /dda-decision/.test(css)) ok("decision CSS present");
else bad("decision CSS");
if (/recordOperatorDecision/.test(route) && !/performApply|executeProvider/.test(route)) {
  ok("decision route Apply-isolated");
} else bad("decision route isolation");
if (/desktop|390|768|1280|flex-wrap|dda-layout/.test(html + css)) {
  ok("responsive layout hooks");
} else bad("responsive hooks");

console.log("\n2) Staging decision flows + timeline");
const { recordOperatorDecision } = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-write.mjs"
    )
  ).href
);
const { createPersistentRepository } = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs"
    )
  ).href
);

const env = {
  AI_EXEC_GATE_ENVIRONMENT: "staging",
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: service,
  DIFF_APPROVE_PERSISTENCE_ENABLED: "true",
  DIFF_APPROVE_READ_ENABLED: "true",
  DIFF_APPROVE_APPLY_ENABLED: "false",
};
const actorId = randomUUID();
const ids = {
  approve: randomUUID(),
  reject: randomUUID(),
  cancel: randomUUID(),
};

async function seed(id) {
  const res = await fetch(`${url}/rest/v1/ai_diff_approve_proposals`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      proposal_id: id,
      status: "draft",
      record_version: 1,
      environment: "staging",
      payload: { status: "draft", ns: "decision_write_e2e" },
    }),
  });
  return res.ok || res.status === 201;
}

for (const [k, id] of Object.entries(ids)) {
  if (await seed(id)) ok(`seed ${k}`);
  else bad(`seed ${k}`);
}

const propose = await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.approve,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "e2e2-propose-approve",
  },
});
if (propose.ok && propose.body?.currentStatus === "pending_approval") {
  ok("submit proposal");
} else bad("submit proposal", propose.error);

const repo = createPersistentRepository({ env });
const tl1 = await repo.getAuditTimeline(ids.approve);
if (
  Array.isArray(tl1) &&
  tl1.some((e) => e.event_type === "proposal_submitted")
) {
  ok("timeline reflects proposal");
} else bad("timeline proposal");

const approve = await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.approve,
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "e2e2-approve",
  },
});
if (
  approve.ok &&
  approve.body?.currentStatus === "approved" &&
  approve.body?.applied === false
) {
  ok("approve proposal stops without Apply");
} else bad("approve", approve.error);

const tl2 = await repo.getAuditTimeline(ids.approve);
if (
  Array.isArray(tl2) &&
  tl2.some((e) => e.event_type === "approval_granted")
) {
  ok("timeline reflects approval");
} else bad("timeline approval");

await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.reject,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "e2e2-rej-p",
  },
});
const rejected = await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.reject,
    action: "reject",
    expectedVersion: 2,
    idempotencyKey: "e2e2-rej-d",
  },
});
if (rejected.ok && rejected.body?.currentStatus === "rejected") ok("reject independent");
else bad("reject independent");

await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.cancel,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "e2e2-can-p",
  },
});
const cancelled = await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.cancel,
    action: "cancel",
    expectedVersion: 2,
    idempotencyKey: "e2e2-can-d",
  },
});
if (cancelled.ok && cancelled.body?.currentStatus === "cancelled") ok("cancel independent");
else bad("cancel independent");

const replay = await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.approve,
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "e2e2-approve",
  },
});
if (replay.ok && replay.body?.replayed === true) ok("duplicate submit replay");
else bad("duplicate replay", replay.error);

const stale = await recordOperatorDecision({
  env,
  actor: { userId: actorId },
  body: {
    requestId: ids.reject,
    action: "approve",
    expectedVersion: 1,
    idempotencyKey: "e2e2-stale",
  },
});
if (
  !stale.ok &&
  (stale.error === "VERSION_CONFLICT" ||
    stale.error === "ALREADY_DECIDED" ||
    stale.error === "INVALID_STATE_TRANSITION")
) {
  ok("stale/decided conflict");
} else bad("stale conflict", stale.error);

if (anon) {
  const anonRes = await fetch(
    `${url}/rest/v1/rpc/ai_diff_approve_record_decision`,
    {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_input: { proposal_id: ids.approve } }),
    }
  );
  if (!anonRes.ok) ok("unauthorized/anonymous RPC denied");
  else bad("anonymous RPC unexpectedly ok");
}

console.log("\n3) GET regression / no Apply network surface");
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = (
  baseIdx >= 0 ? args[baseIdx + 1] : process.env.DIFF_APPROVE_E2E_BASE || ""
).replace(/\/$/, "");
if (base) {
  const page = await fetch(`${base}/admin-diff-approve.html`);
  if (page.status === 200) ok(`GET page ${base}`);
  else bad("GET page", String(page.status));
  const text = await page.text();
  if (/NO APPLY/.test(text) && !/>\s*Apply\s*</i.test(text)) ok("page NO APPLY");
  else bad("page Apply leak");
} else {
  console.log("  · skip HTTP base (pass --base)");
}

writeFileSync(
  REPORT,
  JSON.stringify(
    {
      verdict: fail === 0 ? "PASS_STAGING_DECISION_WRITE_E2E" : "FAIL",
      pass,
      fail,
      failures,
      staging_ref: STAGING_REF,
      production: "NOT_TOUCHED",
      apply: "NOT_EXECUTED",
      provider: "NOT_EXECUTED",
    },
    null,
    2
  )
);

console.log("\n---");
console.log(`pass=${pass} fail=${fail}`);
if (fail) process.exit(1);
console.log("PASS_STAGING_DECISION_WRITE_E2E");
process.exit(0);
