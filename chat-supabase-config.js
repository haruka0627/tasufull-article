/**
 * Supabase 接続設定（全ページ共通・tasu-supabase-client.js が参照）
 *
 * Dashboard → Settings → API の値と一致させてください:
 *   - Project URL  → url
 *   - anon public   → anonKey
 *
 * members が null のときは URL / anonKey が別プロジェクトになっていないか確認。
 */
window.TASU_CHAT_SUPABASE_CONFIG = {
  url: "https://ddojquacsyqesrjhcvmn.supabase.co",
  /** Dashboard → API → anon public（sb_publishable_...）。service_role（sb_secret_...）は入れない */
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA",
  currentUserId: "u_me",
  me: {
    id: "u_me",
    displayName: "あなた",
    avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",
  },
};

/** TALK 音声通話 — Web Push / ICE（公開鍵のみ · 秘密鍵は Supabase secrets） */
window.TASU_TALK_CALL_CONFIG = window.TASU_TALK_CALL_CONFIG || {
  webPushVapidPublicKey: "BJb_vSGMXgVdjzk8LQJMnCVxb5nO6zsn857RDTBq3iT00n7R4dde1nON0LkQ2fTX5I9VYg_0NSq3B3iMzXwSjWA",
  pushIncomingEnabled: true,
  pushSubscribeEnabled: true,
};
