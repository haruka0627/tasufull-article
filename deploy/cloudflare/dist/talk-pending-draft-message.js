/**
 * AI Workspace 問い合わせ下書き → chat-detail 入力欄反映（自動送信なし）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "pendingDraftMessage";
  const BANNER_HTML =
    '<span class="chat-pending-draft-banner__lead">問い合わせ文を入力欄に反映しました</span>' +
    '<span class="chat-pending-draft-banner__warn">まだ送信はされていません。</span>' +
    '<span class="chat-pending-draft-banner__hint">内容を確認して<br>右下の送信ボタンを押してください。</span>';
  const SOURCE = "ai_workspace";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function normalizePayload(raw) {
    const listingId = pickStr(raw?.listingId, raw?.itemId, raw?.vendorId, raw?.workerId);
    return {
      draftId: pickStr(raw?.draftId),
      roomId: pickStr(raw?.roomId),
      recipientId: pickStr(raw?.recipientId),
      listingId,
      itemId: pickStr(raw?.itemId),
      vendorId: pickStr(raw?.vendorId),
      workerId: pickStr(raw?.workerId),
      generatedSubject: String(raw?.generatedSubject ?? ""),
      generatedBody: String(raw?.generatedBody ?? ""),
      source: pickStr(raw?.source, SOURCE),
    };
  }

  function save(payload) {
    const row = normalizePayload(payload);
    if (!row.generatedBody.trim()) return false;
    try {
      global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(row));
      return true;
    } catch (err) {
      console.warn("[TasuTalkPendingDraftMessage] save failed:", err);
      return false;
    }
  }

  function read() {
    try {
      const raw = global.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizePayload(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function clear() {
    try {
      global.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function resolveListingForDraft(draft) {
    const listingId = pickStr(draft?.listingId, draft?.itemId, draft?.vendorId, draft?.workerId);
    if (!listingId) return null;

    const fromSeed = global.TasuPlatformChatDemoSeed?.resolveListing?.(listingId);
    if (fromSeed && pickStr(fromSeed.id, fromSeed.listing_id)) return fromSeed;

    const card = draft?.card && typeof draft.card === "object" ? draft.card : {};
    const title = pickStr(card.title) || listingId;
    let listingType = "business_service";
    if (pickStr(draft?.workerId)) listingType = "skill";
    else if (pickStr(draft?.itemId)) listingType = "product";
    else if (pickStr(draft?.jobId)) listingType = "job";

    return {
      id: listingId,
      listing_id: listingId,
      title,
      company_name: title,
      service_name: title,
      listing_type: listingType,
    };
  }

  function resolveRoomIdForDraft(draft) {
    const store = global.TasuChatThreadStore;
    if (!store) return { ok: false, reason: "no_thread_store" };

    const existingRoomId = pickStr(draft?.roomId);
    if (existingRoomId && store.threadExists?.(existingRoomId)) {
      return { ok: true, roomId: existingRoomId, created: false };
    }

    const listingId = pickStr(draft?.listingId, draft?.itemId, draft?.vendorId, draft?.workerId);
    if (!listingId) return { ok: false, reason: "missing_listing_id" };

    const buyerId =
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "demo-user";
    const open = store.findOpenThread?.(listingId, buyerId);
    if (open?.id) {
      return { ok: true, roomId: open.id, created: false, thread: open };
    }

    const listing = resolveListingForDraft(draft);
    if (!listing) return { ok: false, reason: "listing_not_found" };

    const result = store.createOrOpenThread?.(listing, { intent: "consult", feePending: false });
    if (!result?.ok || !result.thread?.id) {
      return { ok: false, reason: pickStr(result?.reason, "thread_create_failed") };
    }
    return {
      ok: true,
      roomId: result.thread.id,
      created: result.created === true,
      thread: result.thread,
    };
  }

  /**
   * @param {object} draft — TasuTalkInquiryDrafts row
   * @param {string} subject
   * @param {string} body
   */
  function saveFromInquiryDraft(draft, subject, body) {
    const generatedBody = String(body ?? "").trim();
    if (!generatedBody) return { ok: false, reason: "empty_body" };

    const room = resolveRoomIdForDraft(draft);
    if (!room.ok) return room;

    const payload = normalizePayload({
      draftId: draft?.id,
      roomId: room.roomId,
      recipientId: draft?.recipientId,
      listingId: draft?.listingId,
      itemId: draft?.itemId,
      vendorId: draft?.vendorId,
      workerId: draft?.workerId,
      generatedSubject: String(subject ?? draft?.generatedSubject ?? ""),
      generatedBody,
      source: SOURCE,
    });

    if (!save(payload)) return { ok: false, reason: "save_failed" };

    const url =
      global.TasuChatThreadStore?.chatDetailUrl?.(room.roomId, { from: SOURCE }) ||
      `chat-detail.html?thread=${encodeURIComponent(room.roomId)}&from=${encodeURIComponent(SOURCE)}`;

    return { ok: true, roomId: room.roomId, url, payload };
  }

  function matchesCurrentRoom(pending, roomId, listingId) {
    const rid = pickStr(roomId);
    const lid = pickStr(listingId);
    if (pending.roomId && rid && pending.roomId === rid) return true;
    const pendingListing = pickStr(
      pending.listingId,
      pending.itemId,
      pending.vendorId,
      pending.workerId
    );
    if (pendingListing && lid && pendingListing === lid) return true;
    return false;
  }

  function showBanner(composer) {
    const root = composer || global.document.querySelector(".chat-composer");
    if (!root) return;
    let el = root.querySelector("[data-chat-pending-draft-banner]");
    if (!el) {
      el = global.document.createElement("div");
      el.dataset.chatPendingDraftBanner = "";
      el.className = "chat-pending-draft-banner";
      el.setAttribute("role", "status");
      root.insertBefore(el, root.firstChild);
    }
    el.innerHTML = BANNER_HTML;
    el.hidden = false;
  }

  /**
   * chat-detail 起動後 — 入力欄へ下書き反映（送信はしない）
   * @param {{ roomId?: string, listingId?: string }} [options]
   */
  function tryApplyToChatComposer(options) {
    const pending = read();
    if (!pending || pending.source !== SOURCE) return { ok: false, skipped: true };
    if (!pending.generatedBody.trim()) {
      clear();
      return { ok: false, skipped: true, reason: "empty_body" };
    }

    const roomId = pickStr(options?.roomId);
    const listingId = pickStr(options?.listingId);
    if (!matchesCurrentRoom(pending, roomId, listingId)) {
      return { ok: false, skipped: true, reason: "room_mismatch" };
    }

    const input = global.document.getElementById("chatInput");
    if (!input) return { ok: false, skipped: true, reason: "no_input" };
    if (input.disabled) return { ok: false, skipped: true, reason: "composer_disabled" };

    input.value = pending.generatedBody;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    showBanner(options?.composer);
    clear();

    if (pending.draftId) {
      try {
        global.TasuTalkInquiryDrafts?.update?.(pending.draftId, { status: "ready_in_chat" });
      } catch {
        /* ignore */
      }
    }

    return { ok: true, applied: true, draftId: pending.draftId };
  }

  global.TasuTalkPendingDraftMessage = {
    STORAGE_KEY,
    BANNER_HTML,
    SOURCE,
    save,
    read,
    clear,
    resolveListingForDraft,
    resolveRoomIdForDraft,
    saveFromInquiryDraft,
    tryApplyToChatComposer,
  };
})(typeof window !== "undefined" ? window : globalThis);
