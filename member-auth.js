/**
 * 会員認証 — ログアウト / セッション判定 / 表示用プロフィールキャッシュ
 *
 * 認証セッション（tasu_member_session, Supabase Auth）と
 * 表示用キャッシュ（tasful_last_profile）は分離する。
 * logout() はログアウトボタン押下時のみ呼ぶこと。
 */
(function (global) {
  "use strict";

  const LOGOUT_REDIRECT = "index-top.html";
  const LOGIN_PAGE = "login.html";

  /**
   * 開発専用 — 認証チェックをスキップする（本番 host では必ず false）
   * localhost / file / ?devSkipAuth=1 のみ。pages.dev · tasful.jp では無効。
   */
  function isDevSkipAuthAllowed() {
    const cfg = global.TASU_CHAT_SUPABASE_CONFIG || {};
    if (cfg.talkProductionMode === true) return false;

    const host = String(global.location?.hostname || "").toLowerCase();
    if (host === "tasful.jp" || host === "www.tasful.jp") return false;
    if (host.endsWith(".pages.dev")) return false;

    const protocol = String(global.location?.protocol || "").toLowerCase();
    if (!host || host === "localhost" || host === "127.0.0.1") return true;
    if (protocol === "file:") return true;

    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("devSkipAuth") === "1") return true;
    } catch {
      /* ignore */
    }

    return false;
  }

  const SESSION_KEY = "tasu_member_session";
  const LAST_PROFILE_KEY = "tasful_last_profile";

  /** 前回ログイン表示用デフォルトアバター（URL 未設定・読み込み失敗時） */
  const DEFAULT_AVATAR_URL =
    global.TasuMemberProfile?.DEFAULT_AVATAR ||
    "https://placehold.co/64x64/f3ead4/967622?text=ME";

  /** ログアウト時に削除する認証系キー（表示キャッシュは含めない） */
  const AUTH_STORAGE_KEYS = [
    SESSION_KEY,
    "tasful_session",
    "tasful_auth",
    "tasu-supabase-auth",
    "tasful_user",
  ];

  const LEGACY_AUTH_KEYS = ["tasful_session", "tasful_auth", "tasful_user"];

  /** 退避後に削除する旧プロフィールキー（tasful_last_profile に統合） */
  const LEGACY_PROFILE_KEYS = [
    "tasful_user_profile",
    "tasful_user_display",
    "tasful_member_profile",
    "dashboard_user_profile",
  ];

  const MEMBER_GUARD_PAGES = new Set([
    "dashboard",
    "profile-settings",
    "payment-settings",
    "notification-settings",
    "my-listings",
    "listing-management",
    "business-directory-dashboard",
    "business-directory-new",
    "business-directory-edit",
    "sales-fees",
    "chat-list",
    "demo-progress",
    "demo-complete",
    "demo-paid",
    "demo-unpaid",
  ]);

  function pickDisplayName(fields) {
    if (!fields || typeof fields !== "object") return "";
    const nickname = String(fields.nickname || "").trim();
    if (nickname) return nickname;
    const displayName = String(
      fields.displayName || fields.display_name || fields.username || ""
    ).trim();
    if (displayName) return displayName;
    const name = String(fields.name || "").trim();
    if (name && name !== "—" && name !== "-") return name;
    return "";
  }

  function pickAvatarUrl(fields) {
    if (!fields || typeof fields !== "object") return "";
    return String(
      fields.avatarUrl ||
        fields.avatar_url ||
        fields.avatar ||
        fields.photoURL ||
        fields.photoUrl ||
        ""
    ).trim();
  }

  function readJsonStorage(key) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readMemberSession() {
    return readJsonStorage(SESSION_KEY);
  }

  /**
   * 表示用プロフィールを name / avatarUrl / email に正規化（認証判定には使わない）
   */
  function normalizeLastProfile(profile) {
    if (!profile || typeof profile !== "object") return null;

    const nameRaw =
      profile.name || profile.displayName || profile.username || null;
    const name = nameRaw ? String(nameRaw).trim() : null;
    const safeName =
      name && name !== "—" && name !== "-" ? name : null;

    const avatarRaw =
      profile.avatarUrl ||
      profile.avatar_url ||
      profile.avatar ||
      profile.photoURL ||
      profile.photoUrl ||
      null;
    const avatarUrl = avatarRaw ? String(avatarRaw).trim() : null;

    const emailRaw = profile.email || null;
    const email = emailRaw ? String(emailRaw).trim() : null;

    if (!safeName && !avatarUrl && !email) return null;

    return {
      name: safeName,
      avatarUrl,
      email,
    };
  }

  function readLastProfile() {
    const raw = readJsonStorage(LAST_PROFILE_KEY);
    const core = normalizeLastProfile(raw);
    if (!core) return null;
    return {
      ...core,
      id: String(raw?.id || raw?.userId || raw?.user_id || "").trim(),
      accountType: String(raw?.accountType || raw?.account_type || "").trim(),
      memberType: raw?.memberType || raw?.member_type || "individual",
    };
  }

  function accountTypeLabel(memberType) {
    if (memberType === "business") return "業者・法人";
    if (memberType === "individual") return "個人・事業者";
    return String(memberType || "個人・事業者").trim() || "個人・事業者";
  }

  function isValidMemberSession(session) {
    if (!session || typeof session !== "object") return false;
    const id = String(session.id || session.userId || session.user_id || "").trim();
    if (id) return true;
    const email = String(session.email || "").trim();
    return Boolean(email && (session.signedInAt || session.signed_in_at));
  }

  function isValidLegacyAuthRecord(data) {
    if (!data || typeof data !== "object") return false;
    const id = String(data.id || data.userId || data.user_id || data.uid || "").trim();
    if (id) return true;
    const token = String(
      data.access_token || data.accessToken || data.token || data.authToken || ""
    ).trim();
    if (token) return true;
    const email = String(data.email || "").trim();
    return Boolean(email && (data.signedInAt || data.expires_at || data.session));
  }

  function profileFromSession(session) {
    if (!session || typeof session !== "object") return null;
    const name = pickDisplayName(session);
    const avatarUrl = pickAvatarUrl(session);
    return {
      id: String(session.id || session.userId || session.user_id || "").trim(),
      name,
      nickname: String(session.nickname || "").trim() || name,
      display_name: String(session.display_name || session.displayName || "").trim() || name,
      avatarUrl,
      accountType: accountTypeLabel(session.memberType || session.member_type),
      email: String(session.email || "").trim(),
      memberType: session.memberType || session.member_type || "individual",
      lastLoginAt: session.signedInAt || session.signed_in_at || new Date().toISOString(),
    };
  }

  function mergeProfileFields(primary, fallback) {
    if (!fallback) return primary || {};
    const base = { ...(primary || {}) };
    if (!pickDisplayName(base) && pickDisplayName(fallback)) {
      const fbName = pickDisplayName(fallback);
      base.name = fbName;
      base.nickname = base.nickname || fallback.nickname || fbName || "";
      base.display_name = base.display_name || fallback.display_name || fbName || "";
    }
    if (!pickAvatarUrl(base) && pickAvatarUrl(fallback)) {
      base.avatarUrl = pickAvatarUrl(fallback);
    }
    if (!base.accountType && fallback.accountType) base.accountType = fallback.accountType;
    if (!base.email && fallback.email) base.email = fallback.email;
    if (!base.memberType && fallback.memberType) base.memberType = fallback.memberType;
    return base;
  }

  function collectProfileSnapshot() {
    const session = readMemberSession();
    let merged = profileFromSession(session) || {};

    LEGACY_PROFILE_KEYS.forEach((key) => {
      const legacy = readJsonStorage(key);
      if (legacy && typeof legacy === "object") {
        merged = mergeProfileFields(merged, normalizeLastProfile(legacy) || legacy);
      }
    });

    const tasfulUser = readJsonStorage("tasful_user");
    if (tasfulUser && typeof tasfulUser === "object") {
      merged = mergeProfileFields(merged, {
        ...normalizeLastProfile(tasfulUser),
        id: tasfulUser.id,
      });
    }

    merged = mergeProfileFields(merged, readLastProfile());

    const name = pickDisplayName(merged);
    return {
      id: String(merged.id || session?.id || "").trim(),
      name,
      nickname: String(merged.nickname || name).trim(),
      display_name: String(merged.display_name || name).trim(),
      avatarUrl: pickAvatarUrl(merged),
      accountType: merged.accountType || accountTypeLabel(session?.memberType),
      memberType: merged.memberType || session?.memberType || "individual",
      email: String(merged.email || session?.email || "").trim(),
      lastLogoutAt: new Date().toISOString(),
      lastLoginAt: merged.lastLoginAt || session?.signedInAt || "",
    };
  }

  function saveLastProfile(profile) {
    const snapshot = profile && typeof profile === "object" ? profile : collectProfileSnapshot();
    const normalized = normalizeLastProfile({
      ...snapshot,
      name: pickDisplayName(snapshot) || snapshot.name || snapshot.displayName,
      avatarUrl: pickAvatarUrl(snapshot),
      email: snapshot.email,
    });
    if (!normalized?.name) return null;
    const payload = {
      ...normalized,
      id: String(snapshot.id || snapshot.userId || snapshot.user_id || "").trim(),
      accountType:
        String(snapshot.accountType || snapshot.account_type || "").trim() ||
        accountTypeLabel(snapshot.memberType || snapshot.member_type),
      memberType: snapshot.memberType || snapshot.member_type || "individual",
      lastLoginAt: snapshot.lastLoginAt || new Date().toISOString(),
    };
    try {
      global.localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("[TasuMemberAuth] saveLastProfile failed:", err);
      return null;
    }
    return readLastProfile();
  }

  function syncLastProfileFromSession() {
    if (!isAuthenticatedSync()) return null;
    const session = readMemberSession();
    if (!session) return null;
    return saveLastProfile({
      ...profileFromSession(session),
      lastLoginAt: session.signedInAt || new Date().toISOString(),
    });
  }

  function clearLegacyProfileKeys() {
    LEGACY_PROFILE_KEYS.forEach((key) => {
      try {
        global.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });
  }

  function clearAuthStorage() {
    AUTH_STORAGE_KEYS.forEach((key) => {
      try {
        global.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });

    try {
      const extra = [];
      for (let i = 0; i < global.localStorage.length; i += 1) {
        const key = global.localStorage.key(i);
        if (!key) continue;
        if (/^sb-.*-auth-token$/i.test(key) || /^supabase\.auth\./i.test(key)) {
          extra.push(key);
        }
      }
      extra.forEach((key) => global.localStorage.removeItem(key));
    } catch {
      /* ignore */
    }

    try {
      const sessionKeys = [];
      for (let i = 0; i < global.sessionStorage.length; i += 1) {
        const key = global.sessionStorage.key(i);
        if (!key) continue;
        if (/tasu_member|tasful_(session|auth)|supabase.*auth/i.test(key)) {
          sessionKeys.push(key);
        }
      }
      sessionKeys.forEach((key) => global.sessionStorage.removeItem(key));
    } catch {
      /* ignore */
    }
  }

  function clearAuthMemory() {
    if (global.TASU_CHAT_SUPABASE_CONFIG) {
      delete global.TASU_CHAT_SUPABASE_CONFIG.me;
      delete global.TASU_CHAT_SUPABASE_CONFIG.currentUserId;
    }
    global.TasuChatUserIdentity?.applyToConfig?.();
  }

  async function signOutSupabase() {
    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth?.signOut) return;
    try {
      const { error } = await client.auth.signOut();
      if (error) console.warn("[TasuMemberAuth] signOut:", error);
    } catch (err) {
      console.warn("[TasuMemberAuth] signOut failed:", err);
    }
    global.TasuSupabase?.resetClient?.();
  }

  function mergeSessionWithLastProfile(session) {
    const last = readLastProfile();
    const next = { ...(session || {}) };
    if (!last) return next;

    const sameUser =
      !last.id ||
      !next.id ||
      String(last.id) === String(next.id) ||
      (last.email &&
        next.email &&
        String(last.email).toLowerCase() === String(next.email).toLowerCase());

    if (!sameUser) return next;

    if (!pickDisplayName(next) && last.name) {
      next.nickname = last.name;
      next.display_name = last.name;
      next.name = last.name;
    }
    const avatar = pickAvatarUrl(next);
    if (!avatar && last.avatarUrl) {
      next.avatar_url = last.avatarUrl;
      next.avatarUrl = last.avatarUrl;
    }
    if (!next.memberType && last.memberType) next.memberType = last.memberType;
    return next;
  }

  function establishLocalSession(session) {
    const merged = mergeSessionWithLastProfile({
      ...session,
      signedInAt: new Date().toISOString(),
    });
    try {
      global.localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn("[TasuMemberAuth] establishLocalSession failed:", err);
      return null;
    }
    saveLastProfile({
      ...profileFromSession(merged),
      lastLoginAt: merged.signedInAt,
    });
    global.TasuMemberProfile?.syncChatConfigMe?.();
    return merged;
  }

  async function fetchSupabaseProfileRow(userId) {
    const client = global.TasuSupabase?.getClient?.();
    if (!client || !userId) return null;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }

  async function establishSupabaseSession(user) {
    if (!user?.id) return null;
    const meta = user.user_metadata || {};
    let session = {
      id: String(user.id),
      email: String(user.email || "").trim(),
      nickname: String(meta.nickname || meta.nick_name || "").trim(),
      display_name: String(meta.display_name || meta.full_name || "").trim(),
      name: String(meta.name || "").trim(),
      avatar_url: pickAvatarUrl(meta),
      memberType: String(meta.member_type || "individual").trim() || "individual",
    };

    const row = await fetchSupabaseProfileRow(user.id);
    if (row) {
      if (!session.display_name && row.display_name) {
        session.display_name = String(row.display_name).trim();
      }
      if (row.avatar_url) session.avatar_url = String(row.avatar_url).trim();
    }

    const established = establishLocalSession(session);
    return established;
  }

  /**
   * 同期認証判定（優先: tasu_member_session → レガシー認証キー）
   * tasful_last_profile のみでは true にならない。
   */
  function isAuthenticatedSync() {
    if (isDevSkipAuthAllowed()) return true;

    try {
      const session = readMemberSession();
      if (isValidMemberSession(session)) return true;
    } catch {
      /* ignore */
    }

    for (const key of LEGACY_AUTH_KEYS) {
      const data = readJsonStorage(key);
      if (isValidLegacyAuthRecord(data)) return true;
    }

    return false;
  }

  /**
   * 非同期認証判定: 同期判定 → Supabase Auth
   */
  async function isAuthenticated() {
    if (isDevSkipAuthAllowed()) return true;
    if (isAuthenticatedSync()) return true;

    const client = global.TasuSupabase?.getClient?.();
    if (client?.auth) {
      try {
        const { data } = await client.auth.getSession();
        if (data?.session?.user?.id) return true;
      } catch {
        /* ignore */
      }
    }

    return false;
  }

  function applyLastProfileFallback(profile) {
    const last = readLastProfile();
    if (!last?.name) return profile;
    const next = { ...(profile || {}) };
    if (!pickDisplayName(next)) {
      next.nickname = last.name;
      next.display_name = last.name;
      next.name = last.name;
      next.displayName = last.name;
      next.welcomeName =
        global.TasuDashboardData?.pickWelcomeName?.(next) || last.name;
    }
    if (!pickAvatarUrl(next) && last.avatarUrl) {
      next.avatarUrl = last.avatarUrl;
    }
    if (!next.displayName) {
      next.displayName = pickDisplayName(next) || "会員";
    }
    if (!next.welcomeName) {
      next.welcomeName = global.TasuDashboardData?.pickWelcomeName?.(next) || next.displayName;
    }
    return next;
  }

  function getReturnUrl(fallback) {
    try {
      const params = new URLSearchParams(global.location.search);
      const raw = String(params.get("return") || params.get("next") || "").trim();
      if (!raw) return fallback || "dashboard.html";
      const safe = raw.split("#")[0].split("?")[0].replace(/^\.\//, "");
      if (!safe || safe.includes("://") || safe.startsWith("//")) {
        return fallback || "dashboard.html";
      }
      return safe;
    } catch {
      return fallback || "dashboard.html";
    }
  }

  async function guardMemberPage() {
    if (isDevSkipAuthAllowed()) return true;

    const page = document.body?.dataset?.page;
    if (!MEMBER_GUARD_PAGES.has(page)) return true;

    if (isAuthenticatedSync()) {
      syncLastProfileFromSession();
      return true;
    }

    if (await isAuthenticated()) {
      syncLastProfileFromSession();
      return true;
    }

    const returnTarget = encodeURIComponent(
      `${global.location.pathname.split("/").pop() || "dashboard.html"}${global.location.search || ""}`
    );
    global.location.replace(`${LOGIN_PAGE}?return=${returnTarget}`);
    return false;
  }

  async function guardLoginPage() {
    if (isDevSkipAuthAllowed()) return;
    if (document.body?.dataset?.page !== "login") return;
    if (isAuthenticatedSync() || (await isAuthenticated())) {
      global.location.replace(getReturnUrl("dashboard.html"));
    }
  }

  /**
   * ログアウトボタン押下時のみ呼ぶ。ページ読み込み時には呼ばない。
   * @param {{ redirect?: string|false, skipProfileSave?: boolean }} [options]
   */
  async function logout(options) {
    const redirect =
      options && Object.prototype.hasOwnProperty.call(options, "redirect")
        ? options.redirect
        : LOGOUT_REDIRECT;

    if (!options?.skipProfileSave) {
      saveLastProfile(collectProfileSnapshot());
    }

    await signOutSupabase();
    clearAuthStorage();
    clearLegacyProfileKeys();
    clearAuthMemory();

    if (redirect) {
      global.location.replace(redirect);
    }

    return { ok: true, redirect: redirect || null };
  }

  global.TasuMemberAuth = {
    get DEV_SKIP_AUTH() {
      return isDevSkipAuthAllowed();
    },
    isDevSkipAuthAllowed,
    LOGOUT_REDIRECT,
    LOGIN_PAGE,
    SESSION_KEY,
    LAST_PROFILE_KEY,
    DEFAULT_AVATAR_URL,
    AUTH_STORAGE_KEYS,
    LEGACY_PROFILE_KEYS,
    readMemberSession,
    readLastProfile,
    normalizeLastProfile,
    saveLastProfile,
    syncLastProfileFromSession,
    collectProfileSnapshot,
    clearAuthStorage,
    clearAuthMemory,
    signOutSupabase,
    establishLocalSession,
    establishSupabaseSession,
    mergeSessionWithLastProfile,
    applyLastProfileFallback,
    isAuthenticated,
    isAuthenticatedSync,
    getReturnUrl,
    guardMemberPage,
    guardLoginPage,
    logout,
  };

  async function bootAuthGuards() {
    await guardLoginPage();
    await guardMemberPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void bootAuthGuards());
  } else {
    void bootAuthGuards();
  }
})(typeof window !== "undefined" ? window : globalThis);
