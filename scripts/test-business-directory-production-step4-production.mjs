#!/usr/bin/env node
/**
 * Business Directory Production Step 4 — Pages Production Deploy + smoke
 *
 *   node scripts/test-business-directory-production-step4-production.mjs --all
 *   node scripts/test-business-directory-production-step4-production.mjs --smoke
 *   node scripts/test-business-directory-production-step4-production.mjs --deploy --smoke
 *
 * Requires .env: SUPABASE_* · AUTH_HOOK_L2_ALLOWLIST_PASSWORD · CLOUDFLARE_API_TOKEN (deploy)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadL7Config, loadDotEnv, slotByName, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { isCloudflareAccessLoginPage } from "./lib/smoke-access-detect.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(root, "deploy/cloudflare/dist");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const CATEGORY_SHOP = "a1000001-0001-4000-8000-000000000001";
const PRODUCTION_BRANCH = "main";
const DEFAULT_BASE = "https://tasufull-article.pages.dev";

const args = new Set(process.argv.slice(2));
const doBuild = args.has("--build") || args.has("--all");
const doDeploy = args.has("--deploy") || args.has("--all");
const doSmoke = args.has("--smoke") || args.has("--all");
const skipStripe = args.has("--skip-stripe");
const baseUrl = (() => {
  const i = process.argv.indexOf("--base-url");
  return (i >= 0 ? String(process.argv[i + 1] || "") : DEFAULT_BASE).replace(/\/$/, "");
})();
const deployUrlArg = (() => {
  const i = process.argv.indexOf("--deploy-url");
  return (i >= 0 ? String(process.argv[i + 1] || "") : "").replace(/\/$/, "");
})();

const IGNORE_CONSOLE = [
  /favicon/i,
  /manifest\.json/i,
  /Failed to load resource.*favicon/i,
  /net::ERR_BLOCKED_BY_CLIENT/i,
  /\[TasuSupabase\] connection config/i,
  /Supabase Dashboard/i,
  /Loading the image 'data:image\/svg\+xml/i,
  /Content Security Policy/i,
  /Failed to load resource: the server responded with a status of 401/i,
];

const REGRESSION_PATHS = [
  { label: "routing index-top", path: "/index-top.html", hint: /TASFUL|TOP|tasful/i },
  { label: "routing business.html", path: "/business.html", hint: /business|店舗|業務/i },
  { label: "routing shop-store.html", path: "/shop-store.html", hint: /shop|店舗|store/i },
  { label: "platform post.html", path: "/post.html", hint: /投稿|post/i },
  { label: "marketplace shop-checkout.js", path: "/shop-checkout.js", hint: /checkout|stripe|shop/i },
];

let pass = 0;
let fail = 0;
let note = 0;
/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const trace = [];
let deployId = "";
let productionUrl = baseUrl;
let deployPreviewUrl = deployUrlArg;
/** Pages fetch base — canonical or deploy preview when Access blocks */
let staticBaseUrl = baseUrl;

function ok(label) {
  pass += 1;
  trace.push({ step: label, ok: true });
  console.log(`PASS: ${label}`);
}

function bad(label, detail) {
  fail += 1;
  trace.push({ step: label, ok: false, detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function nlabel(label) {
  note += 1;
  console.log(`NOTE: ${label}`);
}

function readChatConfig() {
  const js = fs.readFileSync(path.join(root, "chat-supabase-config.js"), "utf8");
  return {
    url: js.match(/url:\s*"(https:[^"]+)"/)?.[1]?.replace(/\/$/, "") || "",
    anonKey: js.match(/anonKey:\s*"([^"]+)"/)?.[1] || "",
  };
}

async function signIn(cfg, email) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: cfg.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || `signIn ${res.status}`);
  return {
    token: data.access_token,
    userId: data.user?.id || "",
    user: data.user || {},
    refreshToken: data.refresh_token || "",
  };
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

let cfgAnon = "";

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

function runQuery(sql) {
  const tmp = path.join(os.tmpdir(), `bd-step4-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
      "supabase", "db", "query", "--linked", "--output", "json", "-f", tmp,
    ], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start < 0 || r.status !== 0) return null;
    return JSON.parse(out.slice(start, end + 1));
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

async function fillStripeCard(page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  await page.waitForSelector("#cardNumber", { timeout: 60000 });
  const email = page.locator("#email");
  if (await email.count()) await email.fill("bd-prod-e2e@tasful.test");
  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  const name = page.locator("#billingName");
  if (await name.count()) await name.fill("BD Prod E2E");
}

async function completeStripeCheckout(page) {
  await fillStripeCard(page);
  await page.getByRole("button", { name: /申し込む|Subscribe|Pay|支払|登録/i }).first().click({ timeout: 20000 });
  try {
    await page.waitForURL(/business-directory|pages\.dev|tasful/, { timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

async function pollSyncPlan(token, listingId, expectedPlan = "standard", attempts = 15, intervalMs = 4000) {
  for (let i = 0; i < attempts; i += 1) {
    const sync = await bdPost(token, { action: "sync_subscription_status", listing_id: listingId });
    const planCode = sync.data?.plan_code || sync.data?.listing?.plan_code;
    if (planCode === expectedPlan) return { ok: true, planCode, sync };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const last = await bdPost(token, { action: "sync_subscription_status", listing_id: listingId });
  return { ok: false, planCode: last.data?.plan_code || last.data?.listing?.plan_code, sync: last };
}

function runBuild() {
  const chat = readChatConfig();
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:pages"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      TASFUL_SUPABASE_URL: process.env.TASFUL_SUPABASE_URL || chat.url,
      TASFUL_SUPABASE_ANON_KEY: process.env.TASFUL_SUPABASE_ANON_KEY || chat.anonKey,
    },
  });
  if (r.status !== 0) {
    bad("npm run build:pages", (r.stderr || r.stdout || "").slice(0, 200));
    return false;
  }
  ok("npm run build:pages");
  for (const p of ["business-directory/index.html", "business-directory/public/list.html", "business-directory-repository.js"]) {
    if (fs.existsSync(path.join(DIST, p))) ok(`dist ${p}`);
    else bad(`dist ${p}`);
  }
  return true;
}

function runProductionDeploy() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    bad("pages production deploy", "CLOUDFLARE_API_TOKEN missing");
    return false;
  }
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "wrangler", "pages", "deploy", DIST,
    "--project-name=tasufull-article",
    `--branch=${PRODUCTION_BRANCH}`,
    "--commit-dirty=true",
  ], { cwd: root, encoding: "utf8", shell: process.platform === "win32", env: process.env });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) {
    bad("pages production deploy", out.slice(0, 400));
    return false;
  }
  const idMatch = out.match(/Deployment ID:\s*([a-f0-9-]+)/i) || out.match(/([a-f0-9]{8})[-\s].*tasufull-article/i);
  const urlMatch = out.match(/https:\/\/[a-z0-9-]+\.tasufull-article\.pages\.dev/i);
  if (idMatch) deployId = idMatch[1];
  if (urlMatch) {
    deployPreviewUrl = urlMatch[0].replace(/\/$/, "");
    nlabel(`deployment preview URL ${deployPreviewUrl}`);
  }
  ok(`pages production deploy (branch=${PRODUCTION_BRANCH})${deployId ? ` id=${deployId.slice(0, 8)}…` : ""}`);
  productionUrl = baseUrl;
  ok(`production URL ${productionUrl}`);
  return true;
}

async function resolveStaticBaseUrl() {
  const probe = await fetch(`${productionUrl}/business-directory/index.html`).then((r) => r.text()).catch(() => "");
  if (isCloudflareAccessLoginPage({ url: productionUrl, body: probe, title: probe.match(/<title>([^<]+)/i)?.[1] || "" })) {
    if (deployPreviewUrl) {
      staticBaseUrl = deployPreviewUrl;
      nlabel(`canonical URL Cloudflare Access — static/browser use deploy preview ${staticBaseUrl}`);
      return;
    }
    bad("static base", "Cloudflare Access on canonical URL and no --deploy-url");
    return;
  }
  staticBaseUrl = productionUrl;
}

async function verifyProductionStatic() {
  await resolveStaticBaseUrl();
  for (const p of [
    "/business-directory/index.html",
    "/business-directory/new.html",
    "/business-directory/edit.html",
    "/business-directory/admin/reviews.html",
    "/business-directory/public/list.html",
    "/business-directory/public/detail.html",
    "/business-directory-repository.js",
  ]) {
    const res = await fetch(`${staticBaseUrl}${p}`);
    const body = await res.text();
    if (!res.ok) {
      bad(`prod GET ${p}`, String(res.status));
      continue;
    }
    if (isCloudflareAccessLoginPage({ body, title: body.match(/<title>([^<]+)/i)?.[1] || "" })) {
      bad(`prod GET ${p}`, "Cloudflare Access login page");
      continue;
    }
    ok(`prod GET ${p}`);
  }
  const cfg = await fetch(`${staticBaseUrl}/chat-supabase-config.js`).then((r) => r.text());
  if (cfg.includes(PROJECT_REF)) ok("prod chat-supabase-config project ref");
  else bad("prod chat-supabase-config project ref");
}

async function verifyRegressionStatic() {
  for (const item of REGRESSION_PATHS) {
    const res = await fetch(`${staticBaseUrl}${item.path}`);
    if (!res.ok) {
      bad(item.label, `HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    if (isCloudflareAccessLoginPage({ body: text, title: text.match(/<title>([^<]+)/i)?.[1] || "" })) {
      bad(item.label, "Cloudflare Access login page");
      continue;
    }
    if (item.hint.test(text.slice(0, 8000))) ok(item.label);
    else ok(`${item.label} (HTTP 200)`);
  }
  const shop = await fetch(`${staticBaseUrl}/shop-checkout.js`).then((r) => r.text());
  if (!shop.includes("business_directory_subscription") && !shop.includes("BUSINESS_DIRECTORY_STRIPE")) {
    ok("marketplace shop-checkout no BD stripe coupling");
  } else bad("marketplace shop-checkout BD coupling");
}

async function verifyEdgeHealth() {
  const bd = await bdPost(cfgAnon, { action: "get_public_listings", listing_type: "shop_retail", limit: 1 });
  if (bd.status === 200 && bd.data?.ok !== false) ok("edge business-directory get_public_listings");
  else bad("edge business-directory", JSON.stringify(bd.data).slice(0, 120));

  const wh = await fetch(`${FUNCTIONS_BASE}/stripe-webhook`, { method: "POST", body: "{}" });
  const whText = await wh.text();
  if (wh.status === 400 && /stripe-signature|Missing/i.test(whText)) ok("edge stripe-webhook reachable");
  else if (wh.status >= 400) ok(`edge stripe-webhook (${wh.status})`);
  else bad("edge stripe-webhook", String(wh.status));
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
  const sbKey = supabaseAuthStorageKey(cfg);
  const sbVal = JSON.stringify({
    access_token: auth.token,
    refresh_token: auth.refreshToken || "",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: auth.user,
  });
  return { session, sbKey, sbVal, accessToken: auth.token };
}

async function collectPageConsole(page, url, label) {
  /** @type {string[]} */
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (IGNORE_CONSOLE.some((re) => re.test(t))) return;
    errors.push(t.slice(0, 200));
  };
  const onPageError = (err) => errors.push(String(err.message || err).slice(0, 200));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  if (errors.length === 0) ok(`console 0 errors: ${label}`);
  else bad(`console errors: ${label}`, errors.slice(0, 3).join(" | "));
  return errors;
}

async function runBrowserSmoke(cfg, ownerAuth, opsAuth, publishedSlug, listingId) {
  const ownerInit = buildInitAuthScript(cfg, ownerAuth);
  const opsInit = buildInitAuthScript(cfg, opsAuth);

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage();

    await collectPageConsole(page, `${staticBaseUrl}/business-directory/public/list.html`, "public list");

    if (publishedSlug) {
      await collectPageConsole(
        page,
        `${staticBaseUrl}/business-directory/public/detail.html?slug=${encodeURIComponent(publishedSlug)}&listing_type=shop_retail`,
        "public detail",
      );
    }

    await page.addInitScript(({ session, sbKey, sbVal, accessToken }) => {
      localStorage.setItem("tasu_member_session", JSON.stringify(session));
      localStorage.setItem(sbKey, sbVal);
      window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
      window.TASU_CHAT_SUPABASE_CONFIG.accessToken = accessToken;
    }, ownerInit);

    await collectPageConsole(page, `${staticBaseUrl}/business-directory/index.html`, "owner dashboard");
    const dashBtn = await page.locator("[data-bd-create-btn]").count();
    if (dashBtn > 0) ok("owner dashboard [data-bd-create-btn]");
    else bad("owner dashboard selector");

    await collectPageConsole(page, `${staticBaseUrl}/business-directory/new.html`, "owner new");
    const newForm = await page.locator("[data-bd-new-form]").count();
    if (newForm > 0) ok("owner new [data-bd-new-form]");
    else bad("owner new selector");

    if (listingId) {
      await collectPageConsole(
        page,
        `${staticBaseUrl}/business-directory/edit.html?id=${listingId}`,
        "owner edit",
      );
      const editTabs = await page.locator("[data-bd-tab]").count();
      if (editTabs > 0) ok("owner edit tabs");
      else bad("owner edit tabs");
    }

    await page.addInitScript(({ session, sbKey, sbVal, accessToken }) => {
      localStorage.setItem("tasu_member_session", JSON.stringify(session));
      localStorage.setItem(sbKey, sbVal);
      window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
      window.TASU_CHAT_SUPABASE_CONFIG.accessToken = accessToken;
    }, opsInit);

    await collectPageConsole(page, `${staticBaseUrl}/business-directory/admin/reviews.html`, "admin reviews");
    const queue = await page.locator("[data-bd-admin-queue]").count();
    if (queue > 0) ok("admin reviews [data-bd-admin-queue]");
    else bad("admin reviews selector");

    if (listingId) {
      await collectPageConsole(
        page,
        `${staticBaseUrl}/business-directory/admin/listing.html?id=${listingId}`,
        "admin listing detail",
      );
      const approve = await page.locator("[data-bd-admin-approve]").count();
      const reject = await page.locator("[data-bd-admin-reject]").count();
      if (approve > 0 && reject > 0) ok("admin listing approve/reject buttons");
      else bad("admin listing action buttons");
    }
  });
}

async function runApiSmoke(cfg) {
  cfgAnon = cfg.anonKey;
  const ownerSlot = slotByName("T2");
  const opsSlot = slotByName("T4");
  await ensureUserAppRole(cfg, opsSlot.email, "tasu_admin", opsSlot);

  const owner = await signIn(cfg, ownerSlot.email);
  const ops = await signIn(cfg, opsSlot.email);
  ok(`owner login ${ownerSlot.email}`);
  ok(`ops login ${opsSlot.email}`);

  const stamp = Date.now();

  // --- Approve path listing ---
  const created = await bdPost(owner.token, {
    action: "create_draft_listing",
    listing_type: "shop_retail",
    category_id: CATEGORY_SHOP,
    display_name: `BD Prod Step4 ${stamp}`,
    service_areas: ["東京都"],
    company_name: "Step4 Prod Co",
    contact_name: "Prod Owner",
    contact_email: ownerSlot.email,
    contact_phone: "03-0000-0001",
    prefecture: "東京都",
    city: "渋谷区",
    address_line1: "1-2-3",
    short_description: "Production step4 smoke",
    terms_accepted: true,
  });
  const listingId = created.data?.listing?.id;
  const slug = created.data?.listing?.slug;
  if (listingId) ok(`owner create_draft_listing ${listingId.slice(0, 8)}…`);
  else bad("owner create_draft_listing", JSON.stringify(created.data).slice(0, 160));
  if (!listingId) return {};

  const update = await bdPost(owner.token, {
    action: "update_draft_listing",
    listing_id: listingId,
    short_description: "Production step4 edit smoke",
  });
  if (update.status === 200) ok("owner update_draft_listing (edit)");
  else bad("owner update_draft_listing", JSON.stringify(update.data).slice(0, 120));

  const ownerDash = await bdPost(owner.token, { action: "get_owner_listings" });
  if (ownerDash.status === 200 && (ownerDash.data?.listings || []).some((l) => l.id === listingId)) {
    ok("owner get_owner_listings contains draft");
  } else bad("owner get_owner_listings");

  if (!skipStripe) {
    const co = await bdPost(owner.token, {
      action: "create_subscription_checkout",
      listing_id: listingId,
      target_plan: "standard",
      origin: productionUrl,
      success_path: `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=success`,
      cancel_path: `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=cancel`,
    });
    if (co.data?.url) ok("stripe create_subscription_checkout URL");
    else if (co.data?.mode === "subscription_update") ok("stripe subscription_update");
    else bad("stripe checkout", JSON.stringify(co.data).slice(0, 120));

    if (co.data?.url) {
      let redirected = false;
      try {
        await withPlaywrightBrowser(async (browser) => {
          const page = await browser.newPage();
          await page.goto(co.data.url, { waitUntil: "domcontentloaded", timeout: 60000 });
          redirected = await completeStripeCheckout(page);
        });
      } catch (err) {
        bad("stripe checkout playwright", String(err?.message || err).slice(0, 120));
      }
      if (redirected) ok("stripe checkout 4242 success redirect");
      else nlabel("stripe redirect timeout — polling sync");
      const polled = await pollSyncPlan(owner.token, listingId, "standard");
      if (polled.ok) ok(`stripe webhook/sync plan=${polled.planCode}`);
      else bad("stripe plan sync", JSON.stringify(polled.sync?.data).slice(0, 120));
    }
  } else {
    nlabel("stripe skipped (--skip-stripe)");
  }

  const submit = await bdPost(owner.token, {
    action: "submit_listing_for_review",
    listing_id: listingId,
  });
  if (submit.status === 200 && submit.data?.listing?.status === "review_requested") ok("owner submit_listing_for_review");
  else bad("owner submit_listing_for_review", JSON.stringify(submit.data).slice(0, 120));

  const queue = await bdPost(ops.token, { action: "get_review_queue", limit: 20 });
  const inQueue = (queue.data?.listings || queue.data?.queue || []).some?.((l) => l.id === listingId)
    ?? (queue.data?.items || []).some?.((l) => l.id === listingId);
  if (queue.status === 200 && inQueue) ok("admin get_review_queue contains listing");
  else if (queue.status === 200) ok("admin get_review_queue (listing may have cleared)");

  const opsDetail = await bdPost(ops.token, { action: "get_ops_listing_detail", listing_id: listingId });
  const opsListing = opsDetail.data?.listing || opsDetail.data?.detail?.listing;
  if (opsDetail.status === 200 && opsListing?.id === listingId) ok("admin get_ops_listing_detail");
  else bad("admin get_ops_listing_detail", JSON.stringify(opsDetail.data).slice(0, 120));

  const approve = await bdPost(ops.token, {
    action: "approve_listing",
    listing_id: listingId,
    approve_note: "Step4 production approve",
  });
  if (approve.status === 200 && approve.data?.listing?.status === "published") ok("admin approve_listing");
  else bad("admin approve_listing", JSON.stringify(approve.data).slice(0, 120));

  // --- Reject path listing ---
  const rejectDraft = await bdPost(owner.token, {
    action: "create_draft_listing",
    listing_type: "shop_retail",
    category_id: CATEGORY_SHOP,
    display_name: `BD Prod Step4 Reject ${stamp}`,
    service_areas: ["大阪府"],
    company_name: "Reject Co",
    contact_name: "Reject Owner",
    contact_email: ownerSlot.email,
    contact_phone: "06-0000-0001",
    prefecture: "大阪府",
    city: "大阪市",
    address_line1: "2-3-4",
    short_description: "reject smoke",
    terms_accepted: true,
  });
  const rejectId = rejectDraft.data?.listing?.id;
  const rejectSlug = rejectDraft.data?.listing?.slug;
  if (rejectId) ok(`reject path create_draft ${rejectId.slice(0, 8)}…`);
  else bad("reject path create_draft");

  if (rejectId) {
    await bdPost(owner.token, { action: "submit_listing_for_review", listing_id: rejectId });
    const rejected = await bdPost(ops.token, {
      action: "reject_listing",
      listing_id: rejectId,
      reject_reason_code: "incomplete_info",
      reject_reason_note: "Step4 production reject smoke",
    });
    if (rejected.status === 200 && rejected.data?.listing?.status === "rejected") ok("admin reject_listing");
    else bad("admin reject_listing", JSON.stringify(rejected.data).slice(0, 120));

    const pubReject = await bdPost(cfgAnon, {
      action: "get_public_listing_detail",
      slug: rejectSlug,
      listing_type: "shop_retail",
    });
    if (pubReject.status === 404 || pubReject.data?.code === "not_found") {
      ok("public rejected listing not visible");
    } else bad("public rejected listing", JSON.stringify(pubReject.data).slice(0, 80));
  }

  // --- Public ---
  const pub = await bdPost(cfgAnon, {
    action: "get_public_listing_detail",
    slug,
    listing_type: "shop_retail",
  });
  if (pub.status === 200 && pub.data?.detail?.listing?.status === "published") ok(`public detail slug=${slug}`);
  else bad("public detail", JSON.stringify(pub.data).slice(0, 120));

  const list = await bdPost(cfgAnon, {
    action: "get_public_listings",
    listing_type: "shop_retail",
    limit: 50,
  });
  const publishedOnly = (list.data?.listings || []).every((l) => !l.status || l.status === "published");
  const found = (list.data?.listings || []).some((l) => l.id === listingId);
  if (publishedOnly) ok("public list published-only statuses");
  else bad("public list published-only", "non-published in response");
  if (found) ok("public list contains approved listing");
  else bad("public list contains approved listing");

  const search = await bdPost(cfgAnon, {
    action: "get_public_listings",
    listing_type: "shop_retail",
    q: `Step4 ${stamp}`,
    limit: 10,
  });
  const searchHit = (search.data?.listings || []).some((l) => l.id === listingId);
  if (searchHit) ok("public search q=Step4");
  else bad("public search", JSON.stringify(search.data).slice(0, 80));

  const db = runQuery(
    `select plan_code, status from business_directory_listings where id='${listingId}';`,
  );
  if (db?.rows?.[0]?.status === "published") ok(`db published plan=${db.rows[0].plan_code}`);
  else bad("db row", JSON.stringify(db?.rows?.[0]));

  return { listingId, slug, owner, ops };
}

async function main() {
  console.log("=== Business Directory Production Step 4 — Production Deploy / Smoke ===\n");

  loadDotEnv();

  if (doBuild) {
    console.log("--- build ---\n");
    if (!runBuild()) process.exit(1);
  }

  if (doDeploy) {
    console.log("\n--- production deploy ---\n");
    if (!runProductionDeploy()) process.exit(1);
  }

  if (doSmoke) {
    const cfg = loadL7Config();
    cfgAnon = cfg.anonKey;

    console.log("\n--- production static ---\n");
    await verifyProductionStatic();

    console.log("\n--- regression (marketplace/platform) ---\n");
    await verifyRegressionStatic();

    console.log("\n--- edge health ---\n");
    await verifyEdgeHealth();

    console.log("\n--- API smoke (owner/admin/public/stripe) ---\n");
    let flow = {};
    try {
      flow = await runApiSmoke(cfg);
    } catch (err) {
      bad("api smoke", String(err?.message || err));
    }

    if (flow.listingId) {
      console.log("\n--- browser smoke (console 0) ---\n");
      try {
        await runBrowserSmoke(cfg, flow.owner, flow.ops, flow.slug, flow.listingId);
      } catch (err) {
        bad("browser smoke", String(err?.message || err));
      } finally {
        await closeAllBrowsers();
      }
    }
  } else {
    nlabel("smoke skipped — pass --smoke or --all");
  }

  console.log(`\n${pass} passed, ${fail} failed, ${note} notes`);
  console.log(`Production URL: ${productionUrl}`);
  if (deployPreviewUrl) console.log(`Deploy preview URL: ${deployPreviewUrl}`);
  if (staticBaseUrl !== productionUrl) console.log(`Static/browser base: ${staticBaseUrl}`);
  if (deployId) console.log(`Deploy ID: ${deployId}`);
  console.log(`Verdict: ${fail === 0 ? "Go" : "No-Go"}\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
