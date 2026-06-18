/**
 * 求人やりとり完了 — 通知着地ページ
 */
(function () {
  "use strict";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function getThreadId() {
    try {
      return new URLSearchParams(window.location.search).get("thread") || "";
    } catch {
      return "";
    }
  }

  function isJobFullReview() {
    try {
      return new URLSearchParams(window.location.search).get("review") === "job-full";
    } catch {
      return false;
    }
  }

  function init() {
    const threadId = getThreadId();
    const Flow = window.TasuPlatformChatJobFlow;
    if (!threadId || !Flow) return;

    Flow.ensureJobThreadForAccess?.(threadId);
    if (Flow.isJobFullReviewFromUrl?.() || isJobFullReview()) {
      window.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo?.();
      Flow.appendJobCompletionCard?.(threadId, Flow.resolveJobCompletionSummary?.(threadId)?.thread);
    }

    const summary = Flow.resolveJobCompletionSummary?.(threadId) || {};
    const reviewOpts = isJobFullReview() ? { review: "job-full" } : {};
    const meId =
      window.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      pickStr(new URLSearchParams(window.location.search).get("userId"));

    const jobEl = document.querySelector("[data-job-completion-job]");
    const partnerEl = document.querySelector("[data-job-completion-partner]");
    const atEl = document.querySelector("[data-job-completion-at]");
    const titleEl = document.querySelector("[data-job-completion-title]");
    if (jobEl) jobEl.textContent = pickStr(summary.jobTitle, "求人");
    if (partnerEl) partnerEl.textContent = pickStr(summary.partnerName, "相手");
    if (atEl) atEl.textContent = pickStr(summary.completedAtLabel, "—");
    if (titleEl) titleEl.textContent = pickStr(summary.jobTitle, "求人やりとり");

    const reviewBtn = document.getElementById("jobCompletionReviewBtn");
    const chatBtn = document.getElementById("jobCompletionChatBtn");
    const notifyBtn = document.getElementById("jobCompletionNotifyBtn");
    const applicationsBtn = document.getElementById("jobCompletionApplicationsBtn");
    const back = document.getElementById("jobCompletionBack");

    const reviewUrl = Flow.buildJobReviewUrl?.(threadId, { userId: meId, from: "completion", ...reviewOpts });
    const chatUrl = Flow.buildJobChatUrl?.(threadId, { userId: meId, from: "completion", ...reviewOpts });
    const notifyUrl = Flow.buildJobNotifyUrl?.({ userId: meId, from: "completion", ...reviewOpts });
    const listingId = pickStr(summary.thread?.listingId, Flow.LISTING_ID);
    const posterId = pickStr(
      window.TasuTalkPlatformNotify?.resolveJobPosterUserId?.(listingId),
      Flow.POSTER_ID
    );
    const applicationsUrl = Flow.buildJobApplicationsUrl?.(listingId, {
      userId: posterId,
      from: "completion",
      ...reviewOpts,
    });

    if (reviewBtn && reviewUrl) reviewBtn.href = reviewUrl;
    if (chatBtn && chatUrl) chatBtn.href = chatUrl;
    if (notifyBtn && notifyUrl) notifyBtn.href = notifyUrl;
    if (back && notifyUrl) back.href = notifyUrl;
    if (applicationsBtn && applicationsUrl) {
      applicationsBtn.href = applicationsUrl;
      applicationsBtn.hidden = !(meId && meId === posterId);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
