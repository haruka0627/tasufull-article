# Live Platform Core — Phase A 完了レポート

**日付:** 2026-06-28  
**Priority:** P2 Live Platform 共通基盤  
**TLV:** Pause 維持 · HTML/Wallet/Tip/30分 非接続  
**正本:** [live-platform-common-foundation-plan.md](./live-platform-common-foundation-plan.md)

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| **Phase A 実装** | **Complete** |
| **Phase A テスト** | **53/53 PASS** |
| **既存 Phase2-01〜06 テスト** | **139/139 PASS**（6 スイート） |
| **TLV 副作用** | **なし**（`live/session/*` 未変更） |
| **8788 regression** | **影響なし**（HTML 非変更 · 新規 JS のみ） |
| **Go / No-Go** | **Go**（Phase A スコープ） |
| **Phase B 開始** | **可**（Broadcast モジュール） |

---

## 1. 変更ファイル一覧

### 新規

| パス | 内容 |
| --- | --- |
| `platform-live/README.md` | パッケージ概要 |
| `platform-live/core/live-surfaces.js` | surface 定数 |
| `platform-live/core/live-session-states.js` | 状態定数 |
| `platform-live/core/live-session-events.js` | Event 定数（+ PRESENCE_UPDATED） |
| `platform-live/core/live-session-event-bus.js` | EventBus |
| `platform-live/core/live-session-error-codes.js` | Error codes（+ SURFACE_ERROR） |
| `platform-live/core/live-provider-signals.js` | Provider signal 定数 |
| `platform-live/core/live-session-validation.js` | 入力検証（+ validateSurface） |
| `platform-live/core/live-session-manager.js` | `TasuLivePlatformSessionManager` |
| `platform-live/core/live-platform-service.js` | `TasuLivePlatformService` |
| `platform-live/provider/live-provider-types.js` | Provider 型 · STUB id |
| `platform-live/provider/live-provider-interface.js` | 抽象 Interface |
| `platform-live/provider/stub-live-provider.js` | Stub Provider |
| `platform-live/provider/create-platform-live-provider.js` | Factory + stub fallback |
| `scripts/test-platform-live-core-phase-a.mjs` | Phase A 単体テスト |
| `reports/platform-live-core-phase-a.md` | 本レポート |

### 更新

| パス | 内容 |
| --- | --- |
| `package.json` | `test:platform-live-core-phase-a` 追加 |
| `docs/PROJECT_STATUS.md` | P2 Phase A Complete |
| `docs/TODO.md` | P2 実装 Phase A 完了 |

### 未変更（意図的）

| パス | 理由 |
| --- | --- |
| `live/session/*` | 参照元 · 破壊的移動禁止 |
| `live/*.html` | TLV Pause · FROZEN |
| `live/live-service.js` | TLV 配線 · 後 phase で wrapper 検討 |

---

## 2. 実装内容

### Session Lifecycle

`TasuLivePlatformSessionManager` が以下を提供:

- `createSession({ surface, roomId, role, ... })`
- `start({ surface })` — host
- `join({ surface })` — viewer
- `leave({ surface })`
- `end({ surface })` — host only
- `reconnect({ surface })`
- `updatePresence({ surface, status, userId })` — heartbeat
- `handleProviderSignal(signal, payload)` — Provider 抽象入力
- `destroySession` / `reset` / `dispose`

### Provider 配線

`TasuLivePlatformService` が Manager + Provider を接続:

- デフォルト `stub` provider
- `createPlatformLiveProvider('zego', { allowStubFallback: true })` → ZEGO 未ロード時 stub 自動

### TLV 非接続

- Wallet / Tip / 30分制度 / TLV HTML への import なし
- `surface=tlv` は検証のみ（予約 · アダプター未実装）

---

## 3. surface 設計

```text
surface: platform | tlv | talk | builder
```

| surface | Phase A | 備考 |
| --- | --- | --- |
| `platform` | **テスト対象 · MVP** | lifecycle 全 API で必須 |
| `tlv` | 予約（検証 OK · 接続なし） | Complete 後アダプター |
| `talk` | 予約 | MVP+ |
| `builder` | 予約 | Future |

**ルール:**

- 全 public API に `surface` 必須
- session 作成後、リクエスト surface が session surface と不一致 → `SURFACE_ERROR`
- Event payload に `surface` を付与

---

## 4. provider stub 設計

| 項目 | 内容 |
| --- | --- |
| **ID** | `stub` |
| **ZEGO 依存** | なし |
| **signal** | CONNECTING → CONNECTED / DISCONNECTED / RECONNECTING / RECONNECTED |
| **fallback** | `createPlatformLiveProvider('zego')` → `TlvZegoLiveProvider` 未ロード時 stub |
| **将来** | ZEGO adapter は `live/providers/zego-live-provider.js` を optional import |

---

## 5. テスト結果

```text
npm run test:platform-live-core-phase-a     → 53 PASS / 0 FAIL
npm run test:live-session-manager           → 36 PASS
npm run test:live-service-session           → 25 PASS
npm run test:live-broadcasts-session-bridge → 16 PASS
npm run test:live-session-debug-panel       → 14 PASS
npm run test:live-session-provider-signals  → 14 PASS
npm run test:live-session-error-policy      → 34 PASS
```

**Phase A カバレッジ:**

- create session · join · leave · reconnect
- presence heartbeat
- invalid surface · surface mismatch
- provider stub · zego stub fallback
- no TLV side effect
- LivePlatformService 統合

---

## 6. 既存 live/session への影響

| 項目 | 影響 |
| --- | --- |
| ファイル変更 | **なし** |
| 既存テスト | **全 PASS** |
| 命名 | TLV 側 `TlvLive*` 維持 · 共通側 `TasuLivePlatform*` |
| 移行 | Phase B 以降で compatibility wrapper 検討（破壊的移動なし） |

---

## 7. TLV 未接続の確認

- [x] TLV HTML 未変更
- [x] TLV Wallet 未接続
- [x] TLV tip 未接続
- [x] TLV 30分制度未接続
- [x] `live/session/*` 未変更
- [x] runtime に `TlvLiveSessionManager` / `TlvLiveService` 未ロード（platform-live テスト）

---

## 8. Phase A Go / No-Go

| ゲート | 状態 |
| --- | --- |
| platform-live/core 作成 | **Go** |
| surface 必須 API | **Go** |
| stub provider PASS | **Go** |
| Phase A テスト PASS | **Go** |
| 既存 Phase2 テスト PASS | **Go** |
| Edge `live-platform-session` | **Out of scope**（Phase A3 · 次フェーズ） |
| 8788 E2E UI | **N/A**（HTML 非変更） |

**判定: Phase A = Go**

---

## 9. Phase B 開始可否

**可** — 前提充足:

- Session Core 正本が `platform-live/core` に存在
- stub で lifecycle 検証可能
- TLV 非依存 track で Broadcast モジュール着手可

**Phase B スコープ（予定）:**

- `platform-live/broadcast/live-broadcast-service.js`
- Edge `live-platform-broadcast`（start/stop/health）
- `live-broadcasts.js` は **未接続**（flag OFF 維持）

---

## 次アクション

1. Phase B 設計確認 · Broadcast service 着手
2. Phase A3 — `live-platform-session` Edge（server 正本）
3. 8788 demo ページ（任意 · platform surface のみ）
