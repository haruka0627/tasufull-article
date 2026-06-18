/**
 * 互換レイヤー: tasu-supabase-client.js のエイリアス
 * 読み込み順: chat-supabase-config.js → config.js → @supabase → tasu-supabase-client.js → 本ファイル
 */
(function (global) {
  "use strict";

  if (!global.TasuSupabase) {
    console.warn(
      "[supabase-client.js] TasuSupabase がありません。tasu-supabase-client.js を先に読み込んでください。"
    );
  }

  global.TasuSupabaseClient = global.TasuSupabase;
})(typeof window !== "undefined" ? window : globalThis);
