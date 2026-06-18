#!/usr/bin/env node
/**
 * スマホ chat-detail — 3層スクロール構造 390px 検証
 * 1. body はスクロールしない
 * 2. メッセージ領域のみスクロール
 * 3. 入力欄・送信ボタンは固定（タブバーに被らない）
 * 4. 完了後レビューカードが入力欄に隠れない
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-chat-mobile-scroll");
const THREAD = "chat-demo-job-full-001";
const POSTER = "u_job_demo_full";
const APPLICANT = "u_hiro";

fs.mkdirSync(OUT, { recursive: true });

function rectSnapshot(rect) {
  if (!rect) return null;
  return {
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
    left: Math.round(rect.left),
    right: Math.round(rect.right),
  };
}

async function measureChatScroll(page) {
  return page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const messages = document.getElementById("chatMessages");
    const composer = document.querySelector(".chat-composer");
    const send = document.getElementById("chatSend");
    const tabbar = document.querySelector("[data-tasu-app-tabbar]");
    const bodyStyle = getComputedStyle(body);
    const messagesStyle = messages ? getComputedStyle(messages) : null;
    const composerStyle = composer ? getComputedStyle(composer) : null;

    return {
      mobileShell: body.classList.contains("tasu-app-mobile-page"),
      bodyOverflowY: bodyStyle.overflowY,
      bodyOverflow: bodyStyle.overflow,
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      messagesOverflowY: messagesStyle?.overflowY || "",
      messagesCanScroll: Boolean(
        messages && messages.scrollHeight > messages.clientHeight + 2
      ),
      composerPosition: composerStyle?.position || "",
      composerRect: composer?.getBoundingClientRect(),
      sendRect: send?.getBoundingClientRect(),
      tabbarRect: tabbar?.getBoundingClientRect(),
      messagesRect: messages?.getBoundingClientRect(),
    };
  });
}

async function injectLongHistory(page) {
  await page.evaluate((threadId) => {
    const key = window.TasuChatThreadStore?.MESSAGES_KEY || "tasful_chat_messages";
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    const list = Array.isArray(map[threadId]) ? [...map[threadId]] : [];
    const base = Date.now() - list.length * 60000;
    for (let i = 0; i < 24; i += 1) {
      const id = `scroll-test-${threadId}-${i}`;
      if (list.some((m) => String(m.id) === id)) continue;
      list.push({
        id,
        chatId: threadId,
        roomId: threadId,
        senderId: i % 2 ? "u_hiro" : "u_job_demo_full",
        senderName: i % 2 ? "ひろ" : "タスク確認株式会社",
        text: `スクロール検証メッセージ ${i + 1} — 入力欄固定の確認用です。`,
        createdAt: new Date(base + i * 60000).toISOString(),
        kind: "text",
      });
    }
    map[threadId] = list;
    localStorage.setItem(key, JSON.stringify(map));
  }, THREAD);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const issues = [];

try {
  await page.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${POSTER}&talkDev=1&review=job-full&jobFullReset=1&from=talk`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true");
  await page.waitForFunction(() => document.body.classList.contains("tasu-app-mobile-page"), {
    timeout: 8000,
  });
  await injectLongHistory(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true");
  await page.waitForTimeout(600);

  const beforeScroll = await measureChatScroll(page);
  const composerBefore = rectSnapshot(beforeScroll.composerRect);
  const sendBefore = rectSnapshot(beforeScroll.sendRect);

  if (!beforeScroll.mobileShell) issues.push("tasu-app-mobile-page が付与されていません");
  if (beforeScroll.bodyOverflow !== "hidden" && beforeScroll.bodyOverflowY !== "hidden") {
    issues.push(`body overflow=${beforeScroll.bodyOverflow}/${beforeScroll.bodyOverflowY} (hidden 期待)`);
  }
  if (beforeScroll.composerPosition !== "static") {
    issues.push(`composer position=${beforeScroll.composerPosition} (static 期待)`);
  }
  if (beforeScroll.messagesOverflowY !== "auto") {
    issues.push(`messages overflow-y=${beforeScroll.messagesOverflowY} (auto 期待)`);
  }
  if (!beforeScroll.messagesCanScroll) {
    issues.push("メッセージ領域がスクロール可能になっていません");
  }

  const tabbarTop = beforeScroll.tabbarRect?.top ?? 844;
  if (beforeScroll.sendRect && beforeScroll.sendRect.bottom > tabbarTop + 2) {
    issues.push("送信ボタンが下部タブバーに被っています");
  }

  await page.evaluate(() => {
    const wrap = document.getElementById("chatMessages");
    if (wrap) wrap.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  const atTop = await measureChatScroll(page);

  await page.evaluate(() => {
    const wrap = document.getElementById("chatMessages");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  });
  await page.waitForTimeout(200);
  const atBottom = await measureChatScroll(page);

  const composerAfterTop = rectSnapshot(atTop.composerRect);
  const composerAfterBottom = rectSnapshot(atBottom.composerRect);

  if (
    composerBefore &&
    composerAfterTop &&
    (Math.abs(composerBefore.top - composerAfterTop.top) > 2 ||
      Math.abs(composerBefore.bottom - composerAfterTop.bottom) > 2)
  ) {
    issues.push("メッセージを先頭へスクロールすると入力欄が動きました");
  }
  if (
    composerBefore &&
    composerAfterBottom &&
    (Math.abs(composerBefore.top - composerAfterBottom.top) > 2 ||
      Math.abs(composerBefore.bottom - composerAfterBottom.bottom) > 2)
  ) {
    issues.push("メッセージを末尾へスクロールすると入力欄が動きました");
  }

  const docScrollMoved = await page.evaluate(async () => {
    const start = window.scrollY;
    window.scrollTo(0, 120);
    await new Promise((r) => requestAnimationFrame(r));
    const moved = Math.abs(window.scrollY - start) > 2;
    window.scrollTo(0, start);
    return moved;
  });
  if (docScrollMoved) issues.push("window/body 全体がスクロールしています");

  await page.screenshot({ path: path.join(OUT, "01-active-chat-390.png") });

  await page.locator("#chatCompleteBtn").click();
  await page.locator("#chatCompleteSubmit").click();
  await page.waitForTimeout(400);

  await page.goto(
    `${BASE}/chat-detail.html?thread=${THREAD}&userId=${APPLICANT}&talkDev=1&review=job-full&from=talk`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(() => document.body.dataset.chatDetailReady === "true");
  await page.locator("#chatApproveCompleteBtn").click();
  await page.waitForTimeout(700);

  const reviewVisible = await page.evaluate(() => {
    const card = document.querySelector("[data-platform-job-review-prompt]");
    const messages = document.getElementById("chatMessages");
    const tabbar = document.querySelector("[data-tasu-app-tabbar]");
    if (!card || !messages) return { ok: false, reason: "missing_elements" };
    card.scrollIntoView({ block: "nearest", inline: "nearest" });
    const cardRect = card.getBoundingClientRect();
    const messagesRect = messages.getBoundingClientRect();
    const tabbarTop = tabbar?.getBoundingClientRect().top ?? window.innerHeight;
    const visibleBottom = Math.min(messagesRect.bottom, tabbarTop) - 8;
    const fullyVisible =
      cardRect.top >= messagesRect.top - 4 &&
      cardRect.bottom <= visibleBottom + 2 &&
      cardRect.left >= 0 &&
      cardRect.right <= window.innerWidth + 1;
    return {
      ok: fullyVisible,
      cardRect: { top: cardRect.top, bottom: cardRect.bottom },
      messagesBottom: messagesRect.bottom,
      tabbarTop,
      visibleBottom,
    };
  });

  if (!reviewVisible.ok) {
    issues.push(`完了後レビューカードが見切れています: ${JSON.stringify(reviewVisible)}`);
  }

  await page.screenshot({ path: path.join(OUT, "02-completed-review-card-390.png") });

  const summary = {
    baseUrl: BASE,
    beforeScroll: {
      ...beforeScroll,
      composerRect: composerBefore,
      sendRect: sendBefore,
    },
    composerStable: {
      before: composerBefore,
      afterTop: composerAfterTop,
      afterBottom: composerAfterBottom,
    },
    reviewVisible,
    issues,
    ok: issues.length === 0,
    screenshots: [
      path.join(OUT, "01-active-chat-390.png"),
      path.join(OUT, "02-completed-review-card-390.png"),
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
  if (issues.length) {
    console.error("verify-chat-mobile-scroll-390 FAILED:\n" + issues.join("\n"));
    process.exit(1);
  }
  console.log("verify-chat-mobile-scroll-390 OK");
} finally {
  await browser.close();
}
