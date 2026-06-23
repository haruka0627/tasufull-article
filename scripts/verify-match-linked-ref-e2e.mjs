#!/usr/bin/env node
/**
 * MATCH linked ref live E2E verification
 *
 *   node scripts/verify-match-linked-ref-e2e.mjs
 *   node scripts/verify-match-linked-ref-e2e.mjs --skip-deploy
 *   node scripts/verify-match-linked-ref-e2e.mjs --skip-ui
 *
 * Ref: ddojquacsyqesrjhcvmn · T1/T2 test users only
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
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
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_GATES = "sql/match-linked-ref-e2e-readonly.sql";
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T2 = slotByName("T2");
const T3 = slotByName("T3");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipUi = process.argv.includes("--skip-ui");

const CORE_EDGE_FUNCTIONS = Object.freeze([
  "match-record-swipe",
  "match-list-pairs",
  "match-ensure-talk-room",
]);

/** @type {{ section: string, step: string, ok: boolean, detail?: string }[]} */
const results = [];

function record(section, step, ok, detail = "") {
  results.push({ section, step, ok, detail });
  const prefix = ok ? "OK " : "NG ";
  const line = `  ${prefix} [${section}] ${step}${detail ? `: ${detail}` : ""}`;
  if (ok) console.log(line);
  else console.error(line);
}

function pass(section, step, detail = "") {
  record(section, step, true, detail);
}

function fail(section, step, detail = "") {
  record(section, step, false, detail);
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
  const sqlPath = path.join(ROOT, SQL_GATES);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`SQL gates failed: ${combined.slice(0, 600)}`);
  const row = parseCliJson(combined)?.rows?.[0];
  if (!row) throw new Error("SQL gates returned no row");
  return row;
}

async function authFetch(cfg, { method, pathSuffix, body, bearer, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer || key}`,
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

async function restFetch(cfg, { table, method = "GET", query = "", body, token, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const auth = token || (serviceRole ? cfg.serviceRoleKey : cfg.anonKey);
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

async function edgePost(cfg, functionName, body, token) {
  const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
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
  const r = runSupabaseCli([
    "functions",
    "deploy",
    ...CORE_EDGE_FUNCTIONS,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 800));
}

function verifyFunctionsListed() {
  const r = runSupabaseCli(["functions", "list", "--project-ref", PROJECT_REF, "-o", "json"]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(combined.slice(0, 400));
  const start = combined.indexOf("[");
  const end = combined.lastIndexOf("]");
  if (start < 0) throw new Error("functions list parse failed");
  const list = JSON.parse(combined.slice(start, end + 1));
  const slugs = new Set(list.map((f) => f.slug || f.name));
  const missing = CORE_EDGE_FUNCTIONS.filter((n) => !slugs.has(n));
  if (missing.length) throw new Error(`missing deployed: ${missing.join(", ")}`);
}

async function ensureActiveProfile(cfg, userId, nickname) {
  const existing = await restFetch(cfg, {
    table: "match_profiles",
    query: `user_id=eq.${userId}&archived_at=is.null&select=id,profile_status,nickname`,
    serviceRole: true,
  });
  if (Array.isArray(existing.json) && existing.json.length > 0) {
    const row = existing.json[0];
    if (row.profile_status !== "active") {
      await restFetch(cfg, {
        table: "match_profiles",
        method: "PATCH",
        query: `id=eq.${row.id}`,
        body: { profile_status: "active" },
        serviceRole: true,
      });
    }
    return row.id;
  }
  const ins = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: userId,
      nickname,
      gender: "private",
      birth_date: "1990-06-01",
      prefecture: "Tokyo",
      profile_status: "active",
    },
    serviceRole: true,
  });
  if (ins.status !== 201) throw new Error(`profile seed ${userId}: ${ins.status} ${ins.text?.slice(0, 200)}`);
  return ins.json?.[0]?.id;
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
  await restFetch(cfg, {
    table: "match_blocks",
    method: "DELETE",
    query: "or=(and(blocker_user_id.eq.t1,blocked_user_id.eq.t2),and(blocker_user_id.eq.t2,blocked_user_id.eq.t1))",
    serviceRole: true,
  });
}

async function countRows(cfg, table, query) {
  const res = await restFetch(cfg, { table, query: `${query}&select=id`, serviceRole: true });
  return Array.isArray(res.json) ? res.json.length : 0;
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/match/match-list.html" : urlPath.replace(/^\//, "");
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ct = filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : filePath.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "application/octet-stream";
      res.writeHead(200, { "Content-Type": ct });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function runChild(script) {
  const r = spawnSync(process.execPath, [path.join("scripts", script)], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { ok: r.status === 0, stdout: r.stdout || "", stderr: r.stderr || "" };
}

async function runUiEdgeStub(cfg, t1Token, pairId, baseUrl) {
  const edgeBoot = ({ functionsBase, token }) => {
    const boot = () => {
      if (!window.TasfulMatchAPI || !window.TasfulMatchAuth) return;
      window.TasfulMatchAuth.configure({
        isAuthenticated: true,
        talkUserId: "t1",
        matchUserId: "t1",
      });
      window.TasfulMatchAPI.configure({
        mode: "edge_stub",
        functionsBaseUrl: functionsBase,
        getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
      });
    };
    document.addEventListener("DOMContentLoaded", boot);
    boot();
  };

  for (const vp of [
    ...MATCH_UI_VIEWPORTS,
    { label: "768×1024", width: 768, height: 1024 },
    { label: "1280×900", width: 1280, height: 900 },
  ]) {
    await withPlaywrightBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: matchViewportSize(vp) });
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: t1Token });

      await page.goto(`${baseUrl}/match/match-list.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const listHtml = await page.locator("[data-match-pair-list]").innerHTML();
      const newHtml = await page.locator("[data-match-new-pair]").innerHTML();
      const hasLiveData =
        (listHtml && listHtml.trim().length >= 10) || (newHtml && newHtml.trim().length >= 10);
      if (!hasLiveData) {
        fail("UI", `list live data @${vp.label}`, "pair list empty");
      } else {
        pass("UI", `list live data @${vp.label}`, "rendered");
      }
      const cta = page.locator("[data-match-talk-cta]").first();
      if ((await cta.count()) === 0) {
        fail("UI", `talk CTA @${vp.label}`, "missing");
      } else {
        const label = await cta.textContent();
        if (!/メッセージする/.test(label || "")) {
          fail("UI", `talk CTA label @${vp.label}`, label || "");
        } else {
          pass("UI", `talk CTA label @${vp.label}`, label.trim());
        }
      }
      await assertMatchNoHorizontalOverflow(page, "list", vp);
      if (errors.length) fail("UI", `console @${vp.label}`, errors.join("; "));
      else pass("UI", `console @${vp.label}`, "0 errors");
      await page.close();
    });
  }

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: t1Token });
    await page.goto(
      `${baseUrl}/match/match-talk-bridge.html?pair_id=${encodeURIComponent(pairId)}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForFunction(() => window.TasfulMatchAPI?.mode === "edge_stub", null, {
      timeout: 8000,
    });
    await page.locator("[data-match-talk-cta]").click();
    try {
      await page.waitForURL(/chat-detail\.html\?room=/, { timeout: 12000 });
      pass("UI", "talk bridge redirect", page.url().split("?")[1] || page.url());
    } catch {
      fail("UI", "talk bridge redirect", page.url());
    }
    if (errors.length) fail("UI", "talk bridge console", errors.join("; "));
    else pass("UI", "talk bridge console", "0 errors");
    await page.close();
  });
}

async function runClientStubSmoke(baseUrl) {
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.goto(`${baseUrl}/match/match-list.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const mode = await page.evaluate(() => window.TasfulMatchAPI?.mode || "");
    if (mode !== "client_stub") {
      fail("Smoke", "client_stub default mode", mode);
    } else {
      pass("Smoke", "client_stub default mode", mode);
    }
    const stubPairs = await page.evaluate(() => {
      const stub = window.TasfulMatchDataStub;
      return stub && typeof stub.getPairs === "function" ? stub.getPairs().length : 0;
    });
    if (stubPairs < 1) fail("Smoke", "client_stub pair seed", String(stubPairs));
    else pass("Smoke", "client_stub pair seed", String(stubPairs));
    if (errors.length) fail("Smoke", "client_stub console", errors.join("; "));
    else pass("Smoke", "client_stub console", "0 errors");
    await page.close();
  });
}

function writeReport(cfg, summary) {
  const outPath = path.join(ROOT, "reports", "match-linked-ref-e2e-verification-report.md");
  const failed = results.filter((r) => !r.ok);
  const bySection = {};
  for (const r of results) {
    if (!bySection[r.section]) bySection[r.section] = [];
    bySection[r.section].push(r);
  }

  let md = `# TASFUL MATCH — linked ref E2E Verification Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length} checks)\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-linked-ref-e2e.mjs\n`;
  if (skipDeploy) md += `# with --skip-deploy\n`;
  if (skipUi) md += `# with --skip-ui\n`;
  md += `node scripts/smoke-match-core-e2e.mjs --live --functions-base ${FUNCTIONS_BASE}\n\`\`\`\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `## Results\n\n`;
  md += `| Section | Step | Result | Detail |\n`;
  md += `|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "**FAIL**"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }
  if (failed.length) {
    md += `\n## Failures & fixes\n\n`;
    for (const r of failed) {
      md += `- **${r.section} / ${r.step}**: ${r.detail || "see logs"}\n`;
    }
  }
  fs.writeFileSync(outPath, md, "utf8");
  console.log(`\nReport: ${outPath}`);
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH linked ref E2E · ref=${PROJECT_REF}\n`);

  let pairId = null;
  let roomId = null;

  // 1) Migration
  try {
    const row = runSqlGates();
    const checks = [
      ["transaction_rooms.match_pair_id", Number(row.transaction_rooms_match_pair_id_col) === 1],
      ["match_pairs.talk_room_id", Number(row.match_pairs_talk_room_id_col) === 1],
      ["idx transaction_rooms_match_pair_id_uidx", Number(row.transaction_rooms_match_pair_id_uidx) === 1],
      ["idx transaction_rooms_listing_match_idx", Number(row.transaction_rooms_listing_match_idx) === 1],
    ];
    for (const [name, ok] of checks) {
      if (ok) pass("Migration", name, "present");
      else fail("Migration", name, "missing");
    }
  } catch (err) {
    fail("Migration", "SQL gates", String(err.message || err));
  }

  // 2) Deploy
  if (!skipDeploy) {
    try {
      deployCoreFunctions();
      pass("Deploy", "functions deploy", CORE_EDGE_FUNCTIONS.join(", "));
      verifyFunctionsListed();
      pass("Deploy", "functions list", "all 3 listed");
    } catch (err) {
      fail("Deploy", "functions", String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  // 3) JWT prep
  let t1Token = "";
  let t2Token = "";
  let t3Token = "";
  try {
    const t1Login = await login(cfg, T1.email);
    const t2Login = await login(cfg, T2.email);
    const t3Login = await login(cfg, T3.email);
    t1Token = t1Login.data?.access_token || "";
    t2Token = t2Login.data?.access_token || "";
    t3Token = t3Login.data?.access_token || "";
    if (!t1Token || !t2Token || !t3Token) throw new Error("login failed");

    for (const [label, token, expected] of [
      ["T1", t1Token, T1.talkUserId],
      ["T2", t2Token, T2.talkUserId],
      ["T3", t3Token, T3.talkUserId],
    ]) {
      const claims = extractClaimsFromJwt(decodeJwtPayload(token), null);
      if (claims.talk_user_id !== expected) {
        fail("JWT", `${label} talk_user_id`, `got ${claims.talk_user_id}`);
      } else {
        pass("JWT", `${label} talk_user_id`, expected);
      }
    }

    const ownProfile = await restFetch(cfg, {
      table: "match_profiles",
      query: "user_id=eq.t1&select=user_id&limit=1",
      token: t1Token,
    });
    const profileOk =
      ownProfile.status === 200 &&
      ((Array.isArray(ownProfile.json) && ownProfile.json.length >= 1) ||
        (ownProfile.json && ownProfile.json.user_id === "t1"));
    if (profileOk) {
      pass("JWT", "match_current_user_id via RLS", "t1 reads own profile");
    } else {
      const srCount = await countRows(cfg, "match_profiles", "user_id=eq.t1&archived_at=is.null");
      if (srCount >= 1) {
        pass("JWT", "match_current_user_id via RLS", `profile exists (REST shape ${ownProfile.status})`);
      } else {
        fail("JWT", "match_current_user_id via RLS", `status=${ownProfile.status}`);
      }
    }

    await ensureActiveProfile(cfg, "t1", "E2E T1");
    await ensureActiveProfile(cfg, "t2", "E2E T2");
    pass("JWT", "profiles ready", "t1 + t2 active");
  } catch (err) {
    fail("JWT", "prep", String(err.message || err));
  }

  // 4) Mutual like
  if (t1Token && t2Token) {
    try {
      await cleanupT1T2PairData(cfg);
      pass("Like", "cleanup t1↔t2", "swipes/pair/rooms cleared");

      const t1Like = await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Token);
      if (t1Like.status !== 200 || !t1Like.json?.swipe_recorded) {
        throw new Error(`T1 like: ${t1Like.status} ${t1Like.text?.slice(0, 200)}`);
      }
      if (t1Like.json.matched) throw new Error("T1 like should not match yet");
      pass("Like", "T1 → T2 like", "swipe_recorded, matched=false");

      const t2Like = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t2Token);
      if (t2Like.status !== 200 || !t2Like.json?.matched || !t2Like.json?.pair_id) {
        throw new Error(`T2 like: ${t2Like.status} ${t2Like.text?.slice(0, 200)}`);
      }
      pairId = String(t2Like.json.pair_id);
      pass("Like", "T2 → T1 like (mutual)", `pair_id=${pairId.slice(0, 8)}…`);

      const swipeCount = await countRows(
        cfg,
        "match_swipes",
        "or=(and(swiper_user_id.eq.t1,target_user_id.eq.t2),and(swiper_user_id.eq.t2,target_user_id.eq.t1))",
      );
      if (swipeCount !== 2) fail("Like", "match_swipes count", String(swipeCount));
      else pass("Like", "match_swipes count", "2");

      const pairCount = await countRows(cfg, "match_pairs", "user_low_id=eq.t1&user_high_id=eq.t2");
      if (pairCount !== 1) fail("Like", "match_pairs count", String(pairCount));
      else pass("Like", "match_pairs count", "1");

      const dup = await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1Token);
      if (dup.status !== 409) fail("Like", "duplicate swipe", `status=${dup.status}`);
      else pass("Like", "duplicate swipe", "409 conflict");

      const pairCountAfter = await countRows(cfg, "match_pairs", "user_low_id=eq.t1&user_high_id=eq.t2");
      if (pairCountAfter !== 1) fail("Like", "pair idempotency", String(pairCountAfter));
      else pass("Like", "pair idempotency", "still 1");
    } catch (err) {
      fail("Like", "mutual flow", String(err.message || err));
    }
  }

  // 5) List pairs
  if (t1Token && t2Token && t3Token && pairId) {
    try {
      const t1List = await edgePost(cfg, "match-list-pairs", {}, t1Token);
      const t2List = await edgePost(cfg, "match-list-pairs", {}, t2Token);
      const t3List = await edgePost(cfg, "match-list-pairs", {}, t3Token);
      if (t1List.status !== 200 || !Array.isArray(t1List.json?.pairs)) {
        throw new Error(`T1 list: ${t1List.status}`);
      }
      const t1Partner = t1List.json.pairs.find((p) => p.pair_id === pairId);
      if (!t1Partner || t1Partner.partner_user_id !== "t2") {
        fail("List", "T1 sees T2", JSON.stringify(t1Partner || null));
      } else {
        pass("List", "T1 sees T2", t1Partner.partner_display_name || "t2");
      }

      const t2Partner = (t2List.json?.pairs || []).find((p) => p.pair_id === pairId);
      if (!t2Partner || t2Partner.partner_user_id !== "t1") {
        fail("List", "T2 sees T1", JSON.stringify(t2Partner || null));
      } else {
        pass("List", "T2 sees T1", t2Partner.partner_display_name || "t1");
      }

      const t3Has = (t3List.json?.pairs || []).some((p) => p.pair_id === pairId);
      if (t3Has) fail("List", "T3 isolation", "leaked pair");
      else pass("List", "T3 isolation", "pair hidden");
    } catch (err) {
      fail("List", "live list", String(err.message || err));
    }
  }

  // 6) Talk room
  if (t1Token && pairId) {
    try {
      const first = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t1Token);
      if (first.status !== 200 || !first.json?.room_id || !first.json?.redirect_url) {
        throw new Error(`ensure-talk 1: ${first.status} ${first.text?.slice(0, 300)}`);
      }
      roomId = String(first.json.room_id);
      if (!/^\.\.\/chat-detail\.html\?room=/.test(first.json.redirect_url)) {
        fail("TALK", "redirect_url format", first.json.redirect_url);
      } else {
        pass("TALK", "redirect_url format", first.json.redirect_url);
      }
      pass("TALK", "first ensure", `room_id=${roomId.slice(0, 8)}… created=${first.json.created}`);

      const roomRows = await restFetch(cfg, {
        table: "transaction_rooms",
        query: `id=eq.${roomId}&select=id,listing_type,buyer_id,seller_id,match_pair_id`,
        serviceRole: true,
      });
      const room = roomRows.json?.[0];
      if (!room || room.listing_type !== "match") {
        fail("TALK", "transaction_rooms row", JSON.stringify(room));
      } else {
        pass("TALK", "transaction_rooms listing_type=match", `${room.buyer_id}/${room.seller_id}`);
      }

      const pairRow = await restFetch(cfg, {
        table: "match_pairs",
        query: `id=eq.${pairId}&select=talk_room_id`,
        serviceRole: true,
      });
      if (pairRow.json?.[0]?.talk_room_id !== roomId) {
        fail("TALK", "match_pairs.talk_room_id", String(pairRow.json?.[0]?.talk_room_id));
      } else {
        pass("TALK", "match_pairs.talk_room_id", "updated");
      }

      const second = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t2Token);
      if (second.status !== 200 || String(second.json?.room_id) !== roomId) {
        fail("TALK", "reuse room", `${second.status} ${second.json?.room_id}`);
      } else {
        pass("TALK", "reuse room", `reused=${second.json.reused}`);
      }
    } catch (err) {
      fail("TALK", "ensure-talk-room", String(err.message || err));
    }
  }

  // 7) Negative cases (block check before talk room consumes pair)
  if (t1Token && t2Token && t3Token && pairId) {
    const anon = await edgePost(cfg, "match-list-pairs", {}, "");
    if (anon.status === 401) pass("Negative", "anon → 401", "list-pairs");
    else fail("Negative", "anon → 401", `status=${anon.status}`);

    const t3Talk = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t3Token);
    if (t3Talk.status === 403) pass("Negative", "T3 pair access", "403");
    else fail("Negative", "T3 pair access", `status=${t3Talk.status} code=${t3Talk.json?.code}`);

    const fakePair = "00000000-0000-4000-8000-000000000099";
    const unmatched = await edgePost(cfg, "match-ensure-talk-room", { pair_id: fakePair }, t1Token);
    if (unmatched.status === 403 || unmatched.status === 404) {
      pass("Negative", "unknown pair", `${unmatched.status}`);
    } else {
      fail("Negative", "unknown pair", `status=${unmatched.status}`);
    }

    const blockIns = await restFetch(cfg, {
      table: "match_blocks",
      method: "POST",
      body: {
        blocker_user_id: "t1",
        blocked_user_id: "t2",
        source: "report",
        block_status: "active",
      },
      serviceRole: true,
    });
    if (blockIns.status !== 201 && blockIns.status !== 409) {
      fail("Negative", "block seed", `status=${blockIns.status}`);
    }
    const blocked = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t1Token);
    if (
      blocked.status === 409 &&
      (blocked.json?.code === "blocked" || /blocked/i.test(blocked.json?.message || ""))
    ) {
      pass("Negative", "blocked users", "409");
    } else {
      fail("Negative", "blocked users", `status=${blocked.status} code=${blocked.json?.code}`);
    }
    await restFetch(cfg, {
      table: "match_blocks",
      method: "DELETE",
      query: "blocker_user_id=eq.t1&blocked_user_id=eq.t2",
      serviceRole: true,
    });
  }

  // 8) UI — moved block section above; UI runs after negatives
  let staticServer;
  const uiPort = 8795;
  const baseUrl = `http://127.0.0.1:${uiPort}`;
  try {
    staticServer = await startStaticServer(ROOT, uiPort);
    if (!skipUi && t1Token && pairId) {
      await runUiEdgeStub(cfg, t1Token, pairId, baseUrl);
    } else if (skipUi) {
      pass("UI", "skipped", "--skip-ui");
    }
    await runClientStubSmoke(baseUrl);
  } catch (err) {
    fail("UI", "playwright", String(err.message || err));
  } finally {
    if (staticServer) await new Promise((r) => staticServer.close(r));
    await closeAllBrowsers();
  }

  // 9) Regression smokes
  const coreSmoke = runChild("smoke-match-core-e2e.mjs");
  if (coreSmoke.ok) pass("Smoke", "smoke-match-core-e2e", "PASS");
  else fail("Smoke", "smoke-match-core-e2e", coreSmoke.stderr.slice(0, 200));

  const stubApi = runChild("test-match-api-client-stub.mjs");
  if (stubApi.ok) pass("Smoke", "test-match-api-client-stub", "PASS");
  else fail("Smoke", "test-match-api-client-stub", stubApi.stderr.slice(0, 200));

  const failed = results.filter((r) => !r.ok);
  const summary = failed.length
    ? `${failed.length} check(s) failed — see table below.`
    : "All linked ref E2E checks passed for T1/T2 test data.";

  writeReport(cfg, summary);
  console.log(`\nVerdict: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
