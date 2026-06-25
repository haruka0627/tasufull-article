#!/usr/bin/env node
/**
 * Platform NB-1.5 — Platform actor resolver 検証
 *   node scripts/test-platform-actor-resolver.mjs
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  mapRawRoleToActorType,
  resolvePlatformActorCore,
} from "./lib/platform-actor-resolver-core.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runCoreTests() {
  assert(mapRawRoleToActorType("member") === "client", "member -> client");
  assert(mapRawRoleToActorType("buyer") === "client", "buyer -> client");
  assert(mapRawRoleToActorType("customer") === "client", "customer -> client");
  assert(mapRawRoleToActorType("owner") === "client", "owner -> client");
  assert(mapRawRoleToActorType("partner") === "partner", "partner -> partner");
  assert(mapRawRoleToActorType("vendor") === "partner", "vendor -> partner");
  assert(mapRawRoleToActorType("worker") === "partner", "worker -> partner");
  assert(mapRawRoleToActorType("provider") === "partner", "provider -> partner");
  assert(mapRawRoleToActorType("tasu_admin") === "admin", "tasu_admin -> admin");
  assert(mapRawRoleToActorType("") === "", "empty -> empty");

  const guest = resolvePlatformActorCore({});
  assert(guest.actor_type === "guest", "no input -> guest");
  assert(guest.source === "guest", "guest source");

  const member = resolvePlatformActorCore({
    claims: {
      talk_user_id: "u_member_1",
      member_id: "u_member_1",
      role: "authenticated",
      platform_role: "member",
      is_ops: false,
    },
    user: { source: "jwt", talkUserId: "u_member_1", authenticated: true, platformRole: "member" },
  });
  assert(member.actor_type === "client", "JWT member -> client");
  assert(member.talk_user_id === "u_member_1", "talk_user_id canonical");
  assert(member.source === "jwt", "jwt source");

  const buyer = resolvePlatformActorCore({
    context: { platform_role: "buyer" },
    claims: {
      talk_user_id: "u_buyer",
      platform_role: "buyer",
    },
    user: { source: "jwt", talkUserId: "u_buyer", authenticated: true },
  });
  assert(buyer.actor_type === "client", "buyer -> client");

  const partner = resolvePlatformActorCore({
    claims: {
      talk_user_id: "u_partner",
      platform_role: "vendor",
    },
    user: { source: "jwt", talkUserId: "u_partner", authenticated: true },
  });
  assert(partner.actor_type === "partner", "vendor -> partner");

  const ops = resolvePlatformActorCore({
    isOpsUser: true,
    claims: {
      talk_user_id: "u_ops",
      role: "tasu_admin",
      is_ops: true,
      platform_role: "member",
    },
    user: { source: "jwt", talkUserId: "u_ops", authenticated: true },
  });
  assert(ops.actor_type === "admin", "is_ops -> admin");
  assert(ops.is_ops === true, "is_ops flag");
  assert(ops.source === "jwt_ops", "jwt_ops source");

  const preview = resolvePlatformActorCore({
    adminPreviewAllowed: true,
    claims: { talk_user_id: "", platform_role: "member" },
    user: { source: "none", talkUserId: "" },
  });
  assert(preview.actor_type === "admin", "preview -> admin");
  assert(preview.source === "admin_preview", "admin_preview source");

  const demoPartner = resolvePlatformActorCore({
    context: { platform_role: "worker" },
    claims: { talk_user_id: "u_demo", platform_role: "member" },
    user: { source: "demo_fallback", talkUserId: "u_demo" },
  });
  assert(demoPartner.actor_type === "partner", "demo worker hint -> partner");
}

runCoreTests();
console.log("core: PASS (12 cases)");

let base;
try {
  base = await findDevServerBaseUrl({ probePath: "platform-actor-resolver.js" });
} catch (err) {
  console.warn("[test-platform-actor-resolver] dev server unavailable:", err.message);
  console.log("SUMMARY: core PASS · browser SKIPPED");
  await closeAllBrowsers();
  process.exit(0);
}

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage();
  const url = buildLocalPageUrl(base, "anpi-dashboard.html", "?talkDev=1");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(
    () =>
      typeof window.TasuPlatformActorResolver !== "undefined" &&
      typeof window.TasuAuthCurrentUser !== "undefined",
    { timeout: 60000 }
  );

  const guestActor = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "";
    localStorage.removeItem("tasu-supabase-auth");
    localStorage.removeItem("tasu_member_session");
    return window.TasuPlatformActorResolver.resolvePlatformActor();
  });
  assert(guestActor.actor_type === "guest", "browser: guest");

  const demoClient = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = false;
    window.TASU_CHAT_SUPABASE_CONFIG.talkDevMode = true;
    window.TASU_CHAT_SUPABASE_CONFIG.currentUserId = "u_me";
    return window.TasuPlatformActorResolver.resolvePlatformActor();
  });
  assert(
    demoClient.actor_type === "client" || demoClient.actor_type === "guest",
    "browser: demo client or guest"
  );

  const opsJwt = await page.evaluate(() => {
    const header = btoa(JSON.stringify({ alg: "none" })).replace(/=/g, "");
    const body = btoa(
      JSON.stringify({
        sub: "ops-uuid",
        role: "authenticated",
        app_metadata: {
          talk_user_id: "u_ops_jwt",
          is_ops: true,
          platform_role: "member",
        },
      })
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    localStorage.setItem(
      "tasu-supabase-auth",
      JSON.stringify({
        access_token: `${header}.${body}.sig`,
        user: { id: "ops-uuid", app_metadata: { talk_user_id: "u_ops_jwt", is_ops: true } },
      })
    );
    return {
      actor: window.TasuPlatformActorResolver.resolvePlatformActor(),
      ops: window.TasuAuthCurrentUser.isOpsUser(),
    };
  });
  assert(opsJwt.ops === true, "browser: isOpsUser");
  assert(opsJwt.actor.actor_type === "admin", "browser: ops actor admin");
  assert(opsJwt.actor.talk_user_id === "u_ops_jwt", "browser: ops talk_user_id");

  const anpiProd = await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.removeItem("tasu-supabase-auth");
    localStorage.setItem("tasu_member_role", "tasu_admin");
    return {
      legacy: window.TasuAnpiRls.isAnpiAdminFromLegacyMemberRole(),
      admin: window.TasuAnpiRls.isAnpiAdmin(),
    };
  });
  assert(anpiProd.legacy === false, "browser: prod blocks LS member role admin");
  assert(anpiProd.admin === false, "browser: prod anpi admin false without JWT");

  console.log("browser: PASS");
});

console.log("SUMMARY: ALL PASS");
await closeAllBrowsers();
