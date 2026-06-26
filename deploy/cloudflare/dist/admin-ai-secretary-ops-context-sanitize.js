/**
 * AI 秘書 OpsContext — PII サニタイズ（LLM 入力用）
 */
(function (global) {
  "use strict";

  const PII_SALT = "tasu_secretary_ops_v1";
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const PHONE_RE = /\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b|\b\d{10,11}\b/g;
  const URL_RE = /https?:\/\/[^\s]+/gi;
  const UUID_RE =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  const STRIPE_ACCT_RE = /\bacct_[a-zA-Z0-9]+\b/g;

  function fnv1a(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8);
  }

  function hashUserRef(raw) {
    const s = String(raw || "").trim();
    if (!s) return "user_unknown";
    return `user_${fnv1a(PII_SALT + s)}`;
  }

  function stripPiiPatterns(text) {
    return String(text || "")
      .replace(EMAIL_RE, "[email]")
      .replace(PHONE_RE, "[phone]")
      .replace(URL_RE, "[url]")
      .replace(STRIPE_ACCT_RE, "[stripe_acct]")
      .replace(UUID_RE, (m) => hashUserRef(m));
  }

  function sanitizeText(text, maxLen) {
    let t = stripPiiPatterns(text).replace(/\s+/g, " ").trim();
    if (maxLen > 0 && t.length > maxLen) t = t.slice(0, maxLen - 1) + "…";
    return t;
  }

  function maskPartnerName(name, index) {
    const n = sanitizeText(name, 40);
    if (!n || /^パートナー[A-Z]?$/i.test(n)) return n || `パートナー${String.fromCharCode(65 + (index % 26))}`;
    if (n.length <= 2) return `パートナー${String.fromCharCode(65 + (index % 26))}`;
    return n.charAt(0) + "…";
  }

  global.TasuSecretaryOpsContextSanitize = {
    hashUserRef,
    sanitizeText,
    maskPartnerName,
    stripPiiPatterns,
  };
})(typeof window !== "undefined" ? window : globalThis);
