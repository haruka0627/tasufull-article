/**
 * TALK room ensure — Edge primary · Supabase insert fallback · LS は呼び出し元へ委譲
 * Ref: supabase/functions/ensure-talk-room · reports/talk-chat-unify-p0-p1-plan.md P1
 */
(function (global) {
  "use strict";

  const EDGE_FUNCTION_NAME = "ensure-talk-room";
  const STUB_ROOM_ID = "00000000-0000-4000-8000-000000000099";

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function isUuidRoomId(roomId) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      pickStr(roomId)
    );
  }

  function isTalkDevStubMode() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("talkDev") === "1") return true;
      if (params.get("client_stub") === "1") return true;
    } catch {
      /* ignore */
    }
    if (global.TasuPlatformChatDualWindowDemo?.isBenchSession?.() === true) return true;
    return false;
  }

  function shouldPreferEdgeEnsure() {
    if (isTalkDevStubMode()) return false;
    if (!global.TasuSupabase?.isConfigured?.()) return false;
    if (global.location?.protocol === "file:") return false;
    return true;
  }

  function getFunctionsBase() {
    const fromGlobal = pickStr(global.__MATCH_FUNCTIONS_BASE__);
    if (fromGlobal) return fromGlobal.replace(/\/$/, "");
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const url = pickStr(cfg.url, cfg.SUPABASE_URL).replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function getAuthToken() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    return pickStr(cfg.anonKey, cfg.anon_key);
  }

  function buildRedirectUrl(roomId, from) {
    const id = pickStr(roomId);
    if (!id) return "chat-detail.html";
    try {
      const u = new URL("chat-detail.html", global.location?.href || "http://localhost/");
      u.searchParams.set("room", id);
      u.searchParams.set("roomId", id);
      if (from) u.searchParams.set("from", from);
      return u.pathname + u.search;
    } catch {
      let href = `chat-detail.html?room=${encodeURIComponent(id)}&roomId=${encodeURIComponent(id)}`;
      if (from) href += `&from=${encodeURIComponent(from)}`;
      return href;
    }
  }

  function normalizeEnsureInput(input) {
    const raw = input && typeof input === "object" ? input : {};
    const listing = raw.listing && typeof raw.listing === "object" ? raw.listing : {};
    const contact = raw.contact && typeof raw.contact === "object" ? raw.contact : {};
    const application = raw.application && typeof raw.application === "object" ? raw.application : {};
    const request = raw.request && typeof raw.request === "object" ? raw.request : {};
    const deal = raw.deal && typeof raw.deal === "object" ? raw.deal : {};

    const listingId = pickStr(
      raw.listing_id,
      raw.listingId,
      listing.id,
      listing.listing_id
    );
    const listingType = pickStr(
      raw.listing_type,
      raw.listingType,
      listing.listing_type,
      listing.listingType,
      contact.listing_type,
      contact.listingType
    );
    const buyerId = pickStr(
      raw.buyer_id,
      raw.buyerId,
      contact.requester_id,
      application.applicant_id,
      request.requester_id
    );
    const sellerId = pickStr(
      raw.seller_id,
      raw.sellerId,
      listing.user_id,
      listing.seller_user_id,
      listing.author_user_id
    );
    const title = pickStr(
      raw.title,
      listing.title,
      listing.company_name,
      listing.service_name,
      "やりとり"
    );

    return {
      listing_type: listingType,
      listing_id: listingId,
      title,
      buyer_id: buyerId,
      seller_id: sellerId,
      contact_id: pickStr(raw.contact_id, raw.contactId, contact.contact_id) || undefined,
      source: pickStr(raw.source, contact.source) || undefined,
      service_type: pickStr(raw.service_type, raw.serviceType) || undefined,
      service_ref_id: pickStr(
        raw.service_ref_id,
        raw.serviceRefId,
        application.application_id,
        request.request_id
      ) || undefined,
      service_deal_id: pickStr(raw.service_deal_id, raw.serviceDealId, deal.id) || undefined,
      expires_at: pickStr(raw.expires_at, raw.expiresAt) || undefined,
      status: pickStr(raw.status, "fee_pending") || "fee_pending",
      participants: Array.isArray(raw.participants)
        ? raw.participants.map((p) => String(p || "").trim()).filter(Boolean)
        : [buyerId, sellerId].filter(Boolean),
      from: pickStr(raw.from) || undefined,
    };
  }

  async function callEnsureEdge(payload) {
    const base = getFunctionsBase();
    const token = getAuthToken();
    if (!base || !token) {
      return { ok: false, reason: "edge_not_configured" };
    }

    const res = await fetch(`${base}/${EDGE_FUNCTION_NAME}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: token,
      },
      body: JSON.stringify(payload),
    }).catch((err) => ({ ok: false, _fetchError: err }));

    if (!res || typeof res.json !== "function") {
      return { ok: false, reason: "edge_fetch_failed" };
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        reason: pickStr(json.code, json.message, "edge_error"),
        status: res.status,
        json,
      };
    }

    return {
      ok: true,
      mode: pickStr(json.mode, "live"),
      room_id: pickStr(json.room_id),
      redirect_url: pickStr(json.redirect_url) || buildRedirectUrl(json.room_id, payload.from),
      created: Boolean(json.created),
      reused: Boolean(json.reused),
    };
  }

  async function fallbackClientInsert(payload) {
    const Supabase = global.TasuChatSupabase;
    if (!Supabase?.createListingTalkRoom) {
      return { ok: false, reason: "supabase_helper_missing" };
    }
    try {
      const result = await Supabase.createListingTalkRoom(payload);
      if (!result?.id) return { ok: false, reason: "supabase_insert_failed" };
      return {
        ok: true,
        mode: result.local ? "local_fallback" : "client_insert",
        room_id: String(result.id),
        redirect_url: buildRedirectUrl(result.id, payload.from),
        created: Boolean(result.created),
        reused: Boolean(result.reused),
        row: result.row || null,
      };
    } catch (err) {
      console.warn("[TasuTalkRoomEnsure] client insert fallback failed:", err);
      return { ok: false, reason: "supabase_insert_exception" };
    }
  }

  /**
   * @param {object} input
   * @returns {Promise<{ok:boolean, room_id?:string, redirect_url?:string, created?:boolean, reused?:boolean, mode?:string, reason?:string}>}
   */
  async function ensureTalkRoom(input) {
    const payload = normalizeEnsureInput(input);
    if (!payload.listing_id || !payload.listing_type || !payload.buyer_id || !payload.seller_id) {
      return { ok: false, reason: "missing_ensure_context" };
    }

    if (isTalkDevStubMode()) {
      return {
        ok: true,
        mode: "stub",
        room_id: STUB_ROOM_ID,
        redirect_url: buildRedirectUrl(STUB_ROOM_ID, payload.from),
        created: false,
        reused: true,
      };
    }

    if (shouldPreferEdgeEnsure()) {
      const edge = await callEnsureEdge(payload);
      if (edge.ok && edge.room_id) return edge;
      console.warn("[TasuTalkRoomEnsure] edge failed, trying client insert:", edge.reason);
      const inserted = await fallbackClientInsert(payload);
      if (inserted.ok) return inserted;
      return edge.ok === false ? edge : inserted;
    }

    const inserted = await fallbackClientInsert(payload);
    if (inserted.ok) return inserted;
    return { ok: false, reason: "ensure_unavailable" };
  }

  global.TasuTalkRoomEnsure = {
    EDGE_FUNCTION_NAME,
    STUB_ROOM_ID,
    isUuidRoomId,
    isTalkDevStubMode,
    shouldPreferEdgeEnsure,
    buildRedirectUrl,
    normalizeEnsureInput,
    ensureTalkRoom,
    callEnsureEdge,
  };
})(typeof window !== "undefined" ? window : globalThis);
