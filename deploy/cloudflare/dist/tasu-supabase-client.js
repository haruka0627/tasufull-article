/**
 * TasuFull 共通 Supabase クライアント（シングルトン）
 * 設定: chat-supabase-config.js → window.TASU_CHAT_SUPABASE_CONFIG
 */
(function () {
  "use strict";

  /** @type {import('@supabase/supabase-js').SupabaseClient|null|false} */
  let client = null;
  let connectionLogged = false;

  function getRawConfig() {
    return window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
  }

  function normalizeConfig() {
    const raw = getRawConfig();
    const url = String(raw.url || raw.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const anonKey = window.TasuSupabasePublicKey?.resolvePublishableAnonKey
      ? window.TasuSupabasePublicKey.resolvePublishableAnonKey(raw)
      : String(raw.anonKey || raw.anon_key || "").trim().replace(/^sb_secret_.*/i, "");

    return {
      url,
      anonKey,
      currentUserId: raw.currentUserId || raw.current_user_id || "",
      me: raw.me || null,
      raw,
    };
  }

  function projectRefFromUrl(url) {
    const match = String(url || "").match(/https?:\/\/([^.]+)\.supabase\.co/i);
    return match ? match[1] : "";
  }

  function isConfigured() {
    const cfg = normalizeConfig();
    return Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  }

  function logConnectionInfo() {
    const cfg = normalizeConfig();
    const info = {
      url: cfg.url,
      projectRef: projectRefFromUrl(cfg.url),
      anonKeyPrefix: cfg.anonKey
        ? `${cfg.anonKey.slice(0, 24)}…`
        : "(missing)",
      configKeys: Object.keys(cfg.raw || {}),
    };

    console.info("[TasuSupabase] connection config", info);
    console.info(
      "[TasuSupabase] Supabase Dashboard → Settings → API の Project URL と一致しているか確認:",
      cfg.url || "(未設定)"
    );

    return info;
  }

  function getClient() {
    if (client) return client;
    if (client === false) return null;

    if (!isConfigured()) {
      client = false;
      console.warn(
        "[TasuSupabase] 未設定です。chat-supabase-config.js に url / anonKey を設定してください。"
      );
      return null;
    }

    const cfg = normalizeConfig();

    if (!connectionLogged) {
      logConnectionInfo();
      connectionLogged = true;
    }

    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        storageKey: "tasu-supabase-auth",
      },
    });

    return client;
  }

  function resetClient() {
    client = null;
    connectionLogged = false;
  }

  window.TasuSupabase = {
    getConfig: normalizeConfig,
    getRawConfig,
    getClient,
    isConfigured,
    logConnectionInfo,
    resetClient,
    getProjectRef() {
      return projectRefFromUrl(normalizeConfig().url);
    },
  };
})();
