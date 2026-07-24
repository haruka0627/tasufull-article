# TLV Live SDK Phase2-06 — Error Policy / Input Validation

**日付:** 2026-06-28  
**flag:** `liveSessionManagerEnabled` 既定 **OFF**（本番挙動不変）

## 目的

Session Manager / Bridge の入力検証と Error 分類を本番前提で強化。不正値は **throw せず** `ERROR` event へ安全に流す。

ZEGO SDK / Provider 本接続は未実施。

## 追加ファイル

| ファイル | 役割 |
| --- | --- |
| `live/session/live-session-error-codes.js` | Error 分類定数 |
| `live/session/live-session-validation.js` | 入力検証（結果オブジェクトのみ） |
| `scripts/test-live-session-error-policy.mjs` | Phase2-06 テスト |

## Error 分類

```
VALIDATION_ERROR
PROVIDER_ERROR
CONNECTION_ERROR
SESSION_STATE_ERROR
PERMISSION_ERROR
UNKNOWN_ERROR
```

## 検証対象

- `roomId` / `userId` / `role` / `sessionId`
- `eventName` / `providerSignal`
- `error payload`（message 必須 · code 正規化）

## 統合

- **Session Manager:** `_validationFail()` · `_stateFail()` · createSession / on/off/once / handleProviderSignal / reportError
- **Bridge:** `_validateBroadcastPayload()` · broadcastId 検証 · `code` 付き error 返却
- **Debug Panel:** Error Code 行 · ERROR event payload に code 表示

## 検証

```bash
npm run test:live-session-error-policy   # Phase2-06
npm run test:live-session-manager
npm run test:live-session-provider-signals
npm run test:live-broadcasts-session-bridge
npm run test:live-session-debug-panel
npm run test:live-service-session
```

## 非接触（変更なし）

Payment / Wallet / Coin / Stripe / tips / 30min / Membership / AI / Moderation / ZEGO 本接続
