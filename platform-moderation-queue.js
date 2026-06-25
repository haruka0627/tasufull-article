/**
 * Platform NB-1M — 管理者審査キュー（pending_review 一覧 · 承認/却下）
 * UI 変更なし — admin-operations-dashboard / ops から呼び出し
 */
(function (global) {
  "use strict";

  const LOCAL_QUEUE_KEY = "tasu_platform_moderation_queue_v1";

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function isOps() {
    return (
      global.TasuAuthCurrentUser?.isOpsPreviewActive?.() === true ||
      global.TasuAuthCurrentUser?.isOpsUser?.() === true ||
      global.TasuPlatformActorResolver?.resolvePlatformActor?.()?.actor_type === "admin"
    );
  }

  function readLocalQueue() {
    try {
      const raw = global.localStorage?.getItem(LOCAL_QUEUE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeLocalQueue(list) {
    try {
      global.localStorage?.setItem(LOCAL_QUEUE_KEY, JSON.stringify(list.slice(0, 500)));
    } catch {
      /* ignore */
    }
  }

  function normalizeQueueItem(row, table) {
    if (!row) return null;
    return {
      id: String(row.id || ""),
      table: table || "listings",
      user_id: String(row.user_id || ""),
      title: String(row.title || "").trim(),
      publish_status: String(row.publish_status || ""),
      moderation_status: String(row.moderation_status || "pending_review"),
      moderation_flags: Array.isArray(row.moderation_flags) ? row.moderation_flags : [],
      moderation_reason: String(row.moderation_reason || "").trim() || null,
      reviewed_by: row.reviewed_by || null,
      reviewed_at: row.reviewed_at || null,
      updated_at: row.updated_at || row.created_at || null,
      listing_type: row.listing_type || row.business_category || null,
    };
  }

  async function fetchPendingFromTable(tableName, limit) {
    const sb = getClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from(tableName)
      .select(
        "id,user_id,title,publish_status,moderation_status,moderation_flags,moderation_reason,reviewed_by,reviewed_at,updated_at,created_at,listing_type,business_category"
      )
      .in("moderation_status", ["pending_review"])
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[ModerationQueue] fetch failed:", tableName, error);
      return [];
    }
    return (data || []).map((row) => normalizeQueueItem(row, tableName));
  }

  async function listPendingReview(options) {
    const limit = Math.min(Number(options?.limit) || 50, 100);
    const sb = getClient();

    if (sb) {
      const [general, business] = await Promise.all([
        fetchPendingFromTable("listings", limit),
        fetchPendingFromTable("business_listings", limit),
      ]);
      const merged = [...general, ...business].sort((a, b) =>
        String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
      );
      if (merged.length) return merged.slice(0, limit);
    }

    return readLocalQueue()
      .filter((item) => item.moderation_status === "pending_review")
      .slice(0, limit);
  }

  function upsertLocalQueueItem(item) {
    const list = readLocalQueue();
    const id = String(item.id || "");
    const idx = list.findIndex((x) => String(x.id) === id && x.table === item.table);
    if (idx >= 0) list[idx] = { ...list[idx], ...item };
    else list.unshift(item);
    writeLocalQueue(list);
  }

  function trackLocalListing(row, table) {
    const item = normalizeQueueItem(row, table);
    if (!item?.id) return;
    upsertLocalQueueItem(item);
  }

  async function applyReviewAction(input) {
    if (!isOps()) {
      return { ok: false, error: "運営権限が必要です" };
    }

    const id = String(input?.id || "").trim();
    const table = String(input?.table || "listings").trim();
    const action = String(input?.action || "").trim();
    const reviewer = global.TasuAuthCurrentUser?.getCurrentUser?.()?.talkUserId || "ops";

    if (!id || !action) return { ok: false, error: "id / action が不足しています" };

    const now = new Date().toISOString();
    /** @type {Record<string, unknown>} */
    let patch = { reviewed_by: reviewer, reviewed_at: now, updated_at: now };

    if (action === "approve") {
      patch = {
        ...patch,
        moderation_status: "approved",
        publish_status: "public",
      };
    } else if (action === "reject") {
      patch = {
        ...patch,
        moderation_status: "rejected",
        publish_status: "rejected",
        moderation_reason: String(input?.reason || patch.moderation_reason || "管理者却下"),
      };
    } else if (action === "hide") {
      patch = {
        ...patch,
        moderation_status: "hidden",
        publish_status: "hidden",
      };
    } else if (action === "remove") {
      patch = {
        ...patch,
        moderation_status: "removed",
        publish_status: "removed",
      };
    } else {
      return { ok: false, error: "不明な action です" };
    }

    const sb = getClient();
    if (sb && !id.startsWith("local_")) {
      const { data, error } = await sb.from(table).update(patch).eq("id", id).select("id").maybeSingle();
      if (error) {
        console.warn("[ModerationQueue] update failed:", error);
        return { ok: false, error: error.message || String(error) };
      }
      if (!data?.id) return { ok: false, error: "対象が見つかりません" };
      try {
        global.TasuPlatformOpsInboxBridge?.completeByReviewTarget?.(table, id);
        global.dispatchEvent?.(new CustomEvent("tasu:ops-content-review-completed", { detail: { id, table, action } }));
      } catch {
        /* ignore */
      }
      return { ok: true, id: data.id, via: "supabase", patch };
    }

    const list = readLocalQueue();
    const idx = list.findIndex((x) => String(x.id) === id);
    if (idx < 0) return { ok: false, error: "ローカルキューにありません" };
    list[idx] = { ...list[idx], ...patch };
    writeLocalQueue(list);
    try {
      global.TasuPlatformOpsInboxBridge?.completeByReviewTarget?.(table, id);
      global.dispatchEvent?.(new CustomEvent("tasu:ops-content-review-completed", { detail: { id, table, action } }));
    } catch {
      /* ignore */
    }
    return { ok: true, id, via: "local", patch };
  }

  async function countPendingReview() {
    const items = await listPendingReview({ limit: 200 });
    const shopPending = readLocalQueue().filter(
      (x) => x.table === "shop_local" && x.moderation_status === "pending_review"
    ).length;
    return items.length + shopPending;
  }

  global.TasuPlatformModerationQueue = {
    listPendingReview,
    applyReviewAction,
    trackLocalListing,
    countPendingReview,
    readLocalQueue,
  };
})(typeof window !== "undefined" ? window : globalThis);
