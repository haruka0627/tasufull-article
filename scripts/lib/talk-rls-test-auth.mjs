/**
 * TASFUL TALK — RLS 検証 / ブラウザテスト用 JWT ユーザー
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TALK_TEST_USERS = {
  u_me: {
    email: "talk-rls-a@tasful-dev.test",
    password: "TalkRlsA1!",
    talkUserId: "u_me",
  },
  u_store: {
    email: "talk-rls-b@tasful-dev.test",
    password: "TalkRlsB1!",
    talkUserId: "u_store",
  },
  u_worker: {
    email: "talk-rls-worker@tasful-dev.test",
    password: "TalkRlsW1!",
    talkUserId: "u_worker",
  },
  u_admin: {
    email: "talk-rls-admin@tasful-dev.test",
    password: "TalkRlsAdmin1!",
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

async function authFetch(cfg, { method, pathSuffix, body, useServiceRole = false }) {
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
  const appMetadata = { talk_user_id: spec.talkUserId, member_id: spec.talkUserId };
  const userMetadata = { talk_user_id: spec.talkUserId };
  if (spec.role) appMetadata.role = spec.role;

  let user = await findUserByEmail(cfg, spec.email);
  if (!user) {
    const created = await authFetch(cfg, {
      method: "POST",
      pathSuffix: "/admin/users",
      useServiceRole: true,
      body: {
        email: spec.email,
        password: spec.password,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      },
    });
    if (!created.ok) throw new Error(`create ${spec.email}: ${created.status}`);
    user = created.data?.user || created.data;
  } else {
    await authFetch(cfg, {
      method: "PUT",
      pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
      useServiceRole: true,
      body: { app_metadata: appMetadata, user_metadata: userMetadata, password: spec.password },
    });
  }

  const login = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: spec.email, password: spec.password },
  });
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`signIn ${spec.email}: ${login.status}`);
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
