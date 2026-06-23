#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 3 — long-form video upload smoke
 *
 *   node scripts/verify-live-youtube-p3-upload.mjs
 *   npm run verify:live-youtube-p3
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
  "live/video-upload.html",
  "live/live-video-upload.js",
  "live/live-config.js",
  "live/short-upload.html",
  "live/live-short-upload.js",
  "deploy/cloudflare/dist/live/video-upload.html",
  "deploy/cloudflare/dist/live/live-video-upload.js",
  "deploy/cloudflare/dist/live/live-config.js",
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

async function rest(cfg, { table, method = "GET", query = "", body, jwt, useService = false }) {
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

async function uploadStorage(cfg, bucket, storagePath, bytes, contentType) {
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (res.status >= 300) {
    const text = await res.text();
    throw new Error(`storage ${bucket}/${storagePath}: ${res.status} ${text.slice(0, 160)}`);
  }
}

async function uploadStorageAsUser(cfg, jwt, bucket, storagePath, bytes, contentType) {
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  return { status: res.status, text: await res.text() };
}

function verifyStaticCode() {
  console.log("\n=== A. Static code ===\n");

  for (const rel of STATIC_FILES) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const cfg = read("live/live-config.js");
  if (cfg.includes('VIDEO_BUCKET = "live-videos"')) pass("code-video-bucket");
  else fail("code-video-bucket");
  if (cfg.includes("VIDEO_MIN_DURATION_SEC = 61")) pass("code-min-duration-61");
  else fail("code-min-duration-61");
  if (cfg.includes('videos: "live_videos"')) pass("code-table-videos");
  else fail("code-table-videos");
  if (cfg.includes("probeLongVideoFileMeta")) pass("code-probe-long-video");
  else fail("code-probe-long-video");
  if (cfg.includes('STORAGE_BUCKET_SHORT_VIDEOS = "short-videos"')) pass("code-short-unchanged");
  else fail("code-short-unchanged");

  const uploadJs = read("live/live-video-upload.js");
  if (uploadJs.includes("hasBroadcastPermission") && uploadJs.includes("fetchCreatorProfile")) {
    pass("code-permission-gate");
  } else fail("code-permission-gate");
  if (uploadJs.includes("probeLongVideoFileMeta") && uploadJs.includes("LIVE_SHORT_MAX_DURATION_SEC")) {
    pass("code-duration-gt-60");
  } else fail("code-duration-gt-60");
  if (uploadJs.includes('status: "published"') && uploadJs.includes("watchVideoUrl")) pass("code-publish-flow");
  else fail("code-publish-flow");
  if (uploadJs.includes("removeUploadedObjects")) pass("code-cleanup-on-fail");
  else fail("code-cleanup-on-fail");

  const shortJs = read("live/live-short-upload.js");
  if (shortJs.includes("LIVE_SHORT_MAX_DURATION_SEC") && shortJs.includes("mountUploadPage")) {
    pass("code-short-upload-intact");
  } else fail("code-short-upload-intact");
}

async function verifyApiUpload(cfg) {
  console.log("\n=== B. API upload flow ===\n");

  const storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
  const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);

  const meProfile = await rest(cfg, {
    table: "live_creator_profiles",
    query: "select=user_id&user_id=eq.u_me",
    jwt: meJwt,
  });
  if (Array.isArray(meProfile.data) && meProfile.data.length === 0) pass("gate-u_me-no-profile");
  else fail("gate-u_me-no-profile", JSON.stringify(meProfile.data)?.slice(0, 80));

  const meInsert = await rest(cfg, {
    table: "live_videos",
    method: "POST",
    jwt: meJwt,
    body: {
      talk_user_id: "u_me",
      title: "blocked",
      video_path: "u_me/blocked.mp4",
      duration_sec: 120,
      status: "published",
      visibility: "public",
    },
  });
  if (meInsert.status === 403) pass("gate-u_me-insert-denied");
  else fail("gate-u_me-insert-denied", `status=${meInsert.status}`);

  const shortDur = await rest(cfg, {
    table: "live_videos",
    method: "POST",
    useService: true,
    body: {
      talk_user_id: "u_store",
      title: "too short",
      video_path: "u_store/short.mp4",
      duration_sec: 45,
      status: "published",
      visibility: "public",
    },
  });
  if (shortDur.status === 400) pass("validate-duration-60-rejected");
  else fail("validate-duration-60-rejected", `status=${shortDur.status}`);

  const emptyTitle = await rest(cfg, {
    table: "live_videos",
    method: "POST",
    useService: true,
    body: {
      talk_user_id: "u_store",
      title: "",
      video_path: "u_store/empty.mp4",
      duration_sec: 120,
      status: "published",
      visibility: "public",
    },
  });
  if (emptyTitle.status === 400) pass("validate-empty-title-rejected");
  else fail("validate-empty-title-rejected", `status=${emptyTitle.status}`);

  const videoId = randomUUID();
  const videoPath = `u_store/${videoId}.mp4`;
  const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);

  const storageDenied = await uploadStorageAsUser(cfg, meJwt, "live-videos", `u_me/${videoId}.mp4`, mp4Bytes, "video/mp4");
  if (storageDenied.status === 403 || storageDenied.status === 400) pass("gate-u_me-storage-denied");
  else fail("gate-u_me-storage-denied", `status=${storageDenied.status}`);

  const storageOk = await uploadStorageAsUser(cfg, storeJwt, "live-videos", videoPath, mp4Bytes, "video/mp4");
  if (storageOk.status < 300) pass("u_store-storage-upload");
  else fail("u_store-storage-upload", `status=${storageOk.status} ${storageOk.text.slice(0, 120)}`);

  seeded.storagePaths.push({ bucket: "live-videos", path: videoPath });

  const insertOk = await rest(cfg, {
    table: "live_videos",
    method: "POST",
    jwt: storeJwt,
    body: {
      id: videoId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P3 verify long video",
      video_path: videoPath,
      duration_sec: 120,
      file_size_bytes: mp4Bytes.length,
      mime_type: "video/mp4",
      status: "published",
      visibility: "public",
      published_at: new Date().toISOString(),
    },
  });
  if (insertOk.status === 201 && insertOk.data?.[0]?.id) {
    pass("u_store-insert-ok", insertOk.data[0].id);
    seeded.videoIds.push(videoId);
  } else {
    fail("u_store-insert-ok", `status=${insertOk.status} ${JSON.stringify(insertOk.data)?.slice(0, 120)}`);
  }

  const rowCheck = await rest(cfg, {
    table: "live_videos",
    query: `select=id,video_path,status,visibility,duration_sec&id=eq.${videoId}`,
    useService: true,
  });
  if (rowCheck.data?.[0]?.duration_sec === 120 && rowCheck.data?.[0]?.status === "published") {
    pass("db-row-verified");
  } else {
    fail("db-row-verified", JSON.stringify(rowCheck.data)?.slice(0, 120));
  }
}

async function verifyUiSmoke() {
  console.log("\n=== C. UI smoke ===\n");

  const base = await findDevServerBaseUrl();
  if (!base) {
    skip("ui-smoke", "dev server not running");
    return;
  }
  pass("dev-server", base);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${base}/live/video-upload.html?talkDev=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-video-upload-form], .live-error", { timeout: 15000 });

    const hasForm = await page.locator("[data-live-video-upload-form]").count();
    const hasLoginError = await page.locator(".live-error").count();
    if (hasForm > 0 || hasLoginError > 0) pass("ui-video-upload-mounted");
    else fail("ui-video-upload-mounted");

    await page.goto(`${base}/live/short-upload.html?talkDev=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-live-upload-form]", { timeout: 15000 });
    if ((await page.locator("[data-live-upload-form]").count()) > 0) pass("ui-short-upload-intact");
    else fail("ui-short-upload-intact");

    const severe = errors.filter(
      (t) => !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]/i.test(t),
    );
    if (!severe.length) pass("ui-console-clean");
    else fail("ui-console-clean", severe.slice(0, 2).join(" | "));
  });
}

async function verifyRegression() {
  console.log("\n=== D. Regression ===\n");

  for (const [script, args] of [
    ["verify:live-youtube-p2", ["--", "--skip-deploy"]],
    ["verify:live-p4", ["--", "--skip-deploy"]],
    ["verify:live-p3", []],
  ]) {
    const r = spawnSync("npm", ["run", script, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
    });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    const ok = /Result:\s*PASS/.test(out) && (r.status ?? 1) === 0;
    if (ok) pass(`regression:${script}`);
    else fail(`regression:${script}`, (r.stderr || r.stdout || "").slice(0, 200));
  }
}

async function cleanup(cfg) {
  for (const id of seeded.videoIds) {
    await rest(cfg, { table: "live_videos", method: "DELETE", query: `id=eq.${id}`, useService: true });
  }
  for (const item of seeded.storagePaths) {
    await fetch(`${cfg.url}/storage/v1/object/${item.bucket}/${encodeURI(item.path)}`, {
      method: "DELETE",
      headers: {
        apikey: cfg.serviceKey,
        Authorization: `Bearer ${cfg.serviceKey}`,
      },
    });
  }
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 3 Upload ===\n");

  verifyStaticCode();

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.serviceKey) {
    skip("api-upload", "SUPABASE_SERVICE_ROLE_KEY missing");
  } else {
    try {
      await verifyApiUpload(cfg);
    } finally {
      await cleanup(cfg);
      if (seeded.videoIds.length) pass("cleanup", `${seeded.videoIds.length} videos`);
    }
  }

  try {
    await verifyUiSmoke();
    if (cfg.serviceKey) await verifyRegression();
  } finally {
    await closeAllBrowsers();
  }

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
