#!/usr/bin/env node
/**
 * Business Directory — Production Safe Smoke（cleanup 付き横断 E2E）
 *
 *   node scripts/test-business-directory-production-safe-smoke.mjs           # preflight only
 *   node scripts/test-business-directory-production-safe-smoke.mjs --execute # 本番 API（明示オプトイン）
 *
 * フロー: Owner create → submit → Admin approve → Public 反映 → finally unpublish
 * 表示名 prefix: [BD-SAFE-SMOKE]
 *
 * 禁止（本スクリプト）: Stripe · deploy · secrets ログ · 物理 DELETE
 * 設計: reports/business-directory-production-safe-smoke-design.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadL7Config, loadDotEnv, slotByName, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(root, "reports", "business-directory-production-safe-smoke");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const CATEGORY_SHOP = "a1000001-0001-4000-8000-000000000001";
const TITLE_PREFIX = "[BD-SAFE-SMOKE]";
const CLEANUP_REASON = "bd-safe-smoke cleanup";

const args = new Set(process.argv.slice(2));
const doExecute = args.has("--execute");

let pass = 0;
let fail = 0;
/** @type {{ id: string, slug?: string, role: string, lastStatus?: string, cleanup?: object }[]} */
const tracked = [];
const report = {
  timestamp: new Date().toISOString(),
  mode: doExecute ? "execute" : "preflight",
  titlePrefix: TITLE_PREFIX,
  projectRef: PROJECT_REF,
  checks: [],
  trackedListings: [],
  cleanup: [],
};

function ok(label, detail) {
  pass += 1;
  report.checks.push({ step: label, ok: true, detail });
  console.log(`PASS ${label}${detail ? ` · ${detail}` : ""}`);
}

function bad(label, detail) {
  fail += 1;
  report.checks.push({ step: label, ok: false, detail });
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function track(entry) {
  tracked.push(entry);
  report.trackedListings = tracked.map((t) => ({ ...t }));
}

function writeReport() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  report.pass = pass;
  report.fail = fail;
  report.trackedListings = tracked.map((t) => ({
    id: t.id,
    slug: t.slug,
    role: t.role,
    lastStatus: t.lastStatus,
    cleanup: t.cleanup,
  }));
  const out = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${path.relative(root, out)}`);
}

async function signIn(cfg, email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || `signIn ${res.status}`);
  return { token: data.access_token, userId: data.user?.id || "" };
}

async function ensureUserAppRole(cfg, email, role, slot) {
  const listRes = await fetch(`${cfg.url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  const list = await listRes.json().catch(() => ({}));
  if (!listRes.ok) throw new Error(`admin/users ${listRes.status}`);
  const user = (list.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`allowlist user missing: ${email}`);
  if (String(user.app_metadata?.role || "").toLowerCase() === role) return user.id;
  const appMeta = {
    ...(user.app_metadata || {}),
    talk_user_id: user.app_metadata?.talk_user_id || slot.talkUserId,
    member_id: user.app_metadata?.member_id || slot.memberId,
    role,
    platform_role: user.app_metadata?.platform_role || "member",
  };
  const upd = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "PUT",
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_metadata: appMeta }),
  });
  if (!upd.ok) throw new Error(`set role ${role}: ${upd.status}`);
  return user.id;
}

async function bdPost(anonKey, token, body) {
  const res = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function fetchListingStatus(cfg, listingId) {
  const res = await fetch(
    `${cfg.url}/rest/v1/business_directory_listings?id=eq.${encodeURIComponent(listingId)}&select=id,status,slug,display_name`,
    { headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` } },
  );
  const rows = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(rows) || !rows[0]) return null;
  return rows[0];
}

/**
 * Prefer unpublish for published; reject for review_requested; draft left as-is (not public).
 */
async function cleanupOne(cfg, anonKey, opsToken, entry) {
  const result = {
    id: entry.id,
    slug: entry.slug,
    attempted: [],
    ok: false,
    finalStatus: null,
    error: null,
  };

  try {
    const row = await fetchListingStatus(cfg, entry.id);
    const status = String(row?.status || entry.lastStatus || "");
    result.finalStatus = status || null;

    if (status === "published") {
      result.attempted.push("unpublish_listing");
      const unpub = await bdPost(anonKey, opsToken, {
        action: "unpublish_listing",
        listing_id: entry.id,
        reason: CLEANUP_REASON,
      });
      if (unpub.status === 200 && unpub.data?.listing?.status === "unpublished") {
        result.ok = true;
        result.finalStatus = "unpublished";
      } else {
        result.error = JSON.stringify(unpub.data).slice(0, 200);
      }
    } else if (status === "review_requested") {
      result.attempted.push("reject_listing");
      const rejected = await bdPost(anonKey, opsToken, {
        action: "reject_listing",
        listing_id: entry.id,
        reject_reason_code: "ops_reject",
        reject_reason_note: CLEANUP_REASON,
      });
      if (rejected.status === 200 && rejected.data?.listing?.status === "rejected") {
        result.ok = true;
        result.finalStatus = "rejected";
      } else {
        result.error = JSON.stringify(rejected.data).slice(0, 200);
      }
    } else if (status === "draft" || status === "rejected" || status === "unpublished" || status === "suspended") {
      result.ok = true;
      result.attempted.push("noop_not_public");
      result.finalStatus = status;
    } else if (!status) {
      result.error = "status_unknown";
      result.attempted.push("status_lookup_failed");
    } else {
      result.error = `unsupported_status:${status}`;
      result.attempted.push("manual_required");
    }
  } catch (err) {
    result.error = String(err?.message || err).slice(0, 200);
  }

  entry.cleanup = result;
  entry.lastStatus = result.finalStatus || entry.lastStatus;
  report.cleanup.push(result);

  if (result.ok) ok(`cleanup ${entry.id.slice(0, 8)}…`, result.finalStatus);
  else {
    bad(`cleanup ${entry.id}`, `listing_id=${entry.id} slug=${entry.slug || "?"} err=${result.error || "unknown"}`);
  }
  return result;
}

async function runCleanup(cfg, anonKey, opsToken) {
  console.log("\n--- cleanup (always) ---\n");
  if (!tracked.length) {
    console.log("NOTE: no tracked listings");
    return;
  }
  if (!opsToken) {
    for (const t of tracked) {
      const result = {
        id: t.id,
        slug: t.slug,
        attempted: [],
        ok: false,
        finalStatus: null,
        error: "ops_token_missing — MANUAL CLEANUP REQUIRED",
      };
      t.cleanup = result;
      report.cleanup.push(result);
      bad(`cleanup ${t.id}`, `listing_id=${t.id} MANUAL CLEANUP REQUIRED`);
    }
    return;
  }
  for (const t of tracked) {
    await cleanupOne(cfg, anonKey, opsToken, t);
  }
}

function preflight() {
  loadDotEnv();
  console.log("=== BD Production Safe Smoke — PREFLIGHT (no API writes) ===\n");
  console.log("Design: reports/business-directory-production-safe-smoke-design.md");
  console.log("Cleanup: published→unpublish · review_requested→reject · prefix [BD-SAFE-SMOKE]\n");

  const keys = {
    SUPABASE_URL: !!(process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim()),
    SUPABASE_ANON_KEY: !!(process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim()),
    SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim()),
    AUTH_HOOK_L2_ALLOWLIST_PASSWORD: !!(
      process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD && process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD.trim()
    ),
  };
  report.preflight = { envPresent: keys, executeFlag: false };

  for (const [k, v] of Object.entries(keys)) {
    if (v) ok(`env ${k}`, "present");
    else bad(`env ${k}`, "missing");
  }

  let cfgOk = false;
  try {
    const cfg = loadL7Config();
    const t2 = slotByName("T2");
    const t4 = slotByName("T4");
    cfgOk = !!(cfg.url && cfg.anonKey && cfg.serviceRoleKey && cfg.password && t2?.email && t4?.email);
    if (cfgOk) ok("L7 config + T2/T4 slots", "loadable");
    else bad("L7 config + T2/T4 slots", "incomplete");
  } catch (err) {
    bad("L7 config", String(err?.message || err));
  }

  console.log("\nTo run against production API (human approval required):");
  console.log("  node scripts/test-business-directory-production-safe-smoke.mjs --execute\n");
  console.log("Without --execute, no listings are created.\n");

  writeReport();
  process.exit(fail ? 1 : 0);
}

async function runExecute() {
  console.log("=== BD Production Safe Smoke — EXECUTE ===\n");
  console.log("WARNING: Creates a short-lived published listing, then unpublishes it.\n");

  let cfg;
  try {
    cfg = loadL7Config();
  } catch (err) {
    bad("loadL7Config", String(err?.message || err));
    writeReport();
    process.exit(1);
  }

  const anonKey = cfg.anonKey;
  const ownerSlot = slotByName("T2");
  const opsSlot = slotByName("T4");
  let ownerToken = "";
  let opsToken = "";

  try {
    await ensureUserAppRole(cfg, opsSlot.email, "tasu_admin", opsSlot);
    const owner = await signIn(cfg, ownerSlot.email);
    const ops = await signIn(cfg, opsSlot.email);
    ownerToken = owner.token;
    opsToken = ops.token;
    ok("owner login");
    ok("ops login");
  } catch (err) {
    bad("auth", String(err?.message || err));
    writeReport();
    process.exit(1);
  }

  const stamp = Date.now();
  const displayName = `${TITLE_PREFIX} ${stamp}`;

  try {
    const created = await bdPost(anonKey, ownerToken, {
      action: "create_draft_listing",
      listing_type: "shop_retail",
      category_id: CATEGORY_SHOP,
      display_name: displayName,
      service_areas: ["東京都"],
      company_name: "Safe Smoke Co",
      contact_name: "Safe Smoke Owner",
      contact_email: ownerSlot.email,
      contact_phone: "03-0000-9999",
      prefecture: "東京都",
      city: "渋谷区",
      address_line1: "9-9-9",
      short_description: "Safe smoke temporary listing — will be unpublished",
      terms_accepted: true,
    });
    const listingId = created.data?.listing?.id;
    const slug = created.data?.listing?.slug;
    if (!listingId) {
      bad("create_draft_listing", JSON.stringify(created.data).slice(0, 160));
    } else {
      track({ id: listingId, slug, role: "approve_path", lastStatus: "draft" });
      ok("create_draft_listing", listingId);
    }

    if (listingId) {
      const submit = await bdPost(anonKey, ownerToken, {
        action: "submit_listing_for_review",
        listing_id: listingId,
      });
      if (submit.status === 200 && submit.data?.listing?.status === "review_requested") {
        tracked[0].lastStatus = "review_requested";
        ok("submit_listing_for_review");
      } else {
        bad("submit_listing_for_review", JSON.stringify(submit.data).slice(0, 160));
      }

      const queue = await bdPost(anonKey, opsToken, { action: "get_review_queue", limit: 50 });
      const qItems = queue.data?.queue || queue.data?.listings || queue.data?.items || [];
      const inQueue = qItems.some((item) => {
        const id = item.id || item.listing_id || item.business_directory_listings?.id;
        return id === listingId;
      });
      if (queue.status === 200 && inQueue) ok("get_review_queue contains listing");
      else if (queue.status === 200) bad("get_review_queue", "listing not in queue");
      else bad("get_review_queue", `status ${queue.status}`);

      const approve = await bdPost(anonKey, opsToken, {
        action: "approve_listing",
        listing_id: listingId,
        approve_note: CLEANUP_REASON,
      });
      if (approve.status === 200 && approve.data?.listing?.status === "published") {
        tracked[0].lastStatus = "published";
        ok("approve_listing");
      } else {
        bad("approve_listing", JSON.stringify(approve.data).slice(0, 160));
      }

      // Public actions: Step4 passes anon key as Bearer (same as apikey).
      const pubDetail = await bdPost(anonKey, anonKey, {
        action: "get_public_listing_detail",
        slug,
        listing_type: "shop_retail",
      });
      if (pubDetail.status === 200 && pubDetail.data?.detail?.listing?.status === "published") {
        ok("public detail published");
      } else {
        bad("public detail", JSON.stringify(pubDetail.data).slice(0, 160));
      }

      const list = await bdPost(anonKey, anonKey, {
        action: "get_public_listings",
        listing_type: "shop_retail",
        limit: 50,
      });
      const found = (list.data?.listings || []).some((l) => l.id === listingId);
      if (found) ok("public list contains listing");
      else bad("public list", "approved listing not found");
    }
  } catch (err) {
    bad("flow", String(err?.message || err));
  } finally {
    await runCleanup(cfg, anonKey, opsToken);

    // Post-cleanup public check
    for (const t of tracked) {
      if (!t.slug) continue;
      const pub = await bdPost(anonKey, anonKey, {
        action: "get_public_listing_detail",
        slug: t.slug,
        listing_type: "shop_retail",
      });
      const gone =
        pub.status === 404 ||
        pub.data?.code === "not_found" ||
        pub.data?.detail?.listing?.status !== "published";
      if (gone) ok(`public gone after cleanup ${t.id.slice(0, 8)}…`);
      else bad(`public still visible ${t.id}`, `listing_id=${t.id} slug=${t.slug}`);
    }
  }

  writeReport();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (tracked.some((t) => t.cleanup && !t.cleanup.ok)) {
    console.error("\nMANUAL CLEANUP REQUIRED — listing_ids:");
    for (const t of tracked) {
      if (t.cleanup && !t.cleanup.ok) console.error(`  ${t.id} slug=${t.slug || "?"}`);
    }
  }
  process.exit(fail ? 1 : 0);
}

async function main() {
  if (!doExecute) {
    preflight();
    return;
  }
  await runExecute();
}

main().catch((err) => {
  console.error(err);
  // Best-effort: still write report with tracked ids
  report.fatal = String(err?.message || err);
  writeReport();
  process.exit(1);
});
