#!/usr/bin/env node
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
/**
 * NB-1B — Cloudflare Pages smoke (*.pages.dev or local dist)
 *
 *   # local dist (start static server first on 8788)
 *   npx --yes serve deploy/cloudflare/dist -p 8788
 *   node scripts/smoke-cloudflare-pages.mjs --base http://127.0.0.1:8788
 *
 *   # after CF deploy
 *   node scripts/smoke-cloudflare-pages.mjs --base https://<project>.pages.dev
 */
import { chromium } from "./lib/playwright-browser.mjs";
import {
  canUseLocalStorageFallback,
  isProductionHost,
} from "./lib/auth-current-user-core.mjs";

const PAGES = [
  { path: "/", file: "index.html" },
  { path: "/talk-home.html" },
  { path: "/dashboard.html" },
  { path: "/shop-store.html" },
  { path: "/shop-products.html" },
  { path: "/payment-settings.html" },
  { path: "/builder/", file: "builder/index.html" },
  { path: "/ai-workspace.html" },
];

function parseArgs() {
  const i = process.argv.indexOf("--base");
  const base = i >= 0 ? process.argv[i + 1] : process.env.PAGES_BASE_URL || "";
  if (!base) {
    console.error("Usage: node scripts/smoke-cloudflare-pages.mjs --base <origin>");
        process.exit(2);
  }
  return base.replace(/\/$/, "");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const base = parseArgs();
  console.log(`[smoke-pages] base=${base}`);

  assert(!isProductionHost({ hostname: new URL(base).hostname }), "smoke base should not be tasful.jp yet");
  passNote("hostname is not production apex — using talkProductionMode simulation");

  await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage();
  const consoleErrors = [];
  const failedAssets = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err.message || err)));
  page.on("response", (res) => {
    const url = res.url();
    const type = res.request().resourceType();
    if (res.status() === 404 && (type === "script" || type === "stylesheet")) {
      failedAssets.push(url);
    }
  });

  const results = [];
  let configBody = "";

  try {
    const cfgRes = await fetch(`${base}/chat-supabase-config.js`);
    assert(cfgRes.ok, `chat-supabase-config.js HTTP ${cfgRes.status}`);
    configBody = await cfgRes.text();
    assert(!/currentUserId/.test(configBody), "static config: currentUserId present");
    assert(!/\bme\s*:/.test(configBody), "static config: me present");
    assert(!/u_me/.test(configBody), "static config: u_me present");
  console.log("  PASS chat-supabase-config.js static audit");

    for (const entry of PAGES) {
      const url = `${base}${entry.path}`;
      const res = await page.goto(url, { waitUntil: "load", timeout: 45000 });
      const status = res?.status() ?? 0;
      const ok = status >= 200 && status < 400;
      results.push({ url, status, ok });

      const assets = await page.evaluate(async () => {
        const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
        const localCss = sheets
          .map((l) => l.getAttribute("href") || "")
          .filter((h) => h && !h.startsWith("http"));
        const cssStatuses = await Promise.all(
          localCss.map(async (href) => {
            try {
              const r = await fetch(href, { method: "HEAD" });
              return r.ok;
            } catch {
              return false;
            }
          })
        );
        const cssOk = localCss.length === 0 || cssStatuses.every(Boolean);
        const hasConfig = typeof window.TASU_CHAT_SUPABASE_CONFIG !== "undefined";
        const hasAuth = typeof window.TasuAuthCurrentUser !== "undefined";
        return { cssOk, hasConfig, hasAuth, localCssCount: localCss.length };
      });

      assert(ok, `HTTP ${status} for ${url}`);
      assert(assets.hasConfig, `missing TASU_CHAT_SUPABASE_CONFIG on ${url}`);
      assert(assets.cssOk, `CSS failed to load on ${url}`);
      console.log(
        `  PASS ${entry.path} (${status}) config=${assets.hasConfig} css=${assets.localCssCount} auth=${assets.hasAuth}`
      );
    }

    await page.goto(`${base}/talk-home.html`, { waitUntil: "load" });
    await page.waitForFunction(() => typeof window.TasuAuthCurrentUser !== "undefined", { timeout: 15000 });

    const fallback = await runFallbackSuite(page, base);
    for (const [key, ok] of Object.entries(fallback)) {
      assert(ok, `fallback: ${key} must be blocked under talkProductionMode`);
      console.log(`  PASS fallback: ${key}`);
    }
    console.log("  PASS fallback lockdown (talkProductionMode simulation)");

    assert(
      !canUseLocalStorageFallback({ hostname: "tasful.jp" }),
      "core policy: tasful.jp blocks LS fallback"
    );
    console.log("  PASS core policy isProductionHost(tasful.jp)");

    const filtered = consoleErrors.filter(
      (e) =>
        !/favicon/i.test(e) &&
        !/Failed to load resource.*404/i.test(e) &&
        !/Failed to load resource.*401/i.test(e) &&
        !/Failed to load resource.*400/i.test(e) &&
        !/net::ERR_BLOCKED_BY_CLIENT/i.test(e) &&
        !/\[Dashboard\] loadDashboard failed/i.test(e) &&
        !/\[Dashboard\] initMemberShell failed/i.test(e)
    );
    if (filtered.length) {
      console.warn("[smoke-pages] console errors:", filtered.slice(0, 10));
    }
    assert(failedAssets.length === 0, `JS/CSS 404: ${failedAssets.join(", ")}`);
    assert(filtered.length === 0, `console errors: ${filtered.join(" | ")}`);

    console.log("\n[smoke-pages] SUMMARY: PASS");
  } catch (err) {
    console.error("\n[smoke-pages] SUMMARY: FAIL —", err.message);
    process.exitCode = 1;
  }  });
  
}

function passNote(msg) {
  console.log(`[smoke-pages] NOTE: ${msg}`);
}

async function enableProductionMode(page) {
  await page.evaluate(() => {
    window.TASU_CHAT_SUPABASE_CONFIG = window.TASU_CHAT_SUPABASE_CONFIG || {};
    window.TASU_CHAT_SUPABASE_CONFIG.talkProductionMode = true;
    localStorage.removeItem("tasu-supabase-auth");
  });
}

async function runFallbackSuite(page, base) {
  const out = {};

  await page.goto(`${base}/talk-home.html`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.TasuAuthCurrentUser !== "undefined", { timeout: 15000 });
  await enableProductionMode(page);

  const talk = await page.evaluate(() => {
    const auth = window.TasuAuthCurrentUser;
    localStorage.setItem("tasu_member_session", JSON.stringify({ userId: "u_ls_fake" }));
    const uMeBlocked = auth.getCurrentUser().talkUserId === "";
    const params = new URLSearchParams("?role=owner&talkAdmin=1&userId=u_url_fake");
    window.history.replaceState({}, "", `${location.pathname}?${params}`);
    const urlRoleBlocked =
      window.TasuBuilderActorIdentity?.getBuilderActor?.().viewRole !== "owner";
    const talkAdminBlocked = auth.isOpsPreviewActive() !== true;
    return { uMeBlocked, urlRoleBlocked, talkAdminBlocked };
  });
  Object.assign(out, talk);

  await page.goto(`${base}/builder/`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.TasuBuilderActorIdentity !== "undefined", { timeout: 15000 });
  await enableProductionMode(page);
  const builder = await page.evaluate(() => {
    localStorage.setItem("tasful:builder:mvp:role", "owner");
    return {
      lsRoleBlocked: window.TasuBuilderActorIdentity?.getBuilderActor?.().viewRole !== "owner",
    };
  });
  out.lsRoleBlocked = builder.lsRoleBlocked;

  await page.goto(`${base}/payment-settings.html`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.TasuConnectState !== "undefined", { timeout: 15000 });
  await enableProductionMode(page);
  const connect = await page.evaluate(() => {
    localStorage.setItem("tasful_connect_onboarding_v1", JSON.stringify({ step: "ready" }));
    window.TasuConnectState?.invalidateConnectStateCache?.();
    return {
      connectLsBlocked: window.TasuConnectState?.getConnectState?.().ready !== true,
    };
  });
  out.connectLsBlocked = connect.connectLsBlocked;

  await page.goto(`${base}/shop-market-cart.html`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.TasuMarketIdentity !== "undefined", { timeout: 15000 });
  await enableProductionMode(page);
  const market = await page.evaluate(() => {
    localStorage.setItem("tasu_market_seller_profile", JSON.stringify({ shopId: "demo-shop-tasful-bakery" }));
    window.TasuMarketIdentity?.invalidateMarketIdentityCache?.();
    const sellerBlocked =
      window.TasuMarketIdentity?.getMarketIdentity?.().sellerShopId !== "demo-shop-tasful-bakery";
    return { buyerSellerLsBlocked: sellerBlocked };
  });
  out.buyerSellerLsBlocked = market.buyerSellerLsBlocked;

  return out;
}

main();
