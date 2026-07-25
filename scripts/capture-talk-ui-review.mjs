#!/usr/bin/env node
/**
 * TASFUL Talk — UI レビュー用スクリーンショット
 *
 *   npm run dev 起動後:
 *   node scripts/capture-talk-ui-review.mjs
 *
 * 出力: reports/ui-review/talk/
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { createUiReviewSession } from "./lib/ui-review-capture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURE = "talk";
const FRIEND_THREAD_ID = "talk-mock-friend-001";
const FRIEND_ROW_SEL = `[data-talk-select-thread][data-talk-thread-id="${FRIEND_THREAD_ID}"]`;

const REVIEW_AVATAR_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="114" height="114" viewBox="0 0 114 114">' +
      '<rect width="114" height="114" fill="#fff6df"/>' +
      '<circle cx="57" cy="57" r="34" fill="#7a5710"/>' +
      "</svg>"
  );
const REVIEW_COVER_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520">' +
      '<rect width="1200" height="520" fill="#2563eb"/>' +
      '<rect x="80" y="100" width="1040" height="320" fill="#3b82f6"/>' +
      "</svg>"
  );

const THREADS_KEY = "tasful_chat_threads";
const MESSAGES_KEY = "tasful_chat_messages";
const REVEAL_KEY = "tasful:builder:contact-reveals:v1";
const WORKFLOW_KEY = "tasful:talk:builder-workflow-state:v1";

const base = await findDevServerBaseUrl({ probePath: "talk-home.html" });

async function openFriendProfileCard(page) {
  await page.locator(FRIEND_ROW_SEL).first().waitFor({ state: "visible", timeout: 20000 });
  await page.evaluate((threadId) => {
    const Card = window.TasuTalkProfileCard;
    if (!Card?.buildPayloadFromThread || !Card?.showTalkProfileCard) {
      throw new Error("TasuTalkProfileCard API missing");
    }
    const fromStore = (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId);
    const fromList = (window.TasuChatThreadStore?.getAllForChatList?.() || []).find((t) => String(t.id) === threadId);
    const fromLs = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]").find(
      (t) => String(t.id) === threadId
    );
    const thread = fromStore || fromList || fromLs || null;
    if (!thread) throw new Error(`thread not found: ${threadId}`);
    Card.showTalkProfileCard(Card.buildPayloadFromThread(thread));
  }, FRIEND_THREAD_ID);
  await page.locator("[data-talk-profile-card]:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
}

function chatUrl(threadId, extra = {}) {
  const q = new URLSearchParams({ thread: threadId, from: "builder", ...extra });
  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);
}

async function seedReviewThreads(page) {
  await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ threadsKey, messagesKey, revealKey, workflowKey }) => {
      localStorage.removeItem(revealKey);
      localStorage.removeItem(workflowKey);
      const threads = [
          {
            id: "talk-mock-friend-001",
            chatDomain: "friend",
            threadKind: "direct",
            partnerUserId: "u_demo_friend_001",
            partnerProfile: {
              user_id: "u_demo_friend_001",
              display_name: "田中 一郎",
              profile_image: REVIEW_AVATAR_DATA_URL,
              cover_image: REVIEW_COVER_DATA_URL,
            },
            partner: { id: "u_demo_friend_001", displayName: "田中 一郎" },
            lastMessagePreview: "こんにちは",
            updatedAt: new Date().toISOString(),
          },
          {
            id: "verify-worker-contact",
            chatDomain: "builder",
            threadKind: "worker_contact",
            builderFlow: "partner_user",
            listingTitle: "山本 電工",
            partner: { displayName: "山本 電工" },
            contactTargetId: "w1",
            source: "builder-mvp",
            status: "active",
            roomStatus: "active",
            lastMessage: "相談開始",
            updatedAt: new Date().toISOString(),
          },
          {
            id: "verify-admin-partner",
            chatDomain: "builder",
            threadKind: "calendar_request",
            builderThreadType: "admin_partner",
            builderFlow: "ops_partner",
            listingTitle: "店舗内装リニューアル（Builder）",
            partner: { displayName: "運営" },
            updatedAt: new Date().toISOString(),
          },
          {
            id: "verify-normal-chat",
            chatDomain: "work",
            threadKind: "listing_inquiry",
            listingTitle: "通常出品テスト",
            partner: { displayName: "出品者A" },
            status: "active",
            roomStatus: "active",
            lastMessage: "通常メッセージ",
            updatedAt: new Date().toISOString(),
          },
        ];
      localStorage.setItem(threadsKey, JSON.stringify(threads));
      localStorage.setItem(
        messagesKey,
        JSON.stringify({
          "verify-worker-contact": [],
          "verify-admin-partner": [],
          "verify-normal-chat": [
            { id: "m1", senderId: "u1", text: "通常メッセージ", createdAt: new Date().toISOString(), kind: "text" },
          ],
        })
      );
    },
    { threadsKey: THREADS_KEY, messagesKey: MESSAGES_KEY, revealKey: REVEAL_KEY, workflowKey: WORKFLOW_KEY }
  );
}

const reviewBeforeGoto = async (p) => seedReviewThreads(p);

async function main() {
  console.log(`\n=== Talk UI review capture ===`);
  console.log(`Base: ${base}`);
  console.log(`Output: reports/ui-review/${FEATURE}/\n`);

  const session = createUiReviewSession(FEATURE, { baseUrl: base });

  await withPlaywrightBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await seedReviewThreads(page);

    await session.captureStep(page, browser, {
      slug: "talk-home",
      label: "Talk ホーム（友達一覧）",
      url: buildLocalPageUrl(base, "talk-home.html?tab=chat"),
      beforeGoto: reviewBeforeGoto,
      waitFor: FRIEND_ROW_SEL,
      prepare: async (p) => {
        await p.locator(FRIEND_ROW_SEL).first().waitFor({ state: "visible", timeout: 20000 });
      },
    });

    await session.captureStep(page, browser, {
      slug: "profile-card",
      label: "プロフィールカード（開いた状態）",
      url: buildLocalPageUrl(base, "talk-home.html?tab=chat"),
      viewports: ["1280", "768", "390"],
      beforeGoto: reviewBeforeGoto,
      prepare: async (p) => {
        await openFriendProfileCard(p);
        await p.waitForTimeout(350);
      },
    });

    await session.captureStep(page, browser, {
      slug: "worker-before-reveal",
      label: "ワーカー検索 · 開示前（550円ゲート）",
      url: chatUrl("verify-worker-contact", { builderRole: "user" }),
      beforeGoto: reviewBeforeGoto,
      waitFor: "#talkBuilderContactRevealHost",
    });

    await session.captureStep(page, browser, {
      slug: "worker-after-reveal",
      label: "ワーカー検索 · 開示後（連絡先 + 電話）",
      url: chatUrl("verify-worker-contact", { builderRole: "user" }),
      viewports: ["1280", "768", "390"],
      beforeGoto: reviewBeforeGoto,
      waitFor: "#talkBuilderContactRevealHost",
      prepare: async (p) => {
        p.once("dialog", (d) => d.accept());
        await p.locator("[data-builder-contact-reveal]").first().click();
        await p.locator(".builder-contact-reveal--open").waitFor({ state: "visible", timeout: 15000 });
        await p.waitForTimeout(500);
      },
    });

    await session.captureStep(page, browser, {
      slug: "admin-talk",
      label: "運営案件 Talk（ヘッダーアクション非表示）",
      url: chatUrl("verify-admin-partner", { builderFlow: "ops_partner", builderRole: "partner" }),
      beforeGoto: reviewBeforeGoto,
      waitFor: "#talkBuilderWorkflowPanel",
    });

    await session.captureStep(page, browser, {
      slug: "normal-chat",
      label: "通常 Talk（ヘッダーアクション表示）",
      url: buildLocalPageUrl(base, "chat-detail.html?thread=verify-normal-chat"),
      beforeGoto: reviewBeforeGoto,
      waitFor: "#chatPeerHeader",
      viewports: ["1280", "390"],
    });

    await page.close();
  }, { headless: true });

  const { ok, reportPath } = session.writeReport({ baseUrl: base });
  await closeAllBrowsers();

  if (!ok) {
    console.error("\nFAIL: console errors detected — see report");
    process.exitCode = 1;
    return;
  }
  console.log("\nPASS talk UI review capture");
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
