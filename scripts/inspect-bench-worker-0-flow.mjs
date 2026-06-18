#!/usr/bin/env node
/**
 * worker-0 ベンチ — skill 基準の contact フロー検証
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "bench-worker-0-flow");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BENCH_URL =
  `${BASE}/chat-dual-window-demo.html?talkDev=1&review=chat-demo&demoProfile=worker` +
  `&demoConnect=0&liveFlow=1&userId=u_hiro&benchViewport=1280&benchPattern=worker-0&liveFlowReset=1`;

const errors = [];
const pushErr = (m) => {
  errors.push(m);
  console.error(`NG: ${m}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(BENCH_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  const initial = await page.evaluate(() => {
    const aChat = document.getElementById("frame-a-chat")?.src || "";
    const bChat = document.getElementById("frame-b-chat")?.src || "";
    const contacts = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]");
    const workerReqs = JSON.parse(localStorage.getItem("tasful_worker_requests_v1") || "[]");
    return {
      aChat,
      bChat,
      contactCount: contacts.filter((r) => r.listing_id === "demo-worker-001").length,
      workerRequestCount: workerReqs.length,
    };
  });

  if (!/platform-chat-bench-seller-idle\.html/i.test(initial.aChat)) {
    pushErr(`A-chat should be seller-idle, got: ${initial.aChat}`);
  }
  if (!/detail-worker\.html/i.test(initial.bChat)) {
    pushErr(`B-chat should be detail-worker, got: ${initial.bChat}`);
  }
  if (/platform-chat-bench-buyer-wait\.html/i.test(initial.bChat)) {
    pushErr("B-chat must not be buyer-wait at init");
  }
  if (initial.contactCount > 0) {
    pushErr(`contacts should be empty at init, got ${initial.contactCount}`);
  }

  await page.screenshot({ path: path.join(OUT_DIR, "01-initial-1280.png"), fullPage: true });

  await page.evaluate(() => {
    const win = document.getElementById("frame-b-chat")?.contentWindow;
    const listing = win?.__tasuDetailContactListing || { id: "demo-worker-001" };
    const result = win?.TasuPlatformChatFeeGateFlow?.submitConnectFreeContact?.(listing, {
      intent: "consult",
    });
    if (!result?.ok) throw new Error(`submitConnectFreeContact failed: ${JSON.stringify(result)}`);
  });
  await page.waitForTimeout(2000);

  const afterRequest = await page.evaluate(() => {
    const contacts = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]");
    const contact = contacts.find((r) => r.listing_id === "demo-worker-001");
    const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
    const workerNotify = notifs.find(
      (n) =>
        String(n.source) === "platform" &&
        String(n.title || "").includes("依頼が届きました") &&
        String(n.recipientUserId) === "demo-worker-001"
    );
    const bChat = document.getElementById("frame-b-chat")?.src || "";
    return {
      contactId: contact?.contact_id || "",
      notifyTitle: workerNotify?.title || "",
      notifyCta: workerNotify?.actionLabel || "",
      notifyHref: workerNotify?.href || workerNotify?.targetUrl || "",
      bChat,
    };
  });

  if (!afterRequest.contactId) {
    pushErr("依頼する did not create listing contact request");
  }
  if (!afterRequest.notifyTitle.includes("依頼が届きました")) {
    pushErr(`A notify title expected 依頼が届きました, got: ${afterRequest.notifyTitle}`);
  }
  if (afterRequest.notifyCta !== "依頼者を確認する") {
    pushErr(`A notify CTA expected 依頼者を確認する, got: ${afterRequest.notifyCta}`);
  }
  if (!/view=contacts|benchManagement=1|#contacts/i.test(afterRequest.notifyHref)) {
    pushErr(`notify href should target contacts: ${afterRequest.notifyHref}`);
  }
  if (!/platform-chat-bench-buyer-wait\.html/i.test(afterRequest.bChat)) {
    pushErr(`B-chat should be buyer-wait after request, got: ${afterRequest.bChat}`);
  }

  await page.screenshot({ path: path.join(OUT_DIR, "02-after-request-1280.png"), fullPage: true });

  await page.evaluate(() => {
    const el = document.getElementById("frame-a-notify");
    if (el?.src) el.src = el.src;
    el?.contentWindow?.postMessage?.({ type: "tasu-bench-notify-refresh" }, "*");
  });
  await page.waitForTimeout(3500);

  const notifyVisible = await page
    .frameLocator("#frame-a-notify")
    .locator("text=依頼が届きました")
    .first()
    .isVisible()
    .catch(() => false);
  if (!notifyVisible) {
    pushErr("A notify frame does not show 依頼が届きました card");
  }

  if (errors.length) {
    console.log(JSON.stringify({ ok: false, errors, initial, afterRequest }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, initial, afterRequest }, null, 2));
} finally {
  await browser.close();
}
