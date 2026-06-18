/**
 * TASFUL — 共通 Auth helper（NB-3 STEP 2 / STEP 7 fallback lockdown）
 * P1-A2 設計: JWT app_metadata を正とし、本番 host では LS / URL / u_me fallback 禁止。
 *
 * 依存: talk-runtime.js（任意 · 先に読み込むと session 解決を委譲）
 */
(function (global) {
  "use strict";

  const PRODUCTION_HOSTS = Object.freeze(["tasful.jp", "www.tasful.jp"]);

  function getConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || {};
  }

  function hostname() {
    return String(global.location?.hostname || "").toLowerCase();
  }

  function protocol() {
    return String(global.location?.protocol || "").toLowerCase();
  }

  function searchParams() {
    try {
      return new URLSearchParams(global.location?.search || "");
    } catch {
      return new URLSearchParams();
    }
  }

  function isProductionHost() {
    const cfg = getConfig();
    if (cfg.talkProductionMode === true) return true;
    if (cfg.talkProductionMode === false) return false;
    const host = hostname();
    if (PRODUCTION_HOSTS.includes(host)) return true;
    return false;
  }

  function isDemoMode() {
    const cfg = getConfig();
    if (cfg.talkDevMode === true) return true;
    if (isProductionHost()) return false;

    const params = searchParams();
    if (params.get("talkDev") === "1") return true;

    const host = hostname();
    if (!host || host === "localhost" || host === "127.0.0.1") return true;
    if (protocol() === "file:") return true;

    if (params.get("benchEmbed") === "1") return true;
    if (params.get("demo") === "1") return true;
    if (params.get("preview") === "1") return true;

    try {
      if (global.sessionStorage?.getItem("tasu_ops_bench_mode") === "1") return true;
    } catch {
      /* ignore */
    }

    return false;
  }

  function isPreviewMode() {
    const params = searchParams();
    if (params.get("talkAdmin") === "1") return true;
    if (params.get("anpi_admin") === "1") return true;
    try {
      if (global.localStorage?.getItem("tasu_talk_admin_preview") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function isBenchMode() {
    const params = searchParams();
    if (params.get("benchEmbed") === "1") return true;
    if (params.get("builderFlow")) return true;
    try {
      if (global.sessionStorage?.getItem("tasu_ops_bench_mode") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  /** 本番 host では false。demo / bench / preview コンテキストのみ true。 */
  function canUseLocalStorageFallback() {
    if (isProductionHost()) return false;
    return isDemoMode();
  }

  function decodeJwtPayload(token) {
    try {
      const part = String(token || "").split(".")[1];
      if (!part) return {};
      const json = global.atob
        ? global.atob(part.replace(/-/g, "+").replace(/_/g, "/"))
        : "";
      return json ? JSON.parse(json) : {};
    } catch {
      return {};
    }
  }

  function parseStoredAuthRaw(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const session = parsed.currentSession || parsed.session || parsed;
      const access_token =
        session?.access_token || parsed.access_token || session?.access_token;
      if (!access_token && !session?.user) return null;
      return {
        access_token: access_token || "",
        user: session?.user || parsed.user || null,
      };
    } catch {
      return null;
    }
  }

  function projectRefFromConfig() {
    const url = String(getConfig().url || "").trim();
    const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    return m ? m[1] : "";
  }

  function readSupabaseAuthSession() {
    const ref = projectRefFromConfig();
    const keys = ["tasu-supabase-auth"];
    if (ref) keys.push(`sb-${ref}-auth-token`);
    for (let i = 0; i < keys.length; i += 1) {
      const session = parseStoredAuthRaw(global.localStorage?.getItem(keys[i]));
      if (session?.access_token || session?.user) return session;
    }
    return null;
  }

  function readAppMetadata(payload, user) {
    const p = payload || {};
    const fromUser = user?.app_metadata || {};
    const nested = p.app_metadata || {};
    return { ...fromUser, ...nested };
  }

  function pickString(...values) {
    for (let i = 0; i < values.length; i += 1) {
      const v = String(values[i] ?? "").trim();
      if (v) return v;
    }
    return "";
  }

  function pickBool(value) {
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    return false;
  }

  function getCurrentUserClaims() {
    const session = readSupabaseAuthSession();
    const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
    const user = session?.user || null;
    const appMeta = readAppMetadata(payload, user);

    const sub = pickString(user?.id, payload.sub);
    const talkUserId = pickString(
      appMeta.talk_user_id,
      payload.talk_user_id,
      appMeta.member_id,
      payload.member_id,
      sub
    );
    const memberId = pickString(appMeta.member_id, payload.member_id, talkUserId, sub);
    const role = pickString(appMeta.role, payload.role, "authenticated");
    const platformRole = pickString(
      appMeta.platform_role,
      payload.platform_role,
      appMeta.actor_type,
      payload.actor_type,
      "member"
    );
    const partnerId = pickString(appMeta.partner_id, payload.partner_id) || null;
    const ownerId = pickString(appMeta.owner_id, payload.owner_id) || null;
    const email = pickString(user?.email, payload.email);
    const isOps =
      pickBool(appMeta.is_ops) ||
      pickBool(payload.is_ops) ||
      role === "tasu_admin";

    return {
      sub,
      talk_user_id: talkUserId,
      member_id: memberId,
      email,
      role,
      platform_role: platformRole,
      partner_id: partnerId,
      owner_id: ownerId,
      is_ops: isOps,
    };
  }

  function readDemoUserIdFromUrl() {
    if (!canUseLocalStorageFallback()) return "";
    return pickString(searchParams().get("userId"));
  }

  function readDemoUserIdFromConfig() {
    if (!canUseLocalStorageFallback()) return "";
    const cfg = getConfig();
    return pickString(cfg.currentUserId, cfg.me?.id, "u_me");
  }

  function readDemoUserIdFromMemberSession() {
    if (!canUseLocalStorageFallback()) return "";
    try {
      const raw = global.localStorage?.getItem("tasu_member_session");
      const member = raw ? JSON.parse(raw) : null;
      if (!member || typeof member !== "object") return "";
      return pickString(
        member.talk_user_id,
        member.talkUserId,
        member.member_id,
        member.memberId,
        member.userId,
        member.user_id,
        member.id
      );
    } catch {
      return "";
    }
  }

  function resolveDemoFallbackUserId() {
    return (
      readDemoUserIdFromUrl() ||
      readDemoUserIdFromMemberSession() ||
      readDemoUserIdFromConfig()
    );
  }

  function buildCurrentUser(claims, source, authenticated) {
    const talkUserId =
      source === "demo_fallback"
        ? pickString(claims.talk_user_id)
        : pickString(claims.talk_user_id, claims.sub);
    return {
      authenticated: Boolean(authenticated && talkUserId),
      sub: claims.sub || "",
      talkUserId,
      memberId: pickString(claims.member_id, talkUserId),
      email: claims.email || "",
      role: claims.role || "authenticated",
      platformRole: claims.platform_role || "member",
      partnerId: claims.partner_id || null,
      ownerId: claims.owner_id || null,
      isOps: Boolean(claims.is_ops),
      source,
      claims,
    };
  }

  function getCurrentUser() {
    const claims = getCurrentUserClaims();
    const jwtUserId = pickString(claims.talk_user_id, claims.sub);

    if (jwtUserId) {
      return buildCurrentUser(claims, "jwt", true);
    }

    if (!canUseLocalStorageFallback()) {
      return buildCurrentUser(claims, "none", false);
    }

    const demoId = resolveDemoFallbackUserId();
    if (demoId) {
      return buildCurrentUser(
        { ...claims, talk_user_id: demoId, member_id: demoId },
        "demo_fallback",
        false
      );
    }

    return buildCurrentUser(claims, "none", false);
  }

  function requireCurrentUser(options) {
    const opts = options && typeof options === "object" ? options : {};
    const user = getCurrentUser();
    if (user.talkUserId) return user;

    if (opts.redirect !== false && global.TasuMemberAuth?.redirectToLogin) {
      global.TasuMemberAuth.redirectToLogin();
    }

    const err = new Error("TasuAuthCurrentUser: no authenticated user");
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  /** JWT のみ。本番では LS / URL admin 昇格は含めない。 */
  function isOpsUser() {
    const claims = getCurrentUserClaims();
    if (pickBool(claims.is_ops)) return true;
    return pickString(claims.role).toLowerCase() === "tasu_admin";
  }

  /** UI プレビュー用 ops 表示（demo のみ URL/LS 昇格可）。STEP 3 まで talk-runtime 互換。 */
  function isOpsPreviewActive() {
    if (isOpsUser()) return true;
    if (!canUseLocalStorageFallback()) return false;
    return isPreviewMode();
  }

  global.TasuAuthCurrentUser = {
    PRODUCTION_HOSTS,
    isProductionHost,
    isDemoMode,
    isPreviewMode,
    isBenchMode,
    canUseLocalStorageFallback,
    getCurrentUserClaims,
    getCurrentUser,
    requireCurrentUser,
    isOpsUser,
    isOpsPreviewActive,
    readSupabaseAuthSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
