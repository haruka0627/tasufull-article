#!/usr/bin/env node
/**
 * NB-3 STEP 8B — Legacy chat/transaction RLS 検証
 *   node scripts/verify-auth-step8b-legacy-rls.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadTalkSupabaseConfig,
  ensureTalkJwt,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "auth-step8b-probe-results.json");

const LEGACY_TABLES = [
  "transaction_rooms",
  "transaction_messages",
  "chats",
  "reviews",
  "favorites",
];

const USER_A = TALK_TEST_USERS.u_me.talkUserId;
const USER_B = TALK_TEST_USERS.u_store.talkUserId;
const USER_W = TALK_TEST_USERS.u_worker.talkUserId;

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

async function rest(cfg, opts) {
  const {
    table,
    method = "GET",
    query = "",
    body,
    jwt,
    useService = false,
    prefer,
  } = opts;
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer:
        prefer ||
        (method === "GET" ? "count=exact" : method === "POST" ? "return=representation" : "return=minimal"),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 300) };
  }
  const range = res.headers.get("content-range") || "";
  const m = range.match(/\/(\d+|\*)/);
  return { ok: res.ok, status: res.status, data, count: m ? m[1] : null, rows: Array.isArray(data) ? data.length : 0 };
}

function denied(res) {
  if (res.status === 401 || res.status === 403) return true;
  const msg = String(res.data?.message || "").toLowerCase();
  return msg.includes("row-level security") || msg.includes("permission denied");
}

async function queryPermissivePolicies(cfg) {
  const res = await rest(cfg, {
    table: "pg_policies",
    query:
      "select=tablename,policyname,qual,with_check&schemaname=eq.public&or=(qual.eq.true,with_check.eq.true,policyname.ilike.*Allow%20all*)",
    useService: true,
  });
  if (!res.ok || !Array.isArray(res.data)) return { ok: false, rows: [] };
  const legacy = res.data.filter((p) =>
    LEGACY_TABLES.includes(p.tablename) ||
    ["transaction_reads", "review_scores", "ai_messages"].includes(p.tablename)
  );
  return { ok: true, rows: res.data, legacy };
}

async function main() {
  loadDotEnv();
  const cfg = loadTalkSupabaseConfig();
  const report = {
    at: new Date().toISOString(),
    project: cfg.url,
    anonProbes: [],
    abProbes: [],
    opsProbes: [],
    permissivePolicies: null,
    errors: [],
    passes: [],
  };

  console.log("\n=== STEP 8B Legacy RLS probe ===\n");

  if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) {
    console.error("Missing Supabase config");
    process.exit(1);
  }

  const permissive = await queryPermissivePolicies(cfg);
  report.permissivePolicies = permissive;
  const legacyPermissive = permissive.legacy || [];
  if (legacyPermissive.length === 0) {
    report.passes.push("no using(true)/Allow all on legacy tables");
    console.log("  OK  legacy using(true)/Allow all: 0");
  } else {
    for (const p of legacyPermissive) {
      report.errors.push(`permissive policy ${p.tablename}.${p.policyname}`);
      console.log(`  NG  permissive ${p.tablename}.${p.policyname}`);
    }
  }

  for (const table of LEGACY_TABLES) {
    const r = await rest(cfg, { table, query: "select=id&limit=5" });
    const pass = r.rows === 0 && (denied(r) || r.status === 200);
    const strictPass = r.rows === 0;
    report.anonProbes.push({ table, status: r.status, rows: r.rows, pass: strictPass });
    if (strictPass) {
      console.log(`  OK  anon READ ${table}: 0 rows`);
      report.passes.push(`anon READ ${table} 0`);
    } else {
      console.log(`  NG  anon READ ${table}: ${r.rows} rows (status ${r.status})`);
      report.errors.push(`anon READ ${table}: ${r.rows}`);
    }
  }

  let jwtA = "";
  let jwtB = "";
  let jwtAdmin = "";
  try {
    jwtA = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
    jwtB = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
    jwtAdmin = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
  } catch (err) {
    report.errors.push(`JWT: ${err.message}`);
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const marker = `step8b-${Date.now()}`;
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const roomBody = {
    listing_id: marker,
    listing_type: "business",
    buyer_id: USER_A,
    seller_id: USER_W,
    expires_at: expires,
    status: "active",
  };
  const roomRes = await rest(cfg, {
    table: "transaction_rooms",
    method: "POST",
    body: roomBody,
    useService: true,
  });
  const roomId = roomRes.data?.[0]?.id || roomRes.data?.id;
  if (!roomId) {
    report.errors.push(`seed room failed: ${roomRes.status}`);
    console.log(`  NG  seed transaction_room: ${roomRes.status}`);
  } else {
    report.passes.push("seed transaction_room");
    const aRoom = await rest(cfg, { table: "transaction_rooms", query: `select=id&id=eq.${roomId}`, jwt: jwtA });
    const bRoom = await rest(cfg, { table: "transaction_rooms", query: `select=id&id=eq.${roomId}`, jwt: jwtB });
    const abRoom = {
      test: "transaction_rooms A reads own / B stranger denied",
      aRows: aRoom.rows,
      bRows: bRoom.rows,
      pass: aRoom.rows >= 1 && bRoom.rows === 0,
    };
    report.abProbes.push(abRoom);
    console.log(abRoom.pass ? "  OK  transaction_rooms A/B" : `  NG  transaction_rooms A/B (a=${aRoom.rows} b=${bRoom.rows})`);
    if (!abRoom.pass) report.errors.push("transaction_rooms A/B isolation");

    const msgBody = { room_id: roomId, sender_id: USER_A, message: marker };
    await rest(cfg, { table: "transaction_messages", method: "POST", body: msgBody, jwt: jwtA, useService: false });
    const bMsg = await rest(cfg, {
      table: "transaction_messages",
      query: `select=id&room_id=eq.${roomId}`,
      jwt: jwtB,
    });
    const abMsg = { test: "transaction_messages B cannot read A room", bRows: bMsg.rows, pass: bMsg.rows === 0 };
    report.abProbes.push(abMsg);
    console.log(abMsg.pass ? "  OK  transaction_messages A/B" : `  NG  transaction_messages B read ${bMsg.rows}`);
    if (!abMsg.pass) report.errors.push("transaction_messages B reads A room");

    const favId = `${marker}-fav`;
    await rest(cfg, {
      table: "favorites",
      method: "POST",
      body: { user_id: USER_A, target_type: "skill", target_id: favId },
      jwt: jwtA,
    });
    const bFav = await rest(cfg, {
      table: "favorites",
      query: `select=id&user_id=eq.${encodeURIComponent(USER_A)}&target_id=eq.${encodeURIComponent(favId)}`,
      jwt: jwtB,
    });
    const abFav = { test: "favorites B cannot read A", bRows: bFav.rows, pass: bFav.rows === 0 };
    report.abProbes.push(abFav);
    console.log(abFav.pass ? "  OK  favorites A/B" : `  NG  favorites B read ${bFav.rows}`);
    if (!abFav.pass) report.errors.push("favorites B reads A");

    const bInsFav = await rest(cfg, {
      table: "favorites",
      method: "POST",
      body: { user_id: USER_A, target_type: "skill", target_id: `${marker}-evil` },
      jwt: jwtB,
    });
    const abFavIns = { test: "favorites B cannot insert as A", pass: denied(bInsFav) || !bInsFav.ok };
    report.abProbes.push(abFavIns);
    console.log(abFavIns.pass ? "  OK  favorites B insert blocked" : `  NG  favorites B insert ${bInsFav.status}`);
    if (!abFavIns.pass) report.errors.push("favorites B insert as A");

    await rest(cfg, { table: "transaction_rooms", method: "DELETE", query: `id=eq.${roomId}`, useService: true });
    await rest(cfg, {
      table: "favorites",
      method: "DELETE",
      query: `user_id=eq.${encodeURIComponent(USER_A)}&target_id=eq.${encodeURIComponent(favId)}`,
      useService: true,
    });
  }

  const memOps = await rest(cfg, { table: "support_tickets", query: "select=id&limit=1", jwt: jwtA });
  const adminOps = await rest(cfg, { table: "support_tickets", query: "select=id&limit=1", jwt: jwtAdmin });
  report.opsProbes.push({
    memberSupportRows: memOps.rows,
    adminSupportRows: adminOps.rows,
    pass: memOps.rows === 0 && adminOps.rows >= 0,
  });
  console.log(
    memOps.rows === 0 ? "  OK  ops: member denied support_tickets" : `  NG  member ops leak ${memOps.rows}`
  );
  console.log(`  info ops: admin support_tickets rows=${adminOps.rows}`);

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n  wrote ${OUT}`);
  const verdict = report.errors.length ? "FAIL" : "PASS";
  console.log(`\n=== ${verdict} (${report.errors.length} errors) ===\n`);
  process.exit(report.errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
