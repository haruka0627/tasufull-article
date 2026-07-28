#!/usr/bin/env node
/**
 * Diff & Approve — Staging history + read-only ops integration tests
 *   node scripts/test-diff-approve-staging-readonly-ops.mjs
 */
import { readFileSync, existsSync } from "node:fs";
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

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

console.log("1) Static security / files");
const files = [
  "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-read.mjs",
  "deploy/cloudflare/functions/_shared/ai-diff-approve-http.mjs",
  "deploy/cloudflare/functions/api/ai-diff-approve/proposals.js",
  "deploy/cloudflare/functions/api/ai-diff-approve/summary.js",
  "deploy/cloudflare/functions/api/ai-diff-approve/[id].js",
  "admin-diff-approve.html",
  "admin-diff-approve.css",
  "admin-diff-approve-client.js",
];
for (const f of files) {
  assert(`exists ${f}`, existsSync(join(root, f)));
}

const client = read("admin-diff-approve-client.js");
const html = read("admin-diff-approve.html");
const ops = read("deploy/cloudflare/functions/_shared/ai-diff-approve-ops-read.mjs");
const http = read("deploy/cloudflare/functions/_shared/ai-diff-approve-http.mjs");
const proposalsApi = read(
  "deploy/cloudflare/functions/api/ai-diff-approve/proposals.js"
);

assert("UI STAGING badge", /STAGING/.test(html) && /READ ONLY/.test(html) && /NO APPLY/.test(html));
assert("no Approve button", !/>\s*Approve\s*</i.test(html) && !/Approve</.test(html));
assert("no Apply button", !/>\s*Apply\s*</i.test(html));
assert("client GET only fetch", /method:\s*"GET"/.test(client));
assert("client no POST write", !/method:\s*"POST"/.test(client));
assert("client redaction", /SECRET_RE|service[_-]?role/.test(client));
assert("client textContent path", /textContent/.test(client));
assert("no service_role in client", !/SERVICE_ROLE_KEY|service_role_key\s*=/.test(client));
assert("API reject non-GET", /rejectNonGet/.test(proposalsApi));
assert("ops auth requireGateOpsUser", /requireGateOpsUser|requireDiffApproveOpsAuth/.test(http + proposalsApi));
assert("production forbidden", /production_forbidden/.test(ops));
assert("no provider SDK", !/openai|anthropic|@google\/generative/i.test(ops + client));
assert("no Production ref as target URL write", !/ddojquacsyqesrjhcvmn\.supabase\.co/.test(ops) || /production_forbidden|PRODUCTION/.test(ops));
assert("ops guard page registered", /admin-diff-approve/.test(read("auth-ops-guard.js")));

const mod = await import(
  pathToFileURL(
    join(root, "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-read.mjs")
  ).href
);
const persist = await import(
  pathToFileURL(
    join(
      root,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs"
    )
  ).href
);

console.log("\n2) Query contract");
assert(
  "invalid filter rejected",
  mod.parseListQuery(new URLSearchParams("foo=1")).error === "invalid_filter"
);
assert(
  "invalid sort rejected",
  mod.parseListQuery(new URLSearchParams("sortBy=hack")).error === "invalid_sort"
);
assert(
  "oversized limit rejected",
  mod.parseListQuery(new URLSearchParams("pageSize=999")).error === "limit_too_large"
);
assert(
  "valid query ok",
  mod.parseListQuery(new URLSearchParams("status=draft&pageSize=10")).ok === true
);
assert(
  "invalid proposal id",
  mod.parseProposalId("not-a-uuid").error === "invalid_proposal_id"
);

console.log("\n3) Redaction / prototype");
const red = mod.redactSecrets({
  ok: true,
  authorization: "Bearer secret",
  nested: { api_key: "x", title: "café" },
  __proto__: { polluted: true },
});
assert("auth redacted", red.authorization === "[redacted]");
assert("api_key redacted", red.nested.api_key === "[redacted]");
assert("title kept NFC path", red.nested.title === "café");
assert("proto not copied", !Object.prototype.hasOwnProperty.call(red, "__proto__"));

console.log("\n4) Env / flags");
assert(
  "production env denied",
  mod.assertOpsReadEnvironment({
    TASFUL_SUPABASE_URL: "https://ddojquacsyqesrjhcvmn.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x",
    DIFF_APPROVE_READ_ENABLED: "true",
  }).error === "production_forbidden"
);
assert(
  "read disabled",
  mod.assertOpsReadEnvironment({
    TASFUL_SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x",
    DIFF_APPROVE_READ_ENABLED: "false",
    AI_EXEC_GATE_ENVIRONMENT: "staging",
  }).error === "read_disabled"
);
assert(
  "staging read ok",
  mod.assertOpsReadEnvironment({
    TASFUL_SUPABASE_URL: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x",
    DIFF_APPROVE_READ_ENABLED: "true",
    DIFF_APPROVE_APPLY_ENABLED: "false",
    AI_EXEC_GATE_ENVIRONMENT: "staging",
  }).ok === true
);
assert(
  "assertReadAllowed exists",
  typeof persist.assertReadAllowed === "function"
);

console.log("\n5) Read model build + integrity");
const proposalId = "11111111-1111-4111-8111-111111111111";
const built = mod.buildOpsReadModel(
  [
    {
      schema_version: "diff_approve.a7.persistence.v1",
      record_type: "proposal",
      record_id: "r1",
      proposal_id: proposalId,
      payload: { status: "draft", capability: "diff_approve", impact: { estimated_risk: "low" } },
      record_version: 1,
    },
    {
      schema_version: "diff_approve.a7.persistence.v1",
      record_type: "final_gate",
      record_id: "fg1",
      proposal_id: proposalId,
      payload: { decision: "not_eligible_for_apply", blocking_reasons: ["no_apply"] },
      record_version: 1,
    },
  ],
  [
    {
      sequence_number: 1,
      event_type: "proposal_created",
      previous_event_hash: "genesis",
      event_hash: "fnv1a32:aaaa",
      created_at: "2026-07-28T00:00:00.000Z",
    },
  ],
  {
    proposal_id: proposalId,
    status: "draft",
    capability: "diff_approve",
    resource_type: "doc",
    resource_id: "1",
    created_at: "2026-07-28T00:00:00.000Z",
    record_version: 1,
  }
);
assert("build ok", built.ok === true);
assert("security applied false", built.value.security.applied === false);
assert("labels NO_APPLY", built.value.labels.apply === "NO_APPLY");

const badChain = mod.buildOpsReadModel([], [
  { reason: "audit_chain_mismatch", sequence_number: 2 },
], { proposal_id: proposalId });
assert("integrity fail-closed", badChain.ok === false && badChain.error === "integrity_error");

console.log("\n6) HTTP helper method deny");
const httpMod = await import(
  pathToFileURL(
    join(root, "deploy/cloudflare/functions/_shared/ai-diff-approve-http.mjs")
  ).href
);
const postDenied = httpMod.rejectNonGet(
  new Request("https://example.test/api/ai-diff-approve/proposals", {
    method: "POST",
  })
);
assert("POST denied", postDenied?.status === 405);
const patchDenied = httpMod.rejectNonGet(
  new Request("https://example.test/api/ai-diff-approve/proposals", {
    method: "PATCH",
  })
);
assert("PATCH denied", patchDenied?.status === 405);
const delDenied = httpMod.rejectNonGet(
  new Request("https://example.test/api/ai-diff-approve/proposals", {
    method: "DELETE",
  })
);
assert("DELETE denied", delDenied?.status === 405);

if (errors.length) {
  console.error(`\nFAIL ${errors.length}`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\nPASS staging history + read-only ops");
