/**
 * Tripo 3D — フロント用エンドポイント（API キーは含めない）
 */
(function () {
  "use strict";

  const raw = window.TASU_CHAT_SUPABASE_CONFIG || window.TASU_SUPABASE_CONFIG || {};
  const base = String(raw.url || raw.SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");

  const resolveKey =
    window.TasuSupabasePublicKey?.resolvePublishableAnonKey ||
    function fallbackResolve(config) {
      const k = String(config?.anonKey || config?.anon_key || "").trim();
      if (/^sb_secret_/i.test(k)) return "";
      return k;
    };

  const anonKey = resolveKey(raw);

  function fnUrl(name) {
    if (!base) return "";
    return `${base}/functions/v1/${name}`;
  }

  window.TasuTripoGenAiConfig = {
    supabaseUrl: base,
    anonKey,
    /** 実生成は Edge 側でも無効 */
    generationEnabled: false,
    healthCheckUrl: fnUrl("genai-3d-generate"),
    isConfigured() {
      return Boolean(base && anonKey && this.healthCheckUrl);
    },
    getHeaders() {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      };
    },
  };
})();
