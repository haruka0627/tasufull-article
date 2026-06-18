#!/usr/bin/env node
/**
 * 求人550円後段フロー検証
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const OUT_DIR = path.join("screenshots", "platform-verify-job-550-postpay");
const JOB_ID = "job_demo_full_001";
const POSTER_ID = "u_job_demo_full";
const MARKERS = [
  "tasful_platform_notify_master_v2",
  "tasful_job_applications_v1",
  "tasful_chat_threads",
  "tasful_platform_chat_fees_v1",
];

const FORBIDDEN = /deal-detail\.html|5%|Connect|完了時請求|チャットで確認/i;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitApplications(page) {
  await page.waitForFunction(
    () => {
      window.TasuJobDetailApplications?.refresh?.(
        window.__tasuDetailContactListing || window.__tasuDetailFavoriteListing
      );
      const section = document.querySelector("[data-job-applications-section]");
      return section && !section.hidden;
    },
    { timeout: 45000 }
  );
  await page.waitForTimeout(600);
}

async function run() {
  await withPlaywrightBrowser(async (browser) => {const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const report = { markers: MARKERS, cases: [] };

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(
    `${BASE}/detail-job.html?id=${JOB_ID}&userId=${POSTER_ID}&talkDev=1#applications`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForFunction(
    () => document.body.dataset.listingLoaded === "true",
    { timeout: 45000 }
  );
  await waitApplications(page);
  await page.screenshot({ path: path.join(OUT_DIR, "01-applications-390.png") });

  const rules = await page.evaluate((jobId) => {
    const Fee = window.TasuPlatformChatFee;
    const listing = { listing_type: "job", id: jobId };
    return {
      gate: Fee?.shouldGateChatStart?.(listing),
      connect: Fee?.hasStripeConnect?.(listing, "job"),
      completion: Fee?.shouldNotifyOnCompletion?.(listing),
      flatFee: Fee?.calcJobChatFee?.(),
      prepay: Fee?.calcPreChatFee?.(listing),
    };
  }, JOB_ID);
  report.rules = rules;

  if (!rules.gate) errors.push("job should gate chat start");
  if (rules.connect) errors.push("job should not use Connect");
  if (rules.completion) errors.push("job should not have completion billing");
  if (rules.flatFee !== 550) errors.push(`flat fee expected 550, got ${rules.flatFee}`);

  const proceedBtn = page.locator("[data-job-app-proceed]").first();
  if ((await proceedBtn.count()) < 1) errors.push("やりとりに進む button missing");

  await proceedBtn.click();
  await page.waitForURL(/platform-chat-fee-pay\.html/i, { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, "02-fee-pay-390.png") });

  const payUi = await page.evaluate(() => ({
    amount: document.querySelector("[data-platform-fee-amount]")?.textContent?.trim() || "",
    rate: document.querySelector("[data-platform-fee-rate]")?.textContent?.trim() || "",
    category: document.querySelector("[data-platform-fee-category]")?.textContent?.trim() || "",
    bodyText: document.body.innerText || "",
  }));
  report.payUi = payUi;

  if (!payUi.amount.includes("550")) errors.push(`pay amount: ${payUi.amount}`);
  if (payUi.rate.includes("5%")) errors.push(`job pay should not show 5%: ${payUi.rate}`);
  if (payUi.category !== "求人") errors.push(`category: ${payUi.category}`);
  if (FORBIDDEN.test(payUi.bodyText.replace(/550円/g, ""))) {
    errors.push("forbidden text on fee pay page");
  }

  const threadId = await page.evaluate(() => new URLSearchParams(window.location.search).get("thread"));
  const beforePay = await page.evaluate((tid) => {
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    return threads.find((t) => String(t.id) === String(tid))?.status || "";
  }, threadId);
  report.beforePayStatus = beforePay;
  if (beforePay !== "fee_pending") errors.push(`before pay status: ${beforePay}`);

  await page.click("[data-platform-fee-pay]");
  await page.waitForFunction(
    () => !document.querySelector("[data-platform-fee-complete]")?.hasAttribute("hidden"),
    { timeout: 15000 }
  );
  await page.screenshot({ path: path.join(OUT_DIR, "03-pay-complete-390.png") });

  const afterPay = await page.evaluate((tid) => {
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const msgs = JSON.parse(localStorage.getItem("tasful_chat_messages") || "{}");
    const apps = JSON.parse(localStorage.getItem("tasful_job_applications_v1") || "[]");
    const thread = threads.find((t) => String(t.id) === String(tid));
    const messages = msgs[tid] || [];
    const jobCard = messages.find((m) => m.kind === "job_application_card");
    const app = apps.find((a) => String(a.thread_id) === String(tid));
    return {
      threadStatus: thread?.status || "",
      threadKind: thread?.threadKind || "",
      msgCount: messages.length,
      hasJobCard: Boolean(jobCard),
      jobCardTitle: jobCard?.jobApplicationCard?.jobTitle || "",
      appStatus: app?.status || "",
    };
  }, threadId);
  report.afterPay = afterPay;

  if (afterPay.threadStatus !== "open") errors.push(`after pay status: ${afterPay.threadStatus}`);
  if (afterPay.threadKind !== "job_hire") errors.push(`thread kind: ${afterPay.threadKind}`);
  if (!afterPay.hasJobCard) errors.push("job application card missing");
  if (afterPay.appStatus !== "selected") errors.push(`application status: ${afterPay.appStatus}`);

  const chatLink = page.locator("[data-platform-fee-chat-link]");
  await chatLink.click();
  await page.waitForURL(/chat-detail\.html/i, { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT_DIR, "04-job-chat-390.png") });

  const chatUi = await page.evaluate(() => ({
    hasJobCard: Boolean(document.querySelector("[data-platform-job-application-card]")),
    cardTitle: document.querySelector(".chat-job-card__title")?.textContent?.trim() || "",
    forbiddenBtn: Boolean(
      [...document.querySelectorAll("a,button")].some((el) => /チャットで確認/.test(el.textContent || ""))
    ),
    url: window.location.href,
  }));
  report.chatUi = chatUi;

  if (!chatUi.hasJobCard) errors.push("job card not visible in chat");
  if (chatUi.forbiddenBtn) errors.push("チャットで確認 should not appear");
  if (!chatUi.url.includes("chat-detail.html")) errors.push(`chat url: ${chatUi.url}`);

  report.errors = errors;
  report.ok = errors.length === 0;
  report.screenshots = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
  fs.writeFileSync(path.join(OUT_DIR, "job-550-postpay-report.json"), JSON.stringify(report, null, 2));

    });
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) {
    errors.forEach((e) => console.error(`NG: ${e}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("ALL OK — job 550 postpay verified");
}

await run();
