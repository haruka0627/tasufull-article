#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 5 — channel grid / my videos
 *
 *   npm run verify:live-youtube-p5
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
  "live/profile.html",
  "live/live-profile.js",
  "live/my-videos.html",
  "live/live-my-videos.js",
  "live/live-videos.js",
  "live/live-config.js",
  "live/live.css",
  "deploy/cloudflare/dist/live/profile.html",
  "deploy/cloudflare/dist/live/live-profile.js",
  "deploy/cloudflare/dist/live/my-videos.html",
  "deploy/cloudflare/dist/live/live-my-videos.js",
  "deploy/cloudflare/dist/live/live-videos.js",
  "deploy/cloudflare/dist/live/live-config.js",
  "deploy/cloudflare/dist/live/live.css",
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

  const profileJs = read("live/live-profile.js");
  if (profileJs.includes("mountProfileVideosSection") && profileJs.includes("TasuLiveVideos")) {
    pass("code-profile-videos");
  } else fail("code-profile-videos");

  const myJs = read("live/live-my-videos.js");
  if (myJs.includes('status = "hidden"') && myJs.includes('status = "removed"') && !myJs.includes("live-video-admin")) {
    pass("code-my-videos-rls");
  } else fail("code-my-videos-rls");

  const videosJs = read("live/live-videos.js");
  if (videosJs.includes("fetchCreatorChannelVideos") && videosJs.includes("renderProfileVideosSection")) {
    pass("code-channel-grid");
  } else fail("code-channel-grid");

  const indexHtml = read("live/index.html");
  if (indexHtml.includes('href="my-videos.html"')) pass("code-index-my-videos");
  else fail("code-index-my-videos");

  const uploadJs = read("live/live-video-upload.js");
  if (uploadJs.includes("myVideosUrl")) pass("code-upload-my-videos-link");
  else fail("code-upload-my-videos-link");
}

async function seedVideos(cfg) {
  const publicId = randomUUID();
  const hiddenId = randomUUID();
  const privateId = randomUUID();
  const publicPath = `u_store/${publicId}.mp4`;
  const hiddenPath = `u_store/${hiddenId}.mp4`;
  const privatePath = `u_store/${privateId}.mp4`;

  for (const p of [publicPath, hiddenPath, privatePath]) {
    await uploadStorage(cfg, p);
    seeded.storagePaths.push(p);
  }

  const rows = [
    {
      id: publicId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P5 verify public channel",
      video_path: publicPath,
      duration_sec: 120,
      status: "published",
      visibility: "public",
      published_at: new Date().toISOString(),
    },
    {
      id: hiddenId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P5 verify hidden channel",
      video_path: hiddenPath,
      duration_sec: 120,
      status: "hidden",
      visibility: "public",
      published_at: new Date().toISOString(),
    },
    {
      id: privateId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P5 verify private channel",
      video_path: privatePath,
      duration_sec: 120,
      status: "published",
      visibility: "private",
      published_at: new Date().toISOString(),
    },
  ];

  for (const row of rows) {
    const res = await rest(cfg, { table: "live_videos", method: "POST", body: row, useService: true });
    if (!res.ok) throw new Error(`seed ${row.title}: ${res.status}`);
    seeded.videoIds.push(row.id);
  }

  return { publicId, hiddenId, privateId };
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
            refresh_token: "verify-live-youtube-p5",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-youtube-p5",
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

async function verifyApiReadOnly(cfg, ids) {
  console.log("\n=== B. Channel read-only API ===\n");

  const storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
  const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);

  const otherChannel = await rest(cfg, {
    table: "live_videos",
    query:
      "select=id,status,visibility&talk_user_id=eq.u_store&status=eq.published&visibility=eq.public",
    jwt: meJwt,
  });
  const otherIds = (otherChannel.data || []).map((r) => r.id);
  if (otherChannel.ok && otherIds.includes(ids.publicId) && !otherIds.includes(ids.hiddenId)) {
    pass("profile-other-public-only");
  } else {
    fail("profile-other-public-only", `ids=${otherIds.join(",")}`);
  }

  const ownChannel = await rest(cfg, {
    table: "live_videos",
    query: "select=id,status&talk_user_id=eq.u_store&status=neq.removed",
    jwt: storeJwt,
  });
  const ownIds = (ownChannel.data || []).map((r) => r.id);
  if (ownChannel.ok && ownIds.includes(ids.publicId) && ownIds.includes(ids.hiddenId)) {
    pass("profile-own-includes-hidden");
  } else {
    fail("profile-own-includes-hidden");
  }

  return { storeJwt, meJwt };
}

async function verifyApiMutations(cfg, ids) {
  console.log("\n=== B2. My videos mutations ===\n");

  const storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
  const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);

  const hide = await rest(cfg, {
    table: "live_videos",
    method: "PATCH",
    query: `id=eq.${ids.publicId}&talk_user_id=eq.u_store`,
    jwt: storeJwt,
    body: { status: "hidden" },
  });
  if (hide.ok && hide.data?.[0]?.status === "hidden") pass("my-videos-hide");
  else fail("my-videos-hide", `status=${hide.status}`);

  const listAfterHide = await rest(cfg, {
    table: "live_videos",
    query: "select=id&status=eq.published&visibility=eq.public",
    jwt: meJwt,
  });
  const listIds = (listAfterHide.data || []).map((r) => r.id);
  if (listAfterHide.ok && !listIds.includes(ids.publicId)) pass("list-hidden-removed");
  else fail("list-hidden-removed");

  const restore = await rest(cfg, {
    table: "live_videos",
    method: "PATCH",
    query: `id=eq.${ids.publicId}`,
    jwt: storeJwt,
    body: { status: "published", published_at: new Date().toISOString() },
  });
  if (restore.ok && restore.data?.[0]?.status === "published") pass("my-videos-restore");
  else fail("my-videos-restore");

  const remove = await rest(cfg, {
    table: "live_videos",
    method: "PATCH",
    query: `id=eq.${ids.publicId}`,
    jwt: storeJwt,
    body: { status: "removed" },
  });
  if (remove.ok && remove.data?.[0]?.status === "removed") pass("my-videos-remove");
  else fail("my-videos-remove");

  const listAfterRemove = await rest(cfg, {
    table: "live_videos",
    query: "select=id&status=eq.published&visibility=eq.public",
    jwt: meJwt,
  });
  if (listAfterRemove.ok && !(listAfterRemove.data || []).some((r) => r.id === ids.publicId)) {
    pass("list-removed-gone");
  } else {
    fail("list-removed-gone");
  }

  const otherUpdate = await rest(cfg, {
    table: "live_videos",
    method: "PATCH",
    query: `id=eq.${ids.hiddenId}`,
    jwt: meJwt,
    body: { status: "removed" },
    prefer: "return=representation",
  });
  const blocked =
    otherUpdate.status === 403 ||
    otherUpdate.status === 401 ||
    (otherUpdate.ok && (!otherUpdate.data || otherUpdate.data.length === 0));
  if (blocked) pass("other-cannot-update");
  else fail("other-cannot-update", `status=${otherUpdate.status} rows=${otherUpdate.data?.length}`);
}

async function verifyUi(ids, storeJwt, meJwt) {
  console.log("\n=== C. UI smoke ===\n");
  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("ui-smoke", "dev server not running");
    return;
  }
  pass("dev-server", base);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await seedPageAuth(page, meJwt, "u_me");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-profile-videos-grid], .live-empty--compact, .live-muted, .live-error", {
      timeout: 25000,
    });
    const grid = page.locator(`[data-live-video-id="${ids.publicId}"]`);
    const hiddenCard = page.locator(`[data-live-video-id="${ids.hiddenId}"]`);
    if ((await grid.count()) > 0) pass("ui-profile-other-public-card");
    else fail("ui-profile-other-public-card");
    if ((await hiddenCard.count()) === 0) pass("ui-profile-other-no-hidden");
    else fail("ui-profile-other-no-hidden");

    const href = await grid.first().getAttribute("href");
    if (href && href.includes("watch-video.html") && href.includes(ids.publicId)) {
      pass("ui-profile-watch-link");
    } else {
      fail("ui-profile-watch-link", href || "no href");
    }

    await seedPageAuth(page, storeJwt, "u_store");
    await page.goto(`${base}/live/profile.html?userId=u_store`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-profile-videos-grid]", { timeout: 25000 });
    if ((await page.locator(`[data-live-video-id="${ids.hiddenId}"]`).count()) > 0) {
      pass("ui-profile-own-hidden-badge");
    } else {
      fail("ui-profile-own-hidden-badge");
    }

    await page.goto(`${base}/live/my-videos.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-my-videos-list], .live-empty", { timeout: 25000 });
    if ((await page.locator("[data-live-my-videos-list]").count()) > 0) pass("ui-my-videos-mounted");
    else fail("ui-my-videos-mounted");

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
    ["verify:live-youtube-p4", []],
    ["verify:live-p4", ["--", "--skip-deploy"]],
  ]) {
    const r = spawnSync("npm", ["run", script, ...args], { cwd: ROOT, encoding: "utf8", shell: true });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    if (/Result:\s*PASS/.test(out) && (r.status ?? 1) === 0) pass(`regression:${script}`);
    else fail(`regression:${script}`, (r.stderr || r.stdout || "").slice(0, 200));
  }
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 5 Channel/MyVideos ===\n");
  verifyStatic();

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.serviceKey) {
    skip("api-tests", "SUPABASE_SERVICE_ROLE_KEY missing");
  } else {
    let ids;
    try {
      ids = await seedVideos(cfg);
      pass("seed-videos", `${seeded.videoIds.length} rows`);
      const { storeJwt, meJwt } = await verifyApiReadOnly(cfg, ids);
      await verifyUi(ids, storeJwt, meJwt);
      await verifyApiMutations(cfg, ids);
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
