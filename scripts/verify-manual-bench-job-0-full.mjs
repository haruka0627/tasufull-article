#!/usr/bin/env node
/**
 * 求人 job-0 ベンチ — 550円後承諾通知 / 完了申請 / 完了承認レビュー通知（実画面E2E）
 */
import { chromium } from "./lib/playwright-browser.mjs";
import fs from "fs";
import path from "path";
import { requireDevServer } from "./lib/dev-base-url.mjs";
import {
  fixedJobBenchUrl,
  FIXED_JOB_EXPECTED_CHAT_STARTED_TITLE,
  isCanonicalBenchParentUrl,
} from "./lib/fixed-bench-url.mjs";

const BASE = await requireDevServer();
const URL = fixedJobBenchUrl(BASE);
const HIRED_TITLE = FIXED_JOB_EXPECTED_CHAT_STARTED_TITLE;
const COMPLETE_REQUEST_TITLE = "取引完了の確認依頼";
const TRADE_DONE_TITLE = "取引が完了しました";
const OUT = path.join("screenshots", "manual-bench-job-0-full");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
const report = { url: URL, checks: {}, ok: false };

page.on("dialog", async (d) => {
  await d.accept();
});

function findFrame(page, pattern) {
  if (typeof pattern === "function") {
    return page.frames().find(pattern);
  }
  return page.frames().find((f) => pattern.test(f.url()));
}

async function readNotifyTitles(frame) {
  if (!frame) return [];
  return frame.evaluate(() =>
    [...document.querySelectorAll(".talk-notify-card__title, .talk-notify-card__title--job-event")].map(
      (el) => el.textContent?.trim() || ""
    )
  );
}

async function clickNotifyByTitle(frame, title) {
  if (!frame) return false;
  return frame.evaluate((needle) => {
    const cards = [...document.querySelectorAll(".talk-notify-card")];
    const card = cards.find((el) => {
      const t = el.querySelector(".talk-notify-card__title, .talk-notify-card__title--job-event");
      return String(t?.textContent || "").includes(needle);
    });
    if (!card) return false;
    const btn = card.querySelector(
      "[data-talk-notify-action='navigate'], [data-talk-notify-action], .talk-notify-card__minimal-action"
    );
    btn?.click();
    return true;
  }, title);
}

async function waitChatReady(frame) {
  if (!frame) return;
  await frame.waitForFunction(() => document.body.dataset.chatDetailReady === "true", null, {
    timeout: 20000,
  });
  await page.waitForTimeout(400);
}

try {
  if (!isCanonicalBenchParentUrl(URL)) throw new Error("job bench URL must be canonical");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);

  const bDetail = findFrame(page, /detail-job/i);
  if (!bDetail) throw new Error("b_detail_missing");

  await bDetail.evaluate(() => {
    document.querySelector("[data-listing-primary-cta], [data-job-apply]")?.click();
  });
  await page.waitForTimeout(4000);

  report.checks.afterApply = await page.evaluate(() => {
    const apps = JSON.parse(localStorage.getItem("tasful_job_applications_v1") || "[]");
    const dbg = document.getElementById("benchDebugPanel")?.textContent || "";
    return {
      appCount: apps.filter((a) => a.job_id === "job_demo_full_001").length,
      flowPhase: dbg.match(/flowPhase: (.+)/)?.[1]?.trim(),
      bChat: document.getElementById("frame-b-chat")?.src || "",
    };
  });

  const aMgmt = findFrame(
    page,
    (f) => /detail-job/i.test(f.url()) && /benchManagement=1|view=applications|#applications/i.test(f.url())
  );
  if (!aMgmt) {
    const aNotify = page.frame({ url: /talk-home.*tab=notify/ });
    if (aNotify) {
      await aNotify.evaluate(() => {
        const btn = document.querySelector("[data-talk-notify-action], .talk-notify-card__minimal-action");
        btn?.click();
      });
      await page.waitForTimeout(4000);
    }
  }

  let mgmt = findFrame(
    page,
    (f) => /detail-job/i.test(f.url()) && /benchManagement=1|view=applications|#applications/i.test(f.url())
  );
  if (!mgmt) {
    await page.evaluate(() => {
      const profile = window.TasuPlatformChatDualWindowDemo?.getProfile?.("job", false);
      const href = window.TasuPlatformChatLiveFlow?.managementPageUrl?.(profile, profile.partnerAId);
      if (href) window.__tasuBenchReconcile?.({ skipRender: true });
      const el = document.getElementById("frame-a-chat");
      if (el && href) el.src = href + (href.includes("?") ? "&" : "?") + "benchEmbed=1&benchViewport=390";
    });
    await page.waitForTimeout(3000);
    mgmt = findFrame(page, /detail-job/i);
  }

  if (mgmt) {
    await mgmt.evaluate(() => {
      document.querySelector("[data-job-app-proceed]")?.click();
    });
    await page.waitForTimeout(3500);
  }

  const aFee = findFrame(page, /platform-chat-fee-pay/i);
  if (aFee) {
    await aFee.evaluate(() => {
      if (window.confirm.toString().includes("native code")) window.confirm = () => true;
      document.querySelector("[data-platform-fee-pay]")?.click();
    });
    await page.waitForTimeout(4500);
  }

  const threadId = await page.evaluate(() => {
    const threads = JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]");
    const hire = threads.filter((t) => String(t.threadKind) === "job_hire");
    return hire[0]?.id || "";
  });

  report.checks.afterPay = await page.evaluate(
    ({ hiredTitle, tid }) => {
      const dbg = document.getElementById("benchDebugPanel")?.textContent || "";
      let all = [];
      try {
        const raw = localStorage.getItem("tasful_talk_notifications");
        all = raw ? JSON.parse(raw) : [];
      } catch {
        all = window.TasuTalkNotifications?.getAll?.() || [];
      }
      const notifs = (Array.isArray(all) ? all : []).filter(
        (n) =>
          String(n.recipientUserId) === "u_hiro" &&
          String(n.title || "").includes(String(hiredTitle).slice(0, 6))
      );
      return {
        threadId: tid,
        aChat: document.getElementById("frame-a-chat")?.src || "",
        bChat: document.getElementById("frame-b-chat")?.src || "",
        aOnChat: /chat-detail\.html/i.test(document.getElementById("frame-a-chat")?.src || ""),
        bOnChat: /chat-detail\.html/i.test(document.getElementById("frame-b-chat")?.src || ""),
        bOnBuyerWait: /platform-chat-bench-buyer-wait/i.test(document.getElementById("frame-b-chat")?.src || ""),
        bNotifyCount: notifs.length,
        bNotifyTitle: notifs[0]?.title || "",
        bNotifyCta: notifs[0]?.actionLabel || "",
        flowPhase: dbg.match(/flowPhase: (.+)/)?.[1]?.trim(),
      };
    },
    { hiredTitle: HIRED_TITLE, tid: threadId }
  );

  const bNotifyLocator = page.frameLocator("#frame-b-notify");
  await page.waitForTimeout(800);
  report.checks.bNotifyDomAfterPay = await bNotifyLocator
    .locator(".talk-notify-card__title, .talk-notify-card__title--job-event")
    .evaluateAll((els) => {
      const titles = els.map((el) => el.textContent?.trim() || "");
      return { titles, hasHired: titles.some((t) => t.includes("応募が承諾")) };
    })
    .catch(() => ({ titles: [], hasHired: false }));

  const requestResult = await page.evaluate((tid) => {
    const w = document.getElementById("frame-a-chat")?.contentWindow;
    if (!w) return { ok: false, reason: "no_a_chat_frame" };
    const doc = w.document;
    const row = (w.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(tid));
    const uid = w.TasuChatUserIdentity?.getEffectiveUserId?.() || "u_job_demo_full";
    const flow = w.TasuPlatformChatCompletionFlow;
    if (row && flow?.canRequestCompletion?.(row, uid)) {
      const viaApi = flow.requestCompletion?.({ threadId: tid, thread: row, userId: uid });
      if (viaApi?.ok) return { ok: true, via: "api" };
    }
    const btn = doc.getElementById("chatCompleteBtn");
    if (btn && !btn.hidden && !btn.disabled) {
      btn.click();
      const submit = doc.getElementById("chatCompleteSubmit");
      if (submit && !submit.hidden) {
        submit.click();
        return { ok: true, via: "ui" };
      }
      return { ok: false, reason: "submit_missing", btnText: btn.textContent?.trim() };
    }
    return {
      ok: false,
      reason: "complete_btn_unavailable",
      btnHidden: btn?.hidden,
      btnDisabled: btn?.disabled,
      btnText: btn?.textContent?.trim(),
    };
  }, threadId);
  report.checks.completeRequestAction = requestResult;
  await page.waitForTimeout(1500);

  report.checks.afterCompleteRequest = await page.evaluate(
    ({ requestTitle, tid }) => {
      let all = [];
      try {
        const raw = localStorage.getItem("tasful_talk_notifications");
        all = raw ? JSON.parse(raw) : [];
      } catch {
        all = window.TasuTalkNotifications?.getAll?.() || [];
      }
      const notifs = (Array.isArray(all) ? all : []).filter(
        (n) =>
          String(n.recipientUserId) === "u_hiro" &&
          String(n.title || "").includes(String(requestTitle).slice(0, 4))
      );
      const row = (JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]") || []).find(
        (t) => String(t.id) === String(tid)
      );
      return {
        threadStatus: row?.roomStatus || row?.status || "",
        bRequestNotifyCount: notifs.length,
        bRequestTitle: notifs[0]?.title || "",
        bRequestCta: notifs[0]?.actionLabel || "",
      };
    },
    { requestTitle: COMPLETE_REQUEST_TITLE, tid: threadId }
  );

  await page.evaluate(() => {
    window.__tasuBenchReconcile?.({ skipRender: true });
  });
  await page.waitForTimeout(1000);
  report.checks.bNotifyDomAfterRequest = await bNotifyLocator
    .locator(".talk-notify-card__title, .talk-notify-card__title--job-event")
    .evaluateAll((els) => {
      const titles = els.map((el) => el.textContent?.trim() || "");
      return { titles, hasRequest: titles.some((t) => t.includes("取引完了の確認依頼")) };
    })
    .catch(() => ({ titles: [], hasRequest: false }));

  await bNotifyLocator
    .locator(".talk-notify-card")
    .filter({ hasText: COMPLETE_REQUEST_TITLE })
    .first()
    .locator("[data-talk-notify-action='navigate'], [data-talk-notify-action], .talk-notify-card__minimal-action")
    .click({ timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(2500);

  const approveResult = await page.evaluate((tid) => {
    const w = document.getElementById("frame-b-chat")?.contentWindow;
    if (!w) return { ok: false, reason: "no_b_chat_frame" };
    const doc = w.document;
    const row = (w.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(tid));
    const uid = w.TasuChatUserIdentity?.getEffectiveUserId?.() || "u_hiro";
    const flow = w.TasuPlatformChatCompletionFlow;
    if (row && flow?.canApproveCompletion?.(row, uid)) {
      const btn = doc.getElementById("chatApproveCompleteBtn");
      if (btn && !btn.hidden && !btn.disabled) {
        btn.click();
        return { ok: true, via: "ui" };
      }
      const viaApi = flow.approveCompletion?.({ threadId: tid, thread: row, userId: uid });
      if (viaApi?.ok) return { ok: true, via: "api" };
    }
    return { ok: false, reason: "cannot_approve", status: row?.roomStatus || row?.status };
  }, threadId);
  report.checks.approveAction = approveResult;
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = document.getElementById("frame-b-chat");
    if (el?.src) el.src = el.src.replace(/([?&])_ts=\d+/, "$1") + (el.src.includes("_ts=") ? "" : (el.src.includes("?") ? "&" : "?") + "_ts=" + Date.now());
  });
  await page.waitForTimeout(2000);
  report.checks.afterApprove = await page.evaluate((tid) => {
    const w = document.getElementById("frame-b-chat")?.contentWindow;
    const doc = w?.document;
    const row = (JSON.parse(localStorage.getItem("tasful_chat_threads") || "[]") || []).find(
      (t) => String(t.id) === String(tid)
    );
    return {
      reviewPrompt: Boolean(doc?.querySelector("[data-platform-job-review-prompt]")),
      roomStatus: row?.roomStatus || row?.status || "",
      threadCompleted: String(row?.roomStatus || row?.status || "") === "completed",
    };
  }, threadId);

  await page.evaluate(() => {
    window.__tasuBenchReconcile?.({ skipRender: true });
    ["frame-a-notify", "frame-b-notify"].forEach((frameId) => {
      const el = document.getElementById(frameId);
      if (!el?.src) return;
      try {
        const u = new URL(el.src, window.location.href);
        u.searchParams.set("_ts", String(Date.now()));
        el.src = `${u.pathname}${u.search}`;
      } catch {
        /* ignore */
      }
    });
  });
  await page.waitForTimeout(2500);

  report.checks.afterTradeDone = await page.evaluate(({ doneTitle }) => {
    let all = [];
    try {
      const raw = localStorage.getItem("tasful_talk_notifications");
      all = raw ? JSON.parse(raw) : [];
    } catch {
      all = window.TasuTalkNotifications?.getAll?.() || [];
    }
    if (!Array.isArray(all)) all = [];
    const poster = all.filter(
      (n) => String(n.recipientUserId) === "u_job_demo_full" && String(n.title || "").includes(doneTitle)
    );
    const applicant = all.filter(
      (n) => String(n.recipientUserId) === "u_hiro" && String(n.title || "").includes(doneTitle)
    );
    return {
      posterCount: poster.length,
      applicantCount: applicant.length,
      posterCta: poster[0]?.actionLabel || "",
      applicantCta: applicant[0]?.actionLabel || "",
      posterHref: poster[0]?.href || poster[0]?.targetUrl || "",
      applicantHref: applicant[0]?.href || applicant[0]?.targetUrl || "",
    };
  }, { doneTitle: TRADE_DONE_TITLE });

  report.checks.notifyDomAfterDone = await page.evaluate((doneTitle) => {
    const read = (frameId) => {
      const el = document.getElementById(frameId);
      const w = el?.contentWindow;
      const titles = [
        ...(w?.document?.querySelectorAll(
          ".talk-notify-card__title, .talk-notify-card__title--job-event"
        ) || []),
      ].map((node) => node.textContent?.trim() || "");
      return {
        frameSrc: el?.src || "",
        titles,
        hasDone: titles.some((t) => t.includes(doneTitle)),
      };
    };
    return { a: read("frame-a-notify"), b: read("frame-b-notify") };
  }, TRADE_DONE_TITLE);
  report.checks.aNotifyDomAfterDone = report.checks.notifyDomAfterDone?.a || {
    titles: [],
    hasDone: false,
  };
  report.checks.bNotifyDomAfterDone = report.checks.notifyDomAfterDone?.b || {
    titles: [],
    hasDone: false,
  };

  const issues = [];
  if (!report.checks.afterPay?.threadId) issues.push("1: job_hire threadId missing");
  if (!report.checks.afterPay?.aOnChat) issues.push("2: A not on chat-detail");
  if (report.checks.afterPay?.bOnBuyerWait) issues.push("3: B stuck on buyer-wait");
  if (!report.checks.afterPay?.bOnChat) issues.push("4: B not on chat-detail");
  if (!report.checks.afterPay?.bNotifyCount) issues.push("5: B hired notify missing in store");
  if (!String(report.checks.afterPay?.bNotifyTitle || "").includes("応募が承諾")) {
    issues.push(`5b: hired title wrong: ${report.checks.afterPay?.bNotifyTitle}`);
  }
  if (String(report.checks.afterPay?.bNotifyCta || "") !== "やり取りチャットを開く") {
    issues.push(`5c: hired CTA wrong: ${report.checks.afterPay?.bNotifyCta}`);
  }
  if (report.checks.bNotifyDomAfterPay && !report.checks.bNotifyDomAfterPay.hasHired) {
    issues.push("5d: B notify DOM missing hired card");
  }
  if (!report.checks.completeRequestAction?.ok) {
    issues.push(`5e: completion request action failed (${report.checks.completeRequestAction?.reason || "unknown"})`);
  }
  if (!report.checks.afterCompleteRequest?.bRequestNotifyCount) {
    issues.push("6: B completion-request notify missing");
  }
  if (!String(report.checks.afterCompleteRequest?.bRequestTitle || "").includes("取引完了の確認依頼")) {
    issues.push(`6b: completion-request title wrong: ${report.checks.afterCompleteRequest?.bRequestTitle}`);
  }
  if (String(report.checks.afterCompleteRequest?.bRequestCta || "") !== "取引内容を確認する") {
    issues.push(`6c: completion-request CTA wrong: ${report.checks.afterCompleteRequest?.bRequestCta}`);
  }
  if (report.checks.bNotifyDomAfterRequest && !report.checks.bNotifyDomAfterRequest.hasRequest) {
    issues.push("6d: B notify DOM missing completion-request card");
  }
  if (!report.checks.approveAction?.ok) {
    issues.push(`6e: approve action failed (${report.checks.approveAction?.reason || "unknown"})`);
  }
  if (!report.checks.afterApprove?.threadCompleted) issues.push("7a: thread not completed after approve");
  if (!report.checks.afterTradeDone?.posterCount) issues.push("8: poster trade-done notify missing");
  if (!report.checks.afterTradeDone?.applicantCount) issues.push("9: applicant trade-done notify missing");
  if (String(report.checks.afterTradeDone?.posterCta || "") !== "レビューをする") {
    issues.push(`8b: poster review CTA wrong: ${report.checks.afterTradeDone?.posterCta}`);
  }
  if (String(report.checks.afterTradeDone?.applicantCta || "") !== "レビューをする") {
    issues.push(`9b: applicant review CTA wrong: ${report.checks.afterTradeDone?.applicantCta}`);
  }
  if (!String(report.checks.afterTradeDone?.posterHref || "").includes("job-review.html")) {
    issues.push(`8c: poster href not job-review: ${report.checks.afterTradeDone?.posterHref}`);
  }
  if (!String(report.checks.afterTradeDone?.applicantHref || "").includes("job-review.html")) {
    issues.push(`9c: applicant href not job-review: ${report.checks.afterTradeDone?.applicantHref}`);
  }
  if (report.checks.aNotifyDomAfterDone && !report.checks.aNotifyDomAfterDone.hasDone) {
    issues.push("10: A notify DOM missing trade-done card");
  }
  if (report.checks.bNotifyDomAfterDone && !report.checks.bNotifyDomAfterDone.hasDone) {
    issues.push("11: B notify DOM missing trade-done card");
  }

  report.issues = issues;
  report.ok = issues.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
} finally {
  await browser.close();
}
