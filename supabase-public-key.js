/**
 * ブラウザ用 Supabase 公開キー（anon / publishable）の解決のみ。
 * service_role / sb_secret は絶対に返さない。
 */
(function () {
  "use strict";

  function isForbiddenKey(key) {
    const k = String(key || "").trim();
    if (!k) return false;
    if (/^sb_secret_/i.test(k)) return true;
    if (/service[_-]?role/i.test(k)) return true;
    if (/^sk_(live|test)_/i.test(k)) return true;
    if (/secret/i.test(k) && !/publishable/i.test(k)) return true;
    return false;
  }

  function isPublishableAnonKey(key) {
    const k = String(key || "").trim();
    if (!k || isForbiddenKey(k)) return false;
    if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(k)) return true;
    if (/^sb_publishable_/i.test(k)) return true;
    return false;
  }

  /**
   * @param {Record<string, unknown>} [raw]
   * @returns {string}
   */
  function resolvePublishableAnonKey(raw) {
    const config = raw || {};
    const candidates = [config.anonKey, config.anon_key, config.supabaseAnonKey];

    for (const candidate of candidates) {
      const key = String(candidate || "").trim();
      if (!key) continue;
      if (isForbiddenKey(key)) {
        console.error(
          "[TasuSupabasePublicKey] secret / service_role キーはブラウザでは使えません。Dashboard → API の anon public（sb_publishable_...）を anonKey に設定してください。"
        );
        continue;
      }
      if (isPublishableAnonKey(key)) return key;
    }

    return "";
  }

  window.TasuSupabasePublicKey = {
    isForbiddenKey,
    isPublishableAnonKey,
    resolvePublishableAnonKey,
  };
})();
