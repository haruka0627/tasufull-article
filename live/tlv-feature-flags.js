/**
 * TASFUL LIVE / TLV — feature flags（ローカル開発用デフォルト）
 * 本番 Pages ビルド時は deploy/cloudflare/stage-cloudflare-pages.mjs が上書き生成する。
 */
(function (global) {
  "use strict";

  if (global.TLV_FEATURE_FLAGS) return;

  global.TLV_FEATURE_FLAGS = Object.freeze({
    /** 一般公開（true で noindex のみ残し導線開放 — 本番非公開テストでは false） */
    publicEnabled: false,
    /** 非公開本番テストモード */
    privateTestEnabled: true,
    /** Cloudflare Access と併用する許可テストメール */
    allowedTestEmails: Object.freeze(["rubi.hiro0613@gmail.com"]),
  });
})(typeof window !== "undefined" ? window : globalThis);
