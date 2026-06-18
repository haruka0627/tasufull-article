/**
 * チャット詳細 UI（LINE形式）
 * - loadMessages(): chat-service.js に委譲
 * - renderMessages(): UI層
 * - saveMessage(): chat-service.js に委譲（moderateMessage内包）
 */
(function () {
  "use strict";

  const CHAT_DETAIL_SCRIPT_VERSION = String(
    window.__tasuChatDetailExpectedScriptVersion || "20260609-script-trace-v2"
  );

  window.__tasuChatDetailScriptLoaded = true;
  window.__tasuChatDetailScriptVersion = CHAT_DETAIL_SCRIPT_VERSION;
  window.__tasuChatDetailScriptLoadError = "";

  function stampChatDetailScriptDomEvidence() {
    try {
      const host = document.body || document.documentElement;
      if (!host) return;
      host.dataset.chatDetailScriptLoaded = "1";
      host.dataset.chatDetailScriptVersion = CHAT_DETAIL_SCRIPT_VERSION;
    } catch {
      /* ignore */
    }
  }

  stampChatDetailScriptDomEvidence();

  try {
    const params = new URLSearchParams(window.location.search);
    window.__tasuBenchThreadResolveDiag = {
      traceName: "thread解決内部トレース",
      phase: "script_loaded",
      urlThreadId: String(params.get("thread") || params.get("roomId") || ""),
      queryListingId: String(params.get("listingId") || ""),
      queryApplicationId: String(params.get("applicationId") || ""),
      queryUserId: String(params.get("userId") || ""),
      ensureCalled: false,
      failStep: "",
      failReason: "",
      finalResult: "",
      at: new Date().toISOString(),
      chatDetailScriptVersion: CHAT_DETAIL_SCRIPT_VERSION,
    };
    window.__tasuBenchThreadResolveDiag.phase = "init";
  } catch {
    /* ignore */
  }

  const ME_ID = "u_me";
  /** @type {{name:string, dataUrl:string}|null} */
  let pendingAttachment = null;
  /** @type {string} */
  let activeRoomId = "";
  /** @type {object|null} 現在表示中のルーム（transaction_rooms.id === roomId） */
  let currentRoom = null;
  /** @type {Array<object>} */
  let displayMessages = [];
  /** @type {Set<string>} */
  const knownMessageIds = new Set();
  /** @type {(() => void)|null} */
  let unsubscribeRealtime = null;
  /** @type {string} 相手の transaction_reads.last_read_at */
  let partnerLastReadAt = "";
  /** @type {string} */
  let pendingReportMessageId = "";
  /** @type {boolean} */
  let reportUiBound = false;
  /** @type {{ active: boolean, iBlockedThem: boolean, theyBlockedMe: boolean }} */
  let roomBlockStatus = { active: false, iBlockedThem: false, theyBlockedMe: false };
  /** @type {boolean} */
  let completeUiBound = false;
  /** @type {boolean} */
  let reviewUiBound = false;
  /** @type {boolean} */
  let reviewAutoOpenConsumed = false;
  let reviewViewAutoOpenConsumed = false;
  let reviewViewUiBound = false;
  /** @type {number} */
  let selectedReviewRating = 0;
  /** @type {number} */
  let chatDetailLoadWallMs = 0;

  function getMeId() {
    if (window.TasuChatUserIdentity?.getEffectiveUserId) {
      return window.TasuChatUserIdentity.getEffectiveUserId();
    }
    return (
      currentRoom?.me?.id ||
      window.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      ME_ID
    );
  }

  function getActiveRoomId() {
    return (
      window.TasuChatService.normalizeRoomId(activeRoomId) ||
      window.TasuChatService.normalizeRoomId(currentRoom?.id) ||
      window.TasuChatService.getRoomIdFromLocation()
    );
  }

  function isInternalUserLabel(str) {
    const s = String(str || "").trim();
    if (!s) return true;
    if (/^u_[a-z0-9_]+$/i.test(s)) return true;
    if (/^chat-demo-/i.test(s)) return true;
    return false;
  }

  function getMeDisplayName(room) {
    const meId = getMeId();
    if (room?.me?.displayName && String(room.me.id) === String(meId)) {
      if (!isInternalUserLabel(room.me.displayName)) return room.me.displayName;
    }
    const profile = window.TasuChatUserIdentity?.getProfileForUserId?.(meId);
    if (profile?.displayName && !isInternalUserLabel(profile.displayName)) {
      return profile.displayName;
    }
    if (String(meId) === String(room?.buyerId)) return room?.buyerName || "依頼者";
    if (String(meId) === String(room?.sellerId)) return room?.sellerName || "掲載者";
    return "利用者";
  }

  function getCompletionFlow() {
    return window.TasuPlatformChatCompletionFlow;
  }

  function getFlowLabels(room) {
    const target = resolveFlowRoom(room);
    const Category = window.TasuPlatformChatCategoryFlow;
    if (Category?.getLabels && shouldUseWorkReportModal(target, "request")) {
      return Category.getLabels(target);
    }
    const flow = getCompletionFlow();
    if (flow?.getLabels) return flow.getLabels(target);
    if (Category?.getLabels) {
      return Category.getLabels(target);
    }
    return {
      completeBtn: "取引完了",
      completeDone: "取引完了済み",
      pendingBtn: "完了申請中",
      approveBtn: "取引完了を承認",
      modalTitle: "取引完了",
      confirmBody: window.TasuChatRoomStatus?.COMPLETE_CONFIRM_BODY || "この取引を完了しますか？",
      submitLabel: "申請する",
      completedNotice: "取引が完了しました",
      completedPlaceholder: "取引完了のため送信できません",
      reviewBtn: "レビューする",
      reviewTitle: "取引相手を評価",
      reviewSub: "出品者への評価は任意です。スキップしても取引は完了したままです。",
    };
  }

  async function refreshMessagesAfterFlow(roomId) {
    if (!roomId) return;
    const { messages: nextMessages } = await window.TasuChatService.loadMessages(roomId);
    displayMessages = nextMessages;
    renderMessages(displayMessages);
  }

  async function refreshMessagesLight(roomId, options) {
    const id = pickStr(roomId, getActiveRoomId());
    if (!id) return { ok: false, reason: "no_room" };
    const Trace = window.TasuPlatformChatInteractionTrace;
    Trace?.logEvent?.("render_start", { phase: pickStr(options?.phase, "light"), roomId: id });
    const { thread, messages } = await window.TasuChatService.loadMessages(id);
    if (thread) {
      applyCurrentRoom(thread, id, messages);
      partnerLastReadAt = thread?.partnerLastReadAt || currentRoom?.partnerLastReadAt || "";
    }
    displayMessages = messages;
    renderMessages(displayMessages);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
    Trace?.logEvent?.("render_complete", { phase: pickStr(options?.phase, "light"), roomId: id });
    return { ok: true, thread, messages };
  }

  function postBenchChatRefreshLight(threadId, options) {
    const id = pickStr(threadId, getActiveRoomId());
    if (!id) return;
    const Trace = window.TasuPlatformChatInteractionTrace;
    Trace?.bumpCounter?.("postMessage");
    try {
      window.parent?.postMessage?.(
        {
          type: "tasu-bench-chat-refresh",
          threadId: id,
          light: true,
          openReview: options?.openReview === true ? "1" : "",
          reason: pickStr(options?.reason, "flow_action"),
        },
        "*"
      );
    } catch {
      /* ignore */
    }
  }

  function postBenchFlowRefreshImmediate(threadId, options) {
    const id = pickStr(threadId, getActiveRoomId());
    if (!id || !window.parent || window.parent === window) return;
    const Trace = window.TasuPlatformChatInteractionTrace;
    Trace?.bumpCounter?.("postMessage");
    try {
      window.parent.postMessage(
        {
          type: "tasu-bench-chat-refresh",
          threadId: id,
          immediate: true,
          force: true,
          openReview: options?.openReview === true ? "1" : "",
          reason: pickStr(options?.reason, "flow_action_immediate"),
        },
        "*"
      );
    } catch {
      /* ignore */
    }
  }

  async function applyFlowActionImmediate(res, options) {
    const opts = options || {};
    const roomId = pickStr(opts.roomId, res?.thread?.id, getActiveRoomId());
    if (!roomId) return { ok: false, reason: "no_room" };

    setFlowActionPending(false);

    const stored =
      (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(roomId)) ||
      null;
    const mergedThread = { ...(stored || {}), ...(res?.thread || {}) };
    if (mergedThread?.id) {
      applyCurrentRoom(mergedThread, roomId, displayMessages);
    }

    if (syncFlowCardsFromStore(mergedThread)) {
      const loaded = await window.TasuChatService.loadMessages(roomId);
      if (loaded.thread) {
        applyCurrentRoom(loaded.thread, roomId, loaded.messages);
      }
      syncDisplayMessages(loaded.messages);
    } else {
      await refreshMessagesLight(roomId, { phase: pickStr(opts.phase, "flow_immediate") });
    }

    if (opts.teardownRealtime !== false && res?.awaitingPayment !== true) {
      teardownRealtime();
    }

    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();

    if (opts.refreshBench !== false) {
      postBenchFlowRefreshImmediate(roomId, opts);
    }

    if (shouldSuppressBenchAutoScrollBottom()) {
      restoreBenchEmbedScrollPosition();
    } else if (opts.scrollToCompletionCard === true) {
      const cardEl =
        document.querySelector("[data-platform-completion-card]") ||
        document.querySelector("[data-marketplace-connect-confirm-card]");
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        scrollToBottomAfterPaint();
      }
    }

    return { ok: true, thread: currentRoom };
  }

  function markFlowButtonActing(btn, active) {
    if (!btn) return;
    btn.classList.toggle("is-acting", active === true);
    if (active === true) {
      btn.disabled = true;
    }
  }

  function bootstrapConnectEntryFromUrl(thread) {
    if (!thread || typeof thread !== "object") return thread;
    const Entry = window.TasuPlatformChatConnectEntryFlow;
    if (Entry?.readConnectEntryPaymentFromUrl?.() !== true) return thread;
    return {
      ...thread,
      connectEntryPayment: true,
      platformConnectMode: pickStr(thread.platformConnectMode, "entry"),
    };
  }

  function applyCurrentRoom(thread, roomId, messages) {
    const id = window.TasuChatService.normalizeRoomId(roomId);
    if (thread && window.TasuChatService.normalizeRoomId(thread.id) === id) {
      const viewerId = getMeId();
      const bootstrapped = bootstrapConnectEntryFromUrl(thread);
      currentRoom =
        window.TasuChatThreadStore?.applyViewerToThread?.(bootstrapped, viewerId) || bootstrapped;
      activeRoomId = id;
      updateCompleteButton(currentRoom);
      return currentRoom;
    }
    if (Array.isArray(messages) && messages.length > 0) {
      currentRoom = window.TasuChatService.createRoomContextFromMessages(id, messages, thread);
      activeRoomId = id;
      updateCompleteButton(currentRoom);
      return currentRoom;
    }
    currentRoom = null;
    return null;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMessageText(text) {
    return escapeHtml(text ?? "");
  }

  function renderMessageAvatar(name, url) {
    const safeUrl = String(url || "").trim();
    const label = String(name || "").trim();
    if (safeUrl) {
      return `<img class="chat-msg__avatar" src="${escapeHtml(safeUrl)}" alt="" loading="lazy">`;
    }
    const initial = label ? [...label][0] : "人";
    return `<span class="chat-msg__avatar chat-msg__avatar--initial" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function formatDay(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function groupByDay(messages) {
    /** @type {Record<string, Array<any>>} */
    const map = {};
    for (const msg of messages) {
      const key = formatDay(msg.createdAt) || "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(msg);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }

  function showFlowInlineError(message) {
    const errorEl = document.getElementById("chatInlineError");
    if (!errorEl) return;
    errorEl.textContent = pickStr(message, "操作を完了できませんでした");
    errorEl.style.display = "block";
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function handleFlowCardClick(ev) {
    if (ev.defaultPrevented) return false;

    const messagesRoot = document.getElementById("chatMessages");
    const flowTarget =
      ev.target.closest("[data-connect-complete-approve]") ||
      ev.target.closest("[data-connect-complete-reject]") ||
      ev.target.closest("[data-work-service-stripe-pay]") ||
      ev.target.closest("[data-work-service-seller-confirm]") ||
      ev.target.closest("[data-manual-pay-report-paid]") ||
      ev.target.closest("[data-manual-pay-confirm-deposit]") ||
      ev.target.closest("[data-purchase-bank-report]") ||
      ev.target.closest("[data-purchase-bank-confirm]") ||
      ev.target.closest("[data-connect-pay-complete]");
    if (!flowTarget) return false;
    if (!messagesRoot || !messagesRoot.contains(flowTarget)) return false;

    const flowActionName =
      flowTarget.getAttribute("data-connect-complete-approve") != null
        ? "connect_complete_approve"
        : flowTarget.getAttribute("data-connect-complete-reject") != null
          ? "connect_complete_reject"
          : flowTarget.getAttribute("data-work-service-stripe-pay") != null
            ? "work_service_stripe_pay"
            : flowTarget.getAttribute("data-work-service-seller-confirm") != null
              ? "work_service_seller_confirm"
              : flowTarget.getAttribute("data-manual-pay-report-paid") != null
                ? "manual_pay_report_paid"
                : flowTarget.getAttribute("data-manual-pay-confirm-deposit") != null
                  ? "manual_pay_confirm_deposit"
                  : flowTarget.getAttribute("data-purchase-bank-report") != null
                    ? "purchase_bank_report"
                    : flowTarget.getAttribute("data-purchase-bank-confirm") != null
                      ? "purchase_bank_confirm"
                      : flowTarget.getAttribute("data-connect-pay-complete") != null
                        ? "connect_pay_complete"
                        : "flow_card";
    window.TasuPlatformChatInteractionTrace?.stampClick?.(flowActionName, {
      threadId: pickStr(flowTarget.getAttribute("data-thread-id"), getActiveRoomId()),
    });

    if (flowTarget.matches("[data-connect-complete-approve]")) {
      ev.preventDefault();
      void onApproveCompleteSubmit(flowTarget);
      return true;
    }
    if (flowTarget.matches("[data-connect-complete-reject]")) {
      ev.preventDefault();
      void onConnectRejectSubmit();
      return true;
    }

    const paidBtn = flowTarget.matches("[data-manual-pay-report-paid]") ? flowTarget : null;
    if (paidBtn) {
      ev.preventDefault();
      const flow = window.TasuPlatformChatManualTransferFlow;
      const roomId = getActiveRoomId();
      if (!flow?.reportPaid || !roomId) {
        showFlowInlineError("支払い報告を送信できませんでした");
        return true;
      }
      const res = flow.reportPaid({ threadId: roomId, thread: currentRoom, userId: getMeId() });
      if (!res?.ok) {
        showFlowInlineError(res?.reason || "支払い報告を送信できませんでした");
        return true;
      }
      void refreshMessagesAfterFlow(roomId).then(() => setHeader(currentRoom));
      return true;
    }

    const confirmBtn = flowTarget.matches("[data-manual-pay-confirm-deposit]") ? flowTarget : null;
    if (confirmBtn) {
      if (ev.defaultPrevented) return true;
      ev.preventDefault();
      void onConfirmDepositSubmit(confirmBtn);
      return true;
    }

    const purchaseBankReportBtn = flowTarget.matches("[data-purchase-bank-report]")
      ? flowTarget
      : null;
    if (purchaseBankReportBtn) {
      ev.preventDefault();
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      if (Purchase?.reportBankTransferFromCard) {
        void Purchase.reportBankTransferFromCard(purchaseBankReportBtn, ev);
      } else {
        showFlowInlineError("振込完了を報告できませんでした");
      }
      return true;
    }

    const purchaseBankConfirmBtn = flowTarget.matches("[data-purchase-bank-confirm]")
      ? flowTarget
      : null;
    if (purchaseBankConfirmBtn) {
      ev.preventDefault();
      const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
      if (Purchase?.confirmBankPaymentFromCard) {
        void Purchase.confirmBankPaymentFromCard(purchaseBankConfirmBtn, ev);
      } else {
        showFlowInlineError("入金を確認できませんでした");
      }
      return true;
    }

    const workStripePayBtn = flowTarget.matches("[data-work-service-stripe-pay]")
      ? flowTarget
      : null;
    if (workStripePayBtn) {
      ev.preventDefault();
      const WorkSvc = window.TasuPlatformChatWorkServiceConnectFlow;
      const roomId = pickStr(workStripePayBtn.getAttribute("data-thread-id"), getActiveRoomId());
      if (!WorkSvc?.executeStripeConnectPayment || !roomId) return true;
      setFlowActionPending(true);
      markFlowButtonActing(workStripePayBtn, true);
      const res = WorkSvc.executeStripeConnectPayment({
        threadId: roomId,
        thread: currentRoom,
        userId: getMeId(),
      });
      if (!res?.ok) {
        setFlowActionPending(false);
        markFlowButtonActing(workStripePayBtn, false);
        workStripePayBtn.disabled = false;
        showFlowInlineError(res?.reason || "決済を完了できませんでした");
        return true;
      }
      void refreshMessagesLight(roomId, { phase: "work_service_stripe_pay" }).finally(() => {
        setFlowActionPending(false);
        markFlowButtonActing(workStripePayBtn, false);
        postBenchChatRefreshLight(roomId, { reason: "work_service_stripe_pay" });
      });
      return true;
    }

    const workSellerConfirmBtn = flowTarget.matches("[data-work-service-seller-confirm]")
      ? flowTarget
      : null;
    if (workSellerConfirmBtn) {
      ev.preventDefault();
      const WorkSvc = window.TasuPlatformChatWorkServiceConnectFlow;
      const roomId = pickStr(workSellerConfirmBtn.getAttribute("data-thread-id"), getActiveRoomId());
      if (!WorkSvc?.confirmPaymentReceived || !roomId) return true;
      setFlowActionPending(true);
      markFlowButtonActing(workSellerConfirmBtn, true);
      const res = WorkSvc.confirmPaymentReceived({
        threadId: roomId,
        thread: currentRoom,
        userId: getMeId(),
      });
      if (!res?.ok) {
        setFlowActionPending(false);
        markFlowButtonActing(workSellerConfirmBtn, false);
        workSellerConfirmBtn.disabled = false;
        showFlowInlineError(res?.reason || "確認完了できませんでした");
        return true;
      }
      if (res.thread) applyCurrentRoom(res.thread, roomId, displayMessages);
      void refreshMessagesLight(roomId, { phase: "work_service_seller_confirm" }).finally(() => {
        setFlowActionPending(false);
        markFlowButtonActing(workSellerConfirmBtn, false);
        postBenchChatRefreshLight(roomId, { reason: "work_service_seller_confirm" });
      });
      return true;
    }

    const payBtn = flowTarget.matches("[data-connect-pay-complete]") ? flowTarget : null;
    if (payBtn) {
      ev.preventDefault();
      const flow = window.TasuPlatformChatConnectChatFlow;
      const roomId = getActiveRoomId();
      if (
        window.TasuPlatformChatWorkServiceConnectFlow?.isWorkServiceConnectThread?.(currentRoom)
      ) {
        return true;
      }
      if (!flow?.completeConnectPayment || !roomId) return true;
      payBtn.disabled = true;
      const res = flow.completeConnectPayment({
        threadId: roomId,
        thread: currentRoom,
        userId: getMeId(),
      });
      if (!res?.ok) {
        payBtn.disabled = false;
        showFlowInlineError("支払いを完了できませんでした");
        return true;
      }
      void reloadRoomStateFromStore();
      return true;
    }

    return false;
  }

  function installFlowCardDocumentBridge() {
    const root = document.documentElement;
    if (root.dataset.tasuFlowCardBridge === "1") return;
    root.dataset.tasuFlowCardBridge = "1";
    document.addEventListener(
      "click",
      (ev) => {
        handleFlowCardClick(ev);
      },
      true
    );
  }

  async function afterFlowReportPaid(res) {
    const roomId = getActiveRoomId() || pickStr(res?.thread?.id);
    if (roomId) {
      if (syncFlowCardsFromStore(res?.thread || currentRoom)) {
        const { messages } = await window.TasuChatService.loadMessages(roomId);
        syncDisplayMessages(messages);
      } else {
        await refreshMessagesAfterFlow(roomId);
      }
    }
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
  }

  async function afterFlowPurchaseBankReport(res) {
    const roomId = getActiveRoomId() || pickStr(res?.thread?.id);
    if (res?.thread && roomId) {
      applyCurrentRoom(res.thread, roomId, displayMessages);
    }
    if (roomId) {
      if (syncFlowCardsFromStore(res?.thread || currentRoom)) {
        const { messages } = await window.TasuChatService.loadMessages(roomId);
        syncDisplayMessages(messages);
      } else {
        await refreshMessagesAfterFlow(roomId);
      }
    }
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
    showReportToast("銀行振込が完了しました");
    try {
      window.parent?.postMessage?.({ type: "tasu-bench-chat-refresh", threadId: roomId }, "*");
    } catch {
      /* ignore */
    }
  }

  async function afterFlowPurchaseBankConfirm(res) {
    const roomId = getActiveRoomId() || pickStr(res?.thread?.id);
    if (res?.thread && roomId) {
      applyCurrentRoom(res.thread, roomId, displayMessages);
    }
    if (roomId) {
      await refreshMessagesAfterFlow(roomId);
    }
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
    showReportToast("入金を確認しました");
    try {
      window.parent?.postMessage?.({ type: "tasu-bench-chat-refresh", threadId: roomId }, "*");
    } catch {
      /* ignore */
    }
  }

  async function afterFlowDepositConfirm(res) {
    const roomId = getActiveRoomId() || pickStr(res?.thread?.id);
    let thread = res?.thread;
    if (roomId && !thread) {
      thread = (window.TasuChatThreadStore?.readAll?.() || []).find(
        (t) => String(t.id) === String(roomId)
      );
    }
    if (thread && roomId) {
      applyCurrentRoom(thread, roomId, displayMessages);
    }
    teardownRealtime();
    if (roomId) {
      const loaded = await window.TasuChatService.loadMessages(roomId);
      if (loaded?.thread) applyCurrentRoom(loaded.thread, roomId, displayMessages);
      syncDisplayMessages(loaded?.messages || displayMessages);
    }
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    updatePostCompleteBar(currentRoom);
    applyRoomComposerState();
    const labels = getFlowLabels(currentRoom);
    showReportToast("取引が完了しました");
    const reviewEl = document.querySelector("[data-platform-job-review-prompt]");
    if (reviewEl) reviewEl.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      window.parent?.postMessage?.({ type: "tasu-bench-chat-refresh", threadId: roomId }, "*");
    } catch {
      /* ignore */
    }
  }

  async function onConfirmDepositSubmit(triggerBtn) {
    const roomId = pickStr(
      getActiveRoomId(),
      triggerBtn?.closest?.("[data-manual-deposit-card]")?.getAttribute?.("data-thread-id"),
      new URL(location.href).searchParams.get("thread")
    );
    const flow = window.TasuPlatformChatManualTransferFlow;
    const confirmBtn =
      triggerBtn?.matches?.("[data-manual-pay-confirm-deposit]") ? triggerBtn : null;
    if (!flow?.confirmDepositAndComplete || !roomId) {
      showFlowInlineError("入金確認を完了できませんでした");
      return;
    }
    if (confirmBtn) {
      if (confirmBtn.disabled || confirmBtn.dataset.tasuDepositSubmitting === "1") return;
      confirmBtn.dataset.tasuDepositSubmitting = "1";
      confirmBtn.disabled = true;
    }
    setFlowActionPending(true);
    const thread =
      currentRoom ||
      (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(roomId));
    let res;
    try {
      res = flow.confirmDepositAndComplete({
        threadId: roomId,
        thread,
        userId: getMeId(),
      });
    } catch (err) {
      setFlowActionPending(false);
      if (confirmBtn) {
        confirmBtn.disabled = false;
        delete confirmBtn.dataset.tasuDepositSubmitting;
      }
      showFlowInlineError(String(err?.message || err || "入金確認を完了できませんでした"));
      return;
    }
    if (!res?.ok) {
      setFlowActionPending(false);
      if (confirmBtn) {
        confirmBtn.disabled = false;
        delete confirmBtn.dataset.tasuDepositSubmitting;
      }
      showFlowInlineError(res?.reason || "入金確認を完了できませんでした");
      return;
    }
    await afterFlowDepositConfirm(res);
    if (confirmBtn) delete confirmBtn.dataset.tasuDepositSubmitting;
    setFlowActionPending(false);
  }

  async function afterFlowApprove(res) {
    const roomId = getActiveRoomId() || pickStr(res?.thread?.id);
    if (res?.awaitingPayment) {
      await applyFlowActionImmediate(res, {
        roomId,
        phase: "approve_awaiting_payment",
        reason: "approve_awaiting_payment",
        teardownRealtime: false,
      });
      showReportToast("承認しました。お支払い先をご確認ください。");
      const payCard = document.querySelector("[data-manual-transfer-card]");
      if (payCard) payCard.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    await applyFlowActionImmediate(res, {
      roomId,
      phase: "approve_complete",
      reason: "approve_complete",
      scrollToCompletionCard: true,
    });
    const labels = getFlowLabels(currentRoom);
    showReportToast(labels.completedNotice);
  }

  function ensureFlowCardActionBindings() {
    installFlowCardDocumentBridge();
    const wrap = document.getElementById("chatMessages");
    if (wrap) wrap.dataset.flowCardActionsReady = "1";
  }

  function syncDisplayMessages(messages) {
    displayMessages = Array.isArray(messages) ? [...messages] : [];
    knownMessageIds.clear();
    for (const m of displayMessages) {
      if (m?.id) knownMessageIds.add(String(m.id));
    }
    renderMessages(displayMessages);
    ensureFlowCardActionBindings();
    const wrap = document.getElementById("chatMessages");
    if (wrap && window.TasuPlatformChatCompletion?.bindCompletionCardActions) {
      window.TasuPlatformChatCompletion.bindCompletionCardActions(wrap, async () => {
        const rid = getActiveRoomId();
        if (!rid) return;
        const { messages: next } = await window.TasuChatService.loadMessages(rid);
        syncDisplayMessages(next);
      });
    }
    if (window.TasuPlatformChatJobFlow?.isJobThread?.(currentRoom) === true) {
      updateCompleteButton(currentRoom);
    }
  }

  function appendDisplayMessage(msg) {
    if (!msg?.id || knownMessageIds.has(String(msg.id))) {
      return false;
    }
    knownMessageIds.add(String(msg.id));
    displayMessages = [...displayMessages, msg];
    renderMessages(displayMessages);
    if (window.TasuPlatformChatJobFlow?.isJobThread?.(currentRoom) === true) {
      updateCompleteButton(currentRoom);
    }
    scrollToBottomAfterPaint();
    return true;
  }

  function teardownRealtime() {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
    window.TasuChatService.unsubscribeRoomMessages?.();
  }

  function enrichMessageRow(row) {
    const meId = getMeId();
    const isMe = String(row.sender_id) === String(meId);
    const me = currentRoom?.me;
    const partner = currentRoom?.partner;
    if (isMe && me) {
      return { senderName: me.displayName, senderAvatarUrl: me.avatarUrl };
    }
    if (!isMe && partner) {
      return { senderName: partner.displayName, senderAvatarUrl: partner.avatarUrl };
    }
    return {};
  }

  function setPartnerLastReadAt(iso) {
    partnerLastReadAt = iso || "";
    if (currentRoom) {
      currentRoom.partnerLastReadAt = partnerLastReadAt;
    }
    renderMessages(displayMessages);
  }

  function getCurrentRoomLifecycle() {
    try {
      return window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(currentRoom) || "active";
    } catch (err) {
      console.warn("[TasuChat] getCurrentRoomLifecycle failed:", err);
      return "active";
    }
  }

  function isRoomRealtimeAllowed() {
    try {
      if (window.TasuChatRoomStatus?.isRealtimeAllowed) {
        return window.TasuChatRoomStatus.isRealtimeAllowed(currentRoom);
      }
      return !window.TasuChatService.isRoomExpired?.(currentRoom);
    } catch (err) {
      console.warn("[TasuChat] isRoomRealtimeAllowed failed:", err);
      return true;
    }
  }

  function startRealtimeSubscription(roomId) {
    teardownRealtime();
    if (!isRoomRealtimeAllowed()) {
      return;
    }
    if (!window.TasuChatService.isUsingSupabase?.()) {
      return;
    }

    const partnerUserId = currentRoom?.partner?.id || "";
    unsubscribeRealtime = window.TasuChatService.subscribeRoomMessages(roomId, {
      partnerUserId,
      enrich: enrichMessageRow,
      onPartnerRead: (lastReadAt) => setPartnerLastReadAt(lastReadAt),
      onInsert: (msg) => {
        if (!isRoomRealtimeAllowed()) {
          teardownRealtime();
          return;
        }
        const meId = getMeId();
        if (String(msg.senderId) === String(meId)) {
          return;
        }
        if (!appendDisplayMessage(msg)) {
          return;
        }
        const rid = getActiveRoomId();
        if (rid) {
          markOpenRoomRead(rid);
        }
      },
    });
  }

  async function markOpenRoomRead(roomId) {
    const rid = window.TasuChatService.normalizeRoomId(roomId);
    if (!rid) return;

    const lastReadAt = await window.TasuChatService.markRoomReadNow(rid);
    if (currentRoom && window.TasuChatService.normalizeRoomId(currentRoom.id) === rid) {
      currentRoom.unreadCount = 0;
      currentRoom.lastReadAt = lastReadAt || new Date().toISOString();
    }
  }

  function getPartnerId() {
    return String(currentRoom?.partner?.id || "").trim();
  }

  function canShowPartnerMenu(messageId, isMe) {
    if (isMe) return false;
    if (!getPartnerId()) return false;
    return Boolean(window.TasuChatService.isUsingSupabase?.());
  }

  function canReportMessage(messageId, isMe) {
    if (!canShowPartnerMenu(messageId, isMe)) return false;
    return Boolean(window.TasuChatReports?.isUuid?.(messageId));
  }

  function renderMessageMenuButton(messageId, isMe) {
    if (!canShowPartnerMenu(messageId, isMe)) return "";
    const reportItem = canReportMessage(messageId, isMe)
      ? `<button type="button" class="chat-msg__menu-item" data-report-open="${escapeHtml(String(messageId))}">通報</button>`
      : "";
    return `
      <div class="chat-msg-menu">
        <button type="button" class="chat-msg__menu" data-msg-menu-toggle aria-label="メニュー" title="メニュー" aria-haspopup="true">︙</button>
        <div class="chat-msg__menu-dropdown" hidden>
          ${reportItem}
          <button type="button" class="chat-msg__menu-item chat-msg__menu-item--danger" data-block-open>ブロック</button>
        </div>
      </div>`;
  }

  function closeAllMsgMenus() {
    document.querySelectorAll(".chat-msg__menu-dropdown").forEach((el) => {
      el.hidden = true;
    });
  }

  async function refreshRoomBlockStatus() {
    const roomId = getActiveRoomId();
    const partnerId = getPartnerId();
    if (!roomId || !partnerId) {
      roomBlockStatus = { active: false, iBlockedThem: false, theyBlockedMe: false };
      return roomBlockStatus;
    }
    roomBlockStatus = await window.TasuChatService.getRoomBlockStatus(roomId, getMeId(), partnerId);
    return roomBlockStatus;
  }

  /** メッセージ表示後にルーム状態UIを適用（失敗してもチャットは維持） */
  function applyRoomLifecycleUiAfterLoad() {
    try {
      applyRoomComposerState();
    } catch (err) {
      console.warn("[TasuChat] applyRoomLifecycleUiAfterLoad failed:", err);
      updateRoomStatusNotice(false);
      try {
        applyBlockComposerState();
      } catch {
        setComposerEnabled(true);
      }
    }
  }

  function updateRoomStatusNotice(show, message) {
    const notice = document.getElementById("chatRoomStatusNotice");
    const legacy = document.getElementById("chatExpiredNotice");
    const el = notice || legacy;
    const section = document.querySelector(".chat-detail");
    if (el) {
      el.hidden = !show;
      if (show && message) {
        el.textContent = message;
      }
    }
    if (section) {
      section.classList.toggle("chat-detail--closed", Boolean(show));
      section.classList.toggle("chat-detail--expired", getCurrentRoomLifecycle() === "expired");
    }
  }

  function getDbRoomStatus(room) {
    if (window.TasuChatRoomStatus?.getRoomStatus) {
      return window.TasuChatRoomStatus.getRoomStatus(room);
    }
    const raw = room?.roomStatus ?? room?.status ?? "active";
    const s = String(raw).toLowerCase();
    if (s === "completed" || s === "cancelled" || s === "active" || s === "fee_pending") return s;
    return "active";
  }

  function logRoomStatus(room) {
    const dbStatus = getDbRoomStatus(room);
    const lifecycle =
      window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(room) ||
      window.TasuChatService?.resolveRoomLifecycle?.(room) ||
      "active";
    console.log("[TasuChat] room.status (db):", dbStatus, {
      lifecycle,
      roomStatus: room?.roomStatus,
      status: room?.status,
      roomId: room?.id,
    });
  }

  /**
   * 完了申請 / 承認ボタン（チャット中心フロー）
   */
  function isCurrentUserBuyer(room) {
    return Boolean(window.TasuChatService?.isCurrentUserBuyer?.(room || currentRoom, getMeId()));
  }

  function shouldBypassTransactionControls(room) {
    if (window.TasuPlatformChatCategoryFlow?.isBuilderThread?.(room) === true) return true;
    if (!room?._localConsult) return false;
    if (room?.threadKind === "job_hire") return false;
    if (
      room?.roomStatus === "active" ||
      room?.roomStatus === "completion_pending" ||
      room?.roomStatus === "awaiting_payment" ||
      room?.roomStatus === "completed"
    ) {
      return false;
    }
    if (room?.source === "platform-completion-demo" || room?.source === "completion-flow-verify") {
      return false;
    }
    if (room?.source === "job-full-demo") return false;
    if (room?.source === "chat-dual-window-demo") return false;
    if (window.TasuPlatformChatDualWindowDemo?.isDemoThread?.(room) === true) return false;
    return true;
  }

  function updatePostCompleteBar(room) {
    const bar = document.getElementById("chatPostCompleteBar");
    const composer = document.querySelector(".chat-composer");
    const section = document.querySelector(".chat-detail");
    const labels = getFlowLabels(room);
    const lifecycle = shouldBypassTransactionControls(room)
      ? "active"
      : getCurrentRoomLifecycle();
    const isJobRoom = window.TasuPlatformChatJobFlow?.isJobThread?.(room) === true;
    const isCompleted =
      lifecycle === "completed" ||
      (isJobRoom &&
        ["closed", "completed"].includes(
          String(room?.roomStatus || room?.status || "").toLowerCase()
        ));
    const isCancelled = lifecycle === "cancelled";

    if (section) {
      section.classList.toggle("chat-detail--job-completed", isCompleted);
    }

    if (bar) {
      bar.hidden = !isCompleted;
      const textEl = document.getElementById("chatPostCompleteText");
      if (textEl) {
        textEl.textContent = isCompleted
          ? `${labels.completedNotice} このやりとりは完了しています。`
          : labels.completedNotice;
      }
      const reviewBtn = document.getElementById("chatReviewBarBtn");
      if (reviewBtn) {
        reviewBtn.hidden = true;
        reviewBtn.disabled = true;
      }
    }
    if (composer) composer.hidden = isCompleted || isCancelled;
  }

  function updateCancelButton(room) {
    const cancelItem = document.getElementById("chatOverflowCancelItem");
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    const target = room || currentRoom;
    const meId = getMeId();
    const labels = getFlowLabels(target);

    if (!cancelItem) return;

    if (shouldBypassTransactionControls(target)) {
      cancelItem.hidden = true;
      cancelItem.disabled = true;
      updateCancelRequestUi(target);
      return;
    }

    const canCancel = cancelFlow?.canCancelConversation?.(target, meId) === true;
    cancelItem.hidden = !canCancel;
    cancelItem.disabled = !canCancel;
    if (canCancel) {
      const label = labels.cancelBtn || "キャンセル";
      cancelItem.textContent = label;
      cancelItem.setAttribute("aria-label", label);
    }
    updateCancelRequestUi(target);
  }

  function isCompletedTransactionRoom(room) {
    const target = resolveFlowRoom(room);
    if (!target) return false;
    const lifecycle =
      window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(target) ||
      window.TasuChatService?.resolveRoomLifecycle?.(target) ||
      "active";
    const completionStatus = getCompletionFlow()?.getCompletionStatus?.(target) || "";
    return lifecycle === "completed" || completionStatus === "completed";
  }

  function hideCompletedTransactionActionButtons() {
    [
      "chatApproveCompleteBtn",
      "chatCompleteBtn",
      "chatCancelRequestBtn",
      "chatCancelRespondApproveBtn",
      "chatCancelRespondRejectBtn",
      "chatReviewBarBtn",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.disabled = true;
      el.removeAttribute("data-primary-action");
    });
    updateJobEndComposerBar(null);
  }

  function updateCancelRequestUi(room) {
    const target = room || currentRoom;
    const meId = getMeId();
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    const requestBtn = document.getElementById("chatCancelRequestBtn");
    const approveBtn = document.getElementById("chatCancelRespondApproveBtn");
    const rejectBtn = document.getElementById("chatCancelRespondRejectBtn");
    const completeBtn = document.getElementById("chatCompleteBtn");

    if (isCompletedTransactionRoom(target)) {
      if (requestBtn) {
        requestBtn.hidden = true;
        requestBtn.disabled = true;
      }
      if (approveBtn) {
        approveBtn.hidden = true;
        approveBtn.disabled = true;
      }
      if (rejectBtn) {
        rejectBtn.hidden = true;
        rejectBtn.disabled = true;
      }
      if (completeBtn) {
        completeBtn.hidden = true;
        completeBtn.disabled = true;
      }
      return;
    }

    const canRequest = cancelFlow?.canRequestCancelConversation?.(target, meId) === true;
    const canRespond = cancelFlow?.canRespondToCancelRequest?.(target, meId) === true;
    const pendingSelf =
      cancelFlow?.hasPendingCancelRequest?.(target) === true &&
      String(target?.cancelRequestedBy) === String(meId);

    if (requestBtn) {
      requestBtn.hidden = !canRequest;
      requestBtn.disabled = !canRequest || pendingSelf;
    }
    if (approveBtn) {
      approveBtn.hidden = !canRespond;
      approveBtn.disabled = !canRespond;
    }
    if (rejectBtn) {
      rejectBtn.hidden = !canRespond;
      rejectBtn.disabled = !canRespond;
    }
    if (completeBtn && canRespond) {
      completeBtn.hidden = true;
      completeBtn.disabled = true;
    }
  }

  function isBenchEmbedChat() {
    return (
      window.TasuTalkChatDemoReviewMode?.isBenchEmbedMode?.() === true ||
      document.body?.dataset?.benchEmbed === "1"
    );
  }

  let benchEmbedSavedScrollTop = 0;
  let benchEmbedUserScrolledUp = false;
  let benchEmbedScrollQuietUntil = 0;

  function resolveBenchEmbedScrollEl() {
    return document.getElementById("chatMessages") || document.scrollingElement || document.body;
  }

  function publishBenchEmbedScrollDiag() {
    const payload = {
      scrollTop: benchEmbedSavedScrollTop,
      isUserScrolling: benchEmbedUserScrolledUp || Date.now() < benchEmbedScrollQuietUntil,
      userScrolledUp: benchEmbedUserScrolledUp,
    };
    try {
      window.__tasuBenchEmbedScrollDiag = payload;
    } catch {
      /* ignore */
    }
    return payload;
  }

  function restoreBenchEmbedScrollPosition() {
    const el = resolveBenchEmbedScrollEl();
    if (!el || benchEmbedSavedScrollTop <= 0) return;
    el.scrollTop = benchEmbedSavedScrollTop;
    publishBenchEmbedScrollDiag();
  }

  function shouldSuppressBenchAutoScrollBottom(options) {
    if (!isBenchEmbedChat()) return false;
    if (options?.force === true && options?.allowBenchScroll === true) return false;
    return benchEmbedUserScrolledUp && Date.now() < benchEmbedScrollQuietUntil + 600;
  }

  function bindBenchEmbedScrollPreserve() {
    if (!isBenchEmbedChat()) return;
    const onActivity = () => {
      const el = resolveBenchEmbedScrollEl();
      if (!el) return;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      const top = Math.round(el.scrollTop || 0);
      benchEmbedSavedScrollTop = top;
      if (max > 0 && top < max - 40) {
        benchEmbedUserScrolledUp = true;
        benchEmbedScrollQuietUntil = Date.now() + 3000;
      } else if (top >= max - 8) {
        benchEmbedUserScrolledUp = false;
      }
      publishBenchEmbedScrollDiag();
      try {
        const params = new URLSearchParams(window.location.search);
        const side = pickStr(params.get("benchSide"), params.get("side"));
        const frameId =
          side === "B" || side === "b" ? "frame-b-chat" : side === "A" || side === "a" ? "frame-a-chat" : "";
        window.parent?.postMessage?.(
          {
            type: "tasu-bench-preview-scroll",
            frameId,
            scrollTop: top,
            isUserScrolling: benchEmbedUserScrolledUp || Date.now() < benchEmbedScrollQuietUntil,
          },
          "*"
        );
      } catch {
        /* ignore */
      }
    };
    const scrollTargets = [
      document.getElementById("chatMessages"),
      document.scrollingElement,
      document.body,
      document.documentElement,
    ].filter(Boolean);
    scrollTargets.forEach((target) => {
      target.addEventListener("scroll", onActivity, { passive: true });
    });
    document.addEventListener("wheel", () => {
      benchEmbedScrollQuietUntil = Date.now() + 2800;
      onActivity();
    }, { capture: true, passive: true });
    document.addEventListener("touchmove", () => {
      benchEmbedScrollQuietUntil = Date.now() + 2800;
      onActivity();
    }, { capture: true, passive: true });
    publishBenchEmbedScrollDiag();
  }

  function resolveJobMessagesForEnd(room) {
    const Job = window.TasuPlatformChatJobFlow;
    const threadId = pickStr(room?.id, getActiveRoomId());
    if (Job?.resolveJobMessageList) {
      return Job.resolveJobMessageList(threadId, displayMessages);
    }
    if (Array.isArray(displayMessages) && displayMessages.length > 0) return displayMessages;
    return window.TasuChatThreadStore?.getMessages?.(threadId) || displayMessages || [];
  }

  function applyBenchJobEndForce(endState, room, meId, msgs) {
    if (!isBenchEmbedChat()) return endState;
    const Job = window.TasuPlatformChatJobFlow;
    if (Job?.isJobThread?.(room) !== true) return endState;
    const threadId = pickStr(room?.id, getActiveRoomId());
    const fresh =
      (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId) ||
      room;
    const posterId = Job.resolveJobPosterUserId?.(fresh) || "";
    const applicantId = Job.resolveJobApplicantUserId?.(fresh) || "";
    const hasMsg = Job.hasAnyMessage?.(threadId, msgs) === true;
    const norm = Job.normalizeJobRoomStatus?.(fresh) || "";
    if (hasMsg && norm === "active" && meId && meId === posterId) {
      return {
        ...endState,
        visible: true,
        role: "poster",
        action: "job_end_request",
        label: Job.JOB_END_REQUEST_BTN_LABEL || "終了を依頼する",
        canRequestEnd: true,
        requestEndButtonVisible: true,
        buttonHiddenReason: "bench_force_poster",
        hasAnyMessage: true,
        normalizedRoomStatus: norm,
      };
    }
    if (
      Job.isJobEndRequested?.(fresh) === true &&
      hasMsg &&
      meId &&
      meId === applicantId
    ) {
      return {
        ...endState,
        visible: true,
        role: "applicant",
        action: "job_end_confirm",
        label: Job.JOB_CONFIRM_END_BTN_LABEL || "やり取りを完了する",
        canConfirmEnd: true,
        confirmEndButtonVisible: true,
        buttonHiddenReason: "bench_force_applicant",
        hasAnyMessage: true,
        normalizedRoomStatus: norm,
      };
    }
    return endState;
  }

  function isComposerJobEndButtonVisible() {
    const barBtn = document.getElementById("chatJobEndBarBtn");
    if (!barBtn) return false;
    return (
      barBtn.classList.contains("chat-job-end-bar__btn--visible") ||
      (!barBtn.hidden && Boolean(pickStr(barBtn.textContent)))
    );
  }

  function isJobEndDebugPanelEnabled() {
    return window.TasuPlatformChatJobFlow?.isJobFlowDebugUiEnabled?.() === true;
  }

  function removeJobEndDebugPanel() {
    document.getElementById("chatJobEndDebug")?.remove();
    if (document.body?.dataset?.jobEndDebugUi) {
      delete document.body.dataset.jobEndDebugUi;
    }
  }

  function ensureJobEndDebugPanel() {
    if (!isJobEndDebugPanelEnabled()) {
      removeJobEndDebugPanel();
      return null;
    }
    let panel = document.getElementById("chatJobEndDebug");
    if (!panel) {
      const composer = document.querySelector(".chat-composer");
      if (!composer) return null;
      panel = document.createElement("pre");
      panel.id = "chatJobEndDebug";
      panel.className = "chat-job-end-debug";
      panel.setAttribute("aria-label", "求人終了デバッグ");
      panel.hidden = true;
      composer.insertBefore(panel, composer.firstChild);
    }
    document.body.dataset.jobEndDebugUi = "1";
    return panel;
  }

  function publishJobEndDebugSnapshot(diag) {
    if (!isBenchEmbedChat()) return;
    const benchSide = pickStr(new URLSearchParams(location.search).get("benchSide"));
    window.__tasuJobEndDebug = {
      ...(diag || {}),
      benchSide,
      debugInjected:
        isJobEndDebugPanelEnabled() && Boolean(document.getElementById("chatJobEndDebug")),
      isChatDetail: /chat-detail\.html/i.test(String(location.pathname || "")),
      chatHref: String(location.href || ""),
      at: pickStr(diag?.at, new Date().toISOString()),
    };
  }

  function updateJobEndDebugPanel(diag) {
    if (!isJobEndDebugPanelEnabled()) {
      removeJobEndDebugPanel();
      return;
    }
    const panel = ensureJobEndDebugPanel();
    if (!panel) return;
    if (!diag) {
      panel.hidden = true;
      panel.textContent = "";
      return;
    }
    const hiddenReason = pickStr(diag?.buttonHiddenReason);
    panel.hidden = false;
    panel.textContent =
      "[JOB END DEBUG]\n" +
      `currentUserId: ${pickStr(diag?.currentUserId)}\n` +
      `posterUserId: ${pickStr(diag?.posterUserId)}\n` +
      `applicantUserId: ${pickStr(diag?.applicantUserId)}\n` +
      `roomStatus: ${pickStr(diag?.roomStatus)}\n` +
      `normalizedRoomStatus: ${pickStr(diag?.normalizedRoomStatus)}\n` +
      `hasAnyMessage: ${diag?.hasAnyMessage === true}\n` +
      `canRequestEnd: ${diag?.canRequestEnd === true}\n` +
      `canConfirmEnd: ${diag?.canConfirmEnd === true}\n` +
      `requestEndButtonVisible: ${diag?.requestEndButtonVisible === true}\n` +
      `confirmEndButtonVisible: ${diag?.confirmEndButtonVisible === true}\n` +
      `buttonHiddenReason: ${hiddenReason || "—"}\n` +
      `requestButtonVisible: ${diag?.requestButtonVisible === true}\n` +
      `composerEndButtonVisible: ${diag?.composerEndButtonVisible === true}\n` +
      `chatJobEndBarExists: ${Boolean(document.getElementById("chatJobEndBar"))}\n` +
      `isJobThread: ${diag?.isJobThread === true}\n` +
      `updateCompleteButtonCalled: ${Boolean(diag?.at)}`;
  }

  function publishBenchJobEndDebug(room, userId, endState) {
    if (!isBenchEmbedChat()) return;
    const Job = window.TasuPlatformChatJobFlow;
    const meId = pickStr(userId, getMeId());
    const threadId = pickStr(room?.id, getActiveRoomId());
    const fresh =
      threadId && window.TasuChatThreadStore?.readAll
        ? (window.TasuChatThreadStore.readAll() || []).find((t) => String(t.id) === threadId) || room
        : room;
    const isJob = Job?.isJobThread?.(fresh || room) === true;
    const msgs = isJob ? resolveJobMessagesForEnd(fresh || room) : [];
    let state = endState || {};
    if (isJob && !state.visible) {
      state = Job?.getJobEndButtonState?.(fresh || room, meId, msgs) || state;
      state = applyBenchJobEndForce(state, fresh || room, meId, msgs);
    }
    const posterId = isJob ? Job.resolveJobPosterUserId?.(fresh || room) || "" : "";
    const applicantId = isJob ? Job.resolveJobApplicantUserId?.(fresh || room) || "" : "";
    const requestButtonVisible =
      isComposerJobEndButtonVisible() &&
      /終了を依頼する|やり取りを完了する/.test(
        document.getElementById("chatJobEndBarBtn")?.textContent || ""
      );
    window.__tasuJobFlowDiag = {
      currentUserId: meId,
      posterUserId: posterId,
      applicantUserId: applicantId,
      ownerUserId: pickStr(fresh?.ownerUserId, fresh?.posterUserId, posterId),
      listingOwnerId: pickStr(fresh?.listingOwnerId, posterId),
      hasAnyMessage: isJob ? Job?.hasAnyMessage?.(threadId, msgs) === true : false,
      canRequestEnd: state?.canRequestEnd === true,
      canConfirmEnd: state?.canConfirmEnd === true,
      requestEndButtonVisible: state?.requestEndButtonVisible === true,
      confirmEndButtonVisible: state?.confirmEndButtonVisible === true,
      requestButtonVisible,
      composerEndButtonVisible: isComposerJobEndButtonVisible(),
      buttonHiddenReason: isJob
        ? pickStr(state?.buttonHiddenReason)
        : !room
          ? "no_room"
          : "not_job_thread",
      normalizedRoomStatus: isJob ? pickStr(state?.normalizedRoomStatus, Job?.normalizeJobRoomStatus?.(fresh || room)) : "—",
      isJobThread: isJob,
      endButtonVisible: Boolean(state?.visible),
      endButtonRole: pickStr(state?.role),
      endButtonAction: pickStr(state?.action),
      roomStatus: pickStr(fresh?.roomStatus, fresh?.status, room?.roomStatus, room?.status),
      jobStatus: pickStr(fresh?.jobStatus, room?.jobStatus),
      at: new Date().toISOString(),
    };
    updateJobEndDebugPanel(window.__tasuJobFlowDiag);
    publishJobEndDebugSnapshot(window.__tasuJobFlowDiag);
  }

  function refreshBenchJobEndDebug() {
    if (!isBenchEmbedChat()) return;
    const Job = window.TasuPlatformChatJobFlow;
    const meId = getMeId();
    const room = currentRoom;
    if (Job?.isJobThread?.(room) === true) {
      const msgs = resolveJobMessagesForEnd(room);
      let endState = Job.getJobEndButtonState?.(room, meId, msgs) || {};
      endState = applyBenchJobEndForce(endState, room, meId, msgs);
      publishJobFlowDiag(room, meId, endState);
      return;
    }
    publishBenchJobEndDebug(room, meId, null);
  }

  function updateJobEndComposerBar(endState) {
    const bar = document.getElementById("chatJobEndBar");
    const barBtn = document.getElementById("chatJobEndBarBtn");
    if (!bar || !barBtn) return;
    const show = Boolean(endState?.visible && endState?.label);
    if (show) {
      bar.hidden = false;
      bar.removeAttribute("hidden");
      bar.classList.add("chat-job-end-bar--visible");
      barBtn.hidden = false;
      barBtn.removeAttribute("hidden");
      barBtn.classList.add("chat-job-end-bar__btn--visible");
      barBtn.disabled = false;
      barBtn.textContent = endState.label;
      barBtn.setAttribute("aria-label", endState.label);
      barBtn.setAttribute("data-primary-action", pickStr(endState.action, "job_end"));
      return;
    }
    bar.classList.remove("chat-job-end-bar--visible");
    barBtn.classList.remove("chat-job-end-bar__btn--visible");
    bar.hidden = true;
    barBtn.hidden = true;
    barBtn.disabled = true;
    barBtn.removeAttribute("data-primary-action");
  }

  function updateJobRoomEndUi(target, meId) {
    const Job = window.TasuPlatformChatJobFlow;
    const completeBtn = document.getElementById("chatCompleteBtn");
    const approveBtn = document.getElementById("chatApproveCompleteBtn");
    const msgs = resolveJobMessagesForEnd(target);
    let endState = Job?.getJobEndButtonState?.(target, meId, msgs) || {};
    endState = applyBenchJobEndForce(endState, target, meId, msgs);
    publishJobFlowDiag(target, meId, endState);
    updateJobEndComposerBar(endState);
    if (approveBtn) {
      approveBtn.hidden = true;
      approveBtn.disabled = true;
    }
    if (!completeBtn) return;
    if (endState.visible && endState.label) {
      completeBtn.hidden = false;
      completeBtn.disabled = false;
      completeBtn.textContent = endState.label;
      completeBtn.setAttribute("aria-label", endState.label);
      completeBtn.setAttribute("data-primary-action", pickStr(endState.action, "job_end"));
      return;
    }
    completeBtn.hidden = true;
    completeBtn.disabled = true;
    completeBtn.removeAttribute("data-primary-action");
  }

  function updateCompleteButton(room) {
    const completeBtn = document.getElementById("chatCompleteBtn");
    const approveBtn = document.getElementById("chatApproveCompleteBtn");
    const flow = getCompletionFlow();
    const connectFlow = window.TasuPlatformChatConnectChatFlow;
    const target = resolveFlowRoom(room || currentRoom);
    const labels = getFlowLabels(target);
    const meId = getMeId();

    if (completeBtn) {
      completeBtn.classList.remove("chat-complete-btn--done");
    }

    if (window.TasuPlatformChatJobFlow?.isJobThread?.(target) === true) {
      updateJobRoomEndUi(target, meId);
      updateCancelButton(target);
      return;
    }

    if (isBenchEmbedChat()) {
      publishBenchJobEndDebug(target, meId, null);
    }

    if (shouldBypassTransactionControls(target)) {
      if (completeBtn) {
        completeBtn.hidden = true;
        completeBtn.disabled = true;
      }
      if (approveBtn) {
        approveBtn.hidden = true;
        approveBtn.disabled = true;
      }
      updateJobEndComposerBar(null);
      updateJobEndDebugPanel(null);
      updateCancelButton(target);
      return;
    }

    logRoomStatus(target);

    const lifecycle =
      window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(target) ||
      window.TasuChatService?.resolveRoomLifecycle?.(target) ||
      "active";
    const completionStatus = flow?.getCompletionStatus?.(target) || getDbRoomStatus(target);
    const usesDealReportFlow =
      pickStr(target?.dealId) &&
      window.TasuPlatformChatCompletion?.usesCompletionReportDealFlow?.(target.dealId) === true &&
      window.TasuPlatformChatCategoryFlow?.isMarketplaceConnectEntryThread?.(target) !== true;
    const useConnectCard =
      connectFlow?.shouldUseConnectCompletionUi?.(target) === true &&
      completionStatus === "completion_pending" &&
      !usesDealReportFlow;

    if (
      lifecycle === "fee_pending" ||
      lifecycle === "completed" ||
      lifecycle === "awaiting_payment" ||
      completionStatus === "completed" ||
      completionStatus === "awaiting_payment"
    ) {
      hideCompletedTransactionActionButtons();
      updateCancelButton(target);
      return;
    }

    if (approveBtn) {
      approveBtn.hidden = true;
      approveBtn.disabled = true;
    }

    if (!completeBtn) {
      updateCancelButton(target);
      return;
    }

    if (lifecycle === "cancelled" || lifecycle === "expired") {
      completeBtn.hidden = true;
      completeBtn.disabled = true;
      completeBtn.removeAttribute("data-primary-action");
      updateCancelButton(target);
      return;
    }

    const primaryMode =
      flow?.getPrimaryActionMode?.(target, meId) ||
      window.TasuPlatformChatCategoryFlow?.getPrimaryActionMode?.(target, meId) ||
      "";
    const primaryLabel =
      flow?.getPrimaryActionLabel?.(target, meId) ||
      window.TasuPlatformChatCategoryFlow?.getPrimaryActionLabel?.(target, meId) ||
      "";
    const showPrimary =
      flow?.canShowPrimaryAction?.(target, meId) === true ||
      window.TasuPlatformChatCategoryFlow?.canShowPrimaryAction?.(target, meId) === true;

    if (useConnectCard) {
      completeBtn.hidden = true;
      completeBtn.disabled = true;
      completeBtn.removeAttribute("data-primary-action");
      updateCancelButton(target);
      return;
    }

    updateJobEndComposerBar(null);
    updateJobEndDebugPanel(null);

    if (showPrimary && primaryLabel) {
      completeBtn.hidden = false;
      completeBtn.disabled = primaryMode === "pending";
      completeBtn.textContent = primaryLabel;
      completeBtn.setAttribute("aria-label", primaryLabel);
      completeBtn.setAttribute("data-primary-action", primaryMode);
      updateCancelButton(target);
      return;
    }

    completeBtn.hidden = true;
    completeBtn.disabled = true;
    completeBtn.removeAttribute("data-primary-action");
    updateCancelButton(target);
  }

  function applyBlockComposerState() {
    if (roomBlockStatus.iBlockedThem) {
      setComposerEnabled(
        false,
        window.TasuChatBlocks?.BLOCKED_COMPOSER_MESSAGE || "このユーザーをブロック中です"
      );
      return;
    }
    if (roomBlockStatus.theyBlockedMe) {
      setComposerEnabled(
        false,
        window.TasuChatBlocks?.BLOCKED_SEND_MESSAGE || "ブロック中のため送信できません。"
      );
      return;
    }
    setComposerEnabled(true);
  }

  /**
   * 入力欄制御の優先順位:
   * 1. completed 2. cancelled 3. expired 4. blocked 5. active
   */
  function enforceManagementRedirect(thread) {
    const Gate = window.TasuPlatformChatContactGate;
    const url = Gate?.shouldRedirectToManagementPage?.(thread);
    if (url) {
      publishInitExit("return:management_redirect", {
        failStep: "enforceManagementRedirect",
        failReason: `redirect_to_management:${url}`,
        roomId: pickStr(thread?.id),
        q: readChatDetailLocationQuery(),
      });
      window.location.replace(url);
      return true;
    }
    return false;
  }

  function publishJobFlowDiag(room, userId, endState) {
    const Job = window.TasuPlatformChatJobFlow;
    if (Job?.isJobThread?.(room) !== true) return;
    try {
      const threadId = pickStr(room?.id, getActiveRoomId());
      const fresh =
        (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId) ||
        room;
      const posterId = Job.resolveJobPosterUserId?.(fresh) || "";
      const applicantId = Job.resolveJobApplicantUserId?.(fresh) || "";
      const ownerUserId = pickStr(fresh?.ownerUserId, fresh?.posterUserId, posterId);
      const listingOwnerId = pickStr(fresh?.listingOwnerId, posterId);
      const reviewTarget =
        Job.getJobReviewTargetUserId?.(room, userId) || "";
      const input = document.getElementById("chatInput");
      const send = document.getElementById("chatSend");
      const attach = document.getElementById("chatAttach");
      const notifs = JSON.parse(localStorage.getItem("tasful_talk_notifications") || "[]");
      const completionRows = notifs.filter(
        (n) =>
          String(n.threadId) === threadId &&
          String(n.title || "").includes("やり取りが完了")
      );
      const completionA = completionRows.find((n) => String(n.recipientUserId) === posterId) || null;
      const completionB =
        completionRows.find((n) => String(n.recipientUserId) === applicantId) || null;
      const reviewSubmitted = Job.hasUserSubmittedReview?.(threadId, userId, reviewTarget) === true;
      const jobEndBarBtn = document.getElementById("chatJobEndBarBtn");
      window.__tasuJobFlowDiag = {
        currentUserId: pickStr(userId),
        posterUserId: posterId,
        applicantUserId: applicantId,
        ownerUserId,
        listingOwnerId,
        hasAnyMessage: endState?.hasAnyMessage === true,
        canRequestEnd: endState?.canRequestEnd === true,
        canConfirmEnd: endState?.canConfirmEnd === true,
        requestEndButtonVisible: endState?.requestEndButtonVisible === true,
        confirmEndButtonVisible: endState?.confirmEndButtonVisible === true,
        canEndJobConversation: endState?.canConfirmEnd === true,
        endButtonVisible: Boolean(endState?.visible),
        requestButtonVisible: isComposerJobEndButtonVisible(),
        composerEndButtonVisible: isComposerJobEndButtonVisible(),
        isJobThread: true,
        endButtonRole: pickStr(endState?.role),
        endButtonAction: pickStr(endState?.action),
        buttonHiddenReason: pickStr(endState?.buttonHiddenReason),
        normalizedRoomStatus: pickStr(endState?.normalizedRoomStatus),
        endRequestedBy: pickStr(fresh?.endRequestedBy),
        endRequestedAt: pickStr(fresh?.endRequestedAt),
        jobClosedBy: pickStr(fresh?.closedByUserId, fresh?.closedBy),
        closedByUserId: pickStr(fresh?.closedByUserId, fresh?.closedBy),
        completionStatus: pickStr(fresh?.jobStatus, fresh?.roomStatus, fresh?.status),
        completionNotificationA: Boolean(completionA),
        completionNotificationB: Boolean(completionB),
        reviewNotificationA: Boolean(completionA),
        reviewNotificationB: Boolean(completionB),
        reviewTargetA: applicantId,
        reviewTargetB: posterId,
        reviewTargetUserId: reviewTarget,
        reviewCtaVisibleA: false,
        reviewCtaVisibleB: false,
        reviewSubmitted,
        reviewSaved: reviewSubmitted,
        roomStatus: pickStr(fresh?.roomStatus, fresh?.status),
        jobStatus: pickStr(fresh?.jobStatus),
        composerEnabled: Boolean(input && !input.disabled),
        sendBlocked: Boolean(send?.disabled),
        attachBlocked: Boolean(attach?.disabled),
        reviewVisible: Boolean(document.querySelector("[data-platform-job-review-prompt]")),
        reviewCtaVisible: Boolean(document.querySelector("[data-platform-job-review-open]")),
        sendBlockMessage: window.TasuChatService?.getMessagingBlockReason?.(fresh) || "",
        at: new Date().toISOString(),
      };
      updateJobEndDebugPanel(window.__tasuJobFlowDiag);
      publishJobEndDebugSnapshot(window.__tasuJobFlowDiag);
    } catch {
      /* ignore */
    }
  }

  function applyRoomComposerState() {
    const lifecycle = shouldBypassTransactionControls(currentRoom)
      ? "active"
      : getCurrentRoomLifecycle();
    const ui = window.TasuChatRoomStatus?.getLifecycleUi?.(lifecycle);
    const labels = getFlowLabels(currentRoom);
    const Job = window.TasuPlatformChatJobFlow;
    const isJobClosed = Job?.isJobRoomClosed?.(currentRoom) === true;

    updateCompleteButton(currentRoom);
    updatePostCompleteBar(currentRoom);

    if (shouldBypassTransactionControls(currentRoom)) {
      updateRoomStatusNotice(false);
      applyBlockComposerState();
      return;
    }

    if (isJobClosed) {
      const banner = Job?.JOB_CLOSED_BANNER || "やり取りは終了しました。レビューを行ってください。";
      const blockMsg = Job?.JOB_CLOSED_SEND_BLOCK || "このチャットは終了しています";
      updateRoomStatusNotice(true, banner);
      setComposerEnabled(false, blockMsg, blockMsg);
      publishJobFlowDiag(currentRoom, getMeId(), Job?.getJobEndButtonState?.(currentRoom, getMeId(), displayMessages));
      return;
    }

    const isJobEndRequested = Job?.isJobEndRequested?.(currentRoom) === true;
    if (isJobEndRequested) {
      const meId = getMeId();
      const isApplicant = Job?.isJobApplicant?.(currentRoom, meId) === true;
      const banner = isApplicant
        ? Job?.JOB_END_REQUESTED_BANNER || "掲載者から終了依頼が届きました"
        : Job?.JOB_END_REQUESTED_POSTER_BANNER ||
          "終了依頼を送信しました。応募者の完了をお待ちください。";
      updateRoomStatusNotice(true, banner);
      applyBlockComposerState();
      publishJobFlowDiag(currentRoom, meId, Job?.getJobEndButtonState?.(currentRoom, meId, displayMessages));
      return;
    }

    if (lifecycle === "completed") {
      updateRoomStatusNotice(true, labels.completedNotice);
      setComposerEnabled(false, labels.completedPlaceholder, labels.completedPlaceholder);
      return;
    }

    if (lifecycle === "cancelled") {
      updateRoomStatusNotice(true, "やりとりを終了しました");
      setComposerEnabled(
        false,
        labels.cancelledPlaceholder || "やりとり終了のため送信できません",
        labels.cancelledPlaceholder || "やりとり終了のため送信できません"
      );
      return;
    }

    if (ui && !ui.canSend) {
      updateRoomStatusNotice(true, ui.noticeMessage);
      setComposerEnabled(false, ui.alertMessage, ui.placeholder);
      return;
    }

    const productShipNotice =
      window.TasuPlatformChatCategoryFlow?.getProductShippedStatusNotice?.(currentRoom, getMeId()) ||
      "";
    if (productShipNotice && lifecycle === "active") {
      updateRoomStatusNotice(true, productShipNotice);
      applyBlockComposerState();
      return;
    }

    updateRoomStatusNotice(false);
    applyBlockComposerState();
  }

  function openCompleteModal() {
    const flow = getCompletionFlow();
    const meId = getMeId();
    const openBtn = document.getElementById("chatCompleteBtn");
    const jobEndBarBtn = document.getElementById("chatJobEndBarBtn");
    const mode =
      (openBtn && !openBtn.hidden ? openBtn.getAttribute("data-primary-action") : "") ||
      (jobEndBarBtn && !jobEndBarBtn.hidden ? jobEndBarBtn.getAttribute("data-primary-action") : "") ||
      flow?.getPrimaryActionMode?.(currentRoom, meId) ||
      window.TasuPlatformChatCategoryFlow?.getPrimaryActionMode?.(currentRoom, meId) ||
      "request";
    if (mode === "job_end_request" || mode === "job_end_confirm") {
      const modal = document.getElementById("chatCompleteModal");
      const title = document.getElementById("chatCompleteTitle");
      const body = document.getElementById("chatCompleteBody");
      const submitBtn = document.getElementById("chatCompleteSubmit");
      if (!modal) return;
      if (mode === "job_end_confirm") {
        if (title) title.textContent = "やり取りを完了する";
        if (body) {
          body.textContent =
            "やり取りを完了しますか？完了後はチャットがクローズされ、レビューに進めます。";
        }
        if (submitBtn) submitBtn.textContent = "完了する";
      } else {
        if (title) title.textContent = "終了を依頼する";
        if (body) {
          body.textContent =
            "応募者にやり取り終了を依頼します。応募者が完了するとチャットがクローズされます。";
        }
        if (submitBtn) submitBtn.textContent = "依頼する";
      }
      syncCompleteModalPanels(resolveFlowRoom(currentRoom), mode);
      modal.hidden = false;
      return;
    }
    const purchaseModes = new Set([
      "purchase_shipping_ready",
      "purchase_bank_report",
      "purchase_payment_confirm",
      "purchase_receive",
      "purchase_cod_report",
      "purchase_cod_confirm",
    ]);
    if (mode !== "request" && mode !== "ship" && !purchaseModes.has(mode)) return;
    if (mode === "request" && !flow?.canRequestCompletion?.(currentRoom, meId)) return;
    if (
      mode === "ship" &&
      window.TasuPlatformChatCategoryFlow?.canMarkProductShipped?.(currentRoom, meId) !== true
    ) {
      return;
    }

    const modal = document.getElementById("chatCompleteModal");
    const title = document.getElementById("chatCompleteTitle");
    const body = document.getElementById("chatCompleteBody");
    const submitBtn = document.getElementById("chatCompleteSubmit");
    const flowRoom = resolveFlowRoom(currentRoom);
    const labels = getFlowLabels(flowRoom);
    const purchaseCopy =
      window.TasuPlatformChatPurchasePaymentFlow?.getCopy?.(flowRoom) || {};
    if (!modal) return;
    if (mode === "ship") {
      if (requiresShipInputForm(flowRoom)) {
        if (title) {
          title.textContent = purchaseCopy.shipFormTitle || labels.sellerModalTitle || "発送情報の入力";
        }
        setCompleteModalShipFormVisible(true);
        if (body) body.textContent = "";
        if (submitBtn) {
          submitBtn.textContent = purchaseCopy.shipConfirmSubmitBtn || "発送を確定する";
        }
        const carrierInput = document.getElementById("chatShipCarrier");
        const trackingInput = document.getElementById("chatShipTracking");
        if (carrierInput) {
          carrierInput.value = "";
          window.setTimeout(() => carrierInput.focus(), 0);
        }
        if (trackingInput) trackingInput.value = "";
      } else {
        resetShipInputForm();
        if (title) title.textContent = labels.sellerModalTitle || purchaseCopy.shipModalTitle || "発送完了";
        if (body) {
          body.hidden = false;
          body.textContent =
            labels.sellerConfirmBody ||
            purchaseCopy.shipConfirmBody ||
            "商品の発送が完了したことを相手に通知します。";
        }
        if (submitBtn) submitBtn.textContent = labels.sellerCompleteBtn || purchaseCopy.shipBtn || "発送完了";
      }
    } else if (mode === "purchase_shipping_ready") {
      if (title) title.textContent = purchaseCopy.shippingReadyBtn;
      if (body) body.textContent = purchaseCopy.shippingReadyConfirmBody;
      if (submitBtn) submitBtn.textContent = purchaseCopy.shippingReadyBtn;
    } else if (mode === "purchase_bank_report") {
      if (title) title.textContent = purchaseCopy.bankReportBtn;
      if (body) body.textContent = purchaseCopy.bankReportConfirmBody;
      if (submitBtn) submitBtn.textContent = purchaseCopy.bankReportBtn;
    } else if (mode === "purchase_payment_confirm") {
      if (title) title.textContent = purchaseCopy.paymentConfirmBtn;
      if (body) body.textContent = purchaseCopy.paymentConfirmBody;
      if (submitBtn) submitBtn.textContent = purchaseCopy.paymentConfirmBtn;
    } else if (mode === "purchase_receive") {
      if (title) title.textContent = purchaseCopy.receiveModalTitle;
      if (body) body.textContent = purchaseCopy.receiveConfirmBody;
      if (submitBtn) submitBtn.textContent = purchaseCopy.receiveBtn;
    } else if (mode === "purchase_cod_report") {
      if (title) title.textContent = purchaseCopy.codReportBtn;
      if (body) body.textContent = purchaseCopy.codReportConfirmBody;
      if (submitBtn) submitBtn.textContent = purchaseCopy.codReportBtn;
    } else if (mode === "purchase_cod_confirm") {
      if (title) title.textContent = purchaseCopy.codConfirmBtn;
      if (body) body.textContent = purchaseCopy.codConfirmBody;
      if (submitBtn) submitBtn.textContent = purchaseCopy.codConfirmBtn;
    } else if (shouldUseWorkReportModal(flowRoom, mode)) {
      if (title) title.textContent = labels.modalTitle || "作業完了申請";
      if (body) {
        body.hidden = false;
        body.textContent =
          labels.confirmBody ||
          "作業完了を申請します。相手が承認すると取引が完了します。";
      }
      if (submitBtn) submitBtn.textContent = labels.submitLabel || "申請する";
      const contentInput = document.getElementById("chatWorkReportContent");
      if (contentInput) window.setTimeout(() => contentInput.focus(), 0);
    } else {
      if (title) title.textContent = labels.modalTitle;
      if (body) {
        body.hidden = false;
        body.textContent = labels.confirmBody;
      }
      if (submitBtn) submitBtn.textContent = labels.submitLabel;
    }
    syncCompleteModalPanels(flowRoom, mode);
    modal.hidden = false;
  }

  function resetReviewForm() {
    selectedReviewRating = 0;
    const comment = document.getElementById("chatReviewComment");
    if (comment) comment.value = "";
    document.querySelectorAll(".chat-review-star").forEach((el) => {
      el.classList.remove("chat-review-star--on");
      el.setAttribute("aria-pressed", "false");
    });
  }

  function setReviewRating(value) {
    selectedReviewRating = value;
    document.querySelectorAll(".chat-review-star").forEach((el) => {
      const star = Number(el.getAttribute("data-star"));
      const on = star <= value;
      el.classList.toggle("chat-review-star--on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function openReviewModal() {
    const modal = document.getElementById("chatReviewModal");
    const title = document.getElementById("chatReviewTitle");
    const sub = document.getElementById("chatReviewSub");
    const target = document.getElementById("chatReviewTarget");
    if (!modal) return;

    const meId = getMeId();
    const Category = window.TasuPlatformChatCategoryFlow;
    const reviewTarget =
      window.TasuPlatformChatJobFlow?.getJobReviewTargetUserId?.(currentRoom, meId) ||
      window.TasuPlatformChatReviewFlow?.getReviewTargetUserId?.(currentRoom, meId) ||
      "";
    if (
      Category?.hasUserSubmittedReview?.(currentRoom?.id, meId) ||
      window.TasuPlatformChatReviewFlow?.hasUserSubmittedReview?.(
        currentRoom?.id,
        meId,
        reviewTarget
      ) ||
      window.TasuPlatformChatJobFlow?.hasUserSubmittedReview?.(
        currentRoom?.id,
        meId,
        reviewTarget
      )
    ) {
      showReportToast("レビュー済み");
      return;
    }

    resetReviewForm();

    const sellerName =
      currentRoom?.partner?.displayName ||
      window.TasuChatReviews?.getSellerId?.(currentRoom) ||
      "出品者";

    const flow = getCompletionFlow();
    const labels = getFlowLabels(currentRoom);
    const reviewTitle =
      flow?.getReviewTitleForUser?.(currentRoom, getMeId()) || labels.reviewTitle;
    const reviewTargetLabel =
      flow?.getReviewTargetLabel?.(currentRoom, getMeId()) ||
      `評価対象：${sellerName}`;

    if (title) {
      title.textContent = reviewTitle;
    }
    if (sub) {
      sub.textContent = labels.reviewSub;
    }
    if (target) {
      target.textContent = reviewTargetLabel;
    }

    modal.hidden = false;
    const firstStar = modal.querySelector(".chat-review-star");
    if (firstStar) firstStar.focus();
  }

  function closeReviewModal() {
    const modal = document.getElementById("chatReviewModal");
    if (modal) modal.hidden = true;
    resetReviewForm();
  }

  async function submitReviewFlow(isSkipped) {
    const roomId = getActiveRoomId();
    if (!roomId || !currentRoom) return;
    const isJobRoom = window.TasuPlatformChatJobFlow?.isJobThread?.(currentRoom);

    const submitBtn = document.getElementById("chatReviewSubmit");
    const skipBtn = document.getElementById("chatReviewSkip");
    if (submitBtn) submitBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;

    const commentEl = document.getElementById("chatReviewComment");
    const res = await window.TasuChatService.submitReview({
      roomId,
      roomContext: currentRoom,
      rating: selectedReviewRating,
      comment: commentEl?.value || "",
      isSkipped,
    });

    if (submitBtn) submitBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;

    closeReviewModal();

    if (!res.ok) {
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "レビューの保存に失敗しました";
        errorEl.style.display = "block";
      }
      return;
    }

    const isPlatformRoom =
      window.TasuPlatformChatCategoryFlow?.isPlatformCompletionThread?.(currentRoom) === true;
    const reviewToast =
      window.TasuPlatformChatReviewFlow?.REVIEW_SUBMITTED_TOAST || "評価を送信しました";

    showReportToast(
      res.skipped
        ? isJobRoom
          ? "やりとりを完了しました（評価はスキップ）"
          : "取引を完了しました（レビューはスキップ）"
        : isJobRoom || isPlatformRoom
          ? reviewToast
          : "ありがとうございます。評価を保存しました"
    );

    try {
      const { messages } = await window.TasuChatService.loadMessages(roomId);
      displayMessages = messages;
    } catch {
      /* keep current list */
    }
    renderMessages(displayMessages);
  }

  function requiresShipInputForm(room) {
    return window.TasuPlatformChatPurchasePaymentFlow?.requiresShipInputForm?.(room) === true;
  }

  function resolveFlowRoom(room) {
    const direct = room || currentRoom;
    const id = pickStr(direct?.id, getActiveRoomId());
    const stored =
      id &&
      (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(id));
    // ThreadStore の roomStatus / status を優先（メモリ上の currentRoom が古いと完了後ボタンが残る）
    const merged = stored ? { ...(direct || {}), ...stored } : direct;
    let result = merged;
    if (result?.listingType || result?.listing_type || result?.dealId) {
      result =
        window.TasuPlatformChatDualWindowDemo?.normalizeThreadPartnerIdsForBench?.(result) ||
        result;
    }
    result = result || direct;
    return result;
  }

  function requiresWorkReportForm(room) {
    const target = resolveFlowRoom(room);
    return window.TasuPlatformChatCategoryFlow?.requiresWorkReportForm?.(target) === true;
  }

  function shouldUseWorkReportModal(room, mode) {
    if (mode !== "request") return false;
    const target = resolveFlowRoom(room);
    const Category = window.TasuPlatformChatCategoryFlow;
    if (!Category) return false;
    if (Category.isMarketplaceConnectEntryThread?.(target) === true) return false;
    const demoProfile = pickStr(new URLSearchParams(window.location.search).get("demoProfile"));
    if (demoProfile === "business") return true;
    if (demoProfile === "worker" && Category.isMarketplaceConnectEntryThread?.(target) !== true) {
      return true;
    }
    if (Category.isProductPurchaseFlowEnabled?.(target) === true) return false;
    if (Category.isProductFlowCategory?.(target) === true) return false;
    if (
      Category.isWorkerFlowCategory?.(target) === true ||
      Category.isBusinessServiceCategory?.(target) === true
    ) {
      return true;
    }
    if (requiresWorkReportForm(target)) return true;
    const dealId = pickStr(
      target?.dealId,
      new URLSearchParams(window.location.search).get("deal")
    );
    return window.TasuPlatformChatCompletion?.usesCompletionReportDealFlow?.(dealId) === true;
  }

  function setPanelVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? "" : "none";
  }

  function syncCompleteModalPanels(flowRoom, mode) {
    const useShip = mode === "ship" && requiresShipInputForm(flowRoom);
    const useWork = shouldUseWorkReportModal(flowRoom, mode);
    if (!useShip) {
      const carrier = document.getElementById("chatShipCarrier");
      const tracking = document.getElementById("chatShipTracking");
      if (carrier) carrier.value = "";
      if (tracking) tracking.value = "";
    }
    setCompleteModalShipFormVisible(useShip);
    setWorkReportFormVisible(useWork);
  }

  function setWorkReportFormVisible(visible) {
    const form = document.getElementById("chatWorkReportForm");
    const err = document.getElementById("chatWorkReportFormError");
    setPanelVisible(form, visible);
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
  }

  function resetWorkReportForm() {
    const content = document.getElementById("chatWorkReportContent");
    const photos = document.getElementById("chatWorkReportPhotos");
    const memo = document.getElementById("chatWorkReportMemo");
    if (content) content.value = "";
    if (photos) photos.value = "";
    if (memo) memo.value = "";
    setWorkReportFormVisible(false);
  }

  function readWorkReportPhotoSummary() {
    const input = document.getElementById("chatWorkReportPhotos");
    if (!input?.files?.length) return "";
    const names = [...input.files].map((f) => pickStr(f.name)).filter(Boolean);
    return names.length ? `写真${names.length}点（${names.slice(0, 3).join("、")}${names.length > 3 ? " ほか" : ""}）` : "";
  }

  function syncPurchasePaymentMethodForRoom(threadOrId) {
    const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
    if (!Purchase?.syncPaymentMethodFromContext) return null;
    const threadId = pickStr(
      typeof threadOrId === "string" ? threadOrId : threadOrId?.id,
      getActiveRoomId()
    );
    const thread =
      typeof threadOrId === "object" && threadOrId
        ? threadOrId
        : (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === threadId);
    return Purchase.syncPaymentMethodFromContext({ threadId, thread });
  }

  function setCompleteModalShipFormVisible(visible) {
    const form = document.getElementById("chatShipForm");
    const body = document.getElementById("chatCompleteBody");
    const err = document.getElementById("chatShipFormError");
    setPanelVisible(form, visible);
    if (body) body.hidden = visible;
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
  }

  function resetShipInputForm() {
    const carrier = document.getElementById("chatShipCarrier");
    const tracking = document.getElementById("chatShipTracking");
    if (carrier) carrier.value = "";
    if (tracking) tracking.value = "";
    setCompleteModalShipFormVisible(false);
  }

  function closeCompleteModal() {
    const modal = document.getElementById("chatCompleteModal");
    if (modal) modal.hidden = true;
    resetShipInputForm();
    resetWorkReportForm();
  }

  async function onCompleteSubmit() {
    const roomId = getActiveRoomId();
    const submitBtn = document.getElementById("chatCompleteSubmit");
    const openBtn = document.getElementById("chatCompleteBtn");
    const flow = getCompletionFlow();
    const meId = getMeId();
    const mode =
      openBtn?.getAttribute("data-primary-action") ||
      flow?.getPrimaryActionMode?.(currentRoom, meId) ||
      window.TasuPlatformChatCategoryFlow?.getPrimaryActionMode?.(currentRoom, meId) ||
      "request";
    if (!roomId) return;

    if (submitBtn) submitBtn.disabled = true;
    const Purchase = window.TasuPlatformChatPurchasePaymentFlow;
    const purchaseRes =
      mode === "purchase_shipping_ready"
        ? Purchase?.markShippingReady?.({ threadId: roomId, thread: currentRoom, userId: meId })
        : mode === "purchase_bank_report"
          ? Purchase?.reportBankTransfer?.({ threadId: roomId, thread: currentRoom, userId: meId })
          : mode === "purchase_payment_confirm"
            ? Purchase?.confirmBankPayment?.({ threadId: roomId, thread: currentRoom, userId: meId })
            : mode === "purchase_receive"
              ? Purchase?.markProductReceived?.({ threadId: roomId, thread: currentRoom, userId: meId })
              : mode === "purchase_cod_report"
                ? Purchase?.reportCodPayment?.({ threadId: roomId, thread: currentRoom, userId: meId })
                : mode === "purchase_cod_confirm"
                  ? Purchase?.confirmCodCollection?.({ threadId: roomId, thread: currentRoom, userId: meId })
                  : null;
    if (purchaseRes) {
      if (submitBtn) submitBtn.disabled = false;
      closeCompleteModal();
      if (!purchaseRes.ok) {
        const errorEl = document.getElementById("chatInlineError");
        if (errorEl) {
          errorEl.textContent = purchaseRes.reason || "処理に失敗しました";
          errorEl.style.display = "block";
        }
        return;
      }
      await applyFlowActionImmediate(purchaseRes, {
        roomId,
        phase: `purchase_${mode}`,
        reason: `purchase_${mode}`,
        scrollToCompletionCard: mode === "purchase_receive",
      });
      const toastMap = {
        purchase_shipping_ready: "発送準備完了を通知しました",
        purchase_bank_report: "銀行振込が完了しました",
        purchase_payment_confirm: "入金を確認しました",
        purchase_receive: "受取確認が完了しました",
        purchase_cod_report: "受取・支払いを報告しました",
        purchase_cod_confirm: "代引き回収を確認しました",
      };
      showReportToast(toastMap[mode] || "処理が完了しました");
      return;
    }
    const res =
      mode === "job_end_confirm"
        ? window.TasuPlatformChatJobFlow?.confirmJobEndFromApplicant?.({
            threadId: roomId,
            thread: currentRoom,
            userId: meId,
          }) || { ok: false, reason: "job_end_confirm_unavailable" }
        : mode === "job_end_request"
          ? window.TasuPlatformChatJobFlow?.requestJobConversationEnd?.({
              threadId: roomId,
              thread: currentRoom,
              userId: meId,
            }) || { ok: false, reason: "job_end_request_unavailable" }
          : mode === "ship" && flow?.markProductShipped
          ? (() => {
              const shipPayload = {
                threadId: roomId,
                thread: currentRoom,
                userId: meId,
              };
              if (requiresShipInputForm(currentRoom)) {
                const carrier = pickStr(document.getElementById("chatShipCarrier")?.value);
                const tracking = pickStr(document.getElementById("chatShipTracking")?.value);
                const errEl = document.getElementById("chatShipFormError");
                if (!carrier) {
                  if (errEl) {
                    errEl.textContent = "配送会社を入力してください";
                    errEl.hidden = false;
                  }
                  if (submitBtn) submitBtn.disabled = false;
                  return { ok: false, reason: "配送会社を入力してください" };
                }
                shipPayload.carrier = carrier;
                shipPayload.tracking = tracking;
              }
              return flow.markProductShipped(shipPayload);
            })()
          : flow?.requestCompletion
            ? (() => {
                const payload = {
                  threadId: roomId,
                  thread: currentRoom,
                  userId: meId,
                  userName: getMeDisplayName(currentRoom),
                };
                if (shouldUseWorkReportModal(currentRoom, mode)) {
                  const content = pickStr(document.getElementById("chatWorkReportContent")?.value);
                  const errEl = document.getElementById("chatWorkReportFormError");
                  if (!content) {
                    if (errEl) {
                      errEl.textContent = "報告内容を入力してください";
                      errEl.hidden = false;
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    return { ok: false, reason: "報告内容を入力してください" };
                  }
                  payload.submittedContent = content;
                  payload.attachments = pickStr(readWorkReportPhotoSummary(), "—");
                  payload.confirmMemo = pickStr(document.getElementById("chatWorkReportMemo")?.value);
                }
                return flow.requestCompletion(payload);
              })()
            : { ok: false };
    if (submitBtn) submitBtn.disabled = false;
    const keepShipModalOpen =
      mode === "ship" && requiresShipInputForm(currentRoom) && res?.ok !== true;
    const keepWorkModalOpen =
      shouldUseWorkReportModal(currentRoom, mode) && res?.ok !== true;
    if (!keepShipModalOpen && !keepWorkModalOpen) {
      closeCompleteModal();
    }

    if (!res.ok) {
      if (keepShipModalOpen) {
        const errEl = document.getElementById("chatShipFormError");
        if (errEl) {
          errEl.textContent = res.reason || "発送を確定できませんでした";
          errEl.hidden = false;
        }
        return;
      }
      if (keepWorkModalOpen) {
        const errEl = document.getElementById("chatWorkReportFormError");
        if (errEl) {
          errEl.textContent = res.reason || "申請できませんでした";
          errEl.hidden = false;
        }
        return;
      }
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent =
          res.reason ||
          (mode === "job_end_confirm"
            ? "やり取りを完了できませんでした"
            : mode === "job_end_request"
              ? "終了依頼を送信できませんでした"
              : "完了申請に失敗しました");
        errorEl.style.display = "block";
      }
      return;
    }

    const shipLabels = getFlowLabels(resolveFlowRoom(currentRoom));
    await applyFlowActionImmediate(res, {
      roomId,
      phase: mode,
      reason: mode,
      scrollToCompletionCard: false,
    });
    if (mode === "ship" && res.ok) {
      showReportToast(pickStr(shipLabels.shipSystem, "発送を通知しました"));
      return;
    }
    if (mode === "job_end_confirm" || mode === "job_end_request") {
      try {
        window.parent?.postMessage?.({ type: "tasu-chat-reload-room", threadId: roomId }, "*");
      } catch {
        /* ignore */
      }
    }
    showReportToast(
      mode === "job_end_confirm"
        ? "やり取りを完了しました"
        : mode === "job_end_request"
          ? "終了依頼を送信しました"
          : "完了を申請しました。相手の承認をお待ちください。"
    );
  }

  async function onApproveCompleteSubmit(triggerBtn) {
    const roomId =
      pickStr(
        getActiveRoomId(),
        triggerBtn?.closest?.("[data-connect-pending-card]")?.getAttribute?.("data-thread-id"),
        new URL(location.href).searchParams.get("thread")
      );
    const flow = getCompletionFlow();
    const headerApproveBtn = document.getElementById("chatApproveCompleteBtn");
    const cardApproveBtn =
      triggerBtn?.matches?.("[data-connect-complete-approve]") ? triggerBtn : null;
    const primaryApproveBtn =
      triggerBtn?.getAttribute?.("data-primary-action") === "approve" ? triggerBtn : null;
    const approveBtn = cardApproveBtn || primaryApproveBtn || headerApproveBtn;

    if (!roomId) {
      showFlowInlineError("チャットルームを特定できませんでした");
      return;
    }
    if (!flow?.approveCompletion) {
      console.warn("[TasuChat] TasuPlatformChatCompletionFlow.approveCompletion is unavailable");
      showFlowInlineError("承認処理を読み込めませんでした。ページを再読み込みしてください。");
      return;
    }

    const thread =
      flow.readThread?.(roomId) ||
      currentRoom ||
      (window.TasuChatThreadStore?.readAll?.() || []).find((t) => String(t.id) === String(roomId));

    if (approveBtn) {
      if (approveBtn.disabled || approveBtn.dataset.tasuApproveSubmitting === "1") return;
      approveBtn.dataset.tasuApproveSubmitting = "1";
      approveBtn.disabled = true;
    }
    setFlowActionPending(true);
    let res;
    try {
      res = flow.approveCompletion({
        threadId: roomId,
        thread,
        userId: getMeId(),
      });
    } catch (err) {
      setFlowActionPending(false);
      if (approveBtn) {
        approveBtn.disabled = false;
        delete approveBtn.dataset.tasuApproveSubmitting;
      }
      showFlowInlineError(String(err?.message || err || "承認に失敗しました"));
      return;
    }

    if (!res.ok) {
      setFlowActionPending(false);
      if (approveBtn) {
        approveBtn.disabled = false;
        delete approveBtn.dataset.tasuApproveSubmitting;
      }
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "承認に失敗しました";
        errorEl.style.display = "block";
      }
      return;
    }

    if (res.thread) {
      applyCurrentRoom(res.thread, roomId, displayMessages);
    } else if (currentRoom && !res.awaitingPayment) {
      currentRoom.roomStatus = "completed";
      currentRoom.status = "completed";
    }

    if (approveBtn) delete approveBtn.dataset.tasuApproveSubmitting;

    if (res.awaitingPayment) {
      await applyFlowActionImmediate(res, {
        roomId,
        phase: "approve_awaiting_payment",
        reason: "approve_awaiting_payment",
        teardownRealtime: false,
      });
      showReportToast("承認しました。お支払い先をご確認ください。");
      const payCard = document.querySelector("[data-manual-transfer-card]");
      if (payCard) payCard.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    await applyFlowActionImmediate(res, {
      roomId,
      phase: "approve_complete",
      reason: "approve_complete",
      scrollToCompletionCard: true,
    });

    const labels = getFlowLabels(currentRoom);
    showReportToast(labels.completedNotice);
  }

  function bindReviewUi() {
    if (reviewUiBound) return;
    reviewUiBound = true;

    const modal = document.getElementById("chatReviewModal");
    const skipBtn = document.getElementById("chatReviewSkip");
    const submitBtn = document.getElementById("chatReviewSubmit");

    document.querySelectorAll(".chat-review-star").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = Number(btn.getAttribute("data-star"));
        if (value >= 1 && value <= 5) setReviewRating(value);
      });
    });

    if (skipBtn) {
      skipBtn.textContent =
        window.TasuChatReviews?.REVIEW_SKIP_LABEL || "スキップして完了";
      skipBtn.addEventListener("click", () => submitReviewFlow(true));
    }
    if (submitBtn) {
      submitBtn.textContent =
        window.TasuChatReviews?.REVIEW_SUBMIT_LABEL || "評価を送る";
      submitBtn.addEventListener("click", () => submitReviewFlow(false));
    }
    if (modal) {
      modal.querySelectorAll("[data-review-close]").forEach((el) => {
        el.addEventListener("click", closeReviewModal);
      });
    }

    const messagesWrap = document.getElementById("chatMessages");
    if (messagesWrap) {
      messagesWrap.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-platform-review-open], [data-platform-job-review-open]");
        if (!btn) return;
        ev.preventDefault();
        openReviewModal();
      });
    }
  }

  function hasReviewAutoOpenIntent() {
    const params = new URLSearchParams(window.location.search);
    return ["1", "true"].includes(
      pickStr(params.get("openReview"), params.get("reviewOpen")).toLowerCase()
    );
  }

  function isReviewNotifyEntry() {
    const params = new URLSearchParams(window.location.search);
    return pickStr(params.get("from")).toLowerCase() === "notify";
  }

  function hasReviewViewIntent() {
    const params = new URLSearchParams(window.location.search);
    return ["1", "true"].includes(pickStr(params.get("openReviews")).toLowerCase());
  }

  function bindReviewViewUi() {
    if (reviewViewUiBound) return;
    reviewViewUiBound = true;
    const modal = document.getElementById("chatReviewViewModal");
    if (!modal) return;
    modal.querySelectorAll("[data-review-view-close]").forEach((el) => {
      el.addEventListener("click", closeReceivedReviewViewModal);
    });
  }

  function closeReceivedReviewViewModal() {
    const modal = document.getElementById("chatReviewViewModal");
    if (modal) modal.hidden = true;
  }

  function openReceivedReviewViewModal(reviewRow, options) {
    const modal = document.getElementById("chatReviewViewModal");
    if (!modal || !reviewRow) return false;
    if (reviewRow.is_skipped === true) return false;

    const Review = window.TasuPlatformChatReviewFlow;
    const reviewerId = pickStr(reviewRow.reviewer_id);
    const reviewerName =
      Review?.formatReviewerDisplayName?.(reviewerId, currentRoom) ||
      pickStr(options?.reviewerName, "相手");

    const titleEl = document.getElementById("chatReviewViewTitle");
    const subEl = document.getElementById("chatReviewViewSub");
    const starsEl = document.getElementById("chatReviewViewStars");
    const commentEl = document.getElementById("chatReviewViewComment");
    if (titleEl) titleEl.textContent = "届いた評価";
    if (subEl) subEl.textContent = `${reviewerName}さんからの評価`;
    const rating = Number(reviewRow.rating) || 0;
    if (starsEl) {
      starsEl.innerHTML = [1, 2, 3, 4, 5]
        .map((star) => {
          const on = star <= rating;
          return `<span class="chat-review-star${on ? " chat-review-star--on" : ""}" aria-hidden="true">★</span>`;
        })
        .join("");
      starsEl.setAttribute("aria-label", rating > 0 ? `評価 ${rating} / 5` : "評価なし");
    }
    const comment = pickStr(reviewRow.comment);
    if (commentEl) {
      commentEl.textContent = comment || "（コメントなし）";
      commentEl.hidden = false;
    }

    modal.hidden = false;
    const closeBtn = modal.querySelector("[data-review-view-close].chat-report-btn");
    if (closeBtn) closeBtn.focus();
    return true;
  }

  function stripReviewViewParamsFromUrl() {
    try {
      const u = new URL(window.location.href);
      if (
        !u.searchParams.has("openReviews") &&
        !u.searchParams.has("reviewerId")
      ) {
        return;
      }
      u.searchParams.delete("openReviews");
      u.searchParams.delete("reviewerId");
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* ignore */
    }
  }

  function tryOpenReviewsFromNotify(options) {
    if (reviewViewAutoOpenConsumed) {
      return { ok: true, skipped: "already_opened" };
    }
    if (!hasReviewViewIntent()) {
      return { ok: false, reason: "no_intent" };
    }

    const opts = options || {};
    const phase = pickStr(opts.phase, "unknown");
    const params = new URLSearchParams(window.location.search);
    const meId = getMeId();
    const threadId = pickStr(params.get("thread"), getActiveRoomId(), opts.threadId);
    const reviewerId = pickStr(params.get("reviewerId"), opts.reviewerId);
    let thread =
      currentRoom && pickStr(currentRoom.id) === threadId
        ? currentRoom
        : resolveThreadForReviewAutoOpen(threadId, meId);
    if (!thread && opts.thread) thread = opts.thread;
    if (!thread) return { ok: false, reason: "no_thread", phase };

    ensureCurrentRoomForReview(thread, threadId, meId);

    const Review = window.TasuPlatformChatReviewFlow;
    const reviewRow = Review?.findReceivedReview?.(threadId, meId, reviewerId);
    if (!reviewRow) return { ok: false, reason: "no_review", phase };

    bindReviewViewUi();
    const modal = document.getElementById("chatReviewViewModal");
    if (!modal) return { ok: false, reason: "no_modal", phase };
    if (!modal.hidden) {
      reviewViewAutoOpenConsumed = true;
      stripReviewViewParamsFromUrl();
      return { ok: true, skipped: "already_visible", phase };
    }

    openReceivedReviewViewModal(reviewRow, { reviewerName: opts.reviewerName });
    reviewViewAutoOpenConsumed = true;
    stripReviewViewParamsFromUrl();
    return { ok: true, phase };
  }

  function readReviewNotifyClickWall() {
    return window.TasuPlatformChatReviewFlow?.readReviewNotifyClickWall?.() || 0;
  }

  function logReviewAutoOpen(step, extra) {
    const notifyClickWall = readReviewNotifyClickWall();
    const nowWall = Date.now();
    const loadWall = chatDetailLoadWallMs || nowWall;
    const entry = {
      step,
      notifyClickWall,
      chatDetailLoadWall: loadWall,
      sinceNotifyClickMs: notifyClickWall > 0 ? nowWall - notifyClickWall : null,
      sinceChatDetailLoadMs: loadWall > 0 ? nowWall - loadWall : null,
      ...(extra && typeof extra === "object" ? extra : {}),
    };
    if (!window.__reviewAutoOpenLog) window.__reviewAutoOpenLog = [];
    window.__reviewAutoOpenLog.push(entry);
    console.info("[TasuChat][review-auto-open]", entry);
  }

  function resolveThreadForReviewAutoOpen(threadId, meId) {
    const id = pickStr(threadId, getActiveRoomId());
    if (!id) return null;
    const store = window.TasuChatThreadStore;
    if (store?.loadRoom) {
      const loaded = store.loadRoom(id, { viewerUserId: meId });
      if (loaded?.thread) return applyReviewNotifyDemoCompletion(loaded.thread);
    }
    const all = store?.readAll?.() || [];
    const found = all.find((t) => String(t.id) === String(id)) || null;
    return found ? applyReviewNotifyDemoCompletion(found) : null;
  }

  function applyReviewNotifyDemoCompletion(thread) {
    if (!thread || !isReviewNotifyEntry()) return thread;
    const demoState = pickStr(new URLSearchParams(window.location.search).get("demoState")).toLowerCase();
    if (demoState !== "completed") return thread;
    const Job = window.TasuPlatformChatJobFlow;
    if (Job?.isJobThread?.(thread) !== true) return thread;
    const rs = pickStr(thread?.roomStatus, thread?.status).toLowerCase();
    if (rs === "closed" || rs === "completed" || thread?.completed === true) return thread;
    const patched = {
      ...thread,
      roomStatus: "closed",
      status: "closed",
      completed: true,
      completedAt: pickStr(thread?.completedAt) || new Date().toISOString(),
    };
    const store = window.TasuChatThreadStore;
    const threadId = pickStr(patched.id);
    if (store?.readAll && store?.writeAll && threadId) {
      const list = store.readAll().map((row) =>
        String(row.id) === threadId ? { ...row, ...patched } : row
      );
      store.writeAll(list);
    }
    return patched;
  }

  function ensureCurrentRoomForReview(thread, threadId, meId) {
    const id = pickStr(thread?.id, threadId);
    if (!id || !thread) return null;
    if (!currentRoom || pickStr(currentRoom.id) !== id) {
      currentRoom =
        window.TasuChatThreadStore?.applyViewerToThread?.(thread, meId) || thread;
      activeRoomId = id;
    }
    return currentRoom;
  }

  function stripReviewAutoOpenParamsFromUrl() {
    try {
      const u = new URL(window.location.href);
      if (!u.searchParams.has("openReview") && !u.searchParams.has("reviewOpen")) return;
      u.searchParams.delete("openReview");
      u.searchParams.delete("reviewOpen");
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* ignore */
    }
  }

  function tryOpenReviewFromNotify(options) {
    const opts = options || {};
    if (opts.forceRetry === true) {
      reviewAutoOpenConsumed = false;
    }
    if (reviewAutoOpenConsumed) {
      return { ok: true, skipped: "already_opened" };
    }
    const Review = window.TasuPlatformChatReviewFlow;
    if (!Review?.shouldAutoOpenReviewFromContext || !hasReviewAutoOpenIntent()) {
      return { ok: false, reason: "no_intent" };
    }

    const phase = pickStr(opts.phase, "unknown");
    logReviewAutoOpen("openReview_param_detected", { phase });

    const params = new URLSearchParams(window.location.search);
    const meId = getMeId();
    const threadId = pickStr(params.get("thread"), getActiveRoomId(), opts.threadId);
    if (
      pickStr(params.get("review")).toLowerCase() === "job-full" &&
      window.TasuPlatformChatJobFullDemo?.ensureJobFullFlowDemo
    ) {
      window.TasuPlatformChatJobFullDemo.ensureJobFullFlowDemo({ force: true });
    }
    let thread =
      currentRoom && pickStr(currentRoom.id) === threadId
        ? currentRoom
        : resolveThreadForReviewAutoOpen(threadId, meId);
    if (!thread && opts.thread) thread = opts.thread;
    if (thread) {
      thread = bootstrapConnectEntryFromUrl(thread);
    }
    thread = thread ? resolveReviewPromptThread(thread, meId) : null;

    logReviewAutoOpen("room_resolved", {
      phase,
      threadId: pickStr(thread?.id, threadId),
      hasThread: Boolean(thread),
    });
    if (!thread) return { ok: false, reason: "no_thread", phase };

    ensureCurrentRoomForReview(thread, threadId, meId);

    const canOpen = Review.shouldAutoOpenReviewFromContext(params, thread, meId) === true;
    logReviewAutoOpen("shouldAutoOpenReview_result", { phase, canOpen });
    if (!canOpen) return { ok: false, reason: "not_eligible", phase };

    bindReviewUi();
    const modal = document.getElementById("chatReviewModal");
    if (!modal) return { ok: false, reason: "no_modal", phase };
    if (!modal.hidden) {
      reviewAutoOpenConsumed = true;
      stripReviewAutoOpenParamsFromUrl();
      return { ok: true, skipped: "already_visible", phase };
    }

    openReviewModal();
    reviewAutoOpenConsumed = true;
    logReviewAutoOpen("openReviewModal_called", { phase });
    stripReviewAutoOpenParamsFromUrl();
    return { ok: true, phase };
  }

  function maybeAutoOpenReviewModalFromNotify() {
    return tryOpenReviewFromNotify({ phase: "maybeAutoOpen" });
  }

  let crossWindowSyncBound = false;
  let reloadRoomStateTimer = 0;

  function setFlowActionPending(active) {
    const root = document.documentElement;
    if (!root) return;
    if (active) {
      root.dataset.tasuFlowActionPending = "1";
    } else {
      delete root.dataset.tasuFlowActionPending;
    }
  }

  function scheduleReloadRoomStateFromStore() {
    if (document.documentElement?.dataset?.tasuFlowActionPending === "1") return;
    if (reloadRoomStateTimer) clearTimeout(reloadRoomStateTimer);
    reloadRoomStateTimer = window.setTimeout(() => {
      reloadRoomStateTimer = 0;
      if (document.documentElement?.dataset?.tasuFlowActionPending === "1") return;
      void reloadRoomStateFromStore();
    }, 400);
  }

  function renderRoomMessagesOrGate(room, messages) {
    const Gate = window.TasuPlatformChatContactGate;
    const roomId = getActiveRoomId();
    const migrated = Gate?.migrateThreadPhase?.(roomId, room) || room;
    if (currentRoom && migrated && migrated !== currentRoom) {
      Object.assign(currentRoom, migrated);
    }
    const target = migrated || room;
    if (enforceManagementRedirect(target)) return true;

    const messagesEl = document.getElementById("chatMessages");
    if (messagesEl) {
      delete messagesEl.dataset.contactGateActive;
    }
    syncDisplayMessages(messages);
    return false;
  }

  function ensureCompletionPendingApprovalCard(thread) {
    const Connect = window.TasuPlatformChatConnectChatFlow;
    const Completion = window.TasuPlatformChatCompletionFlow;
    if (!thread?.id || !Connect || !Completion) return false;
    if (Connect.shouldUseConnectCompletionUi?.(thread) !== true) return false;
    if (Completion.getCompletionStatus?.(thread) !== "completion_pending") return false;
    const result = Connect.appendPendingApprovalCard?.(thread.id, thread);
    return result?.ok === true && result?.skipped !== true;
  }

  function syncFlowCardsFromStore(thread) {
    let changed = false;
    const Category = window.TasuPlatformChatCategoryFlow;
    const Completion = window.TasuPlatformChatCompletionFlow;
    if (ensureCompletionPendingApprovalCard(thread)) changed = true;
    if (window.TasuPlatformChatManualTransferFlow?.syncManualTransferCards?.(thread)) {
      changed = true;
    }
    if (window.TasuPlatformChatPurchasePaymentFlow?.syncPurchaseBankTransferCards?.(thread)) {
      changed = true;
    }
    if (window.TasuPlatformChatPurchasePaymentFlow?.syncPurchaseBankDepositConfirmCards?.(thread)) {
      changed = true;
    }
    if (window.TasuPlatformChatPurchasePaymentFlow?.syncProductShippingCards?.(thread)) {
      changed = true;
    }
    if (
      Category?.isMarketplaceConnectEntryThread?.(thread) === true &&
      thread?.productShipped === true &&
      Completion?.getCompletionStatus?.(thread) === "completion_pending"
    ) {
      const confirmRes = Category.appendMarketplaceConnectConfirmCard?.(thread.id, thread);
      if (confirmRes?.ok === true && confirmRes?.skipped !== true) changed = true;
    }
    if (Completion?.getCompletionStatus?.(thread) === "completed") {
      const completionRes = Category?.appendPlatformCompletionCard?.(thread.id, thread);
      if (completionRes?.ok === true && completionRes?.skipped !== true) changed = true;
    }
    return changed;
  }

  async function reloadRoomStateFromStore() {
    if (document.documentElement?.dataset?.tasuFlowActionPending === "1") return;
    const roomId = getActiveRoomId();
    if (!roomId) return;
    try {
      syncPurchasePaymentMethodForRoom(roomId);
      let { thread, messages } = await window.TasuChatService.loadMessages(roomId);
      const paymentSync = syncPurchasePaymentMethodForRoom(thread || roomId);
      if (paymentSync?.changed) {
        ({ thread, messages } = await window.TasuChatService.loadMessages(roomId));
      }
      if (!thread) return;
      if (syncFlowCardsFromStore(thread)) {
        ({ messages } = await window.TasuChatService.loadMessages(roomId));
      }
      if (enforceManagementRedirect(thread)) return;
      applyCurrentRoom(thread, roomId, displayMessages);
      const gated = renderRoomMessagesOrGate(currentRoom || thread, messages);
      if (!gated) {
        await ensurePreChatStartFeeUi(currentRoom || thread);
      }
      setHeader(currentRoom);
      updateCompleteButton(currentRoom);
      applyRoomComposerState();
      if (shouldSuppressBenchAutoScrollBottom()) {
        restoreBenchEmbedScrollPosition();
      } else {
        scrollToBottomAfterPaint();
      }
      maybeAutoOpenReviewModalFromNotify();
    } catch (err) {
      console.warn("[TasuChat] reloadRoomStateFromStore failed:", err);
    }
  }

  function bindContactGateUi() {
    installFlowCardDocumentBridge();
    ensureFlowCardActionBindings();
    window.__tasuChatDetailReload = (detail) => {
      if (detail?.thread && currentRoom) {
        Object.assign(currentRoom, detail.thread);
      } else if (detail?.ok && detail?.thread) {
        Object.assign(currentRoom || {}, detail.thread);
      } else if (detail?.activated && currentRoom) {
        currentRoom.status = "open";
        currentRoom.roomStatus = "active";
      }
      void reloadRoomStateFromStore();
    };
    if (document.body.dataset.contactGateUiBound === "1") return;
    document.body.dataset.contactGateUiBound = "1";
    document.addEventListener("tasu:contact-gate-changed", (ev) => {
      const res = ev?.detail;
      if (!res?.ok) return;
      if (currentRoom && res.thread) {
        Object.assign(currentRoom, res.thread);
      } else if (currentRoom && res.activated) {
        currentRoom.status = "open";
        currentRoom.roomStatus = "active";
      }
      void reloadRoomStateFromStore();
    });
  }

  function bindCrossWindowSync() {
    if (crossWindowSyncBound) return;
    crossWindowSyncBound = true;

    const store = window.TasuChatThreadStore;
    const manualKey = window.TasuPlatformChatManualTransferFlow?.STORAGE_KEY;
    const keys = new Set(
      ["tasful_chat_threads", "tasful_chat_messages", store?.STORAGE_KEY, store?.MESSAGES_KEY, manualKey].filter(
        Boolean
      )
    );

    window.addEventListener("storage", (ev) => {
      if (!ev.key || !keys.has(ev.key)) return;
      scheduleReloadRoomStateFromStore();
    });
    document.addEventListener("tasful-chat-threads-changed", () => {
      scheduleReloadRoomStateFromStore();
    });
    document.addEventListener("tasful-manual-transfer-changed", () => {
      scheduleReloadRoomStateFromStore();
    });
  }

  function bindCompleteUi() {
    if (completeUiBound) return;
    completeUiBound = true;

    const openBtn = document.getElementById("chatCompleteBtn");
    const jobEndBarBtn = document.getElementById("chatJobEndBarBtn");
    const approveBtn = document.getElementById("chatApproveCompleteBtn");
    const reviewBarBtn = document.getElementById("chatReviewBarBtn");
    const submitBtn = document.getElementById("chatCompleteSubmit");
    const modal = document.getElementById("chatCompleteModal");

    const onJobOrCompleteClick = (btn) => {
      if (!btn || btn.disabled || btn.hidden) return;
      const mode = btn.getAttribute("data-primary-action") || "request";
      if (mode === "approve") {
        void onApproveCompleteSubmit(btn);
        return;
      }
      if (
        mode === "job_end_confirm" ||
        mode === "job_end_request" ||
        mode === "ship" ||
        mode === "request" ||
        mode === "purchase_shipping_ready" ||
        mode === "purchase_bank_report" ||
        mode === "purchase_payment_confirm" ||
        mode === "purchase_receive" ||
        mode === "purchase_cod_report" ||
        mode === "purchase_cod_confirm"
      ) {
        openCompleteModal();
      }
    };

    const cancelRequestBtn = document.getElementById("chatCancelRequestBtn");
    const cancelRespondApproveBtn = document.getElementById("chatCancelRespondApproveBtn");
    const cancelRespondRejectBtn = document.getElementById("chatCancelRespondRejectBtn");
    if (cancelRequestBtn) {
      cancelRequestBtn.addEventListener("click", () => {
        if (cancelRequestBtn.disabled || cancelRequestBtn.hidden) return;
        openCancelModal("request");
      });
    }
    if (cancelRespondApproveBtn) {
      cancelRespondApproveBtn.addEventListener("click", () => {
        if (cancelRespondApproveBtn.disabled || cancelRespondApproveBtn.hidden) return;
        void onCancelRespondApprove();
      });
    }
    if (cancelRespondRejectBtn) {
      cancelRespondRejectBtn.addEventListener("click", () => {
        if (cancelRespondRejectBtn.disabled || cancelRespondRejectBtn.hidden) return;
        void onCancelRespondReject();
      });
    }

    if (openBtn) {
      openBtn.addEventListener("click", () => onJobOrCompleteClick(openBtn));
    }
    if (jobEndBarBtn) {
      jobEndBarBtn.addEventListener("click", () => onJobOrCompleteClick(jobEndBarBtn));
    }
    if (approveBtn) {
      approveBtn.addEventListener("click", () => {
        if (approveBtn.disabled || approveBtn.hidden) return;
        void onApproveCompleteSubmit(approveBtn);
      });
    }
    if (reviewBarBtn) {
      reviewBarBtn.addEventListener("click", () => openReviewModal());
    }
    if (submitBtn) submitBtn.addEventListener("click", onCompleteSubmit);
    if (modal) {
      modal.querySelectorAll("[data-complete-close]").forEach((el) => {
        el.addEventListener("click", closeCompleteModal);
      });
    }

    bindCancelModalUi();
    bindOverflowMenuUi();
    ensureFlowCardActionBindings();
    bindStartFeeCardActions();
  }

  function bindStartFeeCardActions() {
    const wrap = document.getElementById("chatMessages");
    if (!wrap || wrap.dataset.startFeeBound === "1") return;
    wrap.dataset.startFeeBound = "1";
    wrap.addEventListener("click", (ev) => {
      const payBtn = ev.target.closest("[data-start-fee-pay]");
      if (!payBtn) return;
      if (window.TasuPlatformChatContactGate?.shouldBlockChatDetailAccess?.(currentRoom)) {
        enforceManagementRedirect(currentRoom);
        return;
      }
      ev.preventDefault();
      const flow = window.TasuPlatformChatStartFeeCard;
      const roomId = getActiveRoomId();
      if (!flow?.completeStartFeePayment || !roomId) return;
      payBtn.disabled = true;
      const res = flow.completeStartFeePayment({
        threadId: roomId,
        thread: currentRoom,
        userId: getMeId(),
      });
      if (!res?.ok) {
        payBtn.disabled = false;
        const errorEl = document.getElementById("chatInlineError");
        if (errorEl) {
          errorEl.textContent = "お支払いを完了できませんでした";
          errorEl.style.display = "block";
        }
        return;
      }
      if (currentRoom) {
        currentRoom.status = "open";
        currentRoom.roomStatus = "active";
      }
      void reloadRoomStateFromStore();
    });
  }

  async function ensurePreChatStartFeeUi(room) {
    const Gate = window.TasuPlatformChatContactGate;
    if (Gate?.shouldBlockChatDetailAccess?.(room)) return;
    const StartFee = window.TasuPlatformChatStartFeeCard;
    const roomId = getActiveRoomId();
    if (!room || !roomId || !StartFee?.ensureCardMessages) return;
    if (!StartFee.isAwaitingStartFee?.(room)) return;
    const listing = room?.listing || {
      id: room?.listingId,
      listing_type: room?.listingType,
      title: room?.listingTitle,
    };
    StartFee.ensureCardMessages(roomId, room, listing);
    await refreshMessagesAfterFlow(roomId);
  }

  let cancelModalBound = false;

  let cancelModalMode = "immediate";

  function openCancelModal(mode) {
    const modal = document.getElementById("chatCancelModal");
    const title = document.getElementById("chatCancelTitle");
    const body = document.getElementById("chatCancelBody");
    const reasons = document.getElementById("chatCancelReasons");
    const submitBtn = document.getElementById("chatCancelSubmit");
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    const labels = getFlowLabels(currentRoom);
    if (!modal) return;
    cancelModalMode = mode === "request" ? "request" : "immediate";
    if (cancelModalMode === "request") {
      if (title) title.textContent = "キャンセル申請";
      if (body) body.textContent = "理由を選択してください。相手の承認後に取引がキャンセルされます。";
      if (reasons) {
        reasons.hidden = false;
        reasons.innerHTML = cancelFlow?.renderCancelRequestReasonsHtml?.() || "";
      }
      if (submitBtn) submitBtn.textContent = "申請する";
    } else {
      if (title) title.textContent = labels.cancelModalTitle || "本当にキャンセルしますか？";
      if (body) body.textContent = labels.cancelModalBody || "キャンセルすると、このやりとりは終了します。";
      if (reasons) {
        reasons.hidden = true;
        reasons.innerHTML = "";
      }
      if (submitBtn) submitBtn.textContent = labels.cancelSubmitLabel || "キャンセルする";
    }
    modal.hidden = false;
  }

  function closeCancelModal() {
    const modal = document.getElementById("chatCancelModal");
    if (modal) modal.hidden = true;
  }

  function bindCancelModalUi() {
    if (cancelModalBound) return;
    cancelModalBound = true;
    const modal = document.getElementById("chatCancelModal");
    const submitBtn = document.getElementById("chatCancelSubmit");
    if (modal) {
      modal.querySelectorAll("[data-cancel-close]").forEach((el) => {
        el.addEventListener("click", closeCancelModal);
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener("click", () => void onCancelSubmit());
    }
  }

  async function onCancelRespondApprove() {
    const roomId = getActiveRoomId();
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    if (!roomId || !cancelFlow?.approveCancelRequest) return;
    const res = cancelFlow.approveCancelRequest({
      threadId: roomId,
      thread: currentRoom,
      userId: getMeId(),
    });
    if (!res?.ok) {
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "承認できませんでした";
        errorEl.style.display = "block";
      }
      return;
    }
    if (currentRoom) {
      currentRoom.roomStatus = "cancelled";
      currentRoom.status = "cancelled";
    }
    await refreshMessagesAfterFlow(roomId);
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
    showReportToast("キャンセルが成立しました。");
  }

  async function onCancelRespondReject() {
    const roomId = getActiveRoomId();
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    if (!roomId || !cancelFlow?.rejectCancelRequest) return;
    const res = cancelFlow.rejectCancelRequest({
      threadId: roomId,
      thread: currentRoom,
      userId: getMeId(),
    });
    if (!res?.ok) {
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "却下できませんでした";
        errorEl.style.display = "block";
      }
      return;
    }
    await refreshMessagesAfterFlow(roomId);
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
    showReportToast("キャンセル申請を却下しました。取引を継続します。");
  }

  async function onCancelSubmit() {
    const roomId = getActiveRoomId();
    const submitBtn = document.getElementById("chatCancelSubmit");
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    if (!roomId || !cancelFlow) return;

    const selected = document.querySelector('#chatCancelReasons input[name="chatCancelReason"]:checked');
    const reasonId = selected?.value || (cancelModalMode === "request" ? "schedule" : "mismatch");
    const reasonLabel =
      selected?.getAttribute("data-cancel-label") ||
      (cancelModalMode === "request" ? "日程都合" : "条件不一致");

    if (submitBtn) submitBtn.disabled = true;
    const res =
      cancelModalMode === "request" && cancelFlow.requestCancelConversation
        ? cancelFlow.requestCancelConversation({
            threadId: roomId,
            thread: currentRoom,
            userId: getMeId(),
            reasonId,
            reasonLabel,
          })
        : cancelFlow.cancelConversation?.({
            threadId: roomId,
            thread: currentRoom,
            userId: getMeId(),
            reasonId,
            reasonLabel,
          });
    if (submitBtn) submitBtn.disabled = false;
    closeCancelModal();

    if (!res?.ok) {
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "キャンセルできませんでした";
        errorEl.style.display = "block";
      }
      return;
    }

    if (res.pending) {
      if (currentRoom) {
        currentRoom.cancelRequestStatus = "pending";
        currentRoom.cancelRequestedBy = getMeId();
        currentRoom.cancelRequestReason = reasonLabel;
      }
      await refreshMessagesAfterFlow(roomId);
      setHeader(currentRoom);
      updateCompleteButton(currentRoom);
      updateCancelRequestUi(currentRoom);
      applyRoomComposerState();
      showReportToast("キャンセル申請を送信しました。相手の承認をお待ちください。");
      return;
    }

    if (currentRoom) {
      currentRoom.roomStatus = "cancelled";
      currentRoom.status = "cancelled";
    }

    await refreshMessagesAfterFlow(roomId);
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    updateCancelRequestUi(currentRoom);
    applyRoomComposerState();
    showReportToast(res.refunded ? "キャンセルしました。返金処理が完了しました。" : "やりとりを終了しました。");
  }

  let overflowMenuBound = false;

  function closeOverflowPanel() {
    const panel = document.getElementById("chatOverflowPanel");
    const btn = document.getElementById("chatOverflowBtn");
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function openRoomReportModal() {
    const meId = getMeId();
    const msgs = Array.isArray(displayMessages) ? displayMessages : [];
    const partnerMsg = [...msgs].reverse().find((m) => String(m?.senderId) !== String(meId));
    const fallback = msgs[msgs.length - 1];
    const messageId = String(partnerMsg?.id || fallback?.id || "room").trim();
    openReportModal(messageId);
  }

  function bindOverflowMenuUi() {
    if (overflowMenuBound) return;
    overflowMenuBound = true;
    const btn = document.getElementById("chatOverflowBtn");
    const panel = document.getElementById("chatOverflowPanel");
    if (btn && panel) {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      panel.addEventListener("click", (ev) => {
        const cancelItem = ev.target.closest("[data-chat-cancel-open]");
        if (cancelItem) {
          ev.preventDefault();
          if (cancelItem.disabled || cancelItem.hidden) return;
          closeOverflowPanel();
          openCancelModal();
          return;
        }
        const reportItem = ev.target.closest("[data-chat-report-room]");
        if (reportItem) {
          ev.preventDefault();
          closeOverflowPanel();
          openRoomReportModal();
          return;
        }
        const blockItem = ev.target.closest("[data-block-open]");
        if (blockItem) {
          ev.preventDefault();
          closeOverflowPanel();
          openBlockModal();
        }
      });
    }
    document.addEventListener("click", (ev) => {
      if (!ev.target.closest("#chatOverflowMenu")) closeOverflowPanel();
    });
  }

  async function onConnectRejectSubmit() {
    const roomId = getActiveRoomId();
    const cancelFlow = window.TasuPlatformChatCancelFlow;
    if (!roomId || !cancelFlow?.rejectConnectCompletion) return;
    const res = cancelFlow.rejectConnectCompletion({
      threadId: roomId,
      thread: currentRoom,
      userId: getMeId(),
    });
    if (!res.ok) {
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "キャンセルできませんでした";
        errorEl.style.display = "block";
      }
      return;
    }
    if (currentRoom) {
      currentRoom.roomStatus = "cancelled";
      currentRoom.status = "cancelled";
    }
    await refreshMessagesAfterFlow(roomId);
    setHeader(currentRoom);
    updateCompleteButton(currentRoom);
    applyRoomComposerState();
    showReportToast("やりとりをキャンセルしました。返金処理が完了しました。");
  }

  function openBlockModal() {
    const modal = document.getElementById("chatBlockModal");
    const body = document.getElementById("chatBlockBody");
    if (!modal) return;
    if (body) {
      body.textContent =
        window.TasuChatBlocks?.BLOCK_CONFIRM_BODY ||
        "このユーザーをブロックしますか？ブロックすると、この相手からのメッセージは表示されにくくなり、あなたからの送信も制限されます。";
    }
    modal.hidden = false;
  }

  function closeBlockModal() {
    const modal = document.getElementById("chatBlockModal");
    if (modal) modal.hidden = true;
  }

  async function onBlockSubmit() {
    const roomId = getActiveRoomId();
    const partnerId = getPartnerId();
    const submitBtn = document.getElementById("chatBlockSubmit");
    if (!roomId || !partnerId) return;

    if (submitBtn) submitBtn.disabled = true;
    const res = await window.TasuChatService.blockUser({
      roomId,
      blockedId: partnerId,
      blockerId: getMeId(),
    });
    if (submitBtn) submitBtn.disabled = false;
    closeBlockModal();
    closeAllMsgMenus();

    if (!res.ok) {
      const errorEl = document.getElementById("chatInlineError");
      if (errorEl) {
        errorEl.textContent = res.reason || "ブロックできませんでした";
        errorEl.style.display = "block";
      }
      return;
    }

    roomBlockStatus = { active: true, iBlockedThem: true, theyBlockedMe: false };
    applyRoomComposerState();
    syncDisplayMessages(displayMessages);
    showReportToast("ブロックしました");
  }

  function showReportToast(text) {
    const toast = document.getElementById("chatReportToast");
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(showReportToast._timer);
    showReportToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  }

  function closeReportModal() {
    const modal = document.getElementById("chatReportModal");
    const detail = document.getElementById("chatReportDetail");
    if (modal) modal.hidden = true;
    if (detail) detail.value = "";
    pendingReportMessageId = "";
    const fieldset = document.getElementById("chatReportReasons");
    if (fieldset) {
      const checked = fieldset.querySelector('input[name="reportReason"]:checked');
      if (checked) checked.checked = false;
    }
  }

  function openReportModal(messageId) {
    const modal = document.getElementById("chatReportModal");
    if (!modal) return;
    pendingReportMessageId = String(messageId);
    modal.hidden = false;
    const first = modal.querySelector('input[name="reportReason"]');
    if (first) first.focus();
  }

  function buildReportReasonFieldset() {
    const fieldset = document.getElementById("chatReportReasons");
    if (!fieldset || fieldset.dataset.built === "1") return;

    const reasons = window.TasuChatReports?.REPORT_REASONS || [];
    fieldset.innerHTML = reasons
      .map(
        (r) => `
        <label class="chat-report-reason">
          <input type="radio" name="reportReason" value="${escapeHtml(r.id)}">
          <span>${escapeHtml(r.label)}</span>
        </label>`
      )
      .join("");
    fieldset.dataset.built = "1";
  }

  async function onReportSubmit() {
    const fieldset = document.getElementById("chatReportReasons");
    const detailEl = document.getElementById("chatReportDetail");
    const submitBtn = document.getElementById("chatReportSubmit");
    if (!fieldset) return;
    if (!pendingReportMessageId) {
      showReportToast("通報対象のメッセージがありません");
      return;
    }

    const selected = fieldset.querySelector('input[name="reportReason"]:checked');
    if (!selected) {
      showReportToast("通報理由を選択してください");
      return;
    }

    const reasonId = selected.value;
    const reason =
      window.TasuChatReports?.getReasonLabel?.(reasonId) || reasonId;
    const detail = detailEl?.value?.trim() || "";

    if (submitBtn) submitBtn.disabled = true;

    const res = await window.TasuChatService.submitReport({
      roomId: getActiveRoomId(),
      messageId: pendingReportMessageId,
      reason,
      detail,
      reporterId: getMeId(),
    });

    if (submitBtn) submitBtn.disabled = false;
    closeReportModal();

    if (res.ok) {
      showReportToast(res.message || "通報を受け付けました");
      return;
    }

    const errorEl = document.getElementById("chatInlineError");
    if (errorEl && res.reason) {
      errorEl.textContent = res.reason;
      errorEl.style.display = "block";
    }
  }

  function bindReportUi() {
    if (reportUiBound) return;
    reportUiBound = true;

    buildReportReasonFieldset();

    const modal = document.getElementById("chatReportModal");
    const blockModal = document.getElementById("chatBlockModal");
    const messagesWrap = document.getElementById("chatMessages");
    const submitBtn = document.getElementById("chatReportSubmit");
    const blockSubmitBtn = document.getElementById("chatBlockSubmit");

    if (messagesWrap) {
      messagesWrap.addEventListener("click", (e) => {
        const toggle = e.target.closest("[data-msg-menu-toggle]");
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          const dropdown = toggle.parentElement?.querySelector(".chat-msg__menu-dropdown");
          const willOpen = dropdown?.hidden;
          closeAllMsgMenus();
          if (dropdown && willOpen) dropdown.hidden = false;
          return;
        }

        const reportBtn = e.target.closest("[data-report-open]");
        if (reportBtn) {
          e.preventDefault();
          e.stopPropagation();
          closeAllMsgMenus();
          openReportModal(reportBtn.getAttribute("data-report-open") || "");
          return;
        }

        const blockBtn = e.target.closest("[data-block-open]");
        if (blockBtn) {
          e.preventDefault();
          e.stopPropagation();
          closeAllMsgMenus();
          openBlockModal();
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".chat-msg-menu")) {
        closeAllMsgMenus();
      }
    });

    if (modal) {
      modal.querySelectorAll("[data-report-close]").forEach((el) => {
        el.addEventListener("click", closeReportModal);
      });
    }

    if (blockModal) {
      blockModal.querySelectorAll("[data-block-close]").forEach((el) => {
        el.addEventListener("click", closeBlockModal);
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", () => onReportSubmit());
    }

    if (blockSubmitBtn) {
      blockSubmitBtn.addEventListener("click", () => onBlockSubmit());
    }

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const reportM = document.getElementById("chatReportModal");
      const blockM = document.getElementById("chatBlockModal");
      const cancelM = document.getElementById("chatCancelModal");
      if (reportM && !reportM.hidden) closeReportModal();
      if (blockM && !blockM.hidden) closeBlockModal();
      if (cancelM && !cancelM.hidden) closeCancelModal();
      closeAllMsgMenus();
      closeOverflowPanel();
    });
  }

  function resolveReviewPromptThread(room, meId) {
    const roomId = pickStr(room?.id, getActiveRoomId());
    const loaded = roomId ? window.TasuChatThreadStore?.loadRoom?.(roomId, { viewerUserId: meId }) : null;
    const thread = loaded?.thread || room;
    return thread ? applyReviewNotifyDemoCompletion(thread) : null;
  }

  function renderJobReviewPromptAppend(room, meId) {
    return "";
  }

  function renderMessages(messages) {
    const wrap = document.getElementById("chatMessages");
    if (!wrap) return;

    const meId = getMeId();
    const readReceiptMessageId = window.TasuChatService.getReadReceiptMessageId(
      messages,
      meId,
      partnerLastReadAt
    );
    const groups = groupByDay(messages);
    wrap.innerHTML = groups
      .map(([day, list]) => {
        const dayLabel = escapeHtml(day === "unknown" ? "" : day);
        const dayBlock = dayLabel ? `<div class="chat-day" aria-label="日付">${dayLabel}</div>` : "";
        const msgs = list
          .map((m) => {
            if (m.kind === "completion_report") {
              if (
                window.TasuPlatformChatPurchasePaymentFlow?.appliesToThread?.(currentRoom) === true
              ) {
                return "";
              }
              const skillCat =
                window.TasuPlatformChatCategoryFlow?.resolveCategoryKey?.(currentRoom) === "skill";
              if (skillCat) return "";
              const cardHtml =
                window.TasuPlatformChatCompletion?.renderCompletionCardHtml?.(m) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "content_card") {
              const cardHtml =
                window.TasuPlatformChatContentCard?.renderContentCardHtml?.(m) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "product_shipping_card") {
              const cardHtml =
                window.TasuPlatformChatPurchasePaymentFlow?.renderProductShippingCardHtml?.(
                  m,
                  currentRoom
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "purchase_bank_transfer_card") {
              const cardHtml =
                window.TasuPlatformChatPurchasePaymentFlow?.renderPurchaseBankTransferCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "purchase_bank_deposit_confirm_card") {
              const cardHtml =
                window.TasuPlatformChatPurchasePaymentFlow?.renderPurchaseBankDepositConfirmCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "job_hired_card" || m.kind === "job_application_card") {
              const cardHtml =
                window.TasuPlatformChatJobCard?.renderJobHiredCardHtml?.(m) ||
                window.TasuPlatformChatJobCard?.renderJobApplicationCardHtml?.(m) ||
                "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "platform_completion_card") {
              const cardHtml =
                window.TasuPlatformChatCategoryFlow?.renderPlatformCompletionCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "purchase_completion_fee_card") {
              const cardHtml =
                window.TasuPlatformChatPurchasePaymentFlow?.renderPurchaseCompletionFeeCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "job_completion_card") {
              const cardHtml =
                window.TasuPlatformChatJobFlow?.renderJobCompletionCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "connect_completion_pending_card") {
              const cardHtml =
                window.TasuPlatformChatConnectChatFlow?.renderPendingApprovalCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "marketplace_connect_confirm_card") {
              const cardHtml =
                window.TasuPlatformChatCategoryFlow?.renderMarketplaceConnectConfirmCardHtml?.(
                  m,
                  currentRoom
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "connect_payment_required_card") {
              const cardHtml =
                window.TasuPlatformChatConnectChatFlow?.renderConnectPaymentRequiredCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "connect_payment_done_card") {
              const cardHtml =
                window.TasuPlatformChatConnectChatFlow?.renderPaymentDoneCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "connect_refund_done_card") {
              const cardHtml =
                window.TasuPlatformChatConnectChatFlow?.renderRefundDoneCardHtml?.(m) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "work_service_stripe_payment_card") {
              const cardHtml =
                window.TasuPlatformChatWorkServiceConnectFlow?.renderStripePaymentCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "work_service_seller_confirm_card") {
              const cardHtml =
                window.TasuPlatformChatWorkServiceConnectFlow?.renderSellerConfirmCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "manual_transfer_payment_card") {
              const cardHtml =
                window.TasuPlatformChatManualTransferFlow?.renderManualTransferCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "manual_transfer_deposit_confirm_card") {
              const cardHtml =
                window.TasuPlatformChatManualTransferFlow?.renderDepositConfirmCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "pre_chat_start_fee_card") {
              const cardHtml =
                window.TasuPlatformChatStartFeeCard?.renderStartFeeCardHtml?.(
                  m,
                  currentRoom,
                  meId
                ) || "";
              if (cardHtml) return cardHtml;
            }

            if (m.kind === "system" || String(m.senderId) === "__system__") {
              const text = formatMessageText(m.text || "");
              const time = escapeHtml(formatTime(m.createdAt));
              const timeIso = escapeHtml(m.createdAt);
              return `
              <div class="chat-system-msg" role="status">
                <p class="chat-system-msg__text">${text}</p>
                <time class="chat-system-msg__time" datetime="${timeIso}">${time}</time>
              </div>`;
            }

            const isMe = String(m.senderId) === String(meId);
            const dimClass =
              !isMe && roomBlockStatus.active ? " chat-msg--dimmed" : "";
            const cls = (isMe ? "chat-msg chat-msg--me" : "chat-msg") + dimClass;
            const avatar = renderMessageAvatar(m.senderName, m.senderAvatarUrl);
            const name = escapeHtml(m.senderName || "");
            const time = escapeHtml(formatTime(m.createdAt));
            const text = formatMessageText(m.text || "");
            const attachmentUrl = m.attachment?.dataUrl ? escapeHtml(m.attachment.dataUrl) : "";
            const attachmentAlt = m.attachment?.name ? escapeHtml(m.attachment.name) : "attachment";
            const attachmentBlock = attachmentUrl
              ? `<img class="chat-bubble__image" src="${attachmentUrl}" alt="${attachmentAlt}" loading="lazy">`
              : "";
            const showRead =
              isMe && readReceiptMessageId && readReceiptMessageId === String(m.id);
            const timeIso = escapeHtml(m.createdAt);

            if (isMe) {
              const readLine = showRead
                ? `<span class="chat-msg__read" aria-label="既読">既読</span>`
                : "";
              return `
              <div class="${cls}">
                <div class="chat-msg__content chat-msg__content--me">
                  <div class="chat-bubble-stack chat-bubble-stack--me">
                    <div class="chat-bubble" role="group" aria-label="メッセージ">
                      ${text ? `<p class="chat-bubble__text">${text}</p>` : ""}
                      ${attachmentBlock}
                    </div>
                    <div class="chat-msg__meta chat-msg__meta--me">
                      ${readLine}
                      <time class="chat-msg__time chat-msg__time--me" datetime="${timeIso}">${time}</time>
                    </div>
                  </div>
                </div>
              </div>
            `;
            }

            const menuBtn = renderMessageMenuButton(m.id, isMe);
            return `
              <div class="${cls}" data-message-id="${escapeHtml(String(m.id))}">
                ${avatar}
                <div class="chat-msg__content chat-msg__content--them">
                  <div class="chat-bubble-stack chat-bubble-stack--them">
                    <div class="chat-bubble-wrap">
                      ${menuBtn}
                      <div class="chat-bubble" role="group" aria-label="メッセージ">
                        <span class="chat-bubble__name">${name}</span>
                        ${text ? `<p class="chat-bubble__text">${text}</p>` : ""}
                        ${attachmentBlock}
                      </div>
                    </div>
                    <time class="chat-msg__time chat-msg__time--them" datetime="${timeIso}">${time}</time>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");
        return `${dayBlock}${msgs}`;
      })
      .join("");
    const reviewPromptHtml = renderJobReviewPromptAppend(currentRoom, meId);
    if (reviewPromptHtml) {
      wrap.insertAdjacentHTML("beforeend", reviewPromptHtml);
    }
    bindMessagesMediaLoadScroll();
  }

  function bindMessagesMediaLoadScroll() {
    const wrap = document.getElementById("chatMessages");
    if (!wrap) return;
    wrap.querySelectorAll("img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", () => scrollToBottom(), { once: true });
    });
  }

  function scrollToBottom() {
    if (shouldSuppressBenchAutoScrollBottom()) {
      restoreBenchEmbedScrollPosition();
      return;
    }
    const wrap = document.getElementById("chatMessages");
    if (!wrap) return;
    wrap.scrollTop = wrap.scrollHeight;
    const last =
      wrap.querySelector(".chat-msg--me:last-of-type") ||
      wrap.querySelector(".chat-msg:last-of-type");
    if (!last) return;
    const wrapRect = wrap.getBoundingClientRect();
    const composer = document.querySelector(".chat-composer");
    const composerTop = composer?.getBoundingClientRect().top ?? wrapRect.bottom;
    const visibleBottom = Math.min(wrapRect.bottom, composerTop) - 10;
    const lastRect = last.getBoundingClientRect();
    if (lastRect.bottom > visibleBottom) {
      wrap.scrollTop += lastRect.bottom - visibleBottom;
    }
  }

  function scrollToBottomAfterPaint(options) {
    const force = options?.force !== false;
    if (!force) return;
    if (shouldSuppressBenchAutoScrollBottom(options)) {
      restoreBenchEmbedScrollPosition();
      return;
    }
    const run = () => scrollToBottom();
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    [0, 60, 160, 320, 520].forEach((ms) => {
      window.setTimeout(run, ms);
    });
  }

  /** @type {boolean} */
  let mobileHeadBound = false;

  function getMobileHeadTitle(thread) {
    const row = window.TasuTalkChatThreadModel?.enrichThread?.(thread) || thread || {};
    const isJob =
      row.threadKind === "job_hire" ||
      String(row.listingType || "").toLowerCase() === "job" ||
      String(row.category || "") === "求人";
    if (isJob) return "求人チャット";
    const partner = String(
      row.partner?.displayName ||
        row.partnerProfile?.displayName ||
        row.buyerName ||
        row.sellerName ||
        ""
    ).trim();
    if (partner) return partner;
    if (row.chatDomain === "work") {
      return String(row.listing?.title || "取引チャット").trim() || "取引チャット";
    }
    return "チャット";
  }

  function buildChatBackUrl(path) {
    try {
      const u = new URL(path, window.location.href);
      const cur = new URLSearchParams(window.location.search);
      const meId = getMeId();
      if (meId) u.searchParams.set("userId", meId);
      if (cur.has("talkDev")) {
        u.searchParams.set("talkDev", "1");
      }
      const review = pickStr(cur.get("review"));
      if (review === "chat-demo" || review === "job-full") {
        u.searchParams.set("review", review);
        const demoProfile = pickStr(cur.get("demoProfile"), cur.get("demoProfile"));
        if (demoProfile) u.searchParams.set("demoProfile", demoProfile);
        if (cur.get("demoConnect") === "1") u.searchParams.set("demoConnect", "1");
      }
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return path;
    }
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function resolveChatBackUrl(thread) {
    const from = String(new URLSearchParams(window.location.search).get("from") || "")
      .trim()
      .toLowerCase();
    const listingId = String(
      thread?.listingId ||
        thread?.listing?.id ||
        new URLSearchParams(window.location.search).get("listingId") ||
        ""
    ).trim();

    if (from === "applications" && listingId) {
      return buildChatBackUrl(
        `detail-job.html?id=${encodeURIComponent(listingId)}&view=applications#applications`
      );
    }
    if (from === "notify") {
      try {
        const stored = window.sessionStorage?.getItem("tasu_talk_return_url");
        if (stored) return buildChatBackUrl(stored);
      } catch {
        /* ignore */
      }
      return buildChatBackUrl("talk-home.html?tab=notify");
    }
    if (from === "talk") {
      return buildChatBackUrl("talk-home.html?tab=chat");
    }
    if (
      window.TasuPlatformChatDualWindowDemo?.isDemoThread?.(thread?.id || thread) === true ||
      new URLSearchParams(window.location.search).get("review") === "chat-demo"
    ) {
      return buildChatBackUrl("talk-home.html?tab=notify");
    }
    return "";
  }

  function goChatBack() {
    const target = resolveChatBackUrl(currentRoom);
    if (target) {
      window.location.href = target;
      return;
    }
    try {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {
      /* ignore */
    }
    window.location.href = buildChatBackUrl("talk-home.html?tab=chat");
  }

  function syncMobileHead(thread) {
    const titleEl = document.getElementById("chatMobileTitle");
    if (titleEl) titleEl.textContent = getMobileHeadTitle(thread);
    if (mobileHeadBound) return;
    const backBtn = document.getElementById("chatMobileBack");
    if (!backBtn) return;
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goChatBack();
    });
    mobileHeadBound = true;
  }

  function setPeerHeader(thread) {
    const row = window.TasuTalkChatThreadModel?.enrichThread?.(thread) || thread;
    const profile = row?.partnerProfile || window.TasuTalkChatProfile?.resolveProfile?.(row?.partner?.id);
    const presence = window.TasuTalkChatProfile?.getOnlinePresence?.(profile?.user_id) || {
      label: "オフライン",
      isOnline: false,
    };

    const avatarEl = document.getElementById("chatPeerAvatar");
    const avatarLink = document.getElementById("chatPeerAvatarLink");
    const nameEl = document.getElementById("chatPeerName");
    const presenceEl = document.getElementById("chatPeerPresence");
    const statusEl = document.getElementById("chatPeerStatus");
    const onlineDot = document.getElementById("chatPeerOnlineDot");

    if (avatarEl) {
      const displayName = profile?.display_name || row?.partner?.name || "相手";
      if (profile?.profile_image) {
        avatarEl.src = profile.profile_image;
        avatarEl.alt = displayName;
        avatarEl.hidden = false;
        avatarEl.classList.remove("chat-peer-header__avatar--initial");
        avatarEl.textContent = "";
      } else {
        avatarEl.removeAttribute("src");
        avatarEl.alt = displayName;
        avatarEl.hidden = false;
        avatarEl.classList.add("chat-peer-header__avatar--initial");
        avatarEl.textContent = displayName ? [...displayName][0] : "人";
      }
    }
    if (avatarLink && profile?.user_id) {
      const href =
        window.TasuTalkChatThreadModel?.profilePageHref?.(profile.user_id) ||
        `profile-public.html?userId=${encodeURIComponent(profile.user_id)}`;
      avatarLink.href = window.TasuChatUserIdentity?.appendUserIdToUrl?.(href) || href;
    }
    if (nameEl) nameEl.textContent = profile?.display_name || "相手";
    if (presenceEl) {
      presenceEl.textContent = presence.label;
      presenceEl.classList.toggle("is-online", presence.isOnline);
    }
    if (onlineDot) onlineDot.hidden = !presence.isOnline;
    if (statusEl) {
      const parts = [];
      if (profile?.status_message) parts.push(profile.status_message);
      if (profile?.category) parts.push(profile.category);
      if (profile?.location) parts.push(profile.location);
      if (profile?.review_count > 0) {
        parts.push(`★${profile.rating}（${profile.review_count}件）`);
      }
      if (parts.length) {
        statusEl.textContent = parts.join(" · ");
        statusEl.hidden = false;
      } else {
        statusEl.hidden = true;
      }
    }
  }

  function setHeader(thread) {
    const row = window.TasuTalkChatThreadModel?.enrichThread?.(thread) || thread;
    setPeerHeader(row);
    syncMobileHead(row);

    const titleEl = document.getElementById("chatTitle");
    const subEl = document.getElementById("chatSub");
    const statusEl = document.getElementById("chatStatusPill");
    const remainEl = document.getElementById("chatRemaining");
    const metaEl = document.getElementById("chatListingMeta");
    const catEl = document.getElementById("chatListingCategory");
    const linkEl = document.getElementById("chatListingDetailLink");
    if (!titleEl || !subEl || !statusEl || !remainEl) return;

    const isWork = row?.chatDomain === "work";
    titleEl.textContent = isWork
      ? row?.listing?.title || "案件・問い合わせ"
      : "友達チャット";
    subEl.textContent = isWork
      ? `相手：${row?.partner?.displayName || "（相手）"}`
      : row?.partnerProfile?.status_message || "";

    const category = String(thread?._category || thread?.listing?.category || "").trim();
    const detailUrl = String(thread?._detailUrl || thread?.listing?.detailUrl || "").trim();
    const isConsult = Boolean(thread?._localConsult);
    if (metaEl && catEl && linkEl) {
      if (isConsult && (category || detailUrl)) {
        metaEl.hidden = false;
        if (category) {
          catEl.textContent = category;
          catEl.hidden = false;
        } else {
          catEl.textContent = "";
          catEl.hidden = true;
        }
        if (detailUrl) {
          linkEl.href = detailUrl;
          linkEl.hidden = false;
        } else {
          linkEl.hidden = true;
        }
      } else {
        metaEl.hidden = true;
        catEl.hidden = true;
        linkEl.hidden = true;
      }
    }

    const lifecycle =
      window.TasuChatRoomStatus?.resolveRoomLifecycleStatus?.(thread) ||
      (window.TasuChatService.isRoomExpired(thread) ? "expired" : "active");
    const display = window.TasuChatRoomStatus?.getListStatusDisplay?.(lifecycle) || {
      label: "ACTIVE",
      pillClass: "chat-pill--active",
    };
    statusEl.textContent = display.label;
    statusEl.className = `chat-pill ${display.pillClass}`;
    const expiresAt = thread?.expiresAt ?? thread?.expires_at ?? "";
    if (isConsult) {
      remainEl.textContent = "相談中";
    } else if (lifecycle === "completed") {
      remainEl.textContent = "取引完了";
    } else if (lifecycle === "cancelled") {
      remainEl.textContent = "キャンセル済み";
    } else if (lifecycle === "expired") {
      remainEl.textContent = "期限切れ";
    } else {
      remainEl.textContent = window.TasuChatService.formatRemaining(expiresAt) || "";
    }
    updateCompleteButton(thread);
    const peerName =
      row?.partnerProfile?.display_name ||
      row?.partner?.displayName ||
      row?.partner?.name ||
      (isWork ? row?.listing?.title : "") ||
      "チャット";
    window.TasuCommonBreadcrumb?.setCurrentLabel(peerName);
  }

  const DEFAULT_INPUT_PLACEHOLDER = "メッセージ（Enterで送信 / Shift+Enterで改行）";

  function setComposerEnabled(enabled, reasonText, placeholder) {
    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");
    const attach = document.getElementById("chatAttach");
    const fileInput = document.getElementById("chatFileInput");
    const alert = document.getElementById("chatAlert");
    if (!input || !send || !attach || !alert) return;

    input.disabled = !enabled;
    input.readOnly = false;
    if (!enabled) {
      input.removeAttribute("readonly");
    }
    send.disabled = !enabled;
    attach.disabled = !enabled;
    if (fileInput) fileInput.disabled = !enabled;
    input.placeholder = enabled
      ? DEFAULT_INPUT_PLACEHOLDER
      : placeholder || reasonText || "期限切れのため送信できません";
    alert.style.display = enabled ? "none" : "block";
    alert.textContent = reasonText || "期限切れのため送信できません。";
  }

  function clearAttachmentPreview() {
    pendingAttachment = null;
    const preview = document.getElementById("chatAttachPreview");
    const fileInput = document.getElementById("chatFileInput");
    if (preview) {
      preview.innerHTML = "";
      preview.hidden = true;
    }
    if (fileInput) {
      fileInput.value = "";
    }
  }

  function renderAttachmentPreview() {
    const preview = document.getElementById("chatAttachPreview");
    if (!preview) return;
    if (!pendingAttachment) {
      preview.innerHTML = "";
      preview.hidden = true;
      return;
    }

    preview.hidden = false;
    preview.innerHTML = `
      <img class="chat-attach-preview__img" src="${escapeHtml(pendingAttachment.dataUrl)}" alt="">
      <div class="chat-attach-preview__meta">
        <p class="chat-attach-preview__label">添付画像</p>
        <p class="chat-attach-preview__name">${escapeHtml(pendingAttachment.name)}</p>
      </div>
      <button type="button" class="chat-attach-preview__remove" id="chatAttachRemove" aria-label="添付を削除" title="削除">✕</button>
    `;
    const remove = document.getElementById("chatAttachRemove");
    if (remove) {
      remove.addEventListener("click", clearAttachmentPreview);
    }
  }

  function onAttachClick() {
    const fileInput = document.getElementById("chatFileInput");
    if (!fileInput || fileInput.disabled) return;
    fileInput.click();
  }

  function onFileSelected() {
    const fileInput = document.getElementById("chatFileInput");
    const errorEl = document.getElementById("chatInlineError");
    if (!fileInput) return;
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      clearAttachmentPreview();
      return;
    }
    if (!file.type || !file.type.startsWith("image/")) {
      clearAttachmentPreview();
      if (errorEl) {
        errorEl.textContent = "画像ファイルを選択してください";
        errorEl.style.display = "block";
      }
      return;
    }
    // ローカルプレビュー（後で Supabase Storage URL に差し替え可能）
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        clearAttachmentPreview();
        return;
      }
      pendingAttachment = { name: file.name || "image", dataUrl };
      renderAttachmentPreview();
      scrollToBottomAfterPaint();
    };
    reader.readAsDataURL(file);
  }

  async function onSend(meProfile) {
    const roomId = getActiveRoomId();
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSend");
    const errorEl = document.getElementById("chatInlineError");
    if (!input || !errorEl || !roomId) return;

    errorEl.textContent = "";
    errorEl.style.display = "none";
    const rawText = String(input.value ?? "");
    if (!rawText.trim() && !pendingAttachment) {
      return;
    }

    const sendBlock = window.TasuChatService.getMessagingBlockReason?.(currentRoom) || "";
    if (sendBlock) {
      console.warn("[TasuChat] onSend blocked:", sendBlock);
      errorEl.textContent = sendBlock;
      errorEl.style.display = "block";
      return;
    }

    if (sendBtn) sendBtn.disabled = true;

    const optimisticId = `pending-${Date.now()}`;
    const optimisticMsg = {
      id: optimisticId,
      roomId,
      chatId: roomId,
      senderId: meProfile.id,
      senderName: meProfile.displayName,
      senderAvatarUrl: meProfile.avatarUrl,
      text: rawText,
      createdAt: new Date().toISOString(),
      kind: pendingAttachment ? "mixed" : "text",
      attachment: pendingAttachment ? { ...pendingAttachment } : null,
    };
    appendDisplayMessage(optimisticMsg);
    input.value = "";
    clearAttachmentPreview();
    scrollToBottomAfterPaint();

    const res = await window.TasuChatService.saveMessage(
      roomId,
      {
        senderId: meProfile.id,
        senderName: meProfile.displayName,
        senderAvatarUrl: meProfile.avatarUrl,
        text: rawText,
        attachment: pendingAttachment ? { ...pendingAttachment } : undefined,
      },
      currentRoom
    );

    if (!res.ok) {
      displayMessages = displayMessages.filter((m) => String(m.id) !== optimisticId);
      renderMessages(displayMessages);
      input.value = rawText;
      if (sendBtn && !input.disabled) sendBtn.disabled = false;
      errorEl.textContent = res.reason || "送信できませんでした";
      errorEl.style.display = "block";
      return;
    }

    if (sendBtn && !input.disabled) sendBtn.disabled = false;

    displayMessages = displayMessages.filter((m) => String(m.id) !== optimisticId);
    if (res.message) {
      appendDisplayMessage(res.message);
    } else {
      const { thread, messages } = await window.TasuChatService.loadMessages(roomId);
      if (thread) {
        applyCurrentRoom(thread, roomId, messages);
      }
      syncDisplayMessages(messages);
    }
    scrollToBottomAfterPaint();
  }

  function showRoomNotFound(messagesEl, roomId) {
    currentRoom = null;
    const Flow = window.TasuPlatformChatJobFlow;
    const recovery = Flow?.resolveJobChatRecoveryLinks?.(roomId) || {};
    const applicationsUrl = escapeHtml(recovery.applicationsUrl || "detail-job.html?id=job_demo_full_001&view=applications#applications");
    const notifyUrl = escapeHtml(recovery.notifyUrl || "talk-home.html?tab=notify&talkDev=1");
    const talkUrl = escapeHtml(recovery.talkUrl || "talk-home.html?tab=chat&talkDev=1");
    const isJobContext =
      /review=job-full/.test(window.location.search) ||
      String(roomId || "").includes("job") ||
      String(roomId || "").startsWith("chat-demo-job");

    if (messagesEl) {
      if (isJobContext) {
        messagesEl.innerHTML = `
          <div class="chat-room-unavailable" role="alert">
            <p class="chat-room-unavailable__title">やりとりを開始できませんでした</p>
            <p class="chat-room-unavailable__body">応募状況から再度お試しください。550円のお支払い後にチャットが開きます。</p>
            <div class="chat-room-unavailable__actions">
              <a class="chat-room-unavailable__btn chat-room-unavailable__btn--primary" href="${applicationsUrl}">応募状況へ戻る</a>
              <a class="chat-room-unavailable__btn" href="${notifyUrl}">通知へ戻る</a>
              <a class="chat-room-unavailable__btn" href="${talkUrl}">TASFUL TALKへ</a>
            </div>
          </div>`;
      } else {
        messagesEl.innerHTML = `
          <div class="chat-room-unavailable" role="alert">
            <p class="chat-room-unavailable__title">チャットを開けませんでした</p>
            <p class="chat-room-unavailable__body">一覧から再度お試しください。</p>
            <div class="chat-room-unavailable__actions">
              <a class="chat-room-unavailable__btn chat-room-unavailable__btn--primary" href="talk-home.html?tab=chat&talkDev=1">TASFUL TALKへ</a>
              <a class="chat-room-unavailable__btn" href="talk-home.html?tab=notify&talkDev=1">通知へ戻る</a>
            </div>
          </div>`;
      }
    }
    setComposerEnabled(false, "チャットを開けませんでした。");
  }

  function bindComposerFocus() {
    const wrap = document.getElementById("chatInputWrap");
    const input = document.getElementById("chatInput");
    if (!wrap || !input) return;

    wrap.addEventListener("click", (e) => {
      if (input.disabled || input.readOnly) return;
      if (e.target === input || input.contains(e.target)) return;
      input.focus();
    });
  }

  function bindComposerInput(meProfile) {
    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSend");
    if (!input) return;

    const isCoarsePointer = () => window.matchMedia?.("(pointer: coarse)")?.matches === true;
    let composing = false;

    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
    });

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || input.disabled) return;
      if (composing || e.isComposing) return;
      if (isCoarsePointer()) return;
      e.preventDefault();
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
        return;
      }
      onSend(meProfile);
    });
  }

  async function initBusinessDealPanel() {
    const dealId = new URLSearchParams(window.location.search).get("deal")?.trim();
    if (!dealId || !window.TasuBusinessServiceChatUi?.init) return;

    await window.TasuBusinessServiceChatUi.init({
      dealId,
      room: currentRoom,
      onDealUpdated: async () => {
        const rid = getActiveRoomId();
        if (!rid) return;
        const { messages } = await window.TasuChatService.loadMessages(rid);
        syncDisplayMessages(messages);
        scrollToBottomAfterPaint();
      },
    });
  }

  function publishBenchChatDomDiag() {
    try {
      const unavailableEl = document.querySelector(".chat-room-unavailable__title");
      const inlineErrorEl = document.getElementById("chatInlineError");
      const errorText = pickStr(unavailableEl?.textContent, inlineErrorEl?.textContent);
      const chatInput = document.getElementById("chatInput");
      const bodyText = pickStr(document.body?.innerText, document.body?.textContent);
      const composerVisible =
        Boolean(chatInput) &&
        !chatInput.hidden &&
        globalThis.getComputedStyle(chatInput).display !== "none";
      window.__tasuBenchChatDomDiag = {
        at: new Date().toISOString(),
        actualChatErrorText: errorText || "",
        actualChatErrorVisible:
          Boolean(errorText.trim()) || Boolean(document.querySelector(".chat-room-unavailable")),
        actualComposerDomExists: Boolean(chatInput),
        actualComposerVisible: composerVisible,
        actualMessageListExists: Boolean(document.getElementById("chatMessages")),
        actualChatRootExists: Boolean(document.body),
        actualChatDetailPageReadyAttr: pickStr(document.body?.dataset?.chatDetailReady),
        actualBodyTextIncludesChatError: /チャットを開けませんでした|やりとりを開始できませんでした|読み込みに失敗/.test(
          bodyText
        ),
      };
    } catch {
      /* ignore */
    }
  }

  const CHAT_DETAIL_INIT_TRACE_MAX = 64;
  let __chatDetailInitTrace = [];

  function resetChatDetailInitTrace() {
    __chatDetailInitTrace = [];
  }

  function logChatDetailInitStep(step, detail) {
    const entry = {
      step: pickStr(step, "unknown"),
      ...(detail && typeof detail === "object" ? detail : {}),
      at: new Date().toISOString(),
    };
    __chatDetailInitTrace.push(entry);
    if (__chatDetailInitTrace.length > CHAT_DETAIL_INIT_TRACE_MAX) {
      __chatDetailInitTrace.splice(0, __chatDetailInitTrace.length - CHAT_DETAIL_INIT_TRACE_MAX);
    }
    try {
      console.info("[TasuChatDetail:init]", entry.step, detail || "");
    } catch {
      /* ignore */
    }
    publishChatDetailLoadDiag({
      initTrace: __chatDetailInitTrace.slice(-48),
      initLastStep: entry.step,
      initStepCount: __chatDetailInitTrace.length,
    });
  }

  function readInitContextFields(q, roomId) {
    const query = q || readChatDetailLocationQuery();
    const tid = pickStr(roomId, query.thread, query.roomId);
    const store = window.TasuChatThreadStore;
    const threadRow = tid
      ? (store?.readAll?.() || []).find((t) => String(t.id) === tid)
      : null;
    const participantId = pickStr(
      window.TasuChatUserIdentity?.getEffectiveUserId?.(),
      query.userId
    );
    return {
      threadId: tid || "—",
      listingId: pickStr(query.listingId, threadRow?.listingId) || "—",
      roomId: pickStr(tid, query.roomId, query.thread) || "—",
      participantId: participantId || "—",
      queryUserId: pickStr(query.userId) || "—",
      sellerId: pickStr(threadRow?.sellerId) || "—",
      buyerId: pickStr(threadRow?.buyerId) || "—",
      demoProfile: pickStr(query.demoProfile) || "—",
      threadKind: pickStr(threadRow?.threadKind) || "—",
      threadStatus: pickStr(threadRow?.status, threadRow?.roomStatus) || "—",
    };
  }

  function publishInitExit(exitKind, opts) {
    const o = opts || {};
    const failStep = pickStr(o.failStep, exitKind);
    const failReason = pickStr(o.failReason, o.reason, exitKind);
    const ctx = readInitContextFields(o.q, o.roomId);
    logChatDetailInitStep(`exit:${exitKind}`, { failStep, failReason, ...ctx });
    publishChatDetailLoadDiag({
      chatDetailLoadOk: false,
      chatLoadReady: false,
      initExitKind: exitKind,
      failStep,
      failReason,
      chatDetailLoadErrorReason: failReason,
      initTrace: __chatDetailInitTrace.slice(-48),
      ...ctx,
    });
    publishThreadResolveFailure(
      `init_exit_${exitKind}`,
      o.q || readChatDetailLocationQuery(),
      pickStr(o.roomId, ctx.threadId),
      failStep,
      failReason
    );
  }

  function publishChatDetailLoadDiag(patch) {
    try {
      const next = { ...(patch || {}) };
      if (Array.isArray(next.initTrace)) {
        next.initTrace = next.initTrace.slice(-48);
      }
      window.__tasuChatDetailLoadDiag = {
        ...(window.__tasuChatDetailLoadDiag || {}),
        ...next,
        initStepCount: Math.min(__chatDetailInitTrace.length, CHAT_DETAIL_INIT_TRACE_MAX),
        at: new Date().toISOString(),
      };
      publishBenchChatDomDiag();
    } catch {
      /* ignore */
    }
  }

  function publishChatDetailLoadError(err, context) {
    const reason = String(err?.message || err || "unknown");
    const failStep = pickStr(context?.function, context?.failStep, "init_error");
    publishChatDetailLoadDiag({
      chatDetailLoadOk: false,
      chatLoadReady: false,
      chatDetailLoadErrorReason: reason,
      failStep,
      failReason: reason,
      errorName: pickStr(err?.name),
      errorMessage: pickStr(err?.message) || reason,
      errorStackHead: pickStr(String(err?.stack || "").split("\n")[0]),
      failedModule: pickStr(context?.module),
      failedFunction: pickStr(context?.function),
      initTrace: __chatDetailInitTrace.slice(-48),
    });
  }

  function publishBenchThreadResolveDiag(patch) {
    try {
      window.__tasuBenchThreadResolveDiag = {
        traceName: "thread解決内部トレース",
        ...(window.__tasuBenchThreadResolveDiag || {}),
        ...(patch || {}),
        at: new Date().toISOString(),
      };
    } catch {
      /* ignore */
    }
  }

  function ensureBenchThreadResolveDiagInitialized() {
    publishBenchThreadResolveDiag({
      phase: "init",
      urlThreadId: "",
      queryListingId: "",
      queryApplicationId: "",
      queryUserId: "",
      ensureCalled: false,
      failStep: "",
      failReason: "",
      finalResult: "",
    });
  }

  function buildThreadResolveQuerySnap(q, threadId) {
    const query = q || {};
    const urlThreadId = pickStr(threadId, query.thread, query.roomId);
    const queryListingId = pickStr(query.listingId);
    const queryApplicationId = pickStr(query.applicationId);
    const queryUserId = pickStr(query.userId);
    const store = window.TasuChatThreadStore;
    let applicationsCount = 0;
    let applicationFoundById = false;
    try {
      applicationsCount = (window.TasuJobApplicationsStore?.readAll?.() || []).length;
      applicationFoundById = Boolean(
        queryListingId &&
          queryApplicationId &&
          window.TasuJobApplicationsStore?.findApplication?.(queryListingId, queryApplicationId)
      );
    } catch {
      /* ignore */
    }
    return {
      urlThreadId,
      queryListingId,
      queryApplicationId,
      queryUserId,
      applicationsCount,
      applicationFoundById,
      threadStoreCount: (store?.readAll?.() || []).length,
      threadExistsByUrlThreadId: urlThreadId ? Boolean(store?.threadExists?.(urlThreadId)) : false,
    };
  }

  function publishThreadResolveQueryParsed(q, threadId) {
    publishBenchThreadResolveDiag({
      phase: "query_parsed",
      ...buildThreadResolveQuerySnap(q, threadId),
    });
  }

  function readChatDetailLocationQuery() {
    try {
      const fromSvc = window.TasuChatService?.readLocationRoomParams?.();
      if (fromSvc && typeof fromSvc === "object") return fromSvc;
    } catch {
      /* ignore */
    }
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        thread: params.get("thread") || "",
        roomId: params.get("roomId") || "",
        listingId: params.get("listingId") || "",
        applicationId: params.get("applicationId") || "",
        userId: params.get("userId") || "",
        benchEmbed: params.get("benchEmbed") || "",
        review: params.get("review") || "",
        demoProfile: params.get("demoProfile") || "",
        liveFlow: params.get("liveFlow") || "",
        from: params.get("from") || "",
        openReview: params.get("openReview") || params.get("reviewOpen") || "",
        demoState: params.get("demoState") || "",
      };
    } catch {
      return {};
    }
  }

  function requiresMandatoryThreadResolve(q) {
    const query = q || readChatDetailLocationQuery();
    if (pickStr(query.benchEmbed) === "1") return true;
    if (pickStr(query.review) === "chat-demo") return true;
    if (pickStr(query.demoProfile) === "job") return true;
    if (isBenchEmbedChat()) return true;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("benchEmbed") === "1") return true;
      if (params.get("review") === "chat-demo") return true;
      if (params.get("demoProfile") === "job") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function buildResolveThreadAccessInput(q, roomId) {
    const query = q || {};
    const hinted = pickStr(query.thread, query.roomId, roomId);
    return {
      queryThread: hinted,
      queryRoomId: pickStr(query.roomId),
      listingId: query.listingId,
      applicationId: query.applicationId,
      queryUserId: query.userId,
    };
  }

  function publishThreadResolveFailure(phase, q, roomId, failStep, failReason) {
    publishBenchThreadResolveDiag({
      ...buildThreadResolveQuerySnap(q, roomId),
      phase,
      ensureCalled: true,
      finalResult: "fail",
      failStep: pickStr(failStep, "resolveThreadAccess"),
      failReason: pickStr(failReason, "unknown_thread_resolve_failure"),
    });
  }

  function runMandatoryThreadResolvePipeline(q, roomId) {
    const input = buildResolveThreadAccessInput(q, roomId);
    const ensureResult = invokeEnsureJobThreadForAccess(pickStr(roomId, input.queryThread), q);
    const resolveAccess = invokeResolveThreadAccess(input, q);
    let resolvedId = pickStr(
      resolveAccess?.ok ? resolveAccess.threadId : "",
      ensureResult?.correctThreadId,
      ensureResult?.thread?.id
    );
    if (!resolvedId && pickStr(q.listingId) && pickStr(q.applicationId)) {
      try {
        const ensured = window.TasuChatThreadStore?.ensureChatThreadForAcceptedJob?.({
          listing: window.TasuJobApplicationsStore?.resolveListing?.(q.listingId),
          application: window.TasuJobApplicationsStore?.findApplication?.(q.listingId, q.applicationId),
          thread: {
            id: pickStr(input.queryThread),
            listingId: q.listingId,
            applicationId: q.applicationId,
          },
        });
        resolvedId = pickStr(ensured?.thread?.id);
        if (resolvedId) {
          publishBenchThreadResolveDiag({
            ...buildThreadResolveQuerySnap(q, resolvedId),
            phase: "ensure_chat_thread_ok",
            ensureCalled: true,
            finalResult: "ok",
            resolvedThreadId: resolvedId,
            failStep: "",
            failReason: "",
          });
        }
      } catch (error) {
        publishThreadResolveFailure(
          "ensure_chat_thread_catch",
          q,
          roomId,
          "ensureChatThreadForAcceptedJob",
          pickStr(error?.message, "ensure_chat_thread_throw")
        );
      }
    }
    if (!resolvedId && !resolveAccess?.ok) {
      const storeDiag = window.__tasuBenchThreadResolveDiag || {};
      if (!pickStr(storeDiag.failStep) && !pickStr(storeDiag.failReason)) {
        publishThreadResolveFailure(
          "mandatory_resolve_fail",
          q,
          roomId,
          "resolveThreadAccess",
          pickStr(resolveAccess?.reason, ensureResult?.reason, "thread_not_found")
        );
      }
    }
    return { ensureResult, resolveAccess, resolvedId: pickStr(resolvedId) };
  }

  function bootstrapBenchThreadResolveDiagSync() {
    ensureBenchThreadResolveDiagInitialized();
    const q = readChatDetailLocationQuery();
    const roomId = pickStr(
      q.thread,
      q.roomId,
      window.TasuChatService?.getRoomIdFromLocation?.()
    );
    publishThreadResolveQueryParsed(q, roomId);
  }

  function storePublishedRichThreadResolveDiag() {
    const diag = window.__tasuBenchThreadResolveDiag || {};
    return Boolean(
      pickStr(diag.urlThreadId) &&
        (pickStr(diag.failStep) ||
          pickStr(diag.failReason) ||
          pickStr(diag.resolvedThreadId) ||
          diag.finalResult === "ok" ||
          pickStr(diag.phase).startsWith("resolve_"))
    );
  }

  function publishThreadResolveFallback(phase, q, threadId, result) {
    const snap = buildThreadResolveQuerySnap(q, threadId);
    publishBenchThreadResolveDiag({
      ...snap,
      phase,
      ensureCalled: true,
      finalResult: result?.ok ? "ok" : "fail",
      resolvedThreadId: pickStr(result?.threadId, result?.correctThreadId, result?.thread?.id),
      ensureResultThreadId: pickStr(result?.correctThreadId, result?.thread?.id),
      failStep: result?.ok ? "" : pickStr(result?.failStep, "resolveThreadAccess"),
      failReason: result?.ok
        ? ""
        : pickStr(result?.failReason, result?.reason, "unknown_thread_resolve_failure"),
    });
  }

  function invokeResolveThreadAccess(input, q) {
    const snap = buildThreadResolveQuerySnap(q, input?.queryThread);
    publishBenchThreadResolveDiag({
      ...snap,
      phase: "before_resolve",
      ensureCalled: true,
    });
    let access = null;
    let err = null;
    try {
      access = window.TasuChatThreadStore?.resolveThreadAccess?.(input);
    } catch (error) {
      err = error;
      access = { ok: false, reason: String(error?.message || error || "resolve_throw") };
    }
    if (err) {
      publishThreadResolveFallback("resolve_catch", q, input?.queryThread, {
        ok: false,
        failStep: "resolveThreadAccess",
        failReason: pickStr(err?.message, "unknown_thread_resolve_failure"),
      });
      return access;
    }
    if (!storePublishedRichThreadResolveDiag()) {
      publishThreadResolveFallback(access?.ok ? "resolve_ok" : "resolve_fail", q, input?.queryThread, {
        ok: access?.ok === true,
        threadId: pickStr(access?.threadId),
        failStep: "resolveThreadAccess",
        failReason: pickStr(access?.reason, "unknown_thread_resolve_failure"),
      });
    } else {
      const storeDiag = window.__tasuBenchThreadResolveDiag || {};
      publishBenchThreadResolveDiag({
        ...snap,
        phase: access?.ok ? "resolve_ok" : "resolve_fail",
        ensureCalled: true,
        finalResult: access?.ok ? "ok" : "fail",
        resolvedThreadId: pickStr(storeDiag.resolvedThreadId, access?.threadId),
        failStep: access?.ok ? "" : pickStr(storeDiag.failStep, "resolveThreadAccess"),
        failReason: access?.ok
          ? ""
          : pickStr(storeDiag.failReason, access?.reason, "unknown_thread_resolve_failure"),
      });
    }
    return access;
  }

  function invokeEnsureJobThreadForAccess(threadId, q) {
    const id = pickStr(threadId);
    const snap = buildThreadResolveQuerySnap(q, id);
    publishBenchThreadResolveDiag({
      ...snap,
      phase: "before_resolve",
      ensureCalled: true,
      ensureInputPreferredThreadId: id,
    });
    let result = null;
    let err = null;
    try {
      result = window.TasuPlatformChatJobFlow?.ensureJobThreadForAccess?.(id);
    } catch (error) {
      err = error;
      result = { ok: false, reason: String(error?.message || error || "ensure_throw") };
    }
    if (err) {
      publishThreadResolveFallback("ensure_catch", q, id, {
        ok: false,
        failStep: "ensureJobThreadForAccess",
        failReason: pickStr(err?.message, "unknown_thread_resolve_failure"),
      });
      return result;
    }
    if (!storePublishedRichThreadResolveDiag()) {
      publishThreadResolveFallback(result?.ok ? "ensure_ok" : "ensure_fail", q, id, {
        ok: result?.ok === true,
        correctThreadId: pickStr(result?.correctThreadId, result?.thread?.id),
        thread: result?.thread,
        failStep: "ensureJobThreadForAccess",
        failReason: pickStr(result?.reason, "thread_not_found"),
      });
    } else {
      publishBenchThreadResolveDiag({
        phase: result?.ok ? "ensure_ok" : "ensure_fail",
        ensureCalled: true,
        ensureResultThreadId: pickStr(result?.correctThreadId, result?.thread?.id),
        finalResult: result?.ok ? "ok" : "fail",
        failStep: result?.ok ? "" : "ensureJobThreadForAccess",
        failReason: result?.ok ? "" : pickStr(result?.reason, "thread_not_found"),
      });
    }
    return result;
  }

  function publishThreadResolvePrepComplete(q, roomId) {
    const id = pickStr(roomId);
    const snap = buildThreadResolveQuerySnap(q, id);
    const threadExists = id ? Boolean(window.TasuChatThreadStore?.threadExists?.(id)) : false;
    const prior = window.__tasuBenchThreadResolveDiag || {};
    if (threadExists) {
      publishBenchThreadResolveDiag({
        ...snap,
        phase: "prep_complete",
        finalResult: "ok",
        resolvedThreadId: id,
        failStep: "",
        failReason: "",
      });
      return;
    }
    if (!pickStr(prior.failReason)) {
      publishBenchThreadResolveDiag({
        ...snap,
        phase: "prep_complete",
        finalResult: "fail",
        failStep: pickStr(prior.failStep, "prep"),
        failReason: pickStr(prior.failReason, id ? "url_thread_not_in_store" : "missing_room_id"),
      });
      return;
    }
    publishBenchThreadResolveDiag({
      ...snap,
      phase: "prep_complete",
      finalResult: "fail",
    });
  }

  function readThreadResolveTrace() {
    const trace = window.__tasuBenchThreadResolveDiag || {};
    return {
      traceName: pickStr(trace.traceName, "thread解決内部トレース"),
      ...trace,
    };
  }

  function buildEffectiveResolvedAccess(priorResolved, roomId) {
    const id = pickStr(roomId, priorResolved?.roomId);
    const store = window.TasuChatThreadStore;
    const threadExists = id ? Boolean(store?.threadExists?.(id)) : false;
    const roomExists = id
      ? Boolean(store?.roomExists?.(id) || store?.loadRoom?.(id)?.thread)
      : false;
    return {
      ...(priorResolved || {}),
      ok: Boolean(id) && (threadExists || roomExists || priorResolved?.ok === true),
      roomId: id,
      threadExists,
      roomExists,
    };
  }

  function captureChatDetailQueryDiag(resolved, extra) {
    const access = resolved || window.TasuChatService.resolveRoomIdFromLocation?.() || {};
    const q = access.query || window.TasuChatService.readLocationRoomParams?.() || {};
    const threadId = pickStr(extra?.resolvedThreadId, access.roomId);
    const store = window.TasuChatThreadStore;
    const messageStoreCount = threadId ? (store?.getMessages?.(threadId) || []).length : 0;
    const jobAccess = extra?.ensureJobThreadForAccess || null;
    const threadExists = threadId ? Boolean(store?.threadExists?.(threadId)) : false;
    const roomExists = threadId
      ? Boolean(store?.roomExists?.(threadId) || store?.loadRoom?.(threadId)?.thread)
      : false;
    const chatInput = document.getElementById("chatInput");
    const composerRendered =
      Boolean(chatInput) &&
      !chatInput.hidden &&
      globalThis.getComputedStyle(chatInput).display !== "none";
    return {
      currentUrl: pickStr(window.location?.href),
      chatDetailQueryThread: pickStr(q.thread),
      chatDetailQueryRoomId: pickStr(q.roomId),
      chatDetailListingId: pickStr(q.listingId),
      chatDetailApplicationId: pickStr(q.applicationId),
      chatDetailResolvedThreadId: threadId,
      chatDetailResolvedRoomId: threadId,
      chatDetailLookupKey: pickStr(access.lookupKey),
      chatDetailThreadExists: threadExists,
      chatDetailRoomExists: roomExists,
      chatDetailThreadResolved: threadExists,
      chatDetailRoomResolved: roomExists,
      composerRendered,
      ensureJobThreadForAccessOk: jobAccess?.ok === true,
      ensureJobThreadForAccessReason: pickStr(jobAccess?.reason),
      ensureJobThreadForAccessThreadId: pickStr(jobAccess?.correctThreadId, jobAccess?.thread?.id),
      currentUserId: pickStr(window.TasuChatUserIdentity?.getEffectiveUserId?.()),
      storageKey: pickStr(store?.STORAGE_KEY, "tasful_chat_threads"),
      messageStoreCount,
      listingId: pickStr(q.listingId),
      applicationId: pickStr(q.applicationId),
      dealId: pickStr(q.dealId),
      benchEmbed: pickStr(q.benchEmbed),
      liveFlow: pickStr(q.liveFlow),
      demoProfile: pickStr(q.demoProfile),
      review: pickStr(q.review),
      role: pickStr(q.role),
      userId: pickStr(q.userId),
      threadResolveTrace: readThreadResolveTrace(),
      threadResolveFailStep: pickStr(window.__tasuBenchThreadResolveDiag?.failStep),
      threadResolveFailReason: pickStr(window.__tasuBenchThreadResolveDiag?.failReason),
    };
  }

  function canonicalizeChatDetailThreadInUrl(threadId) {
    const id = pickStr(threadId);
    if (!id) return;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("roomId");
      u.searchParams.delete("room");
      u.searchParams.delete("chatId");
      u.searchParams.set("thread", id);
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash || ""}`);
    } catch {
      /* ignore */
    }
  }

  async function init() {
    const messagesEl = document.getElementById("chatMessages");
    let resolved = {};
    let roomId = "";
    let q = {};
    let mandatoryResolveDone = false;
    let lastMandatoryPipeline = null;

    chatDetailLoadWallMs = Date.now();
    if (hasReviewAutoOpenIntent()) {
      logReviewAutoOpen("chat_detail_load_start", {
        notifyClickWall: readReviewNotifyClickWall(),
      });
    }

    resetChatDetailInitTrace();
    logChatDetailInitStep("init:start", readInitContextFields({}, ""));
    try {
      window.parent?.postMessage?.({ type: "tasu-chat-detail-init", threadId: "", step: "start" }, "*");
    } catch {
      /* ignore */
    }

    try {
      publishBenchThreadResolveDiag({ phase: "init" });
      publishChatDetailLoadDiag({
        chatDetailReached: /chat-detail\.html/i.test(
          pickStr(window.location?.pathname, window.location?.href)
        ),
        chatDetailInitStarted: true,
        composerRendered: false,
        chatDetailThreadResolved: false,
        chatDetailRoomResolved: false,
        chatDetailLoadOk: false,
        chatLoadReady: false,
        ...readInitContextFields({}, ""),
      });
      logChatDetailInitStep("prep:bench_thread_resolve_diag");
      window.TasuPlatformChatCompletion?.ensureDemoSkillDealThread?.();
      logChatDetailInitStep("prep:ensure_demo_skill_deal_thread");
      resolved = window.TasuChatService.resolveRoomIdFromLocation?.() || {};
      activeRoomId = pickStr(resolved.roomId, window.TasuChatService.getRoomIdFromLocation());
      roomId = activeRoomId;
      q = resolved.query || readChatDetailLocationQuery();
      logChatDetailInitStep("prep:resolve_room_from_location", {
        roomId,
        ...readInitContextFields(q, roomId),
      });
      publishThreadResolveQueryParsed(q, activeRoomId);

      if (requiresMandatoryThreadResolve(q)) {
        logChatDetailInitStep("prep:mandatory_thread_resolve_required");
        lastMandatoryPipeline = runMandatoryThreadResolvePipeline(q, roomId);
        mandatoryResolveDone = true;
        logChatDetailInitStep("prep:mandatory_thread_resolve_done", {
          resolvedId: pickStr(lastMandatoryPipeline?.resolvedId),
          ensureReason: pickStr(lastMandatoryPipeline?.ensureResult?.reason),
          resolveReason: pickStr(lastMandatoryPipeline?.resolveAccess?.reason),
        });
        if (lastMandatoryPipeline.resolvedId) {
          activeRoomId = lastMandatoryPipeline.resolvedId;
          roomId = lastMandatoryPipeline.resolvedId;
          canonicalizeChatDetailThreadInUrl(lastMandatoryPipeline.resolvedId);
          resolved = buildEffectiveResolvedAccess(resolved, lastMandatoryPipeline.resolvedId);
        }
      } else {
        const needsThreadRecovery =
          !roomId || resolved.threadExists === false || resolved.roomExists === false;
        if (needsThreadRecovery) {
          logChatDetailInitStep("prep:thread_recovery_required", {
            threadExists: resolved.threadExists,
            roomExists: resolved.roomExists,
          });
          lastMandatoryPipeline = runMandatoryThreadResolvePipeline(q, roomId);
          mandatoryResolveDone = true;
          logChatDetailInitStep("prep:thread_recovery_done", {
            resolvedId: pickStr(lastMandatoryPipeline?.resolvedId),
          });
          if (lastMandatoryPipeline.resolvedId) {
            activeRoomId = lastMandatoryPipeline.resolvedId;
            roomId = lastMandatoryPipeline.resolvedId;
            canonicalizeChatDetailThreadInUrl(lastMandatoryPipeline.resolvedId);
            resolved = buildEffectiveResolvedAccess(resolved, lastMandatoryPipeline.resolvedId);
          }
        }
      }

      publishChatDetailLoadDiag(
        captureChatDetailQueryDiag(resolved, {
          resolvedThreadId: roomId,
          ensureJobThreadForAccess: lastMandatoryPipeline?.ensureResult,
        })
      );

      if (!roomId) {
        logChatDetailInitStep("prep:missing_room_id");
        if (!mandatoryResolveDone) {
          runMandatoryThreadResolvePipeline(q, "");
          mandatoryResolveDone = true;
        } else {
          invokeResolveThreadAccess(buildResolveThreadAccessInput(q, ""), q);
        }
        publishInitExit("return:missing_room_id", {
          failStep: "init",
          failReason: "missing_room_id",
          q,
          roomId: "",
        });
        window.location.href = "chat-list.html";
        return;
      }

      if (
        pickStr(resolved.query?.thread) &&
        pickStr(resolved.query?.roomId) &&
        pickStr(resolved.query.thread) !== pickStr(resolved.query.roomId)
      ) {
        canonicalizeChatDetailThreadInUrl(roomId);
        publishChatDetailLoadDiag({
          chatDetailUrlCanonicalized: true,
          chatDetailRecoveredFrom: pickStr(resolved.recoveredFrom, resolved.query.roomId),
        });
      }

      if (!mandatoryResolveDone && requiresMandatoryThreadResolve(q)) {
        lastMandatoryPipeline = runMandatoryThreadResolvePipeline(q, roomId);
        mandatoryResolveDone = true;
        if (lastMandatoryPipeline.resolvedId) {
          activeRoomId = lastMandatoryPipeline.resolvedId;
          roomId = lastMandatoryPipeline.resolvedId;
          canonicalizeChatDetailThreadInUrl(lastMandatoryPipeline.resolvedId);
          resolved = buildEffectiveResolvedAccess(resolved, lastMandatoryPipeline.resolvedId);
        }
      } else if (!mandatoryResolveDone) {
        const urlThreadId = pickStr(q.thread, q.roomId);
        const jobAccess = invokeEnsureJobThreadForAccess(roomId, q);
        lastMandatoryPipeline = { ensureResult: jobAccess, resolveAccess: null, resolvedId: "" };
        if (
          jobAccess?.correctThreadId &&
          jobAccess.correctThreadId !== roomId &&
          (!urlThreadId || jobAccess.correctThreadId === urlThreadId)
        ) {
          activeRoomId = jobAccess.correctThreadId;
          roomId = jobAccess.correctThreadId;
          canonicalizeChatDetailThreadInUrl(jobAccess.correctThreadId);
          resolved = buildEffectiveResolvedAccess(resolved, jobAccess.correctThreadId);
          lastMandatoryPipeline.resolvedId = jobAccess.correctThreadId;
        } else {
          const access = invokeResolveThreadAccess(buildResolveThreadAccessInput(q, roomId), q);
          lastMandatoryPipeline.resolveAccess = access;
          const accessId = pickStr(access?.threadId);
          if (access?.ok && accessId) {
            activeRoomId = accessId;
            roomId = accessId;
            resolved = buildEffectiveResolvedAccess(resolved, accessId);
            lastMandatoryPipeline.resolvedId = accessId;
          }
        }
      }
      window.TasuPlatformChatDualWindowDemo?.ensureDemoThreadForAccess?.(
        activeRoomId || roomId
      );

      window.TasuChatService.syncRoomIdInUrl?.(activeRoomId || roomId);
      const effectiveRoomId = pickStr(activeRoomId, roomId);
      resolved = buildEffectiveResolvedAccess(resolved, effectiveRoomId);
      publishThreadResolvePrepComplete(q, effectiveRoomId);
      logChatDetailInitStep("prep:complete", readInitContextFields(q, effectiveRoomId));
      try {
        window.parent?.postMessage?.(
          { type: "tasu-chat-detail-init", threadId: pickStr(effectiveRoomId), step: "prep" },
          "*"
        );
      } catch {
        /* ignore */
      }
      publishChatDetailLoadDiag(
        captureChatDetailQueryDiag(resolved, { resolvedThreadId: effectiveRoomId })
      );

      if (hasReviewViewIntent()) {
        tryOpenReviewsFromNotify({
          phase: "post_prep_sync",
          threadId: effectiveRoomId,
        });
      } else if (hasReviewAutoOpenIntent()) {
        tryOpenReviewFromNotify({
          phase: "post_prep_sync",
          threadId: effectiveRoomId,
        });
      }
    } catch (prepErr) {
      console.warn("[TasuChat] chat detail prep failed:", prepErr);
      logChatDetailInitStep("catch:prep", {
        error: pickStr(prepErr?.message, String(prepErr)),
        ...readInitContextFields(q, roomId),
      });
      publishThreadResolveFailure(
        "prep_catch",
        q,
        roomId,
        "init:prep",
        pickStr(prepErr?.message, "unknown_thread_resolve_failure")
      );
      publishChatDetailLoadError(prepErr, { module: "chat-detail.js", function: "init:prep" });
      publishInitExit("return:prep_catch", {
        failStep: "init:prep",
        failReason: pickStr(prepErr?.message, "unknown_thread_resolve_failure"),
        q,
        roomId,
      });
      if (messagesEl) {
        messagesEl.innerHTML =
          `<p style="padding:1rem;color:#b45309;font-size:0.875rem;">読み込みに失敗しました</p>` +
          `<p style="padding:0 1rem 1rem;color:var(--color-text-muted);font-size:0.75rem;">原因: ${escapeHtml(String(prepErr?.message || prepErr))}</p>`;
      }
      return;
    }

    if (messagesEl) {
      messagesEl.innerHTML = `<p style="padding:1rem;color:var(--color-text-muted);font-size:0.875rem;">読み込み中…</p>`;
    }

    try {
      logChatDetailInitStep("load:start", readInitContextFields(q, roomId));
      try {
        bindContactGateUi();
        logChatDetailInitStep("load:bind_contact_gate_ui");
      } catch (gateErr) {
        console.warn("[TasuChat] bindContactGateUi failed:", gateErr);
        logChatDetailInitStep("catch:bind_contact_gate_ui", {
          error: pickStr(gateErr?.message, String(gateErr)),
        });
        publishChatDetailLoadError(gateErr, { module: "chat-detail.js", function: "bindContactGateUi" });
      }
      await window.TasuChatService.ensureInitialized();
      logChatDetailInitStep("load:chat_service_initialized");
      if (hasReviewViewIntent() && !reviewViewAutoOpenConsumed) {
        tryOpenReviewsFromNotify({
          phase: "post_chat_service_init",
          threadId: getActiveRoomId() || roomId,
        });
      } else if (hasReviewAutoOpenIntent() && !reviewAutoOpenConsumed) {
        tryOpenReviewFromNotify({
          phase: "post_chat_service_init",
          threadId: getActiveRoomId() || roomId,
        });
      }
      let resolvedRoomId = getActiveRoomId() || roomId;
      if (requiresMandatoryThreadResolve(q)) {
        const preLoadPipeline = runMandatoryThreadResolvePipeline(q, resolvedRoomId);
        mandatoryResolveDone = true;
        lastMandatoryPipeline = preLoadPipeline;
        if (preLoadPipeline.resolvedId) {
          activeRoomId = preLoadPipeline.resolvedId;
          resolvedRoomId = preLoadPipeline.resolvedId;
          window.TasuChatService.syncRoomIdInUrl?.(preLoadPipeline.resolvedId);
        }
      } else {
        invokeResolveThreadAccess(buildResolveThreadAccessInput(q, resolvedRoomId), q);
      }
      syncPurchasePaymentMethodForRoom(resolvedRoomId);
      let { thread, messages } = await window.TasuChatService.loadMessages(resolvedRoomId);
      const paymentSync = syncPurchasePaymentMethodForRoom(thread || resolvedRoomId);
      if (paymentSync?.changed && resolvedRoomId) {
        ({ thread, messages } = await window.TasuChatService.loadMessages(resolvedRoomId));
      }
      logChatDetailInitStep("load:load_messages", {
        resolvedRoomId,
        threadFound: Boolean(thread),
        messageCount: Array.isArray(messages) ? messages.length : 0,
      });
      if (!thread) {
        const recoveredPipeline = runMandatoryThreadResolvePipeline(q, resolvedRoomId);
        lastMandatoryPipeline = recoveredPipeline;
        const recoveredId = pickStr(
          recoveredPipeline.resolvedId,
          recoveredPipeline.resolveAccess?.threadId,
          recoveredPipeline.ensureResult?.correctThreadId,
          recoveredPipeline.ensureResult?.thread?.id
        );
        if (recoveredId && recoveredId !== resolvedRoomId) {
          activeRoomId = recoveredId;
          resolvedRoomId = recoveredId;
          window.TasuChatService.syncRoomIdInUrl?.(recoveredId);
          ({ thread, messages } = await window.TasuChatService.loadMessages(recoveredId));
        }
      }
      if (thread && syncFlowCardsFromStore(thread)) {
        ({ messages } = await window.TasuChatService.loadMessages(resolvedRoomId));
      }
      const room = applyCurrentRoom(thread, resolvedRoomId, messages);
      logChatDetailInitStep("load:apply_current_room", {
        resolvedRoomId,
        roomApplied: Boolean(room),
      });
      if (hasReviewViewIntent() && !reviewViewAutoOpenConsumed) {
        tryOpenReviewsFromNotify({
          phase: "post_apply_current_room",
          threadId: resolvedRoomId,
          thread: thread || room,
        });
      } else if (hasReviewAutoOpenIntent() && !reviewAutoOpenConsumed) {
        tryOpenReviewFromNotify({
          phase: "post_apply_current_room",
          threadId: resolvedRoomId,
          thread: thread || room,
        });
      }
      partnerLastReadAt = thread?.partnerLastReadAt || room?.partnerLastReadAt || "";
      if (room) {
        room.partnerLastReadAt = partnerLastReadAt;
      }

      if (!room) {
        logChatDetailInitStep("load:room_not_found", readInitContextFields(q, resolvedRoomId));
        teardownRealtime();
        const failPipeline = runMandatoryThreadResolvePipeline(q, resolvedRoomId);
        invokeResolveThreadAccess(buildResolveThreadAccessInput(q, resolvedRoomId), q);
        const jobAccessFail = failPipeline.ensureResult;
        publishThreadResolveFailure(
          "room_not_found",
          q,
          resolvedRoomId,
          "loadMessages",
          pickStr(jobAccessFail?.reason, failPipeline.resolveAccess?.reason, "room_not_found")
        );
        const roomFailReason = pickStr(
          jobAccessFail?.reason,
          failPipeline.resolveAccess?.reason,
          "room_not_found"
        );
        publishInitExit("return:room_not_found", {
          failStep: "loadMessages",
          failReason: roomFailReason,
          q,
          roomId: resolvedRoomId,
        });
        showRoomNotFound(messagesEl, resolvedRoomId || roomId);
        return;
      }

      logChatDetailInitStep("load:check_management_redirect");
      if (enforceManagementRedirect(currentRoom || room)) {
        logChatDetailInitStep("exit:management_redirect");
        return;
      }

      const inlineError = document.getElementById("chatInlineError");
      if (inlineError) {
        inlineError.textContent = "";
        inlineError.style.display = "none";
      }

      let gated = false;
      try {
        gated = renderRoomMessagesOrGate(currentRoom || room, messages);
        logChatDetailInitStep("load:render_room_messages_or_gate", { gated });
      } catch (renderErr) {
        console.warn("[TasuChat] renderRoomMessagesOrGate failed:", renderErr);
        logChatDetailInitStep("catch:render_room_messages_or_gate", {
          error: pickStr(renderErr?.message, String(renderErr)),
        });
        publishChatDetailLoadError(renderErr, {
          module: "chat-detail.js",
          function: "renderRoomMessagesOrGate",
        });
        publishChatDetailLoadDiag({
          chatDetailLoadErrorReason: `render_failed:${String(renderErr?.message || renderErr)}`,
        });
        try {
          syncDisplayMessages(messages);
        } catch {
          /* ignore */
        }
      }
      if (!gated) {
        try {
          await ensurePreChatStartFeeUi(currentRoom || room);
        } catch (feeUiErr) {
          console.warn("[TasuChat] ensurePreChatStartFeeUi failed:", feeUiErr);
        }
      }
      scrollToBottomAfterPaint({ force: true });
      try {
        setHeader(currentRoom || room);
        updateCompleteButton(currentRoom || room);
      } catch (headerErr) {
        console.warn("[TasuChat] setHeader failed:", headerErr);
        publishChatDetailLoadError(headerErr, { module: "chat-detail.js", function: "setHeader" });
        publishChatDetailLoadDiag({
          chatDetailLoadErrorReason: `header_failed:${String(headerErr?.message || headerErr)}`,
        });
      }

      applyRoomLifecycleUiAfterLoad();

      const rid = getActiveRoomId() || roomId;
      if (isRoomRealtimeAllowed()) {
        try {
          startRealtimeSubscription(rid);
        } catch (err) {
          console.warn("[TasuChat] Realtime subscribe failed:", err);
        }
        try {
          await markOpenRoomRead(rid);
        } catch (err) {
          console.warn("[TasuChat] markOpenRoomRead failed:", err);
        }
      }

      try {
        await refreshRoomBlockStatus();
        applyRoomComposerState();
      } catch (err) {
        console.warn("[TasuChat] block status apply failed:", err);
      }

      bindComposerFocus();
      bindReportUi();
      bindCompleteUi();
      bindReviewUi();
      bindCrossWindowSync();
      bindBenchEmbedScrollPreserve();

      try {
        await initBusinessDealPanel();
      } catch (err) {
        console.warn("[TasuChat] deal panel init failed:", err);
      }

      const attachBtn = document.getElementById("chatAttach");
      const sendBtn = document.getElementById("chatSend");
      const input = document.getElementById("chatInput");
      const fileInput = document.getElementById("chatFileInput");
      if (attachBtn) attachBtn.addEventListener("click", onAttachClick);
      if (fileInput) fileInput.addEventListener("change", onFileSelected);

      const meId = getMeId();
      const me =
        window.TasuChatUserIdentity?.getProfileForUserId?.(meId) ||
        (room.me?.id && String(room.me.id) === String(meId)
          ? room.me
          : {
              id: meId,
              displayName: getMeDisplayName(room),
              avatarUrl: room.me?.avatarUrl || "",
            });

      if (sendBtn) {
        sendBtn.addEventListener("click", () => onSend(me));
      }
      bindComposerInput(me);

      try {
        const pendingApply = window.TasuTalkPendingDraftMessage?.tryApplyToChatComposer?.({
          roomId: pickStr(getActiveRoomId(), resolvedRoomId, roomId),
          listingId: pickStr(currentRoom?.listingId, thread?.listingId, room?.listingId, q.listingId),
        });
        if (pendingApply?.ok) {
          logChatDetailInitStep("pending_draft_applied", { draftId: pendingApply.draftId || "" });
        }
      } catch (pendingErr) {
        console.warn("[TasuChat] pending draft apply failed:", pendingErr);
      }

      document.body.dataset.chatDetailReady = "true";
      window.__tasuChatDetailReady = true;
      try {
        window.parent?.postMessage?.(
          {
            type: "tasu-chat-detail-ready",
            threadId: pickStr(getActiveRoomId(), roomId),
            chatLoadReady: true,
          },
          "*"
        );
      } catch {
        /* ignore */
      }
      const chatInputEl = document.getElementById("chatInput");
      const composerRendered =
        Boolean(chatInputEl) &&
        !chatInputEl.hidden &&
        globalThis.getComputedStyle(chatInputEl).display !== "none";
      const successRoomId = pickStr(getActiveRoomId(), roomId);
      publishBenchThreadResolveDiag({
        ...buildThreadResolveQuerySnap(q, successRoomId),
        phase: "init_complete",
        ensureCalled: true,
        finalResult: "ok",
        resolvedThreadId: successRoomId,
        failStep: "",
        failReason: "",
      });
      logChatDetailInitStep("init:complete", {
        successRoomId,
        composerRendered,
        ...readInitContextFields(q, successRoomId),
      });
      try {
        window.parent?.postMessage?.(
          { type: "tasu-chat-detail-init", threadId: successRoomId, step: "complete" },
          "*"
        );
      } catch {
        /* ignore */
      }
      publishChatDetailLoadDiag({
        ...captureChatDetailQueryDiag(resolved, {
          resolvedThreadId: successRoomId,
          ensureJobThreadForAccess: lastMandatoryPipeline?.ensureResult,
        }),
        chatDetailLoadOk: true,
        chatLoadReady: true,
        chatDetailLoadErrorReason: "",
        failStep: "",
        failReason: "",
        composerEnabled: !chatInputEl?.disabled,
        composerRendered,
        chatDetailThreadResolved: true,
        chatDetailRoomResolved: true,
        initTrace: __chatDetailInitTrace.slice(-48),
        ...readInitContextFields(q, successRoomId),
      });
      refreshBenchJobEndDebug();
      scrollToBottomAfterPaint({ force: true });
      if (hasReviewViewIntent() && !reviewViewAutoOpenConsumed) {
        tryOpenReviewsFromNotify({ phase: "init_complete_fallback" });
      } else if (hasReviewAutoOpenIntent() && !reviewAutoOpenConsumed) {
        tryOpenReviewFromNotify({ phase: "init_complete_fallback" });
      }
    } catch (err) {
      teardownRealtime();
      const reason = String(err?.message || err || "unknown");
      console.warn("[TasuChat] chat detail init failed:", err);
      logChatDetailInitStep("catch:init_load", {
        error: reason,
        ...readInitContextFields(q, roomId),
      });
      publishThreadResolveFailure("init_load_catch", q, roomId, "init:load", reason);
      publishChatDetailLoadError(err, { module: "chat-detail.js", function: "init:load" });
      if (messagesEl) {
        messagesEl.innerHTML =
          `<p style="padding:1rem;color:#b45309;font-size:0.875rem;">読み込みに失敗しました</p>` +
          `<p style="padding:0 1rem 1rem;color:var(--color-text-muted);font-size:0.75rem;">原因: ${escapeHtml(reason)}</p>`;
      }
    }
  }

  window.addEventListener("pagehide", teardownRealtime);

  window.TasuChatDetailUi = {
    showFlowError: showFlowInlineError,
    openReviewModal,
    tryOpenReviewFromNotify,
    tryOpenReviewsFromNotify,
    openReceivedReviewViewModal,
    logReviewAutoOpen,
    afterFlowApprove,
    applyFlowActionImmediate,
    afterFlowReportPaid,
    afterFlowPurchaseBankReport,
    afterFlowPurchaseBankConfirm,
    afterFlowDepositConfirm,
    rejectConnectCompletion: onConnectRejectSubmit,
    confirmDepositCompletion: onConfirmDepositSubmit,
    setFlowActionPending,
    refreshBenchJobEndDebug,
  };
  window.__tasuRefreshJobEndDebug = refreshBenchJobEndDebug;

  document.addEventListener("tasu:connect-completion-approved", (ev) => {
    const res = ev?.detail?.result;
    if (res?.ok) void afterFlowApprove(res);
  });
  document.addEventListener("tasu:manual-deposit-confirmed", (ev) => {
    const res = ev?.detail?.result;
    if (res?.ok) void afterFlowDepositConfirm(res);
  });

  window.addEventListener("message", (ev) => {
    const msgType = pickStr(ev?.data?.type);
    if (msgType === "tasu-chat-open-review") {
      const tid = pickStr(ev.data.threadId, getActiveRoomId());
      const activeId = getActiveRoomId();
      void (async () => {
        reviewAutoOpenConsumed = false;
        try {
          const u = new URL(window.location.href);
          if (tid) u.searchParams.set("thread", tid);
          u.searchParams.set("openReview", "1");
          u.searchParams.set("from", "notify");
          u.searchParams.set("demoState", "completed");
          window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
        } catch {
          /* ignore */
        }
        if (tid && activeId && tid !== activeId) {
          activeRoomId = tid;
        }
        await reloadRoomStateFromStore();
        const phases = ["postmessage_fallback", "postmessage_retry_1", "postmessage_retry_2"];
        for (let i = 0; i < phases.length; i += 1) {
          const res = await tryOpenReviewFromNotify({
            phase: phases[i],
            threadId: tid,
            forceRetry: i > 0,
          });
          if (res?.ok === true) return;
          if (res?.reason !== "not_eligible" && res?.reason !== "no_thread") return;
          await new Promise((resolve) => window.setTimeout(resolve, i === 0 ? 80 : 160));
        }
      })();
      return;
    }
    if (msgType === "tasu-chat-open-reviews") {
      const tid = pickStr(ev.data.threadId, getActiveRoomId());
      const activeId = getActiveRoomId();
      if (tid && activeId && tid !== activeId) return;
      const reviewerId = pickStr(ev.data.reviewerId);
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("openReviews", "1");
        u.searchParams.set("from", "notify");
        u.searchParams.set("demoState", "completed");
        if (reviewerId) u.searchParams.set("reviewerId", reviewerId);
        window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
      } catch {
        /* ignore */
      }
      tryOpenReviewsFromNotify({
        phase: "postmessage_fallback",
        threadId: tid,
        reviewerId,
      });
      return;
    }
    if (msgType !== "tasu-chat-reload-room") return;
    const tid = pickStr(ev.data.threadId, getActiveRoomId());
    const activeId = getActiveRoomId();
    const softBenchSync = /bench_soft|bench_chat_refresh|bench_flow_immediate|approval_immediate|product_shipped|storage_frozen/i.test(
      pickStr(ev.data.reason)
    );
    if (!softBenchSync && tid && activeId && tid !== activeId) return;
    if (reloadRoomStateTimer) {
      clearTimeout(reloadRoomStateTimer);
      reloadRoomStateTimer = 0;
    }
    void reloadRoomStateFromStore().then(() => {
      if (
        (ev?.data?.openReview === true || ev?.data?.openReview === "1") &&
        !reviewAutoOpenConsumed
      ) {
        tryOpenReviewFromNotify({ phase: "reload_room_postmessage_fallback" });
      }
    });
  });

  installFlowCardDocumentBridge();

  bootstrapBenchThreadResolveDiagSync();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", () => scrollToBottomAfterPaint({ force: true }));
})();

