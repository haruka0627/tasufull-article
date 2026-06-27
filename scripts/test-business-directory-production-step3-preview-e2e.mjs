#!/usr/bin/env node
/**
 * Business Directory Production Step 3 — Pages Preview + mock-free E2E
 *
 *   node scripts/test-business-directory-production-step3-preview-e2e.mjs --build --deploy --e2e
 *   node scripts/test-business-directory-production-step3-preview-e2e.mjs --e2e --preview-url https://....pages.dev
 *   node scripts/test-business-directory-production-step3-preview-e2e.mjs --e2e --skip-stripe
 *
 * Requires .env: SUPABASE_* · AUTH_HOOK_L2_ALLOWLIST_PASSWORD · CLOUDFLARE_API_TOKEN (deploy)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadL7Config, slotByName, PROJECT_REF } from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(root, "deploy/cloudflare/dist");
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const CATEGORY_SHOP = "a1000001-0001-4000-8000-000000000001";
const PREVIEW_BRANCH = "business-directory-step3-preview";

const args = new Set(process.argv.slice(2));
const doBuild = args.has("--build");
const doDeploy = args.has("--deploy");
const doE2e = args.has("--e2e") || args.has("--all");
const skipStripe = args.has("--skip-stripe");
const previewArg = (() => {
  const i = process.argv.indexOf("--preview-url");
  return i >= 0 ? String(process.argv[i + 1] || "").replace(/\/$/, "") : "";
})();

let pass = 0;
let fail = 0;
let note = 0;
/** @type {{ step: string, ok: boolean, detail?: string }[]} */
const trace = [];
let previewUrl = previewArg;

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
  return { token: data.access_token, userId: data.user?.id || "" };
}

async function ensureUserAppRole(cfg, email, role, slot) {
  const listRes = await fetch(`${cfg.url}/auth/v1/admin/users?per_page=200`, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
    },
  });
  const list = await listRes.json().catch(() => ({}));
  if (!listRes.ok) throw new Error(`admin/users ${listRes.status}`);
  const user = (list.users || []).find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`allowlist user missing: ${email}`);

  const currentRole = String(user.app_metadata?.role || "").toLowerCase();
  if (currentRole === role) return user.id;

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
  if (!upd.ok) {
    const err = await upd.text().catch(() => "");
    throw new Error(`set role ${role} for ${email}: ${upd.status} ${err.slice(0, 120)}`);
  }
  return user.id;
}

async function verifyOpsClaims(cfg, token) {
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` },
  });
  const user = await res.json().catch(() => ({}));
  const role = String(user.app_metadata?.role || user.role || "").toLowerCase();
  return ["ops_admin", "tasu_admin", "tasu_ops_admin", "admin"].includes(role);
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

let cfgAnon = "";

function runQuery(sql) {
  const tmp = path.join(os.tmpdir(), `bd-step3-${process.pid}-${Date.now()}.sql`);
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

async function fillStripeCard(page, cardNumber = "4242424242424242") {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  await page.waitForSelector("#cardNumber", { timeout: 60000 });
  const email = page.locator("#email");
  if (await email.count()) await email.fill("bd-e2e@tasful.test");
  await page.locator("#cardNumber").fill(cardNumber);
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  const name = page.locator("#billingName");
  if (await name.count()) await name.fill("BD E2E");
}

async function completeStripeCheckout(page, successUrlPattern = /business-directory|pages\.dev/) {
  await fillStripeCard(page);
  const submit = page.getByRole("button", { name: /申し込む|Subscribe|Pay|支払|登録/i }).first();
  await submit.click({ timeout: 20000 });
  try {
    await page.waitForURL(successUrlPattern, { timeout: 120000 });
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
  return {
    ok: false,
    planCode: last.data?.plan_code || last.data?.listing?.plan_code,
    sync: last,
  };
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
  if (fs.existsSync(path.join(DIST, "business-directory/index.html"))) ok("dist business-directory/");
  else bad("dist business-directory/");
  if (fs.existsSync(path.join(DIST, "chat-supabase-config.js"))) ok("dist chat-supabase-config.js");
  else bad("dist chat-supabase-config.js");
  return true;
}

function runDeploy() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    bad("pages preview deploy", "CLOUDFLARE_API_TOKEN missing");
    return false;
  }
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "wrangler", "pages", "deploy", DIST,
    "--project-name=tasufull-article",
    `--branch=${PREVIEW_BRANCH}`,
    "--commit-dirty=true",
  ], { cwd: root, encoding: "utf8", shell: process.platform === "win32", env: process.env });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) {
    bad("pages preview deploy", out.slice(0, 300));
    return false;
  }
  const urlMatch = out.match(/https:\/\/[a-z0-9-]+\.tasufull-article\.pages\.dev/i);
  if (urlMatch) previewUrl = urlMatch[0].replace(/\/$/, "");
  ok(`pages preview deploy${previewUrl ? ` → ${previewUrl}` : ""}`);
  return Boolean(previewUrl);
}

async function verifyPreviewStatic() {
  if (!previewUrl) {
    nlabel("preview static skipped — no preview URL");
    return;
  }
  for (const p of [
    "/business-directory/index.html",
    "/business-directory/public/list.html",
    "/business-directory-repository.js",
  ]) {
    const res = await fetch(`${previewUrl}${p}`);
    if (res.ok) ok(`preview GET ${p}`);
    else bad(`preview GET ${p}`, String(res.status));
  }
  const cfg = await fetch(`${previewUrl}/chat-supabase-config.js`).then((r) => r.text());
  if (cfg.includes(PROJECT_REF)) ok("preview chat-supabase-config project ref");
  else bad("preview chat-supabase-config project ref");
}

async function runMockFreeE2e(cfg) {
  cfgAnon = cfg.anonKey;
  const ownerSlot = slotByName("T2");
  const opsSlot = slotByName("T4");
  await ensureUserAppRole(cfg, opsSlot.email, "tasu_admin", opsSlot);
  const owner = await signIn(cfg, ownerSlot.email);
  const ops = await signIn(cfg, opsSlot.email);
  ok(`owner login ${ownerSlot.email}`);
  if (await verifyOpsClaims(cfg, ops.token)) ok(`ops login ${opsSlot.email} (tasu_admin)`);
  else bad("ops login role", `${opsSlot.email} missing tasu_admin in JWT`);

  const stamp = Date.now();
  const draftBody = {
    action: "create_draft_listing",
    listing_type: "shop_retail",
    category_id: CATEGORY_SHOP,
    display_name: `BD Step3 E2E ${stamp}`,
    service_areas: ["東京都"],
    company_name: "Step3 E2E Co",
    contact_name: "E2E Owner",
    contact_email: ownerSlot.email,
    contact_phone: "03-0000-0001",
    prefecture: "東京都",
    city: "渋谷区",
    address_line1: "1-2-3",
    short_description: "Production step3 mock-free e2e",
    terms_accepted: true,
  };

  const created = await bdPost(owner.token, draftBody);
  const listingId = created.data?.listing?.id;
  const slug = created.data?.listing?.slug;
  if (created.status >= 200 && created.status < 300 && listingId) ok(`create_draft_listing ${listingId.slice(0, 8)}…`);
  else bad("create_draft_listing", JSON.stringify(created.data).slice(0, 160));

  if (!listingId) return;

  const checkoutOrigin = previewUrl || "https://tasufull-article.pages.dev";
  if (!skipStripe) {
    const co = await bdPost(owner.token, {
      action: "create_subscription_checkout",
      listing_id: listingId,
      target_plan: "standard",
      origin: checkoutOrigin,
      success_path: `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=success`,
      cancel_path: `/business-directory/edit.html?id=${listingId}&tab=basic&bd_checkout=cancel`,
    });
    if (co.data?.url && co.data?.mode === "checkout") ok("create_subscription_checkout URL");
    else if (co.data?.mode === "subscription_update") ok("create_subscription_checkout subscription_update");
    else bad("create_subscription_checkout", JSON.stringify(co.data).slice(0, 160));

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
      if (redirected) ok("stripe checkout completed (4242) → success redirect");
      else if (!trace.some((t) => t.step === "stripe checkout playwright" && !t.ok)) {
        nlabel("stripe checkout submitted — success redirect timeout (polling webhook/sync)");
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  } else {
    nlabel("stripe checkout skipped (--skip-stripe)");
  }

  let planCode;
  if (!skipStripe) {
    const polled = await pollSyncPlan(owner.token, listingId, "standard");
    planCode = polled.planCode;
    if (polled.ok) ok(`sync_subscription_status plan=${planCode} (after checkout/webhook)`);
    else bad("sync_subscription_status", JSON.stringify(polled.sync?.data).slice(0, 160));
  } else {
    const sync = await bdPost(owner.token, {
      action: "sync_subscription_status",
      listing_id: listingId,
    });
    planCode = sync.data?.plan_code || sync.data?.listing?.plan_code;
    if (sync.status === 200) ok(`sync_subscription_status plan=${planCode || "free(skip)"}`);
    else bad("sync_subscription_status", JSON.stringify(sync.data).slice(0, 160));
  }

  if (!skipStripe && planCode !== "standard") return;

  const submit = await bdPost(owner.token, {
    action: "submit_listing_for_review",
    listing_id: listingId,
  });
  if (submit.status === 200 && submit.data?.listing?.status === "review_requested") {
    ok("submit_listing_for_review");
  } else bad("submit_listing_for_review", JSON.stringify(submit.data).slice(0, 160));

  const approve = await bdPost(ops.token, {
    action: "approve_listing",
    listing_id: listingId,
    approve_note: "Step3 E2E approve",
  });
  if (approve.status === 200 && approve.data?.listing?.status === "published") {
    ok("approve_listing → published");
  } else bad("approve_listing", JSON.stringify(approve.data).slice(0, 160));

  const pub = await bdPost(cfgAnon, {
    action: "get_public_listing_detail",
    slug,
    listing_type: "shop_retail",
  });
  const pubListing = pub.data?.detail?.listing;
  if (pub.status === 200 && pubListing?.status === "published") {
    ok(`get_public_listing_detail slug=${slug}`);
  } else bad("get_public_listing_detail", JSON.stringify(pub.data).slice(0, 160));

  const list = await bdPost(cfgAnon, {
    action: "get_public_listings",
    listing_type: "shop_retail",
    limit: 50,
  });
  const found = (list.data?.listings || []).some((l) => l.id === listingId);
  if (found) ok("get_public_listings contains listing");
  else bad("get_public_listings contains listing");

  const db = runQuery(
    `select plan_code, status, subscription_status from business_directory_listings where id='${listingId}';`,
  );
  const row = db?.rows?.[0];
  if (row?.status === "published") ok(`db status=published plan=${row.plan_code}`);
  else bad("db listing row", JSON.stringify(row));

  return { listingId, slug, planCode: row?.plan_code, previewUrl };
}

async function main() {
  console.log("=== Business Directory Production Step 3 — Preview / E2E ===\n");

  if (doBuild) {
    console.log("--- build ---\n");
    if (!runBuild()) process.exit(1);
  }

  if (doDeploy) {
    console.log("\n--- deploy ---\n");
    if (!runDeploy()) process.exit(1);
  }

  if (doE2e) {
    console.log("\n--- preview static ---\n");
    await verifyPreviewStatic();

    console.log("\n--- mock-free E2E (API) ---\n");
    const cfg = loadL7Config();
    try {
      await runMockFreeE2e(cfg);
    } finally {
      await closeAllBrowsers();
    }
  } else {
    nlabel("E2E skipped — pass --e2e or --all");
  }

  console.log(`\n${pass} passed, ${fail} failed, ${note} notes`);
  if (previewUrl) console.log(`Preview URL: ${previewUrl}\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
