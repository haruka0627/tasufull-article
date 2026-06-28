# Platform Live ZEGO Integration — Phase 4 P4-6 Report

**Date:** 2026-06-29  
**Base commit:** `1e7baec` (P4-5)  
**Branch:** `cf-pages-deploy`  
**Scope:** Integration `executeWithRetry` · publish / joinLive / joinAsViewer · 本番 deploy なし · **未コミット**

---

## 目的

Integration 層に `executeWithRetry` を導入し、`startPublish` / `joinLive` / `joinAsViewer` の一時失敗のみ retry する。permission / config / token missing は即 fail。

---

## 実装内容

### `TasuLivePlatformRetry`（新規）

| 項目 | 内容 |
| --- | --- |
| `classifyIntegrationRetry` | network / timeout / transient → retryable · permission / config / token missing → fatal |
| `executeWithRetry` | `maxAttempts: 2` · backoff 500–5000ms（最小安全値） |
| 非 retry | permission denied · camera/mic denied · config missing · token missing · misconfigured |

### `TasuLivePlatformIntegration`

| 操作 | retry |
| --- | --- |
| `startPublish` → `_broadcast.startBroadcast` | ✅ |
| `joinLive` → `_provider.joinLive` | ✅ |
| `joinAsViewer` → `_viewer.joinViewer` | ✅ |
| `stopPublish` / chat / recording / monitoring | ❌（今回対象外） |

- `_executeIntegrationRetry(operation, fn)` — `TasuLivePlatformRetry` 未ロード時は直接実行（Phase 3 互換）
- `getDiagnostics()` に `retryLastResult` 追加
- retry モジュール未ロード時は戻り値 shape 不変

### Diagnostics

- `recordRetry(phase, payload)` · `retryEvents` bucket
- snapshot: `retryEvents` · `retryLastResult`
- token / secret / credential は記録しない

### PoC HTML

- `platform-live/zego-platform-poc.html` に `live-platform-retry.js` を integration 前に追加

---

## 変更ファイル

| 種別 | ファイル |
| --- | --- |
| **A** | `platform-live/core/live-platform-retry.js` |
| **M** | `platform-live/core/live-platform-integration.js` |
| **M** | `platform-live/core/live-platform-diagnostics.js` |
| **M** | `platform-live/zego-platform-poc.html` |
| **A** | `scripts/test-platform-live-zego-integration-phase4-p4-6.mjs` |
| **A** | `reports/live-platform-zego-phase4-p4-6-retry.md` |
| **M** | `package.json` |

### 非変更（確認済）

- `platform-live/provider/live-provider-interface.js`
- `live/providers/zego-live-provider.js` · TLV PoC
- Builder / AI Workspace / Secretary
- Secret / `.env` / `.dev.vars`

---

## テスト結果

| スイート | 結果 |
| --- | --- |
| P4-6 | **63 PASS** |
| P4-5 regression | PASS |
| P4-4 regression | PASS |
| P4-3 regression | PASS |
| P4-2 regression | PASS |
| P4-1 regression | PASS |
| Phase 3 regression | PASS |
| Phase 1 adapter | **77 PASS** |
| Phase A–F | **278 PASS** |
| `build:pages` | PASS |
| E2E integration | **32 PASS** |
| Browser Play Check | **GO**（host local-video SKIP 既知） |

### P4-6 カバレッジ

- publish transient failure → retry → success
- joinLive transient failure → retry → success
- joinAsViewer transient failure → retry → success
- permission / config / token missing — no retry
- retry exhausted diagnostics（`exhausted` event · `retryLastResult`）
- classification tests（network / timeout / permission / config / transient）
- stop / chat — retry 対象外
- P4-2 edge sync · P4-3 watching · P4-4 recording · P4-5 monitoring 維持
- retry モジュール未ロード fallback（Phase 3 互換）
- 戻り値 shape 互換 · token 非露出

---

## 検証環境

| 項目 | 値 |
| --- | --- |
| HTTP | `http://127.0.0.1:8788` |
| PoC | `/platform-live/zego-platform-poc.html` — **200** |
| Console Error | E2E / Browser Play — clean |
| Viewport | E2E fake media · Browser Play 1280 |

---

## Phase 4 完了

P4-1〜P4-6 すべて **GO**。Integration 層の Phase 4 design gate シーケンス完了。

**コミット:** 未実施（ユーザー指示待ち）
