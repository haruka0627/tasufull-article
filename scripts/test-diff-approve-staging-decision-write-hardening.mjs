#!/usr/bin/env node
/**
 * Diff & Approve — Decision Write Operational Hardening (regression)
 *   node scripts/test-diff-approve-staging-decision-write-hardening.mjs
 *
 * Staging only · No Apply · No Provider · No Production · No migration repair
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";
const SUMMARY = path.join(
  ROOT,
  "reports/diff-approve-staging-decision-write-hardening-summary.json"
);

let pass = 0;
let fail = 0;
/** @type {string[]} */
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

function assertTimelineOrdered(timeline, label) {
  if (!Array.isArray(timeline) || !timeline.length) {
    bad(`${label} timeline empty`);
    return false;
  }
  if (timeline[0] && timeline[0].ok === false) {
    bad(`${label} timeline integrity`, timeline[0].reason);
    return false;
  }
  let prevSeq = 0;
  let prevHash = "genesis";
  let prevAt = "";
  for (const ev of timeline) {
    const seq = Number(ev.sequence_number);
    if (!Number.isInteger(seq) || seq !== prevSeq + 1) {
      bad(`${label} seq order`, `${prevSeq} -> ${seq}`);
      return false;
    }
    if (String(ev.previous_event_hash) !== prevHash) {
      bad(`${label} hash chain`, `seq=${seq}`);
      return false;
    }
    if (prevAt && ev.created_at && String(ev.created_at) < prevAt) {
      bad(`${label} created_at order`, String(ev.created_at));
      return false;
    }
    prevSeq = seq;
    prevHash = String(ev.event_hash);
    prevAt = String(ev.created_at || prevAt);
  }
  ok(`${label} timeline ordered + chained`);
  return true;
}

const staging = loadEnvFile(".env.staging");
const url = String(staging.TASFUL_SUPABASE_URL || staging.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const service = String(staging.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF) || !service) {
  console.error("FAIL: Staging .env.staging required");
  process.exit(1);
}

console.log("0) Baseline unit suite");
{
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts/test-diff-approve-staging-decision-write.mjs")],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (r.status === 0) ok("foundation unit suite");
  else bad("foundation unit suite", (r.stdout || "").slice(-160));
}

console.log("\n1) Migration history audit (read-only)");
{
  const list = spawnSync("npx.cmd", ["supabase", "migration", "list", "--linked"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const out = `${list.stdout || ""}\n${list.stderr || ""}`;
  const row14 = /20260728140000\s+\|\s+20260728140000/.test(out);
  const row16Local = /20260728160000/.test(out);
  const row16Remote = /20260728160000\s+\|\s+20260728160000/.test(out);
  if (row14) ok("persistence 140000 local=remote");
  else bad("persistence 140000 alignment");
  if (row16Local && !row16Remote) {
    ok("decision-write 160000 local-only history (DRIFT documented · no repair)");
  } else if (row16Remote) {
    ok("decision-write 160000 local=remote");
  } else bad("decision-write 160000 missing locally");
  ok("repair NOT performed (forbidden)");
  ok("SQL re-exec NOT performed");
}

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
const { listOpsProposals, getOpsProposalTimeline } = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-read.mjs"
    )
  ).href
);
const contract = await import(
  pathToFileURL(
    path.join(
      ROOT,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-contract.mjs"
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
const repo = createPersistentRepository({ env, ownerUserId: actorId });

async function seedDraft(id) {
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
      payload: { status: "draft", ns: "decision_write_hardening" },
    }),
  });
  return res.ok || res.status === 201;
}

async function decide(body) {
  return recordOperatorDecision({
    env,
    actor: { userId: actorId },
    body,
  });
}

console.log("\n2) Duplicate / idempotency matrix");
{
  const id = randomUUID();
  if (!(await seedDraft(id))) bad("seed dup-propose");
  else ok("seed dup-propose");

  const p1 = await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-propose-a",
  });
  if (p1.ok) ok("first propose");
  else bad("first propose", p1.error);

  const pDupKey = await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 2,
    idempotencyKey: "hard-propose-b",
  });
  if (
    !pDupKey.ok &&
    (pDupKey.error === "ALREADY_DECIDED" ||
      pDupKey.error === "INVALID_STATE_TRANSITION")
  ) {
    ok("duplicate propose new key denied");
  } else bad("duplicate propose new key", pDupKey.error);

  const a1 = await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "hard-approve-a",
  });
  if (a1.ok && a1.body?.currentStatus === "approved" && a1.body?.applied === false) {
    ok("approve once");
  } else bad("approve once", a1.error);

  const aReplay = await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "hard-approve-a",
  });
  if (aReplay.ok && aReplay.body?.replayed === true) ok("duplicate approve same-key replay");
  else bad("approve replay", aReplay.error);

  const aNew = await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 3,
    idempotencyKey: "hard-approve-b",
  });
  if (
    !aNew.ok &&
    (aNew.error === "ALREADY_DECIDED" || aNew.error === "INVALID_STATE_TRANSITION")
  ) {
    ok("duplicate approve new key denied");
  } else bad("duplicate approve new key", aNew.error);

  const rejectAfter = await decide({
    requestId: id,
    action: "reject",
    expectedVersion: 3,
    idempotencyKey: "hard-reject-after-approve",
  });
  if (
    !rejectAfter.ok &&
    (rejectAfter.error === "ALREADY_DECIDED" ||
      rejectAfter.error === "INVALID_STATE_TRANSITION")
  ) {
    ok("reject after approve denied");
  } else bad("reject after approve", rejectAfter.error);
}

{
  const id = randomUUID();
  await seedDraft(id);
  await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-rej-p",
  });
  const r1 = await decide({
    requestId: id,
    action: "reject",
    expectedVersion: 2,
    idempotencyKey: "hard-rej-a",
    reason: "no",
  });
  if (r1.ok) ok("reject once");
  else bad("reject once", r1.error);
  const rReplay = await decide({
    requestId: id,
    action: "reject",
    expectedVersion: 2,
    idempotencyKey: "hard-rej-a",
    reason: "no",
  });
  if (rReplay.ok && rReplay.body?.replayed === true) ok("duplicate reject same-key replay");
  else bad("reject replay", rReplay.error);
  const rConflict = await decide({
    requestId: id,
    action: "reject",
    expectedVersion: 2,
    idempotencyKey: "hard-rej-a",
    reason: "different",
  });
  if (!rConflict.ok && rConflict.error === "IDEMPOTENCY_CONFLICT") {
    ok("duplicate reject payload mismatch");
  } else bad("reject payload mismatch", rConflict.error);
  const rNew = await decide({
    requestId: id,
    action: "reject",
    expectedVersion: 3,
    idempotencyKey: "hard-rej-b",
  });
  if (
    !rNew.ok &&
    (rNew.error === "ALREADY_DECIDED" || rNew.error === "INVALID_STATE_TRANSITION")
  ) {
    ok("duplicate reject new key denied");
  } else bad("duplicate reject new key", rNew.error);
  const approveAfterReject = await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 3,
    idempotencyKey: "hard-approve-after-rej",
  });
  if (
    !approveAfterReject.ok &&
    (approveAfterReject.error === "ALREADY_DECIDED" ||
      approveAfterReject.error === "INVALID_STATE_TRANSITION")
  ) {
    ok("approve after reject denied");
  } else bad("approve after reject", approveAfterReject.error);
}

{
  const id = randomUUID();
  await seedDraft(id);
  await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-can-p",
  });
  const c1 = await decide({
    requestId: id,
    action: "cancel",
    expectedVersion: 2,
    idempotencyKey: "hard-can-a",
  });
  if (c1.ok) ok("cancel once");
  else bad("cancel once", c1.error);
  const cReplay = await decide({
    requestId: id,
    action: "cancel",
    expectedVersion: 2,
    idempotencyKey: "hard-can-a",
  });
  if (cReplay.ok && cReplay.body?.replayed === true) ok("duplicate cancel same-key replay");
  else bad("cancel replay", cReplay.error);
  const cNew = await decide({
    requestId: id,
    action: "cancel",
    expectedVersion: 3,
    idempotencyKey: "hard-can-b",
  });
  if (
    !cNew.ok &&
    (cNew.error === "ALREADY_DECIDED" || cNew.error === "INVALID_STATE_TRANSITION")
  ) {
    ok("duplicate cancel new key denied");
  } else bad("duplicate cancel new key", cNew.error);
}

console.log("\n3) Invalid version matrix");
{
  const missing = contract.validateDecisionWriteInput({
    requestId: randomUUID(),
    action: "propose",
    idempotencyKey: "hard-ver-missing-xx",
  });
  if (!missing.ok) ok("missing expectedVersion rejected");
  else bad("missing expectedVersion");

  const nonInt = contract.validateDecisionWriteInput({
    requestId: randomUUID(),
    action: "propose",
    expectedVersion: 1.5,
    idempotencyKey: "hard-ver-float-xxxx",
  });
  if (!nonInt.ok) ok("non-integer expectedVersion rejected");
  else bad("non-integer expectedVersion");

  const asString = contract.validateDecisionWriteInput({
    requestId: randomUUID(),
    action: "propose",
    expectedVersion: "2",
    idempotencyKey: "hard-ver-string-xxx",
  });
  if (!asString.ok) ok("string expectedVersion rejected");
  else bad("string expectedVersion");

  const id = randomUUID();
  await seedDraft(id);
  const low = await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 0,
    idempotencyKey: "hard-ver-zero",
  });
  if (!low.ok && low.error === "VERSION_CONFLICT") ok("expectedVersion=0 conflict");
  else bad("expectedVersion=0", low.error);

  const high = await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 2,
    idempotencyKey: "hard-ver-high",
  });
  if (!high.ok && high.error === "VERSION_CONFLICT") ok("expectedVersion=current+1 conflict");
  else bad("expectedVersion=current+1", high.error);

  await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-ver-ok",
  });
  const stale = await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 1,
    idempotencyKey: "hard-ver-stale",
  });
  if (!stale.ok && stale.error === "VERSION_CONFLICT") {
    ok("stale expectedVersion=current-1 after propose");
  } else bad("stale after propose", stale.error);
}

console.log("\n4) Timeline / audit integrity");
{
  const id = randomUUID();
  await seedDraft(id);
  await decide({
    requestId: id,
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-tl-p",
  });
  const mid = await repo.getAuditTimeline(id);
  assertTimelineOrdered(mid, "after propose");
  if (Array.isArray(mid) && mid[0]?.event_type === "proposal_submitted") {
    ok("first event proposal_submitted");
  } else bad("first event type");

  const beforeApproveLen = Array.isArray(mid) ? mid.length : 0;
  await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "hard-tl-a",
  });
  const full = await repo.getAuditTimeline(id);
  assertTimelineOrdered(full, "after approve");
  if (
    Array.isArray(full) &&
    full.map((e) => e.event_type).join(",") ===
      "proposal_submitted,approval_granted"
  ) {
    ok("event type order propose→approve");
  } else bad("event type order", full.map((e) => e.event_type).join(","));

  await decide({
    requestId: id,
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "hard-tl-a",
  });
  const afterReplay = await repo.getAuditTimeline(id);
  if (
    Array.isArray(afterReplay) &&
    afterReplay.length === full.length &&
    afterReplay[afterReplay.length - 1]?.event_hash ===
      full[full.length - 1]?.event_hash
  ) {
    ok("replay adds no audit event");
  } else bad("replay audit growth", `${beforeApproveLen}->${afterReplay?.length}`);

  const viaOps = await getOpsProposalTimeline({ env, proposalId: id });
  if (viaOps.ok && Array.isArray(viaOps.body?.timeline)) {
    assertTimelineOrdered(viaOps.body.timeline, "ops read timeline");
  } else bad("ops timeline", viaOps.error);
}

console.log("\n5) Filter / pagination / read regression");
{
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  for (const id of ids) await seedDraft(id);
  await decide({
    requestId: ids[0],
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-fil-p0",
  });
  await decide({
    requestId: ids[0],
    action: "approve",
    expectedVersion: 2,
    idempotencyKey: "hard-fil-a0",
  });
  await decide({
    requestId: ids[1],
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-fil-p1",
  });
  await decide({
    requestId: ids[1],
    action: "reject",
    expectedVersion: 2,
    idempotencyKey: "hard-fil-r1",
  });
  await decide({
    requestId: ids[2],
    action: "propose",
    expectedVersion: 1,
    idempotencyKey: "hard-fil-p2",
  });
  await decide({
    requestId: ids[2],
    action: "cancel",
    expectedVersion: 2,
    idempotencyKey: "hard-fil-c2",
  });

  const approved = await listOpsProposals({
    env,
    query: new URLSearchParams({
      status: "approved",
      page: "1",
      pageSize: "50",
    }),
  });
  if (
    approved.ok &&
    Array.isArray(approved.body?.items) &&
    approved.body.items.some((i) => i.proposal_id === ids[0]) &&
    approved.body.items.every((i) => i.status === "approved")
  ) {
    ok("filter approved includes written id");
  } else bad("filter approved", approved.error);

  const rejected = await listOpsProposals({
    env,
    query: new URLSearchParams({
      status: "rejected",
      page: "1",
      pageSize: "50",
    }),
  });
  if (
    rejected.ok &&
    rejected.body.items.some((i) => i.proposal_id === ids[1])
  ) {
    ok("filter rejected includes written id");
  } else bad("filter rejected", rejected.error);

  const cancelled = await listOpsProposals({
    env,
    query: new URLSearchParams({
      status: "cancelled",
      page: "1",
      pageSize: "50",
    }),
  });
  if (
    cancelled.ok &&
    cancelled.body.items.some((i) => i.proposal_id === ids[2])
  ) {
    ok("filter cancelled includes written id");
  } else bad("filter cancelled", cancelled.error);

  const page1 = await listOpsProposals({
    env,
    query: new URLSearchParams({
      page: "1",
      pageSize: "2",
      sortBy: "created_at",
      sortDir: "desc",
    }),
  });
  const page2 = await listOpsProposals({
    env,
    query: new URLSearchParams({
      page: "2",
      pageSize: "2",
      sortBy: "created_at",
      sortDir: "desc",
    }),
  });
  if (page1.ok && page2.ok) {
    const a = new Set((page1.body.items || []).map((i) => i.proposal_id));
    const b = (page2.body.items || []).map((i) => i.proposal_id);
    const overlap = b.some((id) => a.has(id));
    if (!overlap && (page1.body.items || []).length <= 2) {
      ok("pagination page1/page2 disjoint");
    } else bad("pagination overlap");
    if (page1.body.total === page2.body.total) ok("pagination total stable");
    else bad("pagination total drift");
  } else bad("pagination list", page1.error || page2.error);

  const detail = await (
    await import(
      pathToFileURL(
        path.join(
          ROOT,
          "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-read.mjs"
        )
      ).href
    )
  ).getOpsProposalDetail({ env, proposalId: ids[0] });
  if (
    detail.ok &&
    detail.body?.security?.applied === false &&
    detail.body?.proposal?.status === "approved"
  ) {
    ok("read-only detail after approve (applied=false)");
  } else bad("read detail after approve", detail.error);
}

console.log("\n6) Operator UX / Apply isolation static");
{
  const client = readFileSync(path.join(ROOT, "admin-diff-approve-client.js"), "utf8");
  const html = readFileSync(path.join(ROOT, "admin-diff-approve.html"), "utf8");
  if (/data-dda-action/.test(client) && /disabled = true/.test(client)) {
    ok("UX: action data attrs + disable-while-submit");
  } else bad("UX hardening attrs");
  if (/DECISION WRITE/.test(html) && /NO APPLY/.test(html)) ok("operator badges");
  else bad("operator badges");
  if (!/performApply|executeProvider|\/apply["']/.test(client)) {
    ok("client Apply isolation");
  } else bad("client Apply leak");
}

writeFileSync(
  SUMMARY,
  JSON.stringify(
    {
      verdict:
        fail === 0
          ? "PASS_STAGING_DECISION_WRITE_HARDENING"
          : "FAIL_STAGING_DECISION_WRITE_HARDENING",
      pass,
      fail,
      failures,
      staging_ref: STAGING_REF,
      migration_history: "DRIFT_160000_DOCUMENTED_NO_REPAIR",
      production: "NOT_TOUCHED",
      apply: "NOT_EXECUTED",
      provider: "NOT_EXECUTED",
      repair: "NOT_PERFORMED",
    },
    null,
    2
  )
);

console.log("\n---");
console.log(`pass=${pass} fail=${fail}`);
if (fail) process.exit(1);
console.log("PASS_STAGING_DECISION_WRITE_HARDENING");
process.exit(0);
