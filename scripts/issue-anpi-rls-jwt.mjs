#!/usr/bin/env node
/**
 * 安否 RLS 検証用 — Supabase Auth JWT 発行（P9-5 / P10）
 *
 *   node scripts/issue-anpi-rls-jwt.mjs
 *   node scripts/issue-anpi-rls-jwt.mjs --write-env
 *
 * 必須:
 *   SUPABASE_SERVICE_ROLE_KEY  （Dashboard → API → service_role）
 *
 * 任意（未設定時は chat-supabase-config.js から URL/anon を読む）:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *
 * テストユーザー（未設定時は docs/anpi-rls-jwt-setup.md の既定値）:
 *   ANPI_RLS_USER_A_EMAIL / _PASSWORD / _MEMBER_ID
 *   ANPI_RLS_USER_B_EMAIL / _PASSWORD / _MEMBER_ID
 *   ANPI_RLS_ADMIN_EMAIL / _PASSWORD / _MEMBER_ID
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  userA: {
    email: "anpi-rls-a@tasful-dev.test",
    password: "AnpiRlsTestA1!",
    memberId: "anpi_rls_member_a",
  },
  userB: {
    email: "anpi-rls-b@tasful-dev.test",
    password: "AnpiRlsTestB1!",
    memberId: "anpi_rls_member_b",
  },
  admin: {
    email: "anpi-rls-admin@tasful-dev.test",
    password: "AnpiRlsAdmin1!",
    memberId: "anpi_rls_admin",
    role: "tasu_admin",
  },
};

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function loadSupabaseFromConfig() {
  const cfgPath = path.join(ROOT, "chat-supabase-config.js");
  if (!existsSync(cfgPath)) return {};
  const text = readFileSync(cfgPath, "utf8");
  const out = {};
  const urlMatch = text.match(/url:\s*"(https:[^"]+)"/);
  const keyMatch = text.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/);
  if (urlMatch?.[1]) out.url = urlMatch[1].replace(/\/$/, "");
  if (keyMatch?.[1]) out.anonKey = keyMatch[1];
  return out;
}

function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt || "").split(".")[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function memberIdFromJwt(jwt) {
  const p = decodeJwtPayload(jwt);
  return String(
    p.member_id ||
      p.app_metadata?.member_id ||
      p.user_metadata?.member_id ||
      p.sub ||
      ""
  ).trim();
}

function adminRoleFromJwt(jwt) {
  const p = decodeJwtPayload(jwt);
  if (p.role === "tasu_admin") return "tasu_admin";
  return String(p.app_metadata?.role || p.user_metadata?.role || "").trim();
}

async function authFetch(cfg, { method, pathSuffix, body, useServiceRole = false }) {
  const key = useServiceRole ? cfg.serviceRoleKey : cfg.anonKey;
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
    pathSuffix: `/admin/users?per_page=200`,
    useServiceRole: true,
  });
  if (!res.ok) {
    throw new Error(`admin/users list failed: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }
  const users = res.data?.users || [];
  const needle = String(email || "").trim().toLowerCase();
  return users.find((u) => String(u.email || "").toLowerCase() === needle) || null;
}

async function createUser(cfg, { email, password, appMetadata, userMetadata }) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/admin/users",
    useServiceRole: true,
    body: {
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    },
  });
}

async function updateUser(cfg, userId, { appMetadata, userMetadata, password }) {
  const body = {
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  };
  if (password) body.password = password;
  return authFetch(cfg, {
    method: "PUT",
    pathSuffix: `/admin/users/${encodeURIComponent(userId)}`,
    useServiceRole: true,
    body,
  });
}

async function signIn(cfg, email, password) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password },
  });
}

async function ensureAuthUser(cfg, spec) {
  const email = String(spec.email || "").trim();
  const password = String(spec.password || "");
  const memberId = String(spec.memberId || "").trim();
  const adminRole = spec.role ? String(spec.role).trim() : "";

  const appMetadata = { member_id: memberId };
  const userMetadata = { member_id: memberId };
  if (adminRole) appMetadata.role = adminRole;

  let user = await findUserByEmail(cfg, email);

  if (!user) {
    const created = await createUser(cfg, {
      email,
      password,
      appMetadata,
      userMetadata,
    });
    if (!created.ok) {
      throw new Error(
        `create user ${email}: HTTP ${created.status} ${JSON.stringify(created.data)}`
      );
    }
    user = created.data?.user || created.data;
    console.log(`  created  ${email} (id=${user?.id || "?"})`);
  } else {
    const updated = await updateUser(cfg, user.id, {
      appMetadata,
      userMetadata,
      password,
    });
    if (!updated.ok) {
      throw new Error(
        `update user ${email}: HTTP ${updated.status} ${JSON.stringify(updated.data)}`
      );
    }
    console.log(`  updated  ${email} (member_id=${memberId}${adminRole ? `, role=${adminRole}` : ""})`);
  }

  const login = await signIn(cfg, email, password);
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`signIn ${email}: HTTP ${login.status} ${JSON.stringify(login.data)}`);
  }

  const token = login.data.access_token;
  const resolvedMember = memberIdFromJwt(token);
  if (resolvedMember !== memberId) {
    throw new Error(
      `JWT member_id mismatch for ${email}: expected ${memberId}, got ${resolvedMember || "?"}`
    );
  }
  if (adminRole) {
    const role = adminRoleFromJwt(token);
    if (role !== adminRole) {
      console.warn(
        `  warn: admin role in JWT is "${role || "?"}" (expected ${adminRole}). RLS admin テストが失敗する可能性があります。`
      );
    }
  }

  return token;
}

function mergeEnvFile(envPath, pairs) {
  const keys = new Set(pairs.map(([k]) => k));
  let lines = [];
  if (existsSync(envPath)) {
    lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  }
  const out = [];
  const written = new Set();
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      out.push(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 1) {
      out.push(line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (keys.has(key)) {
      const val = pairs.find(([k]) => k === key)?.[1] ?? "";
      out.push(`${key}=${val}`);
      written.add(key);
    } else {
      out.push(line);
    }
  }
  for (const [key, val] of pairs) {
    if (!written.has(key)) out.push(`${key}=${val}`);
  }
  writeFileSync(envPath, `${out.join("\n").replace(/\n*$/, "")}\n`, "utf8");
}

async function main() {
  const writeEnv = process.argv.includes("--write-env");
  loadDotEnv();
  const fromConfig = loadSupabaseFromConfig();

  const cfg = {
    url: String(process.env.SUPABASE_URL || fromConfig.url || "").trim().replace(/\/$/, ""),
    anonKey: String(process.env.SUPABASE_ANON_KEY || fromConfig.anonKey || "").trim(),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };

  if (!cfg.url || !cfg.anonKey) {
    console.error("SUPABASE_URL / SUPABASE_ANON_KEY が未設定です。");
    console.error("  .env または chat-supabase-config.js を設定してください。\n");
    process.exitCode = 2;
    return;
  }
  if (!cfg.serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY が未設定です。");
    console.error("  Dashboard → Settings → API → service_role を .env に設定してください。");
    console.error("  手順: docs/anpi-rls-jwt-setup.md\n");
    process.exitCode = 2;
    return;
  }

  const userA = {
    email: process.env.ANPI_RLS_USER_A_EMAIL || DEFAULTS.userA.email,
    password: process.env.ANPI_RLS_USER_A_PASSWORD || DEFAULTS.userA.password,
    memberId: process.env.ANPI_RLS_USER_A_MEMBER_ID || DEFAULTS.userA.memberId,
  };
  const userB = {
    email: process.env.ANPI_RLS_USER_B_EMAIL || DEFAULTS.userB.email,
    password: process.env.ANPI_RLS_USER_B_PASSWORD || DEFAULTS.userB.password,
    memberId: process.env.ANPI_RLS_USER_B_MEMBER_ID || DEFAULTS.userB.memberId,
  };
  const admin = {
    email: process.env.ANPI_RLS_ADMIN_EMAIL || DEFAULTS.admin.email,
    password: process.env.ANPI_RLS_ADMIN_PASSWORD || DEFAULTS.admin.password,
    memberId: process.env.ANPI_RLS_ADMIN_MEMBER_ID || DEFAULTS.admin.memberId,
    role: DEFAULTS.admin.role,
  };

  if (userA.memberId === userB.memberId) {
    console.error("User A / B の member_id は異なる必要があります。\n");
    process.exitCode = 1;
    return;
  }

  console.log("\n=== 安否 RLS 検証用 JWT 発行 ===\n");
  console.log(`  project: ${cfg.url}\n`);

  const jwtA = await ensureAuthUser(cfg, userA);
  const jwtB = await ensureAuthUser(cfg, userB);
  const jwtAdmin = await ensureAuthUser(cfg, admin);

  const envLines = [
    ["ANPI_RLS_USER_A_JWT", jwtA],
    ["ANPI_RLS_USER_B_JWT", jwtB],
    ["ANPI_RLS_ADMIN_JWT", jwtAdmin],
  ];

  console.log("\n--- .env に追加（access_token・有効期限あり）---\n");
  for (const [key, val] of envLines) {
    console.log(`${key}=${val}`);
  }
  console.log("\n--- 確認 ---\n");
  console.log(`  User A member_id: ${memberIdFromJwt(jwtA)}`);
  console.log(`  User B member_id: ${memberIdFromJwt(jwtB)}`);
  console.log(`  Admin member_id:  ${memberIdFromJwt(jwtAdmin)} role=${adminRoleFromJwt(jwtAdmin) || "?"}`);
  console.log("\n  node scripts/verify-anpi-rls-real-db.mjs\n");

  if (writeEnv) {
    const envPath = path.join(ROOT, ".env");
    const allPairs = [
      ["SUPABASE_URL", cfg.url],
      ["SUPABASE_ANON_KEY", cfg.anonKey],
      ...envLines,
    ];
    mergeEnvFile(envPath, allPairs);
    console.log(`  wrote ${envPath} (JWT 3 本 + URL/anon)\n`);
  } else {
    console.log("  .env へ自動書き込み: node scripts/issue-anpi-rls-jwt.mjs --write-env\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
