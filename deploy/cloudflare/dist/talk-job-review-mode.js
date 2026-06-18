/**
 * 求人カテゴリ UI レビュー — review=job 専用表示モード（統一フロー2件）
 *
 * URL: talk-home.html?review=job&tab=notify|chat&talkDev=1
 * 旧 platform-verify-job-* は v3.7 で廃止。job-full 統一シードの応募・開始のみ表示。
 */
(function (global) {
  "use strict";

  const REVIEW_PARAM = "job";
  const APPLY_NOTIFY_ID = "platform-verify-job-full-apply-001";
  const HIRED_NOTIFY_ID = "platform-verify-job-full-applicant-start-001";
  const OFFICIAL_PLATFORM = "official_platform";

  const JOB_REVIEW_NOTIFY_IDS = Object.freeze([APPLY_NOTIFY_ID, HIRED_NOTIFY_ID]);
  const JOB_REVIEW_ID_SET = new Set(JOB_REVIEW_NOTIFY_IDS);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isJobReviewMode() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("review") === "job-full") return false;
      return params.get("review") === REVIEW_PARAM;
    } catch {
      return false;
    }
  }

  function resolveNotificationId(row) {
    if (!row || typeof row !== "object") return "";
    return pickStr(row.id, row.notifyCard?.notificationId);
  }

  function isJobReviewNotification(row) {
    return JOB_REVIEW_ID_SET.has(resolveNotificationId(row));
  }

  function filterJobReviewNotifications(list) {
    if (!isJobReviewMode()) return list;
    return (list || []).filter((n) => isJobReviewNotification(n));
  }

  function filterJobReviewTalkMessages(roomId, messages) {
    if (!isJobReviewMode()) return messages;
    if (String(roomId || "") !== OFFICIAL_PLATFORM) return [];
    return (messages || []).filter((m) => {
      const nid = pickStr(m?.notifyCard?.notificationId, String(m?.id || "").replace(/^official-notify-/, ""));
      return JOB_REVIEW_ID_SET.has(nid);
    });
  }

  function filterJobReviewChatThreads(threads) {
    if (!isJobReviewMode()) return threads;
    return (threads || []).filter((t) => String(t?.id || "") === OFFICIAL_PLATFORM);
  }

  function getJobReviewMasterRows() {
    const master = global.TasuTalkPlatformNotifyMaster?.buildMaster?.(Date.now()) || [];
    return master.filter((n) => JOB_REVIEW_ID_SET.has(String(n?.id || "")));
  }

  function ensureJobReviewTalkMessages() {
    if (!isJobReviewMode()) return;
    const rows = getJobReviewMasterRows();
    rows.forEach((n) => global.TasuTalkOfficialRooms?.syncNotification?.(n));
    global.TasuTalkOfficialRooms?.upsertOfficialThread?.(OFFICIAL_PLATFORM);
  }

  function applyDocumentChrome() {
    if (!isJobReviewMode()) return;
    const body = global.document?.body;
    if (!body) return;
    body.classList.add("talk-job-review-mode");
    body.dataset.talkJobReview = "1";

    const sub = global.document.querySelector(".talk-notify-toolbar__sub");
    if (sub) sub.textContent = "求人カテゴリの通知UIレビュー（2件のみ）";

    const lead = global.document.querySelector("[data-talk-simple-lead]");
    if (lead) lead.hidden = true;
  }

  function initJobReviewMode() {
    if (!isJobReviewMode()) return;
    applyDocumentChrome();
    ensureJobReviewTalkMessages();
  }

  global.TasuTalkJobReviewMode = {
    REVIEW_PARAM,
    APPLY_NOTIFY_ID,
    HIRED_NOTIFY_ID,
    JOB_REVIEW_NOTIFY_IDS,
    OFFICIAL_PLATFORM,
    isJobReviewMode,
    isJobReviewNotification,
    filterJobReviewNotifications,
    filterJobReviewTalkMessages,
    filterJobReviewChatThreads,
    getJobReviewMasterRows,
    ensureJobReviewTalkMessages,
    applyDocumentChrome,
    initJobReviewMode,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", initJobReviewMode);
  } else {
    initJobReviewMode();
  }
})(typeof window !== "undefined" ? window : globalThis);
