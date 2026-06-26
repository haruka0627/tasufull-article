/**
 * TASFUL AI — 動画 / 音楽生成 API 設定（secret はここに置かない）
 * 本番: Supabase Edge または外部 API 有効化時に enabled: true
 */
(function (global) {
  "use strict";

  global.TasuAiMediaGenConfig = Object.freeze({
    video: Object.freeze({
      enabled: false,
      mock: true,
      endpoint: "",
    }),
    music: Object.freeze({
      enabled: false,
      mock: true,
      endpoint: "",
    }),
  });
})(typeof window !== "undefined" ? window : globalThis);
