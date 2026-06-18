#!/usr/bin/env node
/**
 * 一般案件 General Flow 最終検証 — partner_user / user_user / vendor_user
 * A（掲載者）↔ B（応募者）基準・poster/applicant ID 判定
 */
import { withPlaywrightBrowser, closeAllBrowsers } from "./lib/playwright-browser.mjs";
import { requireDevServer } from "./lib/dev-base-url.mjs";

const BASE = await requireDevServer();
const FLOWS = ["partner_user", "user_user", "vendor_user"];
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function prefix(flow, step, label) {
  return `${flow} [${step}] ${label}`;
}

async function waitMs(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

await withPlaywrightBrowser(async (browser) => {const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(120000);

for (const flow of FLOWS) {
  const url = `${BASE}/chat-dual-window-demo.html?benchMode=builder&builderFlow=${flow}&benchViewport=390`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#builderBenchGeneralRow", { timeout: 60000 });
  await waitMs(1200);

  const setup = await page.evaluate(async (flowId) => {
    const bench = window.TasuBuilderGeneralFlowBench;
    const dual = window.TasuBuilderDualWindowBench;
    const GF = window.TasuBuilderGeneralFlow;
    if (!bench || !dual || !GF) return { ok: false, error: "missing_modules" };
    await bench.genReset();
    await new Promise((r) => setTimeout(r, 1000));
    const f = dual.flow();
    const spec = await bench.callBridge("getBenchGeneralFlowSpec", f.id);
    const posterId = String(spec?.poster?.id || "");
    const applicantId = String(spec?.applicant?.id || "");
    const bothUserRole = spec?.poster?.role === "user" && spec?.applicant?.role === "user";
    return {
      ok: true,
      flowId: f.id,
      posterId,
      applicantId,
      posterRole: spec?.poster?.role,
      applicantRole: spec?.applicant?.role,
      bothUserRole,
      publicDetail: GF.resolvePublicDetailParams?.(flowId),
    };
  }, flow);

  record(prefix(flow, "0", "bench modules"), setup.ok === true, setup.error || "");
  if (!setup.ok) continue;

  record(
    prefix(flow, "0", "poster/applicant IDs differ"),
    setup.posterId && setup.applicantId && setup.posterId !== setup.applicantId,
    `${setup.posterId} / ${setup.applicantId}`
  );
  if (flow === "user_user") {
    record(prefix(flow, "0", "both role=user"), setup.bothUserRole === true);
  }

  const phaseApply = await page.evaluate(async () => {
    const bench = window.TasuBuilderGeneralFlowBench;
    const apply = await bench.genApply();
    await new Promise((r) => setTimeout(r, 500));
    const mvp = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
    const pid = bench.genState.projectId;
    const spec = await bench.callBridge("getBenchGeneralFlowSpec", window.TasuBuilderDualWindowBench.flow().id);
    const matchPid = (n) => (n.project_id || n.projectId) === pid;
    const appPoster = notifs.find((n) => n.type === "application" && matchPid(n));
    const appApplicant = notifs.find((n) => n.type === "application_submitted" && matchPid(n));
    const apps = (mvp.applications || []).filter((a) => a.project_id === pid);
    return {
      applyOk: apply?.ok === true,
      appPoster,
      appApplicant,
      appsCount: apps.length,
      posterSlot: appPoster?.recipientSlot,
      posterUid: appPoster?.recipientUserId,
      applicantSlot: appApplicant?.recipientSlot,
      applicantUid: appApplicant?.recipientUserId,
      expectedPosterId: spec?.poster?.id,
      expectedApplicantId: spec?.applicant?.id,
      threadBeforeDecline: bench.genState.threadId,
    };
  });

  record(prefix(flow, "1-3", "B applies"), phaseApply.applyOk === true);
  record(prefix(flow, "3", "A application notify"), Boolean(phaseApply.appPoster));
  record(
    prefix(flow, "3", "A notify recipientSlot=poster"),
    phaseApply.posterSlot === "poster",
    phaseApply.posterSlot
  );
  record(
    prefix(flow, "3", "A notify recipientUserId=poster.id"),
    phaseApply.posterUid === phaseApply.expectedPosterId,
    `${phaseApply.posterUid} vs ${phaseApply.expectedPosterId}`
  );
  record(
    prefix(flow, "3", "B application_submitted notify"),
    Boolean(phaseApply.appApplicant)
  );
  record(
    prefix(flow, "3", "B notify recipientSlot=applicant"),
    phaseApply.applicantSlot === "applicant",
    phaseApply.applicantSlot
  );
  record(
    prefix(flow, "3", "B notify recipientUserId=applicant.id"),
    phaseApply.applicantUid === phaseApply.expectedApplicantId,
    `${phaseApply.applicantUid} vs ${phaseApply.expectedApplicantId}`
  );
  record(prefix(flow, "2", "no thread before chat"), !phaseApply.threadBeforeDecline);

  const phaseDecline = await page.evaluate(async () => {
    const bench = window.TasuBuilderGeneralFlowBench;
    const dual = window.TasuBuilderDualWindowBench;
    const GF = window.TasuBuilderGeneralFlow;
    const decline = await bench.genDeclineApplicant();
    await new Promise((r) => setTimeout(r, 500));
    const notifs = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
    const pid = bench.genState.projectId;
    const matchPid = (n) => (n.project_id || n.projectId) === pid;
    const rejected = notifs.find((n) => n.type === "rejected" && matchPid(n));
    const pd = GF.resolvePublicDetailParams?.(dual.flow().id);
    let navHref = "";
    if (rejected?.href) {
      dual.handleNotificationNavigate({
        href: rejected.href,
        notificationId: rejected.id,
        side: "B",
        notificationType: "rejected",
      });
      await new Promise((r) => setTimeout(r, 900));
      const bFrame = document.getElementById("frame-b-project");
      navHref =
        bFrame?.dataset?.currentSrc || bFrame?.getAttribute("src") || bFrame?.contentWindow?.location?.href || "";
    }
    return {
      declineOk: decline?.ok === true,
      rejected,
      rejectSlot: rejected?.recipientSlot,
      rejectUid: rejected?.recipientUserId,
      rejectHref: rejected?.href || "",
      publicPage: pd?.page || "public-board-detail.html",
      publicId: pd?.id,
      navHref,
      navPublic: navHref.includes("public-board-detail.html"),
      navNoApplications: !navHref.includes("view=applications"),
    };
  });

  record(prefix(flow, "4", "A declines applicant"), phaseDecline.declineOk === true);
  record(prefix(flow, "5", "B rejected notification"), Boolean(phaseDecline.rejected));
  record(
    prefix(flow, "5", "reject title"),
    /見送り/.test(phaseDecline.rejected?.title || ""),
    phaseDecline.rejected?.title
  );
  record(
    prefix(flow, "5", "reject recipientSlot=applicant"),
    phaseDecline.rejectSlot === "applicant",
    phaseDecline.rejectSlot
  );
  record(
    prefix(flow, "5", "reject recipientUserId=applicant.id"),
    phaseDecline.rejectUid === setup.applicantId,
    phaseDecline.rejectUid
  );
  record(
    prefix(flow, "6", "reject href public-board-detail"),
    phaseDecline.rejectHref.includes("public-board-detail.html"),
    phaseDecline.rejectHref
  );
  record(
    prefix(flow, "6", "reject href has public id"),
    phaseDecline.rejectHref.includes(setup.publicDetail?.id || "pub-board"),
    setup.publicDetail?.id
  );
  record(prefix(flow, "6", "B notify nav to public detail"), phaseDecline.navPublic === true, phaseDecline.navHref);
  record(prefix(flow, "6", "reject nav no view=applications"), phaseDecline.navNoApplications === true);

  const phaseApplicantBlock = await page.evaluate(async (flowId) => {
    const bench = window.TasuBuilderGeneralFlowBench;
    const dual = window.TasuBuilderDualWindowBench;
    const pid = bench.genState.projectId;
    const spec = await bench.callBridge("getBenchGeneralFlowSpec", flowId);
    const applicantSide = dual.generalApplicantSideKey?.() || "B";
    const frameKey = applicantSide.toLowerCase();
    const blockedHref = `mvp-project-detail.html?id=${encodeURIComponent(pid)}&view=applications&role=${encodeURIComponent(spec.applicant.role)}&partnerId=${encodeURIComponent(spec.applicant.id)}&benchEmbed=1&benchSide=${applicantSide}`;
    dual.handleNotificationNavigate({
      href: blockedHref,
      side: applicantSide,
      notificationType: "application",
    });
    await new Promise((r) => setTimeout(r, 1500));
    const frame = document.getElementById(`frame-${frameKey}-project`);
    const frameHref = frame?.dataset?.currentSrc || frame?.getAttribute("src") || "";
    const liveHref = frame?.contentWindow?.location?.href || "";
    const href = liveHref || frameHref;
    const doc = frame?.contentDocument;
    const posterManageVisible = Boolean(
      doc?.querySelector("[data-builder-mvp-pd-decline-applicant]:not([hidden])") ||
        doc?.querySelector("[data-builder-mvp-pd-start-chat]:not([hidden])")
    );
    return {
      href,
      applicantSide,
      blockedFromApplications:
        !href.includes("view=applications") && !frameHref.includes("view=applications"),
      noPosterManageUi: !posterManageVisible,
      onPublic:
        href.includes("public-board-detail.html") || liveHref.includes("public-board-detail.html"),
    };
  }, flow);

  record(
    prefix(flow, "guard", "applicant blocked from view=applications"),
    phaseApplicantBlock.blockedFromApplications === true,
    phaseApplicantBlock.href || ""
  );
  record(
    prefix(flow, "guard", "applicant no poster manage UI"),
    phaseApplicantBlock.noPosterManageUi === true,
    `side=${phaseApplicantBlock.applicantSide}`
  );

  const phaseCycle = await page.evaluate(async () => {
    const bench = window.TasuBuilderGeneralFlowBench;
    const dual = window.TasuBuilderDualWindowBench;
    const GF = window.TasuBuilderGeneralFlow;
    const f = dual.flow();
    const spec = await bench.callBridge("getBenchGeneralFlowSpec", f.id);

    const apply2 = await bench.genApply();
    const start = await bench.genStartChat();
    await bench.genSendMessage("A", false);
    await bench.genSendMessage("B", true);

    const submit = await bench.genSubmitCompletion();
    await new Promise((r) => setTimeout(r, 400));
    const mvpAfterSubmit = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const tid = bench.genState.threadId;
    const threadAfterSubmit = mvpAfterSubmit.threads?.[tid];
    const notifsSubmit = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
    const compSubmitted = notifsSubmit.find((n) => n.type === "completion_submitted" && n.threadId === tid);

    const posterSide = f.generalPosterSide === "B" ? "B" : "A";
    const posterFrame = `frame-${posterSide.toLowerCase()}-thread`;
    await bench.callBridge("setContext", { role: spec.poster.role, partnerId: spec.poster.id });
    dual.refreshThreadFrames?.(posterSide);
    await new Promise((r) => setTimeout(r, 1500));
    const posterDoc = document.getElementById(posterFrame)?.contentDocument;
    const chatCard = Boolean(posterDoc?.querySelector("[data-thread-completion-approve]:not([hidden])"));

    const approve = await bench.genApproveCompletion();
    await new Promise((r) => setTimeout(r, 500));
    const mvpAfterApprove = JSON.parse(localStorage.getItem("tasful:builder:mvp:v1") || "{}");
    const threadAfterApprove = mvpAfterApprove.threads?.[tid];
    const notifsApprove = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
    const reviewReqs = notifsApprove.filter((n) => n.type === "review_request" && n.threadId === tid);

    dual.refreshThreadFrames?.("A");
    dual.refreshThreadFrames?.("B");
    await new Promise((r) => setTimeout(r, 600));
    const lockA = document.getElementById("frame-a-thread")?.contentDocument;
    const lockB = document.getElementById("frame-b-thread")?.contentDocument;
    const isChatLocked = (doc) => {
      if (!doc) return false;
      const bodyLocked = doc.body?.classList?.contains("mvp-thread--chat-locked");
      const input = doc.querySelector("[data-builder-mvp-thread-input], .mvp-slack-compose__input");
      const sendBtn = doc.querySelector("[data-builder-mvp-thread-send]");
      return Boolean(bodyLocked && input?.disabled && sendBtn?.disabled);
    };
    const composeLockedA = isChatLocked(lockA);
    const composeLockedB = isChatLocked(lockB);
    const isVisible = (doc, sel) => {
      const el = doc?.querySelector(sel);
      if (!el || el.hidden) return false;
      const style = doc.defaultView?.getComputedStyle(el);
      return style?.display !== "none" && style?.visibility !== "hidden";
    };
    const reviewBtnA = isVisible(lockA, "[data-builder-mvp-thread-review-open], [data-mvp-thread-review-open]");
    const reviewBtnB = isVisible(lockB, "[data-builder-mvp-thread-review-open], [data-mvp-thread-review-open]");

    await bench.callBridge("setContext", { role: spec.poster.role, partnerId: spec.poster.id });
    const reviewPoster = await bench.callBridge("submitGeneralFlowReview", tid, {
      rating: 5,
      comment: "poster review",
    });
    await bench.callBridge("setContext", { role: spec.applicant.role, partnerId: spec.applicant.id });
    const reviewApplicant = await bench.callBridge("submitGeneralFlowReview", tid, {
      rating: 4,
      comment: "applicant review",
    });
    await new Promise((r) => setTimeout(r, 400));
    const notifsReview = JSON.parse(localStorage.getItem("tasful:builder:mvp:notifications:v1") || "[]");
    const reviewReceived = notifsReview.filter((n) => n.type === "review_received" && n.threadId === tid);

    const submitterId = String(threadAfterSubmit?.completion_submission?.submitted_by?.id || "");
    const posterCanReview = GF.isGeneralFlowPoster?.(
      { id: spec.poster.id },
      spec
    );
    const applicantCanReview = GF.isGeneralFlowApplicant?.(
      { id: spec.applicant.id },
      spec
    );

    return {
      apply2Ok: apply2?.ok === true,
      startOk: start?.ok === true,
      threadId: tid,
      submitOk: submit?.ok === true,
      submitterId,
      expectedApplicantId: spec.applicant.id,
      expectedPosterId: spec.poster.id,
      compSubmitted,
      compSlot: compSubmitted?.recipientSlot,
      compUid: compSubmitted?.recipientUserId,
      chatCard,
      approveOk: approve?.ok === true,
      threadStatus: threadAfterApprove?.status,
      subApproved: threadAfterApprove?.completion_submission?.status,
      reviewReqCount: reviewReqs.length,
      reviewReqUids: reviewReqs.map((n) => n.recipientUserId).sort().join(","),
      reviewReceivedCount: reviewReceived.length,
      composeLockedA,
      composeLockedB,
      reviewBtnA,
      reviewBtnB,
      reviewPosterOk: reviewPoster?.ok === true,
      reviewApplicantOk: reviewApplicant?.ok === true,
      posterCanReview,
      applicantCanReview,
    };
  });

  record(prefix(flow, "7", "B re-applies"), phaseCycle.apply2Ok === true);
  record(prefix(flow, "8", "A starts chat"), phaseCycle.startOk === true);
  record(prefix(flow, "9-10", "thread created"), Boolean(phaseCycle.threadId));
  record(prefix(flow, "11", "completion submit"), phaseCycle.submitOk === true);
  record(
    prefix(flow, "12", "completion by applicant.id"),
    phaseCycle.submitterId === phaseCycle.expectedApplicantId,
    `${phaseCycle.submitterId} vs ${phaseCycle.expectedApplicantId}`
  );
  record(prefix(flow, "13", "completion_submitted notify"), Boolean(phaseCycle.compSubmitted));
  record(
    prefix(flow, "13", "completion notify to poster"),
    phaseCycle.compUid === phaseCycle.expectedPosterId || phaseCycle.compSlot === "poster",
    `${phaseCycle.compUid} slot=${phaseCycle.compSlot}`
  );
  record(prefix(flow, "14", "A chat completion card"), phaseCycle.chatCard === true);
  record(prefix(flow, "15", "A approves"), phaseCycle.approveOk === true);
  record(prefix(flow, "16", "chat locked A compose hidden"), phaseCycle.composeLockedA === true);
  record(prefix(flow, "16", "chat locked B compose hidden"), phaseCycle.composeLockedB === true);
  record(prefix(flow, "16", "review UI still available A"), phaseCycle.reviewBtnA === true);
  record(prefix(flow, "16", "review UI still available B"), phaseCycle.reviewBtnB === true);
  record(prefix(flow, "17", "review_request x2"), phaseCycle.reviewReqCount >= 2, String(phaseCycle.reviewReqCount));
  record(
    prefix(flow, "17", "review_request both userIds"),
    phaseCycle.reviewReqUids.includes(setup.posterId) && phaseCycle.reviewReqUids.includes(setup.applicantId),
    phaseCycle.reviewReqUids
  );
  record(prefix(flow, "18", "poster review submit"), phaseCycle.reviewPosterOk === true);
  record(prefix(flow, "18", "applicant review submit"), phaseCycle.reviewApplicantOk === true);
  record(prefix(flow, "19", "review_received x2"), phaseCycle.reviewReceivedCount >= 2, String(phaseCycle.reviewReceivedCount));
  record(prefix(flow, "0", "GF poster ID check"), phaseCycle.posterCanReview === true);
  record(prefix(flow, "0", "GF applicant ID check"), phaseCycle.applicantCanReview === true);
}

});

const failed = results.filter((r) => !r.ok);
console.log(`\n=== 一般案件 Unified ===`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("\n=== NG一覧 ===");
  failed.forEach((f) => console.error(`- ${f.name}${f.detail ? `: ${f.detail}` : ""}`));
  await closeAllBrowsers();
  process.exit(1);
}
console.log("All unified general flow checks passed");
