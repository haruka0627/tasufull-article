#!/usr/bin/env node
import { chromium } from "playwright";

const browser = await chromium.launch();
for (const target of ["u_me", "u_store", "u_xyz_other"]) {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem("tlvDevForceGuest", "1"));
  await page.goto(`http://127.0.0.1:8788/live/profile.html?userId=${target}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(2500);
  const d = await page.evaluate(() => ({
    viewer: window.TasuTlvDevAuth?.getTlvViewerTalkUserId?.() ?? window.TasuLiveConfig?.getTalkUserId?.() ?? "",
    forceGuest: window.TasuTlvDevAuth?.isForceGuest?.(),
    ownManage: Boolean(document.querySelector('a[href="channel-content.html"]')),
    followLink: document.querySelector(".live-follow-slot a")?.getAttribute("href") || null,
    followBtn: document.querySelector("[data-live-follow-btn]")?.textContent?.trim() || null,
    followErr: document.querySelector(".live-hint--error")?.textContent?.trim() || null,
  }));
  console.log(target, JSON.stringify(d));
  await page.close();
}
await browser.close();
