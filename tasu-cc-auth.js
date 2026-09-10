/**
 * TasuCcAuth — Creator Content 認証・登録状態管理
 *
 * 依存: tasu-supabase-client.js（window.TasuSupabase）
 * 順序: chat-supabase-config.js → supabase-public-key.js →
 *       tasu-supabase-client.js → tasu-cc-auth.js
 *
 * JWT 検証: 実際の Supabase セッションのみ（forge / fake JWT 不可）
 * creatorMode: "loading" → "guest" | "registered"
 */
(function (global) {
  "use strict";

  const CC_API_PATH = "/api/creator-content-registration";
  const CC_DASHBOARD_PATH = "/creator-content/dashboard/";

  /**
   * ブラウザ側 Supabase セッションから JWT を取得。
   * セッションが無い場合は null。
   * @returns {Promise<string|null>}
   */
  async function getJwt() {
    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth) return null;
    try {
      const { data } = await client.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * JWT の Supabase project ref を安全に抽出（未署名チェックは不要 — Supabase が行う）。
   * @param {string} jwt
   * @returns {string}
   */
  function extractJwtRef(jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return String(payload.ref || "").trim();
    } catch {
      return "";
    }
  }

  /**
   * Supabase クライアントに有効なセッションがあるか（同期判定）。
   * bootstrap() 完了後のみ信頼できる。
   * @returns {boolean}
   */
  function isJwtAuthenticated() {
    return _source === "jwt";
  }

  let _creatorMode = "loading";
  let _source = "none";
  let _registrationData = null;
  let _bootstrapPromise = null;

  /**
   * /api/creator-content-registration に JWT を送り登録状態を返す。
   * @returns {Promise<{ok: boolean, registered?: boolean, status?: string, data?: object, reason?: string}>}
   */
  async function getMine() {
    const jwt = await getJwt();
    if (!jwt) return { ok: false, reason: "no_jwt" };

    let resp;
    try {
      resp = await fetch(CC_API_PATH, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      return { ok: false, reason: "fetch_error", error: String(err?.message || err) };
    }

    if (!resp.ok) {
      let body = {};
      try { body = await resp.json(); } catch { /* ignore */ }
      return {
        ok: false,
        reason: body.error || `http_${resp.status}`,
        httpStatus: resp.status,
      };
    }

    try {
      const data = await resp.json();
      return { ok: true, ...data };
    } catch {
      return { ok: false, reason: "json_parse_error" };
    }
  }

  /**
   * CC 認証 Bootstrap:
   * 1. Supabase セッションを確認
   * 2. JWT が存在すれば getMine() で登録状態を取得
   * 3. creatorMode を設定しイベントを発行
   * @returns {Promise<{creatorMode: string, source: string, registrationData: object|null}>}
   */
  async function bootstrap() {
    if (_bootstrapPromise) return _bootstrapPromise;
    _bootstrapPromise = _doBootstrap();
    return _bootstrapPromise;
  }

  async function _doBootstrap() {
    _creatorMode = "loading";
    _source = "none";
    _registrationData = null;

    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth) {
      _creatorMode = "guest";
      _source = "none";
      _dispatch("cc:ready", { creatorMode: "guest", source: "none" });
      return { creatorMode: "guest", source: "none", registrationData: null };
    }

    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = data?.session || null;
    } catch {
      /* ignore */
    }

    if (!session?.access_token) {
      _creatorMode = "guest";
      _source = "none";
      _dispatch("cc:ready", { creatorMode: "guest", source: "none" });
      return { creatorMode: "guest", source: "none", registrationData: null };
    }

    _source = "jwt";

    const result = await getMine();

    if (result.ok && result.registered) {
      _creatorMode = "registered";
      _registrationData = result.data || null;
    } else {
      _creatorMode = "guest";
    }

    const payload = {
      creatorMode: _creatorMode,
      source: _source,
      registrationData: _registrationData,
    };
    _dispatch("cc:ready", payload);
    return payload;
  }

  function _dispatch(eventName, detail) {
    try {
      global.document?.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: false }));
    } catch {
      /* ignore */
    }
  }

  /**
   * ページ読み込み後すぐに bootstrap を走らせたい場合に呼ぶ。
   * CC ダッシュボードページで DOMContentLoaded から呼ぶこと。
   */
  function autoBootstrap() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => void bootstrap());
    } else {
      void bootstrap();
    }
  }

  /**
   * CC ダッシュボードページ用ガード。
   * - 未認証 → ログインページへリダイレクト
   * - 認証済み → bootstrap() を実行して creatorMode を確定
   * @returns {Promise<boolean>} false = リダイレクト済み
   */
  async function guardCcDashboard() {
    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth) {
      const returnParam = encodeURIComponent(CC_DASHBOARD_PATH);
      global.location.replace(`/login.html?return=${returnParam}`);
      return false;
    }

    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = data?.session || null;
    } catch { /* ignore */ }

    if (!session?.access_token) {
      const returnParam = encodeURIComponent(CC_DASHBOARD_PATH);
      global.location.replace(`/login.html?return=${returnParam}`);
      return false;
    }

    return true;
  }

  global.TasuCcAuth = {
    isJwtAuthenticated,
    getJwt,
    extractJwtRef,
    getMine,
    bootstrap,
    autoBootstrap,
    guardCcDashboard,
    get creatorMode() {
      return _creatorMode;
    },
    get source() {
      return _source;
    },
    get registrationData() {
      return _registrationData;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
