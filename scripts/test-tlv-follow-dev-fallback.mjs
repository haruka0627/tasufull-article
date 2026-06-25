#!/usr/bin/env node
/**
 * BUG-5: localhost dev follow localStorage fallback verification
 *   node scripts/test-tlv-follow-dev-fallback.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const PROFILE_URL = `${BASE}/profile.html?talkDev=1&userId=u_store`;
const DEFAULT_VIDEO_ID = "4d7e3650-b441-4598-9723-475a956cf68a";
const CREATOR_ID = "u_store";
const WIDTHS = [390, 768, 1280];
const OUT = "scripts/tmp-follow-dev-fallback";
const SUPABASE_CONFIG_SCRIPT = fs.readFileSync(
  new URL("../chat-supabase-config.js", import.meta.url),
  "utf8",
);
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const results = [];

function isBenignConsoleError(text) {
  return (
    /MIME type.*not executable/.test(text) ||
    /talkDev stub/.test(text) ||
    /Edge functions base URL/.test(text) ||
    /Supabase が未設定/.test(text) ||
    /Failed to load resource.*401/.test(text)
  );
}

function trackConsole(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
      consoleErrors.push(`[${label}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[${label}][pageerror] ${err.message}`);
  });
}

async function waitForWatchVideo(page) {
  await page.waitForFunction(
    () => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      const shells = [
        document.querySelector("[data-tlv-mobile-shell]"),
        document.querySelector("[data-tlv-desktop-shell]"),
        document.body,
      ].filter(Boolean);
      for (const shell of shells) {
        if (!visible(shell)) continue;
        const video = shell.querySelector("[data-live-watch-video]");
        if (video && visible(video)) return true;
      }
      return false;
    },
    { timeout: 90000 },
  );
}

async function resolveWatchVideoId(page) {
  return page.evaluate(async ({ fallback, creatorId }) => {
    const cfg = window.TasuLiveConfig;
    const client = cfg?.getClient?.();
    if (!client) return fallback;
    try {
      await cfg.ensureSupabaseSession?.();
      const { data, error } = await client
        .from(cfg.TABLES.videos)
        .select("id, talk_user_id")
        .eq("status", "published")
        .eq("visibility", "public")
        .eq("talk_user_id", creatorId)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return String(data?.id || fallback).trim() || fallback;
    } catch {
      return fallback;
    }
  }, { fallback: DEFAULT_VIDEO_ID, creatorId: CREATOR_ID });
}

function watchUrl(videoId) {
  return `${BASE}/watch-video.html?id=${encodeURIComponent(videoId)}`;
}

async function waitForFollowButton(page) {
  await page.waitForFunction(
    () => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      const shells = [
        document.querySelector("[data-tlv-mobile-shell]"),
        document.querySelector("[data-tlv-desktop-shell]"),
        document.body,
      ].filter(Boolean);
      for (const shell of shells) {
        if (!visible(shell)) continue;
        const btn = shell.querySelector("[data-live-follow-btn]");
        if (btn && visible(btn)) return true;
      }
      return false;
    },
    { timeout: 30000 },
  );
}

const FOLLOW_BTN = "[data-live-follow-btn]";

async function clickVisibleFollowButton(page) {
  await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const shells = [
      document.querySelector("[data-tlv-mobile-shell]"),
      document.querySelector("[data-tlv-desktop-shell]"),
      document.body,
    ].filter(Boolean);
    for (const shell of shells) {
      if (!visible(shell)) continue;
      const btn = shell.querySelector("[data-live-follow-btn]");
      if (btn && visible(btn)) {
        btn.click();
        return;
      }
    }
  });
}

async function followBtnText(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const shells = [
      document.querySelector("[data-tlv-mobile-shell]"),
      document.querySelector("[data-tlv-desktop-shell]"),
      document.body,
    ].filter(Boolean);
    let btn = null;
    for (const shell of shells) {
      if (!visible(shell)) continue;
      const candidate = shell.querySelector("[data-live-follow-btn]");
      if (candidate && visible(candidate)) {
        btn = candidate;
        break;
      }
    }
    const login = [...document.querySelectorAll(".live-follow-slot a")].find(visible);
    return {
      btn: btn?.textContent?.trim() || null,
      following: btn?.getAttribute("data-following") || null,
      login: login?.textContent?.trim() || null,
      loginHref: login?.getAttribute("href") || null,
      err: document.querySelector(".live-hint--error")?.textContent?.trim() || null,
      fallback: window.TasuTlvDevAuth?.shouldUseTlvFollowLocalFallback?.() ?? null,
      viewerId: window.TasuLiveFollow?.getFollowViewerId?.() ?? null,
      storeKey: window.TasuTlvDevAuth?.followEntryKey?.(
        window.TasuLiveFollow?.getFollowViewerId?.(),
        "u_store",
      ) ?? null,
      stored: window.TasuTlvDevAuth?.isDevFollowStored?.(
        window.TasuLiveFollow?.getFollowViewerId?.(),
        "u_store",
      ) ?? null,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    };
  });
}

async function runProfileFlow(width) {
  const page = await context.newPage();
  const label = `profile-${width}`;
  trackConsole(page, label);

  await page.setViewportSize({ width, height: 900 });
  await page.goto(PROFILE_URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    window.TasuTlvDevAuth?.clearDevFollowStore?.();
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitForFollowButton(page);
  await page.waitForTimeout(800);

  const initial = await followBtnText(page);
  await clickVisibleFollowButton(page);
  await page.waitForTimeout(600);
  const afterFollow = await followBtnText(page);
  const storeAfterFollow = await page.evaluate(() => localStorage.getItem("tlvDevFollowStore"));

  await page.reload({ waitUntil: "networkidle" });
  await waitForFollowButton(page);
  await page.waitForTimeout(800);
  const afterReload = await followBtnText(page);

  await clickVisibleFollowButton(page);
  await page.waitForTimeout(600);
  const afterUnfollow = await followBtnText(page);

  await page.screenshot({ path: `${OUT}/profile-follow-${width}.png`, fullPage: false });

  const checks = {
    fallbackOn: initial.fallback === true,
    viewerUme: initial.viewerId === "u_me",
    initialNotFollowing: initial.following === "0" && initial.btn === "チャンネル登録",
    noErrInitial: !initial.err,
    afterFollowOk: afterFollow.following === "1" && afterFollow.btn === "登録済み",
    storedAfterFollow: afterFollow.stored === true,
    persistAfterReload: afterReload.following === "1" && afterReload.btn === "登録済み",
    afterUnfollowOk: afterUnfollow.following === "0" && afterUnfollow.btn === "チャンネル登録",
    storedAfterUnfollow: afterUnfollow.stored === false,
    storeKeyFormat: afterFollow.storeKey === "u_me::u_store",
    storeHasEntry: storeAfterFollow?.includes('"u_me::u_store":true') === true,
    scrollMatch: afterUnfollow.scrollW === afterUnfollow.innerW,
  };

  results.push({
    page: "profile",
    width,
    initial,
    afterFollow,
    afterReload,
    afterUnfollow,
    checks,
    pass: Object.values(checks).every(Boolean),
  });

  await page.close();
}

async function runWatchFlow(width, videoId) {
  const page = await context.newPage();
  const label = `watch-${width}`;
  trackConsole(page, label);

  await page.setViewportSize({ width, height: 900 });
  await page.goto(watchUrl(videoId), { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem("tlvDevForceGuest");
    window.TasuTlvDevAuth?.clearDevFollowStore?.();
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitForWatchVideo(page);
  await waitForFollowButton(page);
  await page.waitForTimeout(800);

  const pageState = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const shells = [
      document.querySelector("[data-tlv-mobile-shell]"),
      document.querySelector("[data-tlv-desktop-shell]"),
      document.body,
    ].filter(Boolean);
    let btn = null;
    let video = null;
    let channel = null;
    for (const shell of shells) {
      if (!visible(shell)) continue;
      btn = btn || [...shell.querySelectorAll("[data-live-follow-btn]")].find(visible) || null;
      video = video || shell.querySelector("[data-live-watch-video]");
      channel = channel || shell.querySelector(".live-watch__channel-handle");
      if (btn && video && channel) break;
    }
    return {
      hasVideo: Boolean(video && visible(video)),
      channel: channel?.textContent?.trim() || null,
      title: document.querySelector(".live-watch__title")?.textContent?.trim() || null,
      btn: btn?.textContent?.trim() || null,
      following: btn?.getAttribute("data-following") || null,
      fallback: window.TasuTlvDevAuth?.shouldUseTlvFollowLocalFallback?.() ?? null,
      viewerId: window.TasuLiveFollow?.getFollowViewerId?.() ?? null,
      storeKey:
        window.TasuTlvDevAuth?.followEntryKey?.(
          window.TasuLiveFollow?.getFollowViewerId?.(),
          "u_store",
        ) ?? null,
      stored:
        window.TasuTlvDevAuth?.isDevFollowStored?.(
          window.TasuLiveFollow?.getFollowViewerId?.(),
          "u_store",
        ) ?? null,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    };
  });

  const initial = pageState;
  await clickVisibleFollowButton(page);
  await page.waitForTimeout(600);
  const afterFollow = await followBtnText(page);
  const storeAfterFollow = await page.evaluate(() => localStorage.getItem("tlvDevFollowStore"));

  await page.reload({ waitUntil: "networkidle" });
  await waitForWatchVideo(page);
  await waitForFollowButton(page);
  await page.waitForTimeout(800);
  const afterReload = await followBtnText(page);

  await clickVisibleFollowButton(page);
  await page.waitForTimeout(600);
  const afterUnfollow = await followBtnText(page);

  await page.screenshot({ path: `${OUT}/watch-follow-${width}.png`, fullPage: false });

  const checks = {
    hasVideo: initial.hasVideo === true,
    hasChannel: initial.channel === `@${CREATOR_ID}`,
    fallbackOn: initial.fallback === true,
    viewerUme: initial.viewerId === "u_me",
    initialNotFollowing: initial.following === "0" && initial.btn === "チャンネル登録",
    afterFollowOk: afterFollow.following === "1" && afterFollow.btn === "登録済み",
    storedAfterFollow: afterFollow.stored === true,
    persistAfterReload: afterReload.following === "1" && afterReload.btn === "登録済み",
    afterUnfollowOk: afterUnfollow.following === "0" && afterUnfollow.btn === "チャンネル登録",
    storedAfterUnfollow: afterUnfollow.stored === false,
    storeKeyFormat: afterFollow.storeKey === "u_me::u_store",
    storeHasEntry: storeAfterFollow?.includes('"u_me::u_store":true') === true,
    scrollMatch: afterReload.scrollW === afterReload.innerW,
  };

  results.push({
    page: "watch-video",
    width,
    videoId,
    mount: "bindWatchInteractions → mountFollowButton(channelMode)",
    initial,
    afterFollow,
    afterReload,
    afterUnfollow,
    checks,
    pass: Object.values(checks).every(Boolean),
  });

  await page.close();
}

async function runGuestCheck() {
  const page = await context.newPage();
  trackConsole(page, "guest");

  await page.addInitScript(() => {
    localStorage.setItem("tlvDevForceGuest", "1");
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${BASE}/profile.html?talkDev=1&userId=u_store`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await waitForFollowButton(page).catch(() => null);
  await page.waitForSelector(".live-follow-slot a", { timeout: 30000 }).catch(() => null);

  const guest = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const login = [...document.querySelectorAll(".live-follow-slot a")].find(visible);
    const dashboardInFollow = [...document.querySelectorAll(".live-follow-slot a")].some((a) =>
      (a.getAttribute("href") || "").includes("dashboard.html"),
    );
    return {
      fallback: window.TasuTlvDevAuth?.shouldUseTlvFollowLocalFallback?.() ?? null,
      loginHref: login?.getAttribute("href") || null,
      loginLabel: login?.textContent?.trim() || null,
      hasFollowBtn: [...document.querySelectorAll("[data-live-follow-btn]")].some(visible),
      hasActions: Boolean(document.querySelector("[data-live-profile-actions]")),
      dashboardInFollow,
    };
  });

  results.push({
    page: "guest",
    checks: {
      fallbackOff: guest.fallback === false,
      loginCta: guest.loginLabel === "ログインして登録",
      loginHrefOk: guest.loginHref?.includes("login.html?returnTo=") ?? false,
      noFollowBtn: guest.hasFollowBtn === false,
      noDashboard: guest.dashboardInFollow === false,
    },
    guest,
    pass:
      guest.fallback === false &&
      guest.loginLabel === "ログインして登録" &&
      guest.loginHref?.includes("login.html?returnTo=") &&
      !guest.hasFollowBtn &&
      !guest.dashboardInFollow,
  });

  await page.close();
}

async function runWatchGuestCheck(videoId) {
  const page = await context.newPage();
  trackConsole(page, "watch-guest");

  await page.addInitScript(() => {
    localStorage.setItem("tlvDevForceGuest", "1");
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(watchUrl(videoId), { waitUntil: "networkidle", timeout: 120000 });
  await waitForWatchVideo(page).catch(() => null);
  await page.waitForTimeout(1500);

  const guest = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };
    const login = [...document.querySelectorAll(".live-follow-slot a")].find(visible);
    return {
      fallback: window.TasuTlvDevAuth?.shouldUseTlvFollowLocalFallback?.() ?? null,
      loginHref: login?.getAttribute("href") || null,
      loginLabel: login?.textContent?.trim() || null,
      hasFollowBtn: [...document.querySelectorAll("[data-live-follow-btn]")].some(visible),
      hasVideo: Boolean(document.querySelector("[data-live-watch-video]")),
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    };
  });

  results.push({
    page: "watch-guest",
    videoId,
    checks: {
      fallbackOff: guest.fallback === false,
      loginCta: guest.loginLabel === "ログインして登録",
      loginHrefOk: guest.loginHref?.includes("login.html?returnTo=") ?? false,
      noFollowBtn: guest.hasFollowBtn === false,
      scrollMatch: guest.scrollW === guest.innerW,
    },
    guest,
    pass:
      guest.fallback === false &&
      guest.loginLabel === "ログインして登録" &&
      guest.loginHref?.includes("login.html?returnTo=") &&
      !guest.hasFollowBtn &&
      guest.scrollW === guest.innerW,
  });

  await page.close();
}

async function runProdFallbackOffCheck() {
  const page = await context.newPage();
  trackConsole(page, "prod-fallback-off");

  await page.addInitScript(() => {
    localStorage.setItem("tlvDevForceGuest", "1");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/profile.html?userId=u_store`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => {
    const authApi = window.TasuAuthCurrentUser;
    const origGet = authApi?.getCurrentUser?.bind(authApi);
    const origCan = authApi?.canUseLocalStorageFallback?.bind(authApi);
    if (authApi) {
      authApi.getCurrentUser = () => ({ authenticated: false, talkUserId: "" });
      authApi.canUseLocalStorageFallback = () => false;
    }
    const out = {
      shouldUseTlvDevDemo: window.TasuTlvDevAuth?.shouldUseTlvDevDemo?.() ?? null,
      followFallback: window.TasuTlvDevAuth?.shouldUseTlvFollowLocalFallback?.() ?? null,
      getTalkUserId: window.TasuLiveConfig?.getTalkUserId?.() ?? null,
    };
    if (authApi && origGet) authApi.getCurrentUser = origGet;
    if (authApi && origCan) authApi.canUseLocalStorageFallback = origCan;
    return out;
  });

  results.push({
    page: "prod-sim",
    metrics,
    checks: {
      demoFalse: metrics.shouldUseTlvDevDemo === false,
      fallbackOff: metrics.followFallback === false,
      talkUserIdEmpty: metrics.getTalkUserId === "",
      notUme: metrics.getTalkUserId !== "u_me",
    },
    pass:
      metrics.shouldUseTlvDevDemo === false &&
      metrics.followFallback === false &&
      metrics.getTalkUserId === "",
  });

  await page.close();
}

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addInitScript(SUPABASE_CONFIG_SCRIPT);

const probePage = await context.newPage();
await probePage.goto(watchUrl(DEFAULT_VIDEO_ID), { waitUntil: "networkidle", timeout: 120000 });
const resolvedVideoId = await resolveWatchVideoId(probePage);
await probePage.close();

for (const width of WIDTHS) {
  await runProfileFlow(width);
  await runWatchFlow(width, resolvedVideoId);
}
await runGuestCheck();
await runWatchGuestCheck(resolvedVideoId);
await runProdFallbackOffCheck();

await context.close();
await browser.close();

const failed = results.filter((r) => !r.pass);
const summary = {
  resolvedVideoId,
  results,
  failed: failed.map((r) => `${r.page}-${r.width || ""}`),
  consoleErrorCount: consoleErrors.length,
  consoleErrors: [...new Set(consoleErrors)],
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length || consoleErrors.length ? 1 : 0);
