/**
 * Platform — Google ログイン（Supabase OAuth · LINE 非対応）
 * 本番 / staging: location.origin ベースの redirectTo
 */
(function (global) {
  "use strict";

  const PROVIDER = "google";

  function pickReturnTo(explicit) {
    const fromArg = String(explicit || "").trim();
    if (fromArg) return fromArg;
    return global.TasuMemberAuth?.getReturnUrl?.("dashboard.html") || "dashboard.html";
  }

  function sanitizeReturnPath(raw) {
    const safe = String(raw || "")
      .trim()
      .split("#")[0]
      .split("?")[0]
      .replace(/^\.\//, "");
    if (!safe || safe.includes("://") || safe.startsWith("//")) return "dashboard.html";
    return safe;
  }

  /** @param {string} [returnTo] */
  function buildRedirectUrl(returnTo) {
    const origin = String(global.location?.origin || "").replace(/\/$/, "");
    const base = origin ? `${origin}/login.html` : "login.html";
    const params = new URLSearchParams();
    params.set("oauth", PROVIDER);
    params.set("return", sanitizeReturnPath(returnTo));
    return `${base}?${params.toString()}`;
  }

  /**
   * @param {{ returnTo?: string }} [opts]
   */
  async function signInWithGoogle(opts) {
    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth?.signInWithOAuth) {
      return { ok: false, error: "no_supabase", message: "Supabase 未設定のため Google ログインは利用できません。" };
    }
    const returnTo = pickReturnTo(opts?.returnTo);
    const redirectTo = buildRedirectUrl(returnTo);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: PROVIDER,
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) return { ok: false, error: error.message || "oauth_failed", raw: error };
    return { ok: true, data, redirectTo };
  }

  async function handleOAuthCallback() {
    const client = global.TasuSupabase?.getClient?.();
    if (!client?.auth) return { ok: false, skipped: true, reason: "no_client" };

    const params = new URLSearchParams(global.location.search);
    const isOAuthReturn =
      params.get("oauth") === PROVIDER ||
      /access_token|refresh_token|code=/.test(String(global.location.hash || ""));

    if (!isOAuthReturn) return { ok: false, skipped: true, reason: "not_oauth" };

    const code = params.get("code");
    if (code && client.auth.exchangeCodeForSession) {
      const exchanged = await client.auth.exchangeCodeForSession(code);
      if (exchanged.error) return { ok: false, error: exchanged.error.message };
      if (exchanged.data?.session?.user) {
        await global.TasuMemberAuth?.establishSupabaseSession?.(exchanged.data.session.user);
        return { ok: true, via: "code" };
      }
    }

    const { data, error } = await client.auth.getSession();
    if (error) return { ok: false, error: error.message };
    if (!data?.session?.user) return { ok: false, error: "no_session" };

    await global.TasuMemberAuth?.establishSupabaseSession?.(data.session.user);
    return { ok: true, via: "session" };
  }

  function redirectAfterOAuth() {
    const target = pickReturnTo();
    global.location.replace(sanitizeReturnPath(target));
  }

  global.TasuPlatformGoogleAuth = {
    PROVIDER,
    buildRedirectUrl,
    signInWithGoogle,
    handleOAuthCallback,
    redirectAfterOAuth,
    sanitizeReturnPath,
  };
})(typeof window !== "undefined" ? window : globalThis);
