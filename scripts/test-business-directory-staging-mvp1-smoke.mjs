#!/usr/bin/env node
/**
 * Business Directory Staging MVP-1 smoke (Staging ref only)
 *   node scripts/test-business-directory-staging-mvp1-smoke.mjs
 *   node scripts/test-business-directory-staging-mvp1-smoke.mjs --skip-stripe
 *
 * Requires: .env.staging · supabase link = Staging ref
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadStagingDotEnv,
  getStagingRef,
  getProductionRef,
  getLinkedProjectRef,
  checkStagingNotProductionLinked,
} from "./lib/supabase-env.mjs";
import { ALLOWLIST_SLOTS } from "./lib/auth-hook-l7-slots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = getStagingRef();
const PROD_REF = getProductionRef();
const skipStripe = process.argv.includes("--skip-stripe");
const CATEGORY_SHOP = "a1000001-0001-4000-8000-000000000001";
const FUNCTIONS_BASE = `https://${STAGING_REF}.supabase.co/functions/v1`;

let pass = 0;
let fail = 0;
let note = 0;
let cfg = null;

function ok(label) {
  pass += 1;
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function nlabel(label) {
  note += 1;
  console.log(`NOTE: ${label}`);
}

function loadStagingConfig() {
  if (!loadStagingDotEnv()) {
    throw new Error(".env.staging missing — run: node scripts/lib/create-env-staging.mjs");
  }
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const password = process.env.AUTH_HOOK_L2_ALLOWLIST_PASSWORD || "";
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
  if (ref !== STAGING_REF) {
    throw new Error(`SUPABASE_URL ref ${ref || "?"} !== Staging ${STAGING_REF}`);
  }
  if (!anonKey || !serviceRoleKey || !password) {
    throw new Error("SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / AUTH_HOOK_L2_ALLOWLIST_PASSWORD required in .env.staging");
  }
  return { url, anonKey, serviceRoleKey, password };
}

async function bdPost(token, body) {
  const res = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function signIn(email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || `signIn ${res.status}`);
  return { token: data.access_token, user: data.user || {} };
}

async function ensureUser(email, role, slot) {
  const listRes = await fetch(`${cfg.url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  const list = await listRes.json().catch(() => ({}));
  let user = (list.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
  if (!user) {
    const create = await fetch(`${cfg.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: cfg.password,
        email_confirm: true,
        app_metadata: {
          talk_user_id: slot.talkUserId,
          member_id: slot.memberId,
          role,
          platform_role: "member",
        },
      }),
    });
    const created = await create.json().catch(() => ({}));
    if (!create.ok) throw new Error(`create user ${email}: ${JSON.stringify(created).slice(0, 120)}`);
    user = created;
    ok(`created Staging user ${email}`);
  } else {
    const upd = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PUT",
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_metadata: {
          ...(user.app_metadata || {}),
          talk_user_id: slot.talkUserId,
          member_id: slot.memberId,
          role,
          platform_role: user.app_metadata?.platform_role || "member",
        },
      }),
    });
    if (!upd.ok) throw new Error(`update user ${email}: ${upd.status}`);
    ok(`ensured Staging user ${email} role=${role}`);
  }
  return user.id;
}

const PHASE2 = {
  short_description: "Staging MVP1 smoke short",
  full_description: "Staging MVP1 smoke full body",
  seo_title: "Staging SEO Title",
  meta_description: "Staging meta description smoke",
  faq_items: [{ q: "Staging Q1", a: "Staging A1" }],
  recommended_uses: ["Staging audience"],
};

async function main() {
  console.log("=== Business Directory Staging MVP-1 smoke ===\n");
  console.log(`Staging ref: ${STAGING_REF} · Production guard: ${PROD_REF}\n`);

  const guard = checkStagingNotProductionLinked();
  if (!guard.ok) bad("staging link guard", guard.message);
  else ok(`staging link guard — ${guard.message}`);

  const linked = getLinkedProjectRef();
  if (linked === PROD_REF) {
    bad("CLI link", "Production ref linked — abort");
    process.exit(1);
  }
  if (linked === STAGING_REF) ok(`CLI link ${linked}`);
  else nlabel(`CLI link ${linked || "unset"} — remote SQL uses --linked`);

  cfg = loadStagingConfig();
  ok(".env.staging loaded");

  const ownerSlot = ALLOWLIST_SLOTS.find((s) => s.slot === "T2");
  const opsSlot = ALLOWLIST_SLOTS.find((s) => s.slot === "T4");
  await ensureUser(ownerSlot.email, "member", ownerSlot);
  await ensureUser(opsSlot.email, "tasu_admin", opsSlot);

  const owner = await signIn(ownerSlot.email);
  const ops = await signIn(opsSlot.email);
  ok("owner sign-in");
  ok("ops sign-in");

  const health = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "health" }),
  });
  const healthJson = await health.json().catch(() => ({}));
  if (health.ok && healthJson.ok !== false) ok("Edge health");
  else bad("Edge health", JSON.stringify(healthJson).slice(0, 100));

  const aiGen = await bdPost(owner.token, {
    action: "generate_listing_draft",
    listing_type: "shop_retail",
    display_name: `Staging AI ${Date.now()}`,
    company_name: "Staging AI Co",
    prefecture: "東京都",
    city: "渋谷区",
    service_areas: ["東京都"],
    shop_sales_genre: "地元野菜",
    category_id: CATEGORY_SHOP,
  });
  if (aiGen.status === 200 && aiGen.data?.draft?.short_description) ok("AI generate_listing_draft + quota RPC");
  else bad("AI generate_listing_draft", JSON.stringify(aiGen.data).slice(0, 160));

  const created = await bdPost(owner.token, {
    action: "create_draft_listing",
    listing_type: "shop_retail",
    category_id: CATEGORY_SHOP,
    display_name: `Staging Free ${Date.now()}`,
    service_areas: ["東京都"],
    company_name: "Staging Free Co",
    contact_name: "Owner",
    contact_email: ownerSlot.email,
    contact_phone: "03-0000-0099",
    prefecture: "東京都",
    city: "渋谷区",
    address_line1: "1-2-3",
    short_description: PHASE2.short_description,
    terms_accepted: true,
  });
  const freeId = created.data?.listing?.id;
  const freeSlug = created.data?.listing?.slug;
  if (freeId) ok(`create_draft_listing ${freeId.slice(0, 8)}…`);
  else bad("create_draft_listing");

  if (freeId) {
    const upd = await bdPost(owner.token, { action: "update_draft_listing", listing_id: freeId, ...PHASE2 });
    if (upd.status === 200) ok("update_draft_listing Phase2");
    else bad("update_draft_listing Phase2", JSON.stringify(upd.data).slice(0, 120));

    const detail = await bdPost(owner.token, { action: "get_owner_listing_detail", listing_id: freeId });
    const profile = detail.data?.detail?.profile;
    if (detail.status === 200 && profile?.seo_title === PHASE2.seo_title) ok("get_owner_listing_detail (pending_updates path)");
    else bad("owner detail", JSON.stringify(detail.data).slice(0, 120));

    await bdPost(owner.token, { action: "submit_listing_for_review", listing_id: freeId });
    const approve = await bdPost(ops.token, {
      action: "approve_listing",
      listing_id: freeId,
      approve_note: "Staging MVP1 smoke",
    });
    if (approve.status === 200 && approve.data?.listing?.status === "published") ok("approve initial publish");
    else bad("approve initial", JSON.stringify(approve.data).slice(0, 120));

    const pubFree = await bdPost(cfg.anonKey, {
      action: "get_public_listing_detail",
      slug: freeSlug,
      listing_type: "shop_retail",
    });
    if (pubFree.status === 200 && pubFree.data?.detail?.profile?.seo_title) ok("public API Phase2");
    else bad("public API", JSON.stringify(pubFree.data).slice(0, 120));

    const pendingUpdate = await bdPost(owner.token, {
      action: "update_draft_listing",
      listing_id: freeId,
      full_description: "Staging content_update full body",
      faq_items: [{ q: "Updated Q", a: "Updated A" }],
    });
    if (pendingUpdate.status === 200) ok("published update_draft_listing → pending_updates");
    else bad("published update", JSON.stringify(pendingUpdate.data).slice(0, 120));

    await bdPost(owner.token, {
      action: "submit_listing_for_review",
      listing_id: freeId,
      request_type: "content_update",
    });
    ok("submit content_update");

    const pubMid = await bdPost(cfg.anonKey, {
      action: "get_public_listing_detail",
      slug: freeSlug,
      listing_type: "shop_retail",
    });
    const midFull = pubMid.data?.detail?.profile?.full_description;
    if (midFull === PHASE2.full_description) ok("content_update pending — live unchanged");
    else bad("live during review", String(midFull).slice(0, 80));

    const approve2 = await bdPost(ops.token, {
      action: "approve_listing",
      listing_id: freeId,
      approve_note: "Staging content_update approve",
    });
    if (approve2.status === 200) ok("approve content_update");
    else bad("approve content_update", JSON.stringify(approve2.data).slice(0, 120));

    const pubAfter = await bdPost(cfg.anonKey, {
      action: "get_public_listing_detail",
      slug: freeSlug,
      listing_type: "shop_retail",
    });
    const afterFull = pubAfter.data?.detail?.profile?.full_description;
    if (afterFull === "Staging content_update full body") ok("content_update live updated");
    else bad("content_update live", String(afterFull).slice(0, 80));
  }

  if (skipStripe) nlabel("stripe skipped");

  console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
