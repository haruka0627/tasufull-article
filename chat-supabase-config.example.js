/**
 * Supabase 接続設定（このファイルを chat-supabase-config.js にコピーして値を入れてください）
 *
 * chat-supabase-config.js は .gitignore 推奨（anon key を含むため）
 *
 * 必ず Dashboard の同一プロジェクトからコピー:
 *   Settings → API → Project URL  → url
 *   Settings → API → anon public   → anonKey  （sb_publishable_... または eyJ... JWT）
 *
 * 禁止: service_role / sb_secret_... を anonKey に設定しない（ブラウザ・Edge Functions 呼び出しでエラー）
 */
window.TASU_CHAT_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2pxdWFjc3lxZXNyamhjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjgzOTAsImV4cCI6MjA5NDM0NDM5MH0.PtcRSCEDVBg5SCnQ9AMEWD2onkpPB7B6R8POQuDIzOA",
  /** ログイン中ユーザーID（transaction_reads.user_id / sender_id と一致させる） */
  currentUserId: "u_me",
  /** 2ユーザーテスト: ?userId=u_hiro で上書き（chat-user-identity.js） */
  me: {
    id: "u_me",
    displayName: "あなた",
    avatarUrl: "https://placehold.co/64x64/f3ead4/967622?text=ME",
  },
};
