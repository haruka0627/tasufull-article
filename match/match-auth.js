/**
 * TASFUL MATCH — auth boundary (Supabase JWT · demo fallback on localhost only)
 * Delegates to TasuAuthCurrentUser when loaded; reads tasu-supabase-auth session directly otherwise.
 */
(function (global) {
  "use strict";

  var STUB_USER_ID = "stub-user-current";
  var STUB_BEARER = "stub-match-token";
  var REFRESH_MARGIN_SEC = 120;

  var state = {
    mode: "none",
    isAuthenticated: false,
    authUserId: "",
    talkUserId: "",
    matchUserId: "",
    displayName: "あなた",
    profileStatus: "active",
    verificationStatus: "unverified",
    sanctionStatus: "none",
    accessToken: "",
    expiresAt: 0,
  };

  function pickString() {
    for (var i = 0; i < arguments.length; i += 1) {
      var v = String(arguments[i] ?? "").trim();
      if (v) return v;
    }
    return "";
  }

  function getConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || {};
  }

  function isProductionHost() {
    if (global.TasuAuthCurrentUser?.isProductionHost) {
      return global.TasuAuthCurrentUser.isProductionHost();
    }
    var host = String(global.location?.hostname || "").toLowerCase();
    return host === "tasful.jp" || host === "www.tasful.jp" || getConfig().talkProductionMode === true;
  }

  function isDemoMode() {
    if (global.TasuAuthCurrentUser?.isDemoMode) {
      return global.TasuAuthCurrentUser.isDemoMode();
    }
    if (isProductionHost()) return false;
    var host = String(global.location?.hostname || "").toLowerCase();
    return !host || host === "localhost" || host === "127.0.0.1" || global.location?.protocol === "file:";
  }

  function projectRefFromConfig() {
    var url = String(getConfig().url || "").trim();
    var m = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    return m ? m[1] : "";
  }

  function decodeJwtPayload(token) {
    try {
      var part = String(token || "").split(".")[1];
      if (!part) return {};
      var json = global.atob
        ? global.atob(part.replace(/-/g, "+").replace(/_/g, "/"))
        : "";
      return json ? JSON.parse(json) : {};
    } catch (_err) {
      return {};
    }
  }

  function parseStoredAuthRaw(raw) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      var session = parsed.currentSession || parsed.session || parsed;
      var accessToken = session?.access_token || parsed.access_token || "";
      if (!accessToken && !session?.user) return null;
      return {
        access_token: accessToken || "",
        refresh_token: session?.refresh_token || parsed.refresh_token || "",
        expires_at: session?.expires_at || parsed.expires_at || 0,
        user: session?.user || parsed.user || null,
      };
    } catch (_err) {
      return null;
    }
  }

  function readSupabaseAuthSession() {
    if (global.TasuAuthCurrentUser?.readSupabaseAuthSession) {
      return global.TasuAuthCurrentUser.readSupabaseAuthSession();
    }
    var ref = projectRefFromConfig();
    var keys = ["tasu-supabase-auth"];
    if (ref) keys.push("sb-" + ref + "-auth-token");
    for (var i = 0; i < keys.length; i += 1) {
      try {
        var session = parseStoredAuthRaw(global.localStorage?.getItem(keys[i]));
        if (session?.access_token) return session;
      } catch (_err) {
        /* ignore */
      }
    }
    return null;
  }

  function tokenExpiresAt(token, sessionExpiresAt) {
    var fromSession = Number(sessionExpiresAt || 0);
    if (Number.isFinite(fromSession) && fromSession > 0) {
      return fromSession > 1e12 ? Math.floor(fromSession / 1000) : fromSession;
    }
    var payload = decodeJwtPayload(token);
    var exp = Number(payload.exp || 0);
    return Number.isFinite(exp) ? exp : 0;
  }

  function isStubToken(token) {
    return String(token || "").trim() === STUB_BEARER;
  }

  function isRealJwt(token) {
    var value = String(token || "").trim();
    if (!value || isStubToken(value)) return false;
    return value.split(".").length === 3;
  }

  function applySession(session, source) {
    if (!session?.access_token) {
      state.accessToken = "";
      state.expiresAt = 0;
      state.isAuthenticated = false;
      state.mode = source === "demo" ? "demo" : "none";
      return false;
    }

    var token = String(session.access_token);
    var payload = decodeJwtPayload(token);
    var user = session.user || null;
    var appMeta = user?.app_metadata || payload.app_metadata || {};
    var talkUserId = pickString(
      appMeta.talk_user_id,
      payload.talk_user_id,
      appMeta.member_id,
      payload.member_id,
      user?.id,
      payload.sub,
    );

    state.accessToken = token;
    state.expiresAt = tokenExpiresAt(token, session.expires_at);
    state.talkUserId = talkUserId;
    state.matchUserId = talkUserId;
    state.authUserId = pickString(user?.id, payload.sub, talkUserId);
    state.isAuthenticated = Boolean(talkUserId);
    state.mode = source === "demo" ? "demo" : "jwt";
    return state.isAuthenticated;
  }

  function applyDemoFallback() {
    if (!isDemoMode()) return false;
    state.mode = "demo";
    state.isAuthenticated = true;
    state.talkUserId = STUB_USER_ID;
    state.matchUserId = STUB_USER_ID;
    state.authUserId = STUB_USER_ID;
    state.accessToken = STUB_BEARER;
    state.expiresAt = 0;
    return true;
  }

  function syncFromExternalAuth() {
    var session = readSupabaseAuthSession();
    if (session?.access_token && isRealJwt(session.access_token)) {
      return applySession(session, "jwt");
    }

    if (global.TasuAuthCurrentUser?.getCurrentUser) {
      try {
        var user = global.TasuAuthCurrentUser.getCurrentUser();
        if (user?.authenticated && user.talkUserId) {
          state.talkUserId = user.talkUserId;
          state.matchUserId = user.talkUserId;
          state.authUserId = pickString(user.sub, user.talkUserId);
          state.isAuthenticated = true;
          state.mode = user.source === "demo_fallback" ? "demo" : "jwt";
          if (session?.access_token) {
            state.accessToken = String(session.access_token);
            state.expiresAt = tokenExpiresAt(state.accessToken, session.expires_at);
          }
          return true;
        }
      } catch (_err) {
        /* ignore */
      }
    }

    if (applyDemoFallback()) return true;

    state.mode = "none";
    state.isAuthenticated = false;
    state.accessToken = "";
    return false;
  }

  function tokenNeedsRefresh() {
    if (!state.accessToken || isStubToken(state.accessToken)) return false;
    if (!state.expiresAt) return false;
    var now = Math.floor(Date.now() / 1000);
    return state.expiresAt - now <= REFRESH_MARGIN_SEC;
  }

  function persistRefreshedSession(session) {
    if (!session?.access_token) return;
    var ref = projectRefFromConfig();
    var keys = ["tasu-supabase-auth"];
    if (ref) keys.push("sb-" + ref + "-auth-token");
    var payload = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user,
    };
    for (var i = 0; i < keys.length; i += 1) {
      try {
        global.localStorage?.setItem(keys[i], JSON.stringify({ currentSession: payload }));
      } catch (_err) {
        /* ignore */
      }
    }
  }

  function refreshAccessToken() {
    var session = readSupabaseAuthSession();
    var refreshToken = session?.refresh_token || "";
    if (!refreshToken) {
      return Promise.resolve({ ok: false, code: "no_refresh_token", message: "Refresh token not available" });
    }

    var client = global.TasuSupabase?.getClient?.();
    if (client?.auth?.refreshSession) {
      return client.auth.refreshSession({ refresh_token: refreshToken }).then(function (result) {
        if (result.error || !result.data?.session?.access_token) {
          return {
            ok: false,
            code: "refresh_failed",
            message: result.error?.message || "Session refresh failed",
          };
        }
        persistRefreshedSession(result.data.session);
        applySession(result.data.session, "jwt");
        return { ok: true, access_token: state.accessToken };
      });
    }

    var cfg = getConfig();
    var url = String(cfg.url || "").replace(/\/$/, "");
    var anonKey = String(cfg.anonKey || "").trim();
    if (!url || !anonKey) {
      return Promise.resolve({ ok: false, code: "config_error", message: "Supabase config missing" });
    }

    return fetch(url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: "Bearer " + anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data?.access_token) {
            return {
              ok: false,
              code: "refresh_failed",
              message: data?.msg || data?.message || "Session refresh failed",
            };
          }
          var nextSession = {
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken,
            expires_at: data.expires_at,
            user: data.user || session.user || null,
          };
          persistRefreshedSession(nextSession);
          applySession(nextSession, "jwt");
          return { ok: true, access_token: state.accessToken };
        });
      })
      .catch(function (err) {
        return { ok: false, code: "refresh_failed", message: String(err?.message || err) };
      });
  }

  function ensureFreshAccessToken() {
    syncFromExternalAuth();
    if (!tokenNeedsRefresh()) {
      return Promise.resolve({ ok: Boolean(state.accessToken), access_token: state.accessToken });
    }
    return refreshAccessToken();
  }

  function cloneState() {
    return {
      mode: state.mode,
      isAuthenticated: state.isAuthenticated,
      authUserId: state.authUserId,
      talkUserId: state.talkUserId,
      matchUserId: state.matchUserId,
      displayName: state.displayName,
      profileStatus: state.profileStatus,
      verificationStatus: state.verificationStatus,
      sanctionStatus: state.sanctionStatus,
      hasAccessToken: Boolean(state.accessToken),
      tokenExpiresAt: state.expiresAt || null,
    };
  }

  function getState() {
    return cloneState();
  }

  function getAccessToken() {
    syncFromExternalAuth();
    return state.accessToken || "";
  }

  function getMatchUserId() {
    syncFromExternalAuth();
    return state.matchUserId || (isDemoMode() ? STUB_USER_ID : "");
  }

  function getTalkUserId() {
    syncFromExternalAuth();
    return state.talkUserId || (isDemoMode() ? STUB_USER_ID : "");
  }

  function isLoggedIn() {
    syncFromExternalAuth();
    return Boolean(state.isAuthenticated && getMatchUserId());
  }

  function hasProfile() {
    return state.profileStatus === "active" || state.profileStatus === "draft";
  }

  function isBanned() {
    return state.sanctionStatus === "banned" || state.sanctionStatus === "restricted";
  }

  function isVerified() {
    return state.verificationStatus === "verified";
  }

  function canUseSwipe() {
    return isLoggedIn() && hasProfile() && !isBanned();
  }

  function canUseTalk() {
    return isLoggedIn() && hasProfile() && !isBanned();
  }

  function canSubmitVerification() {
    return isLoggedIn() && hasProfile() && !isBanned();
  }

  function getAuthHeaders() {
    syncFromExternalAuth();
    var token = state.accessToken;

    if (isRealJwt(token)) {
      return { Authorization: "Bearer " + token };
    }

    if (isDemoMode() && isStubToken(token)) {
      return { Authorization: "Bearer " + STUB_BEARER };
    }

    if (isProductionHost()) {
      return {};
    }

    if (isDemoMode()) {
      return { Authorization: "Bearer " + STUB_BEARER };
    }

    return {};
  }

  function requireLogin() {
    if (!isLoggedIn()) {
      return { ok: false, code: "auth_required", message: "ログインが必要です" };
    }
    if (isProductionHost() && !isRealJwt(getAccessToken())) {
      return { ok: false, code: "auth_required", message: "ログインセッションが無効です" };
    }
    return { ok: true };
  }

  function requireProfile() {
    var login = requireLogin();
    if (!login.ok) return login;
    if (!hasProfile()) {
      return { ok: false, code: "profile_required", message: "プロフィール作成が必要です" };
    }
    return { ok: true };
  }

  function requireNotBanned() {
    var profile = requireProfile();
    if (!profile.ok) return profile;
    if (isBanned()) {
      return { ok: false, code: "match_user_banned", message: "利用制限中のため操作できません" };
    }
    return { ok: true };
  }

  function requireVerifiedFor(featureName) {
    var base = requireNotBanned();
    if (!base.ok) return base;
    if (isVerified()) return { ok: true };
    return {
      ok: false,
      code: "verification_required",
      message: (featureName || "この機能") + "には本人確認が必要です",
    };
  }

  function configure(nextState) {
    if (!nextState || typeof nextState !== "object") return cloneState();
    if (nextState.mode !== undefined) state.mode = String(nextState.mode);
    if (nextState.isAuthenticated !== undefined) {
      state.isAuthenticated = Boolean(nextState.isAuthenticated);
    }
    if (nextState.authUserId !== undefined) state.authUserId = String(nextState.authUserId);
    if (nextState.talkUserId !== undefined) state.talkUserId = String(nextState.talkUserId);
    if (nextState.matchUserId !== undefined) state.matchUserId = String(nextState.matchUserId);
    if (nextState.displayName !== undefined) state.displayName = String(nextState.displayName);
    if (nextState.profileStatus !== undefined) {
      state.profileStatus = String(nextState.profileStatus);
    }
    if (nextState.verificationStatus !== undefined) {
      state.verificationStatus = String(nextState.verificationStatus);
    }
    if (nextState.sanctionStatus !== undefined) {
      state.sanctionStatus = String(nextState.sanctionStatus);
    }
    if (nextState.accessToken !== undefined) state.accessToken = String(nextState.accessToken);
    if (state.matchUserId && !state.talkUserId) state.talkUserId = state.matchUserId;
    if (state.talkUserId && !state.matchUserId) state.matchUserId = state.talkUserId;
    return cloneState();
  }

  syncFromExternalAuth();

  global.TasfulMatchAuth = {
    getState: getState,
    getAccessToken: getAccessToken,
    getMatchUserId: getMatchUserId,
    getTalkUserId: getTalkUserId,
    isLoggedIn: isLoggedIn,
    hasProfile: hasProfile,
    isBanned: isBanned,
    isVerified: isVerified,
    canUseSwipe: canUseSwipe,
    canUseTalk: canUseTalk,
    canSubmitVerification: canSubmitVerification,
    getAuthHeaders: getAuthHeaders,
    ensureFreshAccessToken: ensureFreshAccessToken,
    refreshAccessToken: refreshAccessToken,
    syncFromExternalAuth: syncFromExternalAuth,
    isProductionHost: isProductionHost,
    isDemoMode: isDemoMode,
    isRealJwt: isRealJwt,
    requireLogin: requireLogin,
    requireProfile: requireProfile,
    requireNotBanned: requireNotBanned,
    requireVerifiedFor: requireVerifiedFor,
    configure: configure,
  };

  Object.defineProperty(global.TasfulMatchAuth, "mode", {
    get: function () {
      return state.mode;
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
