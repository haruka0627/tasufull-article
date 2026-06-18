#!/usr/bin/env node
/**
 * ops_partner A→B メッセージ通知（calendar_assigned_partner_id 欠落時も含む）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(90000);

await page.goto(
  `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=ops_partner&benchViewport=390`,
  { waitUntil: "domcontentloaded" }
);
await page.waitForSelector("#opsAddCalendarBtn", { timeout: 60000 });

const result = await page.evaluate(async () => {
  const ops = window.TasuBuilderOpsPartnerBench;
  await ops.callBridge("resetDemo", { keepCalendar: false });
  await ops.opsAddCalendar();
  await ops.opsPartnerAccept();
  const threadId = ops.opsState.threadId;
  const projectId = ops.opsState.projectId;
  const mvpKey = "tasful:builder:mvp:v1";
  const mvp = JSON.parse(localStorage.getItem(mvpKey) || "{}");
  const idx = (mvp.projects || []).findIndex((p) => p.project_id === projectId);
  if (idx >= 0) {
    delete mvp.projects[idx].calendar_assigned_partner_id;
    localStorage.setItem(mvpKey, JSON.stringify(mvp));
  }
  const beforeCount = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").length;
  await ops.callBridge("setContext", { role: "owner" });
  await ops.callBridge("sendMvpThreadMessage", "owner-to-partner-msg", [], threadId);
  await new Promise((r) => setTimeout(r, 2500));

  const talkNotifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const msgTalk =
    talkNotifs
      .slice(0, Math.max(0, talkNotifs.length - beforeCount))
      .find((n) => /新しいメッセージ/.test(n.title || "")) || talkNotifs[0] || {};
  const mvpNotifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
  const msgMvp =
    mvpNotifs.find((n) => n.title === "新しいメッセージがあります" && n.threadId === threadId) || {};

  const bDoc = document.getElementById("frame-b-notify")?.contentDocument;
  const cards = [...(bDoc?.querySelectorAll("a, article, li, .talk-notify-card") || [])];
  const bCard = cards.find((el) => /新しいメッセージ/.test(el.textContent || ""));
  const href = bCard?.getAttribute?.("href") || bCard?.querySelector?.("a")?.getAttribute?.("href") || "";

  return {
    threadId,
    calendarDeleted: idx >= 0 && !JSON.parse(localStorage.getItem(mvpKey)).projects[idx]?.calendar_assigned_partner_id,
    msgMvp: {
      recipientUserId: msgMvp.recipientUserId,
      recipientRole: msgMvp.recipientRole,
      senderUserId: msgMvp.senderUserId,
      senderRole: msgMvp.senderRole,
      href: msgMvp.href,
    },
    msgTalk: {
      recipientUserId: msgTalk.recipientUserId,
      recipientRole: msgTalk.recipientRole,
      href: msgTalk.href || msgTalk.targetUrl,
    },
    bCardText: (bCard?.textContent || "").slice(0, 120),
    bCardHref: href,
    checks: {
      mvpRecipientUserId: msgMvp.recipientUserId === "demo-partner-001",
      mvpRecipientRole: msgMvp.recipientRole === "partner",
      mvpSenderUserId: msgMvp.senderUserId === "demo-owner-001",
      mvpSenderRole: msgMvp.senderRole === "owner",
      mvpHref: /threadType=ops_partner/.test(msgMvp.href || ""),
      talkRecipientUserId: msgTalk.recipientUserId === "demo-partner-001",
      talkRecipientRole: msgTalk.recipientRole === "partner",
      talkHref: /threadType=ops_partner/.test(msgTalk.href || msgTalk.targetUrl || ""),
      bTalkVisible: Boolean(bCard),
    },
  };
});

console.log(JSON.stringify(result, null, 2));
const failed = Object.entries(result.checks).filter(([, ok]) => !ok);
if (failed.length) {
  console.error("FAIL:", failed.map(([k]) => k).join(", "));
  await browser.close();
  process.exit(1);
}
console.log("PASS: ops_partner A→B message notify");
await browser.close();
