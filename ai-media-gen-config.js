/**
 * TASFUL AI — 動画 / 音楽生成 API 設定（secret はここに置かない）
 * 本番: Supabase Edge（ai-workspace-*-generate）· AI_MEDIA_GEN_EDGE_ENABLED=1
 */
(function (global) {
  "use strict";

  global.TasuAiMediaGenConfig = Object.freeze({
    video: Object.freeze({
      enabled: true,
      mock: false,
      endpoint: "ai-workspace-video-generate",
      timeoutMs: 90000,
    }),
    music: Object.freeze({
      enabled: true,
      mock: false,
      endpoint: "ai-workspace-music-generate",
      timeoutMs: 90000,
    }),
  });
})(typeof window !== "undefined" ? window : globalThis);
