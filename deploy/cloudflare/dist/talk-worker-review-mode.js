/**
 * ワーカーカテゴリ UI レビュー — review=worker 専用表示モード
 *
 * URL: talk-home.html?review=worker&tab=notify|chat&talkDev=1
 * 通知タブ / TASFUL TALK 公式ルームにワーカーデモ通知3件のみ表示
 */
(function (global) {
  "use strict";

  const REVIEW_PARAM = "worker";
  const REQUEST_NOTIFY_ID = "platform-verify-worker-request-001";
  const ACCEPT_NOTIFY_ID = "platform-verify-worker-accept-001";
  const COMPLETE_NOTIFY_ID = "platform-verify-worker-connect-complete-001";
  const OFFICIAL_PLATFORM = "official_platform";

  const WORKER_REVIEW_NOTIFY_IDS = Object.freeze([
    REQUEST_NOTIFY_ID,
    ACCEPT_NOTIFY_ID,
    COMPLETE_NOTIFY_ID,
  ]);
  const WORKER_REVIEW_ID_SET = new Set(WORKER_REVIEW_NOTIFY_IDS);

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isWorkerReviewMode() {
    try {
      return new URLSearchParams(global.location?.search || "").get("review") === REVIEW_PARAM;
    } catch {
      return false;
    }
  }

  function resolveNotificationId(row) {
    if (!row || typeof row !== "object") return "";
    return pickStr(row.id, row.notifyCard?.notificationId);
  }

  function isWorkerReviewNotification(row) {
    return WORKER_REVIEW_ID_SET.has(resolveNotificationId(row));
  }

  function filterWorkerReviewNotifications(list) {
    if (!isWorkerReviewMode()) return list;
    return (list || []).filter((n) => isWorkerReviewNotification(n));
  }

  function filterWorkerReviewTalkMessages(roomId, messages) {
    if (!isWorkerReviewMode()) return messages;
    if (String(roomId || "") !== OFFICIAL_PLATFORM) return [];
    return (messages || []).filter((m) => {
      const nid = pickStr(m?.notifyCard?.notificationId, String(m?.id || "").replace(/^official-notify-/, ""));
      return WORKER_REVIEW_ID_SET.has(nid);
    });
  }

  function filterWorkerReviewChatThreads(threads) {
    if (!isWorkerReviewMode()) return threads;
    return (threads || []).filter((t) => String(t?.id || "") === OFFICIAL_PLATFORM);
  }

  function getWorkerReviewMasterRows() {
    const master = global.TasuTalkPlatformNotifyMaster?.buildMaster?.(Date.now()) || [];
    return master.filter((n) => WORKER_REVIEW_ID_SET.has(String(n?.id || "")));
  }

  function ensureWorkerReviewTalkMessages() {
    if (!isWorkerReviewMode()) return;
    const rows = getWorkerReviewMasterRows();
    rows.forEach((n) => global.TasuTalkOfficialRooms?.syncNotification?.(n));
    global.TasuTalkOfficialRooms?.upsertOfficialThread?.(OFFICIAL_PLATFORM);
  }

  function applyDocumentChrome() {
    if (!isWorkerReviewMode()) return;
    const body = global.document?.body;
    if (!body) return;
    body.classList.add("talk-worker-review-mode");
    body.dataset.talkWorkerReview = "1";

    const sub = global.document.querySelector(".talk-notify-toolbar__sub");
    if (sub) {
      sub.textContent = "ワーカーカテゴリの通知UIレビュー（3件のみ）";
    }

    const lead = global.document.querySelector("[data-talk-simple-lead]");
    if (lead) lead.hidden = true;
  }

  function initWorkerReviewMode() {
    if (!isWorkerReviewMode()) return;
    applyDocumentChrome();
    ensureWorkerReviewTalkMessages();
  }

  global.TasuTalkWorkerReviewMode = {
    REVIEW_PARAM,
    REQUEST_NOTIFY_ID,
    ACCEPT_NOTIFY_ID,
    COMPLETE_NOTIFY_ID,
    WORKER_REVIEW_NOTIFY_IDS,
    OFFICIAL_PLATFORM,
    isWorkerReviewMode,
    isWorkerReviewNotification,
    filterWorkerReviewNotifications,
    filterWorkerReviewTalkMessages,
    filterWorkerReviewChatThreads,
    getWorkerReviewMasterRows,
    ensureWorkerReviewTalkMessages,
    applyDocumentChrome,
    initWorkerReviewMode,
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", initWorkerReviewMode);
  } else {
    initWorkerReviewMode();
  }
})(typeof window !== "undefined" ? window : globalThis);
