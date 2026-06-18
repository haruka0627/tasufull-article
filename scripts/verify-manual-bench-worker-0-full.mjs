#!/usr/bin/env node
/**
 * 手動ブラウザ相当 — 固定URLを1回開き、B下CTA→A通知→管理→550円→A/Bチャット
 * Playwright連打ではなく、開いて待ってから1クリックの手動操作を模倣
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import {
  fixedWorkerBenchUrl,
  FIXED_WORKER_EXPECTED_NOTIFY_TITLE,
  isCanonicalBenchParentUrl,
  FORBIDDEN_PARENT_BENCH_PARAMS,
} from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedWorkerBenchUrl(BASE);
const OUT = path.join("screenshots", "manual-bench-worker-0-full");
fs.mkdirSync(OUT, { recursive: true });

await withPlaywrightBrowser(async (browser) => {const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

const report = { url: URL, steps: {}, ok: false };

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  // 手動: 開いて reconcile パスを待つ
  await page.waitForTimeout(6500);

  report.steps.boot = await page.evaluate((forbidden) => {
    const dbg = document.getElementById("benchDebugPanel")?.textContent || "";
    const params = new URLSearchParams(location.search);
    const hasForbidden = forbidden.some((k) => params.has(k));
    return {
      canonicalParentUrl: !hasForbidden,
      parentUrl: location.href,
      reconcile: dbg.match(/lastReconcile: (.+)/)?.[1] || "",
      flowPhase: dbg.match(/flowPhase: (.+)/)?.[1]?.trim(),
    };
  }, FORBIDDEN_PARENT_BENCH_PARAMS);
  if (!isCanonicalBenchParentUrl(URL) || !report.steps.boot?.canonicalParentUrl) {
    throw new Error("parent URL must be canonical fixed bench URL");
  }

  const bFrame = page.frames().find((f) => /detail-worker/i.test(f.url()));
  if (!bFrame) {
    report.error = "b_detail_frame_missing";
    throw new Error(report.error);
  }

  await bFrame.evaluate(() => {
    const btn = document.querySelector("[data-listing-primary-cta]");
    btn?.click();
  });
  // 手動: CTA後に reconcile / notify refresh を待つ
  await page.waitForTimeout(5500);

  report.steps.afterCta = await page.evaluate(() => {
    const dbg = document.getElementById("benchDebugPanel")?.textContent || "";
    const contact = JSON.parse(localStorage.getItem("tasful_listing_contact_requests_v1") || "[]").find(
      (r) => r.listing_id === "demo-worker-001"
    );
    return {
      contactId: contact?.contact_id || "",
      flowPhase: dbg.match(/flowPhase: (.+)/)?.[1]?.trim(),
      bBuyerChatOpened: dbg.includes("bBuyerChatOpened: yes"),
      currentStep: dbg.match(/currentStep: (.+)/)?.[1]?.trim(),
      reconcile: dbg.match(/lastReconcile: (.+)/)?.[1] || "",
      bChat: document.getElementById("frame-b-chat")?.src || "",
      onBuyerWait: /platform-chat-bench-buyer-wait/i.test(document.getElementById("frame-b-chat")?.src || ""),
    };
  });

  await page.evaluate(() => window.__tasuBenchReconcile?.({ forceRender: true }));
  await page.waitForTimeout(2500);

  const aNotify = page.frame({ url: /talk-home/ });
  report.steps.aNotify = aNotify
    ? await aNotify.evaluate((title) => {
        const cards = [...document.querySelectorAll(".talk-notify-card")].map((c) => ({
          title: c.querySelector(".talk-notify-card__title")?.textContent?.trim() || "",
          visible: c.getBoundingClientRect().height > 0,
        }));
        return {
          cards,
          hasExpected: cards.some((c) => c.title.includes(String(title).slice(0, 4)) && c.visible),
        };
      }, FIXED_WORKER_EXPECTED_NOTIFY_TITLE)
    : { error: "a_notify_missing" };

  if (aNotify && report.steps.aNotify?.hasExpected) {
    await aNotify.evaluate(() => {
      const btn = document.querySelector(
        "[data-talk-notify-action][data-talk-notify-href], .talk-notify-card__minimal-action"
      );
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(5000);
  }

  const aMgmt = page.frames().find((f) => /detail-worker/i.test(f.url()) && /benchManagement=1|view=contacts/i.test(f.url()));
  report.steps.aManagement = aMgmt
    ? await aMgmt.evaluate(() => ({
        hiroVisible: (document.querySelector(".listing-contact-card__name")?.textContent || "").includes("ひろ"),
        proceedBtn: Boolean(document.querySelector("[data-listing-contact-proceed]")),
      }))
    : { error: "a_mgmt_missing" };

  if (report.steps.aManagement?.proceedBtn && aMgmt) {
    await aMgmt.evaluate(() => document.querySelector("[data-listing-contact-proceed]")?.click());
    await page.waitForTimeout(4500);
  }

  const feeFrame = page.frame({ url: /platform-chat-fee-pay/ });
  if (feeFrame) {
    await feeFrame.evaluate(() => {
      window.confirm = () => true;
      document.querySelector("[data-platform-fee-pay]")?.click();
    });
    await page.waitForTimeout(5500);
    await page.evaluate(() => window.__tasuBenchReconcile?.({ forceRender: true }));
    await page.waitForTimeout(2000);
  }

  report.steps.chatStart = await page.evaluate(() => {
    const dbg = document.getElementById("benchDebugPanel")?.textContent || "";
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]").filter(
      (t) =>
        t.listingId === "demo-worker-001" &&
        !t.dealId &&
        t.id !== "chat-demo-worker-deal-001"
    );
    const thread = threads.sort((a, b) => (b.contactId ? 1 : 0) - (a.contactId ? 1 : 0))[0];
    const bNotify = (JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]") || []).find(
      (n) => n.recipientUserId === "u_hiro" && /やりとりが開始|チャットが開始/.test(String(n.title || ""))
    );
    return {
      threadId: thread?.id || "",
      bNotifyTitle: bNotify?.title || "",
      aChat: document.getElementById("frame-a-chat")?.src || "",
      bChat: document.getElementById("frame-b-chat")?.src || "",
      bBuyerChatOpened: dbg.includes("bBuyerChatOpened: yes"),
      currentStep: dbg.match(/currentStep: (.+)/)?.[1]?.trim(),
    };
  });

  report.ok = Boolean(
    report.steps.afterCta?.contactId &&
      report.steps.afterCta?.flowPhase === "purchased" &&
      report.steps.afterCta?.bBuyerChatOpened &&
      report.steps.aNotify?.hasExpected &&
      report.steps.aManagement?.hiroVisible &&
      report.steps.aManagement?.proceedBtn &&
      /chat-detail\.html/i.test(report.steps.chatStart?.aChat || "") &&
      /chat-detail\.html/i.test(report.steps.chatStart?.bChat || "") &&
      report.steps.chatStart?.threadId &&
      report.steps.chatStart?.bNotifyTitle
  );

  await page.screenshot({ path: path.join(OUT, "final.png") });
} catch (e) {
  report.error = String(e.message || e);
}
});


fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log("OK manual-bench-worker-0-full");
