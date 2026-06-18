/**
 * TASFUL TALK — chat-detail 通話連携（Phase2）
 * talk-home 以外の 1:1 取引チャットから Phase1 通話を起動する。
 */
(function (global) {
  "use strict";

  /** @type {object|null} */
  let activeThread = null;
  /** @type {boolean} */
  let wired = false;

  function isPageActive() {
    return (
      document.body?.dataset?.page === "chat" ||
      /chat-detail\.html/i.test(String(global.location?.pathname || ""))
    );
  }

  function getMeId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      ""
    );
  }

  function getActiveRoomId() {
    return String(activeThread?.id || "").trim();
  }

  function getActiveThread() {
    return activeThread;
  }

  function buildCallThread(thread) {
    if (!thread || typeof thread !== "object") return null;
    const row = global.TasuTalkChatThreadModel?.enrichThread?.(thread) || thread;
    const meId = getMeId();
    let partnerUserId =
      global.TasuTalkChatThreadModel?.resolvePartnerUserId?.(row) ||
      String(row?.partnerUserId || row?.partner_user_id || row?.partner?.id || "").trim();

    if (!partnerUserId || partnerUserId === meId) {
      const buyer = String(row?.buyerId || row?.buyer_id || "").trim();
      const seller = String(row?.sellerId || row?.seller_id || "").trim();
      if (buyer && seller) {
        if (meId === buyer) partnerUserId = seller;
        else if (meId === seller) partnerUserId = buyer;
      }
    }

    const roomId = String(row?.id || "").trim();
    if (!roomId) return null;

    return {
      ...row,
      id: roomId,
      partnerUserId,
      partner: {
        ...(row?.partner || {}),
        id: partnerUserId || row?.partner?.id,
        displayName:
          row?.partnerProfile?.display_name ||
          row?.partner?.displayName ||
          row?.partner?.name ||
          "相手",
      },
      partnerProfile: row?.partnerProfile,
    };
  }

  function syncCallButton(thread) {
    activeThread = thread && typeof thread === "object" ? thread : null;
    const buttons = document.querySelectorAll("[data-talk-call-start-button]");
    if (!buttons.length) return;

    const callThread = buildCallThread(activeThread);
    const svc = global.TasuTalkCallService;
    const eligible = Boolean(callThread && svc?.canCallThread?.(callThread));

    buttons.forEach((btn) => {
      if (!getMeId()) {
        btn.hidden = true;
        btn.disabled = true;
        btn.classList.remove("talk-call-btn--enabled");
        btn.title = "通話（ログインが必要です）";
        return;
      }
      btn.hidden = !eligible;
      btn.disabled = !eligible;
      btn.classList.toggle("talk-call-btn--enabled", eligible);
      if (!svc?.isAvailable?.()) {
        btn.title = "通話（Supabase 未接続）";
      } else if (eligible) {
        btn.title = "音声通話";
      } else {
        btn.title = "通話（このルームでは利用できません）";
      }
    });

    if (eligible) {
      svc?.init?.();
      svc?.refreshIncomingForActiveRoom?.().catch?.(() => {});
    }
  }

  function wireCallButtons() {
    if (wired) return;
    wired = true;
    document.addEventListener("click", (event) => {
      const btn =
        event.target instanceof Element ? event.target.closest("[data-talk-call-start-button]") : null;
      if (!btn || btn.disabled || btn.hidden) return;
      event.preventDefault();
      const callThread = buildCallThread(activeThread);
      if (!callThread) {
        global.TasuTalkCallUi?.showToast?.("通話できないルームです");
        return;
      }
      global.TasuTalkCallService?.init?.();
      global.TasuTalkCallService?.initiateCall?.(callThread)?.catch((err) => {
        global.TasuTalkCallUi?.showToast?.(err?.message || "発信に失敗しました");
      });
    });
  }

  function syncFromThread(thread) {
    wireCallButtons();
    syncCallButton(thread);
    tryIncomingFromQuery();
  }

  function tryIncomingFromQuery() {
    const params = new URLSearchParams(global.location?.search || "");
    const callId = pickStr(params.get("callId"), params.get("call_id"));
    if (!callId) return;
    const roomId = pickStr(params.get("thread"), params.get("roomId"), activeThread?.id);
    const activeRoom = getActiveRoomId();
    if (roomId && activeRoom && roomId !== activeRoom) return;
    global.TasuTalkCallService?.init?.();
    global.TasuTalkCallService?.prepareIncomingForCallId?.(callId)?.catch?.(() => {});
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function init() {
    wireCallButtons();
    if (isPageActive()) {
      global.TasuTalkCallService?.init?.();
      global.TasuTalkPushSubscribe?.trySyncSubscription?.().catch(() => {});
    }
  }

  global.TasuTalkCallChatDetail = {
    isPageActive,
    getActiveRoomId,
    getActiveThread,
    buildCallThread,
    syncCallButton,
    syncFromThread,
    tryIncomingFromQuery,
    init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
