#!/usr/bin/env node
/**
 * 求人 — 2段階終了（掲載者依頼 → 応募者完了）+ レビュー導線 E2E
 * PASS条件: 実DOM上でボタンが visible（診断値のみでは不可）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import { fixedJobBenchUrl } from "./lib/fixed-bench-url.mjs";
import { runBenchJobHireFullFlow } from "./lib/bench-job-hire-e2e.mjs";
import {
  checkCompletionButtonVisible,
  checkReviewPromptVisible,
  runCategoryDomVisibleChecks,
} from "./lib/bench-flow-diag-e2e.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const OUT = path.join("screenshots", "job-end-review-flow");
const POSTER_ID = "u_job_demo_full";
const BUYER_ID = "u_hiro";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("dialog", async (d) => d.accept());

const issues = [];

async function refreshChatFrames(threadId) {
  await page.evaluate((tid) => {
    ["frame-a-chat", "frame-b-chat"].forEach((frameId) => {
      const win = document.getElementById(frameId)?.contentWindow;
      win?.postMessage?.({ type: "tasu-chat-reload-room", threadId: tid }, "*");
      if (typeof win?.__tasuChatDetailReload === "function") {
        win.__tasuChatDetailReload({ threadId: tid });
      }
    });
    window.postMessage?.({ type: "tasu-bench-chat-refresh", threadId: tid }, "*");
  }, threadId);
  await page.waitForTimeout(2000);
}

/** 実DOMの visible を厳密判定（共通 E2E ライブラリ経由） */
async function readVisibleJobEndButton(frameId, labelRe) {
  const probe = await checkCompletionButtonVisible(page, frameId, labelRe);
  const frame = page.frameLocator(`#${frameId}`);
  const debugText = await frame.locator("#chatJobEndDebug").textContent().catch(() => "");
  const barExists = (await frame.locator("#chatJobEndBar").count()) > 0;
  return {
    frameId,
    source: probe.label,
    found: probe.ok || probe.visible,
    visible: probe.visible,
    box: probe.box,
    text: probe.text,
    barExists,
    debugText: String(debugText || "").trim(),
    probes: probe.probes,
  };
}

async function clickVisibleJobEndButton(frameId) {
  const clicked = await page.evaluate((id) => {
    const doc = document.getElementById(id)?.contentWindow?.document;
    if (!doc) return { ok: false, reason: "no_doc" };
    const barBtn = doc.getElementById("chatJobEndBarBtn");
    const topBtn = doc.getElementById("chatCompleteBtn");
    const pick =
      barBtn && !barBtn.hidden && barBtn.classList.contains("chat-job-end-bar__btn--visible")
        ? barBtn
        : topBtn && !topBtn.hidden
          ? topBtn
          : barBtn || topBtn;
    if (!pick) return { ok: false, reason: "no_button" };
    pick.scrollIntoView({ block: "nearest", inline: "nearest" });
    pick.click();
    const submit = doc.getElementById("chatCompleteSubmit");
    if (!submit) return { ok: false, reason: "no_submit", opened: true };
    submit.click();
    return { ok: true, text: pick.textContent?.trim() || "" };
  }, frameId);
  if (!clicked?.ok) {
    throw new Error(`click failed: ${JSON.stringify(clicked)}`);
  }
}

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

const flow = await runBenchJobHireFullFlow(page, { run: 1 });
if (!flow.ok) {
  console.log(JSON.stringify({ ok: false, step: flow.failedStep, message: flow.message }, null, 2));
  await page.screenshot({ path: path.join(OUT, "fail-pre-end-390.png") });
  await browser.close();
  process.exit(1);
}

const threadId = flow.threadId;

const posterBtnBefore = await readVisibleJobEndButton("frame-a-chat", /終了を依頼する/);
const applicantBtnBefore = await readVisibleJobEndButton("frame-b-chat", /終了を依頼する|やり取りを完了する/);

if (!posterBtnBefore.visible) {
  issues.push(
    `A: button「終了を依頼する」が実DOM visible ではない: ${JSON.stringify(posterBtnBefore)}`
  );
}
if (applicantBtnBefore.visible && /終了を依頼する/.test(applicantBtnBefore.text)) {
  issues.push(`B: 初期状態で「終了を依頼する」が見えている: ${JSON.stringify(applicantBtnBefore)}`);
}

await page.screenshot({ path: path.join(OUT, "01-before-request-390.png"), fullPage: false });

try {
  await clickVisibleJobEndButton("frame-a-chat");
} catch (err) {
  issues.push(`A: 終了依頼ボタン click 失敗: ${String(err?.message || err)}`);
}

await refreshChatFrames(threadId);
await page.screenshot({ path: path.join(OUT, "02-after-request-390.png"), fullPage: false });

const applicantBtnAfterRequest = await readVisibleJobEndButton(
  "frame-b-chat",
  /やり取りを完了する/
);
if (!applicantBtnAfterRequest.visible) {
  issues.push(
    `B: 依頼後「やり取りを完了する」が実DOM visible ではない: ${JSON.stringify(applicantBtnAfterRequest)}`
  );
}

const afterRequest = await page.evaluate(({ buyerId, tid }) => {
  const read = (frameId) => {
    const win = document.getElementById(frameId)?.contentWindow;
    return {
      diag: win?.__tasuJobFlowDiag || null,
      banner: win?.document?.getElementById("chatRoomStatusNotice")?.textContent?.trim() || "",
      bannerVisible: win?.document?.getElementById("chatRoomStatusNotice")?.hidden === false,
    };
  };
  const endReqNotif = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").find(
    (n) =>
      String(n.threadId) === tid &&
      String(n.recipientUserId) === buyerId &&
      (/終了依頼/.test(String(n.title || "")) || /終了依頼/.test(String(n.body || "")))
  );
  return { poster: read("frame-a-chat"), applicant: read("frame-b-chat"), endReqNotif };
}, { buyerId: BUYER_ID, threadId });

if (afterRequest.poster.diag?.roomStatus !== "end_requested") {
  issues.push(`roomStatus should be end_requested: ${afterRequest.poster.diag?.roomStatus}`);
}
if (!afterRequest.endReqNotif && !afterRequest.applicant.bannerVisible) {
  issues.push("applicant end-request notification/banner missing");
}

try {
  await clickVisibleJobEndButton("frame-b-chat");
} catch (err) {
  issues.push(`B: 完了ボタン click 失敗: ${String(err?.message || err)}`);
}

await refreshChatFrames(threadId);
await page.waitForTimeout(1500);

async function readVerifyState(tid) {
  return page.evaluate(({ posterId, buyerId, tid: threadKey }) => {
    const readFrame = (frameId) => {
      const win = document.getElementById(frameId)?.contentWindow;
      const doc = win?.document;
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]").filter(
        (n) => String(n.threadId) === threadKey && String(n.title || "").includes("やり取りが完了")
      );
      const notifPoster = notifs.find((n) => String(n.recipientUserId) === posterId);
      const notifApplicant = notifs.find((n) => String(n.recipientUserId) === buyerId);
      return {
        composerDisabled: doc?.getElementById("chatInput")?.disabled === true,
        reviewVisible: Boolean(doc?.querySelector("[data-platform-job-review-prompt]")),
        diag: win?.__tasuJobFlowDiag || null,
        notifPoster: notifPoster
          ? { title: notifPoster.title, reviewTargetUserId: notifPoster.reviewTargetUserId }
          : null,
        notifApplicant: notifApplicant
          ? { title: notifApplicant.title, reviewTargetUserId: notifApplicant.reviewTargetUserId }
          : null,
      };
    };
    return {
      poster: readFrame("frame-a-chat"),
      applicant: readFrame("frame-b-chat"),
    };
  }, { posterId: POSTER_ID, buyerId: BUYER_ID, tid });
}

let verify = await readVerifyState(threadId);
for (let i = 0; i < 5 && verify.poster?.diag?.roomStatus !== "closed"; i += 1) {
  await page.waitForTimeout(800);
  await refreshChatFrames(threadId);
  verify = await readVerifyState(threadId);
}

if (verify.poster.diag?.roomStatus !== "closed") {
  issues.push(`roomStatus not closed: ${verify.poster.diag?.roomStatus}`);
}
if (verify.poster.diag?.jobStatus !== "completed") {
  issues.push(`jobStatus not completed: ${verify.poster.diag?.jobStatus}`);
}
if (!verify.poster.composerDisabled || !verify.applicant.composerDisabled) {
  issues.push("composer should be disabled on both sides");
}
const reviewA = await checkReviewPromptVisible(page, "frame-a-chat");
const reviewB = await checkReviewPromptVisible(page, "frame-b-chat");
if (!reviewA.ok) issues.push(`A review prompt DOM visible NG: ${JSON.stringify(reviewA)}`);
if (!reviewB.ok) issues.push(`B review prompt DOM visible NG: ${JSON.stringify(reviewB)}`);

const domChecks = await runCategoryDomVisibleChecks(page, "job", "completed", {
  checkNotify: false,
  checkChat: false,
});
if (!domChecks.ok) issues.push(...domChecks.issues);

await page.evaluate(() => {
  document.getElementById("benchVerdictFold")?.setAttribute("open", "open");
});
await page.screenshot({ path: path.join(OUT, "03-after-complete-390.png"), fullPage: false });

const report = {
  ok: issues.length === 0,
  issues,
  threadId,
  posterBtnBefore,
  applicantBtnBefore,
  applicantBtnAfterRequest,
  afterRequest,
  verify,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(issues.length ? 1 : 0);
