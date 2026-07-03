#!/usr/bin/env node
/**
 * Builder 一般案件 — Screenshot Review（Talk partner_user フロー）
 *
 *   npm run dev 起動後:
 *   node scripts/capture-builder-general-ui-review.mjs
 *
 * 出力: reports/ui-review/builder-general/
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { findDevServerBaseUrl, buildLocalPageUrl } from "./lib/dev-server-url.mjs";
import { createUiReviewSession } from "./lib/ui-review-capture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURE = "builder-general";
const THREAD_ID = "verify-general-project";
const WORKFLOW_KEY = "tasful:talk:builder-workflow-state:v1";
const COMPLETION_KEY = "tasful:talk:builder-completion-reports:v1";
const REVEAL_KEY = "tasful:builder:contact-reveals:v1";
const COMPLETION_PHOTO = join(__dirname, "fixtures/completion-photo-1x1.png");
const COMPLETION_PHOTO_B = join(__dirname, "fixtures/completion-photo-b-1x1.png");
const DROP_SELECTOR = "[data-talk-builder-completion-photo-drop]";

const base = await findDevServerBaseUrl({ probePath: "chat-detail.html" });

function talkUrl(role, extra = {}) {
  const q = new URLSearchParams({
    thread: THREAD_ID,
    from: "builder",
    builderFlow: "partner_user",
    builderRole: role,
    ...extra,
  });
  return buildLocalPageUrl(base, `chat-detail.html?${q.toString()}`);
}

async function seedGeneralThread(page) {
  await page.goto(buildLocalPageUrl(base, "builder/builder-top.html"), { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ workflowKey, completionKey, revealKey, threadId }) => {
      localStorage.removeItem(workflowKey);
      localStorage.removeItem(completionKey);
      localStorage.removeItem(revealKey);
      const threads = [
        {
          id: threadId,
          chatDomain: "builder",
          threadKind: "project_thread",
          builderFlow: "partner_user",
          projectId: "builder_demo_001",
          listingId: "builder_demo_001",
          listingTitle: "一般案件テスト — 内装",
          partner: { displayName: "株式会社オレンジ建装", partnerId: "demo-partner-001" },
          contactTargetId: "demo-partner-001",
          source: "builder-mvp",
          status: "active",
          roomStatus: "active",
          lastMessage: "案件スレッド",
          updatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem("tasful_chat_threads", JSON.stringify(threads));
      localStorage.setItem("tasful_chat_messages", JSON.stringify({ [threadId]: [] }));
    },
    {
      workflowKey: WORKFLOW_KEY,
      completionKey: COMPLETION_KEY,
      revealKey: REVEAL_KEY,
      threadId: THREAD_ID,
    }
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {{ name: string, mime: string, path: string }[]} files
 */
async function dropFilesOnZone(page, files) {
  const payloads = files.map((f) => ({
    name: f.name,
    mime: f.mime,
    data: Array.from(readFileSync(f.path)),
  }));
  await page.evaluate(
    ({ selector, filePayloads }) => {
      const zone = document.querySelector(selector);
      if (!zone) throw new Error("drop zone missing");
      const dt = new DataTransfer();
      filePayloads.forEach(({ name, mime, data }) => {
        dt.items.add(new File([new Uint8Array(data)], name, { type: mime }));
      });
      zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { selector: DROP_SELECTOR, filePayloads: payloads }
  );
}

async function advancePartnerToWorking(page) {
  for (const next of ["started", "working"]) {
    await page.locator(`[data-talk-builder-next][data-next-status="${next}"]`).first().click();
    await page.waitForTimeout(500);
  }
}

async function submitCompletionMultiPhoto(page) {
  await page.locator('[data-talk-builder-next][data-next-status="completion_reported"]').click();
  await page.locator("#talkBuilderCompletionWork").waitFor({ state: "visible", timeout: 8000 });
  await page.locator("#talkBuilderCompletionWork").fill("壁紙張替え完了（一般案件 UI review）");
  await page.locator("#talkBuilderCompletionPhotos").setInputFiles([COMPLETION_PHOTO, COMPLETION_PHOTO_B]);
  await dropFilesOnZone(page, [
    { name: "drop-extra.png", mime: "image/png", path: COMPLETION_PHOTO },
  ]);
  await page.waitForTimeout(300);
  await page.locator("#talkBuilderCompletionSubmit").click();
  await page.locator("#talkBuilderCompletionModal").waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(600);
}

async function readBillingDiagnostics(page) {
  return page.evaluate(() => {
    const gp = window.TasuBuilderBillingPolicy?.POLICY?.generalProject;
    const threadId = new URLSearchParams(location.search).get("thread") || "";
    const wf = JSON.parse(localStorage.getItem("tasful:talk:builder-workflow-state:v1") || "{}")[threadId];
    const report = JSON.parse(localStorage.getItem("tasful:talk:builder-completion-reports:v1") || "{}")[threadId];
    return {
      contactRevealFeeYen: gp?.contactRevealFeeYen ?? null,
      commissionPctRange: gp?.commissionPctRange ?? null,
      completionCommission: gp?.completionCommission ?? null,
      workflowStatus: wf?.status || "",
      reportWorkContent: report?.workContent || "",
      reportPhotoCount: report?.photoCount ?? 0,
      reportPreviewCount: Array.isArray(report?.photoPreviews) ? report.photoPreviews.length : 0,
    };
  });
}

console.log(`\n=== Builder general UI review capture ===`);
console.log(`Base: ${base}`);
console.log(`Output: reports/ui-review/${FEATURE}/\n`);

const session = createUiReviewSession(FEATURE, { baseUrl: base, viewports: ["1280"] });

await withPlaywrightBrowser(async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await seedGeneralThread(page);

  await session.captureStep(page, browser, {
    slug: "board-projects",
    label: "案件一覧（掲示板）",
    url: buildLocalPageUrl(base, "builder/board-projects.html"),
    waitFor: "[data-builder-board-feed], .builder-board-feed, body",
  });

  await session.captureStep(page, browser, {
    slug: "user-before-reveal",
    label: "550円 連絡先開示前（依頼者）",
    url: talkUrl("user"),
    waitFor: "#talkBuilderWorkflowPanel",
  });

  page.once("dialog", (d) => d.accept());
  await page.goto(talkUrl("user"), { waitUntil: "domcontentloaded" });
  await page.locator("[data-builder-contact-reveal]").first().click();
  await page.waitForTimeout(600);

  await session.captureStep(page, browser, {
    slug: "user-after-reveal",
    label: "550円 開示後 · Talk 有効",
    url: talkUrl("user"),
    waitFor: "#chatInput",
    prepare: async (p) => {
      if (await p.locator("#chatInput").isDisabled()) {
        p.once("dialog", (d) => d.accept());
        await p.locator("[data-builder-contact-reveal]").first().click().catch(() => null);
        await p.waitForTimeout(500);
      }
    },
  });

  await page.goto(talkUrl("partner"), { waitUntil: "domcontentloaded" });
  await page.locator("#talkBuilderWorkflowPanel").waitFor({ state: "visible", timeout: 15000 });
  await advancePartnerToWorking(page);

  await session.captureStep(page, browser, {
    slug: "partner-working",
    label: "施工中（作業者）",
    url: talkUrl("partner"),
    waitFor: "#talkBuilderWorkflowStatusBadge",
  });

  await submitCompletionMultiPhoto(page);

  await session.captureStep(page, browser, {
    slug: "partner-client-confirming",
    label: "依頼者確認待ち（作業者）",
    url: talkUrl("partner"),
    waitFor: "#talkBuilderWorkflowStatusBadge",
  });

  await page.goto(talkUrl("user"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await session.captureStep(page, browser, {
    slug: "user-completion-card",
    label: "依頼者 · 完了報告カード",
    url: talkUrl("user"),
    waitFor: "[data-talk-builder-completion-report]",
  });

  const thumb = page.locator("[data-talk-builder-completion-photo-thumb] img").first();
  if (await thumb.count()) {
    await thumb.click();
    await page.waitForTimeout(300);
    await session.captureStep(page, browser, {
      slug: "user-photo-lightbox",
      label: "依頼者 · 完了写真ライトボックス",
      url: page.url(),
      waitFor: "#talkBuilderCompletionPhotoLightbox",
    });
    await page.locator(".talk-builder-completion-photo-lightbox__close").click().catch(() => null);
  }

  await page.locator('[data-talk-builder-next][data-next-status="completed"]').first().click();
  await page.waitForTimeout(700);

  await session.captureStep(page, browser, {
    slug: "user-completed",
    label: "依頼者承認 · 案件完了",
    url: talkUrl("user"),
    waitFor: "#talkBuilderWorkflowStatusBadge",
  });

  const billing = await readBillingDiagnostics(page);
  const reportPath = session.writeReport({
    feature: FEATURE,
    baseUrl: base,
    threadId: THREAD_ID,
    billingDiagnostics: billing,
    checks: {
      contactReveal550: billing.contactRevealFeeYen === 550,
      commissionRange5to10:
        Array.isArray(billing.commissionPctRange) &&
        billing.commissionPctRange[0] === 5 &&
        billing.commissionPctRange[1] === 10,
      workflowCompleted: billing.workflowStatus === "completed",
      completionReportSaved: Boolean(billing.reportWorkContent),
      multiPhotoSaved: Number(billing.reportPhotoCount) >= 2,
    },
  });

  console.log(`\nBilling diagnostics: ${JSON.stringify(billing, null, 2)}`);
  console.log(`Report: ${reportPath}`);

  const checks = {
    contactReveal550: billing.contactRevealFeeYen === 550,
    commissionRange5to10:
      Array.isArray(billing.commissionPctRange) &&
      billing.commissionPctRange[0] === 5 &&
      billing.commissionPctRange[1] === 10,
    workflowCompleted: billing.workflowStatus === "completed",
    completionReportSaved: Boolean(billing.reportWorkContent),
    multiPhotoSaved: Number(billing.reportPhotoCount) >= 2,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length) {
    console.error("\n=== UI review checks FAILED ===");
    failed.forEach(([k]) => console.error(`  ✗ ${k}`));
    await closeAllBrowsers();
    process.exit(1);
  }
  console.log("\nPASS capture-builder-general-ui-review");
});

await closeAllBrowsers();
