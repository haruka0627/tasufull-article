#!/usr/bin/env node
/**
 * Diff & Approve — Phase A2 approval workflow tests
 *   node scripts/test-diff-approve-phase-a2-approval-workflow.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  errors.push(label);
  console.log(`  ✗ ${label}`);
}

function relUrl(rel) {
  return `${pathToFileURL(join(root, rel)).href}?t=${Date.now()}`;
}

const a1 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-diff-approve-a1-foundation.mjs"
  )
);
const a2 = await import(
  relUrl("deploy/cloudflare/functions/_shared/ai-diff-approve-a2-approval.mjs")
);

const FILE =
  "deploy/cloudflare/functions/_shared/ai-diff-approve-a2-approval.mjs";

console.log("A2 — files / static security");
assert("exists a2 module", existsSync(join(root, FILE)));
const src = readFileSync(join(root, FILE), "utf8");
const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
assert("no fetch(", !/\bfetch\s*\(/.test(codeOnly));
assert("no axios", !/\baxios\b/.test(codeOnly));
assert("no WebSocket", !/\bWebSocket\b/.test(codeOnly));
assert(
  "no SDK import",
  !/\bfrom\s+["'][^"']*(openai|@anthropic|@google|deepseek)/i.test(codeOnly)
);
assert("no process.env", !/process\.env\b/.test(codeOnly));
assert("no Authorization", !/Authorization/i.test(codeOnly));
assert("no api_key", !/\bapi[_-]?key\b/i.test(codeOnly));
assert("no eval/Function", !/\beval\s*\(|new\s+Function\b/.test(codeOnly));
assert("no dynamic import", !/\bimport\s*\(/.test(codeOnly));
assert("no adapter.execute", !/adapter\.execute\s*\(/.test(codeOnly));
assert(
  "apply forbidden",
  a2.applyApprovedProposal({}).reason === "apply_forbidden"
);

const FIXED = {
  proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-07-28T00:00:00.000Z",
};

function pendingProposal() {
  const built = a1.buildPendingApprovalProposal({
    ...FIXED,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.flag",
    change_type: "update",
    before: { enabled: false },
    after: { enabled: true },
  });
  assert("a1 pending ok", built.ok === true);
  return built.proposal;
}

console.log("\nA2 — Authority");
{
  assert(
    "approver role ok",
    a2.validateApprovalActor({ role: "approver", id: "u1" }).ok === true
  );
  assert(
    "unknown actor rejected",
    a2.validateApprovalActor({ role: "admin" }).reason === "unknown_actor"
  );
  assert(
    "unicode zwsp id rejected",
    a2.validateApprovalActor({ role: "approver", id: "u\u200b1" }).ok === false
  );
  assert(
    "requester cannot grant",
    a2.isActorAllowedForDecision("approved", "requester") === false
  );
  assert(
    "approver can grant",
    a2.isActorAllowedForDecision("approved", "approver") === true
  );
  assert(
    "requester can revision",
    a2.isActorAllowedForDecision("revision_requested", "requester") === true
  );
}

console.log("\nA2 — State machine / Transitions");
{
  assert(
    "draft→pending allowed",
    a2.isTransitionAllowed("draft", "pending_approval") === true
  );
  assert(
    "pending→approved allowed",
    a2.isTransitionAllowed("pending_approval", "approved") === true
  );
  assert(
    "pending→rejected allowed",
    a2.isTransitionAllowed("pending_approval", "rejected") === true
  );
  assert(
    "pending→revision allowed",
    a2.isTransitionAllowed("pending_approval", "revision_requested") === true
  );
  assert(
    "approved→rejected forbidden",
    a2.isTransitionAllowed("approved", "rejected") === false
  );
  assert(
    "pending→expired forbidden",
    a2.isTransitionAllowed("pending_approval", "expired") === false
  );
  assert(
    "draft→approved forbidden",
    a2.isTransitionAllowed("draft", "approved") === false
  );
}

console.log("\nA2 — Approval / Reject / Revision");
{
  const pending = pendingProposal();

  const req = a2.requestApproval({
    proposal: pending,
    actor: { role: "system" },
    timestamp: "2026-07-28T01:00:00.000Z",
  });
  assert("approval_requested event", req.ok === true);
  assert("event name", req.value.event === "approval_requested");

  const granted = a2.grantApproval({
    proposal: pending,
    actor: { role: "approver", id: "approver-1" },
    reason: "looks good",
    timestamp: "2026-07-28T01:01:00.000Z",
  });
  assert("grant ok", granted.ok === true);
  assert("status approved", granted.status === "approved");
  assert("event granted", granted.event === "approval_granted");
  assert("snapshot status", granted.snapshot.status === "approved");
  assert("applied false", granted.applied === false);
  assert("provider_called false", granted.provider_called === false);
  assert("decision frozen", Object.isFrozen(granted.decision));

  const twice = a2.grantApproval({
    proposal: granted.proposal,
    actor: { role: "approver", id: "approver-1" },
  });
  assert("approved twice rejected", twice.reason === "approved_twice");

  const pending2 = pendingProposal();
  const rejected = a2.rejectApproval({
    proposal: pending2,
    actor: { role: "system" },
    reason: "policy",
  });
  assert("reject ok", rejected.ok === true);
  assert("status rejected", rejected.status === "rejected");
  assert("event rejected", rejected.event === "approval_rejected");
  const twiceReject = a2.rejectApproval({
    proposal: rejected.proposal,
    actor: { role: "approver", id: "a" },
  });
  assert("rejected twice", twiceReject.reason === "rejected_twice");

  const pending3 = pendingProposal();
  const rev = a2.requestRevision({
    proposal: pending3,
    actor: { role: "requester", id: "req-1" },
    reason: "need clearer summary",
    notes: "expand impact",
  });
  assert("revision ok", rev.ok === true);
  assert("status revision_requested", rev.status === "revision_requested");
  assert("event revision", rev.event === "revision_requested");
  assert("revision_request present", Boolean(rev.revision_request));

  const pending4 = pendingProposal();
  const requesterGrant = a2.grantApproval({
    proposal: pending4,
    actor: { role: "requester", id: "req-1" },
  });
  assert(
    "requester grant forbidden",
    requesterGrant.reason === "actor_not_allowed"
  );
}

console.log("\nA2 — Validation / pollution");
{
  const pending = pendingProposal();
  assert(
    "unknown decision",
    a2.applyApprovalTransition({
      proposal: pending,
      decision: "maybe",
      actor: { role: "approver" },
    }).reason === "unknown_state"
  );

  const mutable = { ...pending };
  assert(
    "immutable required",
    a2.applyApprovalTransition({
      proposal: mutable,
      decision: "approved",
      actor: { role: "approver" },
    }).reason === "immutable_violation"
  );

  const extraActor = a2.validateApprovalActor({
    role: "approver",
    id: "x",
    prompt: "SECRET",
  });
  assert("extra actor fields", extraActor.reason === "extra_fields");

  const snap = a2.buildApprovalSnapshot({
    proposal_id: FIXED.proposal_id,
    status: "approved",
    actor: { role: "approver", id: "a" },
    reason: "ok",
    timestamp: "2026-07-28T00:00:00.000Z",
    event: "approval_granted",
    prompt: "nope",
  });
  assert("snapshot extras rejected", snap.ok === false);
}

console.log("\nA2 — Regression (A1 + A2)");
{
  const a1r = await import(
    relUrl(
      "deploy/cloudflare/functions/_shared/ai-diff-approve-a1-foundation.mjs"
    )
  );
  assert(
    "a1 has revision_requested vocab",
    a1r.PHASE_A1_STATUSES.REVISION_REQUESTED === "revision_requested"
  );
  assert(
    "a1 apply still forbidden",
    a1r.applyProposal({}).reason === "apply_forbidden"
  );
  assert(
    "a1 active still draft|pending only",
    a1r.PHASE_A1_ACTIVE_STATUSES.length === 2
  );

  // Re-run critical A1 pending path
  const pending = a1r.buildPendingApprovalProposal({
    ...FIXED,
    capability: "collect_daily_ops",
    resource_type: "text",
    change_type: "update",
    before: "a",
    after: "b",
  });
  assert("a1 pipeline still works", pending.ok === true);
  const g = a2.grantApproval({
    proposal: pending.proposal,
    actor: { role: "system" },
  });
  assert("a2 grant after a1", g.ok === true && g.applied === false);
}

console.log(
  errors.length === 0
    ? `\nA2 PASSED (${errors.length} failures)`
    : `\nA2 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
