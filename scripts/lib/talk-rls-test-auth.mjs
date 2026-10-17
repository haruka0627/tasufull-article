/**
 * TASFUL TALK — RLS 検証 / ブラウザテスト用 JWT ユーザー
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertTestAuthTarget, assertAcceptablePassword, authAdminWriteGate } from "./test-auth-guard-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Test-account passwords are NEVER stored in the repository. Each account reads its password from an environment variable
 * (process env or the untracked .env) at the moment it is used, and fails closed when it is missing.
 * Accounts: TALK_RLS_USER_A_PASSWORD (u_me), TALK_RLS_USER_B_PASSWORD (u_store), TALK_RLS_USER_WORKER_PASSWORD (u_worker),
 * TALK_RLS_USER_ADMIN_PASSWORD (u_admin).
 */
function requirePassword(key) {
  loadDotEnv();
  const v = String(process.env[key] || "").trim();
  if (!v) throw new Error(`MISSING_${key}: set it in the environment or the untracked .env (credentials are not stored in the repository)`);
  return v;
}

export const TALK_TEST_USERS = {
  u_me: {
    email: "talk-rls-a@tasful-dev.test",
    passwordEnv: "TALK_RLS_USER_A_PASSWORD",
    get password() {
      return requirePassword("TALK_RLS_USER_A_PASSWORD");
    },
    talkUserId: "u_me",
  },
  u_store: {
    email: "talk-rls-b@tasful-dev.test",
    passwordEnv: "TALK_RLS_USER_B_PASSWORD",
    get password() {
      return requirePassword("TALK_RLS_USER_B_PASSWORD");
    },
    talkUserId: "u_store",
  },
  u_worker: {
    email: "talk-rls-worker@tasful-dev.test",
    passwordEnv: "TALK_RLS_USER_WORKER_PASSWORD",
    get password() {
      return requirePassword("TALK_RLS_USER_WORKER_PASSWORD");
    },
    talkUserId: "u_worker",
  },
  u_admin: {
    email: "talk-rls-admin@tasful-dev.test",
    passwordEnv: "TALK_RLS_USER_ADMIN_PASSWORD",
    get password() {
      return requirePassword("TALK_RLS_USER_ADMIN_PASSWORD");
    },
    talkUserId: "u_admin",
    role: "tasu_admin",
  },
};

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

export function loadTalkSupabaseConfig() {
  loadDotEnv();
  let url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  let anonKey = process.env.SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) {
    const js = readFileSync(path.join(ROOT, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  return { url, anonKey, serviceKey };
}

// The Staging-only target check and the scoped Auth-write gate live in one shared module (F-SP-14/F-SP-15).
export { assertTestAuthTarget };

async function authFetch(cfg, { method, pathSuffix, body, useServiceRole = false }) {
  assertTestAuthTarget(cfg.url);
  const key = useServiceRole ? cfg.serviceKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

async function findUserByEmail(cfg, email) {
  const res = await authFetch(cfg, {
    method: "GET",
    pathSuffix: "/admin/users?per_page=200",
    useServiceRole: true,
  });
  if (!res.ok) throw new Error(`admin/users: ${res.status}`);
  const users = res.data?.users || [];
  return users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

export async function ensureTalkJwt(cfg, spec) {
  assertTestAuthTarget(cfg.url);
  const password = spec.password; // env only; throws MISSING_<KEY> when absent
  assertAcceptablePassword(password); // never use (or set) a password value that was ever published
  const listIncludes = (v, x) => String(v || "").split(",").map((t) => t.trim().toLowerCase()).includes(String(x).toLowerCase());

  let user = await findUserByEmail(cfg, spec.email);
  if (!user) {
    // Creating a missing account is an Auth admin write: on Staging it needs the scoped permission (see test-auth-guard-v1.mjs). No role is ever assigned.
    authAdminWriteGate({ url: cfg.url, serviceKey: cfg.serviceKey, op: "create_user", email: spec.email, password });
    const created = await authFetch(cfg, {
      method: "POST",
      pathSuffix: "/admin/users",
      useServiceRole: true,
      body: {
        email: spec.email,
        password,
        email_confirm: true,
        app_metadata: { talk_user_id: spec.talkUserId, member_id: spec.talkUserId },
        user_metadata: { talk_user_id: spec.talkUserId },
      },
    });
    if (!created.ok) throw new Error(`create ${spec.email}: ${created.status}`);
    user = created.data?.user || created.data;
  } else if (
    String(process.env.TALK_ALLOW_AUTH_ADMIN_WRITE || "") === "1" &&
    listIncludes(process.env.TALK_AUTH_WRITE_OPS, "update_password") &&
    listIncludes(process.env.TALK_AUTH_WRITE_ACCOUNTS, spec.email)
  ) {
    // Explicit, scoped, time-boxed password update of ONE listed account; password only (no metadata, no role).
    authAdminWriteGate({ url: cfg.url, serviceKey: cfg.serviceKey, op: "update_password", email: spec.email, password });
    await authFetch(cfg, {
      method: "PUT",
      pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
      useServiceRole: true,
      body: { password },
    });
  }

  const login = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: spec.email, password },
  });
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`signIn ${spec.email}: ${login.status} (existing accounts are never reset implicitly: the env password must match the account; a deliberate password update needs the scoped TALK_AUTH_WRITE_* settings, see scripts/lib/test-auth-guard-v1.mjs)`);
  }
  return login.data.access_token;
}

/** @param {string[]} talkUserIds */
export async function ensureTalkTestUsers(talkUserIds = Object.keys(TALK_TEST_USERS)) {
  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for test users");
  }
  for (const id of talkUserIds) {
    const spec = TALK_TEST_USERS[id];
    if (!spec) continue;
    await ensureTalkJwt(cfg, spec);
  }
  return cfg;
}
