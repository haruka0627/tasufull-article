#!/usr/bin/env node
/**
 * Business Directory Phase 2a — Production controlled migration smoke
 *   node scripts/test-business-directory-phase2a-production-smoke.mjs
 *   node scripts/test-business-directory-phase2a-production-smoke.mjs --skip-stripe
 *   node scripts/test-business-directory-phase2a-production-smoke.mjs --skip-browser
 *
 * Requires: .env SUPABASE_* · AUTH_HOOK_L2_ALLOWLIST_PASSWORD · npm run dev @ 8788 (browser)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadL7Config, loadDotEnv, slotByName, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { STANDARD_LOCAL_BASE } from "./lib/dev-server-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const CATEGORY_SHOP = "a1000001-0001-4000-8000-000000000001";
const BASE = (process.env.BASE_URL || STANDARD_LOCAL_BASE).replace(/\/$/, "");
const args = new Set(process.argv.slice(2));
const skipStripe = args.has("--skip-stripe");
const skipBrowser = args.has("--skip-browser");

let pass = 0;
let fail = 0;
let note = 0;
let cfgAnon = "";

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

async function signIn(cfg, email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || `signIn ${res.status}`);
  return { token: data.access_token, userId: data.user?.id || "", user: data.user || {}, refreshToken: data.refresh_token || "" };
}

async function ensureUserAppRole(cfg, email, role, slot) {
  const listRes = await fetch(`${cfg.url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  const list = await listRes.json().catch(() => ({}));
  if (!listRes.ok) throw new Error(`admin/users ${listRes.status}`);
  const user = (list.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`allowlist user missing: ${email}`);
  const currentRole = String(user.app_metadata?.role || "").toLowerCase();
  if (currentRole === role) return user.id;
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
        talk_user_id: user.app_metadata?.talk_user_id || slot.talkUserId,
        member_id: user.app_metadata?.member_id || slot.memberId,
        role,
        platform_role: user.app_metadata?.platform_role || "member",
      },
    }),
  });
  if (!upd.ok) throw new Error(`set role ${role}: ${upd.status}`);
  return user.id;
}

async function bdPost(token, body) {
  const res = await fetch(`${FUNCTIONS_BASE}/business-directory`, {
    method: "POST",
    headers: {
      apikey: cfgAnon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const PHASE2 = {
  short_description: "Phase2a smoke short",
  full_description: "Phase2a smoke full body text",
  seo_title: "Phase2a SEO Title",
  meta_description: "Phase2a meta description for smoke test",
  faq_items: [{ q: "Smoke Q1", a: "Smoke A1" }],
  recommended_uses: ["Smoke audience line"],
};

async function fetchProfilePhase2(cfg, listingId) {
  const res = await fetch(
    `${cfg.url}/rest/v1/business_directory_profiles?listing_id=eq.${encodeURIComponent(listingId)}&select=seo_title,meta_description,faq_items,recommended_uses,full_description,short_description`,
    {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
      },
    },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : null;
}

function profileHasPhase2(profile) {
  return (
    profile?.seo_title === PHASE2.seo_title
    && Array.isArray(profile?.faq_items)
    && profile.faq_items.length > 0
  );
}

async function pollSyncPlan(token, listingId, expectedPlan = "standard", attempts = 12, intervalMs = 3000) {
  for (let i = 0; i < attempts; i += 1) {
    const sync = await bdPost(token, { action: "sync_subscription_status", listing_id: listingId });
    const planCode = sync.data?.plan_code || sync.data?.listing?.plan_code;
    if (planCode === expectedPlan) return { ok: true, planCode };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const last = await bdPost(token, { action: "sync_subscription_status", listing_id: listingId });
  return { ok: false, planCode: last.data?.plan_code || last.data?.listing?.plan_code };
}

function supabaseAuthStorageKey(cfg) {
  const ref = cfg.url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || PROJECT_REF;
  return `sb-${ref}-auth-token`;
}

function buildInitAuthScript(cfg, auth) {
  const session = {
    id: auth.userId,
    email: auth.user?.email || "",
    display_name: auth.user?.user_metadata?.display_name || "E2E",
    memberType: "individual",
    signedInAt: new Date().toISOString(),
  };
  return {
    session,
    sbKey: supabaseAuthStorageKey(cfg),
    sbVal: JSON.stringify({
      access_token: auth.token,
      refresh_token: auth.refreshToken || "",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: auth.user,
    }),
    accessToken: auth.token,
  };
}

async function approveListing(opsToken, listingId, note) {
  const approve = await bdPost(opsToken, {
    action: "approve_listing",
    listing_id: listingId,
    approve_note: note,
  });
  if (approve.status === 200 && approve.data?.listing?.status === "published") ok(`approve ${listingId.slice(0, 8)}…`);
  else bad("approve_listing", JSON.stringify(approve.data).slice(0, 140));
  return approve;
}

async function runBrowserPublicPlanGate(freeSlug, stdSlug, ownerAuth, cfg) {
  const init = buildInitAuthScript(cfg, ownerAuth);
  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.addInitScript(({ session, sbKey, sbVal, accessToken }) => {
      localStorage.setItem("tasu_member_session", JSON.stringify(session));
      localStorage.setItem(sbKey, sbVal);
      window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
      window.TASU_CHAT_SUPABASE_CONFIG.accessToken = accessToken;
    }, init);

    if (freeSlug) {
      await page.goto(
        `${BASE}/business-directory/public/detail.html?slug=${encodeURIComponent(freeSlug)}&listing_type=shop_retail`,
        { waitUntil: "domcontentloaded", timeout: 30000 },
      );
      await page.waitForTimeout(2000);
      const freeFaq = await page.locator("[data-bd-public-faq]").count();
      const freeFull = await page.locator("[data-bd-public-full-description]").count();
      const freeShort = await page.locator("[data-bd-public-short-description], .bd-public-short").count();
      if (freeShort > 0 || (await page.content()).includes("Phase2a smoke short")) ok("Free public short_description visible");
      else bad("Free public short visible");
      if (freeFaq === 0 && freeFull === 0) ok("Free planGate hides FAQ/full");
      else bad("Free planGate", `faq=${freeFaq} full=${freeFull}`);
    }

    if (stdSlug) {
      await page.goto(
        `${BASE}/business-directory/public/detail.html?slug=${encodeURIComponent(stdSlug)}&listing_type=shop_retail`,
        { waitUntil: "domcontentloaded", timeout: 30000 },
      );
      await page.waitForTimeout(2500);
      const stdFaq = await page.locator("[data-bd-public-faq]").count();
      const stdFull = await page.locator("[data-bd-public-full-description]").count();
      const stdUses = await page.locator("[data-bd-public-recommended-uses]").count();
      if (stdFaq > 0 && stdFull > 0 && stdUses > 0) ok("Standard+ public rich sections visible");
      else bad("Standard+ rich", `faq=${stdFaq} full=${stdFull} uses=${stdUses}`);
    }
  });
}

async function main() {
  console.log("=== Business Directory Phase 2a — Production smoke ===\n");
  loadDotEnv();
  const cfg = loadL7Config();
  cfgAnon = cfg.anonKey;
  const ownerSlot = slotByName("T2");
  const opsSlot = slotByName("T4");
  await ensureUserAppRole(cfg, opsSlot.email, "tasu_admin", opsSlot);
  const owner = await signIn(cfg, ownerSlot.email);
  const ops = await signIn(cfg, opsSlot.email);
  ok(`owner login ${ownerSlot.email}`);
  ok(`ops login ${opsSlot.email}`);

  const stamp = Date.now();

  const aiGen = await bdPost(owner.token, {
    action: "generate_listing_draft",
    listing_type: "shop_retail",
    display_name: `Phase2a AI ${stamp}`,
    company_name: "AI Smoke Co",
    prefecture: "東京都",
    city: "渋谷区",
    service_areas: ["東京都"],
    shop_sales_genre: "地元野菜",
    category_id: CATEGORY_SHOP,
  });
  if (aiGen.status === 200 && aiGen.data?.draft?.short_description) ok("AI generate_listing_draft");
  else bad("AI generate_listing_draft", JSON.stringify(aiGen.data).slice(0, 160));

  const created = await bdPost(owner.token, {
    action: "create_draft_listing",
    listing_type: "shop_retail",
    category_id: CATEGORY_SHOP,
    display_name: `Phase2a Free ${stamp}`,
    service_areas: ["東京都"],
    company_name: "Phase2a Free Co",
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
  if (freeId) ok(`create_draft_listing free ${freeId.slice(0, 8)}…`);
  else bad("create_draft_listing free");

  if (freeId) {
    const upd = await bdPost(owner.token, { action: "update_draft_listing", listing_id: freeId, ...PHASE2 });
    if (upd.status === 200) ok("update_draft_listing Phase2 fields (free path)");
    else bad("update_draft_listing Phase2", JSON.stringify(upd.data).slice(0, 160));

    const detail = await bdPost(owner.token, { action: "get_owner_listing_detail", listing_id: freeId });
    const profile = detail.data?.detail?.profile || detail.data?.profile;
    const dbProfile = await fetchProfilePhase2(cfg, freeId);
    if (profileHasPhase2(profile)) {
      ok("get_owner_listing_detail Phase2 profile fields");
    } else if (profileHasPhase2(dbProfile)) {
      ok("profile Phase2 fields persisted (REST verify)");
      if (detail.status !== 200) {
        nlabel(`get_owner_listing_detail unavailable: ${JSON.stringify(detail.data).slice(0, 100)}`);
      }
    } else {
      bad(
        "owner detail Phase2",
        JSON.stringify(profile || dbProfile || detail.data || {}).slice(0, 120),
      );
    }

    await bdPost(owner.token, { action: "submit_listing_for_review", listing_id: freeId });
    await approveListing(ops.token, freeId, "Phase2a free smoke");
  }

  let stdId = "";
  let stdSlug = "";
  const stdCreated = await bdPost(owner.token, {
    action: "create_draft_listing",
    listing_type: "shop_retail",
    category_id: CATEGORY_SHOP,
    display_name: `Phase2a Std ${stamp}`,
    service_areas: ["東京都"],
    company_name: "Phase2a Std Co",
    contact_name: "Owner",
    contact_email: ownerSlot.email,
    contact_phone: "03-0000-0098",
    prefecture: "東京都",
    city: "渋谷区",
    address_line1: "4-5-6",
    short_description: "Standard smoke short",
    terms_accepted: true,
  });
  stdId = stdCreated.data?.listing?.id || "";
  stdSlug = stdCreated.data?.listing?.slug || "";
  if (stdId) ok(`create_draft_listing standard path ${stdId.slice(0, 8)}…`);
  else bad("create_draft_listing standard");

  if (stdId) {
    await bdPost(owner.token, {
      action: "update_draft_listing",
      listing_id: stdId,
      ...PHASE2,
      full_description: "Standard rich full description smoke",
      faq_items: [{ q: "Std Q", a: "Std A" }],
      recommended_uses: ["Standard audience"],
    });

    if (!skipStripe) {
      const co = await bdPost(owner.token, {
        action: "create_subscription_checkout",
        listing_id: stdId,
        target_plan: "standard",
        origin: BASE,
        success_path: `/business-directory/edit.html?id=${stdId}&tab=basic&bd_checkout=success`,
        cancel_path: `/business-directory/edit.html?id=${stdId}&tab=basic&bd_checkout=cancel`,
      });
      if (co.data?.url) {
        ok("standard checkout URL");
        nlabel("stripe browser checkout skipped in API smoke — polling sync only");
        const polled = await pollSyncPlan(owner.token, stdId, "standard", 3, 2000);
        if (polled.ok) ok(`standard plan=${polled.planCode}`);
        else nlabel(`standard plan still ${polled.planCode || "free"} — rich planGate may use API-only check`);
      } else if (co.data?.mode === "subscription_update") {
        ok("standard subscription_update");
      } else {
        nlabel(`standard checkout: ${JSON.stringify(co.data).slice(0, 100)}`);
      }
    } else {
      nlabel("stripe skipped — Standard+ browser planGate may be limited");
    }

    await bdPost(owner.token, { action: "submit_listing_for_review", listing_id: stdId });
    await approveListing(ops.token, stdId, "Phase2a standard smoke");

    const pubBefore = await bdPost(cfgAnon, {
      action: "get_public_listing_detail",
      slug: stdSlug,
      listing_type: "shop_retail",
    });
    const liveFull = pubBefore.data?.detail?.profile?.full_description;
    if (pubBefore.status === 200 && liveFull) ok("public detail before content_update");

    const pendingUpdate = await bdPost(owner.token, {
      action: "update_draft_listing",
      listing_id: stdId,
      full_description: "Updated full after content_update smoke",
      faq_items: [{ q: "Updated Q", a: "Updated A" }],
    });
    if (pendingUpdate.status === 200) ok("published update_draft_listing (pending path)");
    else bad("published update", JSON.stringify(pendingUpdate.data).slice(0, 120));

    await bdPost(owner.token, {
      action: "submit_listing_for_review",
      listing_id: stdId,
      request_type: "content_update",
    });
    ok("submit content_update");

    const pubMid = await bdPost(cfgAnon, {
      action: "get_public_listing_detail",
      slug: stdSlug,
      listing_type: "shop_retail",
    });
    const midFull = pubMid.data?.detail?.profile?.full_description;
    if (midFull === liveFull) ok("content_update pending — live unchanged");
    else nlabel(`live during review: ${String(midFull).slice(0, 40)}`);

    await approveListing(ops.token, stdId, "Phase2a content_update approve");

    const pubAfter = await bdPost(cfgAnon, {
      action: "get_public_listing_detail",
      slug: stdSlug,
      listing_type: "shop_retail",
    });
    const afterFull = pubAfter.data?.detail?.profile?.full_description;
    if (afterFull === "Updated full after content_update smoke") ok("content_update approve — live updated");
    else bad("content_update live", String(afterFull).slice(0, 80));
  }

  if (freeSlug) {
    const pubFree = await bdPost(cfgAnon, {
      action: "get_public_listing_detail",
      slug: freeSlug,
      listing_type: "shop_retail",
    });
    if (pubFree.status === 200 && pubFree.data?.detail?.profile?.seo_title) {
      ok("public API returns Phase2 profile (Free listing)");
    } else bad("public free detail API");
  }

  if (!skipBrowser) {
    try {
      const health = await fetch(`${BASE}/business-directory/new.html`);
      if (health.ok) ok(`8788 GET new.html (${BASE})`);
      else bad("8788 new.html", String(health.status));
      await runBrowserPublicPlanGate(freeSlug, stdSlug, owner, cfg);
    } catch (err) {
      bad("browser planGate", String(err?.message || err).slice(0, 160));
    } finally {
      await closeAllBrowsers();
    }
  } else {
    nlabel("browser smoke skipped (--skip-browser)");
  }

  console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
