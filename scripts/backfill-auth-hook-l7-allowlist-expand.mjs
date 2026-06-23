#!/usr/bin/env node
/**
 * L7 — allowlist T2→T5 sequential app_metadata backfill (Hook ON)
 *
 *   node scripts/backfill-auth-hook-l7-allowlist-expand.mjs
 *   node scripts/backfill-auth-hook-l7-allowlist-expand.mjs --dry-run
 *   node scripts/backfill-auth-hook-l7-allowlist-expand.mjs --from T3
 *   node scripts/backfill-auth-hook-l7-allowlist-expand.mjs --slot T2
 *
 * Ref: ddojquacsyqesrjhcvmn only
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  ROOT,
  PROJECT_REF,
  L7_BACKFILL_SLOTS,
  loadL7Config,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fromSlot = args.includes("--from") ? args[args.indexOf("--from") + 1] : "T2";
const onlySlot = args.includes("--slot") ? args[args.indexOf("--slot") + 1] : null;

/** @type {{ slot: string, step: string, ok: boolean, detail?: string }[]} */
const gateLog = [];

function pass(slot, step, detail = "") {
  gateLog.push({ slot, step, ok: true, detail });
  console.log(`  OK  [${slot}] ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(slot, step, detail = "") {
  gateLog.push({ slot, step, ok: false, detail });
  console.error(`  NG  [${slot}] ${step}${detail ? `: ${detail}` : ""}`);
}

async function authFetch(cfg, { method, pathSuffix, body, useServiceRole = false }) {
  const key = useServiceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${useServiceRole ? cfg.serviceRoleKey : cfg.anonKey}`,
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

async function getAdminUser(cfg, userId) {
  const res = await authFetch(cfg, {
    method: "GET",
    pathSuffix: `/admin/users/${encodeURIComponent(userId)}`,
    useServiceRole: true,
  });
  if (!res.ok) throw new Error(`get user failed: ${res.status}`);
  return res.data;
}

async function mergeAppMetadata(cfg, slot, dry) {
  const patch = { talk_user_id: slot.talkUserId, member_id: slot.memberId };
  const before = await getAdminUser(cfg, slot.id);
  const beforeApp = before.app_metadata || before.raw_app_meta_data || {};
  const beforeUser = before.user_metadata || before.raw_user_meta_data || {};

  if (beforeApp.talk_user_id === slot.talkUserId && beforeApp.member_id === slot.memberId) {
    return { before, after: before, skipped: true };
  }

  if (dry) {
    console.log(`  dry-run ${slot.slot} merge:`, JSON.stringify(patch));
    return { before, after: before, skipped: false };
  }

  const res = await authFetch(cfg, {
    method: "PUT",
    pathSuffix: `/admin/users/${encodeURIComponent(slot.id)}`,
    useServiceRole: true,
    body: { app_metadata: patch },
  });
  if (!res.ok) throw new Error(`update failed: ${res.status} ${JSON.stringify(res.data)}`);

  const after = await getAdminUser(cfg, slot.id);
  const afterApp = after.app_metadata || after.raw_app_meta_data || {};
  const afterUser = after.user_metadata || after.raw_user_meta_data || {};

  if (afterApp.talk_user_id !== slot.talkUserId || afterApp.member_id !== slot.memberId) {
    throw new Error("backfill values not applied");
  }
  if (afterApp.provider !== "email") throw new Error("provider changed");
  if (!Array.isArray(afterApp.providers) || !afterApp.providers.includes("email")) {
    throw new Error("providers changed");
  }
  if (JSON.stringify(afterUser) !== JSON.stringify(beforeUser)) {
    throw new Error("user_metadata changed");
  }
  if (afterUser.talk_user_id || afterUser.member_id) {
    throw new Error("user_metadata must not gain talk/member keys");
  }

  return { before, after, skipped: false };
}

function runVerifyThrough(slotName) {
  const r = spawnSync(
    "node",
    ["scripts/verify-auth-hook-l7-backfill-expand.mjs", "--through", slotName],
    { cwd: ROOT, encoding: "utf8", shell: true }
  );
  return { ok: r.status === 0, output: `${r.stdout || ""}${r.stderr || ""}` };
}

function slotsToRun() {
  if (onlySlot) return [slotByName(onlySlot)];
  const order = ["T2", "T3", "T4", "T5"];
  const start = order.indexOf(fromSlot);
  if (start < 0) throw new Error(`Invalid --from ${fromSlot}`);
  return order.slice(start).map((s) => slotByName(s));
}

async function main() {
  const cfg = loadL7Config();
  const slots = slotsToRun();

  console.log(
    `L7 backfill expand · ref=${PROJECT_REF} · Hook ON · dryRun=${dryRun} · slots=${slots.map((s) => s.slot).join("→")}`
  );

  for (const slot of slots) {
    console.log(`\n=== ${slot.slot} backfill gate ===`);

    try {
      const result = await mergeAppMetadata(cfg, slot, dryRun);
      if (result.skipped) {
        pass(slot.slot, "merge", "already backfilled");
      } else if (dryRun) {
        pass(slot.slot, "merge", "dry-run only");
        continue;
      } else {
        const afterApp = result.after.app_metadata || result.after.raw_app_meta_data || {};
        pass(
          slot.slot,
          "merge",
          `talk=${afterApp.talk_user_id} member=${afterApp.member_id} provider=email`
        );
      }
    } catch (e) {
      fail(slot.slot, "merge", e.message);
      console.error("\nSTOP — rollback: Dashboard Hook OFF (L6 §11) · L1 baseline · L5 DROP if needed");
      process.exit(1);
    }

    if (dryRun) continue;

    const verify = runVerifyThrough(slot.slot);
    if (!verify.ok) {
      fail(slot.slot, "post-gate verify", verify.output.split("\n").slice(-5).join(" | "));
      console.error("\nSTOP — rollback: Dashboard Hook OFF (L6 §11)");
      process.exit(1);
    }
    pass(slot.slot, "post-gate verify", `through=${slot.slot} PASS`);
  }

  const ng = gateLog.filter((g) => !g.ok);
  console.log(`\nL7 backfill: ${ng.length === 0 ? "PASS" : "FAIL"} (${gateLog.length} gate steps)`);
  if (ng.length) process.exit(1);
  console.log("Judgment: READY_FOR_LINKED_REF_L8_EDGE_PREP");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
