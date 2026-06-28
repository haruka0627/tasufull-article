# Platform Live ZEGO Integration — Phase 4 P4-1 Report

**Date:** 2026-06-29  
**Base commit:** `234a7c3` (Phase 3)  
**Scope:** Edge broadcast sync foundation · Integration 未接続 · 本番 deploy なし

---

## 目的

Edge broadcast sync の最小基盤を追加。Chat / Recording / Monitoring / Retry / Integration 配線は **P4-2 以降**。

---

## 実装内容

### 1. `platform-live/core/live-platform-edge-sync.js`

| API | 挙動 |
| --- | --- |
| `setLive(ctx)` | broadcast edge create/start + viewer/chat/recording `set_live` fan-out + monitoring `patch` |
| `clearLive(ctx)` | broadcast stop + fan-out false + monitoring patch |
| `patchLive(ctx)` | monitoring-only partial update |
| `useEdgeSync: false` | **no-op** · diagnostics `skipped` |
| 失敗時 | **throw しない** · `{ ok: true, partial: true, failures[] }` |
| Idempotency | 同一 `surface:broadcastId` で `setLive` 再送 → `alreadyLive` |

Context から token / secret 系キーは diagnostics へ記録しない。

### 2. Edge client 最小拡張

| Client | 追加メソッド |
| --- | --- |
| Broadcast | `setLive` → `start` alias · `clearLive` → `stop` |
| Viewer / Chat / Recording | `setLive` · `clearLive` → `action: set_live` |
| Monitoring | `patchLive` → `action: patch` |

`baseUrl` / local service 未設定時は **structured noop**（既存 API 非破壊）。

### 3. Diagnostics

`TasuLivePlatformDiagnostics.recordEdgeSync(phase, payload)`  
phases: `attempted` · `skipped` · `succeeded` · `failed`  
snapshot に `edgeSyncEvents` 追加。

---

## 変更ファイル

| 種別 | ファイル |
| --- | --- |
| **A** | `platform-live/core/live-platform-edge-sync.js` |
| **A** | `scripts/test-platform-live-zego-integration-phase4-p4-1.mjs` |
| **A** | `reports/live-platform-zego-phase4-p4-1-edge-sync.md` |
| **M** | `platform-live/core/live-platform-diagnostics.js` |
| **M** | `platform-live/broadcast/live-broadcast-edge-client.js` |
| **M** | `platform-live/viewer/live-viewer-edge-client.js` |
| **M** | `platform-live/chat/live-chat-edge-client.js` |
| **M** | `platform-live/recording/live-recording-edge-client.js` |
| **M** | `platform-live/monitoring/live-monitoring-edge-client.js` |
| **M** | `package.json` |

### 非変更

- `live-platform-integration.js`（P4-2）
- TLV PoC · Platform Interface · ZEGO Adapter RTC

---

## テスト結果

| チェック | 結果 |
| --- | --- |
| `test:platform-live-zego-integration-phase4-p4-1` | **PASS** (34) |
| Phase 3 regression | **PASS** |
| Phase 1 + A–F regression | **PASS** |
| `build:pages` | **PASS** |
| E2E integration | **PASS** (32) |
| Browser Play Check | **GO** |
| TLV PoC / Interface SHA | **unchanged** |

---

## 判定

| 項目 | 結果 |
| --- | --- |
| **P4-1 Edge sync foundation** | **COMPLETE** |
| **P4-2 Integration wiring** | **GO**（`useEdgeSync` デフォルト false 維持） |
