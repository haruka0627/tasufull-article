#!/usr/bin/env node
/**
 * Diff & Approve — Phase A1 foundation tests
 *   node scripts/test-diff-approve-phase-a1-foundation.mjs
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

const FILE =
  "deploy/cloudflare/functions/_shared/ai-diff-approve-a1-foundation.mjs";

console.log("A1 — files / static security");
assert("exists a1 module", existsSync(join(root, FILE)));
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
  "applyProposal always forbidden",
  /APPLY_FORBIDDEN/.test(src) && a1.applyProposal({}).ok === false
);

const FIXED_IDS = {
  proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created_at: "2026-07-28T00:00:00.000Z",
};

console.log("\nA1 — Proposal");
{
  const draft = a1.createDiffProposal({
    ...FIXED_IDS,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.daily_summary",
    change_type: "update",
  });
  assert("proposal ok", draft.ok === true);
  assert("status draft", draft.value.status === "draft");
  assert("frozen", Object.isFrozen(draft.value));
  assert("capability set", draft.value.capability === "generate_ops_report");
  assert(
    "unknown capability rejected",
    a1.createDiffProposal({
      ...FIXED_IDS,
      capability: "unknown_cap",
      resource_type: "text",
      change_type: "update",
    }).ok === false
  );
  assert(
    "unknown resource rejected",
    a1.createDiffProposal({
      ...FIXED_IDS,
      capability: "generate_ops_report",
      resource_type: "code",
      change_type: "update",
    }).ok === false
  );
}

console.log("\nA1 — Diff");
{
  const textDiff = a1.generateDiff({
    resource_type: "text",
    before: "hello",
    after: "hello world",
  });
  assert("text diff ok", textDiff.ok === true);
  assert("text summary", textDiff.value.summary === "text_updated");
  assert("before/after", textDiff.value.before === "hello");

  const jsonDiff = a1.generateDiff({
    resource_type: "json",
    before: { a: 1, b: 2 },
    after: { a: 1, b: 3, c: 4 },
  });
  assert("json diff ok", jsonDiff.ok === true);
  assert(
    "changed fields",
    jsonDiff.changed_fields.includes("b") &&
      jsonDiff.changed_fields.includes("c")
  );

  const settingsDiff = a1.generateDiff({
    resource_type: "settings",
    before: { enabled: false },
    after: { enabled: true },
  });
  assert("settings diff ok", settingsDiff.ok === true);

  assert(
    "code resource rejected",
    a1.generateDiff({ resource_type: "code", before: "", after: "" }).ok ===
      false
  );

  const polluted = a1.generateDiff({
    resource_type: "json",
    before: JSON.parse('{"a":1}'),
    after: { a: 2, __proto__: { x: 1 } },
  });
  assert("proto not retained as field", polluted.ok === true);
  assert(
    "no __proto__ key in after",
    !Object.prototype.hasOwnProperty.call(polluted.value.after, "__proto__")
  );
}

console.log("\nA1 — Impact");
{
  const impact = a1.generateImpactSummary({
    resource_type: "settings",
    change_type: "update",
    changed_fields: ["enabled"],
    resource_id: "ops.daily_summary",
  });
  assert("impact ok", impact.ok === true);
  assert("approval_required", impact.value.approval_required === true);
  assert("risk present", typeof impact.value.estimated_risk === "string");
  assert(
    "affected_scope",
    impact.value.affected_scope.resource_type === "settings"
  );

  const high = a1.generateImpactSummary({
    resource_type: "json",
    change_type: "delete",
    changed_fields: ["a"],
  });
  assert("delete high risk", high.value.estimated_risk === "high");
}

console.log("\nA1 — Status / Pending Approval");
{
  const pending = a1.buildPendingApprovalProposal({
    ...FIXED_IDS,
    capability: "generate_ops_report",
    resource_type: "json",
    resource_id: "ops.config",
    change_type: "update",
    before: { theme: "light" },
    after: { theme: "dark" },
  });
  assert("pipeline ok", pending.ok === true);
  assert("status pending_approval", pending.status === "pending_approval");
  assert("snapshot status", pending.snapshot.status === "pending_approval");
  assert("applied false", pending.applied === false);
  assert("provider_called false", pending.provider_called === false);
  assert("executed false", pending.executed === false);
  assert("transmit false", pending.transmit === false);
  assert("cost 0", pending.recorded_api_cost === 0);
  assert("snapshot frozen", Object.isFrozen(pending.snapshot));

  const draft = a1.createDiffProposal({
    ...FIXED_IDS,
    capability: "collect_daily_ops",
    resource_type: "text",
    change_type: "replace",
  });
  const marked = a1.markProposalPendingApproval({ proposal: draft.value });
  assert("mark pending ok", marked.ok === true);
  assert("marked status", marked.value.status === "pending_approval");

  assert(
    "apply forbidden",
    a1.applyProposal(pending.snapshot).reason === "apply_forbidden"
  );
}

console.log("\nA1 — Validation");
{
  assert(
    "missing proposal",
    a1.validateDiffProposal(null).reason === "missing_proposal"
  );
  assert(
    "unknown status",
    a1.validateDiffProposal(
      a1.deepFreeze({
        schema_version: a1.PHASE_A1_SCHEMA_VERSION,
        proposal_id: FIXED_IDS.proposal_id,
        request_id: FIXED_IDS.request_id,
        capability: "generate_ops_report",
        resource_type: "text",
        resource_id: null,
        change_type: "update",
        status: "weird_status",
        created_at: FIXED_IDS.created_at,
        reason: "x",
      })
    ).reason === "unknown_status"
  );
  assert(
    "approved forbidden in A1",
    a1.validateDiffProposal(
      a1.deepFreeze({
        schema_version: a1.PHASE_A1_SCHEMA_VERSION,
        proposal_id: FIXED_IDS.proposal_id,
        request_id: FIXED_IDS.request_id,
        capability: "generate_ops_report",
        resource_type: "text",
        resource_id: null,
        change_type: "update",
        status: "approved",
        created_at: FIXED_IDS.created_at,
        reason: "x",
      })
    ).reason === "status_transition_forbidden"
  );

  const extra = a1.buildProposalSnapshot({
    proposal: a1.createDiffProposal({
      ...FIXED_IDS,
      capability: "generate_ops_report",
      resource_type: "text",
      change_type: "update",
    }).value,
    diff: a1.generateDiff({
      resource_type: "text",
      before: "a",
      after: "b",
    }).value,
    impact: a1.generateImpactSummary({
      resource_type: "text",
      change_type: "update",
      changed_fields: [],
    }).value,
  });
  assert("snapshot ok", extra.ok === true);

  // mutable proposal rejected
  const mutable = {
    schema_version: a1.PHASE_A1_SCHEMA_VERSION,
    proposal_id: FIXED_IDS.proposal_id,
    request_id: FIXED_IDS.request_id,
    capability: "generate_ops_report",
    resource_type: "text",
    resource_id: null,
    change_type: "update",
    status: "draft",
    created_at: FIXED_IDS.created_at,
    reason: "x",
  };
  assert(
    "immutable required",
    a1.validateDiffProposal(mutable).reason === "immutable_violation"
  );

  const uni = a1.createDiffProposal({
    ...FIXED_IDS,
    capability: "generate_ops_report",
    resource_type: "settings\u200b",
    change_type: "update",
  });
  assert("unicode resource rejected", uni.ok === false);

  const withExtra = a1.validateDiffProposal(
    a1.deepFreeze({
      schema_version: a1.PHASE_A1_SCHEMA_VERSION,
      proposal_id: FIXED_IDS.proposal_id,
      request_id: FIXED_IDS.request_id,
      capability: "generate_ops_report",
      resource_type: "text",
      resource_id: null,
      change_type: "update",
      status: "draft",
      created_at: FIXED_IDS.created_at,
      reason: "x",
      prompt: "SECRET",
    })
  );
  assert("extra fields rejected", withExtra.reason === "extra_fields");
}

console.log("\nA1 — Regression (module self-check)");
{
  const again = a1.buildPendingApprovalProposal({
    ...FIXED_IDS,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.flag",
    change_type: "update",
    before: { flag: 0 },
    after: { flag: 1 },
  });
  const again2 = a1.buildPendingApprovalProposal({
    ...FIXED_IDS,
    capability: "generate_ops_report",
    resource_type: "settings",
    resource_id: "ops.flag",
    change_type: "update",
    before: { flag: 0 },
    after: { flag: 1 },
  });
  assert("deterministic proposal id", again.proposal.proposal_id === again2.proposal.proposal_id);
  assert("no apply side effect", again.applied === false && again2.applied === false);
}

console.log(
  errors.length === 0
    ? `\nA1 PASSED (${errors.length} failures)`
    : `\nA1 FAILED (${errors.length}):\n- ${errors.join("\n- ")}`
);
process.exit(errors.length === 0 ? 0 : 1);
