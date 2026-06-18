#!/usr/bin/env node
/**
 * chat-detail header screenshots — 390px + PC
 *   node scripts/capture-chat-detail-header-390.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "chat-detail.html" });
const OUT = path.join("reports", "screenshots", "tasful-ai-talk");
const CHAT_URL = buildLocalPageUrl(
  base,
  "chat-detail.html",
  "?thread=chat-demo-skill-deal-001&userId=u_me&talkDev=1&review=chat-demo"
);

async function seedPremiumHomeHeader(page) {
  await page.evaluate(() => {
    const thread = {
      id: "chat-demo-skill-deal-001",
      chatDomain: "work",
      threadKind: "listing_inquiry",
      listingId: "demo-skill-001",
      listing: { id: "demo-skill-001", type: "skill", title: "Web制作・LP改修" },
      buyerId: "u_me",
      sellerId: "u_store",
      partnerUserId: "u_store",
      partner: { id: "u_store", displayName: "プレミアムホーム" },
      status: "open",
    };
    const store = window.TasuChatThreadStore;
    if (store?.readAll && store?.writeAll) {
      const threads = store.readAll().filter((t) => String(t.id) !== thread.id);
      threads.unshift(thread);
      store.writeAll(threads);
    }
    if (window.TasuTalkCallChatDetail?.syncFromThread) {
      window.TasuTalkCallChatDetail.syncFromThread(thread);
    }
    const titleEl = document.getElementById("chatMobileTitle");
    const initial = document.getElementById("chatMobileAvatarInitial");
    const avatarImg = document.getElementById("chatMobileAvatarImg");
    const profile = window.TasuTalkChatProfile?.resolveProfile?.("u_store");
    const displayName = profile?.display_name || "プレミアムホーム";
    if (titleEl) titleEl.textContent = displayName;
    if (avatarImg && initial) {
      const imageUrl = String(profile?.profile_image || "").trim();
      if (imageUrl) {
        avatarImg.src = imageUrl;
        avatarImg.alt = displayName;
        avatarImg.hidden = false;
        initial.hidden = true;
        initial.textContent = "";
      } else {
        avatarImg.hidden = true;
        initial.hidden = false;
        initial.textContent = window.TasuTalkChatProfile?.getInitials?.(displayName) || "PH";
      }
    }
    const callBtn = document.querySelector(".chat-mobile-head__actions [data-chat-call]");
    if (callBtn) {
      callBtn.hidden = false;
      callBtn.classList.add("talk-call-btn--enabled");
      callBtn.disabled = false;
    }
    const peerName = document.getElementById("chatPeerName");
    if (peerName) peerName.textContent = displayName;
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await withPlaywrightBrowser(async (browser) => {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobile.waitForSelector("#chatMobileHead", { timeout: 15000 });
    await mobile.waitForSelector("#chatAiBtn", { timeout: 45000 });
    await seedPremiumHomeHeader(mobile);
    await mobile.waitForTimeout(200);
    await mobile.screenshot({
      path: path.join(OUT, "chat-detail-header-390-normal.png"),
      clip: { x: 0, y: 0, width: 390, height: 120 },
    });
    console.log("saved chat-detail-header-390-normal.png");

    await mobile.click("#chatAiBtn");
    await mobile.waitForSelector("[data-talk-tasful-ai-sheet]:not([hidden])", { timeout: 5000 });
    await mobile.waitForTimeout(200);
    const headBox = await mobile.locator("#chatMobileHead").boundingBox();
    if (headBox) {
      await mobile.screenshot({
        path: path.join(OUT, "chat-detail-header-390-ai-sheet.png"),
        clip: {
          x: Math.max(0, headBox.x),
          y: Math.max(0, headBox.y),
          width: Math.min(390, headBox.width),
          height: headBox.height,
        },
      });
    }
    console.log("saved chat-detail-header-390-ai-sheet.png");
    await mobile.close();

    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await pc.waitForSelector("#chatPeerHeader", { state: "attached", timeout: 45000 });
    await seedPremiumHomeHeader(pc);
    await pc.waitForTimeout(200);
    await pc.screenshot({
      path: path.join(OUT, "chat-detail-header-pc.png"),
      clip: { x: 70, y: 200, width: 1140, height: 88 },
    });
    console.log("saved chat-detail-header-pc.png");
    await pc.close();
    });
  
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

await closeAllBrowsers();
