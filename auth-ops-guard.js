/**
 * TASFUL — ops / admin ページガード（NB-3 STEP 3）
 * 本番 host: JWT is_ops / tasu_admin のみ。
 * デモ host: localhost / 127.0.0.1 / file / ?talkDev=1 — E2E·preview 互換。
 */
(function (global) {
  "use strict";

  const auth = () => global.TasuAuthCurrentUser || {};

  const OPS_GUARDED_PAGES = Object.freeze({
    "admin-operations-dashboard": { label: "AI運営司令塔" },
    "admin-ai-operations-center": { label: "AI運営センター" },
    "support-trouble-center": { label: "重要問い合わせセンター" },
    "talk-ops-room": { label: "運営TALK（レガシー）" },
    "anpi-line-admin": { label: "LINE安否運用（管理者）" },
  });

  function isOpsPreviewAllowed() {
    if (auth().isProductionHost?.()) return false;
    if (auth().isOpsUser?.()) return true;
    if (!auth().canUseLocalStorageFallback?.()) return false;
    return auth().isPreviewMode?.() === true;
  }

  /**
   * 運営 UI / 書込へのアクセス可否。
   * 本番: JWT ops のみ。URL / LS 昇格不可。
   * デモ: JWT ops · preview フラグ · localhost/file ベンチ互換。
   */
  function canAccessOps() {
    if (auth().isOpsUser?.()) return true;
    if (auth().isProductionHost?.()) return false;
    if (!auth().canUseLocalStorageFallback?.()) return false;
    if (auth().isPreviewMode?.()) return true;
    if (auth().isDemoMode?.()) return true;
    return false;
  }

  function requireOpsUser(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (canAccessOps()) {
      return auth().getCurrentUser?.() || { talkUserId: "", source: "none" };
    }
    const err = new Error("TasuAuthOpsGuard: ops access required");
    err.code = "OPS_REQUIRED";
    if (opts.redirect !== false) {
      denyOpsAccess({ mode: opts.mode || "403", pageName: opts.pageName });
    }
    throw err;
  }

  function requireAdminUser(options) {
    return requireOpsUser(options);
  }

  function renderOpsDenied(options) {
    const opts = options && typeof options === "object" ? options : {};
    const label = String(opts.pageName || "運営画面");
    const prod = auth().isProductionHost?.() === true;
    const demoHint = prod
      ? "運営 JWT（is_ops または tasu_admin）でログインしてください。"
      : "デモでは <code>?talkAdmin=1</code> または JWT 運営ロールが必要です。";

    document.documentElement.classList.add("tasu-ops-forbidden-root");
    document.body.classList.add("tasu-ops-forbidden");
    document.body.innerHTML =
      '<main class="tasu-ops-forbidden__panel" role="main" aria-labelledby="tasuOpsForbiddenTitle">' +
      "<h1 id=\"tasuOpsForbiddenTitle\">403 — アクセス権限がありません</h1>" +
      `<p><strong>${label.replace(/</g, "&lt;")}</strong>は運営者専用です。</p>` +
      `<p class="tasu-ops-forbidden__hint">${demoHint}</p>` +
      '<p class="tasu-ops-forbidden__actions">' +
      '<a href="dashboard.html">会員ページへ戻る</a>' +
      (prod ? ' · <a href="login.html">ログイン</a>' : "") +
      "</p>" +
      "</main>";

    const style = document.createElement("style");
    style.textContent =
      ".tasu-ops-forbidden-root,.tasu-ops-forbidden{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:#0f1419;color:#e7ecf2}" +
      ".tasu-ops-forbidden__panel{max-width:32rem;margin:4rem auto;padding:2rem;border:1px solid #334155;border-radius:12px;background:#1a2332}" +
      ".tasu-ops-forbidden__panel h1{font-size:1.25rem;margin:0 0 1rem}" +
      ".tasu-ops-forbidden__hint{color:#94a3b8;line-height:1.6}" +
      ".tasu-ops-forbidden__actions{margin-top:1.5rem}" +
      ".tasu-ops-forbidden__actions a{color:#38bdf8}";
    document.head.appendChild(style);
    document.title = "403 | TASFUL";
  }

  function denyOpsAccess(options) {
    const opts = options && typeof options === "object" ? options : {};
    const mode = String(opts.mode || "403").toLowerCase();
    if (mode === "redirect") {
      global.location.replace(String(opts.redirectUrl || "dashboard.html"));
      return { allowed: false, mode: "redirect" };
    }
    renderOpsDenied(opts);
    return { allowed: false, mode: "403" };
  }

  function guardOpsPage(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (canAccessOps()) {
      return { allowed: true, user: auth().getCurrentUser?.() };
    }
    return denyOpsAccess({
      pageName: opts.pageName,
      mode: opts.mode,
      redirectUrl: opts.redirectUrl,
    });
  }

  function guardOpsPageFromBody() {
    const page = String(document.body?.dataset?.page || "").trim();
    const spec = OPS_GUARDED_PAGES[page];
    if (!spec) return { allowed: true, skipped: true };
    return guardOpsPage({ pageName: spec.label, mode: "403" });
  }

  function autoInit() {
    const result = guardOpsPageFromBody();
    if (result?.allowed === false) {
      global.dispatchEvent(new CustomEvent("tasu:ops-guard-denied", { detail: result }));
    }
  }

  global.TasuAuthOpsGuard = {
    OPS_GUARDED_PAGES,
    isOpsPreviewAllowed,
    canAccessOps,
    requireOpsUser,
    requireAdminUser,
    guardOpsPage,
    guardOpsPageFromBody,
    denyOpsAccess,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})(typeof window !== "undefined" ? window : globalThis);
