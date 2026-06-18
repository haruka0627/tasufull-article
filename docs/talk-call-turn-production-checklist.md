# TALK 音声通話 — 本番 TURN 投入チェックリスト

本番 credential 投入前・投入後に使用してください。**実 credential をこのファイルに記載しないこと。**

関連: [`talk-call-turn-config.md`](talk-call-turn-config.md)

---

## A. 投入前（設定・セキュリティ）

| # | 項目 | 確認方法 | ☐ |
|---|------|----------|---|
| A1 | TURN URL 設定済み | `getTalkCallIceSummary().turnConfigured === true` | ☐ |
| A2 | username 設定済み | `getIceConfig()`（dev）で `hasUsername: true`、または投入記録 | ☐ |
| A3 | credential 設定済み | `getIceConfig()`（dev）で `hasCredential: true`、または投入記録 | ☐ |
| A4 | URL + username + credential が揃い `turnEnabled: true` | `getTalkCallIceSummary()` | ☐ |
| A5 | credential を Git / レポート / チャットに書いていない | 目視 | ☐ |
| A6 | `allowDebug: false`（本番） | `TASU_TALK_CALL_CONFIG.allowDebug` | ☐ |
| A7 | 本番 URL に `talkCallDebug=1` を付けない | デプロイ設定 | ☐ |
| A8 | `localStorage.tasu_talk_call_debug` が本番で残っていない | Application タブ | ☐ |
| A9 | `_test` / `getIceConfig` が本番ブラウザで undefined | DevTools（talkDev なし） | ☐ |

## B. 投入後（接続診断）

| # | 項目 | 確認方法 | ☐ |
|---|------|----------|---|
| B1 | debug off で verbose log が出ない | Console 目視 | ☐ |
| B2 | **relay candidate 確認**（ステージング） | `?talkCallDebug=1` → `getTalkCallConnectionSummary().hasRelay === true` | ☐ |
| B3 | srflx candidate が生成される | `hasSrflx: true`（任意） | ☐ |
| B4 | host candidate が生成される | `hasHost: true`（任意） | ☐ |
| B5 | `iceConnectionState` が `connected` / `completed` | debug summary または通話成功 | ☐ |
| B6 | credential 漏洩なし | Console / Network / storage に credential 文字列なし | ☐ |

## C. 実機・回帰

| # | 項目 | 確認方法 | ☐ |
|---|------|----------|---|
| C1 | モバイル実機 1:1 通話 | iOS / Android ブラウザ | ☐ |
| C2 | 厳格 NAT（企業 Wi‑Fi / LTE） | 双方異なるネットワーク | ☐ |
| C3 | TURN 未設定環境でも STUN 通話が壊れていない | ステージング env クリア時 | ☐ |
| C4 | Phase1 `test-talk-webrtc-call-browser.mjs` | PASS | ☐ |
| C5 | Phase2 `test-talk-call-chat-detail.mjs` | PASS | ☐ |
| C6 | Phase3 `test-talk-call-notification-center.mjs` | PASS | ☐ |
| C7 | Phase4 `test-talk-call-history-ui.mjs` | PASS | ☐ |
| C8 | Phase5 `test-talk-call-turn-config.mjs` | PASS | ☐ |
| C9 | Phase5.6 `test-talk-call-relay-candidate.mjs` | PASS または SKIP（TURN 未設定） | ☐ |
| C10 | Phase6/7 `test-talk-call-push-notification-design.mjs` | PASS | ☐ |
| C11 | Phase7 `test-talk-call-service-worker.mjs` | PASS | ☐ |
| C12 | Phase7.1 `test-talk-call-push-delivery.mjs` | PASS | ☐ |

## E. Web Push（Phase7.1）

| # | 項目 | 確認方法 | ☐ |
|---|------|----------|---|
| E1 | VAPID secrets 3 件設定（Dashboard / CLI） | `WEB_PUSH_VAPID_*` | ☐ |
| E2 | 秘密鍵が Git / ログ / DB にない | 目視 + テスト | ☐ |
| E3 | Edge `talk-call-push-notify` デプロイ済み | invoke 200 | ☐ |
| E4 | クライアントは公開鍵のみ | `webPushVapidPublicKey` | ☐ |
| E5 | ringing → push event → sent（実機） | 通知着信 | ☐ |
| E6 | 410/404 → subscription inactive | DB `status=inactive` | ☐ |
| E7 | deploy 手順 | [`talk-call-web-push-deploy.md`](talk-call-web-push-deploy.md) | ☐ |

## D. 運用メモ

| # | 項目 | ☐ |
|---|------|---|
| D1 | TURN プロバイダの帯域・同時セッション上限を確認 | ☐ |
| D2 | credential ローテーション手順を決めた | ☐ |
| D3 | 障害時 STUN-only フォールバック（TURN 障害）の影響を理解した | ☐ |

---

## クイック DevTools コマンド（credential は返りません）

```javascript
TasuSupabase.getTalkCallIceSummary();
// → { stun, turnConfigured, turnEnabled, turnUrlCount, debug, allowDebug }

// ステージング + talkCallDebug=1 のみ
TasuSupabase.getTalkCallConnectionSummary();
// → { candidateCounts, hasRelay, hasSrflx, hasHost, connectionState, ... }
```

## 判定

- **投入 GO:** A 全項目 + B6 + C1〜C8
- **要再確認:** B2 relay 未検出（TURN 設定ミスの可能性）
- **投入 STOP:** B6 credential 漏洩、または `_test` が本番で露出
