#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 4 — list / watch UI smoke
 *
 *   npm run verify:live-youtube-p4
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
  "live/videos.html",
  "live/watch-video.html",
  "live/live-videos.js",
  "live/live-watch-video.js",
  "live/live-config.js",
  "live/shorts.html",
  "live/short-upload.html",
  "deploy/cloudflare/dist/live/videos.html",
  "deploy/cloudflare/dist/live/watch-video.html",
  "deploy/cloudflare/dist/live/live-videos.js",
  "deploy/cloudflare/dist/live/live-watch-video.js",
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const seeded = { videoIds: [], storagePaths: [] };

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
  const { table, method = "GET", query = "", body, jwt, useService = false } = opts;
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
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

  const listJs = read("live/live-videos.js");
  if (listJs.includes('eq("visibility", "public")') && listJs.includes("ilike")) pass("code-list-filter");
  else fail("code-list-filter");
  if (listJs.includes("watchVideoUrl") && !listJs.includes("fetchVideoSignedUrlViaEdge")) {
    pass("code-list-no-bulk-signed-url");
  } else fail("code-list-no-bulk-signed-url");

  const watchJs = read("live/live-watch-video.js");
  if (
    watchJs.includes("fetchVideoSignedUrlViaEdge") &&
    (watchJs.includes("recordQualifiedViewEvent") || watchJs.includes("fetchVideoViewViaEdge"))
  ) {
    pass("code-watch-edge");
  } else fail("code-watch-edge");
  if (watchJs.includes("live_refresh_video_like_count")) pass("code-watch-like-rpc");
  else fail("code-watch-like-rpc");

  const indexHtml = read("live/index.html");
  if (indexHtml.includes('href="videos.html"')) pass("code-index-link");
  else fail("code-index-link");
}

async function seedVideos(cfg) {
  const publicId = randomUUID();
  const privateId = randomUUID();
  const publicPath = `u_store/${publicId}.mp4`;
  const privatePath = `u_store/${privateId}.mp4`;

  await uploadStorage(cfg, publicPath);
  await uploadStorage(cfg, privatePath);
  seeded.storagePaths.push(publicPath, privatePath);

  const rows = [
    {
      id: publicId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P4 verify public long",
      description: "phase4 search keyword alpha",
      video_path: publicPath,
      duration_sec: 120,
      status: "published",
      visibility: "public",
      published_at: new Date().toISOString(),
    },
    {
      id: privateId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P4 verify private long",
      video_path: privatePath,
      duration_sec: 120,
      status: "published",
      visibility: "private",
      published_at: new Date().toISOString(),
    },
  ];

  for (const row of rows) {
    const res = await rest(cfg, { table: "live_videos", method: "POST", body: row, useService: true });
    if (!res.ok) throw new Error(`seed ${row.visibility}: ${res.status}`);
    seeded.videoIds.push(row.id);
  }

  return { publicId, privateId };
}

async function cleanup(cfg) {
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

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-youtube-p4",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p4",
              app_metadata: { talk_user_id: uid, member_id: uid },
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
    { token: jwt, uid: talkUserId },
  );
}

async function verifyApi(cfg, ids) {
  console.log("\n=== B. API list / watch / like ===\n");

  const storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
  const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);

  const list = await rest(cfg, {
    table: "live_videos",
    query: 'select=id,title&status=eq.published&visibility=eq.public&order=published_at.desc&limit=10',
    jwt: meJwt,
  });
  const found = (list.data || []).some((r) => r.id === ids.publicId);
  if (list.ok && found) pass("list-public-visible");
  else fail("list-public-visible", `found=${found}`);

  const search = await rest(cfg, {
    table: "live_videos",
    query:
      "select=id&status=eq.published&visibility=eq.public&or=(title.ilike.%25alpha%25,description.ilike.%25alpha%25)",
    jwt: meJwt,
  });
  if (search.ok && search.data?.some((r) => r.id === ids.publicId)) pass("list-search");
  else fail("list-search");

  const signed = await edgePost(cfg, "live-video-signed-url", { video_id: ids.publicId }, meJwt);
  if (signed.status === 200 && signed.data?.video_signed_url) pass("watch-signed-url-200");
  else fail("watch-signed-url-200", `status=${signed.status}`);

  const privateSigned = await edgePost(cfg, "live-video-signed-url", { video_id: ids.privateId }, meJwt);
  if (privateSigned.status === 403) pass("watch-private-other-403");
  else fail("watch-private-other-403", `status=${privateSigned.status}`);

  const before = await rest(cfg, {
    table: "live_videos",
    query: `select=views_count&id=eq.${ids.publicId}`,
    useService: true,
  });
  const beforeViews = Number(before.data?.[0]?.views_count ?? 0);

  const view = await edgePost(cfg, "live-video-view", { video_id: ids.publicId }, meJwt);
  if (view.status === 200 && Number(view.data?.views_count) === beforeViews + 1) {
    pass("watch-view-increment");
  } else {
    fail("watch-view-increment", `status=${view.status}`);
  }

  const like = await rest(cfg, {
    table: "live_video_likes",
    method: "POST",
    jwt: meJwt,
    body: { video_id: ids.publicId, talk_user_id: "u_me" },
  });
  if (like.status === 201) pass("like-insert");
  else fail("like-insert", `status=${like.status}`);

  const unlike = await rest(cfg, {
    table: "live_video_likes",
    method: "DELETE",
    query: `video_id=eq.${ids.publicId}&talk_user_id=eq.u_me`,
    jwt: meJwt,
  });
  if (unlike.status === 204 || unlike.status === 200) pass("like-delete");
  else fail("like-delete", `status=${unlike.status}`);

  const noAuth = await edgePost(cfg, "live-video-signed-url", { video_id: ids.publicId }, cfg.anonKey);
  if (noAuth.status === 401) pass("watch-401-anon");
  else fail("watch-401-anon", `status=${noAuth.status}`);
}

async function verifyUi(ids, meJwt) {
  console.log("\n=== C. UI smoke ===\n");
  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("ui-smoke", "dev server not running");
    return;
  }
  pass("dev-server", base);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await seedPageAuth(page, meJwt);
    await page.goto(`${base}/live/videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-videos-feed], .live-empty, .live-error", { timeout: 20000 });
    const hasFeed = (await page.locator("[data-live-videos-feed], .live-empty").count()) > 0;
    if (hasFeed) pass("ui-videos-mounted");
    else fail("ui-videos-mounted");

    await seedPageAuth(page, meJwt);
    await page.goto(`${base}/live/watch-video.html?id=${ids.publicId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-live-watch-article], .live-watch-error", { timeout: 25000 });
    const hasPlayer = (await page.locator("[data-live-watch-video]").count()) > 0;
    if (hasPlayer) pass("ui-watch-mounted");
    else fail("ui-watch-mounted", "signed URL player not rendered");

    await page.goto(`${base}/live/short-upload.html?talkDev=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-upload-form]", { timeout: 15000 });
    if ((await page.locator("[data-live-upload-form]").count()) > 0) pass("ui-short-upload-intact");
    else fail("ui-short-upload-intact");

    await page.goto(`${base}/live/shorts.html?talkDev=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-shorts-root]", { timeout: 15000 });
    if ((await page.locator("[data-live-shorts-root]").count()) > 0) pass("ui-shorts-intact");
    else fail("ui-shorts-intact");
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");
  for (const [script, args] of [
    ["verify:live-youtube-p2", ["--", "--skip-deploy"]],
    ["verify:live-youtube-p3", []],
    ["verify:live-p4", ["--", "--skip-deploy"]],
  ]) {
    const r = spawnSync("npm", ["run", script, ...args], { cwd: ROOT, encoding: "utf8", shell: true });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass(`regression:${script}`);
    else fail(`regression:${script}`, (r.stderr || r.stdout || "").slice(0, 200));
  }
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 4 List/Watch ===\n");
  verifyStatic();

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.serviceKey) {
    skip("api-tests", "SUPABASE_SERVICE_ROLE_KEY missing");
  } else {
    let ids;
    try {
      ids = await seedVideos(cfg);
      pass("seed-videos", `${seeded.videoIds.length} rows`);
      await verifyApi(cfg, ids);
      const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      await verifyUi(ids, meJwt);
    } finally {
      await cleanup(cfg);
      if (seeded.videoIds.length) pass("cleanup");
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
