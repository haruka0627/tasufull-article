# Live Platform Recording Core — Phase E 完了レポート

**日付:** 2026-06-28  
**Priority:** P2 Live Platform 共通基盤  
**TLV:** Pause 維持 · VOD / watch-video / live-video-upload 非接続  
**正本:** [foundation plan](./live-platform-common-foundation-plan.md) · [Phase D](./platform-live-chat-phase-d.md)

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| **Phase E 実装** | **Complete** |
| **Phase E テスト** | **55/55 PASS** |
| **Phase A/B/C/D regression** | **183/183 PASS** |
| **live/session テスト** | **既存スイート PASS** |
| **watch-video / VOD** | **未変更 · 未接続** |
| **Go / No-Go** | **Go** |
| **Phase F 開始** | **可**（Monitoring モジュール） |

---

## 1. 変更ファイル一覧

### 新規

| パス | 内容 |
| --- | --- |
| `platform-live/recording/live-recording-states.js` | Recording 状態定数 |
| `platform-live/recording/live-recording-events.js` | Event 定数 |
| `platform-live/recording/live-recording-error-codes.js` | Error codes |
| `platform-live/recording/live-recording-validation.js` | surface / id 検証 |
| `platform-live/recording/live-recording-service.js` | `TasuLivePlatformRecordingService` |
| `platform-live/recording/live-recording-edge-client.js` | Edge クライアント |
| `supabase/functions/live-platform-recording/index.ts` | Edge stub（in-memory） |
| `scripts/test-platform-live-recording-phase-e.mjs` | Phase E テスト |
| `reports/platform-live-recording-phase-e.md` | 本レポート |

### 更新

| パス | 内容 |
| --- | --- |
| `platform-live/provider/live-provider-interface.js` | recording メソッド定義 |
| `platform-live/provider/stub-live-provider.js` | recording stub 実装 |
| `platform-live/README.md` | Phase E 追記 |
| `package.json` | `test:platform-live-recording-phase-e` |
| `docs/PROJECT_STATUS.md` | Phase E Complete |
| `docs/TODO.md` | Phase E 完了 |

---

## 2. 実装内容

`TasuLivePlatformRecordingService` が以下を提供:

- `startRecording({ surface, broadcastId, sessionId?, recordingId? })` — broadcast が `live` のときのみ開始
- `stopRecording({ surface, recordingId? })`
- `getRecordingStatus` / `getRecordingMetadata`
- `createArchiveMetadata({ surface, recordingId?, ttlSec? })`
- `markExpired` / `resetRecording` / `dispose`

**依存:** Phase A Session · Phase B Broadcast（live 判定）· Provider stub。Phase C/D は regression のみ。

**非接続:** TLV HTML · `live-comments.js` · `watch-video.html` · `live-broadcasts.js` · `live-video-upload.js` · VOD Edge · Wallet / Tip / 30分制度。

---

## 3. Recording State 設計

| 状態 | 説明 |
| --- | --- |
| `idle` | 未録画 |
| `starting` | 開始処理中 |
| `recording` | 録画中 |
| `stopping` | 停止処理中 |
| `completed` | 正常完了 |
| `failed` | 失敗 |
| `expired` | アーカイブ期限切れ |

**許可遷移:**

```
idle → starting → recording → stopping → completed → expired → idle
              ↘ failed → idle
recording → failed
completed → idle (reset)
```

不正遷移は `RECORDING_STATE_ERROR` を返却。

---

## 4. Metadata 設計

in-memory MVP。各 recording に以下を保持:

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `recordingId` | string | 録画 ID |
| `broadcastId` | string | 配信 ID |
| `sessionId` | string \| null | セッション ID |
| `surface` | string | platform / tlv / talk / builder |
| `provider` | string | stub / providerId |
| `startedAt` | ISO string \| null | 開始時刻 |
| `stoppedAt` | ISO string \| null | 停止時刻 |
| `durationSec` | number \| null | 秒 |
| `storageKey` | string \| null | ストレージキー |
| `playbackUrl` | string \| null | 再生 URL |
| `status` | string | 状態 |
| `errorCode` | string \| null | エラーコード |

Archive metadata: `archiveId`, `recordingId`, `broadcastId`, `surface`, `storageKey`, `playbackUrl`, `durationSec`, `createdAt`, `expiresAt`。

---

## 5. Provider Stub 設計

`StubLiveProvider` に追加:

- `startRecording` → `storageKey: stub-rec://...`
- `stopRecording` → `playbackUrl: stub-playback://...`, `durationSec`
- `getRecordingStatus` → `recording` / `idle`
- `getArchiveMetadata` → `archiveId`, `storageKey`

`createPlatformLiveProvider("zego", { allowStubFallback: true })` は ZEGO credentials なしで stub にフォールバック。実 Provider は interface 定義のみ · future compatible。

---

## 6. Edge `live-platform-recording`

**パス:** `supabase/functions/live-platform-recording/index.ts`

- POST `{ action, surface, broadcastId, ... }`
- Actions: `start` | `stop` | `status` | `archive` | `set_live`（テスト用）
- in-memory `Map` · DB 非接続 · TLV 非接続
- `TasuLivePlatformRecordingEdgeClient` は `localService` fallback 対応

---

## 7. テスト結果

| スイート | 結果 |
| --- | --- |
| `npm run test:platform-live-recording-phase-e` | **55/55 PASS** |
| `npm run test:platform-live-core-phase-a` | **53/53 PASS** |
| `npm run test:platform-live-broadcast-phase-b` | **50/50 PASS** |
| `npm run test:platform-live-viewer-phase-c` | **41/41 PASS** |
| `npm run test:platform-live-chat-phase-d` | **39/39 PASS** |
| `test:live-session-*`（4 スイート） | **PASS** |

**8788 regression:** platform-live モジュールは TLV HTML 未変更のため UI 影響なし。

---

## 8. 既存 VOD / watch-video への影響

**なし。** `live/watch-video.html` · `live/live-video-upload.js` · VOD Edge 関数は未変更・未 import。

---

## 9. TLV 未接続の確認

- `platform-live/recording/*` に TLV / watch-video / live-comments 参照なし
- `live/live-comments.js` · `live/watch-video.html` · `live/live-broadcasts.js` · `live/live-video-upload.js` ファイル内容 unchanged（テストで検証）
- `live/session/*` 破壊的変更なし

---

## 10. Phase E Go / No-Go

**Go** — 要件充足 · 55 テスト PASS · regression PASS · TLV Pause 維持。

---

## 11. Phase F 開始可否

**可。** 次フェーズ: `platform-live/monitoring/`（Monitoring Core · health / metrics hooks · stub provider · Edge optional）。
