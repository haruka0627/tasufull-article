/**
 * TASFUL TALK — 本番 / 開発ランタイム判定
 */
(function (global) {
  "use strict";

  function getConfig() {
    return global.TASU_CHAT_SUPABASE_CONFIG || {};
  }

  function hostname() {
    return String(global.location?.hostname || "").toLowerCase();
  }

  /** 開発モード: localhost / ?talkDev=1 / config.talkDevMode */
  function isTalkDevMode() {
    const cfg = getConfig();
    if (cfg.talkDevMode === true) return true;
    try {
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("talkDev") === "1") return true;
    } catch {
      /* ignore */
    }
    const host = hostname();
    if (!host) return true;
    return host === "localhost" || host === "127.0.0.1";
  }

  /** ?talkAdmin=1 / localStorage 運営プレビュー（本番 host では無効） */
  function isTalkAdminPreviewActive() {
    if (isTalkProductionMode()) return false;
    try {
      if (global.localStorage?.getItem("tasu_talk_admin_preview") === "1") return true;
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("talkAdmin") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  /** 本番モード: 非 localhost かつ talkDev 無効 */
  function isTalkProductionMode() {
    const cfg = getConfig();
    if (cfg.talkProductionMode === false) return false;
    if (cfg.talkProductionMode === true) return true;
    return !isTalkDevMode();
  }

  function projectRefFromConfig() {
    const url = String(getConfig().url || "").trim();
    const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    return m ? m[1] : "";
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
        session?.access_token ||
        parsed.access_token ||
        session?.access_token;
      if (!access_token && !session?.user) return null;
      return {
        access_token: access_token || "",
        user: session?.user || parsed.user || null,
      };
    } catch {
      return null;
    }
  }

  function readSupabaseAuthSession() {
    const ref = projectRefFromConfig();
    const keys = ["tasu-supabase-auth"];
    if (ref) {
      keys.push(`sb-${ref}-auth-token`);
    }
    for (let i = 0; i < keys.length; i += 1) {
      const session = parseStoredAuthRaw(global.localStorage?.getItem(keys[i]));
      if (session?.access_token || session?.user) return session;
    }
    return null;
  }

  function pickTalkUserIdFromJwtPayload(payload) {
    const p = payload || {};
    return String(
      p.talk_user_id ||
        p.app_metadata?.talk_user_id ||
        p.user_metadata?.talk_user_id ||
        p.member_id ||
        p.app_metadata?.member_id ||
        p.user_metadata?.member_id ||
        p.sub ||
        ""
    ).trim();
  }

  /** 認証済み talk user id（同期） */
  function getAuthTalkUserIdSync() {
    const session = readSupabaseAuthSession();
    if (session?.access_token) {
      const fromJwt = pickTalkUserIdFromJwtPayload(decodeJwtPayload(session.access_token));
      if (fromJwt) return fromJwt;
    }
    if (session?.user) {
      const u = session.user;
      const fromMeta = pickTalkUserIdFromJwtPayload({
        talk_user_id: u.app_metadata?.talk_user_id || u.user_metadata?.talk_user_id,
        member_id: u.app_metadata?.member_id || u.user_metadata?.member_id,
        sub: u.id,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
      });
      if (fromMeta) return fromMeta;
    }

    try {
      const raw = global.localStorage?.getItem("tasu_member_session");
      const member = raw ? JSON.parse(raw) : null;
      if (member && typeof member === "object") {
        const id = String(
          member.talk_user_id ||
            member.talkUserId ||
            member.member_id ||
            member.memberId ||
            member.userId ||
            member.user_id ||
            member.id ||
            ""
        ).trim();
        if (id) return id;
      }
    } catch {
      /* ignore */
    }

    return "";
  }

  function isAdminFromAuth() {
    const session = readSupabaseAuthSession();
    const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
    const role = String(
      payload.role ||
        payload.app_metadata?.role ||
        payload.user_metadata?.role ||
        ""
    ).toLowerCase();
    if (role === "tasu_admin" || role === "admin" || role === "service_role") return true;
    if (String(payload.tasu_admin || payload.app_metadata?.tasu_admin || "") === "true") return true;
    return false;
  }

  /** 運営 UI 表示（JWT + ?talkAdmin=1 / localStorage プレビュー） */
  function isTalkAdmin() {
    if (isAdminFromAuth()) return true;
    if (isTalkAdminPreviewActive()) return true;
    return false;
  }

  function isBuilderFromAuth() {
    const session = readSupabaseAuthSession();
    const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
    const meta = payload.app_metadata || payload.user_metadata || {};
    if (meta.builder === true || meta.is_builder === true) return true;
    if (String(meta.builder_member || meta.builderMember || "") === "true") return true;
    return false;
  }

  /** Builder 利用者（JWT / プレビュー。運営は常に true） */
  function isBuilderUser() {
    if (isTalkAdmin()) return true;
    if (isBuilderFromAuth()) return true;
    try {
      if (global.localStorage?.getItem("tasu_builder_member") === "1") return true;
      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("builder") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function getTalkAuthRole() {
    const session = readSupabaseAuthSession();
    const payload = session?.access_token ? decodeJwtPayload(session.access_token) : {};
    const role = String(
      payload.role ||
        payload.app_metadata?.role ||
        payload.user_metadata?.role ||
        ""
    ).toLowerCase();
    return role || "(none)";
  }

  function getTalkCapabilities() {
    const admin = isTalkAdmin();
    const builder = isBuilderUser();
    return {
      admin,
      builder,
      /** 一般ユーザー向け LINE ライク表示 */
      simple: !admin && !builder,
    };
  }

  /** talk-home 権限デバッグ用スナップショット */
  function getTalkPermissionSnapshot() {
    let talkAdminParam = "";
    try {
      talkAdminParam = new URLSearchParams(global.location?.search || "").get("talkAdmin") || "";
    } catch {
      /* ignore */
    }
    const caps = getTalkCapabilities();
    return {
      isAdmin: caps.admin,
      isBuilder: caps.builder,
      role: getTalkAuthRole(),
      caps,
      talkAdminParam,
      talkAdminActive: talkAdminParam === "1",
      isTalkAdminPreviewActive: isTalkAdminPreviewActive(),
      isAdminFromAuth: isAdminFromAuth(),
      isBuilderFromAuth: isBuilderFromAuth(),
      isTalkDevMode: isTalkDevMode(),
      hostname: hostname(),
      href: String(global.location?.href || ""),
    };
  }

  function hasAuthenticatedTalkSession() {
    if (getAuthTalkUserIdSync()) return true;
    const session = readSupabaseAuthSession();
    if (session?.access_token) return true;
    try {
      const sb = global.TasuSupabase?.getClient?.();
      if (sb?.auth?.session?.access_token) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function isBroadcastEdgeConfigured() {
    const cfg = getConfig();
    return Boolean(String(cfg.talkBroadcastEdgeUrl || cfg.talkBroadcastEdgeFunction || "").trim());
  }

  function getBroadcastEdgeUrl() {
    const cfg = getConfig();
    const explicit = String(cfg.talkBroadcastEdgeUrl || "").trim();
    if (explicit) return explicit;
    const fn = String(cfg.talkBroadcastEdgeFunction || "").trim();
    const base = String(cfg.url || "").replace(/\/$/, "");
    if (fn && base) return `${base}/functions/v1/${fn.replace(/^\//, "")}`;
    return "";
  }

  function canClientDirectFanout() {
    if (!isTalkProductionMode()) return true;
    return false;
  }

  function productionBroadcastBlockedReason() {
    if (!isTalkProductionMode()) return "";
    if (isBroadcastEdgeConfigured()) return "";
    return "production_edge_required";
  }

  global.TasuTalkRuntime = {
    isTalkDevMode,
    isTalkProductionMode,
    getAuthTalkUserIdSync,
    hasAuthenticatedTalkSession,
    isAdminFromAuth,
    isTalkAdminPreviewActive,
    isTalkAdmin,
    isBuilderFromAuth,
    isBuilderUser,
    getTalkAuthRole,
    getTalkCapabilities,
    getTalkPermissionSnapshot,
    isBroadcastEdgeConfigured,
    getBroadcastEdgeUrl,
    canClientDirectFanout,
    productionBroadcastBlockedReason,
  };
})(typeof window !== "undefined" ? window : globalThis);
