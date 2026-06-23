#!/usr/bin/env node
/**
 * L3 — T1 only app_metadata backfill (talk_user_id / member_id)
 *
 *   node scripts/backfill-auth-hook-l3-t1.mjs
 *   node scripts/backfill-auth-hook-l3-t1.mjs --dry-run
 *   node scripts/backfill-auth-hook-l3-t1.mjs --verify-only
 *
 * Target: t1@tasful.invalid · 2d537fc9-ee67-4da8-97d3-bafe824ba466
 * Ref: ddojquacsyqesrjhcvmn only
 *
 * Does NOT modify: T2–T5 · existing 7 users · user_metadata
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const T1 = {
  slot: "T1",
  email: "t1@tasful.invalid",
  id: "2d537fc9-ee67-4da8-97d3-bafe824ba466",
  talkUserId: "t1",
  memberId: "t1",
};

const PROTECTED_IDS = new Set([
  T1.id,
  "d9f57cfa-61f9-4426-ad6a-78ebbd1b7723",
  "fbd8fdf3-d789-43eb-be9b-3a03b2df90d3",
  "6b13b77f-1de1-47f1-97cd-3c401ce81c0c",
  "147ebffb-6504-4df5-ac31-072e1c6531b4",
  "72d07af0-3d3b-4a87-8358-cae56a3ad721",
  "c8476454-e1f9-4efc-adfc-6fd6ba6102f9",
  "b77481c9-18f5-4130-854b-1a97db97c357",
  "a4a111ca-d70e-4444-bc1c-e7ca4efc5597",
  "15bb209a-7170-4702-8fd9-672bc5352616",
  "9d9bd0bb-8849-4dd5-bd25-b51e230a900a",
  "0f106b57-e056-451f-8fe4-079464c70815",
]);

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
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
  if (ref !== "ddojquacsyqesrjhcvmn") {
    throw new Error(`Ref mismatch: expected ddojquacsyqesrjhcvmn, got ${ref || url}`);
  }
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY required");
  const password = process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD || "";
  if (!password) throw new Error("AUTH_HOOK_L2_ALLOWLIST_PASSWORD required (.env)");
  return { url, anonKey, serviceRoleKey, password };
}

function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt || "").split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractClaimsSummary(payload) {
  if (!payload) return null;
  const app = payload.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {};
  return {
    sub: payload.sub || null,
    role: payload.role || null,
    app_metadata: {
      talk_user_id: app.talk_user_id ?? null,
      member_id: app.member_id ?? null,
      provider: app.provider ?? null,
      providers: Array.isArray(app.providers) ? app.providers : null,
    },
  };
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
  return { ok: res.ok, status: res.status, data };
}

async function getAdminUser(cfg, userId) {
  const res = await authFetch(cfg, {
    method: "GET",
    pathSuffix: `/admin/users/${encodeURIComponent(userId)}`,
    useServiceRole: true,
  });
  if (!res.ok) throw new Error(`get user failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

async function mergeAppMetadata(cfg, userId, patch, dryRun) {
  const before = await getAdminUser(cfg, userId);
  const merged = {
    ...(before.app_metadata || before.raw_app_meta_data || {}),
    ...patch,
  };
  if (dryRun) {
    console.log("dry-run merge app_metadata:", JSON.stringify(merged));
    return { before, after: { ...before, app_metadata: merged } };
  }
  const res = await authFetch(cfg, {
    method: "PUT",
    pathSuffix: `/admin/users/${encodeURIComponent(userId)}`,
    useServiceRole: true,
    body: { app_metadata: patch },
  });
  if (!res.ok) {
    throw new Error(`update user failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  const after = await getAdminUser(cfg, userId);
  return { before, after };
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

function assertProviderPreserved(appMeta) {
  if (appMeta?.provider !== "email") {
    throw new Error(`provider lost or changed: ${JSON.stringify(appMeta?.provider)}`);
  }
  if (!Array.isArray(appMeta?.providers) || !appMeta.providers.includes("email")) {
    throw new Error(`providers lost or changed: ${JSON.stringify(appMeta?.providers)}`);
  }
}

async function verifyJwtFlow(cfg) {
  const login = await signIn(cfg);
  if (!login.ok) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.data)}`);
  }
  const accessToken = login.data?.access_token;
  const refreshTok = login.data?.refresh_token;
  if (!accessToken) throw new Error("no access_token from login");

  const loginClaims = extractClaimsSummary(decodeJwtPayload(accessToken));
  if (loginClaims?.app_metadata?.talk_user_id !== T1.talkUserId) {
    throw new Error(`login JWT talk_user_id mismatch: ${JSON.stringify(loginClaims)}`);
  }
  if (loginClaims?.app_metadata?.member_id !== T1.memberId) {
    throw new Error(`login JWT member_id mismatch: ${JSON.stringify(loginClaims)}`);
  }
  assertProviderPreserved(loginClaims.app_metadata);

  let refreshClaims = null;
  if (refreshTok) {
    const refreshed = await refreshToken(cfg, refreshTok);
    if (!refreshed.ok) {
      throw new Error(`refresh failed: ${refreshed.status} ${JSON.stringify(refreshed.data)}`);
    }
    refreshClaims = extractClaimsSummary(decodeJwtPayload(refreshed.data?.access_token));
    if (refreshClaims?.app_metadata?.talk_user_id !== T1.talkUserId) {
      throw new Error(`refresh JWT talk_user_id mismatch: ${JSON.stringify(refreshClaims)}`);
    }
    if (refreshClaims?.app_metadata?.member_id !== T1.memberId) {
      throw new Error(`refresh JWT member_id mismatch: ${JSON.stringify(refreshClaims)}`);
    }
    assertProviderPreserved(refreshClaims.app_metadata);
  }

  return { loginClaims, refreshClaims };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = process.argv.includes("--verify-only");
  const cfg = loadConfig();

  console.log(`L3 T1 backfill · ref=ddojquacsyqesrjhcvmn · dryRun=${dryRun} verifyOnly=${verifyOnly}`);

  if (!verifyOnly) {
    const patch = {
      talk_user_id: T1.talkUserId,
      member_id: T1.memberId,
    };
    const { before, after } = await mergeAppMetadata(cfg, T1.id, patch, dryRun);
    const beforeApp = before.app_metadata || before.raw_app_meta_data || {};
    const afterApp = after.app_metadata || after.raw_app_meta_data || {};

    console.log("before app_metadata:", JSON.stringify(beforeApp));
    console.log("after  app_metadata:", JSON.stringify(afterApp));

    if (!dryRun) {
      assertProviderPreserved(afterApp);
      if (afterApp.talk_user_id !== T1.talkUserId || afterApp.member_id !== T1.memberId) {
        throw new Error("backfill values not applied");
      }
      const userMeta = after.user_metadata || after.raw_user_meta_data || {};
      if (userMeta.talk_user_id || userMeta.member_id) {
        throw new Error("user_metadata must not gain talk/member keys");
      }
    }
  }

  if (dryRun) {
    console.log("dry-run complete");
    return;
  }

  const jwt = await verifyJwtFlow(cfg);
  console.log("JWT login claims summary:", JSON.stringify(jwt.loginClaims));
  console.log("JWT refresh claims summary:", JSON.stringify(jwt.refreshClaims));
  console.log("L3 T1 backfill + JWT verify OK");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
