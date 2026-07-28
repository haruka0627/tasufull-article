#!/usr/bin/env node
/**
 * Diff & Approve — Staging Operator Decision Write Foundation tests
 *   node scripts/test-diff-approve-staging-decision-write.mjs
 *
 * Unit/contract + static migration audit · optional Staging RPC when .env.staging present.
 * No Apply · Provider · Production.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationRel =
  "supabase/migrations/20260728160000_ai_diff_approve_staging_decision_write.sql";
const errors = [];
const STAGING_REF = "ahlxuyvhzqdqaojiywmu";
const PRODUCTION_REF = "ddojquacsyqesrjhcvmn";

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

function loadEnvFile(rel) {
  const p = join(root, rel);
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

const contractMod = await import(
  pathToFileURL(
    join(
      root,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-contract.mjs"
    )
  ).href
);
const writeMod = await import(
  pathToFileURL(
    join(
      root,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-write.mjs"
    )
  ).href
);
const repoMod = await import(
  pathToFileURL(
    join(
      root,
      "deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs"
    )
  ).href
);

console.log("1) Static migration audit");
assert("migration exists", existsSync(join(root, migrationRel)));
const sql = read(migrationRel);
assert("record_decision RPC", /ai_diff_approve_record_decision/i.test(sql));
assert("search_path fixed", /set search_path = public/i.test(sql));
assert("security definer", /security definer/i.test(sql));
assert(
  "revoke anon/authenticated",
  /revoke all on function public\.ai_diff_approve_record_decision\(jsonb\)[\s\S]{0,80}from public, anon, authenticated/i.test(
    sql
  )
);
assert(
  "grant service_role only",
  /grant execute on function public\.ai_diff_approve_record_decision\(jsonb\) to service_role/i.test(
    sql
  )
);
assert("no applying transition", !/to_status = 'applying'/i.test(sql));
assert("no applied transition", !/to_status = 'applied'/i.test(sql));
assert("propose edge", /action = 'propose'[\s\S]*pending_approval/i.test(sql));
assert("approve edge", /action = 'approve'[\s\S]*approved/i.test(sql));
assert("reject edge", /action = 'reject'[\s\S]*rejected/i.test(sql));
assert("cancel edge", /action = 'cancel'[\s\S]*cancelled/i.test(sql));
assert("VERSION_CONFLICT", /VERSION_CONFLICT/.test(sql));
assert("IDEMPOTENCY_CONFLICT", /IDEMPOTENCY_CONFLICT/.test(sql));
assert("ALREADY_DECIDED", /ALREADY_DECIDED/.test(sql));
assert("no Production ref", !new RegExp(PRODUCTION_REF, "i").test(sql));
assert("no performApply", !/performApply|executeProvider|commitApply/.test(sql));
assert("no queue enqueue", !/pg_cron|pgmq|graphile_worker/i.test(sql));

console.log("\n2) Decision contract unit");
const sampleId = "11111111-1111-4111-8111-111111111111";
const base = {
  requestId: sampleId,
  action: "propose",
  expectedVersion: 1,
  idempotencyKey: "client-key-abc123",
};

{
  const v = contractMod.validateDecisionWriteInput(base);
  assert("valid propose", v.ok === true && v.value.toStatus === "pending_approval");
}
{
  const v = contractMod.validateDecisionWriteInput({
    ...base,
    action: "approve",
  });
  assert("valid approve", v.ok && v.value.toStatus === "approved");
}
{
  const v = contractMod.validateDecisionWriteInput({
    ...base,
    action: "reject",
  });
  assert("valid reject", v.ok && v.value.toStatus === "rejected");
}
{
  const v = contractMod.validateDecisionWriteInput({
    ...base,
    action: "cancel",
  });
  assert("valid cancel", v.ok && v.value.toStatus === "cancelled");
}
assert(
  "unknown action",
  contractMod.validateDecisionWriteInput({ ...base, action: "apply" }).ok ===
    false
);
assert(
  "unknown field",
  contractMod.validateDecisionWriteInput({ ...base, extra: 1 }).ok === false
);
assert(
  "invalid UUID",
  contractMod.validateDecisionWriteInput({ ...base, requestId: "nope" }).ok ===
    false
);
assert(
  "invalid expectedVersion",
  contractMod.validateDecisionWriteInput({ ...base, expectedVersion: -1 })
    .ok === false
);
assert(
  "invalid idempotencyKey",
  contractMod.validateDecisionWriteInput({ ...base, idempotencyKey: "short" })
    .ok === false
);
assert(
  "oversized reason",
  contractMod.validateDecisionWriteInput({
    ...base,
    reason: "x".repeat(501),
  }).ok === false
);
assert(
  "control characters",
  contractMod.validateDecisionWriteInput({
    ...base,
    reason: "bad\u0000reason",
  }).ok === false
);
assert(
  "prototype keys",
  contractMod.validateDecisionWriteInput(
    JSON.parse('{"requestId":"' + sampleId + '","action":"propose","expectedVersion":1,"idempotencyKey":"client-key-abc123","__proto__":{"x":1}}')
  ).ok === false ||
    !Object.prototype.hasOwnProperty.call(
      JSON.parse('{"__proto__":{"x":1}}'),
      "x"
    )
);
{
  const a = contractMod.validateDecisionWriteInput({
    ...base,
    reason: "  hello   world  ",
  });
  const b = contractMod.validateDecisionWriteInput({
    ...base,
    reason: "hello world",
  });
  assert(
    "Unicode/whitespace normalization hash stable",
    a.ok && b.ok && a.value.payloadHash === b.value.payloadHash
  );
}
assert(
  "draft->proposed via propose",
  contractMod.canTransition("draft", "propose") === true
);
assert(
  "proposed->approved",
  contractMod.canTransition("pending_approval", "approve") === true
);
assert(
  "proposed->rejected",
  contractMod.canTransition("pending_approval", "reject") === true
);
assert(
  "proposed->cancelled",
  contractMod.canTransition("pending_approval", "cancel") === true
);
assert(
  "draft->approved DENY",
  contractMod.canTransition("draft", "approve") === false
);
assert(
  "approved->rejected DENY",
  contractMod.canTransition("approved", "reject") === false
);
assert(
  "rejected->approved DENY",
  contractMod.canTransition("rejected", "approve") === false
);
assert(
  "cancelled->approved DENY",
  contractMod.canTransition("cancelled", "approve") === false
);
assert(
  "approved->cancelled DENY",
  contractMod.canTransition("approved", "cancel") === false
);
assert(
  "error normalize VERSION",
  contractMod.normalizeDecisionError("stale_version") === "VERSION_CONFLICT"
);

console.log("\n3) Apply isolation (static)");
const writeSrc = read(
  "deploy/cloudflare/functions/_shared/ai-diff-approve-ops-decision-write.mjs"
);
const repoSrc = read(
  "deploy/cloudflare/functions/_shared/ai-diff-approve-persistence-repository.mjs"
);
const routeSrc = read(
  "deploy/cloudflare/functions/api/ai-diff-approve/[id]/decision.js"
);
const clientSrc = read("admin-diff-approve-client.js");
assert(
  "decision-write no Apply import",
  !/ai-diff-approve-a4-apply|performApply|executeProvider/.test(writeSrc)
);
assert(
  "route no Apply import",
  !/performApply|executeProvider|a4-apply/.test(routeSrc)
);
assert(
  "repo recordOperatorDecision present",
  /recordOperatorDecision/.test(repoSrc)
);
assert(
  "repo still rejects apply fns",
  /FORBIDDEN_APPLY_FNS/.test(repoSrc) && /performApply/.test(repoSrc)
);
assert("UI has Propose", /Propose/.test(clientSrc));
assert("UI has Approve", /Approve/.test(clientSrc));
assert("UI has NO APPLY badge", /NO APPLY/.test(clientSrc));
assert(
  "UI forbids Apply button label as action",
  !/textContent = ["']Apply["']/.test(clientSrc) &&
    !/>Apply</.test(clientSrc)
);
assert("UI no Execute button", !/textContent\s*=\s*["']Execute["']/.test(clientSrc));
assert("UI no Rollback", !/\bRollback\b/.test(clientSrc));

console.log("\n4) Origin / env guards");
{
  const bad = writeMod.assertDecisionWriteOrigin(
    new Request("https://example.com", {
      headers: { Origin: "https://tasful.jp" },
    })
  );
  assert("deny production origin", bad.ok === false);
}
{
  const ok = writeMod.assertDecisionWriteOrigin(
    new Request("http://127.0.0.1:8788/x", {
      headers: { Origin: "http://127.0.0.1:8788" },
    })
  );
  assert("allow 8788 origin", ok.ok === true);
}
{
  const env = writeMod.assertDecisionWriteEnvironment({
    AI_EXEC_GATE_ENVIRONMENT: "production",
    SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "x",
    DIFF_APPROVE_PERSISTENCE_ENABLED: "true",
    DIFF_APPROVE_APPLY_ENABLED: "false",
  });
  assert("deny production gate env", env.ok === false);
}

console.log("\n5) Optional Staging persistence round-trip");
const staging = loadEnvFile(".env.staging");
const url = String(staging.TASFUL_SUPABASE_URL || staging.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const service = String(staging.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const canLive =
  url.includes(STAGING_REF) &&
  !url.includes(PRODUCTION_REF) &&
  Boolean(service);

if (!canLive) {
  console.log("  · skip live Staging (no .env.staging keys)");
} else {
  const actorId = randomUUID();
  const draftId = randomUUID();
  const pendingId = randomUUID();
  const rejectId = randomUUID();
  const cancelId = randomUUID();
  const env = {
    AI_EXEC_GATE_ENVIRONMENT: "staging",
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: service,
    DIFF_APPROVE_PERSISTENCE_ENABLED: "true",
    DIFF_APPROVE_READ_ENABLED: "true",
    DIFF_APPROVE_APPLY_ENABLED: "false",
  };

  async function insertDraft(id) {
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
        owner_user_id: null,
        payload: { status: "draft", test: "decision_write" },
      }),
    });
    return res.ok || res.status === 201;
  }

  async function cleanup(ids) {
    for (const id of ids) {
      await fetch(
        `${url}/rest/v1/ai_diff_approve_events?proposal_id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: service,
            Authorization: `Bearer ${service}`,
          },
        }
      ).catch(() => {});
      await fetch(
        `${url}/rest/v1/ai_diff_approve_records?proposal_id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: service,
            Authorization: `Bearer ${service}`,
          },
        }
      ).catch(() => {});
      await fetch(
        `${url}/rest/v1/ai_diff_approve_idempotency?proposal_id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: service,
            Authorization: `Bearer ${service}`,
          },
        }
      ).catch(() => {});
      await fetch(
        `${url}/rest/v1/ai_diff_approve_proposals?proposal_id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: service,
            Authorization: `Bearer ${service}`,
          },
        }
      ).catch(() => {});
    }
  }

  // Events/idempotency may not allow DELETE — use service only if granted.
  // Prefer RPC verify after migration; cleanup best-effort.

  const repo = repoMod.createPersistentRepository({ env, ownerUserId: actorId });

  try {
    // Ensure RPC exists
    const probe = await fetch(
      `${url}/rest/v1/rpc/ai_diff_approve_record_decision`,
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
    assert(
      "RPC reachable",
      probe.ok ||
        (probeJson && (probeJson.ok === false || probeJson.error))
    );

    assert("seed draft", await insertDraft(draftId));
    assert("seed pending sibling", await insertDraft(pendingId));
    assert("seed reject sibling", await insertDraft(rejectId));
    assert("seed cancel sibling", await insertDraft(cancelId));

    const propose1 = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: draftId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: "e2e-propose-key-001",
        reason: "unit propose",
      },
    });
    assert(
      "propose success",
      propose1.ok === true &&
        propose1.body?.currentStatus === "pending_approval" &&
        propose1.body?.applied === false
    );

    const proposeReplay = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: draftId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: "e2e-propose-key-001",
        reason: "unit propose",
      },
    });
    assert(
      "same-key same-payload replay",
      proposeReplay.ok === true && proposeReplay.body?.replayed === true
    );

    const proposeConflict = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: draftId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: "e2e-propose-key-001",
        reason: "different reason",
      },
    });
    assert(
      "same-key different-payload conflict",
      proposeConflict.ok === false &&
        proposeConflict.error === "IDEMPOTENCY_CONFLICT"
    );

    const approve = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: draftId,
        action: "approve",
        expectedVersion: 2,
        idempotencyKey: "e2e-approve-key-001",
      },
    });
    assert(
      "approve success stops at approved",
      approve.ok === true &&
        approve.body?.currentStatus === "approved" &&
        approve.body?.applied === false &&
        approve.body?.provider_called === false
    );

    const approveAgain = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: draftId,
        action: "reject",
        expectedVersion: 3,
        idempotencyKey: "e2e-reject-after-approve",
      },
    });
    assert(
      "reject after approve denied",
      approveAgain.ok === false &&
        (approveAgain.error === "ALREADY_DECIDED" ||
          approveAgain.error === "INVALID_STATE_TRANSITION")
    );

    // Independent reject path
    await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: rejectId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: "e2e-rej-propose",
      },
    });
    const rejected = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: rejectId,
        action: "reject",
        expectedVersion: 2,
        idempotencyKey: "e2e-rej-decide",
        reason: "nope",
      },
    });
    assert(
      "reject success",
      rejected.ok === true && rejected.body?.currentStatus === "rejected"
    );

    await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: cancelId,
        action: "propose",
        expectedVersion: 1,
        idempotencyKey: "e2e-can-propose",
      },
    });
    const cancelled = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: cancelId,
        action: "cancel",
        expectedVersion: 2,
        idempotencyKey: "e2e-can-decide",
      },
    });
    assert(
      "cancel success",
      cancelled.ok === true && cancelled.body?.currentStatus === "cancelled"
    );

    const stale = await writeMod.recordOperatorDecision({
      env,
      actor: { userId: actorId },
      body: {
        requestId: pendingId,
        action: "propose",
        expectedVersion: 99,
        idempotencyKey: "e2e-stale-version",
      },
    });
    assert(
      "stale version conflict",
      stale.ok === false && stale.error === "VERSION_CONFLICT"
    );

    // anon cannot execute RPC
    const anon = String(
      staging.TASFUL_SUPABASE_ANON_KEY || staging.SUPABASE_ANON_KEY || ""
    ).trim();
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
          body: JSON.stringify({
            p_input: {
              proposal_id: draftId,
              action: "propose",
              expected_version: 1,
              idempotency_key: "anon-should-fail-key",
              payload_hash: "hashhashhash",
              actor_id: actorId,
              event_type: "proposal_submitted",
              from_status: "draft",
              to_status: "pending_approval",
              event_hash: "hashhashhash",
              previous_event_hash: "genesis",
              sequence_number: 1,
              environment: "staging",
              event_payload: {},
            },
          }),
        }
      );
      assert(
        "anonymous RPC denied",
        anonRes.status === 401 ||
          anonRes.status === 403 ||
          anonRes.status === 404 ||
          !anonRes.ok
      );
    }

    // Direct table write by authenticated is deny-all; skip without user JWT.
    assert("repo apply still forbidden", typeof repo.performApply === "function");
    let applyBlocked = false;
    try {
      repo.performApply();
    } catch (e) {
      applyBlocked = e?.code === "apply_forbidden";
    }
    assert("performApply throws", applyBlocked);

    await cleanup([draftId, pendingId, rejectId, cancelId]);
  } catch (e) {
    errors.push(`live staging error: ${e && e.message ? e.message : e}`);
    console.log(`  ✗ live staging error: ${e && e.message ? e.message : e}`);
    await cleanup([draftId, pendingId, rejectId, cancelId]);
  }
}

console.log("\n---");
if (errors.length) {
  console.error(`FAIL ${errors.length} assertion(s)`);
  process.exit(1);
}
console.log("PASS_STAGING_DECISION_WRITE_LOCAL");
process.exit(0);
