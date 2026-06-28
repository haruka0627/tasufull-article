# Platform Live ZEGO Integration — Phase 3 Report

**Date:** 2026-06-29  
**Base commit:** d15b70b (Phase 2.5)  
**Scope:** Platform Live 配下のみ · TLV PoC 非変更 · 本番 deploy なし

---

## 目的

Phase 2.5 で検証した ZEGO SDK を Platform Live Core（Session · Broadcast · Viewer）へ正式統合。PoC 直結ではなく `TasuLivePlatformIntegration` オーケストレータ経由で Adapter 境界を維持。

---

## 実装サマリ

| 領域 | 内容 |
| --- | --- |
| **Integration** | `TasuLivePlatformIntegration` — Factory → Broadcast / Viewer / Session 配線 · lifecycle · diagnostics |
| **Provider State** | `live-provider-state-map.js` — idle / initializing / ready / live / reconnecting / stopped / failed |
| **Error Mapping** | `zego-platform-error-map.js` — ZEGO → Platform code · recoverable · retry policy |
| **Diagnostics** | `live-platform-diagnostics.js` — provider / publish / viewer / session timeline |
| **Adapter** | `getCanonicalProviderState()` · `getIntegrationDiagnostics()` · SDK roomStateUpdate reconnect · error map 統合 |
| **Broadcast / Viewer** | `videoContainer` · `manualToken` · `userName` · `streamId` passthrough（Interface 非変更） |
| **PoC** | `zego-platform-poc.*` → Integration 経由（UI 最小変更 · audience は `joinLive` 直接 path） |

---

## アーキテクチャ

```
UI (PoC)
  → TasuLivePlatformIntegration
    → BroadcastService / ViewerService / SessionManager
      → createPlatformLiveProvider("zego")
        → ZegoLiveProviderAdapter
          → TlvZegoLiveProvider (TLV PoC delegate · 非変更)
            → ZEGO SDK
```

**責務分離:**

- **Host publish:** `startPublish` → Broadcast.create + Broadcast.start → Adapter.startBroadcast
- **Audience (別クライアント):** `joinLive` → Provider.joinLive + Session.join（ローカル broadcast LIVE 不要）
- **Coordinated viewer:** `joinAsViewer` → ViewerService（broadcast LIVE 必須 · 同一 surface 内）

---

## テスト結果

| チェック | 結果 |
| --- | --- |
| `npm run test:platform-live-zego-integration-phase3` | **PASS** (42) |
| Phase 1 adapter regression | **PASS** |
| Phase A–F regression | **PASS** |
| `npm run build:pages` | **PASS** |
| `npm run verify:platform-live-zego-integration-e2e` | **PASS** (32) |
| `npm run verify:platform-live-zego-browser-play-check` | **GO** (host publish · audience play remote=1) |
| TLV PoC / Interface SHA | **unchanged** |
| dev `http://127.0.0.1:8788` | **LISTEN** · PoC HTTP 200 |

### Browser Play Check (8788)

| Step | Result |
| --- | --- |
| host initialize | PASS |
| host publish | PASS |
| audience join | PASS |
| audience play | PASS (remote=1) |
| Console errors | clean |

---

## 変更ファイル一覧

### 新規

- `platform-live/core/live-platform-integration.js`
- `platform-live/core/live-provider-state-map.js`
- `platform-live/core/live-platform-diagnostics.js`
- `platform-live/provider/zego-platform-error-map.js`
- `scripts/test-platform-live-zego-integration-phase3.mjs`
- `reports/live-platform-zego-phase3-integration.md`

### 更新

- `platform-live/provider/adapters/zego-live-provider-adapter.js`
- `platform-live/broadcast/live-broadcast-service.js`
- `platform-live/viewer/live-viewer-service.js`
- `platform-live/zego-platform-poc.html`
- `platform-live/zego-platform-poc.js`
- `package.json` (`test:platform-live-zego-integration-phase3`)
- `scripts/test-platform-live-zego-adapter-phase1.mjs` (vm `setTimeout`/`clearTimeout` — publish diag finally 対応)

### 非変更（確認済）

- `live/providers/zego-live-provider.js`
- `live/live-zego-poc.*`
- `platform-live/provider/live-provider-interface.js`
- Builder / AI Workspace / Secretary

---

## Phase 3 完了判定

| 項目 | 判定 |
| --- | --- |
| Platform Live Core 正式接続 | **COMPLETE** |
| Provider State 連携 | **COMPLETE** |
| Broadcast / Viewer Event Flow | **COMPLETE** |
| Error Mapping + Retry Policy | **COMPLETE** |
| Diagnostics Timeline | **COMPLETE** |
| Platform API / Interface 非破壊 | **PASS** |
| Adapter 境界維持 | **PASS** |
| TLV 影響なし | **PASS** |
| Browser Play 継続 PASS | **GO** |
| Production deploy | **未実施**（意図通り） |

### 総合: **Phase 3 COMPLETE · GO**

---

## 次フェーズ候補（参考 · 本タスク外）

- Edge 経由 broadcast 状態 sync（audience `joinAsViewer` 本番 path）
- Chat / Recording / Monitoring と Integration 統合
- Retry policy の Integration 層自動適用
