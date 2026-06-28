/**
 * Platform Live ZEGO PoC — 公開設定テンプレート
 *
 * 1. 本ファイルを platform-live-zego-config.js にコピー
 * 2. ZEGOCLOUD Console の AppID / Server URL を設定
 * 3. serverSecret は .env の ZEGO_SERVER_SECRET のみ（クライアントに置かない）
 *
 * platform-live-zego-config.js は Git コミットしないこと
 * E2E 実行時は scripts/lib/write-platform-zego-config.mjs が dist へ生成
 */
window.PLATFORM_LIVE_ZEGO_CONFIG = {
  provider: "zego",
  /** ZEGOCLOUD Console → AppID（数値 · 公開可） */
  appId: 0,
  /** ZEGOCLOUD Console → Server（wss://... 等 · 公開可） */
  server: "",
  /** Cloudflare Pages Function — Token 発行（secret はサーバー側のみ） */
  tokenApiPath: "/api/tlv-zego-token",
};
