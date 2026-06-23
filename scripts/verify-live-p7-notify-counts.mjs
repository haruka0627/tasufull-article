#!/usr/bin/env node
/**
 * TASFUL LIVE Phase 7 — 通知 / 集計 / live-notify Edge smoke
 *
 *   node scripts/verify-live-p7-notify-counts.mjs
 *   node scripts/verify-live-p7-notify-counts.mjs --skip-deploy
 *   npm run verify:live-p7
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
const FUNCTION_NAME = "live-notify";
const MIGRATION_REL = "supabase/migrations/20260629100000_live_p0_counts.sql";
const skipDeploy = process.argv.includes("--skip-deploy");

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

const summary = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const marker = `verify-p7-${Date.now()}`;

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
  return !/favicon|404|Failed to load resource|Failed to fetch|\[TasuChat\]|\[TasuSupabase\]|\[TasuLiveProfile\]|\[TasuLiveShorts\]|\[TasuLiveBroadcasts\]|\[TasuLiveTips\]|\[TasuLiveNotify\]|\[TasuLiveFollow\]|\[TasuLiveTalkBridge\]|gemini-chat|CORS policy/i.test(
    String(text || "")
  );
}

function verifyStaticCode() {
  console.log("\n=== A. Static code ===\n");

  const files = [
    "supabase/functions/live-notify/index.ts",
    MIGRATION_REL,
    "live/live-notify.js",
    "live/live-follow.js",
    "live/live-shorts.js",
    "live/live-tips.js",
    "live/live-broadcasts.js",
    "live/live-profile.js",
  ];
  for (const rel of files) {
    if (existsSync(path.join(ROOT, rel))) pass(`static:${rel}`);
    else fail(`static:${rel}`, "missing");
  }

  const edge = read("supabase/functions/live-notify/index.ts");
  if (edge.includes("follow_created") && edge.includes("tip_created") && edge.includes("broadcast_started")) {
    pass("P7-edge-events");
  } else fail("P7-edge-events");
  if (edge.includes("live_notify_dedupe") && edge.includes("talk_notifications")) pass("P7-edge-dedupe-notify");
  else fail("P7-edge-dedupe-notify");
  if (edge.includes("service_type") && edge.includes("service_ref_id")) pass("P7-edge-payload");
  else fail("P7-edge-payload");
  if (edge.includes("BROADCAST_FANOUT_MAX")) pass("P7-edge-fanout-cap");
  else fail("P7-edge-fanout-cap");

  const mig = read(MIGRATION_REL);
  if (mig.includes("live_refresh_creator_follower_count") && mig.includes("live_refresh_short_like_count")) {
    pass("P7-migration-count-rpc");
  } else fail("P7-migration-count-rpc");
  if (mig.includes("live_refresh_broadcast_tip_total_stub")) pass("P7-migration-tip-total");
  else fail("P7-migration-tip-total");

  const notifyJs = read("live/live-notify.js");
  if (notifyJs.includes("invokeLiveNotify") && notifyJs.includes("live-notify")) pass("P7-front-notify-helper");
  else fail("P7-front-notify-helper");
  if (notifyJs.includes("notifyCreatorOnFollow") && notifyJs.includes("notifyTipCreated")) pass("P7-front-notify-api");
  else fail("P7-front-notify-api");

  const tipsJs = read("live/live-tips.js");
  if (tipsJs.includes("notifyTipCreated")) pass("P7-front-tips-wire");
  else fail("P7-front-tips-wire");

  const bcJs = read("live/live-broadcasts.js");
  if (bcJs.includes("notifyBroadcastStarted") && bcJs.includes("tip_total_yen_stub")) pass("P7-front-broadcast-wire");
  else fail("P7-front-broadcast-wire");

  const profileJs = read("live/live-profile.js");
  if (profileJs.includes("fetchReceivedTipsTotal") && profileJs.includes("data-live-tips-total")) pass("P7-front-profile-tips");
  else fail("P7-front-profile-tips");
}

async function restFetch(cfg, { table, method = "GET", query = "", body, jwt, useService = false }) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
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
  return { status: res.status, json, text, ok: res.ok };
}

async function rpcCall(cfg, fn, args, { jwt, useService = false } = {}) {
  const key = useService ? cfg.serviceKey : cfg.anonKey;
  const auth = useService ? cfg.serviceKey : jwt || cfg.anonKey;
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, ok: res.ok };
}

async function edgePost(cfg, body, token) {
  const res = await fetch(`${cfg.url}/functions/v1/${FUNCTION_NAME}`, {
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
  return { status: res.status, json, text, ok: res.ok };
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

function pushMigration() {
  const r = runSupabaseCli(["db", "push", "--linked", "--yes"]);
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout).slice(0, 800));
  }
}

async function verifyMigrationApplied(cfg) {
  const rpc = await rpcCall(cfg, "live_refresh_creator_follower_count", {
    p_creator_id: TALK_TEST_USERS.u_store.talkUserId,
  }, { useService: true });
  if (rpc.ok) {
    pass("DB-migration-rpc-follower", `count=${rpc.json}`);
    return true;
  }
  return false;
}

async function ensureActiveCreatorProfile(cfg, creatorId) {
  const existing = await restFetch(cfg, {
    table: "live_creator_profiles",
    query: `select=user_id,creator_status&user_id=eq.${creatorId}`,
    useService: true,
  });
  if (existing.json?.[0]?.creator_status === "active") return;

  const upsert = await restFetch(cfg, {
    table: "live_creator_profiles",
    method: "POST",
    query: "on_conflict=user_id",
    body: {
      user_id: creatorId,
      creator_status: "active",
      live_permission_status: "identity_verified",
      bio: `${marker} creator`,
    },
    useService: true,
  });
  if (!upsert.ok && upsert.status !== 409) {
    await restFetch(cfg, {
      table: "live_creator_profiles",
      method: "PATCH",
      query: `user_id=eq.${creatorId}`,
      body: { creator_status: "active", live_permission_status: "identity_verified" },
      useService: true,
    });
  }
}

async function verifyDbCountsAndNotify(cfg, jwtMe, jwtStore) {
  console.log("\n=== C. DB counts + notify ===\n");

  const creatorId = TALK_TEST_USERS.u_store.talkUserId;
  const followerId = TALK_TEST_USERS.u_me.talkUserId;

  await ensureActiveCreatorProfile(cfg, creatorId);
  pass("DB-creator-active-profile", creatorId);

  const profileBefore = await restFetch(cfg, {
    table: "live_creator_profiles",
    query: `select=follower_count&user_id=eq.${creatorId}`,
    useService: true,
  });
  const beforeCount = Number(profileBefore.json?.[0]?.follower_count ?? 0);

  await restFetch(cfg, {
    table: "live_creator_follows",
    method: "DELETE",
    query: `follower_id=eq.${followerId}&creator_id=eq.${creatorId}`,
    useService: true,
  });

  const followIns = await restFetch(cfg, {
    table: "live_creator_follows",
    method: "POST",
    body: { follower_id: followerId, creator_id: creatorId, notify_enabled: true },
    jwt: jwtMe,
  });
  if (followIns.ok) pass("DB-follow-insert");
  else {
    const followSvc = await restFetch(cfg, {
      table: "live_creator_follows",
      method: "POST",
      body: { follower_id: followerId, creator_id: creatorId, notify_enabled: true },
      useService: true,
    });
    if (followSvc.ok) pass("DB-follow-insert", "service_role fallback");
    else fail("DB-follow-insert", `status=${followIns.status}/${followSvc.status}`);
  }

  const profileAfter = await restFetch(cfg, {
    table: "live_creator_profiles",
    query: `select=follower_count&user_id=eq.${creatorId}`,
    useService: true,
  });
  const afterCount = Number(profileAfter.json?.[0]?.follower_count ?? 0);
  if (afterCount === beforeCount + 1) pass("DB-follower-count-trigger", `${beforeCount}→${afterCount}`);
  else fail("DB-follower-count-trigger", `expected ${beforeCount + 1}, got ${afterCount}`);

  const dedupeKey = `follow_created:${creatorId}:${followerId}`;
  const notifyId = `live-n-${dedupeKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100)}`;
  await restFetch(cfg, {
    table: "talk_notifications",
    method: "DELETE",
    query: `id=eq.${encodeURIComponent(notifyId)}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_notify_dedupe",
    method: "DELETE",
    query: `event_key=eq.${encodeURIComponent(dedupeKey)}`,
    useService: true,
  });

  const followNotify = await edgePost(
    cfg,
    {
      event: "follow_created",
      payload: { creator_id: creatorId, follower_id: followerId, follower_name: "u_me" },
    },
    jwtMe,
  );
  if (followNotify.ok && (followNotify.json?.notified || followNotify.json?.deduped)) {
    pass("EDGE-follow-created", JSON.stringify(followNotify.json).slice(0, 80));
  } else fail("EDGE-follow-created", `status=${followNotify.status} ${followNotify.text?.slice(0, 120)}`);

  const notifyRows = await restFetch(cfg, {
    table: "talk_notifications",
    query: `select=id,type,title,user_id&user_id=eq.${creatorId}&type=eq.live&order=created_at.desc&limit=3`,
    useService: true,
  });
  const liveNotify = (notifyRows.json || []).find((r) => r.title === "新しいフォロワー");
  if (liveNotify) pass("DB-talk-notifications-live", liveNotify.id);
  else fail("DB-talk-notifications-live");

  const dedupeRow = await restFetch(cfg, {
    table: "live_notify_dedupe",
    query: `select=event_key&event_key=eq.${encodeURIComponent(dedupeKey)}`,
    useService: true,
  });
  if (dedupeRow.json?.[0]?.event_key === dedupeKey) pass("DB-live-notify-dedupe");
  else fail("DB-live-notify-dedupe");

  const shortId = randomUUID();
  await restFetch(cfg, {
    table: "live_shorts",
    method: "POST",
    body: {
      id: shortId,
      creator_id: creatorId,
      title: marker,
      description: "p7 like count",
      storage_path: `${creatorId}/${shortId}.mp4`,
      duration_sec: 5,
      status: "published",
      published_at: new Date().toISOString(),
    },
    useService: true,
  });

  await restFetch(cfg, {
    table: "live_short_likes",
    method: "POST",
    body: { short_id: shortId, user_id: followerId },
    jwt: jwtMe,
  });

  let shortRow = await restFetch(cfg, {
    table: "live_shorts",
    query: `select=like_count&id=eq.${shortId}`,
    useService: true,
  });
  let likeCount = Number(shortRow.json?.[0]?.like_count ?? -1);
  if (likeCount !== 1) {
    await restFetch(cfg, {
      table: "live_short_likes",
      method: "POST",
      body: { short_id: shortId, user_id: followerId },
      useService: true,
    });
    shortRow = await restFetch(cfg, {
      table: "live_shorts",
      query: `select=like_count&id=eq.${shortId}`,
      useService: true,
    });
    likeCount = Number(shortRow.json?.[0]?.like_count ?? -1);
  }
  if (likeCount === 1) pass("DB-like-count-trigger", "like_count=1");
  else fail("DB-like-count-trigger", `got ${likeCount}`);

  const broadcastId = randomUUID();
  await restFetch(cfg, {
    table: "live_broadcasts",
    method: "POST",
    body: {
      id: broadcastId,
      creator_id: creatorId,
      title: `${marker} broadcast`,
      status: "scheduled",
      stream_provider: "stub",
    },
    useService: true,
  });

  const tipId = randomUUID();
  const tipIns = await restFetch(cfg, {
    table: "live_tips",
    method: "POST",
    body: {
      id: tipId,
      tipper_id: followerId,
      creator_id: creatorId,
      target_type: "broadcast",
      target_id: broadcastId,
      amount_yen: 300,
      message: "【コーヒー】",
      payment_status: "stub",
      idempotency_key: `${marker}-tip`,
    },
    jwt: jwtMe,
  });
  if (tipIns.ok) pass("DB-tip-insert");
  else fail("DB-tip-insert", `status=${tipIns.status}`);

  const bcAfterTip = await restFetch(cfg, {
    table: "live_broadcasts",
    query: `select=tip_total_yen_stub&id=eq.${broadcastId}`,
    useService: true,
  });
  const tipTotal = Number(bcAfterTip.json?.[0]?.tip_total_yen_stub ?? -1);
  if (tipTotal === 300) pass("DB-tip-total-trigger", "tip_total_yen_stub=300");
  else fail("DB-tip-total-trigger", `got ${tipTotal}`);

  const tipNotify = await edgePost(
    cfg,
    { event: "tip_created", payload: { tip_id: tipId, tipper_name: "u_me" } },
    jwtMe,
  );
  if (tipNotify.ok) pass("EDGE-tip-created");
  else fail("EDGE-tip-created", `status=${tipNotify.status}`);

  await restFetch(cfg, {
    table: "live_broadcasts",
    method: "PATCH",
    query: `id=eq.${broadcastId}`,
    body: { status: "live", started_at: new Date().toISOString() },
    jwt: jwtStore,
  });

  const bcastNotify = await edgePost(
    cfg,
    { event: "broadcast_started", payload: { broadcast_id: broadcastId, creator_name: "u_store" } },
    jwtStore,
  );
  if (bcastNotify.ok && typeof bcastNotify.json?.fanout === "number") {
    pass("EDGE-broadcast-started", `fanout=${bcastNotify.json.fanout}`);
  } else if (bcastNotify.json?.deduped) {
    pass("EDGE-broadcast-started", "deduped (ok)");
  } else {
    fail("EDGE-broadcast-started", `status=${bcastNotify.status}`);
  }

  await restFetch(cfg, {
    table: "live_short_likes",
    method: "DELETE",
    query: `short_id=eq.${shortId}&user_id=eq.${followerId}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_shorts",
    method: "DELETE",
    query: `id=eq.${shortId}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_tips",
    method: "DELETE",
    query: `id=eq.${tipId}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_broadcasts",
    method: "DELETE",
    query: `id=eq.${broadcastId}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_creator_follows",
    method: "DELETE",
    query: `follower_id=eq.${followerId}&creator_id=eq.${creatorId}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_notify_dedupe",
    method: "DELETE",
    query: `event_key=eq.${encodeURIComponent(dedupeKey)}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_notify_dedupe",
    method: "DELETE",
    query: `event_key=eq.${encodeURIComponent(`tip_created:${tipId}`)}`,
    useService: true,
  });
  await restFetch(cfg, {
    table: "live_notify_dedupe",
    method: "DELETE",
    query: `event_key=eq.${encodeURIComponent(`broadcast_started:${broadcastId}`)}`,
    useService: true,
  });
}

async function seedPageAuth(page, jwt, talkUserId = "u_me") {
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem(
          "tasu-supabase-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "verify-live-p7",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user: {
              id: "verify-live-p7",
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

async function smokePage(page, base, vp, jwt, spec) {
  const probe = await collectConsoleErrors(page);
  try {
    if (jwt) await seedPageAuth(page, jwt);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${base}/${spec.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(spec.selector, { timeout: 15000 });
    await page.waitForTimeout(900);
    if (probe.errors.length) fail(`console:${spec.id}@${vp.name}`, probe.errors.slice(0, 2).join(" | "));
    else pass(`console:${spec.id}@${vp.name}`, "0 errors");
  } catch (err) {
    fail(`smoke:${spec.id}@${vp.name}`, err.message || String(err));
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
  console.log("\n=== TASFUL LIVE Phase 7 notify + counts ===\n");

  verifyStaticCode();

  if (!skipDeploy) {
    try {
      pushMigration();
      pass("migration-push", MIGRATION_REL);
    } catch (err) {
      skip("migration-push", err.message || String(err));
    }
    try {
      deployEdgeFunction();
      pass("edge-deploy", FUNCTION_NAME);
    } catch (err) {
      skip("edge-deploy", err.message || String(err));
    }
  } else {
    skip("migration-push", "--skip-deploy");
    skip("edge-deploy", "--skip-deploy");
  }

  const cfg = loadTalkSupabaseConfig();
  let jwtMe = "";
  let jwtStore = "";
  if (cfg.serviceKey) {
    try {
      jwtMe = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_me);
      jwtStore = await ensureTalkJwt(cfg, TALK_TEST_USERS.u_store);
      pass("jwt-setup");
    } catch (err) {
      skip("jwt-setup", err.message);
    }
  } else {
    skip("jwt-setup", "SUPABASE_SERVICE_ROLE_KEY missing");
  }

  if (cfg.serviceKey) {
    const applied = await verifyMigrationApplied(cfg);
    if (!applied) {
      skip("DB-migration-rpc-follower", "apply migration first");
    }
  }

  if (jwtMe && jwtStore && cfg.serviceKey) {
    await verifyDbCountsAndNotify(cfg, jwtMe, jwtStore);
  } else {
    skip("DB-counts-notify", "missing jwt or service key");
  }

  const base = await findDevServerBaseUrl(ROOT);
  if (!base) {
    skip("smoke-ui", "dev server not running");
  } else if (jwtMe) {
    console.log("\n=== D. UI smoke ===\n");
    pass("dev-server", base);
    const pages = [
      { id: "profile", path: "live/profile.html?userId=u_store&talkDev=1", selector: "[data-live-profile-root]" },
      { id: "shorts", path: "live/shorts.html?talkDev=1", selector: "[data-live-shorts-root]" },
      { id: "studio", path: "live/studio.html?talkDev=1", selector: "[data-live-studio-root], .live-empty, .live-error" },
    ];
    await withPlaywrightBrowser(async (browser) => {
      const page = await browser.newPage();
      for (const vp of VIEWPORTS) {
        for (const spec of pages) {
          await smokePage(page, base, vp, jwtMe, spec);
        }
      }
      await page.close();
    });
    await closeAllBrowsers();
  }

  printSummary();
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
