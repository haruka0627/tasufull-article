#!/usr/bin/env node
/**
 * 評価送信後 — 送信側トースト / 二重禁止 / 受信側通知（390px）
 */
import { launchHeadlessBrowser } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-review-notify-390");
const THREAD_ID = "chat-demo-skill-plain-001";
const REVIEWER_ID = "u_hiro";
const REVIEWEE_ID = "u_sachi";
const NOTIFY_ID = `platform-chat-review-received-${THREAD_ID}-${REVIEWER_ID}`;

const CHAT_URL =
  `${BASE}/chat-detail.html?thread=${THREAD_ID}&userId=${REVIEWER_ID}&talkDev=1&review=chat-demo&demoProfile=skill&demoState=completed`;
const NOTIFY_URL =
  `${BASE}/talk-home.html?tab=notify&talkDev=1&review=chat-demo&demoProfile=skill&userId=${REVIEWEE_ID}`;

fs.mkdirSync(OUT, { recursive: true });

const browser = await launchHeadlessBrowser();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

await page.goto(CHAT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.TasuChatService?.submitReview, { timeout: 25000 });

const prep = await page.evaluate(({ threadId, reviewerId, notifyId }) => {
  try {
    const seedRaw = localStorage.getItem("tasu_chat_seed_v1");
    const seed = seedRaw ? JSON.parse(seedRaw) : {};
    seed.reviews = (seed.reviews || []).filter(
      (r) => String(r.room_id) !== threadId || String(r.reviewer_id) !== reviewerId
    );
    localStorage.setItem("tasu_chat_seed_v1", JSON.stringify(seed));

    const notifyKey =
      window.TasuTalkNotifications?.STORAGE_KEY || "tasful_talk_notifications";
    const notifyRaw = localStorage.getItem(notifyKey);
    const notifies = notifyRaw ? JSON.parse(notifyRaw) : [];
    const nextNotifies = Array.isArray(notifies)
      ? notifies.filter((n) => String(n.id) !== notifyId)
      : [];
    localStorage.setItem(notifyKey, JSON.stringify(nextNotifies));

    const threads = window.TasuChatThreadStore?.readAll?.() || [];
    const idx = threads.findIndex((t) => String(t.id) === threadId);
    if (idx >= 0) {
      threads[idx] = { ...threads[idx], roomStatus: "completed", status: "completed" };
      window.TasuChatThreadStore?.writeAll?.(threads);
    }
    return { ok: true, hasThread: idx >= 0 };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}, { threadId: THREAD_ID, reviewerId: REVIEWER_ID, notifyId: NOTIFY_ID });

if (!prep.ok || !prep.hasThread) fail(`prep failed: ${prep.reason || "no thread"}`);
else ok("prep cleared prior review + notify");

const first = await page.evaluate(async (threadId) => {
  const threads = window.TasuChatThreadStore?.readAll?.() || [];
  const room = threads.find((t) => String(t.id) === threadId);
  if (!room) return { ok: false, reason: "room_missing" };
  return window.TasuChatService.submitReview({
    roomId: threadId,
    roomContext: room,
    rating: 5,
    comment: "テスト評価",
    isSkipped: false,
  });
}, THREAD_ID);

if (!first?.ok) fail(`first submit failed: ${first?.reason || "unknown"}`);
else ok("first review submit saved");

const second = await page.evaluate(async (threadId) => {
  const threads = window.TasuChatThreadStore?.readAll?.() || [];
  const room = threads.find((t) => String(t.id) === threadId);
  return window.TasuChatService.submitReview({
    roomId: threadId,
    roomContext: room,
    rating: 4,
    comment: "",
    isSkipped: false,
  });
}, THREAD_ID);

if (second?.ok) fail("double review was not blocked");
else if (!/すでに評価済み/.test(String(second?.reason || ""))) {
  fail(`double review reason unexpected: ${second?.reason || "—"}`);
} else ok("double review blocked");

const sideEffects = await page.evaluate(({ threadId, reviewerId, notifyId, revieweeId }) => {
  const seed = JSON.parse(localStorage.getItem("tasu_chat_seed_v1") || "{}");
  const review = (seed.reviews || []).find(
    (r) => String(r.room_id) === threadId && String(r.reviewer_id) === reviewerId
  );
  const notifyKey =
    window.TasuTalkNotifications?.STORAGE_KEY || "tasful_talk_notifications";
  const notifies = JSON.parse(localStorage.getItem(notifyKey) || "[]");
  const notify = notifies.find((n) => String(n.id) === notifyId);
  const msgs =
    JSON.parse(localStorage.getItem(window.TasuChatThreadStore?.MESSAGES_KEY || "") || "{}")[threadId] ||
    [];
  const systemMsg = msgs.find((m) => m.kind === "system" && /評価を送信しました/.test(m.text || ""));
  return {
    hasReview: Boolean(review),
    notifyTitle: notify?.title || "",
    notifyBody: notify?.body || "",
    notifyCta: notify?.actionLabel || "",
    notifyRecipient: notify?.recipientUserId || "",
    systemText: systemMsg?.text || "",
  };
}, {
  threadId: THREAD_ID,
  reviewerId: REVIEWER_ID,
  notifyId: NOTIFY_ID,
  revieweeId: REVIEWEE_ID,
});

if (!sideEffects.hasReview) fail("review row missing in seed");
else ok("review row stored");

if (!/評価が届き|レビューされました/.test(sideEffects.notifyTitle)) {
  fail(`notify title: ${sideEffects.notifyTitle}`);
} else ok("notify title");

if (!/ひろさんが今回のやりとりを評価しました/.test(sideEffects.notifyBody)) {
  fail(`notify body: ${sideEffects.notifyBody}`);
} else ok("notify body");

if (sideEffects.notifyCta !== "評価を見る") fail(`notify CTA: ${sideEffects.notifyCta}`);
else ok("notify CTA");

if (sideEffects.notifyRecipient !== REVIEWEE_ID) {
  fail(`notify recipient: ${sideEffects.notifyRecipient}`);
} else ok("notify recipient");

if (!/✓ ひろさんが評価を送信しました/.test(sideEffects.systemText)) {
  fail(`system message: ${sideEffects.systemText}`);
} else ok("chat system message");

await page.screenshot({ path: path.join(OUT, "01-chat-after-review-390.png"), fullPage: true });

await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(`[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(800);

const cardAudit = await page.evaluate((id) => {
  const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
  const cta = card?.querySelector("[data-talk-notify-action]");
  const cardRect = card?.getBoundingClientRect();
  const ctaRect = cta?.getBoundingClientRect();
  return {
    title:
      card?.querySelector(".talk-notify-card__title--job-event")?.textContent?.trim() ||
      card?.querySelector(".talk-notify-card__title")?.textContent?.trim() ||
      "",
    body: card?.querySelector(".talk-notify-card__text")?.textContent?.trim() || "",
    cta: cta?.textContent?.trim() || "",
    href: cta?.getAttribute("href") || "",
    cardRight: cardRect ? Math.round(cardRect.right) : 0,
    ctaRight: ctaRect ? Math.round(ctaRect.right) : 0,
    vw: document.documentElement.clientWidth,
  };
}, NOTIFY_ID);

if (!/評価が届き|レビューされました/.test(cardAudit.title)) fail(`card title: ${cardAudit.title}`);
else ok("notify card title visible");

if (!/ひろさんが今回のやりとりを評価しました/.test(cardAudit.body)) {
  fail(`card body: ${cardAudit.body}`);
} else ok("notify card body visible");

if (cardAudit.cta !== "評価を見る") fail(`card CTA label: ${cardAudit.cta}`);
else ok("notify card CTA visible");

if (cardAudit.cardRight > cardAudit.vw + 2 || cardAudit.ctaRight > cardAudit.vw + 2) {
  fail(`card overflow vw=${cardAudit.vw} cardRight=${cardAudit.cardRight} ctaRight=${cardAudit.ctaRight}`);
} else ok("notify card fits 390px");

const navHref = await page.evaluate((id) => {
  const card = document.querySelector(`article[data-talk-notify-id="${id}"]`);
  const cta = card?.querySelector("[data-talk-notify-action]");
  return (
    cta?.getAttribute("data-talk-notify-href") ||
    cta?.getAttribute("href") ||
    ""
  );
}, NOTIFY_ID);
if (!/chat-detail\.html/.test(navHref)) fail(`CTA href: ${navHref}`);
else ok("CTA href points to chat");
if (!/openReviews=1/.test(navHref)) fail(`CTA href missing openReviews=1: ${navHref}`);
else ok("CTA href includes openReviews=1");

await page.screenshot({ path: path.join(OUT, "02-reviewee-notify-390.png"), fullPage: true });

await page.goto(NOTIFY_URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector(`[data-talk-notify-id="${NOTIFY_ID}"]`, { timeout: 25000 });
await page.waitForTimeout(500);

await page.goto(new URL(navHref, BASE).href, { waitUntil: "domcontentloaded", timeout: 15000 });
if (!page.url().includes("chat-detail.html")) fail(`CTA navigation failed: ${page.url()}`);
else ok(`CTA navigates to chat -> ${page.url().split("?")[0]}`);

await page.waitForFunction(
  () => {
    const modal = document.getElementById("chatReviewViewModal");
    return modal && !modal.hidden;
  },
  { timeout: 5000 }
);
const viewAudit = await page.evaluate(() => {
  const modal = document.getElementById("chatReviewViewModal");
  const stars = document.querySelectorAll("#chatReviewViewStars .chat-review-star--on").length;
  const comment = document.getElementById("chatReviewViewComment")?.textContent?.trim() || "";
  return {
    modalOpen: Boolean(modal && !modal.hidden),
    stars,
    comment,
  };
});
if (!viewAudit.modalOpen) fail("review view modal did not open");
else ok("review view modal opened");
if (viewAudit.stars !== 5) fail(`review view stars: ${viewAudit.stars}`);
else ok("review view shows rating");
if (!/テスト評価/.test(viewAudit.comment)) fail(`review view comment: ${viewAudit.comment}`);
else ok("review view shows comment");

await page.screenshot({ path: path.join(OUT, "03-reviewee-chat-390.png"), fullPage: true });

await browser.close();
if (failed) {
  console.log("\nVERIFY FAILED");
  process.exit(1);
}
console.log("\nVERIFY PASSED");
