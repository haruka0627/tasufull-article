#!/usr/bin/env node
/**
 * チャット LINE形式 UI — 390px スクショ
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer, devUrl } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "platform-chat-line-ui");
const VIEWPORT = { width: 390, height: 844 };

const URLS = {
  job: "chat-detail.html?thread=chat-demo-job-hired-001&userId=u_hiro&talkDev=1&from=talk",
  worker:
    "chat-detail.html?thread=chat-demo-worker-fee-001&userId=u_worker&talkDev=1&from=talk",
  workerDeal:
    "chat-detail.html?thread=chat-demo-worker-deal-001&deal=worker_deal_demo_001&userId=u_worker&talkDev=1&from=talk",
  notifyWorker:
    "talk-home.html?tab=notify&review=worker&talkDev=1&userId=u_worker",
};

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });
page.on("dialog", async (dialog) => {
  await dialog.accept();
});

async function waitChatReady() {
  await page.waitForFunction(
    () => document.body.dataset.chatDetailReady === "true",
    { timeout: 45000 }
  );
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const el = document.getElementById("chatMessages");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(350);
}

async function capture(name) {
  await page.screenshot({ path: path.join(OUT, name) });
}

async function seedWorkerPaidChat() {
  await page.goto(devUrl(URLS.notifyWorker), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.TasuTalkWorkerReviewMode?.isWorkerReviewMode?.(), {
    timeout: 30000,
  });
  await page.evaluate((notifyId) => {
    window.TasuPlatformChatDemoSeed?.resetVerifyFeeThread?.(notifyId);
  }, "platform-verify-worker-request-001");
  const payUrl = await page.evaluate((notifyId) => {
    const row = (window.TasuTalkNotifications?.getAll?.() || []).find((n) => n.id === notifyId);
    const action = window.TasuTalkNotifyActions?.buildNotifyNavigateAction?.(row);
    return action?.href || row?.href || "";
  }, "platform-verify-worker-request-001");
  await page.goto(devUrl(payUrl.replace(/^\//, "")), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.click("[data-platform-fee-pay]");
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 15000 }
  );
  const chatHref = await page.evaluate(
    () => document.querySelector("[data-platform-fee-chat-link]")?.getAttribute("href") || ""
  );
  await page.goto(devUrl(chatHref.replace(/^\//, "")), { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitChatReady();
}

await page.goto(devUrl(URLS.job), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.TasuPlatformChatJobCard?.ensureJobHireNotifyDemo?.(), {
  timeout: 30000,
});
await page.reload({ waitUntil: "domcontentloaded" });
await waitChatReady();
await capture("01-job-chat-390.png");

await seedWorkerPaidChat();
await capture("02-worker-chat-390.png");

await page.goto(devUrl(URLS.workerDeal), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitChatReady();
await capture("03-completion-chat-390.png");

const completionCard = page.locator("[data-platform-completion-card]").first();
if ((await completionCard.count()) > 0) {
  await completionCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
}

await page.goto(devUrl(URLS.worker), { waitUntil: "domcontentloaded", timeout: 60000 });
await waitChatReady();
const input = page.locator("#chatInput");
if ((await input.count()) > 0) {
  await input.fill("了解しました。本日18時までに初稿をお送りします。");
  await page.click("#chatSend");
  await page.waitForTimeout(700);
  await waitChatReady();
}
await capture("04-bottom-scroll-state-390.png");

await page.goto(devUrl(URLS.job), { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => window.TasuPlatformChatJobCard?.ensureJobHireNotifyDemo?.(), {
  timeout: 30000,
});
await page.reload({ waitUntil: "domcontentloaded" });
await waitChatReady();
await capture("05-self-right-peer-left-390.png");

const audit = await page.evaluate(() => {
  const wrap = document.getElementById("chatMessages");
  const me = [...document.querySelectorAll(".chat-msg--me")];
  const them = [...document.querySelectorAll(".chat-msg:not(.chat-msg--me):not(.chat-msg--system-card)")].filter(
    (el) => el.querySelector(".chat-bubble__text")
  );
  const meRect = me.at(-1)?.getBoundingClientRect();
  const themRect = them.at(-1)?.getBoundingClientRect();
  const viewportW = window.innerWidth;
  return {
    scrollBottom:
      wrap && wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 12,
    meCount: me.length,
    themCount: them.length,
    meOnRight: meRect ? meRect.left + meRect.width / 2 > viewportW * 0.55 : null,
    themOnLeft: themRect ? themRect.left + themRect.width / 2 < viewportW * 0.45 : null,
    composerVisible: Boolean(document.querySelector(".chat-composer")),
    tabbarGap: (() => {
      const composer = document.querySelector(".chat-composer")?.getBoundingClientRect();
      const tabbar = document.querySelector("[data-tasu-app-tabbar]")?.getBoundingClientRect();
      if (!composer || !tabbar) return null;
      return tabbar.top - composer.bottom;
    })(),
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewport: VIEWPORT,
  audit,
  screenshots: [
    "01-job-chat-390.png",
    "02-worker-chat-390.png",
    "03-completion-chat-390.png",
    "04-bottom-scroll-state-390.png",
    "05-self-right-peer-left-390.png",
  ],
};

fs.writeFileSync(path.join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));

if (!audit.scrollBottom) throw new Error("chat not scrolled to bottom");
