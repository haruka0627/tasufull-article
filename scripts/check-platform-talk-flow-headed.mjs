#!/usr/bin/env node
/**
 * Platform 求人 → TASFUL Talk — Manual Review Flow（headed）
 *
 *   node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=1280
 *   REVIEW_AUTO_ENTER=1 REVIEW_AUTO_DRIVE=1 node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import {
  PLATFORM_JOB_TALK_CFG,
  resetPlatformJobTalkState,
  waitJobApplicationsReady,
  clickJobProceedForApplication,
  navigatePlatformJobToTalk,
  ensureTalkDevOnFeePay,
  completeFeePayAndOpenChat,
  readPlatformJobTalkDiagnostics,
  probeBuilderWorkflowMisdisplay,
  probePlatformNotifyCard,
  sendPlatformChatMessage,
  openPlatformChatAsUser,
  chatMessagesContain,
} from "./lib/platform-job-talk-review.mjs";

const FEATURE = "platform-talk";
const MANUAL_REVIEW_DIR = join(process.cwd(), "reports", "manual-review", FEATURE);
const cfg = PLATFORM_JOB_TALK_CFG;

const CLI = {
  manualReviewFlow: process.argv.includes("--manual-review-flow"),
  viewport: (() => {
    const m = process.argv.find((a) => a.startsWith("--viewport="));
    return m ? m.split("=")[1] : "1280";
  })(),
};

const VIEWPORTS = {
  "1280": { width: 1280, height: 900, label: "1280" },
  "768": { width: 768, height: 900, label: "768" },
  "390": { width: 390, height: 844, label: "390" },
};

const STEPS = [
  {
    slug: "job-applications",
    screen: "応募者確認",
    checks: ["応募者カード表示", "「やりとりに進む」CTA"],
  },
  {
    slug: "fee-pay-550",
    screen: "550円 やりとり開始利用料",
    checks: ["550円表示", "求人カテゴリ", "Connect/5% なし"],
  },
  {
    slug: "talk-room-created",
    screen: "Talk ルーム作成",
    checks: ["thread / roomId 生成", "求人応募カード", "Builder workflow UI なし"],
  },
  {
    slug: "normal-chat-poster",
    screen: "通常チャット · 掲載者",
    checks: ["メッセージ送信", "案件文脈が残る"],
  },
  {
    slug: "normal-chat-applicant",
    screen: "通常チャット · 応募者",
    checks: ["相手メッセージ受信", "返信送信"],
  },
  {
    slug: "thread-sync",
    screen: "thread / 参加者同期",
    checks: ["job_hire", "listingId / applicationId", "poster / applicant ID"],
  },
  {
    slug: "notify-and-negative",
    screen: "通知 · Builder UI 非表示",
    checks: ["応募通知", "Builder 入退場/完了/承認なし", "Console Error 0"],
  },
];

/** @type {string[]} */
const consoleErrors = [];
let stepCounter = 0;
/** @type {object[]} */
const flowSteps = [];

function attachConsole(page) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource.*401|Failed to load resource.*406|PGRST116/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err?.message || err)));
}

async function waitEnter() {
  if (process.env.REVIEW_AUTO_ENTER === "1") {
    await new Promise((r) => setTimeout(r, 600));
    return;
  }
  console.log("Enter で probe…");
  await new Promise((resolve) => {
    process.stdin.once("data", () => resolve(undefined));
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string }} ctx
 * @param {typeof STEPS[number]} step
 */
async function driveStep(page, ctx, step) {
  const base = ctx.base;
  switch (step.slug) {
    case "job-applications": {
      await resetPlatformJobTalkState(page, base);
      const url = buildLocalPageUrl(
        base,
        `detail-job.html?id=${cfg.listingId}&userId=${cfg.posterUserId}&talkDev=1#applications`
      );
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => document.body.dataset.listingLoaded === "true", { timeout: 45000 });
      await waitJobApplicationsReady(page);
      break;
    }
    case "fee-pay-550": {
      if (!/platform-chat-fee-pay/i.test(page.url())) {
        await clickJobProceedForApplication(page, cfg.applicationId);
        await page.waitForURL(/platform-chat-fee-pay/i, { timeout: 20000 });
      }
      const u = new URL(page.url());
      if (u.searchParams.get("talkDev") !== "1") {
        u.searchParams.set("talkDev", "1");
        await page.goto(u.toString(), { waitUntil: "domcontentloaded" });
      }
      break;
    }
    case "talk-room-created": {
      if (/chat-detail/i.test(page.url())) {
        ctx.threadId = ctx.threadId || new URL(page.url()).searchParams.get("thread") || "";
        break;
      }
      if (/platform-chat-fee-pay/i.test(page.url())) {
        const nav = await completeFeePayAndOpenChat(page, ctx.base, cfg.posterUserId);
        ctx.threadId = nav.threadId;
        break;
      }
      const nav = await navigatePlatformJobToTalk(page, ctx.base);
      ctx.threadId = nav.threadId;
      break;
    }
    case "normal-chat-poster": {
      ctx.threadId = ctx.threadId || new URL(page.url()).searchParams.get("thread") || "";
      page.on("dialog", (d) => d.accept());
      if (!(await chatMessagesContain(page, "Platform案件"))) {
        await sendPlatformChatMessage(page, "Platform案件から相談します（manual review · poster）");
        await page.waitForTimeout(800);
      }
      break;
    }
    case "normal-chat-applicant": {
      ctx.threadId = ctx.threadId || "";
      await openPlatformChatAsUser(page, base, ctx.threadId, cfg.applicantUserId);
      if (!(await chatMessagesContain(page, "Platform案件"))) {
        throw new Error("applicant cannot see poster message");
      }
      await sendPlatformChatMessage(page, "応募者から返信します（manual review）");
      break;
    }
    case "thread-sync": {
      ctx.threadId = ctx.threadId || "";
      await openPlatformChatAsUser(page, base, ctx.threadId, cfg.posterUserId);
      break;
    }
    case "notify-and-negative":
      break;
    default:
      break;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {{ threadId?: string, base: string }} ctx
 */
async function probeStep(page, ctx, step) {
  const threadId = ctx.threadId || new URL(page.url()).searchParams.get("thread") || "";
  const diagnostics = await readPlatformJobTalkDiagnostics(page, threadId).catch(() => ({}));
  const forbidden = await probeBuilderWorkflowMisdisplay(page);
  let notifyPoster = { notifyFound: false, cardVisible: false };
  if (step.slug === "notify-and-negative") {
    notifyPoster = await probePlatformNotifyCard(page, ctx.base, cfg.posterUserId, cfg.applyNotifyId);
    await openPlatformChatAsUser(page, ctx.base, threadId, cfg.posterUserId);
  }
  const chatText = ((await page.locator("#chatMessages").textContent().catch(() => "")) || "").slice(0, 400);
  return {
    capturedAt: new Date().toISOString(),
    slug: step.slug,
    url: page.url(),
    threadId,
    diagnostics,
    forbidden,
    notifyPoster,
    chatTextSample: chatText,
    consoleErrorCount: consoleErrors.length,
  };
}

function evaluateStep(step, probe) {
  const d = probe.diagnostics || {};
  const f = probe.forbidden || {};
  switch (step.slug) {
    case "job-applications":
      return Boolean(d.listingId || /applications/i.test(probe.url));
    case "fee-pay-550":
      return /platform-chat-fee-pay/i.test(probe.url);
    case "talk-room-created":
      return (
        /chat-detail/i.test(probe.url) &&
        d.threadKind === "job_hire" &&
        (d.hasJobApplicationCard || Boolean(d.listingTitle)) &&
        f.visibleWorkflowButtons === 0 &&
        f.enterExitButtons === 0
      );
    case "normal-chat-poster":
      return (
        /chat-detail/i.test(probe.url) &&
        d.threadKind === "job_hire" &&
        d.threadStatus === "open" &&
        Boolean(d.listingTitle)
      );
    case "normal-chat-applicant":
      return (
        /chat-detail/i.test(probe.url) &&
        (/応募者から返信|manual review|Platform案件/i.test(probe.chatTextSample || "") ||
          (d.messageCount || 0) >= 4)
      );
    case "thread-sync":
      return Boolean(
        d.threadId &&
          d.roomId &&
          d.listingId === cfg.listingId &&
          d.applicantUserId &&
          d.posterUserId
      );
    case "notify-and-negative":
      return (
        (probe.notifyPoster?.notifyFound || probe.notifyPoster?.cardVisible) &&
        f.visibleWorkflowButtons === 0 &&
        f.enterExitButtons === 0 &&
        !f.hasCommissionPctText
      );
    default:
      return true;
  }
}

async function runManualFlow(page, vpLabel) {
  const base = await findDevServerBaseUrl({ probePath: "detail-job.html" });
  /** @type {{ threadId?: string, base: string }} */
  const ctx = { base };
  attachConsole(page);

  console.log(`\n[manual-review-flow] Platform job → Talk · viewport ${vpLabel}`);
  console.log(`review dir: ${MANUAL_REVIEW_DIR}\n`);

  for (const step of STEPS) {
    stepCounter += 1;
    const pad = String(stepCounter).padStart(3, "0");
    console.log(`\n${"=".repeat(60)}`);
    console.log(`STEP ${stepCounter}: ${step.screen}`);
    step.checks.forEach((c) => console.log(`  - ${c}`));
    console.log(`${"=".repeat(60)}`);

    if (process.env.REVIEW_AUTO_DRIVE === "1") {
      await driveStep(page, ctx, step);
    }
    await waitEnter();

    const probe = await probeStep(page, ctx, step);
    if (probe.threadId) ctx.threadId = probe.threadId;

    mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
    const pngPath = join(MANUAL_REVIEW_DIR, `${pad}-${step.slug}.png`);
    const jsonPath = join(MANUAL_REVIEW_DIR, `${pad}-${step.slug}.json`);
    await page.screenshot({ path: pngPath, fullPage: true });
    writeFileSync(jsonPath, JSON.stringify(probe, null, 2));

    const ok = evaluateStep(step, probe);
    console.log(`  probe ${step.slug}: ${ok ? "PASS" : "FAIL"}`);
    console.log(`  screenshot: ${pngPath}`);
    flowSteps.push({ slug: step.slug, ok, png: pngPath, json: jsonPath, probe });

    if (!ok) {
      return { ok: false, ctx, probe };
    }
  }

  return { ok: true, ctx, diagnostics: await readPlatformJobTalkDiagnostics(page, ctx.threadId || "") };
}

const base = await findDevServerBaseUrl({ probePath: "detail-job.html" });
console.log("=== Platform → Talk headed check ===");
console.log(`Base URL: ${base}`);
console.log(`mode: ${CLI.manualReviewFlow ? "manual-review-flow" : "quick"}`);

if (!CLI.manualReviewFlow) {
  console.error("Use --manual-review-flow");
  process.exit(1);
}

const vp = VIEWPORTS[CLI.viewport] || VIEWPORTS["1280"];
let failed = false;

await withPlaywrightBrowser(
  async (browser) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      recordVideo: { dir: MANUAL_REVIEW_DIR },
    });
    const page = await context.newPage();
    const result = await runManualFlow(page, vp.label);
    failed = !result.ok;

    const report = {
      feature: `${FEATURE}-manual-review-flow`,
      capturedAt: new Date().toISOString(),
      baseUrl: base,
      viewport: vp.label,
      steps: flowSteps,
      diagnostics: result.diagnostics || flowSteps.at(-1)?.probe?.diagnostics || null,
      consoleErrorCount: consoleErrors.length,
      consoleErrors: [...consoleErrors],
    };
    mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
    writeFileSync(join(MANUAL_REVIEW_DIR, "report.json"), JSON.stringify(report, null, 2));

    console.log(`\nConsole Error: ${consoleErrors.length}`);
    if (consoleErrors.length) consoleErrors.slice(0, 5).forEach((e) => console.error(`  ${e}`));

    await context.close();
  },
  { headless: false, slowMo: process.env.REVIEW_AUTO_DRIVE === "1" ? 200 : 450 }
);

await closeAllBrowsers();

console.log(`\n========== SUMMARY ==========`);
console.log(`Result: ${failed ? "FAIL" : "PASS"}`);
console.log(`Output: ${MANUAL_REVIEW_DIR}`);
console.log(`Command: node scripts/check-platform-talk-flow-headed.mjs --manual-review-flow --viewport=${CLI.viewport}`);

process.exit(failed ? 1 : 0);
