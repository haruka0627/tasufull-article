#!/usr/bin/env node
/**
 * TLV production guest-mode checks (localhost + prod auth simulation)
 *   node scripts/test-tlv-prod-guest-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live";
const PAGES = [
  { file: "videos.html", studio: false },
  { file: "watch-video.html", studio: false, query: "" },
  { file: "shorts.html", studio: false },
  { file: "notifications.html", studio: false },
  { file: "profile.html", studio: false },
  { file: "channel-content.html", studio: true },
];

function prodAuthEvaluate() {
  return `(() => {
    localStorage.setItem("tlvDevForceGuest", "1");
    const dev = window.TasuTlvDevAuth;
    const cfg = window.TasuLiveConfig;
    const authApi = window.TasuAuthCurrentUser;
    const origGet = authApi?.getCurrentUser?.bind(authApi);
    const origCan = authApi?.canUseLocalStorageFallback?.bind(authApi);
    if (authApi) {
      authApi.getCurrentUser = () => ({ authenticated: false, talkUserId: "" });
      authApi.canUseLocalStorageFallback = () => false;
    }
    const metrics = {
      shouldUseTlvDevDemo: dev?.shouldUseTlvDevDemo?.() ?? null,
      getTalkUserId: cfg?.getTalkUserId?.() ?? null,
      isAuthenticatedForTlv: dev?.isAuthenticatedForTlv?.() ?? null,
      followFallback: dev?.shouldUseTlvFollowLocalFallback?.() ?? null,
      rawAuthTalkUserId: origGet?.()?.talkUserId ?? null,
      rawCanLs: origCan?.() ?? null,
    };
    if (authApi && origGet) authApi.getCurrentUser = origGet;
    if (authApi && origCan) authApi.canUseLocalStorageFallback = origCan;
    return metrics;
  })()`;
}

function guestMenuEvaluate(studio) {
  const guestSel = studio ? ".tlv-studio-acct__guest" : ".tlv-view-acct__guest";
  const guestActionsSel = studio
    ? ".tlv-studio-acct__guest-actions a"
    : ".tlv-view-acct__guest-actions a";
  return `(() => {
    const guest = document.querySelector(${JSON.stringify(guestSel)});
    const links = [...document.querySelectorAll(${JSON.stringify(guestActionsSel)})].map((a) => ({
      label: a.textContent.trim(),
      href: a.getAttribute("href") || "",
    }));
    const profile = Boolean(
      document.querySelector(${JSON.stringify(studio ? ".tlv-studio-acct__profile" : ".tlv-view-acct__profile")}),
    );
    return { hasGuest: Boolean(guest), hasProfile: profile, links };
  })()`;
}

function isBenignConsoleError(text) {
  return (
    /MIME type.*not executable/.test(text) ||
    /Supabase が未設定/.test(text)
  );
}

const browser = await chromium.launch();
const consoleErrors = [];
const results = [];

for (const { file, studio, query = "" } of PAGES) {
  const page = await browser.newPage();
  const label = file;
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
      consoleErrors.push(`[${label}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[${label}][pageerror] ${err.message}`);
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem("tlvDevForceGuest", "1");
    } catch {
      /* ignore */
    }
  });

  const url = `${BASE}/${file}${query === null ? "" : query !== undefined ? (query ? `?${query}` : "") : ""}`;
  const finalUrl = file === "watch-video.html" ? `${BASE}/watch-video.html` : `${BASE}/${file}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(finalUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(prodAuthEvaluate());

  const toggleSel = studio
    ? "[data-tlv-studio-acct-toggle]:visible, .tlv-videos-topbar__end [data-tlv-studio-acct-toggle], [data-tlv-studio-acct-toggle]"
    : ".tlv-videos-topbar__end [data-tlv-view-acct-toggle]";

  let menu = { hasGuest: false, hasProfile: false, links: [], toggleFound: 0 };
  const toggleCount = await page.locator(toggleSel).count();
  if (toggleCount > 0) {
    await page.locator(toggleSel).first().click({ force: true });
    await page.waitForTimeout(400);
    // Re-apply prod auth mock so panel renders guest (menu builds on open)
    await page.evaluate(() => {
      localStorage.setItem("tlvDevForceGuest", "1");
      if (window.TasuAuthCurrentUser) {
        window.TasuAuthCurrentUser.getCurrentUser = () => ({ authenticated: false, talkUserId: "" });
        window.TasuAuthCurrentUser.canUseLocalStorageFallback = () => false;
      }
    });
    await page.locator(toggleSel).first().click({ force: true });
    await page.waitForTimeout(400);
    menu = await page.evaluate(guestMenuEvaluate(studio));
    menu.toggleFound = toggleCount;
  } else {
    menu.toggleFound = 0;
  }

  const expectedReturnTo = encodeURIComponent(new URL(finalUrl).pathname);

  results.push({
    file,
    studio,
    url: finalUrl,
    metrics,
    menu,
    checks: {
      shouldDemoFalse: metrics.shouldUseTlvDevDemo === false,
      talkUserIdEmpty: metrics.getTalkUserId === "",
      notUme: metrics.getTalkUserId !== "u_me",
      followFallbackOff: metrics.followFallback === false,
      guestCard: menu.hasGuest === true,
      noProfile: menu.hasProfile === false,
      loginOk: menu.links.find((l) => l.label === "ログイン")?.href?.startsWith("../login.html?returnTo=") ?? false,
      signupOk: menu.links.find((l) => l.label === "アカウント作成")?.href?.startsWith("../signup.html?returnTo=") ?? false,
      noDashboard: menu.links.every((l) => !l.href?.includes("dashboard.html")),
      toggleFound: menu.toggleFound > 0,
    },
    loginHref: menu.links.find((l) => l.label === "ログイン")?.href || null,
    signupHref: menu.links.find((l) => l.label === "アカウント作成")?.href || null,
  });

  await page.close();
}

await browser.close();

const failed = results.filter((r) =>
  Object.entries(r.checks).some(([k, v]) => v === false),
);

console.log(JSON.stringify({ results, consoleErrorCount: consoleErrors.length, consoleErrors, failed: failed.map((f) => f.file) }, null, 2));
process.exit(failed.length || consoleErrors.length ? 1 : 0);
