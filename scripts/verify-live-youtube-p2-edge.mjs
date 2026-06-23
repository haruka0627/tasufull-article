#!/usr/bin/env node
/**
 * TASFUL LIVE YouTube P1 Phase 2 — long-form video Edge smoke
 *
 *   node scripts/verify-live-youtube-p2-edge.mjs
 *   node scripts/verify-live-youtube-p2-edge.mjs --skip-deploy
 *   npm run verify:live-youtube-p2
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureTalkJwt,
  loadTalkSupabaseConfig,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";
const FUNCTIONS = ["live-video-signed-url", "live-video-view", "live-video-admin"];
const skipDeploy = process.argv.includes("--skip-deploy");

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const seededVideoIds = [];

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

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
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

async function edgePost(cfg, functionName, body, jwt) {
  const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: jwt ? `Bearer ${jwt}` : undefined,
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

function deployFunctions() {
  for (const name of FUNCTIONS) {
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
    if (r.status !== 0) {
      throw new Error(`deploy ${name}: ${(r.stderr || r.stdout).slice(0, 800)}`);
    }
    pass(`deploy:${name}`);
  }
}

async function uploadDummyObject(cfg, storagePath, bucket = "live-videos") {
  const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": "video/mp4",
      "x-upsert": "true",
    },
    body: bytes,
  });
  const text = await res.text();
  if (res.status >= 300) {
    throw new Error(`storage upload ${storagePath}: ${res.status} ${text.slice(0, 160)}`);
  }
}

async function deleteStorageObject(cfg, storagePath, bucket = "live-videos") {
  await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: "DELETE",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
    },
  });
}

async function seedVideos(cfg) {
  const publicId = randomUUID();
  const privateId = randomUUID();
  const draftId = randomUUID();
  const removedId = randomUUID();

  const rows = [
    {
      id: publicId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P2 public long video",
      video_path: `u_store/${publicId}.mp4`,
      duration_sec: 120,
      status: "published",
      visibility: "public",
      published_at: new Date().toISOString(),
    },
    {
      id: privateId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P2 private long video",
      video_path: `u_store/${privateId}.mp4`,
      duration_sec: 120,
      status: "published",
      visibility: "private",
      published_at: new Date().toISOString(),
    },
    {
      id: draftId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P2 draft long video",
      video_path: `u_store/${draftId}.mp4`,
      duration_sec: 120,
      status: "draft",
      visibility: "public",
    },
    {
      id: removedId,
      talk_user_id: "u_store",
      creator_profile_id: "u_store",
      title: "P2 removed long video",
      video_path: `u_store/${removedId}.mp4`,
      duration_sec: 120,
      status: "removed",
      visibility: "public",
    },
  ];

  for (const row of rows) {
    const res = await rest(cfg, { table: "live_videos", method: "POST", body: row, useService: true });
    if (!res.ok) throw new Error(`seed ${row.status}/${row.visibility}: ${res.status}`);
    seededVideoIds.push(row.id);
  }

  await uploadDummyObject(cfg, `u_store/${publicId}.mp4`);
  await uploadDummyObject(cfg, `u_store/${privateId}.mp4`);

  return { publicId, privateId, draftId, removedId, publicPath: `u_store/${publicId}.mp4`, privatePath: `u_store/${privateId}.mp4` };
}

async function cleanupVideos(cfg, paths = []) {
  for (const p of paths) {
    if (p) await deleteStorageObject(cfg, p);
  }
  for (const id of seededVideoIds) {
    await rest(cfg, {
      table: "live_videos",
      method: "DELETE",
      query: `id=eq.${id}`,
      useService: true,
    });
  }
}

async function verifySignedUrl(cfg, ids, storeJwt, meJwt) {
  console.log("\n=== B. live-video-signed-url ===\n");

  const noAuth = await edgePost(cfg, "live-video-signed-url", { video_id: ids.publicId });
  if (noAuth.status === 401) pass("signed-url-401-no-auth");
  else fail("signed-url-401-no-auth", `status=${noAuth.status}`);

  const anonOnly = await edgePost(cfg, "live-video-signed-url", { video_id: ids.publicId }, cfg.anonKey);
  if (anonOnly.status === 401) pass("signed-url-401-anon-key");
  else fail("signed-url-401-anon-key", `status=${anonOnly.status}`);

  const publicOk = await edgePost(cfg, "live-video-signed-url", { video_id: ids.publicId }, meJwt);
  if (publicOk.status === 200 && publicOk.data?.video_signed_url) {
    pass("signed-url-200-public-login", `expires_in=${publicOk.data.expires_in}`);
  } else {
    fail("signed-url-200-public-login", `status=${publicOk.status} ${JSON.stringify(publicOk.data)?.slice(0, 120)}`);
  }

  const ownerPrivate = await edgePost(cfg, "live-video-signed-url", { video_id: ids.privateId }, storeJwt);
  if (ownerPrivate.status === 200 && ownerPrivate.data?.video_signed_url) pass("signed-url-200-private-owner");
  else fail("signed-url-200-private-owner", `status=${ownerPrivate.status}`);

  const otherPrivate = await edgePost(cfg, "live-video-signed-url", { video_id: ids.privateId }, meJwt);
  if (otherPrivate.status === 403) pass("signed-url-403-private-other");
  else fail("signed-url-403-private-other", `status=${otherPrivate.status}`);

  const removedOther = await edgePost(cfg, "live-video-signed-url", { video_id: ids.removedId }, meJwt);
  if (removedOther.status === 404 || removedOther.status === 403) {
    pass("signed-url-removed-other", `status=${removedOther.status}`);
  } else fail("signed-url-removed-other", `status=${removedOther.status}`);
}

async function verifyView(cfg, ids, meJwt) {
  console.log("\n=== C. live-video-view ===\n");

  const before = await rest(cfg, {
    table: "live_videos",
    query: `select=views_count&id=eq.${ids.publicId}`,
    useService: true,
  });
  const beforeCount = Number(before.data?.[0]?.views_count ?? 0);

  const inc = await edgePost(cfg, "live-video-view", { video_id: ids.publicId }, meJwt);
  if (inc.status === 200 && Number(inc.data?.views_count) === beforeCount + 1) {
    pass("view-increment-published", `views_count=${inc.data.views_count}`);
  } else {
    fail("view-increment-published", `status=${inc.status} body=${JSON.stringify(inc.data)?.slice(0, 120)}`);
  }

  const draft = await edgePost(cfg, "live-video-view", { video_id: ids.draftId }, meJwt);
  if (draft.status === 403) pass("view-403-draft");
  else fail("view-403-draft", `status=${draft.status}`);
}

async function verifyAdmin(cfg, ids, storeJwt, adminJwt) {
  console.log("\n=== D. live-video-admin ===\n");

  const nonAdmin = await edgePost(cfg, "live-video-admin", { action: "list" }, storeJwt);
  if (nonAdmin.status === 403) pass("admin-403-non-admin");
  else fail("admin-403-non-admin", `status=${nonAdmin.status}`);

  const list = await edgePost(cfg, "live-video-admin", { action: "list", limit: 5 }, adminJwt);
  if (list.status === 200 && Array.isArray(list.data?.items)) {
    pass("admin-list-200", `count=${list.data.count}`);
  } else {
    fail("admin-list-200", `status=${list.status}`);
  }

  const hide = await edgePost(cfg, "live-video-admin", { action: "hide", video_id: ids.publicId }, adminJwt);
  if (hide.status === 200 && hide.data?.video?.status === "hidden") pass("admin-hide-200");
  else fail("admin-hide-200", `status=${hide.status}`);

  const restore = await edgePost(cfg, "live-video-admin", { action: "restore", video_id: ids.publicId }, adminJwt);
  if (restore.status === 200 && restore.data?.video?.status === "published") pass("admin-restore-200");
  else fail("admin-restore-200", `status=${restore.status}`);

  const remove = await edgePost(cfg, "live-video-admin", { action: "remove", video_id: ids.draftId }, adminJwt);
  if (remove.status === 200 && remove.data?.video?.status === "removed") pass("admin-remove-200");
  else fail("admin-remove-200", `status=${remove.status}`);
}

async function verifyRegression() {
  console.log("\n=== E. Regression ===\n");

  for (const [script, args] of [
    ["verify:live-p0-schema", []],
    ["verify:live-p4", ["--", "--skip-deploy"]],
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

  const cfg = loadTalkSupabaseConfig();
  const jwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
  const notify = await edgePost(
    cfg,
    "live-notify",
    { event: "follow_created", payload: { follower_id: "u_me", creator_id: "u_store" } },
    jwt,
  );
  if (notify.status === 200 || notify.status === 409) pass("regression:live-notify");
  else fail("regression:live-notify", `status=${notify.status}`);
}

async function main() {
  console.log("\n=== TASFUL LIVE YouTube P1 Phase 2 Edge ===\n");

  const cfg = loadTalkSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    fail("config", "SUPABASE_URL/ANON missing");
    process.exit(1);
  }
  if (!cfg.serviceKey) {
    skip("all-live", "SUPABASE_SERVICE_ROLE_KEY missing");
    process.exit(0);
  }

  console.log("\n=== A. Deploy ===\n");
  if (skipDeploy) skip("edge-deploy", "--skip-deploy");
  else {
    try {
      deployFunctions();
    } catch (err) {
      fail("edge-deploy", err.message || String(err));
      process.exit(1);
    }
  }

  const storeJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
  const meJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
  const adminJwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_admin);

  let ids;
  try {
    ids = await seedVideos(cfg);
    pass("seed-videos", `${seededVideoIds.length} rows`);
  } catch (err) {
    fail("seed-videos", err.message || String(err));
    process.exit(1);
  }

  try {
    await verifySignedUrl(cfg, ids, storeJwt, meJwt);
    await verifyView(cfg, ids, meJwt);
    await verifyAdmin(cfg, ids, storeJwt, adminJwt);
    await verifyRegression();
  } finally {
    await cleanupVideos(cfg, [ids.publicPath, ids.privatePath]);
    pass("cleanup-videos", `${seededVideoIds.length} rows`);
  }

  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  console.log(`\nResult: ${summary.fail ? "FAIL" : "PASS"}\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(summary.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
