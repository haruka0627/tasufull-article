/**
 * 安否未応答 Phase2 — TALK WebRTC 発信橋渡し（WebRTC 本体は変更しない）
 */
(function (global) {
  "use strict";

  const PARAM_TARGET = "anpiCallTarget";
  const PARAM_THREAD = "anpiCallThread";
  const PARAM_AUTO = "anpiCallAuto";
  const PARAM_OPS = "anpiEscalate";
  const PARAM_OPS_DRAFT = "anpiOpsDraft";

  function isTalkHome() {
    return /talk-home\.html/i.test(String(global.location?.pathname || ""));
  }

  function getMeId() {
    const urlUid = String(new URLSearchParams(global.location?.search || "").get("userId") || "").trim();
    if (urlUid) return urlUid;
    return String(global.TasuMemberAuth?.getCurrentUserId?.() || "").trim() || "u_me";
  }

  function buildDirectThread(targetUserId, displayName) {
    const id = `anpi-direct-${targetUserId}`;
    const name = String(displayName || targetUserId).trim();
    return {
      id,
      threadKind: "direct",
      partnerUserId: targetUserId,
      title: name,
      displayName: name,
      name,
    };
  }

  function buildCallUrl(input) {
    const holderUserId = String(input?.holderUserId || input?.contractHolderId || "u_me").trim();
    const targetUserId = String(input?.targetUserId || "").trim();
    const checkId = String(input?.checkId || "").trim();
    const targetName = String(input?.targetName || targetUserId).trim();
    const params = new URLSearchParams();
    params.set("userId", holderUserId);
    params.set("tab", "chat");
    params.set(PARAM_TARGET, targetUserId);
    params.set(PARAM_THREAD, `anpi-direct-${targetUserId}`);
    params.set(PARAM_AUTO, "1");
    if (checkId) params.set("checkId", checkId);
    if (targetName) params.set("anpiCallName", targetName);
    if (input?.fromTalk) params.set("from", "talk");
    params.set("talkDev", "1");
    return `talk-home.html?${params.toString()}`;
  }

  function buildOpsConsultUrl(input) {
    const holderUserId = String(input?.holderUserId || "u_me").trim();
    const checkId = String(input?.checkId || "demo").trim();
    const targetName = String(input?.targetName || "利用者").trim();
    const draft = `安否未応答（${targetName}）について相談します。checkId: ${checkId}`;
    const params = new URLSearchParams();
    params.set("userId", holderUserId);
    params.set("tab", "chat");
    params.set("thread", "official_anpi");
    params.set(PARAM_OPS, checkId);
    params.set(PARAM_OPS_DRAFT, draft);
    params.set("talkDev", "1");
    if (input?.fromTalk) params.set("from", "anpi-no-response");
    return `talk-home.html?${params.toString()}`;
  }

  function stripParams(keys) {
    try {
      const url = new URL(global.location.href);
      keys.forEach((k) => url.searchParams.delete(k));
      global.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }
  }

  function waitFor(predicate, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 15000);
    return new Promise((resolve, reject) => {
      const tick = () => {
        try {
          if (predicate()) return resolve(true);
        } catch {
          /* ignore */
        }
        if (Date.now() >= deadline) return reject(new Error("timeout"));
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  async function tryAutoCallFromUrl() {
    if (!isTalkHome()) return;
    const params = new URLSearchParams(global.location.search);
    if (params.get(PARAM_AUTO) !== "1") return;
    const target = params.get(PARAM_TARGET);
    if (!target) return;

    const name = params.get("anpiCallName") || target;
    const threadId = params.get(PARAM_THREAD) || `anpi-direct-${target}`;
    const checkId = params.get("checkId") || "";

    try {
      await waitFor(
        () => global.TasuTalkLineRoom?.openThread && global.TasuTalkCallService?.initiateCall,
        20000
      );
    } catch {
      console.warn("[TasuAnpiTalkCallBridge] talk modules not ready");
      return;
    }

    const thread = buildDirectThread(target, name);
    thread.id = threadId;

    global.TasuTalkLineRoom.openThread(thread);

    if (checkId && global.TasuAnpiNoResponseService?.auditTalkCallInitiated) {
      try {
        await global.TasuAnpiNoResponseService.auditTalkCallInitiated(checkId, getMeId(), {
          thread_id: threadId,
          target_user_id: target,
        });
      } catch {
        /* ignore */
      }
    }

    try {
      await global.TasuTalkCallService.initiateCall(thread);
    } catch (err) {
      console.warn("[TasuAnpiTalkCallBridge] initiateCall:", err);
    }

    stripParams([PARAM_AUTO, PARAM_TARGET, PARAM_THREAD, "checkId", "anpiCallName"]);
  }

  function tryOpsConsultFromUrl() {
    if (!isTalkHome()) return;
    const params = new URLSearchParams(global.location.search);
    const checkId = params.get(PARAM_OPS);
    if (!checkId) return;

    const draft = params.get(PARAM_OPS_DRAFT) || "";

    const openOfficial = () => {
      if (global.TasuTalkLineRoom?.openThreadById) {
        global.TasuTalkLineRoom.openThreadById("official_anpi");
      }
      const input = document.querySelector("[data-talk-line-composer-input]");
      if (input && draft && !input.value) {
        input.value = draft;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    setTimeout(openOfficial, 600);
    stripParams([PARAM_OPS, PARAM_OPS_DRAFT]);
  }

  function initBridge() {
    if (!isTalkHome()) return;
    tryAutoCallFromUrl().catch(() => {});
    tryOpsConsultFromUrl();
  }

  if (isTalkHome()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(initBridge, 900));
    } else {
      setTimeout(initBridge, 900);
    }
  }

  global.TasuAnpiTalkCallBridge = {
    buildCallUrl,
    buildOpsConsultUrl,
    buildDirectThread,
    tryAutoCallFromUrl,
    tryOpsConsultFromUrl,
  };
})(window);
