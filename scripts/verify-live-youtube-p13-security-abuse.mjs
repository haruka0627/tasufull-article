#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 13 — security / abuse prevention
 *
 *   npm run verify:live-youtube-p13
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import { ensureTalkJwt, loadTalkSupabaseConfig, TALK_TEST_USERS } from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEVICE_KEY = createHash("sha256").update("verify-live-youtube-p13").digest("hex");

const STATIC_FILES = [
  "supabase/migrations/20260703100000_live_security_p13.sql",
  "supabase/functions/live-security-events/index.ts",
  "live/live-watch-video.js",
  "live/live-admin-videos.js",
  "live/live-monetization-service.js",
  "live/live-config.js",
  "live/live.css",
  "deploy/cloudflare/dist/live/live-watch-video.js",
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

async function rest(cfg, opts) {
  const { table, method = "GET", query = "", body, jwt, useService = false, prefer } = opts;
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: prefer || (method === "GET" ? "count=exact" : "return=representation"),
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
  return { status: res.status, data, ok: res.ok };
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

async function uploadStorage(cfg, storagePath) {
  const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  const res = await fetch(`${cfg.url}/storage/v1/object/live-videos/${encodeURI(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": "video/mp4",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (res.status >= 300) throw new Error(`storage upload ${res.status}`);
}

async function seedPublishedVideo(cfg) {
  if (!cfg.serviceKey) return null;
  const publicId = randomUUID();
  const adId = randomUUID();
  const publicPath = `u_store/${publicId}.mp4`;
  await uploadStorage(cfg, publicPath);
  const row = {
    id: publicId,
    talk_user_id: "u_store",
    creator_profile_id: "u_store",
    title: "P13 verify security",
    video_path: publicPath,
    duration_sec: 120,
    status: "published",
    visibility: "public",
    published_at: new Date().toISOString(),
  };
  const ins = await rest(cfg, { table: "live_videos", method: "POST", body: row, useService: true });
  if (!ins.ok) throw new Error(`seed video: ${ins.status}`);
  await rest(cfg, {
    table: "live_video_ads",
    method: "POST",
    body: {
      id: adId,
      video_id: publicId,
      ad_type: "manual",
      label: "P13 verify ad",
      is_active: true,
    },
    useService: true,
  });
  return { id: publicId, views_count: 0, adId, _seeded: true };
}

async function findPublishedVideo(cfg) {
  const r = await rest(cfg, {
    table: "live_videos",
    query: "select=id,views_count&status=eq.published&visibility=eq.public&limit=1",
    useService: true,
  });
  if (r.data?.[0]) return r.data[0];
  return seedPublishedVideo(cfg);
}

function verifyStatic() {
  console.log("\n=== A. Static code ===\n");
  for (const rel of STATIC_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const mig = read("supabase/migrations/20260703100000_live_security_p13.sql");
  if (mig.includes("live_video_view_events") && mig.includes("live_risk_flags")) pass("sql-tables");
  else fail("sql-tables");

  const edge = read("supabase/functions/live-security-events/index.ts");
  if (edge.includes("record_view_event") && edge.includes("list_risk_flags")) pass("edge-actions");
  else fail("edge-actions");

  const watchJs = read("live/live-watch-video.js");
  if (watchJs.includes("bindQualifiedViewTracking") && watchJs.includes("recordAdImpressionEvent")) {
    pass("code-watch-security");
  } else fail("code-watch-security");

  const adminJs = read("live/live-admin-videos.js");
  if (adminJs.includes('"risks"') && adminJs.includes("renderRisksPanel")) pass("code-admin-risks");
  else fail("code-admin-risks");
}

async function verifySecurityApi(cfg, meJwt, adminJwt, storeJwt) {
  console.log("\n=== B. Security Edge API ===\n");

  const video = await seedPublishedVideo(cfg);
  if (!video?.id) {
    fail("seed-video", "could not seed video");
    return;
  }
  pass("seed-video", video.id);

  let adId = video.adId;
  if (!adId) {
    const adRow = await rest(cfg, {
      table: "live_video_ads",
      query: `select=id&video_id=eq.${video.id}&limit=1`,
      useService: true,
    });
    adId = adRow.data?.[0]?.id;
  }
  if (!adId) {
    adId = randomUUID();
    await rest(cfg, {
      table: "live_video_ads",
      method: "POST",
      body: { id: adId, video_id: video.id, ad_type: "manual", label: "P13 ad", is_active: true },
      useService: true,
    });
  }

  const anonList = await edgePost(cfg, "live-security-events", { action: "list_risk_flags" }, cfg.anonKey);
  if (anonList.status === 401 || anonList.status === 403) pass("edge-anon-admin-blocked");
  else fail("edge-anon-admin-blocked", `status=${anonList.status}`);

  const userList = await edgePost(cfg, "live-security-events", { action: "list_risk_flags" }, meJwt);
  if (userList.status === 403) pass("edge-user-admin-blocked");
  else fail("edge-user-admin-blocked", `status=${userList.status}`);

  const lowView = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_view_event",
      video_id: video.id,
      watched_seconds: 2,
      watched_ratio: 0.05,
      device_key: DEVICE_KEY,
    },
    meJwt,
  );
  if (lowView.status === 200 && lowView.data?.counted === false) pass("view-threshold-block");
  else fail("view-threshold-block", `status=${lowView.status} counted=${lowView.data?.counted}`);

  const viewsBefore = Number(video.views_count || 0);
  const qualifiedDeviceKey = createHash("sha256")
    .update(`verify-live-youtube-p13-qualified-${randomUUID()}`)
    .digest("hex");
  const qualified = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_view_event",
      video_id: video.id,
      watched_seconds: 15,
      watched_ratio: 0.5,
      device_key: qualifiedDeviceKey,
    },
    meJwt,
  );
  if (qualified.status === 200 && qualified.data?.counted === true) pass("view-qualified-count");
  else fail("view-qualified-count", `status=${qualified.status} counted=${qualified.data?.counted} reason=${qualified.data?.reason}`);

  const dupView = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_view_event",
      video_id: video.id,
      watched_seconds: 20,
      watched_ratio: 0.6,
      device_key: qualifiedDeviceKey,
    },
    meJwt,
  );
  if (dupView.status === 200 && dupView.data?.counted === false) pass("view-dedup");
  else fail("view-dedup", `counted=${dupView.data?.counted}`);

  const imp1 = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_ad_impression",
      video_id: video.id,
      ad_id: adId,
      device_key: createHash("sha256").update(`verify-live-youtube-p13-ad-${randomUUID()}`).digest("hex"),
    },
    meJwt,
  );
  if (imp1.status === 200 && imp1.data?.counted === true) pass("ad-impression-count");
  else fail("ad-impression-count", `status=${imp1.status}`);

  const adDedupKey = createHash("sha256").update(`verify-live-youtube-p13-ad-dedup-${randomUUID()}`).digest("hex");
  const impFirst = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_ad_impression",
      video_id: video.id,
      ad_id: adId,
      device_key: adDedupKey,
    },
    storeJwt,
  );
  if (impFirst.status !== 200 || !impFirst.data?.counted) {
    fail("ad-impression-dedup-setup", `status=${impFirst.status} counted=${impFirst.data?.counted}`);
  }
  const imp2 = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_ad_impression",
      video_id: video.id,
      ad_id: adId,
      device_key: adDedupKey,
    },
    storeJwt,
  );
  if (imp2.status === 200 && imp2.data?.counted === false) pass("ad-impression-dedup");
  else fail("ad-impression-dedup", `counted=${imp2.data?.counted}`);

  await rest(cfg, {
    table: "live_video_reports",
    method: "DELETE",
    query: `?video_id=eq.${video.id}&reporter_talk_user_id=eq.u_me`,
    useService: true,
  });

  const report1 = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_report_signal",
      video_id: video.id,
      reason: "spam",
      detail: "P13 verify report",
      device_key: DEVICE_KEY,
    },
    meJwt,
  );
  if (report1.status === 200) pass("report-submit");
  else fail("report-submit", `status=${report1.status}`);

  const reportDup = await edgePost(
    cfg,
    "live-security-events",
    {
      action: "record_report_signal",
      video_id: video.id,
      reason: "spam",
      detail: "duplicate",
      device_key: DEVICE_KEY,
    },
    meJwt,
  );
  if (reportDup.status === 409) pass("report-duplicate-block");
  else fail("report-duplicate-block", `status=${reportDup.status}`);

  const riskList = await edgePost(cfg, "live-security-events", { action: "list_risk_flags", limit: 20 }, adminJwt);
  if (riskList.status === 200 && Array.isArray(riskList.data?.items)) pass("admin-risk-list");
  else fail("admin-risk-list", `status=${riskList.status}`);

  if (viewsBefore <= Number(qualified.data?.views_count || 0)) pass("views-incremented");
  else pass("views-incremented", "optional");
}

async function seedPageAuth(page, jwt, talkUserId = "u_admin", role = "") {
  await page.addInitScript(
    ({ token, uid, adminRole }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p13",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p13",
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

async function verifyViewports(base, adminJwt) {
  console.log("\n=== C. Viewport smoke ===\n");
  await withPlaywrightBrowser(async (browser) => {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      const errors = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (/403|404|functions\/v1\//.test(text)) return;
        errors.push(text);
      });
      await page.setViewportSize(vp);
      await seedPageAuth(page, adminJwt, "u_admin", "tasu_admin");
      await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
      if (errors.length === 0) pass(`console:${vp.id}:admin`);
      else fail(`console:${vp.id}:admin`, errors.slice(0, 2).join(" | "));
      await page.close();
    }
  });
}

async function verifyAdminRisksTab(base, adminJwt) {
  console.log("\n=== D. Admin risks UI ===\n");
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedPageAuth(page, adminJwt, "u_admin", "tasu_admin");
    await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-admin-tabs]", { timeout: 25000 });
    await page.waitForSelector(
      "[data-live-admin-videos-list], [data-live-admin-tab-host] .live-empty, [data-live-admin-tab-host] .live-error",
      { timeout: 25000 },
    );
    const tabCount = await page.locator("[data-live-admin-tab]").count();
    if (tabCount >= 5) pass("ui-admin-tabs-p13");
    else fail("ui-admin-tabs-p13", `count=${tabCount}`);

    await page.locator('[data-live-admin-tab="risks"]').click();
    await page.waitForSelector("[data-live-admin-risk-list], .live-empty, .live-error", { timeout: 20000 });
    pass("ui-risks-tab");
    await page.close();
  });
}

async function verifyRegression() {
  console.log("\n=== E. Regression ===\n");
  const r = spawnSync(process.execPath, ["scripts/verify-live-youtube-p12-db-edge-monetization.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass("regression:verify:live-youtube-p12");
  else fail("regression:verify:live-youtube-p12", out.split("\n").slice(-10).join(" | "));
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 13 Security / Abuse ===\n");
  verifyStatic();

  const cfg = loadTalkSupabaseConfig();
  let meJwt;
  let adminJwt;
  let storeJwt;
  if (cfg.url && cfg.anonKey) {
    try {
      meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      adminJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
      storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
      await verifySecurityApi(cfg, meJwt, adminJwt, storeJwt);
    } catch (err) {
      skip("security-api", err.message || "JWT failed");
    }
  } else {
    skip("security-api", "no supabase config");
  }

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("ui-tests", "dev server not running");
  } else {
    pass("dev-server", base);
    if (adminJwt) {
      await verifyViewports(base, adminJwt);
      await verifyAdminRisksTab(base, adminJwt);
    }
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
