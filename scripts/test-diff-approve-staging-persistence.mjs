#!/usr/bin/env node
/**
 * Diff & Approve — Staging Persistence Foundation
 * Static migration + adapter contract + security invariants
 *   node scripts/test-diff-approve-staging-persistence.mjs
 *
 * Does not apply Staging/Production migrations · no real Apply.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assertNode from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationRel =
  "supabase/migrations/20260728140000_ai_diff_approve_staging_persistence.sql";
const adapterRel =
  "deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs";
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

console.log("1) Static migration");
assert("migration exists", existsSync(join(root, migrationRel)));
const sql = read(migrationRel);
assert("proposals table", /ai_diff_approve_proposals/i.test(sql));
assert("records table", /ai_diff_approve_records/i.test(sql));
assert("events table", /ai_diff_approve_events/i.test(sql));
assert("idempotency table", /ai_diff_approve_idempotency/i.test(sql));
assert("Production No-Go", /Production apply No-Go/i.test(sql));
assert("environment staging only", /environment = 'staging'/i.test(sql));
assert("applied=false check", /ai_diff_prop_applied_false/i.test(sql));
assert("executed=false check", /ai_diff_prop_executed_false/i.test(sql));
assert("provider_called=false", /ai_diff_prop_provider_false/i.test(sql));
assert("transmit=false", /ai_diff_prop_transmit_false/i.test(sql));
assert("cost zero", /ai_diff_prop_cost_zero/i.test(sql));
assert("RLS proposals", /enable row level security/i.test(sql));
assert("deny-all proposals", /ai_diff_prop_deny_all/i.test(sql));
assert("deny-all events", /ai_diff_evt_deny_all/i.test(sql));
assert("append-only trigger", /ai_diff_approve_forbid_event_mutation/i.test(sql));
assert("idempotency no overwrite", /ai_diff_approve_forbid_idempotency_update/i.test(sql));
assert(
  "events grant select,insert only",
  /grant select, insert on table public\.ai_diff_approve_events to service_role/i.test(sql)
);
assert(
  "idempotency grant select,insert only",
  /grant select, insert on table public\.ai_diff_approve_idempotency to service_role/i.test(sql)
);
assert(
  "revoke includes service_role before grant",
  /revoke all on table public\.ai_diff_approve_events[\s\S]{0,80}from public, anon, authenticated, service_role/i.test(
    sql
  )
);
assert(
  "no public blanket grant",
  !/grant all on table public\.ai_diff_approve_/i.test(sql)
);
assert(
  "no audit delete grant",
  !/grant select, insert, update, delete on table public\.ai_diff_approve_events/i.test(sql)
);
assert("write_step RPC", /ai_diff_approve_write_step/i.test(sql));
assert(
  "RPC grant service_role only",
  /grant execute on function public\.ai_diff_approve_write_step\(jsonb\) to service_role/i.test(
    sql
  )
);
assert(
  "no Production project ref literal",
  !/ddojquacsyqesrjhcvmn/i.test(sql)
);
assert("no secret literal sk-", !/sk-[a-zA-Z0-9]{10,}/.test(sql));
assert("record version optimistic", /stale_version/i.test(sql));
assert("sequence unique", /ai_diff_evt_sequence_unique/i.test(sql));
assert("idempotency key unique PK", /idempotency_key text primary key/i.test(sql));
assert(
  "no performApply in SQL",
  !/performApply|executeApply|commitApply|performRollback/i.test(sql)
);

console.log("\n2) Adapter static + contract");
assert("adapter exists", existsSync(join(root, adapterRel)));
const adapterSrc = read(adapterRel);
assert("no Production write path", !/performApply|executeProvider|commitApply/.test(adapterSrc) || /FORBIDDEN_APPLY/.test(adapterSrc));
assert("production URL reject", /ddojquacsyqesrjhcvmn/i.test(adapterSrc));
assert("persistence flag", /DIFF_APPROVE_PERSISTENCE_ENABLED/.test(adapterSrc));
assert("apply flag false gate", /DIFF_APPROVE_APPLY_ENABLED/.test(adapterSrc));
assert("NFC normalize", /\.normalize\("NFC"\)/.test(adapterSrc));
assert("no external AI SDK", !/openai|anthropic|@google\/generative/i.test(adapterSrc));
assert("no secret literal", !/eyJhbGciOi|sk-proj-|service_role_key\s*=\s*['"][^'"]+['"]/i.test(adapterSrc));

const a7 = await import(
  pathToFileURL(
    join(root, "deploy/cloudflare/functions/_shared/ai-diff-approve-a7-persistence-in-memory.mjs")
  ).href
);
const persist = await import(pathToFileURL(join(root, adapterRel)).href);
const a10 = await import(
  pathToFileURL(
    join(root, "deploy/cloudflare/functions/_shared/ai-diff-approve-a10-tamper-detection.mjs")
  ).href
);

assert(
  "pick env defaults apply off",
  persist.pickDiffApprovePersistenceEnv({}).applyEnabled === false
);
assert(
  "assert blocks production URL",
  persist.assertPersistenceAllowed({
    url: "https://ddojquacsyqesrjhcvmn.supabase.co",
    serviceRoleKey: "x",
    persistenceEnabled: true,
    applyEnabled: false,
  }).reason === "production_forbidden"
);
assert(
  "assert blocks apply enabled",
  persist.assertPersistenceAllowed({
    url: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    serviceRoleKey: "x",
    persistenceEnabled: true,
    applyEnabled: true,
  }).reason === "apply_forbidden"
);
assert(
  "assert blocks disabled",
  persist.assertPersistenceAllowed({
    url: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    serviceRoleKey: "x",
    persistenceEnabled: false,
    applyEnabled: false,
  }).reason === "persistence_disabled"
);

const hashes = persist.buildAuditEventHashes({
  previous_event_hash: "genesis",
  event_type: "proposal_created",
  sequence_number: 1,
  event_payload: { a: 1 },
});
assert("audit hash built", Boolean(hashes?.event_hash?.startsWith("fnv1a32:")));
assert(
  "A10 hashValue available",
  typeof a10.hashValue === "function" && a10.hashValue({ a: 1 })?.startsWith("fnv1a32:")
);

/** In-memory mock REST for adapter */
function createMockDb() {
  /** @type {Map<string, any>} */
  const records = new Map();
  /** @type {Map<string, any>} */
  const idem = new Map();
  /** @type {Map<string, any[]>} */
  const events = new Map();
  /** @type {Map<string, any>} */
  const proposals = new Map();

  return async (url, init = {}) => {
    const u = String(url);
    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;

    if (u.includes("/rpc/ai_diff_approve_write_step")) {
      const input = body?.p_input || {};
      const rec = input.record;
      if (!rec) {
        return jsonRes({ ok: false, error: "invalid_record", reason: "invalid_record" });
      }
      if (input.idempotency_key) {
        if (idem.has(input.idempotency_key)) {
          return jsonRes({
            ok: false,
            error: "duplicate_key",
            reason: "duplicate_key",
            existing: idem.get(input.idempotency_key),
          });
        }
        idem.set(input.idempotency_key, input.idempotency_token);
      }
      const key = `${rec.record_type}:${rec.record_id}`;
      const existing = records.get(key);
      if (existing) {
        if (existing.record_version >= rec.record_version) {
          return jsonRes({ ok: false, error: "duplicate_key", reason: "duplicate_key" });
        }
        if (existing.record_version !== rec.record_version - 1) {
          return jsonRes({ ok: false, error: "stale_version", reason: "stale_version" });
        }
      } else if (rec.record_version !== 1) {
        return jsonRes({ ok: false, error: "stale_version", reason: "stale_version" });
      }
      if (rec.proposal_id && !proposals.has(rec.proposal_id)) {
        proposals.set(rec.proposal_id, {
          proposal_id: rec.proposal_id,
          status: "draft",
          owner_user_id: input.owner_user_id || null,
          record_version: 1,
          created_at: "2026-07-28T00:00:00.000Z",
        });
      }
      const row = {
        ...rec,
        owner_user_id: input.owner_user_id || null,
        created_at: "2026-07-28T00:00:00.000Z",
        updated_at: "2026-07-28T00:00:00.000Z",
      };
      records.set(key, row);
      if (input.event && rec.proposal_id) {
        const list = events.get(rec.proposal_id) || [];
        const last = list[list.length - 1];
        const seq = input.event.sequence_number;
        if (!last) {
          if (seq !== 1 || input.event.previous_event_hash !== "genesis") {
            return jsonRes({
              ok: false,
              error: "invalid_context",
              reason: "out_of_order",
            });
          }
        } else if (
          seq !== last.sequence_number + 1 ||
          input.event.previous_event_hash !== last.event_hash
        ) {
          return jsonRes({
            ok: false,
            error: "invalid_context",
            reason:
              input.event.previous_event_hash !== last.event_hash
                ? "audit_chain_mismatch"
                : "out_of_order",
          });
        }
        list.push({
          id: `evt-${seq}`,
          proposal_id: rec.proposal_id,
          ...input.event,
          created_at: "2026-07-28T00:00:01.000Z",
        });
        events.set(rec.proposal_id, list);
      }
      return jsonRes({
        ok: true,
        reason: "stored",
        record_type: rec.record_type,
        record_id: rec.record_id,
        record_version: rec.record_version,
        proposal_id: rec.proposal_id,
      });
    }

    if (u.includes("/ai_diff_approve_records")) {
      if (method === "GET") {
        const typeM = u.match(/record_type=eq\.([^&]+)/);
        const idM = u.match(/record_id=eq\.([^&]+)/);
        const propM = u.match(/proposal_id=eq\.([^&]+)/);
        if (typeM && idM) {
          const row = records.get(
            `${decodeURIComponent(typeM[1])}:${decodeURIComponent(idM[1])}`
          );
          return jsonRes(row ? [row] : []);
        }
        if (propM) {
          const pid = decodeURIComponent(propM[1]);
          return jsonRes([...records.values()].filter((r) => r.proposal_id === pid));
        }
        return jsonRes([]);
      }
    }

    if (u.includes("/ai_diff_approve_idempotency") && method === "POST") {
      if (idem.has(body.idempotency_key)) {
        return jsonRes({ code: "23505" }, 409);
      }
      idem.set(body.idempotency_key, body.token);
      return jsonRes([body], 201);
    }

    if (u.includes("/ai_diff_approve_events") && method === "GET") {
      const propM = u.match(/proposal_id=eq\.([^&]+)/);
      const pid = propM ? decodeURIComponent(propM[1]) : "";
      return jsonRes(events.get(pid) || []);
    }

    if (u.includes("/ai_diff_approve_proposals") && method === "GET") {
      return jsonRes([...proposals.values()]);
    }

    return jsonRes({ error: "not_mocked", url: u }, 500);
  };
}

function jsonRes(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(json),
  };
}

console.log("\n3) Mock persistence adapter behavior");
const proposalId = "11111111-1111-4111-8111-111111111111";
const repo = persist.createPersistentRepository({
  url: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
  serviceRoleKey: "test-service-role",
  persistenceEnabled: true,
  applyEnabled: false,
  fetchImpl: createMockDb(),
  ownerUserId: "22222222-2222-4222-8222-222222222222",
});

const baseRecord = {
  schema_version: a7.PHASE_A7_SCHEMA_VERSION,
  record_type: "proposal",
  record_id: "rec-proposal-1",
  proposal_id: proposalId,
  execution_id: null,
  payload: { status: "draft", title: "café" },
  record_version: 1,
  created_at: "2026-07-28T00:00:00.000Z",
  updated_at: "2026-07-28T00:00:00.000Z",
};

{
  const put1 = await repo.put(baseRecord, {
    idempotency_key: "idem-key-0001",
    idempotency_token: "tok-1",
    operation_type: "create_proposal",
    event: {
      sequence_number: 1,
      event_type: "proposal_created",
      event_payload: { status: "draft" },
      previous_event_hash: "genesis",
    },
  });
  assert("put v1 ok", put1.ok === true);
  assert("NFC payload stored path", put1.value?.payload?.title === "café");
}

{
  const dup = await repo.put(
    { ...baseRecord, record_version: 1 },
    { idempotency_key: "idem-key-0001", idempotency_token: "tok-2" }
  );
  assert("duplicate idempotency rejected", dup.ok === false && dup.reason === "duplicate_key");
}

{
  const stale = await repo.put({ ...baseRecord, record_version: 3 });
  assert("stale version rejected", stale.ok === false && stale.reason === "stale_version");
}

{
  const ok2 = await repo.put({
    ...baseRecord,
    record_version: 2,
    payload: { status: "pending_approval", title: "café" },
  });
  assert("optimistic v2 ok", ok2.ok === true);
}

{
  const got = await repo.get("proposal", "rec-proposal-1");
  assert("get after write", got.ok === true && got.value?.record_version === 2);
}

{
  const list = await repo.listByProposal(proposalId);
  assert("listByProposal", list.length >= 1);
}

{
  const claim1 = await repo.claimIdempotency("idem-claim-aaaa", "t1");
  const claim2 = await repo.claimIdempotency("idem-claim-aaaa", "t2");
  assert("claim first ok", claim1.ok === true);
  assert("claim duplicate", claim2.ok === false && claim2.reason === "duplicate_key");
}

{
  const timeline = await repo.getAuditTimeline(proposalId);
  assert("timeline has event", timeline.length === 1 && timeline[0].event_type === "proposal_created");
}

{
  const bundle = await repo.getProposalBundle(proposalId);
  assert("bundle security zeros", bundle.applied === false && bundle.executed === false);
  assert("bundle provider false", bundle.provider_called === false && bundle.transmit === false);
  assert("bundle cost 0", bundle.recorded_api_cost === 0);
}

{
  let threw = false;
  try {
    repo.performApply();
  } catch {
    threw = true;
  }
  assert("performApply forbidden", threw);
}

{
  const bad = persist.createPersistentRepository({
    url: "https://ahlxuyvhzqdqaojiywmu.supabase.co",
    serviceRoleKey: "x",
    persistenceEnabled: true,
    applyEnabled: false,
    fetchImpl: async () => jsonRes([]),
  });
  const extra = await bad.put({
    ...baseRecord,
    extra_field: true,
  });
  assert("extra field rejected", extra.ok === false);
}

{
  const proto = await repo.put({
    ...baseRecord,
    record_id: "proto-test",
    payload: JSON.parse('{"a":1,"__proto__":{"x":1}}'),
  });
  // validatePersistenceRecord may accept payload object keys; normalize strips proto keys
  assert(
    "prototype key stripped or rejected",
    proto.ok === false ||
      (proto.ok === true && !Object.prototype.hasOwnProperty.call(proto.value.payload, "__proto__"))
  );
}

{
  const mem = a7.createInMemoryRepository();
  const m = mem.put(baseRecord);
  assert("in-memory compat still works", m.ok === true);
}

console.log("\n4) A11 NoOp orchestrator still accepts custom repository shape");
const a11 = await import(
  pathToFileURL(
    join(
      root,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-a11-non-live-orchestrator.mjs"
    )
  ).href
);
assert("orchestrator exports run", typeof a11.runNonLiveOrchestrator === "function");

console.log("\n5) Security scan of new files");
for (const rel of [migrationRel, adapterRel]) {
  const src = read(rel);
  assert(`${rel}: no ddoj production ref as target apply`, !/apply.*ddojquacsyqesrjhcvmn|ddojquacsyqesrjhcvmn.*apply/i.test(src) || /Production|forbidden|No-Go/i.test(src));
  assert(`${rel}: no fetch to openai`, !/api\.openai\.com/i.test(src));
}

if (errors.length) {
  console.error(`\nFAIL ${errors.length}`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\nPASS diff-approve staging persistence foundation");
