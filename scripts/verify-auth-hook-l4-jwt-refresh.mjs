#!/usr/bin/env node
/**
 * L4 — T1 JWT refresh / auth.jwt() / TasuAuthCurrentUser alignment (READ-ONLY · no DB writes)
 *
 *   node scripts/verify-auth-hook-l4-jwt-refresh.mjs
 *
 * Target: t1@tasful.invalid · 2d537fc9-ee67-4da8-97d3-bafe824ba466
 * Ref: ddojquacsyqesrjhcvmn only
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  decodeJwtPayload,
  extractClaimsFromJwt,
  canUseLocalStorageFallback,
} from "./lib/auth-current-user-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const T1 = {
  email: "t1@tasful.invalid",
  authUserId: "2d537fc9-ee67-4da8-97d3-bafe824ba466",
  talkUserId: "t1",
  memberId: "t1",
};

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

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function loadConfig() {
  loadDotEnv();
  let url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  let anonKey = process.env.SUPABASE_ANON_KEY || "";
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  if (ref !== "ddojquacsyqesrjhcvmn") {
    throw new Error(`Ref mismatch: expected ddojquacsyqesrjhcvmn, got ${ref || url}`);
  }
  const password = process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD || "";
  if (!password) throw new Error("AUTH_HOOK_L2_ALLOWLIST_PASSWORD required (.env)");
  return { url, anonKey, password };
}

function claimsSummary(payload) {
  const app = payload?.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {};
  return {
    sub: payload?.sub ?? null,
    role: payload?.role ?? null,
    app_metadata: {
      talk_user_id: app.talk_user_id ?? null,
      member_id: app.member_id ?? null,
      provider: app.provider ?? null,
      providers: Array.isArray(app.providers) ? app.providers : null,
    },
  };
}

function assertJwtClaims(label, payload) {
  const s = claimsSummary(payload);
  if (s.sub !== T1.authUserId) {
    throw new Error(`${label}: sub mismatch ${s.sub}`);
  }
  if (s.app_metadata.talk_user_id !== T1.talkUserId) {
    throw new Error(`${label}: talk_user_id mismatch ${JSON.stringify(s)}`);
  }
  if (s.app_metadata.member_id !== T1.memberId) {
    throw new Error(`${label}: member_id mismatch ${JSON.stringify(s)}`);
  }
  if (s.app_metadata.provider !== "email") {
    throw new Error(`${label}: provider lost`);
  }
  if (!Array.isArray(s.app_metadata.providers) || !s.app_metadata.providers.includes("email")) {
    throw new Error(`${label}: providers lost`);
  }
  return s;
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
  return { ok: res.ok, status: res.status, data };
}

async function signIn(cfg) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: T1.email, password: cfg.password },
  });
}

async function refreshToken(cfg, refreshTokenValue) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=refresh_token",
    body: { refresh_token: refreshTokenValue },
  });
}

async function rpcTalkCurrentUserId(cfg, accessToken) {
  const res = await fetch(`${cfg.url}/rest/v1/rpc/talk_current_user_id`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`rpc talk_current_user_id: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text.replace(/^"|"$/g, "");
  }
}

/**
 * Mirrors auth-current-user.js getCurrentUser() for JWT-only path (production host).
 */
function resolveTasuAuthCurrentUser(session) {
  const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
  const user = session?.user || null;
  const claims = extractClaimsFromJwt(payload, user);

  const prodEnv = {
    hostname: "tasful.jp",
    config: { talkProductionMode: true },
  };
  if (!canUseLocalStorageFallback(prodEnv)) {
    const talkUserId = String(claims.talk_user_id || claims.sub || "").trim();
    return {
      authenticated: Boolean(talkUserId),
      sub: claims.sub || "",
      talkUserId,
      memberId: String(claims.member_id || talkUserId).trim(),
      authUserId: claims.sub || "",
      source: talkUserId ? "jwt" : "none",
    };
  }
  throw new Error("expected production lockdown");
}

async function readOnlySanity(cfg) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceKey) return { skipped: true };

  const res = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(T1.authUserId)}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) throw new Error(`admin read T1 failed: ${res.status}`);
  const user = await res.json();
  const app = user.app_metadata || {};
  if (app.talk_user_id !== T1.talkUserId || app.member_id !== T1.memberId) {
    throw new Error("T1 app_metadata changed unexpectedly");
  }
  if (app.provider !== "email") throw new Error("T1 provider changed");
  return { skipped: false, app_metadata: { talk_user_id: app.talk_user_id, member_id: app.member_id, provider: app.provider, providers: app.providers } };
}

async function main() {
  const cfg = loadConfig();
  console.log("L4 verify · ref=ddojquacsyqesrjhcvmn · Hook OFF · READ-ONLY");

  const login = await signIn(cfg);
  if (!login.ok || !login.data?.access_token) {
    fail("T1 login", `HTTP ${login.status}`);
    process.exit(1);
  }
  pass("T1 login", `HTTP ${login.status}`);

  const loginPayload = decodeJwtPayload(login.data.access_token);
  const loginSummary = assertJwtClaims("login JWT", loginPayload);
  pass("JWT decode login", JSON.stringify(loginSummary.app_metadata));

  const refreshed = await refreshToken(cfg, login.data.refresh_token);
  if (!refreshed.ok || !refreshed.data?.access_token) {
    fail("session refresh", `HTTP ${refreshed.status}`);
    process.exit(1);
  }
  pass("session refresh", `HTTP ${refreshed.status}`);

  const refreshPayload = decodeJwtPayload(refreshed.data.access_token);
  const refreshSummary = assertJwtClaims("refresh JWT", refreshPayload);
  pass("JWT decode refresh", JSON.stringify(refreshSummary.app_metadata));

  const rpcAfterLogin = await rpcTalkCurrentUserId(cfg, login.data.access_token);
  if (rpcAfterLogin !== T1.talkUserId) {
    fail("auth.jwt() via talk_current_user_id (login token)", String(rpcAfterLogin));
    process.exit(1);
  }
  pass(
    "Postgres auth.jwt() proxy (login)",
    `rpc/talk_current_user_id=${rpcAfterLogin} (= app_metadata.talk_user_id path)`
  );

  const rpcAfterRefresh = await rpcTalkCurrentUserId(cfg, refreshed.data.access_token);
  if (rpcAfterRefresh !== T1.talkUserId) {
    fail("auth.jwt() via talk_current_user_id (refresh token)", String(rpcAfterRefresh));
    process.exit(1);
  }
  pass(
    "Postgres auth.jwt() proxy (refresh)",
    `rpc/talk_current_user_id=${rpcAfterRefresh}; member_id coalesce equivalent (both=t1)`
  );

  const session = {
    access_token: refreshed.data.access_token,
    user: refreshed.data.user || login.data.user,
  };
  const tasu = resolveTasuAuthCurrentUser(session);
  if (tasu.talkUserId !== T1.talkUserId) fail("TasuAuthCurrentUser talkUserId", tasu.talkUserId);
  else pass("TasuAuthCurrentUser talkUserId", tasu.talkUserId);

  if (tasu.memberId !== T1.memberId) fail("TasuAuthCurrentUser memberId", tasu.memberId);
  else pass("TasuAuthCurrentUser memberId", tasu.memberId);

  if (tasu.authUserId !== T1.authUserId) fail("TasuAuthCurrentUser authUserId", tasu.authUserId);
  else pass("TasuAuthCurrentUser authUserId", tasu.authUserId);

  if (tasu.source !== "jwt") fail("TasuAuthCurrentUser source", tasu.source);
  else pass("TasuAuthCurrentUser source", tasu.source);

  const sanity = await readOnlySanity(cfg);
  if (sanity.skipped) {
    pass("T1 metadata sanity (admin read)", "skipped — no service role in env");
  } else {
    pass("T1 metadata unchanged", JSON.stringify(sanity.app_metadata));
  }

  const aligned =
    loginSummary.app_metadata.talk_user_id === rpcAfterRefresh &&
    refreshSummary.app_metadata.talk_user_id === rpcAfterRefresh &&
    tasu.talkUserId === rpcAfterRefresh &&
    tasu.memberId === T1.memberId;
  if (!aligned) {
    fail("3-way alignment", "JWT / RPC / TasuAuthCurrentUser mismatch");
    process.exit(1);
  }
  pass("3-way alignment", "JWT decode = RPC talk_current_user_id = TasuAuthCurrentUser");

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\nL4 FAILED (${failed.length})`);
    process.exit(1);
  }
  console.log("\nL4 PASS — READY_FOR_LINKED_REF_L5_HOOK_CREATE_OFF");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
