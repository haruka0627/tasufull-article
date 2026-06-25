/**
 * TLV — ローカル開発専用 demo ログイン（localhost / 127.0.0.1 のみ）
 */
(function (global) {
  "use strict";

  const DEMO_USER_ID = "u_me";
  const FORCE_GUEST_KEY = "tlvDevForceGuest";
  const FOLLOW_STORE_KEY = "tlvDevFollowStore";
  const NOTIFY_STORE_KEY = "tlvDevNotifications";
  const NOTIFY_STORE_KEY_LEGACY = "tlvDevNotifyStore";
  const DEV_VIEWER_KEY = "tlvDevViewerId";

  function hostname() {
    return String(global.location?.hostname || "").toLowerCase();
  }

  function isLocalTlvDevHost() {
    const host = hostname();
    return host === "localhost" || host === "127.0.0.1";
  }

  function isForceGuest() {
    if (!isLocalTlvDevHost()) return false;
    try {
      return global.localStorage?.getItem(FORCE_GUEST_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setForceGuest(enabled) {
    if (!isLocalTlvDevHost()) return;
    try {
      if (enabled) global.localStorage.setItem(FORCE_GUEST_KEY, "1");
      else global.localStorage.removeItem(FORCE_GUEST_KEY);
    } catch {
      /* ignore */
    }
  }

  function getRawAuthUser() {
    return global.TasuAuthCurrentUser?.getCurrentUser?.() || null;
  }

  function isRealAuthenticated(auth) {
    return Boolean(auth?.authenticated && auth?.talkUserId);
  }

  function shouldUseTlvDevDemo() {
    if (!isLocalTlvDevHost()) return false;
    if (isForceGuest()) return false;
    return !isRealAuthenticated(getRawAuthUser());
  }

  function getDemoAuthUser() {
    return {
      authenticated: true,
      talkUserId: DEMO_USER_ID,
      memberId: DEMO_USER_ID,
      displayName: "TLV Demo User",
      handle: "@tlv_demo",
      avatarUrl: "",
      source: "tlv_dev_demo",
    };
  }

  function resolveTlvAuthUser() {
    const raw = getRawAuthUser();
    if (isRealAuthenticated(raw)) return raw;
    if (shouldUseTlvDevDemo()) return getDemoAuthUser();
    return raw || { authenticated: false, talkUserId: "" };
  }

  function isAuthenticatedForTlv() {
    const user = resolveTlvAuthUser();
    return Boolean(user?.authenticated && user?.talkUserId);
  }

  function getTlvTalkUserId() {
    return String(resolveTlvAuthUser()?.talkUserId || "").trim();
  }

  /** チャンネル閲覧者 ID（profile の ?userId= 対象とは別。URL 偽装を viewer に使わない） */
  function getTlvViewerTalkUserId() {
    if (isForceGuest()) return "";
    if (isLocalTlvDevHost() && hasTalkDevParam()) {
      try {
        const override = String(global.localStorage?.getItem(DEV_VIEWER_KEY) || "").trim();
        if (override) return override;
      } catch {
        /* ignore */
      }
    }
    if (shouldUseTlvDevDemo()) return DEMO_USER_ID;
    const raw = getRawAuthUser();
    if (isRealAuthenticated(raw)) return String(raw.talkUserId || "").trim();
    if (!isLocalTlvDevHost()) return "";
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return String(cfg.currentUserId || cfg.me?.id || "").trim();
  }

  function handleDevLogout() {
    if (!shouldUseTlvDevDemo()) return false;
    setForceGuest(true);
    return true;
  }

  function hasTalkDevParam() {
    try {
      return new URLSearchParams(global.location?.search || "").get("talkDev") === "1";
    } catch {
      return false;
    }
  }

  /** localhost 限定: フォロー状態を localStorage で保持（本番・未ログインでは無効） */
  function shouldUseTlvFollowLocalFallback() {
    if (!isLocalTlvDevHost()) return false;
    if (isForceGuest()) return false;
    const viewerId = getTlvViewerTalkUserId();
    if (!viewerId) return false;
    if (hasTalkDevParam()) return true;
    if (shouldUseTlvDevDemo()) return true;
    return false;
  }

  function followEntryKey(viewerId, creatorId) {
    return `${String(viewerId || "").trim()}::${String(creatorId || "").trim()}`;
  }

  function readFollowStore() {
    try {
      const raw = global.localStorage?.getItem(FOLLOW_STORE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeFollowStore(store) {
    try {
      global.localStorage?.setItem(FOLLOW_STORE_KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }

  function isDevFollowStored(viewerId, creatorId) {
    const store = readFollowStore();
    return store[followEntryKey(viewerId, creatorId)] === true;
  }

  function setDevFollowStored(viewerId, creatorId, following) {
    const store = readFollowStore();
    const key = followEntryKey(viewerId, creatorId);
    if (following) store[key] = true;
    else delete store[key];
    writeFollowStore(store);
  }

  function clearDevFollowStore() {
    try {
      global.localStorage?.removeItem(FOLLOW_STORE_KEY);
    } catch {
      /* ignore */
    }
  }

  const DEV_STUB_PROFILES = Object.freeze({
    u_me: {
      user_id: "u_me",
      bio: "TLV Demo User",
      follower_count: 12,
      creator_status: "active",
      live_permission_status: "granted",
    },
    u_store: {
      user_id: "u_store",
      bio: "プレミアム住宅チャンネル",
      follower_count: 128,
      creator_status: "active",
      live_permission_status: "granted",
    },
    u_creator: {
      user_id: "u_creator",
      bio: "LIVEクリエイター",
      follower_count: 540,
      creator_status: "active",
      live_permission_status: "granted",
    },
  });

  /** localhost + talkDev: プロフィール描画用スタブ（ゲスト検証でもページを表示） */
  function shouldUseTlvProfileDevStub() {
    if (!isLocalTlvDevHost()) return false;
    return hasTalkDevParam();
  }

  /** localhost dev: Supabase 未設定でも profile ページを描画可能にする */
  function getDevStubProfile(userId) {
    if (!shouldUseTlvProfileDevStub()) return null;
    const id = String(userId || "").trim();
    if (!id) return null;
    const known = DEV_STUB_PROFILES[id];
    if (known) return { ...known };
    return {
      user_id: id,
      bio: "",
      follower_count: 0,
      creator_status: "active",
      live_permission_status: "granted",
    };
  }

  /** 通知 dev fallback: localhost + (talkDev=1 または dev demo)（本番 RLS 変更なし） */
  function shouldUseTlvNotifyLocalFallback() {
    if (!isLocalTlvDevHost()) return false;
    if (isForceGuest()) return false;
    const viewerId = getTlvViewerTalkUserId();
    if (!viewerId) return false;
    if (hasTalkDevParam()) return true;
    if (shouldUseTlvDevDemo()) return true;
    return false;
  }

  function isDevNotificationItem(row) {
    if (!row || row.user_id) return false;
    const targetId = String(row.targetId || row.targetUserId || "").trim();
    if (!targetId) return false;
    if (String(row.type || "") === "system") return true;
    return Boolean(row.actorId);
  }

  function devNotificationItemToRow(item) {
    const actorId = String(item.actorId || "").trim();
    const actorName = String(item.actorName || actorId).trim();
    const targetId = String(item.targetId || item.targetUserId || item.user_id || "").trim();
    const types = global.TasuTlvNotificationTypes;
    const kind = String(item.type || "follow").trim();
    const read = item.read === true || Boolean(item.read_at);

    if (kind === "live_started") {
      const broadcastId = String(item.broadcastId || "").trim();
      const displayText =
        types?.liveStartedDisplayText?.(actorName) || `${actorName}さんがライブ配信を開始しました`;
      const payload =
        types?.buildLivePayload?.({
          service_ref_id: broadcastId,
          event: "live_started",
          type: "live_started",
          actor_id: actorId,
          actor_name: actorName,
          actor_avatar: String(item.actorAvatar || "").trim(),
          broadcast_id: broadcastId,
          target_user_id: targetId,
        }) || {
          service_type: "live",
          event: "live_started",
          type: "live_started",
          actor_id: actorId,
          actor_name: actorName,
          broadcast_id: broadcastId,
          target_user_id: targetId,
        };
      const targetUrl =
        item.targetUrl ||
        global.TasuTlvNotificationTypes?.liveStartedTargetUrl?.(broadcastId) ||
        (broadcastId ? `watch-live.html?id=${encodeURIComponent(broadcastId)}` : "#");
      return {
        id: String(item.id || ""),
        user_id: targetId,
        type: "live_started",
        source: "tasful_live",
        title: displayText,
        body: `${displayText}\n${JSON.stringify(payload)}`,
        target_url: targetUrl,
        created_at: item.createdAt || item.created_at || new Date().toISOString(),
        read_at: read ? item.readAt || item.read_at || new Date().toISOString() : null,
      };
    }

    if (kind === "comment") {
      const videoId = String(item.videoId || "").trim();
      const commentId = String(item.commentId || "").trim();
      const displayText =
        types?.commentDisplayText?.(actorName) || `${actorName}さんがあなたの動画にコメントしました`;
      const payload =
        types?.buildLivePayload?.({
          service_ref_id: videoId,
          event: "comment_created",
          type: "comment",
          actor_id: actorId,
          actor_name: actorName,
          actor_avatar: String(item.actorAvatar || "").trim(),
          video_id: videoId,
          comment_id: commentId,
          target_user_id: targetId,
        }) || {
          service_type: "live",
          event: "comment_created",
          type: "comment",
          actor_id: actorId,
          actor_name: actorName,
          video_id: videoId,
          comment_id: commentId,
          target_user_id: targetId,
        };
      return {
        id: String(item.id || ""),
        user_id: targetId,
        type: "comment",
        source: "tasful_live",
        title: displayText,
        body: `${displayText}\n${JSON.stringify(payload)}`,
        target_url: videoId ? `watch-video.html?id=${encodeURIComponent(videoId)}` : "#",
        created_at: item.createdAt || item.created_at || new Date().toISOString(),
        read_at: read ? item.readAt || item.read_at || new Date().toISOString() : null,
      };
    }

    if (kind === "video_published") {
      const videoId = String(item.videoId || "").trim();
      const displayText =
        types?.videoPublishedDisplayText?.(actorName) ||
        `${actorName}さんが新しい動画を公開しました`;
      const payload =
        types?.buildLivePayload?.({
          service_ref_id: videoId,
          event: "video_published",
          type: "video_published",
          actor_id: actorId,
          actor_name: actorName,
          actor_avatar: String(item.actorAvatar || "").trim(),
          video_id: videoId,
          target_user_id: targetId,
        }) || {
          service_type: "live",
          event: "video_published",
          type: "video_published",
          actor_id: actorId,
          actor_name: actorName,
          video_id: videoId,
          target_user_id: targetId,
        };
      const targetUrl =
        item.targetUrl ||
        global.TasuTlvNotificationTypes?.videoPublishedTargetUrl?.(videoId) ||
        (videoId ? `watch-video.html?id=${encodeURIComponent(videoId)}` : "#");
      return {
        id: String(item.id || ""),
        user_id: targetId,
        type: "video_published",
        source: "tasful_live",
        title: displayText,
        body: `${displayText}\n${JSON.stringify(payload)}`,
        target_url: targetUrl,
        created_at: item.createdAt || item.created_at || new Date().toISOString(),
        read_at: read ? item.readAt || item.read_at || new Date().toISOString() : null,
      };
    }

    if (kind === "system") {
      const systemTitle = String(item.systemTitle || item.title || "お知らせ").trim();
      const systemBody = String(item.systemBody || item.body || "").trim();
      const priority = types?.normalizeSystemPriority?.(item.priority) || "normal";
      const creator = String(item.creator || item.actorName || "TLV運営").trim();
      const payload =
        types?.buildLivePayload?.({
          service_ref_id: targetId,
          event: "system",
          type: "system",
          title: systemTitle,
          body: systemBody,
          priority,
          creator,
          target_user_id: targetId,
        }) || {
          service_type: "live",
          event: "system",
          type: "system",
          title: systemTitle,
          body: systemBody,
          priority,
          creator,
          target_user_id: targetId,
        };
      return {
        id: String(item.id || ""),
        user_id: targetId,
        type: "system",
        source: "tasful_live",
        title: systemTitle,
        body: `${systemBody}\n${JSON.stringify(payload)}`,
        target_url: String(item.targetUrl || item.target_url || "#").trim() || "#",
        priority,
        created_at: item.createdAt || item.created_at || new Date().toISOString(),
        read_at: read ? item.readAt || item.read_at || new Date().toISOString() : null,
      };
    }

    const displayText =
      types?.followDisplayText?.(actorName) || `${actorName}さんがあなたをフォローしました`;
    const payload =
      types?.buildLivePayload?.({
        service_ref_id: targetId,
        event: "follow_created",
        type: "follow",
        actor_id: actorId,
        actor_name: actorName,
        actor_avatar: String(item.actorAvatar || "").trim(),
        target_user_id: targetId,
      }) || {
        service_type: "live",
        event: "follow_created",
        type: "follow",
        actor_id: actorId,
        actor_name: actorName,
        target_user_id: targetId,
      };
    return {
      id: String(item.id || ""),
      user_id: targetId,
      type: "follow",
      source: "tasful_live",
      title: displayText,
      body: `${displayText}\n${JSON.stringify(payload)}`,
      target_url: `profile.html?userId=${encodeURIComponent(actorId)}`,
      created_at: item.createdAt || item.created_at || new Date().toISOString(),
      read_at: read ? item.readAt || item.read_at || new Date().toISOString() : null,
    };
  }

  function legacyNotifyRowToItem(row) {
    if (!row || typeof row !== "object") return null;
    if (isDevNotificationItem(row)) return row;
    const body = String(row.body || "");
    const nl = body.indexOf("\n");
    let payload = {};
    if (nl >= 0) {
      try {
        payload = JSON.parse(body.slice(nl + 1));
      } catch {
        payload = {};
      }
    }
    const targetId = String(row.user_id || payload.target_user_id || "").trim();
    const event = String(payload.event || "").trim();
    if (event === "system") {
      return {
        id: String(row.id || ""),
        type: "system",
        actorId: "",
        actorName: String(payload.creator || "TLV運営").trim(),
        targetId,
        systemTitle: String(payload.title || row.title || "").trim(),
        systemBody: String(payload.body || "").trim(),
        priority: String(payload.priority || "normal").trim(),
        targetUrl: String(row.target_url || "").trim(),
        createdAt: row.created_at || new Date().toISOString(),
        read: Boolean(row.read_at),
      };
    }
    const actorId = String(payload.actor_id || "").trim();
    if (!actorId || !targetId) return null;
    const kind =
      event === "comment_created"
        ? "comment"
        : event === "video_published"
          ? "video_published"
        : event === "live_started" || event === "broadcast_started"
          ? "live_started"
          : "follow";
    return {
      id: String(row.id || ""),
      type: kind,
      actorId,
      actorName: String(payload.actor_name || actorId).trim(),
      actorAvatar: String(payload.actor_avatar || "").trim(),
      targetId,
      videoId: String(payload.video_id || "").trim(),
      commentId: String(payload.comment_id || "").trim(),
      broadcastId: String(payload.broadcast_id || "").trim(),
      targetUrl: String(row.target_url || "").trim(),
      createdAt: row.created_at || new Date().toISOString(),
      read: Boolean(row.read_at),
    };
  }

  function migrateNotifyStoreIfNeeded() {
    if (!isLocalTlvDevHost()) return;
    try {
      const current = global.localStorage?.getItem(NOTIFY_STORE_KEY);
      if (current) return;
      const legacyRaw = global.localStorage?.getItem(NOTIFY_STORE_KEY_LEGACY);
      if (!legacyRaw) return;
      const legacy = JSON.parse(legacyRaw);
      if (!Array.isArray(legacy)) return;
      const migrated = legacy.map(legacyNotifyRowToItem).filter(Boolean);
      if (migrated.length) writeNotifyStore(migrated);
    } catch {
      /* ignore */
    }
  }

  function readNotifyStore() {
    migrateNotifyStoreIfNeeded();
    try {
      const raw = global.localStorage?.getItem(NOTIFY_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeNotifyStore(rows) {
    try {
      global.localStorage?.setItem(NOTIFY_STORE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }

  function followNotifyId(creatorId, followerId) {
    return `live-n-follow:${String(creatorId || "").trim()}:${String(followerId || "").trim()}`;
  }

  function commentNotifyId(videoId, commentId, actorId) {
    return `live-n-comment:${String(videoId || "").trim()}:${String(commentId || "").trim()}:${String(actorId || "").trim()}`;
  }

  function systemNotifyId(targetUserId, timestamp) {
    return `live-n-system:${String(targetUserId || "").trim()}:${String(timestamp || Date.now())}`;
  }

  function videoPublishedNotifyId(videoId, creatorId, viewerId) {
    return `live-n-video-published:${String(videoId || "").trim()}:${String(creatorId || "").trim()}:${String(viewerId || "").trim()}`;
  }

  function liveStartedNotifyId(liveId, creatorId, viewerId) {
    return `live-n-live-started:${String(liveId || "").trim()}:${String(creatorId || "").trim()}:${String(viewerId || "").trim()}`;
  }

  function getDevFollowersForCreator(creatorId) {
    const creator = String(creatorId || "").trim();
    if (!creator) return [];
    const store = readFollowStore();
    const followers = [];
    for (const [key, val] of Object.entries(store)) {
      if (val !== true) continue;
      const parts = String(key || "").split("::");
      if (parts.length !== 2) continue;
      const viewerId = String(parts[0] || "").trim();
      const cid = String(parts[1] || "").trim();
      if (cid !== creator || !viewerId || viewerId === creator) continue;
      followers.push(viewerId);
    }
    return followers;
  }

  function appendDevFollowNotification(opts) {
    if (!shouldUseTlvNotifyLocalFallback()) return null;
    const creatorId = String(opts?.creatorId || opts?.targetUserId || "").trim();
    const followerId = String(opts?.followerId || opts?.actorId || "").trim();
    const followerName = String(opts?.followerName || opts?.actorName || followerId).trim();
    const followerAvatar = String(opts?.followerAvatar || opts?.actorAvatar || "").trim();
    if (!creatorId || !followerId) return null;

    const id = followNotifyId(creatorId, followerId);
    const store = readNotifyStore().filter((row) => row.id !== id);
    store.unshift({
      id,
      type: "follow",
      actorId: followerId,
      actorName: followerName,
      actorAvatar: followerAvatar,
      targetId: creatorId,
      createdAt: new Date().toISOString(),
      read: false,
    });
    writeNotifyStore(store.slice(0, 200));
    return id;
  }

  function appendDevCommentNotification(opts) {
    if (!shouldUseTlvNotifyLocalFallback()) return null;
    const creatorId = String(opts?.creatorId || opts?.targetId || opts?.targetUserId || "").trim();
    const actorId = String(opts?.actorId || opts?.commenterId || "").trim();
    const videoId = String(opts?.videoId || "").trim();
    const commentId = String(opts?.commentId || "").trim();
    const actorName = String(opts?.actorName || actorId).trim();
    if (!creatorId || !actorId || !videoId || !commentId) return null;
    if (creatorId === actorId) return null;

    const id = commentNotifyId(videoId, commentId, actorId);
    const store = readNotifyStore().filter((row) => row.id !== id);
    store.unshift({
      id,
      type: "comment",
      actorId,
      actorName,
      actorAvatar: String(opts?.actorAvatar || "").trim(),
      targetId: creatorId,
      videoId,
      commentId,
      targetUrl: `watch-video.html?id=${encodeURIComponent(videoId)}`,
      createdAt: new Date().toISOString(),
      read: false,
    });
    writeNotifyStore(store.slice(0, 200));
    return id;
  }

  function appendDevLiveStartedNotifications(opts) {
    if (!shouldUseTlvNotifyLocalFallback()) return { ok: false, fanout: 0, ids: [] };
    const creatorId = String(opts?.creatorId || opts?.actorId || "").trim();
    const broadcastId = String(opts?.broadcastId || opts?.liveId || "").trim();
    const creatorName = String(opts?.creatorName || opts?.actorName || creatorId).trim();
    if (!creatorId || !broadcastId) return { ok: false, reason: "missing_ids", fanout: 0, ids: [] };

    const followers = getDevFollowersForCreator(creatorId);
    if (!followers.length) {
      return { ok: true, skipped: true, reason: "no_followers", fanout: 0, ids: [] };
    }

    let store = readNotifyStore();
    const ids = [];
    const targetUrl =
      global.TasuTlvNotificationTypes?.liveStartedTargetUrl?.(broadcastId) ||
      `watch-live.html?id=${encodeURIComponent(broadcastId)}`;
    for (const followerId of followers) {
      const id = liveStartedNotifyId(broadcastId, creatorId, followerId);
      store = store.filter((row) => String(row.id || "") !== id);
      store.unshift({
        id,
        type: "live_started",
        actorId: creatorId,
        actorName: creatorName,
        actorAvatar: String(opts?.creatorAvatar || opts?.actorAvatar || "").trim(),
        targetId: followerId,
        broadcastId,
        targetUrl,
        createdAt: new Date().toISOString(),
        read: false,
      });
      ids.push(id);
    }
    writeNotifyStore(store.slice(0, 200));
    return { ok: true, dev_local: true, fanout: ids.length, ids };
  }

  function appendDevVideoPublishedNotifications(opts) {
    if (!shouldUseTlvNotifyLocalFallback()) return { ok: false, fanout: 0, ids: [] };
    const creatorId = String(opts?.creatorId || opts?.actorId || "").trim();
    const videoId = String(opts?.videoId || "").trim();
    const creatorName = String(opts?.creatorName || opts?.actorName || creatorId).trim();
    if (!creatorId || !videoId) return { ok: false, reason: "missing_ids", fanout: 0, ids: [] };

    const followers = getDevFollowersForCreator(creatorId);
    if (!followers.length) {
      return { ok: true, skipped: true, reason: "no_followers", fanout: 0, ids: [] };
    }

    const targetUrl =
      global.TasuTlvNotificationTypes?.videoPublishedTargetUrl?.(videoId) ||
      `watch-video.html?id=${encodeURIComponent(videoId)}`;
    let store = readNotifyStore();
    const ids = [];
    for (const followerId of followers) {
      const id = videoPublishedNotifyId(videoId, creatorId, followerId);
      store = store.filter((row) => String(row.id || "") !== id);
      store.unshift({
        id,
        type: "video_published",
        actorId: creatorId,
        actorName: creatorName,
        actorAvatar: String(opts?.creatorAvatar || opts?.actorAvatar || "").trim(),
        targetId: followerId,
        videoId,
        targetUrl,
        createdAt: new Date().toISOString(),
        read: false,
      });
      ids.push(id);
    }
    writeNotifyStore(store.slice(0, 200));
    return { ok: true, dev_local: true, fanout: ids.length, ids };
  }

  function appendDevSystemNotification(opts) {
    if (!shouldUseTlvNotifyLocalFallback()) return { ok: false, reason: "dev_fallback_off" };
    const targetUserId = String(opts?.targetUserId || opts?.targetId || "").trim();
    const title = String(opts?.title || "").trim();
    const body = String(opts?.body || "").trim();
    const priority = global.TasuTlvNotificationTypes?.normalizeSystemPriority?.(opts?.priority) || "normal";
    const creator = String(opts?.creator || "TLV運営").trim();
    const targetUrl = String(opts?.targetUrl || opts?.target_url || "#").trim() || "#";
    if (!targetUserId || !title) {
      return { ok: false, reason: "missing_fields" };
    }

    const timestamp = Date.now();
    const id = systemNotifyId(targetUserId, timestamp);
    let store = readNotifyStore().filter((row) => String(row.id || "") !== id);
    store.unshift({
      id,
      type: "system",
      targetId: targetUserId,
      systemTitle: title,
      systemBody: body,
      title,
      body,
      priority,
      creator,
      targetUrl,
      createdAt: new Date().toISOString(),
      read: false,
    });
    writeNotifyStore(store.slice(0, 200));
    return { ok: true, dev_local: true, id, timestamp };
  }

  function markDevNotificationRead(notificationId, userId) {
    if (!shouldUseTlvNotifyLocalFallback()) return false;
    const id = String(notificationId || "").trim();
    const uid = String(userId || getTlvViewerTalkUserId() || "").trim();
    if (!id || !uid) return false;
    let changed = false;
    const next = readNotifyStore().map((row) => {
      if (String(row.id || "") !== id) return row;
      const targetId = String(row.targetId || row.target_user_id || row.user_id || "").trim();
      if (targetId && targetId !== uid) return row;
      changed = true;
      return { ...row, read: true, readAt: new Date().toISOString() };
    });
    if (changed) writeNotifyStore(next);
    return changed;
  }

  function removeDevFollowNotification(creatorId, followerId) {
    if (!shouldUseTlvNotifyLocalFallback()) return;
    const id = followNotifyId(creatorId, followerId);
    writeNotifyStore(readNotifyStore().filter((row) => row.id !== id));
  }

  function getDevNotificationsForUser(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return [];
    return readNotifyStore()
      .filter((row) => {
        const targetId = String(row.targetId || row.user_id || "").trim();
        return targetId === uid;
      })
      .map((row) => (isDevNotificationItem(row) ? devNotificationItemToRow(row) : row));
  }

  function countDevUnreadNotifications(userId) {
    const uid = String(userId || getTlvViewerTalkUserId() || "").trim();
    if (!uid) return 0;
    return readNotifyStore().filter((row) => {
      const targetId = String(row.targetId || row.user_id || "").trim();
      if (targetId !== uid) return false;
      if (isDevNotificationItem(row)) return row.read !== true;
      return !row.read_at;
    }).length;
  }

  function clearDevNotifyStore() {
    try {
      global.localStorage?.removeItem(NOTIFY_STORE_KEY);
      global.localStorage?.removeItem(NOTIFY_STORE_KEY_LEGACY);
    } catch {
      /* ignore */
    }
  }

  global.TasuTlvDevAuth = {
    DEMO_USER_ID,
    FORCE_GUEST_KEY,
    isLocalTlvDevHost,
    isForceGuest,
    setForceGuest,
    getRawAuthUser,
    shouldUseTlvDevDemo,
    getDemoAuthUser,
    resolveTlvAuthUser,
    isAuthenticatedForTlv,
    getTlvTalkUserId,
    getTlvViewerTalkUserId,
    handleDevLogout,
    FOLLOW_STORE_KEY,
    hasTalkDevParam,
    shouldUseTlvFollowLocalFallback,
    followEntryKey,
    readFollowStore,
    isDevFollowStored,
    setDevFollowStored,
    clearDevFollowStore,
    getDevStubProfile,
    shouldUseTlvProfileDevStub,
    DEV_STUB_PROFILES,
    NOTIFY_STORE_KEY,
    DEV_VIEWER_KEY,
    shouldUseTlvNotifyLocalFallback,
    appendDevFollowNotification,
    appendDevCommentNotification,
    appendDevLiveStartedNotifications,
    appendDevVideoPublishedNotifications,
    appendDevSystemNotification,
    commentNotifyId,
    systemNotifyId,
    liveStartedNotifyId,
    videoPublishedNotifyId,
    getDevFollowersForCreator,
    markDevNotificationRead,
    removeDevFollowNotification,
    getDevNotificationsForUser,
    countDevUnreadNotifications,
    clearDevNotifyStore,
  };
})(typeof window !== "undefined" ? window : globalThis);
