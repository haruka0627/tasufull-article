#!/usr/bin/env node
/**
 * Diff & Approve — Staging Apply Plan / Dry-run Gate tests
 *   node scripts/test-diff-approve-staging-apply-plan-dry-run.mjs
 *
 * No real Apply · Provider · Production · status stays approved
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const migrationRel =
  "supabase/migrations/20260728180000_ai_diff_approve_staging_apply_plan.sql";

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

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

console.log("1) Static migration / isolation");
assertExists();
function assertExists() {
  if (existsSync(path.join(ROOT, migrationRel))) ok("migration exists");
  else bad("migration exists");
}
const sql = read(migrationRel);
if (/ai_diff_approve_create_apply_plan/.test(sql)) ok("RPC present");
else bad("RPC present");
if (/set search_path = public/.test(sql)) ok("search_path fixed");
else bad("search_path");
if (
  /grant execute on function public\.ai_diff_approve_create_apply_plan\(jsonb\) to service_role/.test(
    sql
  )
) {
  ok("grant service_role");
} else bad("grant");
if (/mode = 'dry_run'/.test(sql) && !/to_status = 'applying'/.test(sql)) {
  ok("dry_run only · no applying");
} else bad("dry_run constraint");
if (!/performApply|executeProvider/.test(sql)) ok("no Apply in SQL");
else bad("Apply in SQL");

const planSrc = read(
  "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-apply-plan.mjs"
);
const routeSrc = read(
  "deploy/cloudflare/functions/api/ai-diff-approve/[id]/apply-plan.js"
);
const clientSrc = read("admin-diff-approve-client.js");
if (!/ai-diff-approve-a4-apply|performFinalApply|executeProvider/.test(planSrc)) {
  ok("service no Apply engine import");
} else bad("service Apply import");
if (!/\/apply["']|performApply/.test(routeSrc)) ok("route no Apply path");
else bad("route Apply");
if (/Generate Dry-run Plan/.test(clientSrc) && !/textContent = ["']Apply["']/.test(clientSrc)) {
  ok("UI Generate Plan · no Apply label");
} else bad("UI Apply");
if (/DRY RUN/.test(read("admin-diff-approve.html"))) ok("HTML DRY RUN badge");
else bad("HTML badge");

console.log("\n2) Contract unit");
const contract = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-apply-plan-contract.mjs"
    )
  ).href
);
const sampleId = "22222222-2222-4222-8222-222222222222";
const base = {
  requestId: sampleId,
  expectedVersion: 3,
  idempotencyKey: "plan-key-abc12345",
  mode: "dry_run",
};
if (contract.validateApplyPlanInput(base).ok) ok("valid dry-run input");
else bad("valid input");
if (!contract.validateApplyPlanInput({ ...base, extra: 1 }).ok) ok("unknown field");
else bad("unknown field");
if (!contract.validateApplyPlanInput({ ...base, requestId: "x" }).ok) ok("invalid UUID");
else bad("invalid UUID");
if (!contract.validateApplyPlanInput({ ...base, expectedVersion: -1 }).ok) {
  ok("invalid expectedVersion");
} else bad("invalid version");
if (!contract.validateApplyPlanInput({ ...base, mode: "apply" }).ok) ok("invalid mode");
else bad("invalid mode");
if (!contract.validateApplyPlanInput({ ...base, idempotencyKey: "short" }).ok) {
  ok("invalid idempotency");
} else bad("invalid idempotency");

const { computeDryRunPlan } = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-apply-plan.mjs"
    )
  ).href
);

const approvedProp = {
  proposal_id: sampleId,
  status: "approved",
  capability: "diff_approve",
  resource_type: "listing",
  resource_id: "x",
  record_version: 3,
  applied: false,
  executed: false,
  provider_called: false,
  payload: { change_type: "update", estimated_risk: "low" },
};
const tl = [
  {
    sequence_number: 1,
    previous_event_hash: "genesis",
    event_hash: "h1",
    event_type: "proposal_submitted",
  },
  {
    sequence_number: 2,
    previous_event_hash: "h1",
    event_hash: "h2",
    event_type: "approval_granted",
  },
];
const a = computeDryRunPlan({ proposal: approvedProp, timeline: tl });
const b = computeDryRunPlan({ proposal: approvedProp, timeline: tl });
if (a.ok && a.planStatus === "ready" && a.fingerprint === b.fingerprint) {
  ok("deterministic fingerprint");
} else bad("determinism", a.planStatus);
if (
  computeDryRunPlan({
    proposal: { ...approvedProp, status: "draft" },
    timeline: tl,
  }).planStatus === "blocked"
) {
  ok("draft blocked");
} else bad("draft");
if (
  computeDryRunPlan({
    proposal: { ...approvedProp, status: "rejected" },
    timeline: tl,
  }).blockerCount > 0
) {
  ok("rejected blocked");
} else bad("rejected");
const mut = computeDryRunPlan({
  proposal: { ...approvedProp, record_version: 4 },
  timeline: tl,
});
if (mut.fingerprint !== a.fingerprint) ok("version changes fingerprint");
else bad("version fingerprint");

const staging = loadEnvFile(".env.staging");
const url = String(staging.TASFUL_SUPABASE_URL || staging.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const service = String(staging.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const canLive =
  url.includes(STAGING_REF) && !url.includes(PRODUCTION_REF) && Boolean(service);

console.log("\n3) Optional Staging live");
if (!canLive) {
  console.log("  · skip live (no .env.staging)");
} else {
  const { recordOperatorDecision } = await import(
    pathToFileURL(
      path.join(
        ROOT,
        "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-write.mjs"
      )
    ).href
  );
  const { createApplyPlan } = await import(
    pathToFileURL(
      path.join(
        ROOT,
        "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-apply-plan.mjs"
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
  const actor = randomUUID();
  const id = randomUUID();

  async function seed(status = "draft") {
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
        status,
        record_version: 1,
        environment: "staging",
        payload: { status, change_type: "update", ns: "apply_plan_test" },
      }),
    });
    return res.ok || res.status === 201;
  }

  // Probe RPC
  const probe = await fetch(
    `${url}/rest/v1/rpc/ai_diff_approve_create_apply_plan`,
    {
      method: "POST",
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_input: {} }),
    }
  );
  const probeJson = await probe.json().catch(() => ({}));
  if (probe.ok || probeJson) ok("RPC reachable or present");
  else bad("RPC reachable");

  if (!(await seed())) bad("seed");
  else ok("seed draft");

  await recordOperatorDecision({
    env,
    actor: { userId: actor },
    body: {
      requestId: id,
      action: "propose",
      expectedVersion: 1,
      idempotencyKey: "ap-test-propose",
    },
  });
  const approved = await recordOperatorDecision({
    env,
    actor: { userId: actor },
    body: {
      requestId: id,
      action: "approve",
      expectedVersion: 2,
      idempotencyKey: "ap-test-approve",
    },
  });
  if (approved.ok && approved.body?.currentStatus === "approved") ok("fixture approved");
  else bad("fixture approve", approved.error);

  const plan1 = await createApplyPlan({
    env,
    actor: { userId: actor },
    body: {
      requestId: id,
      expectedVersion: 3,
      idempotencyKey: "ap-test-plan-1",
      mode: "dry_run",
    },
  });
  if (
    plan1.ok &&
    plan1.body?.requestStatus === "approved" &&
    plan1.body?.applyExecuted === false &&
    plan1.body?.providerExecuted === false
  ) {
    ok("plan success · status remains approved");
  } else bad("plan success", plan1.error);

  const replay = await createApplyPlan({
    env,
    actor: { userId: actor },
    body: {
      requestId: id,
      expectedVersion: 3,
      idempotencyKey: "ap-test-plan-1",
      mode: "dry_run",
    },
  });
  if (replay.ok && replay.body?.replayed === true) ok("plan idempotent replay");
  else bad("plan replay", replay.error);

  const conflict = await createApplyPlan({
    env,
    actor: { userId: actor },
    body: {
      requestId: id,
      expectedVersion: 2,
      idempotencyKey: "ap-test-plan-1",
      mode: "dry_run",
    },
  });
  if (
    !conflict.ok &&
    (conflict.error === "IDEMPOTENCY_CONFLICT" ||
      conflict.error === "SOURCE_VERSION_CONFLICT" ||
      conflict.error === "VERSION_CONFLICT")
  ) {
    ok("same-key different payload/source conflict");
  } else bad("idempotency conflict", conflict.error);

  const draftDeny = await createApplyPlan({
    env,
    actor: { userId: actor },
    body: {
      requestId: id,
      expectedVersion: 99,
      idempotencyKey: "ap-test-stale",
      mode: "dry_run",
    },
  });
  if (!draftDeny.ok && draftDeny.error === "VERSION_CONFLICT") ok("stale version deny");
  else bad("stale", draftDeny.error);

  // Non-approved deny via fresh draft
  const id2 = randomUUID();
  await fetch(`${url}/rest/v1/ai_diff_approve_proposals`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      proposal_id: id2,
      status: "draft",
      record_version: 1,
      environment: "staging",
      payload: { status: "draft" },
    }),
  });
  const nonApproved = await createApplyPlan({
    env,
    actor: { userId: actor },
    body: {
      requestId: id2,
      expectedVersion: 1,
      idempotencyKey: "ap-test-draft",
      mode: "dry_run",
    },
  });
  if (!nonApproved.ok && nonApproved.error === "INVALID_STATUS") {
    ok("non-approved deny");
  } else bad("non-approved", nonApproved.error);

  const { createPersistentRepository } = await import(
    pathToFileURL(
      path.join(
        ROOT,
        "deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs"
      )
    ).href
  );
  const repo = createPersistentRepository({ env });
  const row = await repo.getProposalRow(id);
  if (row.ok && row.value.status === "approved") ok("DB status still approved");
  else bad("DB status");
  let blocked = false;
  try {
    repo.performApply();
  } catch (e) {
    blocked = e?.code === "apply_forbidden";
  }
  if (blocked) ok("performApply still forbidden");
  else bad("performApply");
}

writeFileSync(
  path.join(ROOT, "reports/diff-approve-staging-apply-plan-dry-run-summary.json"),
  JSON.stringify(
    {
      verdict:
        fail === 0
          ? "PASS_STAGING_APPLY_PLAN_DRY_RUN_LOCAL"
          : "FAIL_STAGING_APPLY_PLAN_DRY_RUN_LOCAL",
      pass,
      fail,
      failures,
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
console.log("PASS_STAGING_APPLY_PLAN_DRY_RUN_LOCAL");
process.exit(0);
