#!/usr/bin/env node
/** notifyJobHiredToApplicant → tasful_talk_notifications 経路トレース */
import { chromium } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const BUYER = "u_hiro";
const HIRED = "応募が承諾されました";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();

page.on("dialog", async (d) => d.accept());

function findFrame(page, pattern) {
  if (typeof pattern === "function") {
    return page.frames().find(pattern);
  }
  return page.frames().find((f) => pattern.test(f.url()));
}

const trace = { steps: [] };

function log(step, data) {
  trace.steps.push({ step, ...data });
}

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

log("initial", await page.evaluate(() => {
  const apps = JSON.parse(localStorage.getItem("tasful_job_applications_v1") || "[]");
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  return {
    app: apps.find((a) => a.job_id === "job_demo_full_001") || null,
    notifCount: notifs.length,
    bHired: notifs.filter((n) => n.recipientUserId === "u_hiro" && String(n.title || "").includes("承諾")).length,
    aChat: document.getElementById("frame-a-chat")?.src || "",
  };
}));

// A: 通知 CTA → 応募者一覧 → チャットに進む → 550円
const aNotify = page.frame({ url: /talk-home.*tab=notify.*u_job_demo_full/i });
if (aNotify) {
  await aNotify.evaluate(() => {
    document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action")?.click();
  });
  await page.waitForTimeout(3500);
}

let mgmt = findFrame(
  page,
  (f) => /detail-job/i.test(f.url()) && /benchManagement=1|view=applications|#applications/i.test(f.url())
);
if (!mgmt) {
  await page.evaluate(() => {
    const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false);
    const href = window.TasuPlatformChatLiveFlow?.managementPageUrl?.(profile, profile?.partnerAId);
    const el = document.getElementById("frame-a-chat");
    if (el && href) el.src = href + (href.includes("?") ? "&" : "?") + "benchEmbed=1&benchViewport=390";
  });
  await page.waitForTimeout(3500);
  mgmt = findFrame(page, /detail-job/i);
}
if (mgmt) {
  await mgmt.waitForFunction(
    () => document.querySelector("[data-job-app-proceed]"),
    { timeout: 15000 }
  ).catch(() => null);
  const proceedDiag = await mgmt.evaluate(() => {
    const store = window.TasuJobApplicationsStore;
    const listing = window.TasuListingDemoCatalog?.STORE_BY_ID?.["job_demo_full_001"];
    const app = store?.findApplication?.("job_demo_full_001", "job-app-demo-full-001");
    return {
      hasBtn: Boolean(document.querySelector("[data-job-app-proceed]")),
      hasPayLink: Boolean(document.querySelector("[data-job-app-pay]")),
      me: window.TasuChatUserIdentity?.getEffectiveUserId?.(),
      posterOk: store?.isJobPoster?.(listing),
      appStatus: app?.status || null,
    };
  });
  log("proceed_diag", proceedDiag);
  await mgmt.evaluate(() => {
    document.querySelector("[data-job-app-proceed]")?.click() ||
      document.querySelector("[data-job-app-pay]")?.click();
  }).catch(() => null);
  await page.waitForTimeout(4500);
  log("after_proceed", {
    aChat: await page.evaluate(() => {
      const el = document.getElementById("frame-a-chat");
      return el?.contentWindow?.location?.href || el?.src || "";
    }),
  });
}

let aFee = null;
for (let i = 0; i < 8 && !aFee; i += 1) {
  aFee = findFrame(page, /platform-chat-fee-pay/i);
  if (!aFee) await page.waitForTimeout(500);
}
log("fee_frame", { found: Boolean(aFee), url: aFee?.url() || null });

if (aFee) {
  aFee.on("dialog", async (d) => d.accept());
  const prePay = await aFee.evaluate(() => ({
    params: Object.fromEntries(new URLSearchParams(location.search)),
    hasPayBtn: Boolean(document.querySelector("[data-platform-fee-pay]")),
    hasFee: Boolean(window.TasuPlatformChatFee),
    hasNotify: typeof window.TasuTalkPlatformNotify?.notifyJobHiredToApplicant === "function",
    hasStore: typeof window.TasuTalkNotifications?.add === "function",
  }));
  log("fee_pre_click", prePay);

  // Hook notify + add in fee iframe
  await aFee.evaluate(() => {
    window.__trace = { notifyCalled: false, notifyRecipient: null, addCalled: false, addRecipient: null };
    const origNotify = window.TasuTalkPlatformNotify?.notifyJobHiredToApplicant;
    if (origNotify) {
      window.TasuTalkPlatformNotify.notifyJobHiredToApplicant = function (detail) {
        window.__trace.notifyCalled = true;
        window.__trace.notifyDetail = {
          applicant_id: detail?.application?.applicant_id,
          buyerId: detail?.thread?.buyerId,
        };
        const row = origNotify.apply(this, arguments);
        window.__trace.notifyRecipient = row?.recipientUserId || null;
        return row;
      };
    }
    const origAdd = window.TasuTalkNotifications?.add;
    if (origAdd) {
      window.TasuTalkNotifications.add = function (input) {
        window.__trace.addCalled = true;
        window.__trace.addRecipient = input?.recipientUserId || null;
        return origAdd.apply(this, arguments);
      };
    }
  });

  await aFee.evaluate(() => {
    window.confirm = () => true;
    document.querySelector("[data-platform-fee-pay]")?.click();
  });
  await page.waitForTimeout(6000);

  const postPay = await page.evaluate(() => {
    const el = document.getElementById("frame-a-chat");
    const href = el?.contentWindow?.location?.href || el?.src || "";
    let trace = null;
    try {
      trace = el?.contentWindow?.__trace || null;
    } catch {
      trace = null;
    }
    return {
      aChatHref: href,
      onFeePay: /platform-chat-fee-pay/i.test(href),
      onChat: /chat-detail/i.test(href),
      trace,
    };
  });
  log("fee_post_click", postPay);
}

const parentAfter = await page.evaluate(({ buyer, hired }) => {
  const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
  const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
  const hiredRows = notifs.filter(
    (n) => String(n.recipientUserId) === buyer && String(n.title || "").includes(hired.slice(0, 6))
  );
  return {
    storageTotal: notifs.length,
    hiredCount: hiredRows.length,
    hiredRow: hiredRows[0] || null,
    hireThreads: threads.filter((t) => t.threadKind === "job_hire").map((t) => ({ id: t.id, status: t.status, buyerId: t.buyerId })),
    aChat: document.getElementById("frame-a-chat")?.src || "",
    bChat: document.getElementById("frame-b-chat")?.src || "",
  };
}, { buyer: BUYER, hired: HIRED });
log("parent_after_pay", parentAfter);

console.log(JSON.stringify(trace, null, 2));

const ok =
  parentAfter.hiredCount >= 1 &&
  String(parentAfter.hiredRow?.recipientUserId) === BUYER;

if (!ok) {
  console.error("TRACE_FAIL");
  process.exitCode = 1;
} else {
  console.log("TRACE_OK");
}

await browser.close();
