#!/usr/bin/env node
/**
 * TLV dev demo auth — production safety checks
 *   node scripts/test-tlv-dev-auth-security.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadTlvDevAuthInVm(hostname, authUser = { authenticated: false, talkUserId: "" }) {
  const code = readFileSync(join(ROOT, "live/tlv-dev-auth.js"), "utf8");
  const sandbox = {
    location: { hostname, pathname: "/live/videos.html", search: "", hash: "" },
    localStorage: {
      _data: {},
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = String(v);
      },
      removeItem(k) {
        delete this._data[k];
      },
    },
    TasuAuthCurrentUser: {
      getCurrentUser() {
        return authUser;
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return { dev: sandbox.TasuTlvDevAuth, sandbox };
}

function runUnitTests() {
  const hosts = [
    ["localhost", true],
    ["127.0.0.1", true],
    ["LOCALHOST", true],
    ["tasufull-article.pages.dev", false],
    ["tasful.jp", false],
    ["www.tasful.jp", false],
    ["192.168.1.1", false],
    ["", false],
  ];

  for (const [host, expected] of hosts) {
    const { dev } = loadTlvDevAuthInVm(host);
    assert(dev.isLocalTlvDevHost() === expected, `isLocalTlvDevHost(${host}) expected ${expected}`);
    assert(
      dev.shouldUseTlvDevDemo() === expected,
      `shouldUseTlvDevDemo(${host}) expected ${expected}`,
    );
  }

  const { dev: local } = loadTlvDevAuthInVm("127.0.0.1");
  local.setForceGuest(true);
  assert(local.isForceGuest() === true, "force guest on local");
  assert(local.shouldUseTlvDevDemo() === false, "force guest disables demo");

  const { dev: prod, sandbox: prodSandbox } = loadTlvDevAuthInVm("tasufull-article.pages.dev");
  prodSandbox.localStorage.setItem("tlvDevForceGuest", "1");
  assert(prod.isForceGuest() === false, "force guest ignored on production host");
  assert(prod.shouldUseTlvDevDemo() === false, "demo disabled on pages.dev");

  const { dev: jwtDev, sandbox: jwtSandbox } = loadTlvDevAuthInVm("localhost");
  jwtSandbox.TasuAuthCurrentUser = {
    getCurrentUser() {
      return { authenticated: true, talkUserId: "u_real_jwt" };
    },
  };
  const resolved = jwtDev.resolveTlvAuthUser();
  assert(resolved.talkUserId === "u_real_jwt", "real JWT not overwritten by demo");
  assert(jwtDev.shouldUseTlvDevDemo() === false, "no demo when JWT present");

  console.log("unit: isLocalTlvDevHost + shouldUseTlvDevDemo — OK");
}

async function openViewMenu(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForSelector(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]", { timeout: 15000 });
  await page.click(".tlv-videos-topbar__end [data-tlv-view-acct-toggle]");
  await page.waitForTimeout(300);
}

async function runBrowserTests() {
  const browser = await chromium.launch();
  const consoleErrors = [];
  const results = [];

  async function track(page, label) {
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
    });
  }

  // 127.0.0.1 — demo enabled
  {
    const page = await browser.newPage();
    track(page, "127.0.0.1");
    await page.goto("http://127.0.0.1:8788/live/videos.html", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
    await page.reload({ waitUntil: "networkidle" });
    await openViewMenu(page);
    const m = await page.evaluate(() => ({
      hostname: location.hostname,
      shouldDemo: TasuTlvDevAuth?.shouldUseTlvDevDemo?.(),
      getTalkUserId: TasuLiveConfig?.getTalkUserId?.() || "",
      guest: !!document.querySelector(".tlv-view-acct__guest"),
      profile: !!document.querySelector(".tlv-view-acct__profile"),
    }));
    results.push({ label: "127.0.0.1", ...m });
    await page.close();
  }

  // localhost — demo enabled
  {
    const page = await browser.newPage();
    track(page, "localhost");
    await page.goto("http://localhost:8788/live/videos.html", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
    await page.reload({ waitUntil: "networkidle" });
    const m = await page.evaluate(() => ({
      hostname: location.hostname,
      shouldDemo: TasuTlvDevAuth?.shouldUseTlvDevDemo?.(),
      getTalkUserId: TasuLiveConfig?.getTalkUserId?.() || "",
    }));
    results.push({ label: "localhost", ...m });
    await page.close();
  }

  // Production auth context: cfg u_me fallback must not apply
  for (const host of ["tasufull-article.pages.dev", "tasful.jp"]) {
    const page = await browser.newPage();
    track(page, host);
    await page.goto("http://127.0.0.1:8788/live/videos.html", { waitUntil: "networkidle" });
    const sim = await page.evaluate(() => {
      const dev = window.TasuTlvDevAuth;
      localStorage.setItem("tlvDevForceGuest", "1");
      const origGet = window.TasuAuthCurrentUser.getCurrentUser;
      const origCan = window.TasuAuthCurrentUser.canUseLocalStorageFallback;
      window.TasuAuthCurrentUser.getCurrentUser = () => ({ authenticated: false, talkUserId: "" });
      window.TasuAuthCurrentUser.canUseLocalStorageFallback = () => false;
      const shouldDemo = dev.shouldUseTlvDevDemo();
      const getTalkUserId = window.TasuLiveConfig.getTalkUserId();
      window.TasuAuthCurrentUser.getCurrentUser = origGet;
      window.TasuAuthCurrentUser.canUseLocalStorageFallback = origCan;
      localStorage.removeItem("tlvDevForceGuest");
      return {
        scriptLoaded: Boolean(dev),
        shouldDemo,
        getTalkUserId,
      };
    });
    results.push({ label: `${host}-prod-auth-sim`, host, ...sim });
    await page.close();
  }

  // JWT must win on local demo host
  {
    const page = await browser.newPage();
    track(page, "jwt-local");
    await page.goto("http://127.0.0.1:8788/live/videos.html", { waitUntil: "networkidle" });
    const jwt = await page.evaluate(() => {
      window.TasuAuthCurrentUser.getCurrentUser = () => ({
        authenticated: true,
        talkUserId: "u_prod_real",
        memberId: "u_prod_real",
        source: "jwt",
      });
      const dev = window.TasuTlvDevAuth;
      return {
        shouldDemo: dev.shouldUseTlvDevDemo(),
        resolved: dev.resolveTlvAuthUser()?.talkUserId,
        getTalkUserId: window.TasuLiveConfig.getTalkUserId(),
        isAuthenticatedForTlv: dev.isAuthenticatedForTlv(),
      };
    });
    results.push({ label: "jwt-overrides-demo-local", ...jwt });
    await page.close();
  }

  await browser.close();

  for (const r of results) console.log(JSON.stringify(r));
  console.log(`\nconsoleErrors: ${consoleErrors.length}`);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.log(e));

  const local127 = results.find((r) => r.label === "127.0.0.1");
  assert(local127?.shouldDemo === true, "127.0.0.1 should enable demo");
  assert(local127?.profile === true, "127.0.0.1 logged-in menu");
  assert(local127?.getTalkUserId === "u_me", "127.0.0.1 demo user id");

  const localhost = results.find((r) => r.label === "localhost");
  assert(localhost?.shouldDemo === true, "localhost should enable demo");

  for (const host of ["tasufull-article.pages.dev", "tasful.jp"]) {
    const row = results.find((r) => r.label === `${host}-prod-auth-sim`);
    assert(row?.scriptLoaded === true, `${host} tlv-dev-auth.js loaded`);
    assert(row?.shouldDemo === false, `${host} dev demo disabled in prod-auth sim`);
    assert(row?.getTalkUserId === "", `${host} getTalkUserId empty under prod auth sim`);
  }

  const jwtRow = results.find((r) => r.label === "jwt-overrides-demo-local");
  assert(jwtRow?.resolved === "u_prod_real", "JWT preserved");
  assert(jwtRow?.shouldDemo === false, "demo off with JWT");
  assert(jwtRow?.getTalkUserId === "u_prod_real", "getTalkUserId uses JWT");

  console.log("\nall security checks passed");
}

runUnitTests();
await runBrowserTests();
