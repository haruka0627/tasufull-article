# TLV Live SDK Phase2-05 — Reconnect / Error Handling

**日付:** 2026-06-28  
**種別:** Session Manager · Provider 抽象 signal · テスト（**ZEGO / Provider 本接続なし**）

---

## 1. サマリー

| 項目 | 状態 |
| --- | --- |
| Provider 抽象 signal 定義 | **Done** |
| Session Manager reconnect / error 遷移 | **Done** |
| Bridge 転送 API | **Done** |
| Debug Panel 拡張 | **Done** |
| feature flag OFF 既定 | **維持** |
| ZEGO SDK / Provider 本接続 | **なし** |

---

## 2. Provider 抽象 signal 一覧

| Signal | 用途 |
| --- | --- |
| `PROVIDER_CONNECTING` | 接続開始（状態維持 · 将来） |
| `PROVIDER_CONNECTED` | STARTING→LIVE / JOINING→CONNECTED |
| `PROVIDER_DISCONNECTED` | RECONNECTING へ |
| `PROVIDER_RECONNECTING` | RECONNECTING へ |
| `PROVIDER_RECONNECTED` | RECONNECTED → 復帰 |
| `PROVIDER_CONNECTION_LOST` | RECONNECTING へ |
| `PROVIDER_ERROR` | ERROR（recoverable 分岐） |

**正本:** `live/session/live-provider-signals.js`

---

## 3. Session Manager 追加 API

| API | 説明 |
| --- | --- |
| `handleProviderSignal(signal, payload)` | Provider 抽象 signal 受信 |
| `reportError({ message, code, recoverable })` | ERROR 遷移 |
| `recoverFromError()` | recoverable ERROR → reconnect |
| `getStatus()` | reconnectAttempt · lastError · lastProviderSignal |

---

## 4. 状態遷移（Reconnect / Error）

```text
LIVE / CONNECTED
  → PROVIDER_CONNECTION_LOST | DISCONNECTED | RECONNECTING signal
  → RECONNECTING (RECONNECTING event)
  → PROVIDER_RECONNECTED | reconnect() | recoverFromError()
  → RECONNECTED → LIVE / CONNECTED

LIVE / CONNECTED
  → PROVIDER_ERROR | reportError()
  → ERROR (recoverable?)
  → recoverFromError() → RECONNECTING → RECONNECTED → 復帰
  → reset() → READY
```

---

## 5. Bridge 追加 API

| API | flag OFF |
| --- | --- |
| `handleProviderSignal(signal, payload)` | skipped |
| `reportSessionError(options)` | skipped |
| `recoverSessionFromError()` | skipped |
| `getSnapshot().status` | null / 空 |

---

## 6. テスト結果

| コマンド | 結果 |
| --- | --- |
| `npm run test:live-session-manager` | **34/34 PASS** |
| `npm run test:live-session-provider-signals` | **14/14 PASS** |
| `npm run test:live-broadcasts-session-bridge` | **16/16 PASS** |
| `npm run test:live-session-debug-panel` | **14/14 PASS** |

---

## 7. 既存 Live 影響

| 項目 | 影響 |
| --- | --- |
| `liveSessionManagerEnabled: false` | **DOM / 挙動変更なし** |
| Payment / Wallet / 30分 / 投げ銭 | **未接触** |
| ZEGO SDK | **未呼出** |

---

## 8. 次フェーズ

**Phase2-06 / 07:** UIKit 評価 · Phase 1.5 E2E GO 後 Provider 本接続

**正本:** [docs/TLV_LIVE_PROVIDER.md §24](../docs/TLV_LIVE_PROVIDER.md)
