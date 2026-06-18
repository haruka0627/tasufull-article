#!/usr/bin/env node
/**
 * chat-detail ヘッダー整列 — 390px + PC
 *   node scripts/test-chat-detail-header-align-390.mjs
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";

const base = await findDevServerBaseUrl({ probePath: "chat-detail.html" });
const CHAT_URL = buildLocalPageUrl(
  base,
  "chat-detail.html",
  "?thread=chat-demo-skill-deal-001&userId=u_me&talkDev=1&review=chat-demo"
);

function aligned(centers, tolerance = 4) {
  const vals = Object.values(centers).filter((v) => typeof v === "number");
  if (vals.length < 4) return false;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return max - min <= tolerance;
}

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
  });
}

async function measureHeader(page) {
  return page.evaluate(() => {
    const pick = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const cy = (r) => (r ? r.top + r.height / 2 : null);
    const call = document.querySelector("[data-chat-call]");
    const menu = document.querySelector("[data-chat-menu]");
    const back = document.getElementById("chatMobileBack");
    const avatarImg = document.getElementById("chatMobileAvatarImg");
    const avatarInitial = document.getElementById("chatMobileAvatarInitial");
    const avatarVisible = [avatarImg, avatarInitial].filter((el) => el && !el.hidden);
    const avatarRect = avatarVisible[0]?.getBoundingClientRect();
    return {
      title: document.getElementById("chatMobileTitle")?.textContent?.trim() || "",
      backLabel: back?.textContent?.replace(/\s/g, "") || "",
      backSize: back ? { w: back.offsetWidth, h: back.offsetHeight } : null,
      avatarCount: avatarVisible.length,
      avatarMode: avatarImg && !avatarImg.hidden ? "image" : avatarInitial && !avatarInitial.hidden ? "initial" : "none",
      centers: {
        back: cy(back?.getBoundingClientRect()),
        avatar: cy(avatarRect),
        title: cy(pick("#chatMobileTitle")),
        call: call && !call.hidden ? cy(pick("[data-chat-call]")) : null,
        menu: cy(pick("[data-chat-menu]")),
      },
      callVisible: Boolean(call && !call.hidden),
      menuVisible: Boolean(menu),
      callSize: call ? { w: call.offsetWidth, h: call.offsetHeight } : null,
      menuSize: menu ? { w: menu.offsetWidth, h: menu.offsetHeight } : null,
      mobileHeadDisplay: getComputedStyle(document.getElementById("chatMobileHead")).display,
      peerHeadDisplay: getComputedStyle(document.getElementById("chatPeerHeader")).display,
      peerName: document.getElementById("chatPeerName")?.textContent?.trim() || "",
    };
  });
}

async function runMobileChecks(page, label, errors, pass, fail) {
  const data = await measureHeader(page);
  if (!data.title.includes("プレミアム")) fail(`${label}: title (${data.title})`);
  else pass(`${label}: title プレミアムホーム`);
  if (data.backLabel !== "←") fail(`${label}: back icon-only (${data.backLabel})`);
  else pass(`${label}: back icon-only ←`);
  if (data.backSize?.w !== 36 || data.backSize?.h !== 36) {
    fail(`${label}: back 36×36 (${JSON.stringify(data.backSize)})`);
  } else pass(`${label}: back 36×36`);
  if (data.avatarCount !== 1) fail(`${label}: single avatar (${data.avatarCount} visible)`);
  else pass(`${label}: single avatar (${data.avatarMode})`);
  if (!data.callVisible) fail(`${label}: call visible`);
  else pass(`${label}: call visible`);
  if (!data.menuVisible) fail(`${label}: menu visible`);
  else pass(`${label}: menu visible`);
  if (data.callSize?.w !== 36 || data.menuSize?.w !== 36) {
    fail(`${label}: action buttons 36×36`);
  } else pass(`${label}: action buttons 36×36`);
  const centers = { ...data.centers };
  if (centers.call == null) delete centers.call;
  if (!aligned(centers)) fail(`${label}: Y alignment (${JSON.stringify(data.centers)})`);
  else pass(`${label}: Y alignment`);
  return data;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m) => {
    errors.push(m);
    console.log(`  ✗ ${m}`);
  };

  try {
    console.log("\n--- 390px 通常 ---");
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await seedPremiumHomeHeader(mobile);
    await mobile.reload({ waitUntil: "domcontentloaded" });
    await mobile.waitForSelector("#chatInput:not([disabled])", { timeout: 20000 });
    await mobile.waitForSelector('body[data-chat-detail-ready="true"]', { timeout: 20000 });
    await seedPremiumHomeHeader(mobile);
    await mobile.waitForSelector("#chatMobileHead", { timeout: 15000 });
    await mobile.waitForTimeout(150);
    await runMobileChecks(mobile, "390px normal", errors, pass, fail);

    console.log("\n--- 390px TASFUL AI Sheet ---");
    await mobile.evaluate(() => document.getElementById("chatComposerPlus")?.click());
    await mobile.waitForSelector("#chatComposerPlusMenu:not([hidden])", { timeout: 5000 });
    await mobile.click("#chatAiBtn");
    await mobile.waitForSelector("[data-talk-tasful-ai-sheet]:not([hidden])", { timeout: 5000 });
    await mobile.waitForTimeout(200);
    await runMobileChecks(mobile, "390px sheet", errors, pass, fail);
    await mobile.close();

    console.log("\n--- PC ---");
    const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pc.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await pc.waitForSelector("#chatPeerHeader", { state: "attached", timeout: 45000 });
    await seedPremiumHomeHeader(pc);
    await pc.waitForTimeout(150);
    const pcData = await measureHeader(pc);
    if (pcData.mobileHeadDisplay === "none") pass("PC: mobile head hidden");
    else fail(`PC: mobile head should be hidden (${pcData.mobileHeadDisplay})`);
    if (pcData.peerHeadDisplay !== "none") pass("PC: peer header layout active");
    else fail("PC: peer header hidden");
    if (pcData.peerName.includes("プレミアム") || pcData.title.includes("プレミアム")) {
      pass("PC: partner name shown");
    } else {
      fail(`PC: partner name missing (peer=${pcData.peerName}, mobile=${pcData.title})`);
    }
    await pc.close();

    console.log("\n---");
    if (errors.length) {
      console.error(`FAILED (${errors.length})`);
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("All chat-detail header checks passed.");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
