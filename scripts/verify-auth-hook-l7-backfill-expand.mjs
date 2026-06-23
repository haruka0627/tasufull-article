#!/usr/bin/env node
/**
 * L7 — verify allowlist backfill expand (READ-ONLY · optional JWT login per slot)
 *
 *   node scripts/verify-auth-hook-l7-backfill-expand.mjs
 *   node scripts/verify-auth-hook-l7-backfill-expand.mjs --through T3
 *   node scripts/verify-auth-hook-l7-backfill-expand.mjs --slot T2 --jwt
 *
 * Ref: ddojquacsyqesrjhcvmn · Hook ON assumed
 */
import { spawnSync } from "node:child_process";
import {
  ROOT,
  PROJECT_REF,
  loadL7Config,
  slotByName,
  expectedDbStateThrough,
} from "./lib/auth-hook-l7-slots.mjs";
import {
  decodeJwtPayload,
  extractClaimsFromJwt,
  canUseLocalStorageFallback,
} from "./lib/auth-current-user-core.mjs";
import path from "node:path";

const args = process.argv.slice(2);
const throughArg = args.includes("--through") ? args[args.indexOf("--through") + 1] : "T5";
const slotArg = args.includes("--slot") ? args[args.indexOf("--slot") + 1] : null;

/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function parseCliJson(out) {
  const jsonMatch = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function runSqlGates() {
  const sqlPath = path.join(ROOT, "sql/auth-hook-l7-verify-gates.sql");
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`SQL gates failed: ${combined.slice(0, 500)}`);
  const parsed = parseCliJson(combined);
  const row = parsed?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no rows");
  return row;
}

function assertDbGates(row, throughSlot) {
  const expected = expectedDbStateThrough(throughSlot);
  if (Number(row.hook_func_count) !== 1) throw new Error(`hook_func_count=${row.hook_func_count}`);
  if (Number(row.match_table_count) !== 0) throw new Error(`match_table_count=${row.match_table_count}`);
  if (Number(row.legacy_user_count) !== 7) throw new Error(`legacy_user_count=${row.legacy_user_count}`);
  if (Number(row.allowlist_user_meta_talk_keys) !== 0) {
    throw new Error(`user_metadata talk keys present: ${row.allowlist_user_meta_talk_keys}`);
  }
  if (Number(row.allowlist_provider_drift) !== 0) {
    throw new Error(`provider drift: ${row.allowlist_provider_drift}`);
  }
  for (const [key, val] of Object.entries(expected)) {
    const actual = row[key];
    const exp = val ?? null;
    if (actual !== exp) throw new Error(`${key} expected ${exp}, got ${actual}`);
  }
}

function claimsSummary(payload) {
  const app = payload?.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {};
  return {
    sub: payload?.sub ?? null,
    app_metadata: {
      talk_user_id: app.talk_user_id ?? null,
      member_id: app.member_id ?? null,
      provider: app.provider ?? null,
      providers: Array.isArray(app.providers) ? app.providers : null,
      role: app.role ?? null,
      platform_role: app.platform_role ?? null,
      is_ops: app.is_ops ?? null,
    },
  };
}

function assertHookOnClaims(label, payload, slot) {
  const s = claimsSummary(payload);
  if (s.sub !== slot.id) throw new Error(`${label}: sub mismatch`);
  if (s.app_metadata.talk_user_id !== slot.talkUserId) {
    throw new Error(`${label}: talk_user_id ${JSON.stringify(s.app_metadata)}`);
  }
  if (s.app_metadata.member_id !== slot.memberId) {
    throw new Error(`${label}: member_id ${JSON.stringify(s.app_metadata)}`);
  }
  if (s.app_metadata.provider !== "email") throw new Error(`${label}: provider lost`);
  if (!Array.isArray(s.app_metadata.providers) || !s.app_metadata.providers.includes("email")) {
    throw new Error(`${label}: providers lost`);
  }
  if (s.app_metadata.role !== "authenticated") throw new Error(`${label}: hook role missing`);
  if (s.app_metadata.platform_role !== "member") throw new Error(`${label}: hook platform_role missing`);
  if (s.app_metadata.is_ops !== false) throw new Error(`${label}: hook is_ops missing`);
  return s;
}

function resolveTasuAuthCurrentUser(session) {
  const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
  const user = session?.user || null;
  const claims = extractClaimsFromJwt(payload, user);
  const prodEnv = { hostname: "tasful.jp", config: { talkProductionMode: true } };
  if (!canUseLocalStorageFallback(prodEnv)) {
    const talkUserId = String(claims.talk_user_id || claims.sub || "").trim();
    return {
      talkUserId,
      memberId: String(claims.member_id || talkUserId).trim(),
      authUserId: claims.sub || "",
      source: talkUserId ? "jwt" : "none",
    };
  }
  throw new Error("expected production lockdown");
}

async function authFetch(cfg, { method, pathSuffix, body }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
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

async function verifySlotJwt(cfg, slot) {
  const login = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: slot.email, password: cfg.password },
  });
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`login HTTP ${login.status} ${login.text?.slice(0, 120)}`);
  }

  const loginPayload = decodeJwtPayload(login.data.access_token);
  const loginSummary = assertHookOnClaims(`${slot.slot} login`, loginPayload, slot);

  const refreshed = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=refresh_token",
    body: { refresh_token: login.data.refresh_token },
  });
  if (!refreshed.ok || !refreshed.data?.access_token) {
    throw new Error(`refresh HTTP ${refreshed.status}`);
  }

  const refreshPayload = decodeJwtPayload(refreshed.data.access_token);
  const refreshSummary = assertHookOnClaims(`${slot.slot} refresh`, refreshPayload, slot);
  if (JSON.stringify(loginSummary.app_metadata) !== JSON.stringify(refreshSummary.app_metadata)) {
    throw new Error(`${slot.slot}: login/refresh app_metadata mismatch`);
  }

  const tasu = resolveTasuAuthCurrentUser({
    access_token: refreshed.data.access_token,
    user: refreshed.data.user || login.data.user,
  });
  if (tasu.talkUserId !== slot.talkUserId) throw new Error(`talkUserId=${tasu.talkUserId}`);
  if (tasu.memberId !== slot.memberId) throw new Error(`memberId=${tasu.memberId}`);
  if (tasu.authUserId !== slot.id) throw new Error(`authUserId=${tasu.authUserId}`);
  if (tasu.source !== "jwt") throw new Error(`source=${tasu.source}`);

  return { loginSummary, refreshSummary, tasu };
}

async function main() {
  const cfg = loadL7Config();
  const throughSlot = throughArg || "T5";
  slotByName(throughSlot);

  console.log(`L7 verify · ref=${PROJECT_REF} · through=${throughSlot}`);

  try {
    const row = runSqlGates();
    assertDbGates(row, throughSlot);
    pass("SQL DB gates", `through=${throughSlot} hook=1 match=0 legacy=7`);
  } catch (e) {
    fail("SQL DB gates", e.message);
    process.exit(1);
  }

  const order = ["T2", "T3", "T4", "T5"];
  const throughIdx = order.indexOf(throughSlot);
  if (throughIdx < 0) throw new Error(`Invalid through slot: ${throughSlot}`);

  const jwtSlots = slotArg
    ? [slotByName(slotArg)]
    : order.slice(0, throughIdx + 1).map((s) => slotByName(s));

  for (const slot of jwtSlots) {
    try {
      const v = await verifySlotJwt(cfg, slot);
      pass(
        `${slot.slot} JWT/TasuAuth`,
        `talk=${v.tasu.talkUserId} member=${v.tasu.memberId} source=${v.tasu.source}`
      );
    } catch (e) {
      fail(`${slot.slot} JWT/TasuAuth`, e.message);
      console.error("STOP: consider Hook OFF rollback (L6 §11)");
      process.exit(1);
    }
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nL7 verify: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);
  if (ng.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
