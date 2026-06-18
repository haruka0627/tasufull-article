# TASFUL TALK 通話 Phase5 — TURN 導入準備・設定レイヤー

**日付:** 2026-06-17  
**状態:** 実装完了（外部 TURN 契約・本番デプロイは未実施）

## 目的

Phase1〜4 で完成した 1:1 音声通話に、本番ネットワーク（厳格 NAT / ファイアウォール）でも安定しやすい **TURN/STUN 設定レイヤー**を追加する。既存の STUN のみ構成をデフォルトとして維持し、TURN credentials を環境変数または `window` 設定から注入できるようにした。

## 実装概要

| ファイル | 変更内容 |
|----------|----------|
| [`scripts/talk-call-ice-config.js`](../scripts/talk-call-ice-config.js) | **新規** — `getTalkCallIceServers()`, `buildTalkCallPeerConnectionConfig()`, デバッグログ, 設定サマリー |
| [`scripts/talk-call-webrtc.js`](../scripts/talk-call-webrtc.js) | 固定 STUN 直書きを廃止し、ice-config 経由で `RTCPeerConnection` 生成 |
| [`scripts/talk-call-service.js`](../scripts/talk-call-service.js) | `connectionState === "failed"` 時に控えめなトースト |
| [`chat-detail.html`](../chat-detail.html) / [`talk-home.html`](../talk-home.html) | `talk-call-ice-config.js` を webrtc より前に読み込み |
| [`tasu-supabase-client.js`](../tasu-supabase-client.js) | `getTalkCallIceSummary()` 追加（credential なし） |
| [`chat-supabase-config.example.js`](../chat-supabase-config.example.js) | `TASU_TALK_CALL_CONFIG` コメント例 |
| [`docs/talk-call-turn-config.md`](../docs/talk-call-turn-config.md) | 設定・本番手順ドキュメント |
| [`README.md`](../README.md) | TURN 設定ドキュメントへのリンク |

### API

```javascript
TasuTalkCallIceConfig.getTalkCallIceServers();
TasuTalkCallIceConfig.buildTalkCallPeerConnectionConfig();
TasuTalkCallIceConfig.getConfigSummary(); // stun / turnEnabled / turnUrlCount — credential なし
TasuSupabase.getTalkCallIceSummary();
```

### 環境変数

| 変数 | 備考 |
|------|------|
| `TASFUL_TURN_URL` / `VITE_TASFUL_TURN_URL` | カンマ区切り複数可 |
| `TASFUL_TURN_USERNAME` / `VITE_TASFUL_TURN_USERNAME` | |
| `TASFUL_TURN_CREDENTIAL` / `VITE_TASFUL_TURN_CREDENTIAL` | ログ・localStorage に保存しない |

**ルール:**

- TURN URL なし → STUN のみ（`stun:stun.l.google.com:19302`）
- TURN URL + username + credential → STUN + 各 TURN URL
- URL のみで username/credential 不足 → TURN 無効化 + `console.warn`（credential は出力しない）

### デバッグ（開発のみ）

- `?talkCallDebug=1` または `localStorage.tasu_talk_call_debug = "1"`
- `TASU_TALK_CALL_CONFIG.debug = true`
- `icecandidate` / `iceConnectionState` / `connectionState` の簡易ログ（credential は `sanitizeDebugPayload` で除去）

### UI

- レイアウト変更なし
- 接続失敗時: 「通話接続に失敗しました。通信環境を確認してください。」（トースト）

## テスト結果

### Phase5 単体

```bash
node scripts/test-talk-call-turn-config.mjs
```

| ケース | 結果 |
|--------|------|
| TURN 未設定 → STUN のみ | PASS |
| TURN 設定 → STUN + TURN | PASS |
| 複数 TURN URL（カンマ / 配列） | PASS |
| username/credential 不足 → TURN 無効 | PASS |
| credential がログに出ない | PASS |
| VITE_ プレフィックス env | PASS |

### 回帰（Phase1〜4）

```bash
node scripts/test-talk-call-turn-config.mjs
node scripts/test-talk-webrtc-call-browser.mjs
node scripts/test-talk-call-chat-detail.mjs
node scripts/test-talk-call-notification-center.mjs
node scripts/test-talk-call-history-ui.mjs
```

| スイート | 結果 |
|----------|------|
| Phase5 `test-talk-call-turn-config.mjs` | **PASS** (21 assertions) |
| Phase1 `test-talk-webrtc-call-browser.mjs` | **PASS** |
| Phase2 `test-talk-call-chat-detail.mjs` | **PASS** |
| Phase3 `test-talk-call-notification-center.mjs` | **PASS** |
| Phase4 `test-talk-call-history-ui.mjs` | **PASS** |

## 未対応範囲（Phase5 以降）

- 外部 TURN サービス（Twilio / Cloudflare / 自前 coturn）の **契約・課金・DNS**
- Push 通知によるバックグラウンド着信
- ビデオ通話
- TURN サーバのヘルスチェック / 自動フェイルオーバー
- `.env` ファイルのリポジトリ同梱（本プロジェクトは `chat-supabase-config.js` パターン）

## 本番 TURN 導入手順（運用メモ）

1. **TURN プロバイダ選定** — coturn 自前、Twilio Network Traversal、Cloudflare Calls 等
2. **credentials 発行** — username + password（または time-limited token 方式の場合は取得 API を別途検討）
3. **デプロイ注入**
   - 静的ホスト: `chat-supabase-config.js` に `window.TASU_TALK_CALL_CONFIG`（Git に secret を commit しない）
   - Vite / CI: `VITE_TASFUL_TURN_*` をビルド時 env に設定
4. **検証**
   - モバイル LTE + 企業 Wi‑Fi 等、NAT が厳しい環境で 1:1 通話
   - `?talkCallDebug=1` で **relay** 型 ICE candidate が生成されることを確認
   - ブラウザ DevTools / `getTalkCallIceSummary()` で `turnEnabled: true`
5. **監視** — TURN 帯域・同時セッション上限をプロバイダダッシュボードで確認

## セキュリティ

- TURN credential は `console` / `localStorage` / レポートに出力しない
- `getConfigSummary()` は URL 数と有効フラグのみ
- デバッグログは `sanitizeDebugPayload` で username/credential を除去
