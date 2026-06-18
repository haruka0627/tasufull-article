/**
 * 互換レイヤー: chat-supabase-config.js を読み込んだ後に置く
 * レガシー script が `config` / TASU_SUPABASE_CONFIG を参照する場合に備える
 */
(function (global) {
  "use strict";

  const chatConfig = global.TASU_CHAT_SUPABASE_CONFIG;

  if (!chatConfig) {
    console.warn(
      "[config.js] window.TASU_CHAT_SUPABASE_CONFIG がありません。chat-supabase-config.js を先に読み込んでください。"
    );
  }

  global.TASU_SUPABASE_CONFIG =
    global.TASU_SUPABASE_CONFIG || chatConfig || {};

  if (typeof global.config === "undefined") {
    global.config = global.TASU_SUPABASE_CONFIG;
  }
})(typeof window !== "undefined" ? window : globalThis);
