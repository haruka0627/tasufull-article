/**
 * TASFUL LIVE — 共通設定・ヘルパー（Phase 1: プロフィール / フォロー）
 */
(function (global) {
  "use strict";

  const TABLES = Object.freeze({
    profiles: "live_creator_profiles",
    follows: "live_creator_follows",
    shorts: "live_shorts",
    likes: "live_short_likes",
    broadcasts: "live_broadcasts",
    broadcastMessages: "live_broadcast_messages",
    tips: "live_tips",
  });

  const LIVE_STREAM_PROVIDER_DEFAULT = "stub";
  const LIVE_TIP_PAYMENT_STATUS_STUB = "stub";
  const STUB_BROADCAST_TIP_TARGET_ID = "00000000-0000-4000-8000-0000000000bb";

  const LIVE_P0_GIFTS = Object.freeze([
    { id: "flower", name: "花", emoji: "🌸", priceYen: 100 },
    { id: "coffee", name: "コーヒー", emoji: "☕", priceYen: 300 },
    { id: "giftbox", name: "ギフトBOX", emoji: "🎁", priceYen: 500 },
    { id: "crown", name: "王冠", emoji: "👑", priceYen: 1000 },
    { id: "rocket", name: "ロケット", emoji: "🚀", priceYen: 3000 },
  ]);

  const LIVE_SIGNED_URL_TTL_SECONDS = 300;
  const LIVE_SHORT_DAILY_UPLOAD_LIMIT = 10;
  const LIVE_SHORT_ACTIVE_TOTAL_LIMIT = 50;
  const LIVE_SHORT_MAX_DURATION_SEC = 60;
  const STORAGE_BUCKET_SHORT_VIDEOS = "short-videos";
  const STORAGE_BUCKET_SHORT_THUMBS = "short-video-thumbnails";
  const LIVE_SHORT_SIGNED_URL_FUNCTION = "live-short-signed-url";
  const LIVE_NOTIFY_FUNCTION = "live-notify";

  const CREATOR_STATUS_LABELS = Object.freeze({
    draft: "下書き",
    active: "公開中",
    restricted: "制限中",
    suspended: "停止中",
  });

  const PERMISSION_STATUS_LABELS = Object.freeze({
    none: "未申請",
    identity_verified: "本人確認済み",
    ops_approved: "運営許可済み",
    suspended: "停止中",
  });

  const BROADCAST_STATUS_LABELS = Object.freeze({
    scheduled: "予定",
    preparing: "準備中",
    live: "配信中",
    ended: "終了",
    failed: "失敗",
    removed: "削除済み",
  });

  const STREAM_PROVIDER_LABELS = Object.freeze({
    stub: "スタブ（P0）",
    cloudflare_stream: "Cloudflare Stream",
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getClient() {
    return global.TasuSupabase?.getClient?.() || null;
  }

  function getTalkUserId() {
    const auth = global.TasuAuthCurrentUser?.getCurrentUser?.();
    if (auth?.talkUserId) return String(auth.talkUserId).trim();
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return String(cfg.currentUserId || cfg.me?.id || "").trim();
  }

  function resolveDisplayName(userId) {
    const id = String(userId || "").trim();
    if (!id) return "クリエイター";
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    if (cfg.me?.id === id && cfg.me?.displayName) return cfg.me.displayName;
    const identity = global.TasuChatUserIdentity?.getProfileForUserId?.(id);
    if (identity?.displayName) return identity.displayName;
    if (id === "u_me") return "あなた";
    if (id === "u_store") return "premium_home";
    if (id === "u_creator") return "LIVEクリエイター";
    return id;
  }

  function resolveAvatarUrl(userId) {
    const id = String(userId || "").trim();
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    if (cfg.me?.id === id && cfg.me?.avatarUrl) return cfg.me.avatarUrl;
    const identity = global.TasuChatUserIdentity?.getProfileForUserId?.(id);
    if (identity?.avatarUrl) return identity.avatarUrl;
    const initial = encodeURIComponent(resolveDisplayName(id).slice(0, 2) || "LV");
    return `https://placehold.co/128x128/1a1030/e879f9?text=${initial}`;
  }

  function labelCreatorStatus(value) {
    return CREATOR_STATUS_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function labelPermissionStatus(value) {
    return PERMISSION_STATUS_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function labelBroadcastStatus(value) {
    return BROADCAST_STATUS_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function labelStreamProvider(value) {
    return STREAM_PROVIDER_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function hasBroadcastPermission(profile) {
    if (!profile) return false;
    const perm = String(profile.live_permission_status || "").trim();
    const status = String(profile.creator_status || "").trim();
    return (
      status === "active" &&
      (perm === "identity_verified" || perm === "ops_approved")
    );
  }

  function watchUrl(broadcastId) {
    const id = encodeURIComponent(String(broadcastId || "").trim());
    return `watch.html?broadcast_id=${id}`;
  }

  function studioUrl() {
    return "studio.html";
  }

  function createBroadcastUrl() {
    return "create.html";
  }

  function giftsUrl(broadcastId, creatorUserId) {
    const params = new URLSearchParams();
    params.set("broadcast_id", String(broadcastId || "").trim());
    params.set("creator_user_id", String(creatorUserId || "").trim());
    const qs = global.location?.search || "";
    if (qs.includes("talkDev=1")) params.set("talkDev", "1");
    return `gifts.html?${params.toString()}`;
  }

  function tipsUrl() {
    return "tips.html";
  }

  function giftByPriceYen(amountYen) {
    const n = Number(amountYen);
    return LIVE_P0_GIFTS.find((g) => g.priceYen === n) || null;
  }

  function parseGiftNameFromMessage(message) {
    const m = String(message || "").match(/^【([^】]+)】/);
    return m ? m[1] : null;
  }

  function profileUrl(userId) {
    const id = encodeURIComponent(String(userId || "").trim());
    return `profile.html?userId=${id}`;
  }

  function buildShortStoragePath(userId, shortId) {
    const uid = String(userId || "").trim();
    const sid = String(shortId || "").trim();
    return `${uid}/${sid}.mp4`;
  }

  async function getSignedStorageUrl(bucket, path, ttlSeconds = LIVE_SIGNED_URL_TTL_SECONDS) {
    const client = getClient();
    if (!client) throw new Error("Supabase が未設定です");
    await ensureSupabaseSession();
    const objectPath = String(path || "").trim();
    if (!objectPath) throw new Error("storage path が空です");
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(objectPath, ttlSeconds);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("signed URL を取得できませんでした");
    return data.signedUrl;
  }

  async function getSignedShortVideoUrl(storagePath) {
    return getSignedStorageUrl(STORAGE_BUCKET_SHORT_VIDEOS, storagePath, LIVE_SIGNED_URL_TTL_SECONDS);
  }

  function isTalkDevStubMode() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("talkDev") === "1") return true;
      if (params.get("client_stub") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function getFunctionsBase() {
    const fromGlobal = String(global.__MATCH_FUNCTIONS_BASE__ || "").trim();
    if (fromGlobal) return fromGlobal.replace(/\/$/, "");
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || global.TASU_SUPABASE_CONFIG || {};
    const url = String(cfg.url || cfg.SUPABASE_URL || "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  async function getAccessTokenForEdge() {
    await ensureSupabaseSession();
    const client = getClient();
    if (client) {
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) return data.session.access_token;
    }
    const raw = global.TasuAuthCurrentUser?.readSupabaseAuthSession?.();
    return String(raw?.access_token || "").trim();
  }

  async function fetchShortSignedUrlViaEdge(shortId) {
    if (isTalkDevStubMode()) {
      throw new Error("talkDev stub — edge skipped");
    }
    const base = getFunctionsBase();
    if (!base) throw new Error("Edge functions base URL が未設定です");

    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(cfg.anonKey || "").trim();
    const token = await getAccessTokenForEdge();
    if (!token && !anonKey) throw new Error("認証トークンがありません");

    const res = await fetch(`${base}/${LIVE_SHORT_SIGNED_URL_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token || anonKey}`,
      },
      body: JSON.stringify({ short_id: String(shortId || "").trim() }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const signedUrl = data.signedUrl || data.signed_url;
    if (!signedUrl) throw new Error("signedUrl が返されませんでした");
    return signedUrl;
  }

  function probeVideoFileMeta(file) {
    return new Promise((resolve, reject) => {
      const video = global.document.createElement("video");
      video.preload = "metadata";
      const objectUrl = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        const durationSec = Math.max(1, Math.min(LIVE_SHORT_MAX_DURATION_SEC, Math.ceil(video.duration || 0)));
        resolve({
          durationSec,
          width: video.videoWidth || null,
          height: video.videoHeight || null,
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("動画ファイルを読み込めませんでした"));
      };
      video.src = objectUrl;
    });
  }

  function isConfigured() {
    return Boolean(getClient());
  }

  async function ensureSupabaseSession() {
    const client = getClient();
    if (!client) return null;

    const { data: sessionData } = await client.auth.getSession();
    if (sessionData?.session?.access_token) return sessionData.session;

    const raw = global.TasuAuthCurrentUser?.readSupabaseAuthSession?.();
    const token = String(raw?.access_token || "").trim();
    if (!token) return null;

    const { data, error } = await client.auth.setSession({
      access_token: token,
      refresh_token: String(raw?.refresh_token || "live-dev-refresh"),
    });
    if (error) throw error;
    return data?.session || null;
  }

  global.TasuLiveConfig = {
    TABLES,
    CREATOR_STATUS_LABELS,
    PERMISSION_STATUS_LABELS,
    BROADCAST_STATUS_LABELS,
    STREAM_PROVIDER_LABELS,
    LIVE_STREAM_PROVIDER_DEFAULT,
    LIVE_TIP_PAYMENT_STATUS_STUB,
    STUB_BROADCAST_TIP_TARGET_ID,
    LIVE_P0_GIFTS,
    LIVE_SIGNED_URL_TTL_SECONDS,
    LIVE_SHORT_DAILY_UPLOAD_LIMIT,
    LIVE_SHORT_ACTIVE_TOTAL_LIMIT,
    LIVE_SHORT_MAX_DURATION_SEC,
    STORAGE_BUCKET_SHORT_VIDEOS,
    STORAGE_BUCKET_SHORT_THUMBS,
    LIVE_SHORT_SIGNED_URL_FUNCTION,
    LIVE_NOTIFY_FUNCTION,
    escapeHtml,
    getClient,
    getTalkUserId,
    resolveDisplayName,
    resolveAvatarUrl,
    labelCreatorStatus,
    labelPermissionStatus,
    labelBroadcastStatus,
    labelStreamProvider,
    hasBroadcastPermission,
    watchUrl,
    studioUrl,
    createBroadcastUrl,
    giftsUrl,
    tipsUrl,
    giftByPriceYen,
    parseGiftNameFromMessage,
    profileUrl,
    buildShortStoragePath,
    getSignedStorageUrl,
    getSignedShortVideoUrl,
    fetchShortSignedUrlViaEdge,
    getAccessTokenForEdge,
    isTalkDevStubMode,
    getFunctionsBase,
    probeVideoFileMeta,
    isConfigured,
    ensureSupabaseSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
