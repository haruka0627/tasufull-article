#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 4 — live-short-signed-url Edge + フロント smoke
 *
 *   node scripts/verify-live-p4-short-signed-url.mjs
 *   node scripts/verify-live-p4-short-signed-url.mjs --skip-deploy
 *   npm run verify:live-p4
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl } from "./lib/dev-server-url.mjs";
import {
  ensureTalkJwt,
  loadTalkSupabaseConfig,
  TALK_TEST_USERS,
} from "./lib/talk-rls-test-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "ddojquacsyqesrjhcvmn";
const FUNCTION_NAME = "live-short-signed-url";
const SIGNED_URL_TTL = 300;

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

const skipDeploy = process.argv.includes("--skip-deploy");

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];

/** @type {string[]} */
const seededShortIds = [];

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

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function isSevereConsoleError(text) {
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveShorts\] (edge )?signed URL failed|\[TasuLiveTalkBridge\]|gemini-chat|CORS policy/i.test(
    String(text || "")
  );
}

function verifyStaticCode() {
  console.log("\n=== A. Static code ===\n");

  const edgePath = "supabase/functions/live-short-signed-url/index.ts";
  if (existsSync(path.join(ROOT, edgePath))) pass(`static:${edgePath}`);
  else fail(`static:${edgePath}`, "missing");

  const edge = read(edgePath);
  if (edge.includes('status !== "published"') || edge.includes("short_not_published")) pass("P4-edge-published-only");
  else fail("P4-edge-published-only");

  if (edge.includes("SIGNED_URL_TTL_SEC = 300")) pass("P4-edge-ttl-300");
  else fail("P4-edge-ttl-300");

  if (edge.includes('"short-videos"') || edge.includes("'short-videos'")) pass("P4-edge-bucket");
  else fail("P4-edge-bucket");

  if (edge.includes("Short not found") && edge.includes("404")) pass("P4-edge-404");
  else fail("P4-edge-404");

  const cfg = read("live/live-config.js");
  if (cfg.includes('LIVE_SHORT_SIGNED_URL_FUNCTION = "live-short-signed-url"')) pass("P4-front-function-name");
  else fail("P4-front-function-name");
  if (cfg.includes("fetchShortSignedUrlViaEdge")) pass("P4-front-edge-helper");
  else fail("P4-front-edge-helper");

  const shortsJs = read("live/live-shorts.js");
  if (shortsJs.includes("fetchShortSignedUrlViaEdge")) pass("P4-front-edge-priority");
  else fail("P4-front-edge-priority");
  if (shortsJs.includes("getSignedShortVideoUrl")) pass("P4-front-owner-fallback");
  else fail("P4-front-owner-fallback");
}

async function restFetch(cfg, { table, method = "GET", query = "", body }) {
  const key = cfg.serviceKey;
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

async function edgePost(cfg, body, token) {
  const headers = {
    apikey: cfg.anonKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${cfg.url}/functions/v1/${FUNCTION_NAME}`, {
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

function baseShortRow(id, status, creatorId = "u_store") {
  return {
    id,
    creator_id: creatorId,
    title: `verify-p4-${status}`,
    description: "Phase 4 verify seed",
    storage_path: `${creatorId}/${id}.mp4`,
    duration_sec: 10,
    width: 1080,
    height: 1920,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  };
}

async function uploadDummyObject(cfg, storagePath) {
  const key = cfg.serviceKey;
  const bucket = "short-videos";
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "video/mp4",
      "x-upsert": "true",
    },
    body: new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
  });
  if (res.status >= 300) {
    const text = await res.text();
    throw new Error(`storage upload ${storagePath}: ${res.status} ${text.slice(0, 160)}`);
  }
}

async function deleteStorageObject(cfg, storagePath) {
  const key = cfg.serviceKey;
  const bucket = "short-videos";
  await fetch(`${cfg.url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
}

async function seedVerifyShorts(cfg) {
  const publishedId = randomUUID();
  const draftId = randomUUID();
  const hiddenId = randomUUID();
  const removedId = randomUUID();

  const rows = [
    baseShortRow(publishedId, "published"),
    baseShortRow(draftId, "draft"),
    baseShortRow(hiddenId, "hidden"),
    baseShortRow(removedId, "removed"),
  ];

  for (const row of rows) {
    const res = await restFetch(cfg, { table: "live_shorts", method: "POST", body: row });
    if (res.status >= 300) {
      throw new Error(`seed ${row.status}: ${res.status} ${res.text?.slice(0, 200)}`);
    }
    seededShortIds.push(row.id);
  }

  await uploadDummyObject(cfg, rows[0].storage_path);

  return { publishedId, draftId, hiddenId, removedId, publishedPath: rows[0].storage_path };
}

async function cleanupSeededShorts(cfg, publishedPath = "") {
  if (publishedPath) {
    await deleteStorageObject(cfg, publishedPath);
  }
  for (const id of seededShortIds) {
    await restFetch(cfg, {
      table: "live_shorts",
      method: "DELETE",
      query: `id=eq.${id}`,
    });
  }
}

function deployEdgeFunction() {
  const r = runSupabaseCli([
    "functions",
    "deploy",
    FUNCTION_NAME,
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
    "--use-api",
    "--yes",
  ]);
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout).slice(0, 800));
  }
}

async function verifyEdgeLive(cfg, jwt) {
  console.log("\n=== B. Edge live ===\n");

  if (!cfg.serviceKey) {
    skip("edge-live", "SUPABASE_SERVICE_ROLE_KEY missing");
    return;
  }

  let ids;
  try {
    ids = await seedVerifyShorts(cfg);
    pass("edge-seed", `${seededShortIds.length} rows`);
  } catch (err) {
    fail("edge-seed", err.message || String(err));
    return;
  }

  try {
    const badBody = await edgePost(cfg, {}, jwt);
    if (badBody.status === 400) pass("P4-edge-400-missing-short-id");
    else fail("P4-edge-400-missing-short-id", `status=${badBody.status}`);

    const badUuid = await edgePost(cfg, { short_id: "not-a-uuid" }, jwt);
    if (badUuid.status === 400) pass("P4-edge-400-invalid-uuid");
    else fail("P4-edge-400-invalid-uuid", `status=${badUuid.status}`);

    const missing = await edgePost(cfg, { short_id: randomUUID() }, jwt);
    if (missing.status === 404) pass("P4-edge-404-missing");
    else fail("P4-edge-404-missing", `status=${missing.status}`);

    for (const [label, shortId] of [
      ["draft", ids.draftId],
      ["hidden", ids.hiddenId],
      ["removed", ids.removedId],
    ]) {
      const res = await edgePost(cfg, { short_id: shortId }, jwt);
      if (res.status === 403) pass(`P4-edge-403-${label}`);
      else fail(`P4-edge-403-${label}`, `status=${res.status}`);
    }

    const pub = await edgePost(cfg, { short_id: ids.publishedId }, jwt);
    if (pub.status === 200 && pub.json?.signedUrl) {
      pass("P4-edge-200-published", "signedUrl returned");
    } else {
      fail("P4-edge-200-published", `status=${pub.status} ${pub.text?.slice(0, 120)}`);
    }

    if (Number(pub.json?.expiresIn) === SIGNED_URL_TTL) pass("P4-edge-expires-in-300");
    else fail("P4-edge-expires-in-300", String(pub.json?.expiresIn));
  } finally {
    await cleanupSeededShorts(cfg, ids?.publishedPath || "");
    pass("edge-cleanup", `${seededShortIds.length} rows`);
    seededShortIds.length = 0;
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
            refresh_token: "verify-live-p4",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p4",
              app_metadata: { talk_user_id: uid, member_id: uid },
              user_metadata: { talk_user_id: uid },
            },
          })
        );
        localStorage.setItem(
          "tasu_member_session",
          JSON.stringify({ id: uid, email: "verify@tasful.local", signedInAt: Date.now() })
        );
      } catch {
        /* ignore */
      }
    },
    { token: jwt, uid: talkUserId }
  );
}

async function collectConsoleErrors(page) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && isSevereConsoleError(m.text())) errors.push(m.text());
  };
  const onPageError = (e) => errors.push(e.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  return {
    errors,
    detach() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

async function smokeViewport(page, base, vp, jwt) {
  const probe = await collectConsoleErrors(page);
  try {
    if (jwt) await seedPageAuth(page, jwt);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${base}/live/shorts.html?talkDev=1`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForSelector("[data-live-shorts-root]", { timeout: 15000 });
    await page.waitForTimeout(900);

    const title = await page.locator(".live-header__title").first().textContent();
    if (String(title || "").includes("ショートフィード")) pass(`UI:shorts@${vp.name}`);
    else fail(`UI:shorts@${vp.name}`, title || "no title");

    const mounted = page.locator("[data-live-shorts-feed], .live-empty, .live-error");
    if ((await mounted.count()) > 0) pass(`UI:shorts-mounted@${vp.name}`);
    else fail(`UI:shorts-mounted@${vp.name}`);

    if (probe.errors.length) fail(`console:shorts@${vp.name}`, probe.errors.slice(0, 2).join(" | "));
    else pass(`console:shorts@${vp.name}`, "0 errors");
  } catch (err) {
    fail(`smoke:shorts@${vp.name}`, err.message || String(err));
  } finally {
    probe.detach();
  }
}

function printSummary() {
  console.log("\n--- Summary ---");
  console.log(`  PASS: ${summary.pass}`);
  console.log(`  FAIL: ${summary.fail}`);
  console.log(`  SKIP: ${summary.skip}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log(`\nResult: ${summary.fail > 0 ? "FAIL" : "PASS"}`);
}

async function main() {
  console.log("\n=== TASFUL LIVE Phase 4 short signed URL ===\n");

  verifyStaticCode();

  if (!skipDeploy) {
    try {
      deployEdgeFunction();
      pass("edge-deploy", FUNCTION_NAME);
    } catch (err) {
      skip("edge-deploy", err.message || String(err));
    }
  } else {
    skip("edge-deploy", "--skip-deploy");
  }

  const cfg = loadTalkSupabaseConfig();
  let jwt = "";
  if (cfg.serviceKey) {
    try {
      jwt = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      pass("jwt-setup", TALK_TEST_USERS.u_me.talkUserId);
    } catch (err) {
      skip("jwt-setup", err.message);
    }
  } else {
    skip("jwt-setup", "SUPABASE_SERVICE_ROLE_KEY missing");
  }

  if (jwt) {
    await verifyEdgeLive(cfg, jwt);
  } else {
    skip("edge-live", "no jwt");
  }

  console.log("\n=== C. Viewport smoke ===\n");

  let base = "";
  try {
    base = await findDevServerBaseUrl({ probePath: "live/shorts.html" });
    pass("dev-server", base);
  } catch (err) {
    skip("dev-server", err.message);
    printSummary();
    process.exit(summary.fail > 0 ? 1 : 0);
  }

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    for (const vp of VIEWPORTS) {
      await smokeViewport(page, base, vp, jwt);
    }
  });

  await closeAllBrowsers();
  printSummary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
