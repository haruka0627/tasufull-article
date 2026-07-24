# Live Platform Monitoring Core — Phase F 完了レポート

**日付:** 2026-06-28  
**Priority:** P2 Live Platform 共通基盤  
**TLV:** Pause 維持 · UI / live-broadcasts.js / live-comments.js 非接続  
**正本:** [foundation plan](./live-platform-common-foundation-plan.md) · [Phase E](./platform-live-recording-phase-e.md)

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| **Phase F 実装** | **Complete** |
| **Phase F テスト** | **40/40 PASS** |
| **Phase A〜E regression** | **238/238 PASS** |
| **live/session テスト** | **98/98 PASS** |
| **Go / No-Go** | **Go** |
| **Live Platform Core 全体** | **Complete（Phase A〜F）** |

---

## 1. 変更ファイル一覧

### 新規

| パス | 内容 |
| --- | --- |
| `platform-live/monitoring/live-monitoring-states.js` | Health 状態定数 |
| `platform-live/monitoring/live-monitoring-events.js` | Event 定数 |
| `platform-live/monitoring/live-monitoring-error-codes.js` | Error codes |
| `platform-live/monitoring/live-monitoring-validation.js` | surface 検証 |
| `platform-live/monitoring/live-monitoring-metrics-store.js` | in-memory metrics 正本 |
| `platform-live/monitoring/live-monitoring-smoke-runner.js` | Phase A〜E 横断 smoke |
| `platform-live/monitoring/live-monitoring-service.js` | `TasuLivePlatformMonitoringService` |
| `platform-live/monitoring/live-monitoring-edge-client.js` | Edge クライアント |
| `supabase/functions/live-platform-monitoring/index.ts` | Edge stub |
| `scripts/test-platform-live-monitoring-phase-f.mjs` | Phase F テスト |
| `reports/platform-live-monitoring-phase-f.md` | 本レポート |
| `reports/platform-live-platform-summary.md` | Core 全体サマリー |

### 更新

| パス | 内容 |
| --- | --- |
| `platform-live/provider/live-provider-interface.js` | `getMonitoringProbe` |
| `platform-live/provider/stub-live-provider.js` | monitoring probe stub |
| `platform-live/README.md` | Phase F 追記 |
| `package.json` | `test:platform-live-monitoring-phase-f` |
| `docs/PROJECT_STATUS.md` | Phase F Complete |
| `docs/TODO.md` | Live Platform Core 完了 |

---

## 2. 実装内容

`TasuLivePlatformMonitoringService` が Phase A〜E を横断監視:

| API | 説明 |
| --- | --- |
| `wire(services)` | Session / Broadcast / Viewer / Chat / Recording / Provider 配線 |
| `getHealth({ surface })` | healthy / degraded / failed / unknown 判定 |
| `getMetrics({ surface })` | metrics snapshot |
| `getServiceStatus({ surface })` | 各サービス状態 |
| `getProviderStatus({ surface })` | provider probe |
| `recordError({ surface, code, message })` | errors 集計 |
| `runSmoke({ surface, failAtStep? })` | smoke runner 実行 |

**surface 必須:** `platform | tlv | talk | builder` — MVP テストは `platform` のみ。

---

## 3. Health State 設計

| 状態 | 条件 |
| --- | --- |
| `healthy` | 全サービス正常 · provider OK |
| `degraded` | provider degraded · session RECONNECTING · エラー多発 |
| `failed` | session ERROR · broadcast/recording FAILED · provider disposed |
| `unknown` | サービス未配線 |

---

## 4. Metrics 設計

in-memory · surface 別:

`activeSessions`, `liveBroadcasts`, `activeViewers`, `ccu`, `messagesSent`, `messagesBlocked`, `reactions`, `activeRecordings`, `completedRecordings`, `providerStatus`, `lastHeartbeatAt`, `errors`

Chat イベント（MESSAGE_SENT / BLOCKED / REACTION_ADDED）でカウンタ更新。

---

## 5. Smoke Runner 設計

`TasuLivePlatformMonitoringSmokeRunner` — 順次検証:

1. session_create  
2. broadcast_create  
3. broadcast_start  
4. viewer_join  
5. viewer_heartbeat  
6. chat_send  
7. recording_start  
8. recording_stop  
9. cleanup  

`failAtStep` で失敗パス注入可能。

---

## 6. Edge `live-platform-monitoring`

POST `{ action, surface }` — `health` | `metrics` | `status` | `provider` | `smoke`

in-memory Map · DB/TLV 非接続 · Edge client は `localService` fallback 対応。

---

## 7. テスト結果

| スイート | 結果 |
| --- | --- |
| Phase F | **40/40 PASS** |
| Phase A〜E | **238/238 PASS** |
| live/session（4 スイート） | **98/98 PASS** |

```bash
npm run test:platform-live-monitoring-phase-f
```

---

## 8. 既存 live 系への影響

**なし。** `live/session/*` · `live-broadcasts.js` · `live-comments.js` · `watch-video.html` 未変更。

---

## 9. TLV 未接続の確認

monitoring モジュールに TLV / watch-video / live-broadcasts / live-comments 参照なし。テストでファイル unchanged を検証。

---

## 10. Phase F Go / No-Go

**Go**

---

## 11. Live Platform Core 全体の完了判定

**Complete** — Phase A（Session）〜 Phase F（Monitoring）すべて実装・テスト PASS。次ステップは TLV/Talk/Builder surface 接続（Post-MVP）および Edge 本番 deploy（別 track）。
