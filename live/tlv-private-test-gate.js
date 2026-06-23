/**
 * TASFUL LIVE / TLV — 非公開本番テスト表示（Phase 14）
 * Cloudflare Access が主ゲート。クライアントはバナー表示とソフトチェックのみ。
 */
(function (global) {
  "use strict";

  const ROBOTS_META = "noindex,nofollow,noarchive,nosnippet";

  function flags() {
    return global.TLV_FEATURE_FLAGS || {};
  }

  function isTalkDevBypass() {
    try {
      if (/[?&]talkDev=1(?:&|$)/.test(global.location?.search || "")) return true;
      if (global.TasuTalkRuntime?.isTalkDevMode?.()) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function isProductionHost() {
    const h = String(global.location?.hostname || "").toLowerCase();
    if (!h || h === "localhost" || h === "127.0.0.1") return false;
    return h === "tasful.jp" || h === "www.tasful.jp" || h.endsWith(".pages.dev");
  }

  function getUserEmail() {
    try {
      const u = global.TasuAuthCurrentUser?.getCurrentUser?.();
      return String(u?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function isAllowedTesterEmail() {
    const f = flags();
    const allowed = (f.allowedTestEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    const email = getUserEmail();
    return Boolean(email && allowed.includes(email));
  }

  function ensureRobotsMeta() {
    if (!global.document?.head) return;
    const existing = global.document.querySelector('meta[name="robots"]');
    if (existing) {
      existing.setAttribute("content", ROBOTS_META);
      return;
    }
    const meta = global.document.createElement("meta");
    meta.name = "robots";
    meta.content = ROBOTS_META;
    global.document.head.prepend(meta);
  }

  function shouldShowPrivateBanner() {
    const f = flags();
    if (f.publicEnabled) return false;
    if (f.privateTestEnabled) return true;
    return isProductionHost() && !isTalkDevBypass();
  }

  function renderBanner() {
    if (!shouldShowPrivateBanner() || !global.document?.body) return;
    if (global.document.querySelector("[data-tlv-private-test-banner]")) return;

    const f = flags();
    const allowed = isAllowedTesterEmail();
    const host = global.location?.hostname || "";
    const el = global.document.createElement("div");
    el.className = "tlv-private-test-banner";
    el.setAttribute("data-tlv-private-test-banner", "");
    el.setAttribute("role", "status");

    const accessNote = allowed
      ? "許可テストユーザーとしてログイン済み（ソフトチェック）"
      : "Cloudflare Access 認証が必要です（未許可メールは入れません）";

    el.innerHTML = `
      <p class="tlv-private-test-banner__title">TLV 非公開本番テスト中</p>
      <p class="tlv-private-test-banner__text">
        検索エンジン・一般導線には公開していません。
        <strong>${host}</strong> · ${accessNote}
      </p>
      <p class="tlv-private-test-banner__flags">
        TLV_PUBLIC_ENABLED=${f.publicEnabled ? "true" : "false"}
        · TLV_PRIVATE_TEST_ENABLED=${f.privateTestEnabled ? "true" : "false"}
      </p>
    `;
    global.document.body.prepend(el);
  }

  function isTlvPublicNavigationEnabled() {
    const f = flags();
    if (f.publicEnabled) return true;
    if (isTalkDevBypass()) return true;
    return false;
  }

  function mount() {
    ensureRobotsMeta();
    renderBanner();
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  global.TasuTlvPrivateTestGate = {
    flags,
    isTalkDevBypass,
    isProductionHost,
    isAllowedTesterEmail,
    shouldShowPrivateBanner,
    isTlvPublicNavigationEnabled,
    ensureRobotsMeta,
  };
})(typeof window !== "undefined" ? window : globalThis);
