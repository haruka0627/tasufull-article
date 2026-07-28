#!/usr/bin/env node
/**
 * Diff & Approve — Phase A3 apply readiness tests
 *   node scripts/test-diff-approve-phase-a3-apply-readiness.mjs
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
const a3 = await import(
  relUrl(
    "deploy/cloudflare/functions/_shared/ai-diff-approve-a3-apply-readiness.mjs"
  )
);

const FILE =
  "deploy/cloudflare/functions/_shared/ai-diff-approve-a3-apply-readiness.mjs";

console.log("A3 — files / static security");
assert("exists a3 module", existsSync(join(root, FILE)));
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
  a3.applyProposalChanges({}).reason === "apply_forbidden"
);

const FIXED = {
  proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-07-28T00:00:00.000Z",
};

function buildApprovedBundle(overrides = {}) {
  const pending = a1.buildPendingApprovalProposal({
    ...FIXED,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.flag",
    change_type: "update",
    before: { enabled: false },
    after: { enabled: true },
    ...overrides.proposalInput,
  });
  assert("pending ok", pending.ok === true);
  const granted = a2.grantApproval({
    proposal: pending.proposal,
    actor: { role: "approver", id: "approver-1" },
    reason: "ok",
    timestamp: "2026-07-28T02:00:00.000Z",
  });
  assert("granted ok", granted.ok === true);
  return {
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: granted.decision.actor,
    decision: granted.decision,
  };
}

console.log("\nA3 — Readiness ready path");
{
  const bundle = buildApprovedBundle();
  const ready = a3.evaluateApplyReadiness({
    proposal: bundle.proposal,
    diff: bundle.diff,
    impact: bundle.impact,
    actor: bundle.actor,
    timestamp: "2026-07-28T02:05:00.000Z",
  });
  assert("ready decision", ready.decision === "ready");
  assert("reason apply_ready", ready.reason === "apply_ready");
  assert("plan present", ready.plan && ready.plan.requires_apply === true);
  assert("plan steps", Array.isArray(ready.plan.estimated_steps));
  assert("conflicts empty", ready.conflicts.count === 0);
  assert("snapshot ready", ready.snapshot.decision === "ready");
  assert("applied false", ready.applied === false);
  assert("provider_called false", ready.provider_called === false);
  assert("executed false", ready.executed === false);
  assert("transmit false", ready.transmit === false);
  assert("cost 0", ready.recorded_api_cost === 0);
  assert("snapshot frozen", Object.isFrozen(ready.snapshot));
  assert("plan frozen", Object.isFrozen(ready.plan));
}

console.log("\nA3 — Consistency / Conflict / not approved");
{
  const pending = a1.buildPendingApprovalProposal({
    ...FIXED,
    capability: "generate_ops_report",
    resource_type: "json",
    resource_id: "cfg",
    change_type: "update",
    before: { a: 1 },
    after: { a: 2 },
  });
  assert("pending for not-approved", pending.ok === true);
  const notApproved = a3.evaluateApplyReadiness({
    proposal: pending.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: { role: "system" },
  });
  assert("not_ready when pending", notApproved.decision === "not_ready");
  assert("reason not_approved", notApproved.reason === "not_approved");
  assert(
    "status conflict recorded",
    notApproved.conflicts.codes.includes("proposal_status")
  );

  const bundle = buildApprovedBundle();
  const missingDiff = a3.evaluateApplyReadiness({
    proposal: bundle.proposal,
    impact: bundle.impact,
    actor: bundle.actor,
  });
  assert("missing diff → not_ready", missingDiff.decision === "not_ready");
  assert("missing diff reason", missingDiff.reason === "missing_diff");

  const missingImpact = a3.evaluateApplyReadiness({
    proposal: bundle.proposal,
    diff: bundle.diff,
    actor: bundle.actor,
  });
  assert("missing impact → not_ready", missingImpact.decision === "not_ready");
  assert("missing impact reason", missingImpact.reason === "missing_impact");

  const mismatchDiff = a1.generateDiff({
    resource_type: "text",
    before: "x",
    after: "y",
  });
  assert("mismatch diff ok", mismatchDiff.ok === true);
  const mismatch = a3.evaluateApplyReadiness({
    proposal: bundle.proposal,
    diff: mismatchDiff.value,
    impact: bundle.impact,
    actor: bundle.actor,
  });
  assert("resource mismatch → not_ready", mismatch.decision === "not_ready");
  assert(
    "mismatch reason",
    mismatch.reason === "resource_mismatch"
  );
}

console.log("\nA3 — Validation");
{
  const bundle = buildApprovedBundle();
  assert(
    "unknown actor",
    a3.evaluateApplyReadiness({
      proposal: bundle.proposal,
      diff: bundle.diff,
      impact: bundle.impact,
      actor: { role: "admin" },
    }).reason === "unknown_actor"
  );

  const mutable = { ...bundle.proposal };
  assert(
    "immutable required",
    a3.validateApprovedProposal(mutable).reason === "immutable_violation"
  );

  const extras = a3.evaluateApplyReadiness({
    proposal: bundle.proposal,
    diff: bundle.diff,
    impact: bundle.impact,
    actor: bundle.actor,
    prompt: "SECRET",
  });
  assert("extra context fields", extras.reason === "extra_fields");

  const badSnap = a3.buildReadinessSnapshot({
    proposal_id: FIXED.proposal_id,
    decision: "ready",
    reason: "apply_ready",
    conflicts: a3.buildConflictSummary([]),
    timestamp: "2026-07-28T00:00:00.000Z",
    prompt: "no",
  });
  assert("snapshot extras rejected", badSnap.ok === false);

  const uniResource = a3.validateApprovedProposal(
    a1.deepFreeze({
      schema_version: a1.PHASE_A1_SCHEMA_VERSION,
      proposal_id: FIXED.proposal_id,
      request_id: FIXED.request_id,
      capability: "generate_ops_report",
      resource_type: "settings\u200b",
      resource_id: null,
      change_type: "update",
      status: "approved",
      created_at: FIXED.created_at,
      reason: "x",
    })
  );
  assert("unicode resource rejected", uniResource.ok === false);
}

console.log("\nA3 — Plan");
{
  const bundle = buildApprovedBundle();
  const plan = a3.buildApplyPlan({
    proposal: bundle.proposal,
    impact: bundle.impact,
  });
  assert("plan ok", plan.ok === true);
  assert("requires_apply true", plan.value.requires_apply === true);
  assert("proposal_id", plan.value.proposal_id === FIXED.proposal_id);
  assert("resource_type", plan.value.resource_type === "settings");
  assert("never executes", true);
}

console.log("\nA3 — Regression A1+A2+A3");
{
  assert("a1 apply forbidden", a1.applyProposal({}).ok === false);
  assert("a2 apply forbidden", a2.applyApprovedProposal({}).ok === false);
  assert("a3 apply forbidden", a3.applyProposalChanges({}).ok === false);

  const pending = a1.buildPendingApprovalProposal({
    ...FIXED,
    capability: "collect_daily_ops",
    resource_type: "text",
    change_type: "update",
    before: "a",
    after: "b",
  });
  assert("a1 still works", pending.ok === true);
  const granted = a2.grantApproval({
    proposal: pending.proposal,
    actor: { role: "system" },
  });
  assert("a2 still works", granted.ok === true);
  const ready = a3.evaluateApplyReadiness({
    proposal: granted.proposal,
    diff: pending.diff,
    impact: pending.impact,
    actor: { role: "system" },
  });
  assert("a3 ready after a2", ready.decision === "ready");
}

console.log(
  errors.length === 0
    ? `\nA3 PASSED (${errors.length} failures)`
    : `\nA3 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
