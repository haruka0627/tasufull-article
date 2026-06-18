#!/usr/bin/env node
/**
 * ベンチ通知 iframe — AI相談カード非表示・空状態文言
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const issues = [];

function benchNotifyUrl(userId) {
  const u = new URL(`${BASE}/talk-home.html`);
  u.searchParams.set("tab", "notify");
  u.searchParams.set("userId", userId);
  u.searchParams.set("talkDev", "1");
  u.searchParams.set("review", "chat-demo");
  u.searchParams.set("demoProfile", "skill");
  u.searchParams.set("liveFlow", "1");
  u.searchParams.set("benchEmbed", "1");
  u.searchParams.set("benchViewport", "1280");
  return u.href;
}

async function auditFrame(frame, label) {
  if (!frame) {
    issues.push(`${label}: iframe not found`);
    return null;
  }
  await frame.waitForSelector("[data-talk-notify-list]", { timeout: 20000 });
  await frame.waitForTimeout(600);
  const m = await frame.evaluate(() => {
    const aiHero = document.querySelector(".talk-ai-hero-card");
    const aiPanel = document.querySelector('[data-talk-panel="ai"]');
    const chatPanel = document.querySelector('[data-talk-panel="chat"]');
    const notifyPanel = document.querySelector('[data-talk-panel="notify"]');
    const emptyTitle = document.querySelector(".talk-notify-empty-state__title")?.textContent?.trim() || "";
    const cards = document.querySelectorAll(".talk-notify-card").length;
    const aiVisible =
      aiHero &&
      aiHero.offsetParent !== null &&
      getComputedStyle(aiHero).display !== "none" &&
      getComputedStyle(aiHero).visibility !== "hidden";
    const aiPanelVisible =
      aiPanel &&
      aiPanel.offsetParent !== null &&
      getComputedStyle(aiPanel).display !== "none";
    const chatVisible =
      chatPanel &&
      chatPanel.offsetParent !== null &&
      getComputedStyle(chatPanel).display !== "none";
    const notifyVisible =
      notifyPanel &&
      notifyPanel.offsetParent !== null &&
      getComputedStyle(notifyPanel).display !== "none";
    return {
      compact: document.body.classList.contains("talk-bench-notify-compact"),
      aiVisible,
      aiPanelVisible,
      chatVisible,
      notifyVisible,
      emptyTitle,
      cards,
      hasAiText: /何をお手伝い|TASFUL AI|相談する/.test(document.body.innerText || ""),
    };
  });
  console.log(`[${label}]`, m);
  return m;
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(
    `${BASE}/chat-dual-window-demo.html?benchPattern=skill-0&liveFlow=1&liveFlowReset=1&benchViewport=1280`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(3000);

  const aNotify = page.frames().find((f) => f.url().includes("tab=notify") && f.url().includes("userId=u_sachi"));
  const bNotify = page.frames().find((f) => f.url().includes("tab=notify") && f.url().includes("userId=u_hiro"));

  const a = await auditFrame(aNotify, "A-notify");
  const b = await auditFrame(bNotify, "B-notify");

  for (const [label, m] of [
    ["A-notify", a],
    ["B-notify", b],
  ]) {
    if (!m) continue;
    if (!m.compact) issues.push(`${label}: missing talk-bench-notify-compact`);
    if (m.aiVisible || m.aiPanelVisible) issues.push(`${label}: AI panel/card visible`);
    if (m.chatVisible) issues.push(`${label}: chat panel visible`);
    if (!m.notifyVisible) issues.push(`${label}: notify panel not visible`);
    if (m.hasAiText) issues.push(`${label}: AI copy in body text`);
    if (m.cards > 0) issues.push(`${label}: expected 0 cards after reset, got ${m.cards}`);
    if (m.emptyTitle !== "該当する通知はありません") {
      issues.push(`${label}: empty title="${m.emptyTitle}"`);
    }
  }

  if (issues.length) {
    console.error("\nFAILED:\n" + issues.map((i) => `  - ${i}`).join("\n"));
    process.exit(1);
  }
  console.log("\nOK: bench notify iframes — no AI card, correct empty state");
} finally {
  await browser.close();
}
