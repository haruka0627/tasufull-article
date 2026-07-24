# Live Platform Broadcast — Phase B 完了レポート

**日付:** 2026-06-28  
**Priority:** P2 Live Platform 共通基盤  
**TLV:** Pause 維持 · HTML/Wallet/Tip/30分/live-broadcasts.js 非接続  
**正本:** [live-platform-common-foundation-plan.md](./live-platform-common-foundation-plan.md) · [Phase A report](./platform-live-core-phase-a.md)

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| **Phase B 実装** | **Complete** |
| **Phase B テスト** | **50/50 PASS** |
| **Phase A regression** | **53/53 PASS** |
| **既存 Phase2 テスト** | **77/77 PASS**（manager + service + bridge 実行分） |
| **live-broadcasts.js** | **未変更 · 未接続** |
| **Go / No-Go** | **Go**（Phase B スコープ） |
| **Phase C 開始** | **可**（Viewer モジュール） |

---

## 1. 変更ファイル一覧

### 新規

| パス | 内容 |
| --- | --- |
| `platform-live/broadcast/live-broadcast-states.js` | 状態定数 |
| `platform-live/broadcast/live-broadcast-events.js` | Event 定数 |
| `platform-live/broadcast/live-broadcast-provider-signals.js` | Provider signal |
| `platform-live/broadcast/live-broadcast-error-codes.js` | Error codes |
| `platform-live/broadcast/live-broadcast-validation.js` | 入力検証 |
| `platform-live/broadcast/live-broadcast-service.js` | `TasuLivePlatformBroadcastService` |
| `platform-live/broadcast/live-broadcast-edge-client.js` | Edge クライアント · local fallback |
| `supabase/functions/live-platform-broadcast/index.ts` | Edge stub（in-memory） |
| `scripts/test-platform-live-broadcast-phase-b.mjs` | Phase B 単体テスト |
| `reports/platform-live-broadcast-phase-b.md` | 本レポート |

### 更新

| パス | 内容 |
| --- | --- |
| `platform-live/provider/live-provider-interface.js` | broadcast メソッド + `onBroadcastSignal` |
| `platform-live/provider/stub-live-provider.js` | start/stop/health/viewerCount broadcast |
| `platform-live/README.md` | Phase B 追記 |
| `package.json` | `test:platform-live-broadcast-phase-b` |
| `docs/PROJECT_STATUS.md` | P2 Phase B Complete |
| `docs/TODO.md` | Phase B 完了 |

### 未変更（意図的）

| パス | 理由 |
| --- | --- |
| `live/live-broadcasts.js` | 本接続禁止 |
| `live/live-broadcasts-session-bridge.js` | flag OFF 維持 |
| `live/session/*` | 破壊的変更禁止 |
| `live/*.html` | TLV FROZEN |

---

## 2. 実装内容

### TasuLivePlatformBroadcastService

| API | 責務 |
| --- | --- |
| `createBroadcast({ surface, title, roomId, broadcastId, hostUserId })` | draft 作成 |
| `startBroadcast({ surface, userId })` | draft → starting → live |
| `stopBroadcast({ surface, reason })` | live → stopping → ended |
| `getBroadcastState({ surface })` | 現在状態 |
| `getBroadcastHealth({ surface })` | provider + session 合成 health |
| `updateViewerCount({ surface, count })` | CCU 更新（live 中のみ） |
| `resetBroadcast({ surface })` | ended/failed → draft |
| `handleProviderSignal(signal, payload)` | Provider 抽象入力 |

**Session 連携（optional）:** `sessionManager` 注入時、start → `createSession` + `start`、stop → `end`

---

## 3. Broadcast state 設計

```text
draft → starting → live → stopping → ended
              ↘ failed ↗
ended | failed → draft (reset)
```

| 状態 | 説明 |
| --- | --- |
| `draft` | 作成済 · 未配信 |
| `starting` | 配信開始処理中 |
| `live` | 配信中 |
| `stopping` | 配信停止処理中 |
| `ended` | 正常終了 |
| `failed` | 異常終了 |

不正遷移は `BROADCAST_STATE_ERROR` で拒否（throw なし）。

---

## 4. Provider stub 設計

| メソッド | stub 動作 |
| --- | --- |
| `startBroadcast` | STARTING + STARTED signal emit |
| `stopBroadcast` | STOPPING + STOPPED signal emit |
| `getBroadcastHealth` | `{ ok: true, stub: true }` |
| `updateViewerCount` | VIEWER_COUNT signal emit |
| ZEGO fallback | Phase A 同様 · broadcast メソッドも stub で代替 |

broadcast signal は lazy lookup（load order 非依存）。

---

## 5. Edge（live-platform-broadcast）

**種別:** stub · in-memory · DB/TLV 非接続

| action | 内容 |
| --- | --- |
| `create` | broadcast draft 作成 |
| `start` | draft → live |
| `stop` | live → ended |
| `health` | stub health 返却 |
| `viewer_count` | CCU 更新 |
| `state` | 現在状態 |

**制約:**

- Module-level `Map`（cold start でリセット）
- `surface` 必須
- デプロイは任意（クライアントは `TasuLivePlatformBroadcastEdgeClient` + local fallback でテスト可能）

---

## 6. テスト結果

```text
npm run test:platform-live-broadcast-phase-b  → 50 PASS / 0 FAIL
npm run test:platform-live-core-phase-a       → 53 PASS / 0 FAIL
npm run test:live-session-manager             → 36 PASS
npm run test:live-service-session             → 25 PASS
npm run test:live-broadcasts-session-bridge   → 16 PASS
```

**8788 regression:** HTML 未変更 · 影響なし

---

## 7. 既存 live-broadcasts.js への影響

| 項目 | 影響 |
| --- | --- |
| ファイル変更 | **なし** |
| import / 配線 | **なし** |
| Session bridge | flag OFF · 既存テスト PASS |
| DB CRUD | 既存 `live_broadcasts` 直結は維持（共通基盤は別 track） |

---

## 8. TLV 未接続の確認

- [x] TLV HTML 未変更
- [x] Wallet / Tip / 30分 未参照
- [x] `live-broadcasts.js` 未変更 · `TasuLivePlatformBroadcastService` 未 import
- [x] `live-broadcasts-session-bridge.js` 未変更
- [x] Edge DB 未接続

---

## 9. Phase B Go / No-Go

| ゲート | 状態 |
| --- | --- |
| platform-live/broadcast 作成 | **Go** |
| state 機械 + 不正遷移拒否 | **Go** |
| surface 必須 | **Go** |
| stub provider broadcast | **Go** |
| Phase B テスト PASS | **Go** |
| Phase A regression PASS | **Go** |
| live-broadcasts 本接続 | **Out of scope**（意図的禁止） |
| Edge 本番デプロイ | **Optional**（stub 実装済 · deploy 待ち） |

**判定: Phase B = Go**

---

## 10. Phase C 開始可否

**可** — 前提充足:

- Broadcast Core 正本が `platform-live/broadcast` に存在
- Session（Phase A）と optional 連携済
- stub で start/stop/health/viewer count 検証可能

**Phase C スコープ（予定）:**

- `platform-live/viewer/` — join/leave · permission · heartbeat · watch state
- Edge `live-platform-viewer`
- CCU 正本化（Broadcast の viewer count と統合）

---

## 次アクション

1. Phase C Viewer モジュール着手
2. Edge `live-platform-broadcast` デプロイ（任意 · staging）
3. `live_p0_schema` 適用後 DB 正本化（Post-MVP）
