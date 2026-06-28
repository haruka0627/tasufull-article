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
    /**
     * Phase2-03 · live-broadcasts ↔ Session Manager（既定 OFF · 本番 ZEGO 未接続）
     * true でも Session 状態同期のみ · Provider / Payment 非接触
     */
    liveSessionManagerEnabled: false,
    /**
     * Phase5 P5-3 · Platform Live Integration 経由（default OFF · 未定義も false）
     * true: TlvPlatformLiveAdapter 経由 · false: 既存 Supabase / stub フロー完全維持
     */
    usePlatformLive: false,
  });

  Object.defineProperty(global, "TLV_LIVE_SESSION_MANAGER_ENABLED", {
    get() {
      return global.TLV_FEATURE_FLAGS?.liveSessionManagerEnabled === true;
    },
    configurable: true,
  });

  Object.defineProperty(global, "TLV_USE_PLATFORM_LIVE", {
    get() {
      return global.TLV_FEATURE_FLAGS?.usePlatformLive === true;
    },
    configurable: true,
  });
})(typeof window !== "undefined" ? window : globalThis);
