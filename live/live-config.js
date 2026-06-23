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
    videos: "live_videos",
    videoLikes: "live_video_likes",
    videoReports: "live_video_reports",
    videoAds: "live_video_ads",
    creatorMonetization: "live_creator_monetization",
    adRpmSettings: "live_ad_rpm_settings",
    monetizationAuditLogs: "live_monetization_audit_logs",
    viewEvents: "live_video_view_events",
    adImpressionEvents: "live_ad_impression_events",
    riskFlags: "live_risk_flags",
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

  const VIDEO_BUCKET = "live-videos";
  const STORAGE_BUCKET_VIDEO_THUMBS = "live-thumbnails";
  const VIDEO_MAX_SIZE_BYTES = 2147483648;
  const VIDEO_ALLOWED_MIME_TYPES = Object.freeze(["video/mp4"]);
  const VIDEO_MIN_DURATION_SEC = 61;
  const VIDEO_SIGNED_URL_FUNCTION = "live-video-signed-url";
  const VIDEO_VIEW_FUNCTION = "live-video-view";
  const VIDEO_ADMIN_FUNCTION = "live-video-admin";
  const MONETIZATION_ADMIN_FUNCTION = "live-monetization-admin";
  const SECURITY_EVENTS_FUNCTION = "live-security-events";

  const SECURITY_VIEW_MIN_SECONDS = 10;
  const SECURITY_VIEW_MIN_RATIO = 0.3;
  const SECURITY_DEVICE_KEY_STORAGE = "tlv-anon-device-v1";

  const VIDEO_REPORT_REASONS = Object.freeze(["spam", "abuse", "copyright", "illegal", "other"]);

  const VIDEO_REPORT_REASON_LABELS = Object.freeze({
    spam: "スパム",
    abuse: "嫌がらせ・暴言",
    copyright: "著作権侵害",
    illegal: "違法・危険な内容",
    other: "その他",
  });

  const VIDEO_AD_TYPE_LABELS = Object.freeze({
    manual: "手動枠",
    pre_roll: "プレロール",
    mid_roll: "ミッドロール",
    overlay: "オーバーレイ",
  });

  /** Phase 10 — 推定収益 RPM（円 / 1000 表示） */
  const CREATOR_ESTIMATED_RPM_YEN = 100;
  /** 広告枠あり動画: 再生数に対する推定表示率 */
  const CREATOR_AD_IMPRESSION_FACTOR_WITH_SLOT = 0.85;
  /** 広告枠なし: スタブ推定表示率 */
  const CREATOR_AD_IMPRESSION_FACTOR_STUB = 0.15;

  const CREATOR_MONETIZATION_STATUS_LABELS = Object.freeze({
    not_applied: "未申請",
    none: "未申請",
    pending: "審査中",
    approved: "承認済み",
    suspended: "停止中",
    rejected: "却下",
  });

  const CREATOR_MONETIZATION_APPLY_MIN_VIDEOS = 3;
  const CREATOR_MONETIZATION_APPLY_MIN_VIEWS = 1000;
  const CREATOR_MONETIZATION_STORAGE_KEY = "tlv-creator-monetization-v1";
  const CREATOR_MONETIZATION_STATUS_KEY_PREFIX = "creator_monetization_status:";
  const CREATOR_MONETIZATION_NOTE_KEY_PREFIX = "creator_monetization_note:";
  const ADMIN_AD_RPM_STORAGE_KEY = "tlv-admin-ad-rpm-v1";
  const RISK_REASON_LABELS = Object.freeze({
    report_spam_burst: "通報荒らし疑い",
    device_view_burst: "端末連続視聴疑い",
    ad_impression_spike: "広告表示過多",
    reports_high: "通報多数",
    reports_warn: "通報注意",
    hidden_videos: "非表示動画あり",
    low_like_ratio: "低いいね率",
    ad_over: "広告表示過多（推定）",
    spike_suspect: "急激な再生増加疑い",
    report_spam_suspect: "通報荒らし疑い",
  });

  const VIDEO_VISIBILITY_OPTIONS = Object.freeze(["public", "unlisted", "private"]);

  const VIDEO_STATUS_LABELS = Object.freeze({
    draft: "下書き",
    processing: "処理中",
    published: "公開中",
    hidden: "非表示",
    removed: "削除済み",
  });

  const VIDEO_VISIBILITY_LABELS = Object.freeze({
    public: "公開",
    unlisted: "限定公開",
    private: "非公開",
  });

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

  function buildVideoStoragePath(userId, videoId) {
    const uid = String(userId || "").trim();
    const vid = String(videoId || "").trim();
    return `${uid}/${vid}.mp4`;
  }

  function buildVideoThumbStoragePath(userId, videoId, ext) {
    const uid = String(userId || "").trim();
    const vid = String(videoId || "").trim();
    const safeExt = String(ext || "jpg").replace(/^\./, "").toLowerCase();
    const normalized = safeExt === "jpeg" ? "jpg" : safeExt;
    if (!["jpg", "webp", "png"].includes(normalized)) {
      throw new Error("サムネイルは jpg / png / webp のみ対応しています");
    }
    return `${uid}/${vid}.${normalized}`;
  }

  function watchVideoUrl(videoId) {
    const id = encodeURIComponent(String(videoId || "").trim());
    return `watch-video.html?id=${id}`;
  }

  function videosListUrl() {
    return "videos.html";
  }

  function myVideosUrl() {
    return "my-videos.html";
  }

  function creatorDashboardUrl() {
    return "creator-dashboard.html";
  }

  function normalizeMonetizationStatus(value) {
    const s = String(value || "").trim();
    if (!s || s === "none") return "not_applied";
    return s;
  }

  function labelMonetizationStatus(value) {
    const key = normalizeMonetizationStatus(value);
    return CREATOR_MONETIZATION_STATUS_LABELS[key] || CREATOR_MONETIZATION_STATUS_LABELS.not_applied;
  }

  function estimateAdImpressions(viewsCount, hasActiveAdSlot) {
    const views = Math.max(0, Number(viewsCount || 0));
    const factor = hasActiveAdSlot ? CREATOR_AD_IMPRESSION_FACTOR_WITH_SLOT : CREATOR_AD_IMPRESSION_FACTOR_STUB;
    return Math.floor(views * factor);
  }

  function estimateRevenueYen(impressionsCount, rpmYen = CREATOR_ESTIMATED_RPM_YEN) {
    const impressions = Math.max(0, Number(impressionsCount || 0));
    const rpm = Math.max(0, Number(rpmYen || CREATOR_ESTIMATED_RPM_YEN));
    return (impressions / 1000) * rpm;
  }

  function formatYen(amount) {
    const n = Number(amount || 0);
    return `¥${Math.round(n).toLocaleString("ja-JP")}`;
  }

  function labelVideoStatus(value) {
    return VIDEO_STATUS_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function labelVideoVisibility(value) {
    return VIDEO_VISIBILITY_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function labelVideoReportReason(value) {
    return VIDEO_REPORT_REASON_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function labelVideoAdType(value) {
    return VIDEO_AD_TYPE_LABELS[String(value || "").trim()] || String(value || "—");
  }

  function isTalkAdminUser() {
    return Boolean(global.TasuTalkRuntime?.isTalkAdmin?.());
  }

  function adminVideosUrl() {
    return "admin-videos.html";
  }

  function getSupabaseProjectUrl() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    return String(cfg.url || "").replace(/\/$/, "");
  }

  function getPublicStorageUrl(bucket, objectPath) {
    const base = getSupabaseProjectUrl();
    const path = String(objectPath || "").trim();
    if (!base || !path) return null;
    const encoded = path.split("/").map((seg) => encodeURIComponent(seg)).join("/");
    return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`;
  }

  function formatVideoDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(iso);
    }
  }

  async function fetchCreatorProfile(userId) {
    const client = getClient();
    if (!client) throw new Error("Supabase が未設定です");
    await ensureSupabaseSession();
    const id = String(userId || "").trim();
    if (!id) return null;
    const { data, error } = await client
      .from(TABLES.profiles)
      .select("*")
      .eq("user_id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
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

  function probeLongVideoFileMeta(file) {
    return new Promise((resolve, reject) => {
      const video = global.document.createElement("video");
      video.preload = "metadata";
      const objectUrl = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        const raw = Number(video.duration || 0);
        if (!Number.isFinite(raw) || raw <= 0) {
          reject(new Error("動画の長さを取得できませんでした"));
          return;
        }
        resolve({
          durationSec: Math.ceil(raw),
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

  async function fetchVideoSignedUrlViaEdge(videoId) {
    if (isTalkDevStubMode()) {
      throw new Error("talkDev stub — edge skipped");
    }
    const base = getFunctionsBase();
    if (!base) throw new Error("Edge functions base URL が未設定です");

    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(cfg.anonKey || "").trim();
    const token = await getAccessTokenForEdge();
    if (!token) throw new Error("認証トークンがありません");

    const res = await fetch(`${base}/${VIDEO_SIGNED_URL_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ video_id: String(videoId || "").trim() }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  async function fetchVideoViewViaEdge(videoId) {
    if (isTalkDevStubMode()) {
      throw new Error("talkDev stub — edge skipped");
    }
    const base = getFunctionsBase();
    if (!base) throw new Error("Edge functions base URL が未設定です");

    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(cfg.anonKey || "").trim();
    const token = await getAccessTokenForEdge();
    if (!token) throw new Error("認証トークンがありません");

    const res = await fetch(`${base}/${VIDEO_VIEW_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ video_id: String(videoId || "").trim() }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  async function fetchVideoAdminViaEdge(body) {
    if (isTalkDevStubMode()) {
      throw new Error("talkDev stub — edge skipped");
    }
    const base = getFunctionsBase();
    if (!base) throw new Error("Edge functions base URL が未設定です");

    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(cfg.anonKey || "").trim();
    const token = await getAccessTokenForEdge();
    if (!token) throw new Error("認証トークンがありません");

    const res = await fetch(`${base}/${VIDEO_ADMIN_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  async function fetchMonetizationAdminViaEdge(body) {
    if (isTalkDevStubMode()) {
      throw new Error("talkDev stub — edge skipped");
    }
    const base = getFunctionsBase();
    if (!base) throw new Error("Edge functions base URL が未設定です");

    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(cfg.anonKey || "").trim();
    const token = await getAccessTokenForEdge();
    if (!token) throw new Error("認証トークンがありません");

    const res = await fetch(`${base}/${MONETIZATION_ADMIN_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  function labelRiskReason(code) {
    return RISK_REASON_LABELS[String(code || "").trim()] || String(code || "—");
  }

  async function getOrCreateDeviceKeyRaw() {
    try {
      let raw = global.localStorage?.getItem(SECURITY_DEVICE_KEY_STORAGE);
      if (!raw) {
        raw =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        global.localStorage?.setItem(SECURITY_DEVICE_KEY_STORAGE, raw);
      }
      return raw;
    } catch {
      return `ephemeral-${Date.now()}`;
    }
  }

  async function getDeviceKeyHash() {
    const raw = await getOrCreateDeviceKeyRaw();
    if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
  }

  async function fetchSecurityEventViaEdge(body, { requireAuth = false } = {}) {
    if (isTalkDevStubMode()) {
      throw new Error("talkDev stub — edge skipped");
    }
    const base = getFunctionsBase();
    if (!base) throw new Error("Edge functions base URL が未設定です");

    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    const anonKey = String(cfg.anonKey || "").trim();
    const token = await getAccessTokenForEdge();
    if (requireAuth && !token) throw new Error("認証トークンがありません");

    const res = await fetch(`${base}/${SECURITY_EVENTS_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token || anonKey}`,
      },
      body: JSON.stringify(body || {}),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.code = data?.code;
      err.payload = data;
      throw err;
    }

    return data;
  }

  async function recordQualifiedViewEvent(videoId, { watchedSeconds = 0, watchedRatio = 0 } = {}) {
    const deviceKey = await getDeviceKeyHash();
    return fetchSecurityEventViaEdge(
      {
        action: "record_view_event",
        video_id: String(videoId || "").trim(),
        watched_seconds: Math.floor(Number(watchedSeconds || 0)),
        watched_ratio: Number(watchedRatio || 0),
        device_key: deviceKey,
      },
      { requireAuth: true },
    );
  }

  async function recordAdImpressionEvent(videoId, adId) {
    const deviceKey = await getDeviceKeyHash();
    return fetchSecurityEventViaEdge({
      action: "record_ad_impression",
      video_id: String(videoId || "").trim(),
      ad_id: String(adId || "").trim(),
      device_key: deviceKey,
    });
  }

  async function submitVideoReportViaEdge(videoId, reason, detail) {
    const deviceKey = await getDeviceKeyHash();
    return fetchSecurityEventViaEdge(
      {
        action: "record_report_signal",
        video_id: String(videoId || "").trim(),
        reason: String(reason || "").trim(),
        detail: String(detail || "").trim(),
        device_key: deviceKey,
      },
      { requireAuth: true },
    );
  }

  async function fetchRiskFlagsAdminViaEdge(body) {
    return fetchSecurityEventViaEdge(body, { requireAuth: true });
  }

  async function fetchActiveVideoAds(videoId) {
    await ensureSupabaseSession();
    const client = getClient();
    if (!client) return [];

    const id = String(videoId || "").trim();
    if (!id) return [];

    const { data, error } = await client
      .from(TABLES.videoAds)
      .select("id, ad_type, position_sec, label, target_url, is_active")
      .eq("video_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  function isConfigured() {
    return Boolean(getClient());
  }

  function isPermissionDeniedError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    const code = String(err?.code || "").toUpperCase();
    return code === "42501" || msg.includes("permission denied");
  }

  function isPublicReadAccessError(err) {
    return isPermissionDeniedError(err);
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
    VIDEO_BUCKET,
    STORAGE_BUCKET_VIDEO_THUMBS,
    VIDEO_MAX_SIZE_BYTES,
    VIDEO_ALLOWED_MIME_TYPES,
    VIDEO_MIN_DURATION_SEC,
    VIDEO_SIGNED_URL_FUNCTION,
    VIDEO_VIEW_FUNCTION,
    VIDEO_ADMIN_FUNCTION,
    MONETIZATION_ADMIN_FUNCTION,
    SECURITY_EVENTS_FUNCTION,
    SECURITY_VIEW_MIN_SECONDS,
    SECURITY_VIEW_MIN_RATIO,
    SECURITY_DEVICE_KEY_STORAGE,
    RISK_REASON_LABELS,
    VIDEO_VISIBILITY_OPTIONS,
    VIDEO_STATUS_LABELS,
    VIDEO_VISIBILITY_LABELS,
    VIDEO_REPORT_REASONS,
    VIDEO_REPORT_REASON_LABELS,
    VIDEO_AD_TYPE_LABELS,
    CREATOR_ESTIMATED_RPM_YEN,
    CREATOR_AD_IMPRESSION_FACTOR_WITH_SLOT,
    CREATOR_AD_IMPRESSION_FACTOR_STUB,
    CREATOR_MONETIZATION_STATUS_LABELS,
    CREATOR_MONETIZATION_APPLY_MIN_VIDEOS,
    CREATOR_MONETIZATION_APPLY_MIN_VIEWS,
    CREATOR_MONETIZATION_STORAGE_KEY,
    CREATOR_MONETIZATION_STATUS_KEY_PREFIX,
    CREATOR_MONETIZATION_NOTE_KEY_PREFIX,
    ADMIN_AD_RPM_STORAGE_KEY,
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
    buildVideoStoragePath,
    buildVideoThumbStoragePath,
    watchVideoUrl,
    videosListUrl,
    myVideosUrl,
    creatorDashboardUrl,
    normalizeMonetizationStatus,
    labelMonetizationStatus,
    labelRiskReason,
    estimateAdImpressions,
    estimateRevenueYen,
    formatYen,
    labelVideoStatus,
    labelVideoVisibility,
    labelVideoReportReason,
    labelVideoAdType,
    isTalkAdminUser,
    adminVideosUrl,
    getPublicStorageUrl,
    formatVideoDate,
    fetchCreatorProfile,
    getSignedStorageUrl,
    getSignedShortVideoUrl,
    fetchShortSignedUrlViaEdge,
    fetchVideoSignedUrlViaEdge,
    fetchVideoViewViaEdge,
    fetchVideoAdminViaEdge,
    fetchMonetizationAdminViaEdge,
    getDeviceKeyHash,
    fetchSecurityEventViaEdge,
    recordQualifiedViewEvent,
    recordAdImpressionEvent,
    submitVideoReportViaEdge,
    fetchRiskFlagsAdminViaEdge,
    fetchActiveVideoAds,
    getAccessTokenForEdge,
    isTalkDevStubMode,
    getFunctionsBase,
    probeVideoFileMeta,
    probeLongVideoFileMeta,
    isConfigured,
    isPermissionDeniedError,
    isPublicReadAccessError,
    ensureSupabaseSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
