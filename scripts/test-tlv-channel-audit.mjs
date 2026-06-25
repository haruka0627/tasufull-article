#!/usr/bin/env node
/**
 * TLV channel feature audit — localhost Playwright
 *   node scripts/test-tlv-channel-audit.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const OUT = "scripts/tmp-channel-audit";
const WIDTHS = [390, 768, 1280];
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const results = [];

async function auditPage(page, label, url, fn, width = 1280) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}@${width}] ${msg.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${label}@${width}][page] ${e.message}`));

  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1200);
  const data = await fn(page);
  await page.screenshot({ path: `${OUT}/${label}-${width}.png`, fullPage: false });
  results.push({ label, width, url, ...data });
}

const browser = await chromium.launch();

// --- Setup: logged-in demo (u_me) and guest production-sim ---
{
  const page = await browser.newPage();

  // 1) Own channel profile
  await auditPage(
    page,
    "profile-own",
    `${BASE}/profile.html?talkDev=1&userId=u_me`,
    async (p) => {
      await p.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(1000);
      return p.evaluate(() => {
        const header = document.querySelector("[data-tlv-channel-header]");
        const tabs = [...document.querySelectorAll("[data-tlv-channel-tab]")].map((b) => ({
          id: b.getAttribute("data-tlv-channel-tab"),
          label: b.textContent.trim(),
          active: b.classList.contains("is-active"),
        }));
        const actions = document.querySelector("[data-live-profile-actions]");
        const postsBtn = document.querySelector('[data-tlv-channel-tab="posts"]');
        return {
          hasHeader: Boolean(header),
          headerName: document.querySelector(".tlv-channel-header__name")?.textContent?.trim(),
          tabs,
          ownActions: actions?.innerText?.trim() || "",
          hasError: Boolean(document.querySelector(".live-error")),
          loading: Boolean(document.querySelector(".live-loading")),
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          getTalkUserId: window.TasuLiveConfig?.getTalkUserId?.(),
        };
      });
    },
    1280,
  );

  // Click posts tab
  await page.click('[data-tlv-channel-tab="posts"]');
  await page.waitForTimeout(600);
  const postsTab = await page.evaluate(() => ({
    sections: [...document.querySelectorAll(".tlv-channel-posts-section__title")].map((el) =>
      el.textContent.trim(),
    ),
    hasVideos: Boolean(document.querySelector(".tlv-channel-posts-section")),
  }));
  results.push({ label: "profile-own-posts-tab", width: 1280, ...postsTab });

  await page.close();
}

// Other user channel
{
  const page = await browser.newPage();
  await auditPage(
    page,
    "profile-other",
    `${BASE}/profile.html?talkDev=1&userId=u_creator`,
    async (p) => {
      await p.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(1000);
      return p.evaluate(() => ({
        hasHeader: Boolean(document.querySelector("[data-tlv-channel-header]")),
        headerName: document.querySelector(".tlv-channel-header__name")?.textContent?.trim(),
        followBtn: document.querySelector("[data-live-follow-btn]")?.textContent?.trim() || null,
        followLogin: document.querySelector(".live-follow-slot a")?.getAttribute("href") || null,
        hasError: Boolean(document.querySelector(".live-error")),
        tabs: [...document.querySelectorAll("[data-tlv-channel-tab]")].map((b) => b.textContent.trim()),
      }));
    },
    1280,
  );

  // Follow button test (logged in as u_me following u_creator)
  const followBtn = page.locator("[data-live-follow-btn]");
  if (await followBtn.count()) {
    const before = await followBtn.getAttribute("data-following");
    await followBtn.click();
    await page.waitForTimeout(1500);
    const after = await followBtn.getAttribute("data-following");
    await followBtn.click();
    await page.waitForTimeout(1500);
    const restored = await followBtn.getAttribute("data-following");
    results.push({
      label: "profile-other-follow-toggle",
      before,
      after,
      restored,
      toggled: before !== after,
      persisted: before === restored,
    });
  }
  await page.close();
}

// Guest on other profile (production auth sim)
{
  const page = await browser.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("tlvDevForceGuest", "1");
    } catch {
      /* ignore */
    }
  });
  await auditPage(
    page,
    "profile-other-guest",
    `${BASE}/profile.html?userId=u_creator`,
    async (p) => {
      await p.evaluate(() => {
        if (window.TasuAuthCurrentUser) {
          window.TasuAuthCurrentUser.getCurrentUser = () => ({ authenticated: false, talkUserId: "" });
          window.TasuAuthCurrentUser.canUseLocalStorageFallback = () => false;
        }
      });
      return p.evaluate(() => ({
        getTalkUserId: window.TasuLiveConfig?.getTalkUserId?.() || "",
        shouldDemo: window.TasuTlvDevAuth?.shouldUseTlvDevDemo?.(),
        followLoginHref: document.querySelector(".live-follow-slot a")?.getAttribute("href") || null,
        hasGuestAcct: Boolean(document.querySelector(".tlv-view-acct__guest")),
        hasError: Boolean(document.querySelector(".live-error")),
      }));
    },
    1280,
  );
  await page.close();
}

// channel-content.html (Studio)
for (const width of WIDTHS) {
  const page = await browser.newPage();
  await auditPage(
    page,
    "channel-content-studio",
    `${BASE}/channel-content.html?talkDev=1&userId=u_me`,
    async (p) => {
      await p.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(1000);
      return p.evaluate(() => ({
        pageType: document.body.dataset.page,
        hasStudioTable: Boolean(document.querySelector(".tlv-studio-table")),
        studioTabs: [...document.querySelectorAll(".tlv-studio-tab")].map((b) => b.textContent.trim()),
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        scrollMatch: document.documentElement.scrollWidth === window.innerWidth,
      }));
    },
    width,
  );
  await page.close();
}

// videos.html -> channel link
{
  const page = await browser.newPage();
  await auditPage(
    page,
    "videos-channel-link",
    `${BASE}/videos.html?talkDev=1`,
    async (p) => {
      await p.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(1500);
      return p.evaluate(() => {
        const channelLinks = [...document.querySelectorAll('a[href*="profile.html"]')].slice(0, 5).map((a) => ({
          href: a.getAttribute("href"),
          text: a.textContent.trim().slice(0, 40),
        }));
        const cardChannel = document.querySelector(".live-video-card__channel");
        return {
          channelLinks,
          hasVideoCardChannel: Boolean(cardChannel),
          firstChannelHref: cardChannel?.closest("a")?.getAttribute("href") || cardChannel?.getAttribute("href"),
        };
      });
    },
    1280,
  );

  // Navigate to first profile link if exists
  const href = await page.evaluate(() => {
    const a = document.querySelector('.live-video-card a[href*="profile.html"], a.live-video-card__channel[href*="profile"]');
    return a?.getAttribute("href") || document.querySelector('a[href*="profile.html"]')?.getAttribute("href");
  });
  if (href) {
    await page.goto(new URL(href, `${BASE}/videos.html`).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const landed = await page.evaluate(() => ({
      pathname: location.pathname,
      hasHeader: Boolean(document.querySelector("[data-tlv-channel-header]")),
      hasError: Boolean(document.querySelector(".live-error")),
    }));
    results.push({ label: "videos-to-profile-nav", href, ...landed });
  }
  await page.close();
}

// watch-video -> channel (no video id - check link pattern in page shell)
{
  const page = await browser.newPage();
  await auditPage(
    page,
    "watch-video-shell",
    `${BASE}/watch-video.html?talkDev=1`,
    async (p) => {
      await p.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(800);
      return p.evaluate(() => ({
        hasChannelLink: Boolean(document.querySelector(".live-watch__channel")),
        subscribeBtn: Boolean(document.querySelector(".live-watch__subscribe")),
        errorText: document.querySelector(".live-error")?.textContent?.trim() || null,
        descOverview: Boolean(document.querySelector('[data-live-watch-desc-card], [aria-label="概要"]')),
      }));
    },
    1280,
  );
  await page.close();
}

// channel.html existence
results.push({
  label: "channel-html-exists",
  exists: fs.existsSync("live/channel.html"),
});

// profile responsive widths
for (const width of WIDTHS) {
  const page = await browser.newPage();
  await auditPage(
    page,
    "profile-own-responsive",
    `${BASE}/profile.html?talkDev=1&userId=u_me`,
    async (p) => {
      await p.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(1000);
      return p.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        scrollMatch: document.documentElement.scrollWidth === window.innerWidth,
        hasHeader: Boolean(document.querySelector("[data-tlv-channel-header]")),
        headerVisible: (() => {
          const r = document.querySelector(".tlv-channel-header")?.getBoundingClientRect();
          return r ? r.width > 0 && r.height > 0 : false;
        })(),
      }));
    },
    width,
  );
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ results, consoleErrorCount: consoleErrors.length, consoleErrors: consoleErrors.slice(0, 20) }, null, 2));
