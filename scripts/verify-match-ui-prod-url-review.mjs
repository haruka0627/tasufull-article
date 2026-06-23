#!/usr/bin/env node
/**
 * MATCH UI prod URL review — tasful.jp + prod-parity + linked ref API
 *
 *   node scripts/verify-match-ui-prod-url-review.mjs
 *   node scripts/verify-match-ui-prod-url-review.mjs --base https://tasful.jp
 *   node scripts/verify-match-ui-prod-url-review.mjs --base http://127.0.0.1:8788
 *
 * Ref: ddojquacsyqesrjhcvmn · screenshots → reports/screenshots/match-prod-url-review/
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWLIST_SLOTS,
  loadL7Config,
  PROJECT_REF,
  slotByName,
} from "./lib/auth-hook-l7-slots.mjs";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import {
  STANDARD_LOCAL_BASE,
  buildLocalPageUrl,
  findDevServerBaseUrl,
} from "./lib/dev-server-url.mjs";
import {
  MATCH_SCREENSHOT_VIEWPORT,
  MATCH_UI_VIEWPORTS,
  assertMatchNoHorizontalOverflow,
  isMatchMinViewport,
  matchViewportSize,
} from "./lib/match-viewports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCREENSHOT_DIR = path.join(ROOT, "reports", "screenshots", "match-prod-url-review");
const SQL_GATES = "sql/match-post-auth-final-smoke-readonly.sql";
const PROD_HOST = "tasful.jp";
const DEFAULT_PROD_BASE = `https://${PROD_HOST}`;
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

const MATCH_PAGES = Object.freeze([
  { key: "top", file: "match-top.html", title: "TASFUL MATCH" },
  { key: "profile-create", file: "match-profile-create.html", probe: "[data-match-profile-wizard]" },
  { key: "swipe", file: "match-swipe.html", probe: "[data-match-swipe-action='like']" },
  { key: "list", file: "match-list.html", probe: "[data-match-pair-list]" },
  { key: "talk-bridge", file: "match-talk-bridge.html", probe: "[data-match-talk-cta]" },
  { key: "safety", file: "match-safety.html", probe: ".match-safety-hero" },
  { key: "report", file: "match-report.html", probe: "[data-report-submit]" },
  { key: "block", file: "match-block.html", probe: "[data-match-block-list]" },
  { key: "verify", file: "match-verify.html", probe: "[data-verify-panel='1']" },
]);

const DIST_SYNC_FILES = Object.freeze([
  "match-top.html",
  "match-profile-create.html",
  "match-swipe.html",
  "match-list.html",
  "match-talk-bridge.html",
  "match-safety.html",
  "match-report.html",
  "match-block.html",
  "match-verify.html",
  "match-mypage.html",
  "match-review.html",
  "match-favorites.html",
  "match-footprints.html",
  "match-search-saved.html",
  "match-ai-love-advice.html",
  "match-ai-marriage-advice.html",
  "match-ai-profile-coach.html",
  "match-ai-message-coach.html",
  "match-ai-compatibility-detail.html",
  "match-ai-date-coach.html",
  "match-api.js",
  "match-auth.js",
  "match-wiring.js",
  "match-mock.js",
  "match-data-stub.js",
  "match-data-render.js",
  "match-p15-wiring.js",
  "match-p15-render.js",
  "match-ai-cta.js",
  "match.css",
]);

const KNOWN_CONSOLE_PATTERNS = [
  /favicon/i,
  /Failed to load resource.*404/i,
  /Deprecation/i,
];

function parseBaseUrl() {
  const idx = process.argv.indexOf("--base");
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/\/$/, "");
  }
  return DEFAULT_PROD_BASE;
}

const reviewBase = parseBaseUrl();
const isProdBase = /^https:\/\/(tasful\.jp|www\.tasful\.jp)(:\d+)?$/i.test(reviewBase);

/** @type {{ step: string, ok: boolean, detail?: string, block?: boolean }[]} */
const results = [];
/** @type {string[]} */
const blockReasons = [];

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`  OK  ${step}${detail ? `: ${detail}` : ""}`);
}

function fail(step, detail = "", block = true) {
  results.push({ step, ok: false, detail, block });
  console.error(`  NG  ${step}${detail ? `: ${detail}` : ""}`);
  if (block) blockReasons.push(`${step}: ${detail}`);
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function runSupabaseCli(subArgs) {
  const r = spawnSync("npx", ["supabase", ...subArgs], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function parseCliJson(out) {
  const jsonMatch = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function runSqlGates() {
  const sqlPath = path.join(ROOT, SQL_GATES);
  const r = runSupabaseCli(["db", "query", "--linked", "--yes", "-f", sqlPath]);
  const combined = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(combined.slice(0, 500));
  const row = parseCliJson(combined)?.rows?.[0];
  if (!row) throw new Error("no gate row");
  return row;
}

async function probeUrl(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow" });
    return { ok: res.ok, status: res.status, url: res.url };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function auditRepoConfig() {
  const cfgPath = path.join(ROOT, "chat-supabase-config.js");
  if (!fs.existsSync(cfgPath)) throw new Error("chat-supabase-config.js missing at repo root");
  const body = fs.readFileSync(cfgPath, "utf8");
  if (!body.includes(PROJECT_REF)) throw new Error(`config missing ref ${PROJECT_REF}`);
  if (!body.includes(`https://${PROJECT_REF}.supabase.co`)) {
    throw new Error("config URL mismatch");
  }
  const anonMatch = body.match(/anonKey:\s*"([^"]+)"/);
  if (!anonMatch) throw new Error("anonKey missing");
  if (/service_role|sb_secret/i.test(anonMatch[1])) throw new Error("service_role in anonKey");
}

function auditDistSync() {
  const mismatches = [];
  for (const rel of DIST_SYNC_FILES) {
    const src = path.join(ROOT, "match", rel);
    const dst = path.join(ROOT, "deploy/cloudflare/dist/match", rel);
    if (!fs.existsSync(src)) {
      mismatches.push(`missing source ${rel}`);
      continue;
    }
    if (!fs.existsSync(dst)) {
      mismatches.push(`missing dist ${rel}`);
      continue;
    }
    if (sha256File(src) !== sha256File(dst)) mismatches.push(`hash drift ${rel}`);
  }
  if (mismatches.length) throw new Error(mismatches.join("; "));
}

async function fetchDeployedConfig(base) {
  const res = await probeUrl(`${base}/chat-supabase-config.js`);
  if (!res.ok) return { found: false, status: res.status, ref: null };
  const ctrl = new AbortController();
  const r = await fetch(`${base}/chat-supabase-config.js`, { signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  const refMatch = text.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  return { found: r.ok, status: r.status, ref: refMatch?.[1] || null, body: text.slice(0, 200) };
}

async function authFetch(cfg, { method, pathSuffix, body, bearer, serviceRole = false }) {
  const key = serviceRole ? cfg.serviceRoleKey : cfg.anonKey;
  const res = await fetch(`${cfg.url}/auth/v1${pathSuffix}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer || key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function loginT1(cfg) {
  const res = await authFetch(cfg, {
    method: "POST",
    pathSuffix: "/token?grant_type=password",
    body: { email: slotByName("T1").email, password: cfg.password },
  });
  if (!res.ok || !res.data?.access_token) throw new Error(`T1 login HTTP ${res.status}`);
  return res.data.access_token;
}

async function edgePost(cfg, functionName, body, token, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(`${cfg.url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }
    if (res.status !== 502 || attempt === retries) return { status: res.status, json };
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("edge retry exhausted");
}

async function runLinkedRefEdgeChecks(cfg) {
  const t1 = await loginT1(cfg);
  const warm = await edgePost(cfg, "match-record-swipe", { target_user_id: "t2", action: "like" }, t1, 2);
  if (warm.status !== 200) throw new Error(`swipe ${warm.status}`);

  const self = await edgePost(cfg, "match-record-swipe", { target_user_id: "t1", action: "like" }, t1);
  if (self.status !== 422) throw new Error(`self ${self.status}`);

  for (const [name, body] of [
    ["match-submit-report", { reported_user_id: "t2", reason: "harassment", detail: "prod url review" }],
    ["match-block-user", { blocked_user_id: "t3", reason: "review" }],
    ["match-submit-verification", { verification_type: "phone", metadata: {} }],
  ]) {
    const res = await edgePost(cfg, name, body, t1);
    if (res.status !== 200 || res.json?.ok !== true) {
      throw new Error(`${name} ${res.status}`);
    }
  }

  const admin = await edgePost(
    cfg,
    "match-admin-review",
    {
      target_type: "report",
      target_id: "00000000-0000-4000-8000-000000000001",
      action: "dismiss",
      note: "review",
    },
    t1,
  );
  if (admin.status !== 403) throw new Error(`admin ${admin.status}`);
}

async function apiHealth(cfg) {
  const authHealth = await fetch(`${cfg.url}/auth/v1/health`, { headers: { apikey: cfg.anonKey } });
  if (authHealth.status >= 500) throw new Error(`auth ${authHealth.status}`);
  const rest = await fetch(`${cfg.url}/rest/v1/`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
  });
  if (rest.status >= 500) throw new Error(`rest ${rest.status}`);
  const edge = await fetch(`${cfg.url}/functions/v1/match-record-swipe`, { method: "OPTIONS" });
  if (edge.status >= 500) throw new Error(`edge ${edge.status}`);
}

function isKnownConsoleMessage(msg) {
  return KNOWN_CONSOLE_PATTERNS.some((re) => re.test(msg));
}

async function ensureReviewBase(base) {
  const probe = await probeUrl(`${base}/match/match-top.html`);
  if (probe.ok) return base;

  const distMarker = path.join(ROOT, "deploy/cloudflare/dist/match/match-top.html");
  if (!fs.existsSync(distMarker)) throw new Error("dist match pages missing");

  if (base !== STANDARD_LOCAL_BASE) {
    throw new Error(`base unreachable: ${base} (${probe.error || probe.status})`);
  }

  spawn(
    "npx",
    ["wrangler", "pages", "dev", "deploy/cloudflare/dist", "--port", "8788", "--ip", "127.0.0.1"],
    { cwd: ROOT, shell: true, stdio: "ignore", detached: true },
  ).unref();

  for (let i = 0; i < 90; i += 1) {
    const retry = await probeUrl(`${STANDARD_LOCAL_BASE}/match/match-top.html`);
    if (retry.ok) return STANDARD_LOCAL_BASE;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("local pages dev failed to start");
}

async function runUiReview(base, t1AccessToken) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  await withPlaywrightBrowser(async (browser) => {
    for (const viewport of MATCH_UI_VIEWPORTS) {
      for (const pageDef of MATCH_PAGES) {
        const page = await browser.newPage({ viewport: matchViewportSize(viewport) });
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("console", (msg) => {
          if (msg.type() === "error" && !isKnownConsoleMessage(msg.text())) {
            errors.push(msg.text());
          }
        });

        const url = buildLocalPageUrl(base, `match/${pageDef.file}`);
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        if (!res || res.status() >= 400) {
          throw new Error(`${pageDef.key} ${viewport.label} HTTP ${res?.status()} @ ${url}`);
        }

        if (!isMatchMinViewport(viewport)) {
          if (pageDef.probe) {
            const found = await page.locator(pageDef.probe).count();
            if (!found) throw new Error(`${pageDef.key} missing probe ${pageDef.probe}`);
          }

          if (errors.length) throw new Error(`${pageDef.key} ${viewport.label} console: ${errors.join(" | ")}`);
        }

        await assertMatchNoHorizontalOverflow(page, pageDef.key, viewport);

        if (viewport.id === MATCH_SCREENSHOT_VIEWPORT.id) {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `${pageDef.key}-${viewport.id}.png`),
            fullPage: true,
          });
        }
        await page.close();
      }
    }

    const swipePage = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
    const edgeCalls = [];
    swipePage.on("request", (req) => {
      const u = req.url();
      if (u.includes(`${PROJECT_REF}.supabase.co/functions/v1/match-`)) {
        edgeCalls.push(u);
      }
    });

    await swipePage.addInitScript(
      ({ functionsBase, token }) => {
        window.__prodReviewEdgeConfigured = false;
        const boot = () => {
          if (!window.TasfulMatchAPI || !window.TasfulMatchAuth) return;
          window.TasfulMatchAuth.configure({
            isAuthenticated: true,
            talkUserId: "t1",
            matchUserId: "t1",
          });
          window.TasfulMatchAPI.configure({
            mode: "edge_stub",
            functionsBaseUrl: functionsBase,
            getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
          });
          window.__prodReviewEdgeConfigured = true;
        };
        document.addEventListener("DOMContentLoaded", boot);
        boot();
      },
      { functionsBase: FUNCTIONS_BASE, token: t1AccessToken },
    );

    await swipePage.goto(buildLocalPageUrl(base, "match/match-swipe.html"), {
      waitUntil: "networkidle",
    });

    const configured = await swipePage.evaluate(() => Boolean(window.__prodReviewEdgeConfigured));
    if (!configured) throw new Error("T1 edge_stub configure failed on swipe page");

    await swipePage.evaluate(() => {
      document.querySelector('[data-match-swipe-action="like"]')?.click();
    });
    await swipePage.waitForTimeout(1200);

    if (!edgeCalls.some((u) => u.endsWith("/match-record-swipe"))) {
      throw new Error("T1 swipe did not call linked ref match-record-swipe");
    }
    await swipePage.close();

    const guestTop = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
    await guestTop.goto(buildLocalPageUrl(base, "match/match-top.html"), { waitUntil: "networkidle" });
    const loginHref = await guestTop.locator('a[href*="dashboard"]').count();
    if (!loginHref) throw new Error("match-top missing login link for guest");
    await guestTop.close();

    const guestPage = await browser.newPage({ viewport: matchViewportSize(MATCH_SCREENSHOT_VIEWPORT) });
    await guestPage.addInitScript(() => {
      const boot = () => {
        window.TasfulMatchAuth?.configure?.({
          isAuthenticated: false,
          talkUserId: "",
          matchUserId: "",
        });
        window.TasfulMatchAPI?.configure?.({
          mode: "edge_stub",
          functionsBaseUrl: "https://example.invalid/functions/v1",
          getAuthHeaders: () => ({}),
        });
      };
      document.addEventListener("DOMContentLoaded", boot);
      boot();
    });
    await guestPage.goto(buildLocalPageUrl(base, "match/match-swipe.html"), { waitUntil: "networkidle" });
    const guestSwipe = await guestPage.evaluate(async () => {
      if (!window.TasfulMatchAPI) return { ok: false, reason: "no api" };
      const res = await window.TasfulMatchAPI.recordSwipe({ target_user_id: "t2", action: "like" });
      return { ok: res?.code === "auth_required", code: res?.code };
    });
    if (!guestSwipe.ok) {
      throw new Error(`guest swipe expected auth_required got ${guestSwipe.code || guestSwipe.reason}`);
    }
    await guestPage.close();
  });

  await closeAllBrowsers();
}

async function main() {
  const cfg = loadL7Config();
  console.log(`MATCH UI prod URL review · base=${reviewBase} · ref=${PROJECT_REF}`);

  let prodReachable = false;
  try {
    const probe = await probeUrl(`${DEFAULT_PROD_BASE}/match/match-top.html`, 12000);
    prodReachable = probe.ok && probe.status === 200;
    if (prodReachable) pass("tasful.jp reachability", `${DEFAULT_PROD_BASE} HTTP 200`);
    else if (isProdBase) fail("tasful.jp reachability", probe.error || `HTTP ${probe.status}`);
    else pass("tasful.jp reachability", `skipped (using --base ${reviewBase})`);
  } catch (e) {
    if (isProdBase) fail("tasful.jp reachability", e.message);
    else pass("tasful.jp reachability", `skipped (${e.message})`);
  }

  try {
    auditRepoConfig();
    pass("Repo chat-supabase-config.js", `ref=${PROJECT_REF}`);
  } catch (e) {
    fail("Repo chat-supabase-config.js", e.message);
  }

  try {
    auditDistSync();
    pass("Cloudflare dist MATCH sync", `${DIST_SYNC_FILES.length} files hash-match source`);
  } catch (e) {
    fail("Cloudflare dist MATCH sync", e.message);
  }

  try {
    const row = runSqlGates();
    if (Number(row.core_table_count) !== 8 || Number(row.rls_enabled_count) !== 8) {
      throw new Error(`schema/rls ${row.core_table_count}/${row.rls_enabled_count}`);
    }
    if (Number(row.policy_count) !== 20) throw new Error(`policies ${row.policy_count}`);
    if (Number(row.allowlist_backfill_count) !== 5 || Number(row.legacy_user_count) !== 7) {
      throw new Error("metadata counts");
    }
    pass("SQL metadata/schema gates", "legacy=7 allowlist=5 tables=8 rls=8 policies=20");
  } catch (e) {
    fail("SQL metadata/schema gates", e.message);
  }

  let uiBase = reviewBase;
  if (!isProdBase || !prodReachable) {
    try {
      uiBase = await ensureReviewBase(STANDARD_LOCAL_BASE);
      pass("UI review base", `prod-parity ${uiBase}/match/*`);
    } catch (e) {
      fail("UI review base", e.message);
    }
  } else {
    pass("UI review base", reviewBase);
  }

  if (results.every((r) => r.ok) || uiBase) {
    try {
      for (const pageDef of MATCH_PAGES) {
        const url = `${uiBase}/match/${pageDef.file}`;
        const res = await probeUrl(url);
        if (!res.ok || res.status >= 400) throw new Error(`${pageDef.key} HTTP ${res.status}`);
      }
      pass("MATCH pages HTTP 200", `${MATCH_PAGES.length} routes @ ${uiBase}`);
    } catch (e) {
      fail("MATCH pages HTTP 200", e.message);
    }
  }

  if (isProdBase && prodReachable) {
    try {
      const deployed = await fetchDeployedConfig(reviewBase);
      if (!deployed.found) throw new Error(`HTTP ${deployed.status}`);
      if (deployed.ref !== PROJECT_REF) {
        throw new Error(`deployed ref=${deployed.ref || "none"}`);
      }
      pass("Deployed chat-supabase-config.js", `ref=${PROJECT_REF}`);
    } catch (e) {
      fail("Deployed chat-supabase-config.js", e.message);
    }
  } else {
    pass("Deployed chat-supabase-config.js", "skipped (prod unreachable · repo config verified)");
  }

  try {
    await runLinkedRefEdgeChecks(cfg);
    pass("Linked ref Edge API", "swipe/report/block/verification 200 · admin 403");
  } catch (e) {
    fail("Linked ref Edge API", e.message);
  }

  try {
    await apiHealth(cfg);
    pass("API health", "auth/rest/edge no 5xx");
  } catch (e) {
    fail("API health", e.message);
  }

  if (results.filter((r) => r.step.startsWith("UI review base")).every((r) => r.ok)) {
    try {
      const t1Token = await loginT1(cfg);
      await runUiReview(uiBase, t1Token);
      pass("UI flows + screenshots", `390×844 / 390×667 / 393×852 · T1 edge call · guest auth_required · ${SCREENSHOT_DIR}`);
    } catch (e) {
      fail("UI flows + screenshots", e.message);
    }
  }

  const ng = results.filter((r) => !r.ok);
  console.log(`\nReview result: ${ng.length === 0 ? "PASS" : "FAIL"} (${results.length} checks)`);

  const blocked = ng.some((r) => r.block !== false) || (isProdBase && !prodReachable);
  if (blocked) {
    if (isProdBase && !prodReachable) {
      console.log("Judgment: BLOCKED_WITH_REASON");
      console.log("Reason: tasful.jp unreachable from runner (DNS/HTTP). Re-run with live prod:");
      console.log("  node scripts/verify-match-ui-prod-url-review.mjs --base https://tasful.jp");
    } else {
      console.log("Judgment: BLOCKED_WITH_REASON");
      console.log(`Reason: ${blockReasons[0] || ng[0]?.detail || "check failures"}`);
    }
    process.exit(1);
  }

  console.log("Judgment: READY_FOR_MATCH_RELEASE_CANDIDATE");
}

main().catch((e) => {
  console.error(e);
  console.log("Judgment: BLOCKED_WITH_REASON");
  process.exit(1);
});
