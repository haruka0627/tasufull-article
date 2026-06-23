#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 6 — report / admin / ads
 *
 *   npm run verify:live-youtube-p6
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import {
  ensureTalkJwt,
  loadTalkSupabaseConfig,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATIC_FILES = [
  "live/watch-video.html",
  "live/live-watch-video.js",
  "live/admin-videos.html",
  "live/live-admin-videos.js",
  "live/live-config.js",
  "live/live.css",
  "deploy/cloudflare/dist/live/watch-video.html",
  "deploy/cloudflare/dist/live/live-watch-video.js",
  "deploy/cloudflare/dist/live/admin-videos.html",
  "deploy/cloudflare/dist/live/live-admin-videos.js",
  "deploy/cloudflare/dist/live/live-config.js",
  "deploy/cloudflare/dist/live/live.css",
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const seeded = { videoIds: [], adIds: [], reportIds: [], storagePaths: [] };

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
  return { status: res.status, data, ok: res.ok };
}

async function edgePost(cfg, name, body, jwt) {
  const res = await fetch(`${cfg.url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${jwt}`,
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

function verifyStatic() {
  console.log("\n=== A. Static code ===\n");
  for (const rel of STATIC_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const watchJs = read("live/live-watch-video.js");
  if (watchJs.includes("live_video_reports") || watchJs.includes("videoReports")) pass("code-report-table");
  else fail("code-report-table");
  if (watchJs.includes("submitVideoReport") && watchJs.includes("data-live-report-form")) pass("code-report-ui");
  else fail("code-report-ui");
  if (watchJs.includes("fetchActiveVideoAds") && watchJs.includes("live-watch-ad")) pass("code-ads-ui");
  else fail("code-ads-ui");

  const adminJs = read("live/live-admin-videos.js");
  if (adminJs.includes("fetchVideoAdminViaEdge") && !adminJs.includes("service_role")) pass("code-admin-edge");
  else fail("code-admin-edge");
}

async function seedData(cfg) {
  const publicId = randomUUID();
  const publicPath = `u_store/${publicId}.mp4`;
  await uploadStorage(cfg, publicPath);
  seeded.storagePaths.push(publicPath);

  const row = {
    id: publicId,
    talk_user_id: "u_store",
    creator_profile_id: "u_store",
    title: "P6 verify public report ads",
    video_path: publicPath,
    duration_sec: 120,
    status: "published",
    visibility: "public",
    published_at: new Date().toISOString(),
  };
  const ins = await rest(cfg, { table: "live_videos", method: "POST", body: row, useService: true });
  if (!ins.ok) throw new Error(`seed video: ${ins.status}`);
  seeded.videoIds.push(publicId);

  const adId = randomUUID();
  const ad = {
    id: adId,
    video_id: publicId,
    ad_type: "manual",
    label: "P6 verify ad slot",
    target_url: "https://example.com/p6-ad",
    is_active: true,
  };
  const adIns = await rest(cfg, { table: "live_video_ads", method: "POST", body: ad, useService: true });
  if (!adIns.ok) throw new Error(`seed ad: ${adIns.status}`);
  seeded.adIds.push(adId);

  return { publicId, adId };
}

async function cleanup(cfg) {
  for (const id of seeded.reportIds) {
    await rest(cfg, { table: "live_video_reports", method: "DELETE", query: `id=eq.${id}`, useService: true });
  }
  for (const id of seeded.adIds) {
    await rest(cfg, { table: "live_video_ads", method: "DELETE", query: `id=eq.${id}`, useService: true });
  }
  for (const id of seeded.videoIds) {
    await rest(cfg, { table: "live_video_likes", method: "DELETE", query: `video_id=eq.${id}`, useService: true });
    await rest(cfg, { table: "live_videos", method: "DELETE", query: `id=eq.${id}`, useService: true });
  }
  for (const p of seeded.storagePaths) {
    await fetch(`${cfg.url}/storage/v1/object/live-videos/${encodeURI(p)}`, {
      method: "DELETE",
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` },
    });
  }
}

async function seedPageAuth(page, jwt, talkUserId = "u_me", role = "") {
  await page.addInitScript(
    ({ token, uid, adminRole }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p6",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p6",
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

async function verifyReportApi(cfg, ids, meJwt) {
  console.log("\n=== B. Report API ===\n");

  const before = await rest(cfg, {
    table: "live_videos",
    query: `select=reports_count&id=eq.${ids.publicId}`,
    jwt: meJwt,
  });
  const beforeCount = Number(before.data?.[0]?.reports_count ?? 0);

  const report = await rest(cfg, {
    table: "live_video_reports",
    method: "POST",
    jwt: meJwt,
    body: {
      video_id: ids.publicId,
      reporter_talk_user_id: "u_me",
      reason: "spam",
      detail: "P6 verify report",
    },
  });
  if (report.status === 201 && report.data?.[0]?.id) {
    pass("report-insert");
    seeded.reportIds.push(report.data[0].id);
  } else {
    fail("report-insert", `status=${report.status}`);
  }

  const after = await rest(cfg, {
    table: "live_videos",
    query: `select=reports_count&id=eq.${ids.publicId}`,
    jwt: meJwt,
  });
  const afterCount = Number(after.data?.[0]?.reports_count ?? 0);
  if (afterCount === beforeCount + 1) pass("report-count-updated");
  else fail("report-count-updated", `${beforeCount} -> ${afterCount}`);

  const ads = await rest(cfg, {
    table: "live_video_ads",
    query: `select=id,label&video_id=eq.${ids.publicId}&is_active=eq.true`,
    jwt: meJwt,
  });
  if (ads.ok && ads.data?.some((a) => a.id === ids.adId)) pass("ads-active-selectable");
  else fail("ads-active-selectable");
}

async function verifyAdminApi(cfg, ids, storeJwt, adminJwt) {
  console.log("\n=== C. Admin API ===\n");

  const nonAdmin = await edgePost(cfg, "live-video-admin", { action: "list" }, storeJwt);
  if (nonAdmin.status === 403) pass("admin-nonadmin-403");
  else fail("admin-nonadmin-403", `status=${nonAdmin.status}`);

  const list = await edgePost(cfg, "live-video-admin", { action: "list", limit: 20, q: "P6 verify" }, adminJwt);
  if (list.status === 200 && list.data?.items?.some((v) => v.id === ids.publicId)) pass("admin-list");
  else fail("admin-list", `status=${list.status}`);

  const hide = await edgePost(cfg, "live-video-admin", { action: "hide", video_id: ids.publicId }, adminJwt);
  if (hide.status === 200 && hide.data?.video?.status === "hidden") pass("admin-hide");
  else fail("admin-hide", `status=${hide.status}`);

  const listAfterHide = await rest(cfg, {
    table: "live_videos",
    query: "select=id&status=eq.published&visibility=eq.public",
    jwt: storeJwt,
  });
  if (listAfterHide.ok && !(listAfterHide.data || []).some((r) => r.id === ids.publicId)) {
    pass("list-hidden-gone");
  } else {
    fail("list-hidden-gone");
  }

  const restore = await edgePost(cfg, "live-video-admin", { action: "restore", video_id: ids.publicId }, adminJwt);
  if (restore.status === 200 && restore.data?.video?.status === "published") pass("admin-restore");
  else fail("admin-restore", `status=${restore.status}`);

  const remove = await edgePost(cfg, "live-video-admin", { action: "remove", video_id: ids.publicId }, adminJwt);
  if (remove.status === 200 && remove.data?.video?.status === "removed") pass("admin-remove");
  else fail("admin-remove", `status=${remove.status}`);

  const restoreForUi = await edgePost(cfg, "live-video-admin", { action: "restore", video_id: ids.publicId }, adminJwt);
  if (restoreForUi.status === 200) pass("admin-restore-for-ui");
  else fail("admin-restore-for-ui");
}

async function verifyUi(ids, meJwt, adminJwt) {
  console.log("\n=== D. UI smoke ===\n");
  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("ui-smoke", "dev server not running");
    return;
  }
  pass("dev-server", base);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await seedPageAuth(page, meJwt, "u_me");
    await page.goto(`${base}/live/watch-video.html?id=${ids.publicId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-watch-article], .live-watch-error", { timeout: 25000 });
    if ((await page.locator("[data-live-report-toggle], [data-live-watch-report]").count()) > 0) {
      pass("ui-report-visible");
    } else {
      fail("ui-report-visible");
    }
    if ((await page.locator("[data-live-watch-ad]").count()) > 0) pass("ui-ad-visible");
    else fail("ui-ad-visible");

    await seedPageAuth(page, meJwt, "u_me");
    await page.goto(`${base}/live/videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-videos-feed], .live-empty", { timeout: 20000 });
    pass("ui-videos-intact");

    await seedPageAuth(page, meJwt, "u_me");
    await page.goto(`${base}/live/my-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-my-videos-list], .live-empty", { timeout: 20000 });
    pass("ui-my-videos-intact");

    await seedPageAuth(page, meJwt, "u_me");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-profile-videos-grid], .live-empty--compact", { timeout: 25000 });
    pass("ui-profile-intact");

    await seedPageAuth(page, adminJwt, "u_admin", "tasu_admin");
    await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-admin-videos-list], .live-empty, .live-watch-error", {
      timeout: 25000,
    });
    if ((await page.locator("[data-live-admin-videos-list]").count()) > 0) pass("ui-admin-list");
    else fail("ui-admin-list");

    await seedPageAuth(page, meJwt, "u_me");
    await page.goto(`${base}/live/admin-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live-watch-error, .live-error, [data-live-admin-videos-list]", {
      timeout: 25000,
    });
    const forbidden = (await page.locator(".live-watch-error, .live-error").count()) > 0;
    if (forbidden) pass("ui-admin-nonadmin-blocked");
    else fail("ui-admin-nonadmin-blocked");
  });
}

async function verifyRegression() {
  if (process.argv.includes("--skip-nested-regression")) {
    skip("nested-regression", "TLV Phase 7 lite");
    return;
  }
  console.log("\n=== E. Regression ===\n");
  for (const [script, args, nodeScript] of [
    ["verify:live-youtube-p2", ["--", "--skip-deploy"], "scripts/verify-live-youtube-p2-edge.mjs"],
    ["verify:live-youtube-p3", [], "scripts/verify-live-youtube-p3-upload.mjs"],
    ["verify:live-youtube-p4", [], "scripts/verify-live-youtube-p4-watch-list.mjs"],
    ["verify:live-youtube-p5", [], "scripts/verify-live-youtube-p5-channel-myvideos.mjs"],
    ["verify:live-p4", ["--", "--skip-deploy"], "scripts/verify-live-p4-short-signed-url.mjs"],
  ]) {
    const r = nodeScript
      ? spawnSync(process.execPath, [nodeScript, ...args.filter((a) => a !== "--")], {
          cwd: ROOT,
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
        })
      : spawnSync("npm", ["run", script, ...args], { cwd: ROOT, encoding: "utf8", shell: true });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass(`regression:${script}`);
    else fail(`regression:${script}`, out.split("\n").slice(-5).join(" | "));
  }
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 6 Admin/Report/Ads ===\n");
  verifyStatic();

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.serviceKey) {
    skip("api-tests", "SUPABASE_SERVICE_ROLE_KEY missing");
  } else {
    let ids;
    try {
      ids = await seedData(cfg);
      pass("seed-data");
      const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      const storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
      const adminJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);
      await verifyReportApi(cfg, ids, meJwt);
      await verifyAdminApi(cfg, ids, storeJwt, adminJwt);
      await verifyUi(ids, meJwt, adminJwt);
    } finally {
      await cleanup(cfg);
      pass("cleanup");
    }
    await verifyRegression();
  }

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
