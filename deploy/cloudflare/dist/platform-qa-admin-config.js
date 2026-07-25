/**
 * Q&A 管理UIフラグ — 開発ホスト + ?qa_dev=1 のときのみ有効
 * 本番ホスト / production build では常に無効（?qa_dev=1 でも出さない）
 */
(function (global) {
  "use strict";

  const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

  const CONFIG = {
    isDevelopment: false,
    DEBUG: false,
    ADMIN_MODE: false,
  };

  function isDevHost() {
    if (typeof location === "undefined") return false;
    const host = String(location.hostname || "").toLowerCase();
    if (DEV_HOSTS.has(host)) return true;
    if (host.endsWith(".local")) return true;
    return false;
  }

  /** @returns {boolean | null} true=on, false=off, null=unset */
  function getQaDevQuery() {
    if (typeof location === "undefined") return null;
    const raw = new URLSearchParams(location.search).get("qa_dev");
    if (raw == null || raw === "") return null;
    const v = String(raw).trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
    if (v === "0" || v === "false" || v === "no" || v === "off") return false;
    return null;
  }

  function isAdminUiEnabled() {
    if (!isDevHost()) return false;
    const qaDev = getQaDevQuery();
    if (qaDev === false) return false;
    if (qaDev === true) return true;
    return !!(CONFIG.isDevelopment || CONFIG.DEBUG || CONFIG.ADMIN_MODE);
  }

  global.PlatformQaAdminConfig = {
    get isDevelopment() {
      return CONFIG.isDevelopment;
    },
    set isDevelopment(v) {
      CONFIG.isDevelopment = !!v;
    },
    get DEBUG() {
      return CONFIG.DEBUG;
    },
    set DEBUG(v) {
      CONFIG.DEBUG = !!v;
    },
    get ADMIN_MODE() {
      return CONFIG.ADMIN_MODE;
    },
    set ADMIN_MODE(v) {
      CONFIG.ADMIN_MODE = !!v;
    },
    isDevHost,
    getQaDevQuery,
    isAdminUiEnabled,
    isDevelopmentMode: isAdminUiEnabled,
  };
})(typeof window !== "undefined" ? window : globalThis);
