/**
 * ワーカー依頼 — 依頼記録（受諾時のみチャット作成）
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_worker_requests_v1";
  const EVENT_NAME = "tasu:worker-requests-changed";

  const DEMO_REQUESTERS = Object.freeze({
    u_request_demo: {
      displayName: "依頼者デモ",
      memo: "渋谷駅周辺のスーパーで買い物代行をお願いしたいです。",
    },
    u_me: { displayName: "ゲスト依頼者", memo: "" },
  });

  const WORKER_ID_ALIASES = Object.freeze({
    worker_demo_001: "worker_hiro_001",
  });

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function newRequestId() {
    return `worker-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getRequesterId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function getRequesterName(userId) {
    const id = pickStr(userId);
    const profile = global.TasuChatUserIdentity?.getProfileForUserId?.(id);
    if (profile?.displayName) return profile.displayName;
    if (DEMO_REQUESTERS[id]) return DEMO_REQUESTERS[id].displayName;
    return id || "依頼者";
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    const incoming = Array.isArray(list) ? list : [];
    const existing = readAll();
    const byId = new Map();
    existing.forEach((row) => {
      if (row?.request_id) byId.set(String(row.request_id), row);
    });
    incoming.forEach((row) => {
      if (row?.request_id) byId.set(String(row.request_id), row);
    });
    const safe = [...byId.values()];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuWorkerRequestsStore] save failed:", err);
    }
    return safe;
  }

  function canonicalWorkerId(workerId) {
    const id = pickStr(workerId);
    return WORKER_ID_ALIASES[id] || id;
  }

  function resolveListing(workerId) {
    const rawId = pickStr(workerId);
    const canonId = canonicalWorkerId(rawId);
    const local = global.TasuListingLocalStore?.fetchById?.(canonId);
    if (local) {
      const detail = global.TasuListingLocalStore?.toDetailListing?.(local) || local;
      return { ...detail, id: rawId || detail.id, listing_id: rawId || detail.listing_id };
    }
    const storeRow = global.TasuListingStore?.fetchById?.(canonId);
    if (storeRow) return { ...storeRow, id: rawId || storeRow.id, listing_id: rawId || storeRow.listing_id };
    const demo = global.TasuListingDemoCatalog?.STORE_BY_ID?.[canonId];
    if (demo) return { ...demo, id: rawId || demo.id, listing_id: rawId || demo.listing_id };
    const demoOwner =
      global.TasuPlatformChatDualWindowDemo?.getProfile?.("worker", false)?.partnerAId ||
      "demo-worker-001";
    return {
      id: rawId || canonId,
      listing_id: rawId || canonId,
      title: "買い物代行ワーカー",
      user_id: demoOwner,
      seller_user_id: demoOwner,
      listing_type: "worker",
    };
  }

  function isWorkerOwner(listing) {
    const canon = canonicalWorkerId(pickStr(listing?.id, listing?.listing_id));
    const resolved = resolveListing(canon);
    const ownerId = pickStr(
      resolved?.user_id,
      resolved?.seller_user_id,
      resolved?.author_user_id,
      listing?.user_id
    );
    const me = getRequesterId();
    if (!ownerId) return false;
    return ownerId === me;
  }

  function seedDemoIfEmpty(workerId) {
    const list = readAll();
    const demoId = "worker-req-demo-001";
    if (list.some((r) => r.request_id === demoId)) return list;
    const wid = pickStr(workerId);
    const canon = canonicalWorkerId(wid);
    const hasForWorker = list.some((r) => {
      const rowCanon = canonicalWorkerId(r.worker_id);
      return (wid && String(r.worker_id) === wid) || (canon && rowCanon === canon);
    });
    if (hasForWorker) return list;
    const seeded = {
      request_id: demoId,
      worker_id: wid || "worker_hiro_001",
      requester_id: "u_request_demo",
      requester_name: "依頼者デモ",
      status: "requested",
      memo: DEMO_REQUESTERS.u_request_demo.memo,
      created_at: "2026-06-05T10:00:00.000Z",
      thread_id: null,
    };
    return writeAll([...list, seeded]);
  }

  function listByWorker(workerId) {
    const wid = pickStr(workerId);
    const canon = canonicalWorkerId(wid);
    return readAll()
      .filter((r) => {
        const rowCanon = canonicalWorkerId(r.worker_id);
        return String(r.worker_id) === wid || rowCanon === canon;
      })
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  function hasRequested(workerId, requesterId) {
    const wid = pickStr(workerId);
    const rid = pickStr(requesterId || getRequesterId());
    return readAll().some(
      (r) =>
        (String(r.worker_id) === wid || canonicalWorkerId(r.worker_id) === canonicalWorkerId(wid)) &&
        String(r.requester_id) === rid &&
        r.status !== "rejected"
    );
  }

  function submitRequest(listing) {
    const workerId = pickStr(listing?.id, listing?.listing_id);
    if (!workerId) return { ok: false, reason: "missing_worker_id" };

    const requesterId = getRequesterId();
    if (isWorkerOwner(listing)) return { ok: false, reason: "owner_cannot_request" };

    if (hasRequested(workerId, requesterId)) return { ok: false, reason: "already_requested" };

    const row = {
      request_id: newRequestId(),
      worker_id: workerId,
      requester_id: requesterId,
      requester_name: getRequesterName(requesterId),
      status: "requested",
      memo: "",
      created_at: nowIso(),
      thread_id: null,
    };

    const list = readAll();
    list.unshift(row);
    writeAll(list);

    return { ok: true, request: row };
  }

  function findRequest(workerId, requestId) {
    const wid = pickStr(workerId);
    const rid = pickStr(requestId);
    return (
      readAll().find(
        (r) =>
          String(r.request_id) === rid &&
          (String(r.worker_id) === wid || canonicalWorkerId(r.worker_id) === canonicalWorkerId(wid))
      ) || null
    );
  }

  function beginWorkerChat(workerId, requestId) {
    const listing = resolveListing(workerId);
    const req = findRequest(workerId, requestId);
    if (!req) return { ok: false, reason: "request_not_found" };
    if (req.status === "rejected") return { ok: false, reason: "already_rejected" };

    const Fee = global.TasuPlatformChatFee;
    if (!Fee?.buildFeePayUrl || !Fee?.ensurePendingFeeDeferred) {
      return { ok: false, reason: "fee_module_missing" };
    }

    if (req.status === "accepted" && req.thread_id && Fee.isFeePaid?.(req.thread_id)) {
      return {
        ok: true,
        request: req,
        threadId: req.thread_id,
        feePending: false,
        payUrl: Fee.buildChatDetailUrl?.({ threadId: req.thread_id }) || `chat-detail.html?thread=${encodeURIComponent(req.thread_id)}`,
      };
    }

    const requests = readAll();
    const idx = requests.findIndex((r) => String(r.request_id) === String(requestId));
    if (idx < 0) return { ok: false, reason: "request_not_found" };

    requests[idx] = {
      ...requests[idx],
      status: "awaiting_fee",
      updated_at: nowIso(),
    };
    writeAll(requests);

    const feeAmount = Fee.calcPreChatFee?.(listing) || Fee.MIN_FEE_YEN || 550;
    Fee.ensurePendingFeeDeferred({
      listing,
      requestId,
      listingId: workerId,
      feeAmount,
    });

    let pageFrom = "";
    try {
      pageFrom = String(new URLSearchParams(global.location?.search || "").get("from") || "").trim();
    } catch {
      pageFrom = "";
    }

    const payUrl = Fee.buildFeePayUrl({
      requestId,
      listingId: workerId,
      category: "worker",
      listing,
      from: pageFrom || "notify",
    });

    return {
      ok: true,
      feePending: true,
      request: requests[idx],
      payUrl,
      feeAmount,
    };
  }

  /** @deprecated beginWorkerChat を使用 */
  function commitAccept(workerId, requestId) {
    return beginWorkerChat(workerId, requestId);
  }

  function finalizeRequestAfterPayment(requestId, threadId) {
    const rid = pickStr(requestId);
    const tid = pickStr(threadId);
    if (!rid || !tid) return { ok: false, reason: "missing_ids" };

    const requests = readAll();
    const idx = requests.findIndex((r) => String(r.request_id) === rid);
    if (idx < 0) return { ok: false, reason: "request_not_found" };

    requests[idx] = {
      ...requests[idx],
      status: "accepted",
      thread_id: tid,
      updated_at: nowIso(),
    };
    writeAll(requests);

    try {
      const listing = resolveListing(requests[idx].worker_id);
      const notify = global.TasuTalkPlatformNotify;
      notify?.notifyWorkerAcceptedToRequester?.({
        listing,
        request: requests[idx],
        thread: { id: tid },
      });
    } catch (err) {
      console.warn("[TasuWorkerRequestsStore] finalize notify skipped:", err);
    }

    return { ok: true, request: requests[idx] };
  }

  function commitReject(workerId, requestId) {
    const listing = resolveListing(workerId);
    const requests = readAll();
    const idx = requests.findIndex(
      (r) =>
        String(r.request_id) === String(requestId) &&
        (String(r.worker_id) === String(workerId) ||
          canonicalWorkerId(r.worker_id) === canonicalWorkerId(workerId))
    );
    if (idx < 0) return { ok: false, reason: "request_not_found" };
    const req = requests[idx];
    if (req.status === "rejected") return { ok: true, request: req };

    requests[idx] = {
      ...req,
      status: "rejected",
      updated_at: nowIso(),
    };
    writeAll(requests);

    try {
      global.TasuTalkPlatformNotify?.notifyWorkerRejected?.({
        listing,
        request: requests[idx],
      });
    } catch (err) {
      console.warn("[TasuWorkerRequestsStore] reject notify skipped:", err);
    }

    return { ok: true, request: requests[idx] };
  }

  global.TasuWorkerRequestsStore = {
    STORAGE_KEY,
    EVENT_NAME,
    readAll,
    listByWorker,
    hasRequested,
    isWorkerOwner,
    submitRequest,
    findRequest,
    beginWorkerChat,
    commitAccept,
    commitReject,
    finalizeRequestAfterPayment,
    seedDemoIfEmpty,
    getRequesterId,
    getRequesterName,
    resolveListing,
    canonicalWorkerId,
  };
})(typeof window !== "undefined" ? window : globalThis);
