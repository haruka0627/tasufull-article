#!/usr/bin/env node
/** Post-fix channel audit report data */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8788/live";
const OUT = "scripts/tmp-channel-audit";
const WIDTHS = [390, 768, 1280];
fs.mkdirSync(OUT, { recursive: true });

const report = { checks: [], bugs: [] };

async function shot(page, name, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: false });
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    scrollMatch: document.documentElement.scrollWidth === window.innerWidth,
  }));
  return m;
}

const browser = await chromium.launch();

// 1 own channel
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/profile.html?talkDev=1&userId=u_me`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  for (const w of WIDTHS) {
    const m = await shot(page, "fix-profile-own", w);
    report.checks.push({ item: "1-own-channel", width: w, ...m, ok: m.scrollMatch });
  }
  const tabs = await page.evaluate(() => [...document.querySelectorAll("[data-tlv-channel-tab]")].map((b) => b.textContent.trim()).filter((v, i, a) => a.indexOf(v) === i));
  report.checks.push({ item: "4-6-tabs", tabs, postsSections: await page.evaluate(async () => {
    await document.querySelector('[data-tlv-channel-tab="posts"]')?.click();
    await new Promise((r) => setTimeout(r, 500));
    return [...document.querySelectorAll(".tlv-channel-posts-section__title")].map((el) => el.textContent.trim());
  })});
  await page.close();
}

// 2 other channel logged in
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/profile.html?talkDev=1&userId=u_store`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const other = await page.evaluate(() => ({
    actions: document.querySelector("[data-live-profile-actions]")?.innerText?.trim(),
    followBtn: document.querySelector("[data-live-follow-btn]")?.textContent?.trim() || null,
    followErr: document.querySelector(".live-hint--error")?.textContent?.trim() || null,
    hasHeader: Boolean(document.querySelector("[data-tlv-channel-header]")),
  }));
  report.checks.push({ item: "2-other-channel-logged-in", ...other });
  for (const w of WIDTHS) {
    const m = await shot(page, "fix-profile-other", w);
    report.checks.push({ item: "2-other-channel", width: w, ...m });
  }
  await page.close();
}

// 7-8 guest subscribe CTA
{
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem("tlvDevForceGuest", "1"));
  await page.goto(`${BASE}/profile.html?userId=u_store`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const guest = await page.evaluate(() => ({
    followHref: document.querySelector(".live-follow-slot a")?.getAttribute("href") || null,
    actions: document.querySelector("[data-live-profile-actions]")?.innerText?.trim(),
  }));
  report.checks.push({ item: "7-guest-subscribe-cta", ...guest, loginOk: guest.followHref?.includes("login.html") });
  await page.close();
}

// 10 videos channel link
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/videos.html?talkDev=1`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("tlvDevForceGuest"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const links = await page.evaluate(() => {
    const card = document.querySelector(".live-video-card");
    return {
      channelHref: card?.querySelector(".live-video-card__channel")?.getAttribute("href"),
      avatarHref: card?.querySelector(".live-video-card__avatar")?.getAttribute("href"),
      titleHref: card?.querySelector(".live-video-card__title")?.getAttribute("href"),
    };
  });
  report.checks.push({ item: "10-videos-channel-links", ...links });
  if (links.channelHref?.includes("profile.html")) {
    await page.click(".live-video-card__channel");
    await page.waitForTimeout(1500);
    report.checks.push({
      item: "10-videos-to-profile",
      url: page.url(),
      ok: page.url().includes("profile") && Boolean(await page.$("[data-tlv-channel-header]")),
    });
  }
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.screenshot({ path: `${OUT}/fix-videos-channel-${w}.png` });
  }
  await page.close();
}

// watch-video channel + subscribe
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/watch-video.html?id=4d7e3650-b441-4598-9723-475a956cf68a`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const watch = await page.evaluate(() => ({
    channelHref: document.querySelector(".live-watch__channel")?.getAttribute("href"),
    subscribeBtn: document.querySelector("[data-live-follow-btn]")?.textContent?.trim() || document.querySelector(".live-follow-slot a")?.textContent?.trim() || null,
    hasPlayer: Boolean(document.querySelector("video")),
    hasOverview: Boolean(document.querySelector('[aria-label="概要"]')),
  }));
  report.checks.push({ item: "watch-video-channel", ...watch });
  if (watch.channelHref) {
    await page.click(".live-watch__channel");
    await page.waitForTimeout(1500);
    report.checks.push({ item: "watch-to-profile", url: page.url(), ok: page.url().includes("profile") });
  }
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.screenshot({ path: `${OUT}/fix-watch-channel-${w}.png` });
  }
  await page.close();
}

report.channelHtmlExists = fs.existsSync("live/channel.html");
await browser.close();
console.log(JSON.stringify(report, null, 2));
