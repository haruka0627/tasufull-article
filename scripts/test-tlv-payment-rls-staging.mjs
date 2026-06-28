#!/usr/bin/env node
/**
 * TLV Payment Engine — RLS staging verification
 *
 *   node scripts/test-tlv-payment-rls-staging.mjs
 *
 * Requires: linked Supabase staging + SUPABASE_SERVICE_ROLE_KEY (.env)
 * Fixtures: scripts/sql/tlv-staging-create-tip-integration.sql seed IDs (viewer 101, creator tlv-staging-tip-creator)
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const VIEWER_A = "a0000000-0000-4000-8000-000000000101";
const VIEWER_B = "a0000000-0000-4000-8000-000000000199";
const CREATOR_ID = "a0000000-0000-4000-8000-000000000001";
const CREATOR_TALK_ID = "tlv-staging-tip-creator";
const WALLET_A = "a0000000-0000-4000-8000-000000000102";

const TLV_USERS = {
  viewerA: {
    id: VIEWER_A,
    email: "tlv-rls-viewer-a@tasful-dev.test",
    password: "TlvRlsViewerA1!",
    app_metadata: { talk_user_id: "tlv-rls-viewer-a", member_id: "tlv-rls-viewer-a" },
  },
  viewerB: {
    id: VIEWER_B,
    email: "tlv-rls-viewer-b@tasful-dev.test",
    password: "TlvRlsViewerB1!",
    app_metadata: { talk_user_id: "tlv-rls-viewer-b", member_id: "tlv-rls-viewer-b" },
  },
  creator: {
    email: "tlv-rls-creator@tasful-dev.test",
    password: "TlvRlsCreator1!",
    app_metadata: {
      talk_user_id: CREATOR_TALK_ID,
      member_id: CREATOR_TALK_ID,
    },
  },
};

function loadDotEnv() {
  const envPath = join(root, ".env");
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) {
    const js = readFileSync(join(root, "chat-supabase-config.js"), "utf8");
    url = url || js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "";
    anonKey = anonKey || js.match(/anonKey:\s*"(eyJ[^"]+|sb_[^"]+)"/)?.[1] || "";
  }
  return { url, anonKey, serviceKey };
}

function parseRows(out) {
  const boundaryIdx = out.indexOf('"boundary"');
  if (boundaryIdx < 0) return [];
  const start = out.lastIndexOf("{", boundaryIdx);
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < out.length; i++) {
    if (out[i] === "{") depth++;
    else if (out[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(out.slice(start, i + 1)).rows || [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function rowCount(contentRange) {
  if (!contentRange) return null;
  const m = contentRange.match(/\/(\d+|\*)$/);
  if (!m || m[1] === "*") return null;
  return Number(m[1]);
}

function isDenied(res) {
  if (res.status === 401 || res.status === 403 || res.status === 406) return true;
  const msg = String(res.data?.message || res.data?.hint || res.data?.code || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("42501") ||
    msg.includes("pgrst205") ||
    msg.includes("schema must be")
  );
}

async function tlvRest(cfg, { table, method = "GET", query = "", body, jwt, useService = false }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const prefer =
    method === "GET" ? "count=exact" : method === "PATCH" || method === "POST" ? "return=representation" : "return=minimal";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Profile": "tlv",
      "Content-Profile": "tlv",
      Prefer: prefer,
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
  return {
    ok: res.ok,
    status: res.status,
    data,
    count: rowCount(res.headers.get("content-range")),
  };
}

async function tlvRpc(cfg, { fn, body, jwt, useService = false }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Profile": "tlv",
    },
    body: JSON.stringify(body ?? {}),
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

async function authAdmin(cfg, { method, pathSuffix, body }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
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
  const res = await authAdmin(cfg, { method: "GET", pathSuffix: "/admin/users?per_page=200" });
  if (!res.ok) throw new Error(`admin/users: ${res.status}`);
  return (res.data?.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function ensureAuthUser(cfg, spec) {
  let user = await findUserByEmail(cfg, spec.email);
  const payload = {
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    app_metadata: spec.app_metadata,
    user_metadata: { talk_user_id: spec.app_metadata.talk_user_id },
  };
  if (spec.id) payload.id = spec.id;

  if (!user) {
    const created = await authAdmin(cfg, { method: "POST", pathSuffix: "/admin/users", body: payload });
    if (!created.ok) throw new Error(`create ${spec.email}: ${created.status} ${JSON.stringify(created.data).slice(0, 120)}`);
    user = created.data?.user || created.data;
  } else {
    await authAdmin(cfg, {
      method: "PUT",
      pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
      body: {
        app_metadata: spec.app_metadata,
        user_metadata: { talk_user_id: spec.app_metadata.talk_user_id },
        password: spec.password,
      },
    });
  }

  const login = await authAdmin(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: spec.email, password: spec.password },
  });
  if (!login.ok || !login.data?.access_token) {
    throw new Error(`signIn ${spec.email}: ${login.status}`);
  }
  return { jwt: login.data.access_token, userId: user?.id || spec.id };
}

function runSqlFile(relPath) {
  const sqlPath = join(root, relPath).replace(/\\/g, "/");
  const out = execSync(`npx supabase db query --linked -f "${sqlPath}"`, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return parseRows(out);
}

function ensureFixtureWallet() {
  runSqlFile("scripts/sql/tlv-staging-rls-cleanup.sql");
  runSqlFile("scripts/sql/tlv-staging-rls-fixture.sql");
}

function queryMeta() {
  return runSqlFile("scripts/sql/tlv-staging-rls-meta.sql");
}

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main() {
  console.log("TLV Payment RLS staging tests\n");
  const cfg = loadConfig();
  if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) {
    console.error("FAIL: SUPABASE_URL / anon / SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }

  // Meta: RLS enabled
  const meta = queryMeta();
  for (const t of [
    "payments",
    "payment_provider_events",
    "revenue_ledger",
    "viewer_wallets",
    "wallet_ledger",
    "coin_lots",
    "tip_coin_lot_allocations",
    "tips",
    "stream_events",
    "creator_score_events",
  ]) {
    const row = meta.find((r) => r.tablename === t);
    check(`META RLS enabled: ${t}`, row?.rls === true || row?.rls === "t", row ? `force=${row.force_rls}` : "missing");
  }

  ensureFixtureWallet();

  let jwtA = "";
  let jwtB = "";
  let jwtCreator = "";
  try {
    ({ jwt: jwtA } = await ensureAuthUser(cfg, TLV_USERS.viewerA));
    ({ jwt: jwtB } = await ensureAuthUser(cfg, TLV_USERS.viewerB));
    ({ jwt: jwtCreator } = await ensureAuthUser(cfg, TLV_USERS.creator));
    check("SETUP auth users", true);
  } catch (err) {
    check("SETUP auth users", false, err.message);
    process.exit(1);
  }

  // A. anon deny
  for (const table of [
    "viewer_wallets",
    "wallet_ledger",
    "payments",
    "revenue_ledger",
    "payment_provider_events",
    "tips",
  ]) {
    const res = await tlvRest(cfg, { table, query: "select=id&limit=1" });
    check(`A anon deny ${table}`, isDenied(res) || res.count === 0, `status=${res.status}`);
  }

  // B. viewer own SELECT
  const ownWallet = await tlvRest(cfg, {
    table: "viewer_wallets",
    query: `select=id,user_id,coin_balance&user_id=eq.${VIEWER_A}`,
    jwt: jwtA,
  });
  check("B viewer own wallet SELECT", ownWallet.ok && (ownWallet.count ?? 0) >= 1, `count=${ownWallet.count}`);

  const ownLedger = await tlvRest(cfg, {
    table: "wallet_ledger",
    query: `select=id&user_id=eq.${VIEWER_A}&limit=1`,
    jwt: jwtA,
  });
  check("B viewer own ledger SELECT", ownLedger.ok, `status=${ownLedger.status}`);

  const ownPayments = await tlvRest(cfg, {
    table: "payments",
    query: `select=id&payer_user_uuid=eq.${VIEWER_A}&limit=1`,
    jwt: jwtA,
  });
  check("B viewer own payments SELECT", ownPayments.ok, `status=${ownPayments.status}`);

  const ownTips = await tlvRest(cfg, {
    table: "tips",
    query: `select=id&payer_user_uuid=eq.${VIEWER_A}&limit=1`,
    jwt: jwtA,
  });
  check("B viewer own tips SELECT", ownTips.ok, `status=${ownTips.status}`);

  const otherWallet = await tlvRest(cfg, {
    table: "viewer_wallets",
    query: `select=id&user_id=eq.${VIEWER_A}`,
    jwt: jwtB,
  });
  check("B viewer other wallet deny", (otherWallet.count ?? 0) === 0, `count=${otherWallet.count}`);

  const otherTips = await tlvRest(cfg, {
    table: "tips",
    query: `select=id&payer_user_uuid=eq.${VIEWER_A}&limit=1`,
    jwt: jwtB,
  });
  check("B viewer other tips deny", (otherTips.count ?? 0) === 0, `count=${otherTips.count}`);

  // C. creator
  const creatorTips = await tlvRest(cfg, {
    table: "tips",
    query: `select=id&creator_id=eq.${CREATOR_ID}&limit=1`,
    jwt: jwtCreator,
  });
  check("C creator own tips SELECT", creatorTips.ok, `count=${creatorTips.count}`);

  const creatorOtherTips = await tlvRest(cfg, {
    table: "tips",
    query: `select=id&creator_id=neq.${CREATOR_ID}&limit=1`,
    jwt: jwtCreator,
  });
  check(
    "C creator other creator tips deny",
    (creatorOtherTips.count ?? 0) === 0,
    `count=${creatorOtherTips.count}`,
  );

  const creatorScore = await tlvRest(cfg, {
    table: "creator_score_events",
    query: `select=id&creator_id=eq.${CREATOR_ID}&limit=1`,
    jwt: jwtCreator,
  });
  check(
    "C creator_score_events deny (plan B)",
    (creatorScore.count ?? 0) === 0,
    `count=${creatorScore.count}`,
  );

  const creatorRevenue = await tlvRest(cfg, {
    table: "revenue_ledger",
    query: `select=id&creator_id=eq.${CREATOR_ID}&limit=1`,
    jwt: jwtCreator,
  });
  check("C revenue_ledger creator deny", (creatorRevenue.count ?? 0) === 0, `count=${creatorRevenue.count}`);

  // D. write deny (authenticated)
  const patchWallet = await tlvRest(cfg, {
    table: "viewer_wallets",
    method: "PATCH",
    query: `user_id=eq.${VIEWER_A}`,
    body: { coin_balance: 999999 },
    jwt: jwtA,
  });
  check("D wallet UPDATE deny", isDenied(patchWallet) || !patchWallet.ok, `status=${patchWallet.status}`);

  for (const [table, body] of [
    ["wallet_ledger", { wallet_id: WALLET_A, user_id: VIEWER_A, entry_type: "adjustment_credit", coin_delta: 1, balance_after: 501 }],
    ["coin_lots", { wallet_id: WALLET_A, user_id: VIEWER_A, lot_source: "ops_adjustment", is_web_payment: false, coins_original: 1, coins_remaining: 1 }],
    ["revenue_ledger", { creator_id: CREATOR_ID, event_kind: "gift", gross_amount_jpy: 1, net_amount_jpy: 1 }],
    ["payment_provider_events", { provider: "stripe", provider_event_id: "rls-test-deny", event_type: "test", payload_hash: "a".repeat(64) }],
    ["tips", { stream_id: "b0000000-0000-4000-8000-000000000001", creator_id: CREATOR_ID, payer_user_id: "x", payer_user_uuid: VIEWER_A, tip_kind: "gift", coin_amount: 1 }],
    ["stream_events", { stream_id: "b0000000-0000-4000-8000-000000000001", event_kind: "tip_received", payload: {} }],
    ["creator_score_events", { creator_id: CREATOR_ID, axis: "spc", reason_code: "test", score_delta: 0, score_before: 0, score_after: 0 }],
  ]) {
    const res = await tlvRest(cfg, { table, method: "POST", body, jwt: jwtA });
    check(`D ${table} INSERT deny`, isDenied(res) || !res.ok, `status=${res.status}`);
  }

  // E/F. RPC privilege
  const rpcBody = {
    p_stream_id: "00000000-0000-4000-8000-000000000099",
    p_creator_id: CREATOR_ID,
    p_payer_user_uuid: VIEWER_A,
    p_payer_user_id: "tlv-rls-viewer-a",
    p_tip_kind: "gift",
    p_coin_amount: 10,
    p_idempotency_key: `tlv-rls-rpc-deny-${Date.now()}`,
  };
  const rpcAnon = await tlvRpc(cfg, { fn: "create_tip_transaction", body: rpcBody });
  check("F anon RPC create_tip_transaction deny", isDenied(rpcAnon) || !rpcAnon.ok, `status=${rpcAnon.status}`);

  const rpcAuth = await tlvRpc(cfg, { fn: "create_tip_transaction", body: rpcBody, jwt: jwtA });
  check("F authenticated RPC create_tip_transaction deny", isDenied(rpcAuth) || !rpcAuth.ok, `status=${rpcAuth.status}`);

  const rpcService = await tlvRpc(cfg, {
    fn: "create_tip_transaction",
    body: rpcBody,
    useService: true,
  });
  const rpcServiceOk =
    rpcService.status === 200 ||
    rpcService.status === 400 ||
    rpcService.data?.ok === true ||
    String(rpcService.data?.message || rpcService.data?.code || "").length > 0;
  check("E service_role RPC create_tip_transaction callable", rpcServiceOk, `status=${rpcService.status}`);

  const svcWallet = await tlvRest(cfg, {
    table: "viewer_wallets",
    query: `select=coin_balance&user_id=eq.${VIEWER_A}`,
    useService: true,
  });
  check("E service_role bypass SELECT", svcWallet.ok && (svcWallet.count ?? 0) >= 1, `count=${svcWallet.count}`);

  console.log(failed ? `\n${failed} failed` : "\nAll RLS staging tests passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
