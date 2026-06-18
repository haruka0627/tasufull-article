#!/usr/bin/env node
/**
 * チャット上部 — [主アクション] [︙] / キャンセルはメニュー内（390px）
 */
import { devices, withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT = path.join("screenshots", "chat-header-actions-390");
const VIEWPORT = { width: 390, height: 844 };

const CASES = [
  { id: "job", userId: "u_job_demo_full", completeLabel: "やりとり完了" },
  { id: "skill", userId: "u_sachi", completeLabel: "納品完了申請" },
  { id: "worker", userId: "u_hiro", completeLabel: "やりとり完了" },
  { id: "product-seller", profile: "product", userId: "u_product", completeLabel: "発送完了" },
  { id: "product-buyer", profile: "product", userId: "u_hiro", completeLabel: "受け取り完了申請" },
  { id: "shop", userId: "u_hiro", completeLabel: "対応完了申請" },
  { id: "business", userId: "u_business_demo", completeLabel: "作業完了申請" },
];

const THREAD_IDS = {
  job: "chat-demo-job-full-001",
  skill: "chat-demo-skill-plain-001",
  worker: "chat-demo-worker-plain-001",
  product: "chat-demo-product-plain-001",
  shop: "chat-demo-shop-plain-001",
  business: "chat-demo-business-plain-001",
};

fs.mkdirSync(OUT, { recursive: true });

const iphone = devices["iPhone 13"];
await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({
  ...iphone,
  viewport: VIEWPORT,
  hasTouch: true,
});
const page = await context.newPage();

let failed = false;
const fail = (msg) => {
  console.log("NG", msg);
  failed = true;
};
const ok = (msg) => console.log("OK", msg);

for (const spec of CASES) {
  const profile = spec.profile || spec.id.replace(/-seller|-buyer/, "");
  const threadId = THREAD_IDS[profile];
  const shotId = spec.id;
  const chatUrl =
    `${BASE}/chat-detail.html?thread=${threadId}&userId=${spec.userId}&talkDev=1&review=chat-demo&demoProfile=${profile}&demoState=active`;

  await page.goto(chatUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#chatCompleteBtn", { timeout: 20000 });
  await page.waitForTimeout(1000);

  const audit = await page.evaluate((expectedComplete) => {
    const vw = document.documentElement.clientWidth;
    const row = document.querySelector(".chat-room-status-row__actions");
    const completeBtn = document.getElementById("chatCompleteBtn");
    const approveBtn = document.getElementById("chatApproveCompleteBtn");
    const legacyCancel = document.getElementById("chatCancelBtn");
    const overflowCancel = document.getElementById("chatOverflowCancelItem");
    const overflowBtn = document.getElementById("chatOverflowBtn");
    const rowRect = row?.getBoundingClientRect();
    const completeRect = completeBtn?.getBoundingClientRect();
    const visibleComplete =
      completeBtn && !completeBtn.hidden && completeBtn.offsetParent !== null
        ? completeBtn.textContent?.trim()
        : "";
    return {
      vw,
      rowRight: rowRect ? Math.round(rowRect.right) : 0,
      completeRight: completeRect ? Math.round(completeRect.right) : 0,
      legacyCancelExists: Boolean(legacyCancel),
      legacyCancelVisible: legacyCancel && !legacyCancel.hidden && legacyCancel.offsetParent !== null,
      overflowCancelHidden: overflowCancel?.hidden,
      overflowBtnVisible: overflowBtn && overflowBtn.offsetParent !== null,
      approveVisible: approveBtn && !approveBtn.hidden && approveBtn.offsetParent !== null,
      visibleComplete,
      expectedComplete,
      menuItems: [...document.querySelectorAll("#chatOverflowPanel [role=menuitem]")].map((el) => ({
        text: el.textContent?.trim(),
        hidden: el.hidden,
      })),
    };
  }, spec.completeLabel);

  if (audit.legacyCancelVisible) fail(`${shotId}: cancel visible in header`);
  if (audit.approveVisible) fail(`${shotId}: separate approve button visible`);
  if (audit.overflowCancelHidden) fail(`${shotId}: cancel missing from menu`);
  if (!audit.overflowBtnVisible) fail(`${shotId}: overflow menu missing`);

  if (!audit.visibleComplete?.includes(spec.completeLabel)) {
    fail(`${shotId}: expected "${spec.completeLabel}" got "${audit.visibleComplete}"`);
  } else {
    ok(`${shotId}: primary "${audit.visibleComplete}"`);
  }

  if (audit.rowRight > audit.vw + 1) fail(`${shotId}: overflow right=${audit.rowRight}`);
  else ok(`${shotId}: layout fits (right=${audit.rowRight})`);

  const menuLabels = audit.menuItems.filter((m) => !m.hidden).map((m) => m.text);
  if (!menuLabels.includes("キャンセル") || !menuLabels.includes("通報") || !menuLabels.includes("ブロック")) {
    fail(`${shotId}: menu ${menuLabels.join(", ")}`);
  } else {
    ok(`${shotId}: menu OK`);
  }

  await page.screenshot({
    path: path.join(OUT, `${shotId}-chat-actions-390.png`),
    fullPage: false,
  });
}

});
if (failed) process.exit(1);
console.log(`\nAll cases passed. Screenshots: ${OUT}`);
