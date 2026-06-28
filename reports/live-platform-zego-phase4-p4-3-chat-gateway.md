# Platform Live ZEGO Integration — Phase 4 P4-3 Report

**Date:** 2026-06-29  
**Base commit:** `9820e5c` (P4-2)  
**Branch:** `cf-pages-deploy`  
**Scope:** Chat Gateway Integration · joinLive `set_watching` opt-in · 本番 deploy なし · **未コミット**

---

## 目的

`TasuLivePlatformIntegration` に Chat Gateway を接続し、`useEdgeSync=true` 時に `joinLive` 成功後のみ edge `set_watching` を呼ぶ。`useEdgeSync=false` では Phase 3 / P4-2 互換を維持。

---

## 実装内容

### TasuLivePlatformIntegration

| 項目 | 内容 |
| --- | --- |
| Chat Gateway | `initialize` 後に `TasuLivePlatformChatGateway` を配線（broadcast / viewer / session / provider） |
| 追加 API | `sendChatMessage()` · `getChatMessages()`（additive） |
| joinLive | 本体 play path 維持 · 成功後のみ `_runEdgeSetWatching()` |
| opt-in | `useEdgeSync=true` かつ provider + session 成功時のみ `set_watching` |
| 失敗時 | non-fatal · `watchingSync` 結果を return + diagnostics |
| publish/stop | P4-2 経路（setLive / clearLive）変更なし |

### Chat Edge Client

| 項目 | 内容 |
| --- | --- |
| `setWatching()` / `clearWatching()` | `action: set_watching` を POST |
| `sendMessage()` | client `messageId` を body に伝搬 |
| local fallback | `set_watching` noop stub · messageId を local gateway に渡す |

### Diagnostics

- `recordChatEdge()` · `chatEdgeEvents`（attempted / skipped / succeeded / failed）
- `getDiagnostics()` に `chatGatewayReady` · `watchingSyncLastResult`
- token / manualToken / secret は記録しない

---

## 変更ファイル

| 種別 | ファイル |
| --- | --- |
| **M** | `platform-live/core/live-platform-integration.js` |
| **M** | `platform-live/core/live-platform-diagnostics.js` |
| **M** | `platform-live/chat/live-chat-edge-client.js` |
| **A** | `scripts/test-platform-live-zego-integration-phase4-p4-3.mjs` |
| **A** | `reports/live-platform-zego-phase4-p4-3-chat-gateway.md` |
| **M** | `package.json` |

### 非変更（確認済）

- `platform-live/provider/live-provider-interface.js`
- `live/providers/zego-live-provider.js` · TLV PoC
- Builder / AI Workspace / Secretary

---

## テスト結果

| スイート | 結果 |
| --- | --- |
| P4-3 | **38 PASS** |
| P4-2 regression | PASS |
| P4-1 regression | PASS |
| Phase 3 regression | PASS |
| Phase 1 adapter | **77 PASS** |
| Phase A–F | **278 PASS** |
| `build:pages` | PASS |
| E2E integration | **32 PASS** |
| Browser Play Check | **GO**（host local-video SKIP 既知） |

### P4-3 カバレッジ

- `useEdgeSync=false` joinLive 互換（set_watching なし）
- `useEdgeSync=true` joinLive → set_watching 1 回
- joinLive 失敗時 set_watching なし
- set_watching 失敗 non-fatal
- chat edge client messageId 伝搬
- P4-2 publish/stop 経路維持
- sendChatMessage → edge messageId 一致

---

## 8788 検証

| 項目 | 結果 |
| --- | --- |
| HTTP Status | 200（PoC ページ） |
| Console Error | clean（E2E / Browser Play） |
| Viewport | E2E host/audience · Browser Play 1280/390 |

---

## 判定

| 項目 | 結果 |
| --- | --- |
| **P4-3 Chat Gateway + set_watching** | **COMPLETE** |
| **P4-4 Recording wire** | **GO** |

---

## 次フェーズ（P4-4 参考）

- Recording service Integration 配線
- publish 成功時 candidate event（自動録画開始はしない）
- 明示 `startRecording` / `stopRecording` delegate
