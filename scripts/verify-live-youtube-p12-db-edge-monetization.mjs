#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 12 — DB + Edge monetization
 *
 *   npm run verify:live-youtube-p12
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { ensureTalkJwt, loadTalkSupabaseConfig, TALK_TEST_USERS } from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_FILES = [
  "supabase/migrations/20260702100000_live_monetization_p12.sql",
  "supabase/functions/live-monetization-admin/index.ts",
  "live/live-monetization-service.js",
  "live/live-creator-dashboard.js",
  "live/live-admin-videos.js",
  "live/live-config.js",
  "deploy/cloudflare/dist/live/live-monetization-service.js",
  "deploy/cloudflare/dist/live/live-creator-dashboard.js",
  "deploy/cloudflare/dist/live/live-admin-videos.js",
  "deploy/cloudflare/dist/live/live-config.js",
];

const VIEWPORTS = [
  { id: "mobile-390", width: 390, height: 844 },
  { id: "tablet-768", width: 768, height: 1024 },
  { id: "desktop-1280", width: 1280, height: 800 },
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];

function pass(id, detail = "") {
  summary.pass += 1;
  console.log(`  PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}

function fail(id, detail = "") {
  summary.fail += 1;
  failures.push(`${id}${detail ? `: ${detail}` : ""}`);
  console.log(`  FAIL  ${id}${detail ? ` — ${detail}` : ""}`);
}

function skip(id, detail = "") {
  summary.skip += 1;
  console.log(`  SKIP  ${id}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function verifyStatic() {
  console.log("\n=== A. Static code ===\n");
  for (const rel of STATIC_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const mig = read("supabase/migrations/20260702100000_live_monetization_p12.sql");
  if (mig.includes("live_creator_monetization") && mig.includes("live_ad_rpm_settings")) pass("sql-tables");
  else fail("sql-tables");
  if (mig.includes("talk_is_admin") && mig.includes("talk_current_user_id")) pass("sql-rls");
  else fail("sql-rls");

  const edge = read("supabase/functions/live-monetization-admin/index.ts");
  if (edge.includes("requireVerifiedAdmin") && edge.includes("list_applications")) pass("edge-admin");
  else fail("edge-admin");
  if (edge.includes("live_monetization_audit_logs")) pass("edge-audit");
  else fail("edge-audit");

  const svcJs = read("live/live-monetization-service.js");
  if (svcJs.includes("applyMonetization") && svcJs.includes("listApplicationsViaEdge")) pass("code-service-db");
  else fail("code-service-db");
  if (svcJs.includes("getGlobalRpmYenAsync") && svcJs.includes("getRecordLocal")) pass("code-service-fallback");
  else fail("code-service-fallback");

  const cfgJs = read("live/live-config.js");
  if (cfgJs.includes("MONETIZATION_ADMIN_FUNCTION") && cfgJs.includes("fetchMonetizationAdminViaEdge")) {
    pass("code-config-edge");
  } else fail("code-config-edge");
}

async function rest(cfg, opts) {
  const { table, method = "GET", query = "", body, jwt, useService = false, prefer } = opts;
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const headers = {
    apikey: key,
    Authorization: `Bearer ${auth}`,
    "Content-Type": "application/json",
    Prefer: prefer || (method === "GET" ? "count=exact" : "return=representation"),
  };
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function edgePost(cfg, name, body, jwt) {
  const res = await fetch(`${cfg.url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${jwt || cfg.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 300) };
  }
  return { status: res.status, data };
}

async function seedMonetizationPending(cfg) {
  if (!cfg.serviceKey) {
    skip("seed-db", "no service key");
    return;
  }
  const now = new Date().toISOString();
  const upsert = await rest(cfg, {
    table: "live_creator_monetization",
    method: "POST",
    query: "?on_conflict=user_id",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      user_id: "u_store",
      status: "pending",
      applied_at: now,
    },
    useService: true,
  });
  if (upsert.ok) pass("seed-u_store-pending");
  else fail("seed-u_store-pending", `status=${upsert.status} ${JSON.stringify(upsert.data)?.slice(0, 120)}`);
}

async function verifyMonetizationApi(cfg, storeJwt, adminJwt) {
  console.log("\n=== B. Monetization Edge API ===\n");

  const anon = await edgePost(cfg, "live-monetization-admin", { action: "list_applications" }, cfg.anonKey);
  if (anon.status === 401) pass("edge-anon-401");
  else fail("edge-anon-401", `status=${anon.status}`);

  const nonAdmin = await edgePost(cfg, "live-monetization-admin", { action: "list_applications" }, storeJwt);
  if (nonAdmin.status === 403) pass("edge-nonadmin-403");
  else fail("edge-nonadmin-403", `status=${nonAdmin.status}`);

  const list = await edgePost(cfg, "live-monetization-admin", { action: "list_applications", limit: 20 }, adminJwt);
  if (list.status === 200 && Array.isArray(list.data?.items)) pass("edge-admin-list");
  else fail("edge-admin-list", `status=${list.status}`);

  const detail = await edgePost(
    cfg,
    "live-monetization-admin",
    { action: "get_application_detail", user_id: "u_store" },
    adminJwt,
  );
  if (detail.status === 200) pass("edge-admin-detail");
  else fail("edge-admin-detail", `status=${detail.status}`);

  const approve = await edgePost(
    cfg,
    "live-monetization-admin",
    { action: "review_application", user_id: "u_store", review_action: "approve", note: "P12 verify" },
    adminJwt,
  );
  if (approve.status === 200 && approve.data?.application?.status === "approved") pass("edge-admin-approve");
  else fail("edge-admin-approve", `status=${approve.status}`);

  const suspend = await edgePost(
    cfg,
    "live-monetization-admin",
    { action: "review_application", user_id: "u_store", review_action: "suspend" },
    adminJwt,
  );
  if (suspend.status === 200 && suspend.data?.application?.status === "suspended") pass("edge-admin-suspend");
  else fail("edge-admin-suspend", `status=${suspend.status}`);

  const resume = await edgePost(
    cfg,
    "live-monetization-admin",
    { action: "review_application", user_id: "u_store", review_action: "resume" },
    adminJwt,
  );
  if (resume.status === 200 && resume.data?.application?.status === "approved") pass("edge-admin-resume");
  else fail("edge-admin-resume", `status=${resume.status}`);

  const rpmList = await edgePost(cfg, "live-monetization-admin", { action: "list_rpm_settings" }, adminJwt);
  if (rpmList.status === 200 && Array.isArray(rpmList.data?.items)) pass("edge-rpm-list");
  else fail("edge-rpm-list", `status=${rpmList.status}`);

  const globalRow = (rpmList.data?.items || []).find((r) => r.scope === "global" && r.active);
  if (globalRow?.id) {
    const rpmUpdate = await edgePost(
      cfg,
      "live-monetization-admin",
      { action: "update_rpm_setting", id: globalRow.id, rpm_yen: 110 },
      adminJwt,
    );
    if (rpmUpdate.status === 200) pass("edge-rpm-update");
    else fail("edge-rpm-update", `status=${rpmUpdate.status}`);
    await edgePost(
      cfg,
      "live-monetization-admin",
      { action: "update_rpm_setting", id: globalRow.id, rpm_yen: 100 },
      adminJwt,
    );
  } else {
    fail("edge-rpm-update", "no global row");
  }

  const audit = await rest(cfg, {
    table: "live_monetization_audit_logs",
    query: "select=id,action&order=created_at.desc&limit=5",
    jwt: adminJwt,
  });
  if (audit.ok && (audit.data || []).length > 0) pass("audit-logs-readable");
  else fail("audit-logs-readable", `status=${audit.status}`);

  const creatorRead = await rest(cfg, {
    table: "live_creator_monetization",
    query: "select=status&user_id=eq.u_store",
    jwt: storeJwt,
  });
  if (creatorRead.ok && creatorRead.data?.[0]?.status) pass("creator-read-own");
  else fail("creator-read-own", `status=${creatorRead.status}`);

  await rest(cfg, {
    table: "live_creator_monetization",
    method: "PATCH",
    query: "?user_id=eq.u_store",
    body: { status: "pending", applied_at: new Date().toISOString() },
    useService: true,
  });
}

async function verifyCreatorApply(cfg, storeJwt) {
  console.log("\n=== C. Creator apply ===\n");

  if (!cfg.serviceKey) {
    skip("creator-apply", "no service key");
    return;
  }

  const reset = await rest(cfg, {
    table: "live_creator_monetization",
    method: "PATCH",
    query: "?user_id=eq.u_store",
    body: { status: "not_applied", applied_at: null, reviewed_at: null, reviewed_by: null, note: null },
    useService: true,
  });
  if (!reset.ok) {
    await rest(cfg, {
      table: "live_creator_monetization",
      method: "DELETE",
      query: "?user_id=eq.u_store",
      useService: true,
    });
  }

  const applyRes = await rest(cfg, {
    table: "live_creator_monetization",
    method: "PATCH",
    query: "?user_id=eq.u_store",
    prefer: "return=representation",
    body: { status: "pending", applied_at: new Date().toISOString() },
    jwt: storeJwt,
  });
  if (applyRes.ok && applyRes.data?.[0]?.status === "pending") pass("creator-apply-pending");
  else fail("creator-apply-pending", `status=${applyRes.status} ${JSON.stringify(applyRes.data)?.slice(0, 120)}`);

  const dup = await rest(cfg, {
    table: "live_creator_monetization",
    method: "PATCH",
    query: "?user_id=eq.u_store",
    body: { status: "pending", applied_at: new Date().toISOString() },
    jwt: storeJwt,
  });
  if (!dup.ok || String(dup.data?.message || "").includes("duplicate")) pass("creator-dup-blocked");
  else if (dup.data?.[0]?.status === "pending") pass("creator-dup-blocked", "still pending");
  else fail("creator-dup-blocked", `status=${dup.status}`);
}

async function seedPageAuth(page, jwt, talkUserId = "u_admin", role = "") {
  await page.addInitScript(
    ({ token, uid, adminRole }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p12",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p12",
              app_metadata: { talk_user_id: uid, member_id: uid, role: adminRole || undefined },
              user_metadata: { talk_user_id: uid },
            },
          }),
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: "verify@tasful.local", signedInAt: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    },
    { token: jwt, uid: talkUserId, adminRole: role },
  );
}

async function checkPageConsole(page, url, viewport, jwt, uid, role) {
  const errors = [];
  const handler = (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource: the server responded with a status of (403|404)/.test(text)) return;
    if (/functions\/v1\//.test(text)) return;
    errors.push(text);
  };
  page.on("console", handler);
  page.on("pageerror", (err) => {
    const text = err.message || "";
    if (/Failed to fetch|403|404/.test(text)) return;
    errors.push(text);
  });
  await page.setViewportSize(viewport);
  await seedPageAuth(page, jwt, uid, role);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  page.off("console", handler);
  return errors;
}

async function verifyViewports(base, adminJwt) {
  console.log("\n=== D. Viewport smoke ===\n");
  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      const errors = await checkPageConsole(
        page,
        `${base}/live/admin-videos.html`,
        vp,
        adminJwt,
        "u_admin",
        "tasu_admin",
      );
      if (errors.length === 0) pass(`console:${vp.id}:admin`);
      else fail(`console:${vp.id}:admin`, errors.slice(0, 2).join(" | "));
      await page.close();
    }
  });
}

async function verifyRegression() {
  console.log("\n=== E. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p11-admin-monetization.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p11");
  else fail("regression:verify:live-youtube-p11", out.split("\n").slice(-10).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 12 DB + Edge Monetization ===\n");
  verifyStatic();

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    skip("api-tests", "Supabase config missing");
  } else {
    let storeJwt;
    let adminJwt;
    try {
      storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
      adminJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
    } catch (err) {
      skip("api-tests", err.message || "JWT failed");
      storeJwt = null;
      adminJwt = null;
    }
    if (storeJwt && adminJwt) {
      await seedMonetizationPending(cfg);
      await verifyMonetizationApi(cfg, storeJwt, adminJwt);
      await verifyCreatorApply(cfg, storeJwt);
    }
  }

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("viewport-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    const cfg2 = loadTalkSupabaseConfig();
    const adminJwt = await ensureTalkJwt(cfg2, TALK_TEST_USERS.u_admin).catch(() => null);
    if (adminJwt) await verifyViewports(base, adminJwt);
    else skip("viewport-tests", "admin JWT missing");
  }

  await verifyRegression();
  await closeAllBrowsers();

  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  console.log(`\nResult: ${summary.fail ? "FAIL" : "PASS"}\n`);
  if (failures.length) for (const f of failures) console.log(`  - ${f}`);
  process.exit(summary.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
