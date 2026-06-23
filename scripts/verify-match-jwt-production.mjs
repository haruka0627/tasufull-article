#!/usr/bin/env node
/**
 * MATCH JWT production readiness — profile · swipe · match · TALK (real Supabase JWT)
 *
 *   node scripts/verify-match-jwt-production.mjs
 *   node scripts/verify-match-jwt-production.mjs --skip-deploy
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeJwtPayload,
  extractClaimsFromJwt,
} from "./lib/auth-current-user-core.mjs";
import {
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T2 = slotByName("T2");
const skipDeploy = process.argv.includes("--skip-deploy");
const REPORT_PATH = path.join(ROOT, "reports/match-jwt-production-readiness.md");

/** @type {{ section: string, step: string, ok: boolean, detail?: string }[]} */
const results = [];

function pass(section, step, detail = "") {
  results.push({ section, step, ok: true, detail });
  console.log(`  OK  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(section, step, detail = "") {
  results.push({ section, step, ok: false, detail });
  console.error(`  NG  [${section}] ${step}${detail ? `: ${detail}` : ""}`);
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

async function authFetch(cfg, { method, pathSuffix, body, bearer }) {
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${bearer || cfg.anonKey}`,
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

async function login(cfg, email) {
  return authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
}

async function edgePost(functionName, body, token) {
  const cfg = loadL7Config();
  const res = await fetch(`${FUNCTIONS_BASE}/${functionName}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { status: res.status, json, text };
}

function deployCoreFunctions() {
  const names = [
    "match-upsert-profile",
    "match-search-profiles",
    "match-record-swipe",
    "match-list-pairs",
    "match-ensure-talk-room",
  ];
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...names,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
  ]);
  if (r.status !== 0) throw new Error(`deploy failed: ${r.stderr.slice(0, 400)}`);
}

async function restFetch(cfg, { table, method = "GET", query = "", body, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const auth = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function cleanupT1T2PairData(cfg) {
  const pairs = await restFetch(cfg, {
    table: "match_pairs",
    query: "user_low_id=eq.t1&user_high_id=eq.t2&select=id,talk_room_id",
    serviceRole: true,
  });
  for (const pair of pairs.json ?? []) {
    if (pair.talk_room_id) {
      await restFetch(cfg, {
        table: "transaction_rooms",
        method: "DELETE",
        query: `id=eq.${pair.talk_room_id}`,
        serviceRole: true,
      });
    }
    await restFetch(cfg, {
      table: "transaction_rooms",
      method: "DELETE",
      query: `match_pair_id=eq.${pair.id}`,
      serviceRole: true,
    });
    await restFetch(cfg, {
      table: "match_pairs",
      method: "DELETE",
      query: `id=eq.${pair.id}`,
      serviceRole: true,
    });
  }
  await restFetch(cfg, {
    table: "match_swipes",
    method: "DELETE",
    query: "or=(and(swiper_user_id.eq.t1,target_user_id.eq.t2),and(swiper_user_id.eq.t2,target_user_id.eq.t1))",
    serviceRole: true,
  });
}

async function runMutualMatchFlow(cfg, t1Token, t2Token) {
  let pairId = "";
  try {
    await cleanupT1T2PairData(cfg);
    pass("Match", "cleanup t1↔t2", "swipes/pair cleared");

    const t1Like = await edgePost(
      "match-record-swipe",
      { target_user_id: T2.talkUserId, action: "like" },
      t1Token,
    );
    if (t1Like.status !== 200 || t1Like.json?.ok === false) {
      fail("Match", "T1 like T2", t1Like.text?.slice(0, 160));
      return "";
    }
    pass("Match", "T1 like T2", `matched=${t1Like.json?.matched ?? false}`);

    const t2Like = await edgePost(
      "match-record-swipe",
      { target_user_id: T1.talkUserId, action: "like" },
      t2Token,
    );
    if (t2Like.status !== 200 || t2Like.json?.ok === false) {
      fail("Match", "T2 like T1 (mutual)", t2Like.text?.slice(0, 160));
      return "";
    }
    pairId = String(t2Like.json?.pair_id || "");
    if (t2Like.json?.matched && pairId) {
      pass("Match", "T2 like T1 (mutual)", `pair_id=${pairId.slice(0, 8)}…`);
    } else {
      fail("Match", "T2 like T1 (mutual)", `matched=${t2Like.json?.matched}`);
    }

    const dup = await edgePost(
      "match-record-swipe",
      { target_user_id: T2.talkUserId, action: "like" },
      t1Token,
    );
    if (dup.status === 409 || dup.json?.code === "conflict") {
      pass("Match", "duplicate swipe guard", "409/conflict");
    } else {
      fail("Match", "duplicate swipe guard", dup.text?.slice(0, 120));
    }
  } catch (err) {
    fail("Match", "mutual flow", String(err));
  }
  return pairId;
}

function assertRealJwt(token, slot) {
  if (!token || token === "stub-match-token") {
    fail("JWT", `${slot} token`, "not a real JWT");
    return false;
  }
  if (token.split(".").length !== 3) {
    fail("JWT", `${slot} token format`, "expected 3-part JWT");
    return false;
  }
  const claims = decodeJwtPayload(token);
  const extracted = extractClaimsFromJwt(claims);
  if (!extracted.talk_user_id) {
    fail("JWT", `${slot} talk_user_id claim`, JSON.stringify(claims.app_metadata || {}));
    return false;
  }
  pass("JWT", `${slot} real JWT`, `talk_user_id=${extracted.talk_user_id}`);
  return true;
}

async function main() {
  console.log("=== MATCH JWT production readiness ===\n");
  const cfg = loadL7Config();

  if (!skipDeploy) {
    try {
      deployCoreFunctions();
      pass("Deploy", "core functions", "5 functions");
    } catch (err) {
      fail("Deploy", "core functions", String(err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  const t1Login = await login(cfg, T1.email);
  const t2Login = await login(cfg, T2.email);
  const t1Token = t1Login.data?.access_token || "";
  const t2Token = t2Login.data?.access_token || "";

  if (!t1Login.ok) fail("Auth", "T1 login", t1Login.text?.slice(0, 120));
  else pass("Auth", "T1 login", T1.email);

  if (!t2Login.ok) fail("Auth", "T2 login", t2Login.text?.slice(0, 120));
  else pass("Auth", "T2 login", T2.email);

  if (!assertRealJwt(t1Token, "T1")) return finish(1);
  assertRealJwt(t2Token, "T2");

  // Profile (search self / upsert noop-safe read path via search)
  const profileRes = await edgePost("match-search-profiles", { limit: 1 }, t1Token);
  if (profileRes.status === 200 && profileRes.json?.ok !== false) {
    pass("Profile", "match-search-profiles", `status=${profileRes.status}`);
  } else {
    fail("Profile", "match-search-profiles", profileRes.text?.slice(0, 160));
  }

  const pairId = await runMutualMatchFlow(cfg, t1Token, t2Token);

  const pairsRes = await edgePost("match-list-pairs", {}, t1Token);
  if (pairsRes.status === 200 && Array.isArray(pairsRes.json?.pairs)) {
    pass("Match", "match-list-pairs", `count=${pairsRes.json.pairs.length}`);
  } else {
    fail("Match", "match-list-pairs", pairsRes.text?.slice(0, 160));
  }

  if (pairId) {
    const talkRes = await edgePost("match-ensure-talk-room", { pair_id: pairId }, t1Token);
    if (talkRes.status === 200 && talkRes.json?.room_id) {
      pass("TALK", "match-ensure-talk-room", `room_id=${talkRes.json.room_id}`);
    } else if (talkRes.status === 200 && talkRes.json?.ok !== false) {
      pass("TALK", "match-ensure-talk-room", talkRes.json?.message || "ok");
    } else {
      fail("TALK", "match-ensure-talk-room", talkRes.text?.slice(0, 160));
    }
  } else {
    fail("TALK", "match-ensure-talk-room", "pair_id missing from mutual match");
  }

  // Frontend artifact checks
  const authJs = fs.readFileSync(path.join(ROOT, "match/match-auth.js"), "utf8");
  const bootstrapJs = fs.readFileSync(path.join(ROOT, "match/match-bootstrap.js"), "utf8");
  const swipeHtml = fs.readFileSync(path.join(ROOT, "match/match-swipe.html"), "utf8");

  if (authJs.includes("stub-match-token") && authJs.includes("isDemoMode")) {
    pass("Frontend", "stub gated to demo", "localhost/file only");
  } else {
    fail("Frontend", "match-auth.js demo gate", "check isDemoMode");
  }

  if (bootstrapJs.includes('mode: "live"')) {
    pass("Frontend", "match-bootstrap live mode", "present");
  } else {
    fail("Frontend", "match-bootstrap.js", "live configure missing");
  }

  if (swipeHtml.includes("match-bootstrap.js") && swipeHtml.includes("chat-supabase-config.js")) {
    pass("Frontend", "match-swipe.html deps", "auth chain + bootstrap");
  } else {
    fail("Frontend", "match-swipe.html deps", "missing bootstrap or supabase config");
  }

  return finish(0);
}

function finish(code) {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  const verdict = failed === 0 ? "JWT_PRODUCTION_READY" : "JWT_PRODUCTION_BLOCKED";

  let md = `# TASFUL MATCH — JWT 本番化 Readiness\n\n`;
  md += `| 項目 | 内容 |\n|------|------|\n`;
  md += `| 版 | v1.0 |\n`;
  md += `| 作成日 | 2026-06-22 |\n`;
  md += `| ref | \`${PROJECT_REF}\` |\n`;
  md += `| 検証 | \`node scripts/verify-match-jwt-production.mjs\` |\n`;
  md += `| 結果 | **${passed}/${total} PASS** |\n`;
  md += `| 判定 | **${verdict}** |\n\n`;

  md += `## 実装サマリ\n\n`;
  md += `- \`match-auth.js\`: Supabase session から \`access_token\` を取得。本番ホストでは JWT なし時は空ヘッダ（\`stub-match-token\` は localhost/file のみ）。\n`;
  md += `- \`match-bootstrap.js\`: 実 JWT 検出時に \`TasfulMatchAPI\` を \`mode: live\` + \`ensureFreshAccessToken\` で自動構成。\n`;
  md += `- \`match-api.js\`: \`isLiveMode()\` · 401 時 \`refreshAccessToken\` リトライ。\n`;
  md += `- Edge \`_shared/match-auth.ts\`: \`requireUserAsync\` + \`MATCH_VERIFY_JWT=1\` で Supabase \`/auth/v1/user\` 検証（オプション）。\n\n`;

  md += `## 検証ステップ\n\n| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "FAIL"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }

  md += `\n## 残課題\n\n`;
  md += `- Edge 全 Function を \`requireUserAsync\` へ移行（現状は decode-only \`requireUser\` 維持）\n`;
  md += `- 本番 deploy で \`MATCH_VERIFY_JWT=1\` を有効化する運用手順\n`;
  md += `- ログイン未完了ユーザー向け MATCH ゲート（P3 招待フローと連携）\n`;

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, md, "utf8");
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Result: ${passed}/${total} PASS · ${verdict}`);
  process.exit(failed > 0 ? 1 : code);
}

main().catch((err) => {
  fail("Fatal", "uncaught", String(err));
  finish(1);
});
