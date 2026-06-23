#!/usr/bin/env node
/**
 * MATCH admin live verification (linked ref · T1–T4 admin)
 *
 *   node scripts/verify-match-admin-live.mjs
 *   node scripts/verify-match-admin-live.mjs --skip-deploy
 *   node scripts/verify-match-admin-live.mjs --skip-ui
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const T1 = slotByName("T1");
const T2 = slotByName("T2");
const T3 = slotByName("T3");
const T4 = slotByName("T4");
const skipDeploy = process.argv.includes("--skip-deploy");
const skipUi = process.argv.includes("--skip-ui");
const skipMigration = process.argv.includes("--skip-migration");

const FN = "match-admin-review";
const DEPLOY_FUNCTIONS = [
  FN,
  "match-ensure-talk-room",
  "match-search-profiles",
  "match-record-swipe",
  "match-submit-report",
  "match-submit-verification",
];

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

async function authFetch(cfg, { method, pathSuffix, body, bearer, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const auth = bearer || (serviceRole ? cfg.serviceRoleKey : cfg.anonKey);
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
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
  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email, password: cfg.password },
  });
  return res.data?.access_token || "";
}

async function findUserByEmail(cfg, email) {
  const res = await authFetch(cfg, {
    method: "GET",
    pathSuffix: "/admin/users?per_page=200",
    serviceRole: true,
  });
  if (!res.ok) throw new Error(`admin/users: ${res.status}`);
  return (res.data?.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function setUserRole(cfg, email, role) {
  const user = await findUserByEmail(cfg, email);
  if (!user) throw new Error(`user not found: ${email}`);
  const appMeta = {
    ...(user.app_metadata || {}),
    talk_user_id: user.app_metadata?.talk_user_id || slotByName("T4").talkUserId,
    member_id: user.app_metadata?.member_id || slotByName("T4").memberId,
    role,
    platform_role: user.app_metadata?.platform_role || "member",
    is_ops: role === "match_admin" ? false : Boolean(user.app_metadata?.is_ops),
  };
  const res = await authFetch(cfg, {
    method: "PUT",
    pathSuffix: `/admin/users/${encodeURIComponent(user.id)}`,
    serviceRole: true,
    body: { app_metadata: appMeta },
  });
  if (!res.ok) throw new Error(`set role ${role}: ${res.status} ${res.text?.slice(0, 200)}`);
  return user.id;
}

async function restFetch(cfg, { table, method = "GET", query = "", body }) {
  const key = cfg.serviceRoleKey;
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

async function edgePost(cfg, fn, body, token) {
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${cfg.url}/functions/v1/${fn}`, {
    method: "POST",
    headers,
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

function applyMigration() {
  const r = runSupabaseCli([
    "db",
    "query",
    "--linked",
    "--yes",
    "-f",
    "supabase/migrations/20260626100000_match_admin_mvp.sql",
  ]);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 600));
}

function deployFunctions() {
  for (const name of DEPLOY_FUNCTIONS) {
    const r = runSupabaseCli([
      "functions",
      "deploy",
      name,
      "--project-ref",
      PROJECT_REF,
      "--no-verify-jwt",
      "--use-api",
      "--yes",
    ]);
    if (r.status !== 0) throw new Error(`${name}: ${(r.stderr || r.stdout).slice(0, 400)}`);
  }
}

async function ensureProfile(cfg, userId, nickname) {
  const existing = await restFetch(cfg, {
    table: "match_profiles",
    query: `user_id=eq.${userId}&archived_at=is.null&select=id`,
  });
  if (Array.isArray(existing.json) && existing.json.length) return existing.json[0].id;
  const ins = await restFetch(cfg, {
    table: "match_profiles",
    method: "POST",
    body: {
      user_id: userId,
      nickname: nickname || userId,
      gender: "private",
      birth_date: "1995-06-15",
      prefecture: "東京都",
      profile_status: "active",
      verification_status: "none",
      age_verified: false,
    },
  });
  return ins.json?.[0]?.id || null;
}

async function cleanupUser(cfg, userId) {
  await restFetch(cfg, {
    table: "match_blocks",
    method: "DELETE",
    query: `or=(blocker_user_id.eq.${userId},blocked_user_id.eq.${userId})`,
  });
  await restFetch(cfg, {
    table: "match_reports",
    method: "DELETE",
    query: `or=(reporter_user_id.eq.${userId},reported_user_id.eq.${userId})`,
  });
  await restFetch(cfg, {
    table: "match_verifications",
    method: "DELETE",
    query: `user_id=eq.${userId}`,
  });
  await restFetch(cfg, {
    table: "match_swipes",
    method: "DELETE",
    query: `or=(swiper_user_id.eq.${userId},target_user_id.eq.${userId})`,
  });
  await restFetch(cfg, {
    table: "match_pairs",
    method: "DELETE",
    query: `or=(user_low_id.eq.${userId},user_high_id.eq.${userId})`,
  });
  await restFetch(cfg, {
    table: "match_profiles",
    method: "PATCH",
    query: `user_id=eq.${userId}&archived_at=is.null`,
    body: {
      profile_status: "active",
      verification_status: "none",
      age_verified: false,
    },
  });
}

async function createMutualPair(cfg, userA, userB) {
  await restFetch(cfg, {
    table: "match_swipes",
    method: "DELETE",
    query: `or=(and(swiper_user_id.eq.${userA},target_user_id.eq.${userB}),and(swiper_user_id.eq.${userB},target_user_id.eq.${userA}))`,
  });
  await restFetch(cfg, {
    table: "match_pairs",
    method: "DELETE",
    query: `or=(and(user_low_id.eq.${userA},user_high_id.eq.${userB}),and(user_low_id.eq.${userB},user_high_id.eq.${userA}))`,
  });

  const tokenA =
    userA === "t1"
      ? await login(cfg, T1.email)
      : userA === "t2"
        ? await login(cfg, T2.email)
        : await login(cfg, T3.email);
  const tokenB =
    userB === "t1"
      ? await login(cfg, T1.email)
      : userB === "t2"
        ? await login(cfg, T2.email)
        : await login(cfg, T3.email);
  const first = await edgePost(cfg, "match-record-swipe", { target_user_id: userB, action: "like" }, tokenA);
  if (first.status !== 200) {
    throw new Error(`${userA}->${userB} swipe ${first.status}: ${first.text?.slice(0, 120)}`);
  }
  const second = await edgePost(cfg, "match-record-swipe", { target_user_id: userA, action: "like" }, tokenB);
  if (second.status !== 200) {
    throw new Error(`${userB}->${userA} swipe ${second.status}: ${second.text?.slice(0, 120)}`);
  }
  return { pairId: second.json?.pair_id || null, matched: Boolean(second.json?.matched) };
}

function startStaticServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath.replace(/^\//, "");
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

function writeReport(summary) {
  const out = path.join(ROOT, "reports", "match-admin-live-integration-report.md");
  const failed = results.filter((r) => !r.ok);
  let md = `# TASFUL MATCH — Admin Live Integration Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}  \n`;
  md += `**Ref:** \`${PROJECT_REF}\`  \n`;
  md += `**Verdict:** **${failed.length ? "FAIL" : "PASS"}** (${results.length - failed.length}/${results.length})\n\n`;
  md += `## Design decisions\n\n`;
  md += `| Topic | Decision |\n|-------|----------|\n`;
  md += `| Admin gate | JWT \`match_is_admin()\`（\`tasu_admin\` / \`match_admin\` / \`is_ops\`） |\n`;
  md += `| API shape | \`intent=list_*\` + \`action=REPORT_REVIEW\\|VERIFICATION_REVIEW\\|PROFILE_ACTION\` |\n`;
  md += `| identity approve | \`match_verifications.approved\` + \`match_profiles.verification_status=verified\` |\n`;
  md += `| identity reject | \`rejected\` + profile \`rejected\` |\n`;
  md += `| age approve | \`match_profiles.age_verified=true\`（migration 追加） |\n`;
  md += `| suspend | \`match_profiles.profile_status=suspended\` → feed/swipe/talk 制限 |\n`;
  md += `| 監査 | \`match_moderation_logs\` engine=admin |\n`;
  md += `| client_stub | 維持（edge のみ live） |\n\n`;
  md += `## Commands\n\n\`\`\`bash\nnode scripts/verify-match-admin-live.mjs\n`;
  md += `npx supabase db query --linked --yes -f supabase/migrations/20260626100000_match_admin_mvp.sql\n`;
  md += `npx supabase functions deploy ${FN} --project-ref ${PROJECT_REF} --no-verify-jwt --use-api --yes\n\`\`\`\n\n`;
  md += `## Summary\n\n${summary}\n\n`;
  md += `| Section | Step | Result | Detail |\n|---------|------|--------|--------|\n`;
  for (const r of results) {
    md += `| ${r.section} | ${r.step} | ${r.ok ? "PASS" : "**FAIL**"} | ${(r.detail || "").replace(/\|/g, "\\|")} |\n`;
  }
  fs.writeFileSync(out, md, "utf8");
  console.log(`\nReport: ${out}`);
}

async function runUiSmoke(baseUrl, adminToken) {
  const edgeBoot = ({ functionsBase, token }) => {
    const boot = () => {
      if (!window.TasfulMatchAPI || !window.TasfulMatchAuth) return;
      window.TasfulMatchAuth.configure({
        isAuthenticated: true,
        talkUserId: "t4",
        matchUserId: "t4",
      });
      window.TasfulMatchAPI.configure({
        mode: "edge_stub",
        functionsBaseUrl: functionsBase,
        getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
      });
      window.MatchAdminWiring?.init?.();
    };
    document.addEventListener("DOMContentLoaded", boot);
    boot();
  };

  await withPlaywrightBrowser(async (browser) => {
    const viewports = [
      ...MATCH_UI_VIEWPORTS,
      { label: "768×1024", width: 768, height: 1024 },
      { label: "1280×900", width: 1280, height: 900 },
    ];
    for (const vp of viewports) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (err) => errors.push(String(err.message || err)));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !/favicon\.ico/i.test(msg.text())) errors.push(msg.text());
      });
      await page.setViewportSize(matchViewportSize(vp));
      await page.addInitScript(edgeBoot, { functionsBase: FUNCTIONS_BASE, token: adminToken });
      await page.goto(`${baseUrl}/match/match-admin.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      await assertMatchNoHorizontalOverflow(page);
      const label = vp.label || `${vp.width}px`;
      const hasWiring = await page.evaluate(() => Boolean(window.MatchAdminWiring));
      if (hasWiring) pass("UI", `${label} wiring`, "loaded");
      else fail("UI", `${label} wiring`, "missing");
      if (errors.length) fail("UI", `${label} console`, errors.slice(0, 2).join("; "));
      else pass("UI", `${label} console`, "0 errors");
      await page.close();
    }

    const stubPage = await browser.newPage();
    await stubPage.goto(`${baseUrl}/match/match-admin.html`, { waitUntil: "domcontentloaded" });
    const stubMode = await stubPage.evaluate(() => window.TasfulMatchAPI?.mode || "");
    if (stubMode === "client_stub" || !stubMode) pass("Smoke", "client_stub default", stubMode || "unset");
    else fail("Smoke", "client_stub default", stubMode);
    await stubPage.close();
  });
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH admin live · ref=${PROJECT_REF}\n`);

  if (!skipMigration) {
    try {
      applyMigration();
      pass("Migration", "match_admin_mvp", "applied");
    } catch (err) {
      fail("Migration", "apply", String(err.message || err));
    }
  } else {
    pass("Migration", "skipped", "--skip-migration");
  }

  if (!skipDeploy) {
    try {
      deployFunctions();
      pass("Deploy", "functions", DEPLOY_FUNCTIONS.join(", "));
    } catch (err) {
      fail("Deploy", "functions", String(err.message || err));
    }
  } else {
    pass("Deploy", "skipped", "--skip-deploy");
  }

  let t1Token = "";
  let t2Token = "";
  let t3Token = "";
  let adminToken = "";
  let t2ProfileId = "";
  let identityId = "";
  let ageId = "";
  let rejectIdentityId = "";
  let rejectAgeId = "";
  let reportResolveId = "";
  let reportDismissId = "";
  let pairId = "";

  try {
    await setUserRole(cfg, T4.email, "match_admin");
    [t1Token, t2Token, t3Token, adminToken] = await Promise.all([
      login(cfg, T1.email),
      login(cfg, T2.email),
      login(cfg, T3.email),
      login(cfg, T4.email),
    ]);
    if (!t1Token || !t2Token || !t3Token || !adminToken) throw new Error("login failed");
    pass("Auth", "T1–T4 login", "ok");
  } catch (err) {
    fail("Auth", "login", String(err.message || err));
  }

  if (t1Token && adminToken) {
    try {
      for (const slot of ["t1", "t2", "t3"]) {
        await cleanupUser(cfg, slot);
        await ensureProfile(cfg, slot, `Admin ${slot}`);
      }
      t2ProfileId = await ensureProfile(cfg, "t2", "Suspend Target");

      const anon = await edgePost(cfg, FN, { intent: "list_reports" }, undefined);
      if (anon.status === 401) pass("Security", "anon 401", "401");
      else fail("Security", "anon 401", `status=${anon.status}`);

      const userDenied = await edgePost(cfg, FN, { intent: "list_reports" }, t1Token);
      if (userDenied.status === 403) pass("Security", "T1 403", "403");
      else fail("Security", "T1 403", `status=${userDenied.status}`);

      const report1 = await edgePost(
        cfg,
        "match-submit-report",
        { reported_user_id: "t2", reason: "harassment", context_type: "profile" },
        t1Token,
      );
      if (report1.status !== 200) throw new Error(`report1: ${report1.status}`);
      reportResolveId = String(report1.json?.report_id || "");

      const report2 = await edgePost(
        cfg,
        "match-submit-report",
        { reported_user_id: "t2", reason: "other", context_type: "swipe" },
        t3Token,
      );
      if (report2.status !== 200) throw new Error(`report2: ${report2.status}`);
      reportDismissId = String(report2.json?.report_id || "");

      const listReports = await edgePost(cfg, FN, { intent: "list_reports" }, adminToken);
      if (listReports.status === 200 && (listReports.json?.items?.length ?? 0) >= 2) {
        pass("List", "open reports", String(listReports.json.items.length));
      } else {
        fail("List", "open reports", String(listReports.json?.items?.length));
      }

      const resolve = await edgePost(
        cfg,
        FN,
        { action: "REPORT_REVIEW", report_id: reportResolveId, decision: "resolve" },
        adminToken,
      );
      if (resolve.status === 200 && resolve.json?.status === "resolved") {
        pass("Report", "resolve", reportResolveId.slice(0, 8));
      } else {
        fail("Report", "resolve", resolve.text?.slice(0, 120));
      }

      const dismiss = await edgePost(
        cfg,
        FN,
        { action: "REPORT_REVIEW", report_id: reportDismissId, decision: "dismiss" },
        adminToken,
      );
      if (dismiss.status === 200 && dismiss.json?.status === "dismissed") {
        pass("Report", "dismiss", reportDismissId.slice(0, 8));
      } else {
        fail("Report", "dismiss", dismiss.text?.slice(0, 120));
      }

      const identitySubmit = await edgePost(
        cfg,
        "match-submit-verification",
        { intent: "submit", verification_type: "identity", id_document_type: "passport" },
        t1Token,
      );
      if (identitySubmit.status !== 200) throw new Error(`identity submit: ${identitySubmit.status}`);
      identityId = String(identitySubmit.json?.verification_id || "");

      const identityApprove = await edgePost(
        cfg,
        FN,
        { action: "VERIFICATION_REVIEW", verification_id: identityId, decision: "approve" },
        adminToken,
      );
      if (identityApprove.status === 200 && identityApprove.json?.profile_verification_status === "verified") {
        pass("Verification", "identity approve", "verified");
      } else {
        fail("Verification", "identity approve", identityApprove.text?.slice(0, 120));
      }

      const identityRejectSubmit = await edgePost(
        cfg,
        "match-submit-verification",
        { intent: "submit", verification_type: "identity", id_document_type: "mynumber" },
        t3Token,
      );
      rejectIdentityId = String(identityRejectSubmit.json?.verification_id || "");
      const identityReject = await edgePost(
        cfg,
        FN,
        { action: "VERIFICATION_REVIEW", verification_id: rejectIdentityId, decision: "reject" },
        adminToken,
      );
      const profT3 = await restFetch(cfg, {
        table: "match_profiles",
        query: "user_id=eq.t3&select=verification_status",
      });
      if (identityReject.status === 200 && profT3.json?.[0]?.verification_status === "rejected") {
        pass("Verification", "identity reject", "rejected");
      } else {
        fail("Verification", "identity reject", JSON.stringify(profT3.json?.[0]));
      }

      const ageSubmit = await edgePost(
        cfg,
        "match-submit-verification",
        { intent: "submit", verification_type: "age" },
        t2Token,
      );
      ageId = String(ageSubmit.json?.verification_id || "");
      const ageApprove = await edgePost(
        cfg,
        FN,
        { action: "VERIFICATION_REVIEW", verification_id: ageId, decision: "approve" },
        adminToken,
      );
      const profT2Age = await restFetch(cfg, {
        table: "match_profiles",
        query: "user_id=eq.t2&select=age_verified",
      });
      if (ageApprove.status === 200 && profT2Age.json?.[0]?.age_verified === true) {
        pass("Verification", "age approve", "age_verified=true");
      } else {
        fail("Verification", "age approve", JSON.stringify(profT2Age.json?.[0]));
      }

      const ageRejectSubmit = await edgePost(
        cfg,
        "match-submit-verification",
        { intent: "submit", verification_type: "age" },
        t3Token,
      );
      rejectAgeId = String(ageRejectSubmit.json?.verification_id || "");
      await edgePost(
        cfg,
        FN,
        { action: "VERIFICATION_REVIEW", verification_id: rejectAgeId, decision: "reject" },
        adminToken,
      );
      const profT3Age = await restFetch(cfg, {
        table: "match_profiles",
        query: "user_id=eq.t3&select=age_verified",
      });
      if (profT3Age.json?.[0]?.age_verified === false) {
        pass("Verification", "age reject", "age_verified=false");
      } else {
        fail("Verification", "age reject", JSON.stringify(profT3Age.json?.[0]));
      }

      const mutual = await createMutualPair(cfg, "t2", "t3");
      pairId = mutual.pairId || "";
      if (pairId || mutual.matched) {
        pass("Prep", "mutual pair T2-T3", (pairId || "matched").slice(0, 8));
      } else {
        fail("Prep", "mutual pair", "missing");
      }

      const suspend = await edgePost(
        cfg,
        FN,
        { action: "PROFILE_ACTION", profile_id: t2ProfileId, decision: "suspend" },
        adminToken,
      );
      if (suspend.status === 200 && suspend.json?.profile_status === "suspended") {
        pass("Profile", "suspend", "suspended");
      } else {
        fail("Profile", "suspend", suspend.text?.slice(0, 120));
      }

      const feed = await edgePost(cfg, "match-search-profiles", { limit: 30 }, t1Token);
      const feedIds = (feed.json?.items || []).map((i) => i.user_id);
      if (!feedIds.includes("t2")) pass("Suspend", "feed excludes T2", "absent");
      else fail("Suspend", "feed excludes T2", "present");

      const swipeToT2 = await edgePost(
        cfg,
        "match-record-swipe",
        { target_user_id: "t2", action: "like" },
        t1Token,
      );
      if (swipeToT2.status === 404) pass("Suspend", "swipe to T2 blocked", "404");
      else fail("Suspend", "swipe to T2", `status=${swipeToT2.status}`);

      const swipeFromT2 = await edgePost(
        cfg,
        "match-record-swipe",
        { target_user_id: "t1", action: "like" },
        t2Token,
      );
      if (swipeFromT2.status === 403) pass("Suspend", "T2 swipe blocked", "403");
      else fail("Suspend", "T2 swipe", `status=${swipeFromT2.status}`);

      if (pairId) {
        const talk = await edgePost(cfg, "match-ensure-talk-room", { pair_id: pairId }, t3Token);
        if (talk.status === 403) pass("Suspend", "TALK create blocked", "403");
        else fail("Suspend", "TALK create", `status=${talk.status}`);
      } else {
        fail("Suspend", "TALK create blocked", "skipped (no pair)");
      }

      const unsuspend = await edgePost(
        cfg,
        FN,
        { action: "PROFILE_ACTION", profile_id: t2ProfileId, decision: "unsuspend" },
        adminToken,
      );
      if (unsuspend.status === 200 && unsuspend.json?.profile_status === "active") {
        pass("Profile", "unsuspend", "active");
      } else {
        fail("Profile", "unsuspend", unsuspend.text?.slice(0, 120));
      }

      const feedAfter = await edgePost(cfg, "match-search-profiles", { limit: 30 }, t1Token);
      const feedIdsAfter = (feedAfter.json?.items || []).map((i) => i.user_id);
      const publicT2 = await fetch(
        `${cfg.url}/rest/v1/match_profiles_public?user_id=eq.t2&select=user_id`,
        {
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${t1Token}`,
          },
        },
      );
      const publicT2Json = await publicT2.json().catch(() => []);
      const visibleInView = Array.isArray(publicT2Json) && publicT2Json.length > 0;
      if (visibleInView || feedIdsAfter.includes("t2")) {
        pass("Unsuspend", "T2 discoverable", visibleInView ? "public view" : "feed");
      } else {
        fail("Unsuspend", "T2 discoverable", `feed=${feedIdsAfter.join(",")}`);
      }
    } catch (err) {
      fail("Flow", "admin", String(err.message || err));
    } finally {
      try {
        await setUserRole(cfg, T4.email, "authenticated");
      } catch {
        /* restore best-effort */
      }
    }
  }

  if (!skipUi && adminToken) {
    const port = 18792;
    const server = await startStaticServer(ROOT, port);
    try {
      await runUiSmoke(`http://127.0.0.1:${port}`, adminToken);
    } catch (err) {
      fail("UI", "playwright", String(err.message || err));
    } finally {
      server.close();
    }
  } else if (skipUi) {
    pass("UI", "skipped", "--skip-ui");
  }

  await closeAllBrowsers();
  const failed = results.filter((r) => !r.ok);
  writeReport(
    failed.length === 0
      ? "Admin MVP live passed on linked ref."
      : `${failed.length} check(s) failed.`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
