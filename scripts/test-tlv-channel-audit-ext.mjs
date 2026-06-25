#!/usr/bin/env node
/** Extended channel audit — follow, watch-video nav, video card channel click */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8788/live";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

// Get a video id from videos home
await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const videoId = await page.evaluate(() => {
  const a = document.querySelector("[data-live-video-id]");
  return a?.getAttribute("data-live-video-id");
});
console.log("videoId:", videoId);

// Video card: click channel name area vs thumb
const cardClick = await page.evaluate(() => {
  const card = document.querySelector(".live-video-card");
  const channelEl = card?.querySelector(".live-video-card__channel");
  const channelIsLink = channelEl?.closest("a") === card;
  const channelParentTag = channelEl?.parentElement?.tagName;
  return {
    cardHref: card?.getAttribute("href"),
    channelText: channelEl?.textContent?.trim(),
    channelIsInsideCardLink: channelIsLink,
    channelParentTag,
  };
});
console.log("cardClick:", JSON.stringify(cardClick, null, 2));

// watch-video channel nav
if (videoId) {
  await page.goto(`${BASE}/watch-video.html?talkDev=1&id=${encodeURIComponent(videoId)}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(2000);
  const watch = await page.evaluate(() => ({
    channelHref: document.querySelector(".live-watch__channel")?.getAttribute("href"),
    channelName: document.querySelector(".live-watch__channel strong")?.textContent?.trim(),
    subscribeText: document.querySelector(".live-watch__subscribe")?.textContent?.trim(),
    subscribeHasFollowApi: Boolean(document.querySelector("[data-live-follow-btn]")),
    hasDescOverview: Boolean(document.querySelector('[aria-label="概要"]')),
    descText: document.querySelector(".live-watch__desc-card")?.textContent?.slice(0, 80),
    hasError: Boolean(document.querySelector(".live-error")),
  }));
  console.log("watch:", JSON.stringify(watch, null, 2));

  // Navigate channel link
  const ch = page.locator(".live-watch__channel");
  if (await ch.count()) {
    await ch.click();
    await page.waitForTimeout(1500);
    const landed = await page.evaluate(() => ({
      url: location.href,
      hasHeader: Boolean(document.querySelector("[data-tlv-channel-header]")),
      headerName: document.querySelector(".tlv-channel-header__name")?.textContent?.trim(),
    }));
    console.log("watch->profile:", JSON.stringify(landed, null, 2));
  }
}

// Other profile — actions innerHTML
await page.goto(`${BASE}/profile.html?talkDev=1&userId=u_store`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const otherProfile = await page.evaluate(() => ({
  actionsHtml: document.querySelector("[data-live-profile-actions]")?.innerHTML?.trim(),
  talkBtn: Boolean(document.querySelector("[data-live-talk-cta]")),
  followSlot: document.querySelector(".live-follow-slot")?.innerHTML?.trim(),
}));
console.log("otherProfile u_store:", JSON.stringify(otherProfile, null, 2));

// Guest other profile with scripts loaded
const guestPage = await browser.newPage();
await guestPage.addInitScript(() => {
  try {
    localStorage.setItem("tlvDevForceGuest", "1");
  } catch {
    /* ignore */
  }
});
await guestPage.goto(`${BASE}/profile.html?userId=u_store`, { waitUntil: "networkidle" });
await guestPage.waitForTimeout(2000);
const guest = await guestPage.evaluate(() => ({
  getTalkUserId: window.TasuLiveConfig?.getTalkUserId?.() || "",
  actionsHtml: document.querySelector("[data-live-profile-actions]")?.innerHTML?.trim(),
  followSlot: document.querySelector(".live-follow-slot")?.innerHTML?.trim(),
  hasGuestMenu: Boolean(document.querySelector(".tlv-view-acct__guest")),
}));
console.log("guest u_store:", JSON.stringify(guest, null, 2));

// Subscribe on watch as logged-in user
if (videoId) {
  await page.goto(`${BASE}/watch-video.html?talkDev=1&id=${encodeURIComponent(videoId)}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);
  const subBtn = page.locator(".live-watch__subscribe");
  if (await subBtn.count()) {
    page.once("dialog", (d) => d.accept());
    await subBtn.click();
    const afterClick = await page.evaluate(() => ({
      alertShown: true,
      hasFollowBtn: Boolean(document.querySelector("[data-live-follow-btn]")),
    }));
    console.log("subscribe click (logged in):", afterClick);
  }
}

// Playlist card links on own channel
await page.goto(`${BASE}/profile.html?talkDev=1&userId=u_me`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const playlistLinks = await page.evaluate(() =>
  [...document.querySelectorAll(".tlv-channel-playlist-card__media")].map((a) => a.getAttribute("href")),
);
console.log("own playlist hrefs:", playlistLinks);

await browser.close();
