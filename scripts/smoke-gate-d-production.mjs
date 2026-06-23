#!/usr/bin/env node
/**
 * Gate-D — Production pages.dev smoke (Cloudflare Access 配下)
 *
 *   node --env-file=.env scripts/smoke-gate-d-production.mjs
 *   node scripts/smoke-gate-d-production.mjs --storage-state reports/gate-d-auth-storage.json
 *
 * Env (optional): CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DEFAULT_BASE = "https://tasufull-article.pages.dev";

const URLS = [
  { id: "top", path: "/index.html", module: "TOP" },
  { id: "talk", path: "/talk-home.html", module: "TALK" },
  { id: "match-top", path: "/match/match-top.html", module: "MATCH" },
  { id: "match-list", path: "/match/match-list.html", module: "MATCH" },
  { id: "match-bridge", path: "/match/match-talk-bridge.html", module: "MATCH" },
  { id: "builder", path: "/builder/index.html", module: "Builder" },
  { id: "shop", path: "/shop-store.html", module: "Shop" },
  { id: "live-index", path: "/live/index.html", module: "LIVE", optional: true },
  { id: "live-shorts", path: "/live/shorts.html", module: "LIVE", optional: true },
];

const ALLOWED_CONSOLE = [
  /favicon/i,
  /manifest/i,
  /Failed to load resource.*favicon/i,
  /net::ERR_/i, // only if we classify below
];

function parseArgs() {
  const baseIdx = process.argv.indexOf("--base");
  const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
  const storageIdx = process.argv.indexOf("--storage-state");
  const storageState = storageIdx >= 0 ? process.argv[storageIdx + 1] : null;
  return { base: base.replace(/\/$/, ""), storageState };
}

function isAccessLogin(url, body) {
  if (/cloudflareaccess\.com/i.test(url)) return true;
  if (/cdn-cgi\/access\/login/i.test(url)) return true;
  if (body && /Cloudflare Access|Get a login code|One-time PIN/i.test(body)) return true;
  return false;
}

function classifyConsoleError(text) {
  if (ALLOWED_CONSOLE.some((re) => re.test(text))) return "ignore";
  if (/401|403|Unauthorized|JWT|session/i.test(text)) return "auth-maybe-ok";
  if (/supabase/i.test(text)) return "supabase-error";
  return "critical";
}

/** @type {Record<string, unknown>[]} */
const results = [];

async function smokeUrl(page, base, spec) {
  const url = `${base}${spec.path}`;
  const consoleMsgs = [];
  const responses = [];

  const onConsole = (msg) => {
    if (msg.type() === "error") consoleMsgs.push({ type: "error", text: msg.text() });
  };
  const onPageError = (err) => consoleMsgs.push({ type: "pageerror", text: String(err) });
  const onResponse = (res) => {
    const u = res.url();
    const status = res.status();
    const rt = res.request().resourceType();
    if (
      rt === "document" ||
      u.includes("chat-supabase-config.js") ||
      u.includes("supabase.co") ||
      u.includes("/functions/v1/")
    ) {
      responses.push({ url: u, status, type: rt });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let navError = null;
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const finalUrl = page.url();
    const body = await page.content();
    const title = await page.title();

    const docStatus = resp?.status() ?? 0;
    const blocked = isAccessLogin(finalUrl, body) || docStatus === 302 || /302 Found/i.test(body.slice(0, 500));

    const cfg = responses.find((r) => r.url.includes("chat-supabase-config.js"));
    const supa = responses.filter((r) => r.url.includes("supabase.co"));
    const edge = responses.filter((r) => r.url.includes("/functions/v1/"));
    const storage = responses.filter((r) => r.url.includes("/storage/v1/"));

    const critical = consoleMsgs.filter((m) => classifyConsoleError(m.text) === "critical");
    const supaErr = consoleMsgs.filter((m) => classifyConsoleError(m.text) === "supabase-error");

    const blank = body.length < 200 && !blocked;
    const has404doc = docStatus === 404 || docStatus >= 500;

    let verdict = "PASS";
    let note = "";

    if (blocked) {
      verdict = "BLOCKED";
      note = "Cloudflare Access login — OTP session or Service Token required";
    } else if (has404doc || blank) {
      verdict = "FAIL";
      note = has404doc ? `document HTTP ${docStatus}` : "blank/short body";
    } else if (supaErr.length > 0) {
      verdict = "FAIL";
      note = `supabase console: ${supaErr[0].text.slice(0, 120)}`;
    } else if (critical.length > 0) {
      verdict = "FAIL";
      note = `console: ${critical[0].text.slice(0, 120)}`;
    } else if (!cfg && !spec.path.includes("match") && !spec.path.includes("match-talk-bridge")) {
      verdict = "HOLD";
      note = "chat-supabase-config.js not observed in network (may be cached)";
    }

    if (spec.path.includes("match-list")) {
      const hasMatchShell = body.includes("match-app") || body.includes("マッチ一覧");
      if (!hasMatchShell && verdict === "PASS") {
        verdict = "FAIL";
        note = "match list shell missing";
      } else if (verdict === "PASS") {
        note = note || "match CTA absent (expected without MATCH login)";
      }
    } else if (spec.path.includes("match-talk-bridge")) {
      const hasLoginGate =
        body.includes("data-match-login-gate") || body.includes("ログインが必要です");
      const hasBridge =
        body.includes("data-match-talk-cta") ||
        body.includes("メッセージする") ||
        body.includes("match-bridge");
      if (hasLoginGate && verdict === "PASS") {
        note = note || "login gate shown (expected without MATCH JWT)";
      } else if (!hasBridge && !hasLoginGate && verdict === "PASS") {
        verdict = "FAIL";
        note = "match talk bridge shell missing";
      } else if (hasBridge && verdict === "PASS") {
        note = note || "bridge shell OK";
      }
    }

    const row = {
      url: spec.path,
      module: spec.module,
      verdict,
      display: blocked ? "Access login" : `OK title=${title.slice(0, 40)}`,
      console: critical.length ? critical.map((c) => c.text.slice(0, 100)).join(" | ") : "no critical errors",
      networkDocument: `${docStatus} ${finalUrl.slice(0, 80)}`,
      configJs: cfg ? `${cfg.status}` : "not seen",
      supabaseApi: supa.length ? supa.map((r) => `${r.status}`).join(",") : "none",
      edge: edge.length ? edge.map((r) => `${r.status}`).join(",") : "n/a",
      storage: storage.length ? storage.map((r) => `${r.status}`).join(",") : "n/a",
      note,
      optional: !!spec.optional,
    };
    results.push(row);
    console.log(`  ${verdict.padEnd(8)} ${spec.path} — ${note || row.display}`);
  } catch (e) {
    navError = String(e.message || e);
    results.push({
      url: spec.path,
      module: spec.module,
      verdict: "FAIL",
      display: "navigation error",
      console: navError,
      networkDocument: "error",
      configJs: "-",
      supabaseApi: "-",
      edge: "-",
      storage: "-",
      note: navError,
      optional: !!spec.optional,
    });
    console.log(`  FAIL     ${spec.path} — ${navError}`);
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
}

async function main() {
  const { base, storageState } = parseArgs();
  const accessId = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();
  const hasServiceToken = !!(accessId && accessSecret);
  const hasStorage = storageState && fs.existsSync(storageState);

  console.log(`[gate-d-smoke] base=${base}`);
  console.log(`[gate-d-smoke] service_token=${hasServiceToken} storage_state=${hasStorage}`);

  if (!hasServiceToken && !hasStorage) {
    console.warn(
      "[gate-d-smoke] WARN: No CF_ACCESS_* or --storage-state — expect BLOCKED on Access-protected host"
    );
  }

  const extraHeaders = hasServiceToken
    ? { "CF-Access-Client-Id": accessId, "CF-Access-Client-Secret": accessSecret }
    : {};

  await withPlaywrightBrowser(async (browser) => {
    const contextOpts = {
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: extraHeaders,
    };
    if (hasStorage) contextOpts.storageState = path.resolve(storageState);

    const context = await browser.newContext(contextOpts);
    const page = await context.newPage();

    for (const spec of URLS) {
      await smokeUrl(page, base, spec);
    }

    await context.close();
  });

  await closeAllBrowsers();

  const required = results.filter((r) => !r.optional);
  const blocked = required.filter((r) => r.verdict === "BLOCKED");
  const failed = required.filter((r) => r.verdict === "FAIL");
  const hold = required.filter((r) => r.verdict === "HOLD");
  const passed = required.filter((r) => r.verdict === "PASS");

  console.log("\n--- Summary ---");
  console.log(`  PASS: ${passed.length}  HOLD: ${hold.length}  FAIL: ${failed.length}  BLOCKED: ${blocked.length}`);

  const outPath = path.join(ROOT, "reports", "gate-d-smoke-last.json");
  fs.writeFileSync(outPath, JSON.stringify({ base, hasServiceToken, hasStorage, results }, null, 2));
  console.log(`[gate-d-smoke] wrote ${outPath}`);

  if (failed.length > 0) process.exit(1);
  if (blocked.length === required.length) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
