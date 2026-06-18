/**
 * TASFUL TALK — フォロー・お気に入り（更新通知用）
 * キー: tasful_talk_follow_store
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "tasful_talk_follow_store";
  const EVENT_NAME = "tasful-talk-follow-changed";
  const SYNC_STORE_ID = "follows";
  const DB_TABLE = "talk_follow_subscriptions";
  const MAX_FOLLOWS = 500;

  const VALID_TYPES = new Set(
    global.TasuTalkCategory?.FOLLOW_TYPE_KEYS || [
      "skill",
      "worker",
      "job",
      "product",
      "shop",
      "business",
      "builder",
    ]
  );

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

  function getCurrentUserId() {
    return (
      global.TasuChatUserIdentity?.getEffectiveUserId?.() ||
      global.TASU_CHAT_SUPABASE_CONFIG?.currentUserId ||
      "u_me"
    );
  }

  function normalizeFollowType(type, data) {
    if (global.TasuTalkCategory?.normalizeFollowType) {
      return global.TasuTalkCategory.normalizeFollowType(type, data);
    }
    const t = String(type || "").toLowerCase().replace(/-/g, "_");
    if (VALID_TYPES.has(t)) return t;
    return "";
  }

  function subscriptionId(userId, type, targetId) {
    return `follow-${String(userId)}-${String(type)}-${String(targetId)}`;
  }

  /**
   * @param {object} raw
   * @returns {object|null}
   */
  function normalizeFollow(raw) {
    if (!raw || typeof raw !== "object") return null;
    const targetId = pickStr(raw.id, raw.targetId, raw.listingId, raw.projectId);
    const type = normalizeFollowType(raw.type || raw.followType || raw.listingType, raw);
    const userId = pickStr(raw.userId, raw.user_id) || getCurrentUserId();
    if (!targetId || !type || !userId) return null;

    const createdAt = pickStr(raw.createdAt, raw.created_at) || nowIso();
    const updatedAt = pickStr(raw.updatedAt, raw.updated_at) || createdAt;
    const notifyEnabled = raw.notifyEnabled !== false && raw.notify_enabled !== false;

    return {
      id: targetId,
      type,
      userId,
      title: pickStr(raw.title, raw.name) || targetId,
      targetUrl: pickStr(raw.targetUrl, raw.target_url, raw.detailUrl) || "#",
      notifyEnabled,
      createdAt,
      updatedAt,
      subscriptionId:
        pickStr(raw.subscriptionId, raw.subscription_id) || subscriptionId(userId, type, targetId),
    };
  }

  function readAll() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeFollow).filter(Boolean);
    } catch (err) {
      console.warn("[TasuTalkFollowStore] read failed:", err);
      return [];
    }
  }

  function writeAll(list, options) {
    const sync = global.TasuTalkSupabaseSync;
    if (sync?.writeLocal && options?.localOnly !== true) {
      return sync.writeLocal(
        {
          id: SYNC_STORE_ID,
          storageKey: STORAGE_KEY,
          eventName: EVENT_NAME,
          maxRows: MAX_FOLLOWS,
          normalize: normalizeFollow,
        },
        list,
        { source: options?.source || "write" }
      );
    }
    const safe = Array.isArray(list) ? list.slice(0, MAX_FOLLOWS).map(normalizeFollow).filter(Boolean) : [];
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: safe } }));
    } catch (err) {
      console.warn("[TasuTalkFollowStore] save failed:", err);
    }
    return safe;
  }

  function findFollow(userId, type, targetId) {
    const uid = String(userId || "").trim();
    const t = normalizeFollowType(type);
    const tid = String(targetId || "").trim();
    if (!uid || !t || !tid) return null;
    return (
      readAll().find(
        (row) => row.userId === uid && row.type === t && String(row.id) === tid
      ) || null
    );
  }

  function resolveTypeFromListing(listing) {
    if (!listing || typeof listing !== "object") return "";
    const explicit = normalizeFollowType(
      listing.followType || listing.talkFollowType || listing.listing_type || listing.listingType,
      listing
    );
    if (explicit && VALID_TYPES.has(explicit)) return explicit;

    if (global.TasuTalkCategory?.resolveListingCategoryType) {
      const resolved = global.TasuTalkCategory.resolveListingCategoryType(
        listing._localRecord || listing
      );
      if (resolved && VALID_TYPES.has(resolved)) return resolved;
    }

    return "skill";
  }

  function buildTargetUrl(listing, type, targetId) {
    const fromListing = pickStr(listing?.detailUrl, listing?.targetUrl);
    if (fromListing && fromListing !== "#") return fromListing;

    const fav = global.TasuFavoriteStore;
    if (fav?.buildDetailUrl && listing) {
      try {
        const url = fav.buildDetailUrl?.(listing);
        if (url && url !== "#") return url;
      } catch {
        /* ignore */
      }
    }

    const store = global.TasuListingLocalStore;
    const record = listing?._localRecord || listing;
    const fromStore = store?.buildDetailPageUrl?.(record);
    if (fromStore && fromStore !== "#") return fromStore;

    const R = global.TasuListingRouteResolver;
    if (R?.buildDetailUrl) {
      if (type === "builder") return R.buildDetailUrl("deal", targetId);
      const typeMap = {
        skill: "skill",
        worker: "worker",
        job: "job",
        product: "product",
        shop: "shop",
        business: "business_service",
      };
      const routeType = typeMap[type] || "general";
      return R.buildDetailUrl(routeType, targetId);
    }
    return "#";
  }

  function buildTitle(listing, targetId) {
    return (
      pickStr(
        listing?.title,
        listing?.name,
        listing?.company_name,
        listing?.service_name,
        global.document?.querySelector?.("[data-biz-detail-title]")?.textContent
      ) || targetId
    );
  }

  /**
   * @param {object} input
   */
  function follow(input) {
    const row = normalizeFollow({
      ...input,
      userId: input?.userId || getCurrentUserId(),
      notifyEnabled: input?.notifyEnabled !== false,
      createdAt: input?.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    if (!row) return { ok: false, reason: "invalid" };

    const list = readAll();
    const idx = list.findIndex(
      (x) => x.userId === row.userId && x.type === row.type && String(x.id) === String(row.id)
    );

    let saved;
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...row, notifyEnabled: true, updatedAt: nowIso() };
      saved = list[idx];
    } else {
      list.unshift(row);
      saved = list[0];
    }
    writeAll(list, { localOnly: true });
    global.TasuTalkSupabaseSync?.scheduleUpsert?.(SYNC_STORE_ID, saved);
    return { ok: true, saved: true, record: saved };
  }

  function setFollowNotifyEnabled(targetId, type, userId, enabled) {
    const tid = String(targetId || "").trim();
    const t = normalizeFollowType(type);
    const uid = String(userId || getCurrentUserId()).trim();
    if (!tid || !t) return { ok: false, reason: "invalid" };

    const list = readAll();
    const idx = list.findIndex(
      (x) => x.userId === uid && x.type === t && String(x.id) === tid
    );
    if (idx < 0) return { ok: false, reason: "not_found" };

    const on = enabled !== false;
    list[idx] = { ...list[idx], notifyEnabled: on, updatedAt: nowIso() };
    writeAll(list, { localOnly: true });
    global.TasuTalkSupabaseSync?.scheduleUpsert?.(SYNC_STORE_ID, list[idx]);
    return { ok: true, record: list[idx], notifyEnabled: on };
  }

  function unfollow(targetId, type, userId) {
    const tid = String(targetId || "").trim();
    const t = normalizeFollowType(type);
    const uid = String(userId || getCurrentUserId()).trim();
    if (!tid || !t) return { ok: false, reason: "invalid" };

    const list = readAll();
    const removed = list.find(
      (x) => x.userId === uid && x.type === t && String(x.id) === tid
    );
    const next = list.filter(
      (x) => !(x.userId === uid && x.type === t && String(x.id) === tid)
    );
    writeAll(next, { localOnly: true });
    if (removed?.subscriptionId) {
      global.TasuTalkSupabaseSync?.scheduleDelete?.(SYNC_STORE_ID, removed.subscriptionId);
    }
    return { ok: true, saved: false };
  }

  function isFollowing(targetId, type, userId) {
    const row = findFollow(userId || getCurrentUserId(), type, targetId);
    if (!row) return false;
    return row.notifyEnabled !== false;
  }

  function toggle(input) {
    const targetId = pickStr(input?.id, input?.targetId, input?.listingId);
    const type =
      normalizeFollowType(input?.type, input) || resolveTypeFromListing(input?.listing || input);
    if (!targetId || !type) return { ok: false, reason: "invalid_type" };
    if (isFollowing(targetId, type, input?.userId)) {
      return unfollow(targetId, type, input?.userId);
    }
    return follow({ ...input, id: targetId, type });
  }

  function followFromListing(listing, options) {
    if (!listing || typeof listing !== "object") return { ok: false, reason: "no_listing" };
    const targetId = pickStr(listing.id, listing.listing_id, listing.project_id);
    const type = resolveTypeFromListing(listing);
    if (!targetId || !type) return { ok: false, reason: "unsupported_type" };
    return follow({
      id: targetId,
      type,
      title: buildTitle(listing, targetId),
      targetUrl: buildTargetUrl(listing, type, targetId),
      userId: options?.userId,
    });
  }

  function unfollowFromListing(listing, options) {
    const targetId = pickStr(listing?.id, listing?.listing_id, listing?.project_id);
    const type = resolveTypeFromListing(listing);
    if (!targetId || !type) return { ok: false, reason: "unsupported_type" };
    return unfollow(targetId, type, options?.userId);
  }

  function syncFromFavoriteToggle(listing, saved) {
    try {
      if (saved) return followFromListing(listing);
      return unfollowFromListing(listing);
    } catch (err) {
      console.warn("[TasuTalkFollowStore] syncFromFavoriteToggle failed:", err);
      return { ok: false };
    }
  }

  function getFollowersForTarget(targetId, type) {
    const tid = String(targetId || "").trim();
    const t = normalizeFollowType(type);
    if (!tid || !t) return [];
    return readAll().filter(
      (row) => String(row.id) === tid && row.type === t && row.notifyEnabled !== false
    );
  }

  function followToDbRow(row, userId) {
    const n = normalizeFollow(row);
    if (!n) return null;
    return {
      id: n.subscriptionId,
      user_id: String(userId || n.userId),
      target_id: n.id,
      target_type: n.type,
      title: n.title,
      target_url: n.targetUrl,
      notify_enabled: n.notifyEnabled !== false,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
    };
  }

  function followFromDbRow(row) {
    if (!row || typeof row !== "object") return null;
    return normalizeFollow({
      id: row.target_id,
      type: row.target_type,
      userId: row.user_id,
      title: row.title,
      targetUrl: row.target_url,
      notifyEnabled: row.notify_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subscriptionId: row.id,
    });
  }

  function sortMerged(list) {
    return list
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function registerSupabaseSync() {
    const sync = global.TasuTalkSupabaseSync;
    if (!sync?.register || sync.__followsRegistered) return;
    sync.__followsRegistered = true;
    sync.register({
      id: SYNC_STORE_ID,
      table: DB_TABLE,
      storageKey: STORAGE_KEY,
      eventName: EVENT_NAME,
      maxRows: MAX_FOLLOWS,
      orderColumn: "updated_at",
      normalize: normalizeFollow,
      toRow: followToDbRow,
      fromRow: followFromDbRow,
      sortMerged,
    });
  }

  function init() {
    registerSupabaseSync();
    return global.TasuTalkSupabaseSync?.initStore?.(SYNC_STORE_ID) || Promise.resolve(readAll());
  }

  global.TasuTalkFollowStore = {
    STORAGE_KEY,
    EVENT_NAME,
    SYNC_STORE_ID,
    DB_TABLE,
    VALID_TYPES,
    readAll,
    writeAll,
    follow,
    unfollow,
    setFollowNotifyEnabled,
    toggle,
    isFollowing,
    findFollow,
    followFromListing,
    unfollowFromListing,
    syncFromFavoriteToggle,
    getFollowersForTarget,
    resolveTypeFromListing,
    buildTargetUrl,
    normalizeFollowType,
    normalizeFollow,
    init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
