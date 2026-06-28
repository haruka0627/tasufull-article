# Platform Live ZEGO Integration — Phase 5 P5-2 Report

**Date:** 2026-06-29  
**Base commit:** `a8a3a20` (P4-6) · P5-1 調査済  
**Branch:** `cf-pages-deploy`  
**Scope:** TLV Platform Live Adapter · 本番 UI 非接続 · **未コミット**

---

## 目的

TLV 本番 UI と ZEGO 実装を直接結合せず、**Platform Live Integration 経由**で Host / Viewer / Chat / Recording / Monitoring を呼び出せる境界 Adapter を追加する。

---

## 実装概要

### `TlvPlatformLiveAdapter`（`live/tlv-platform-live-adapter.js`）

| 責務 | 実装 |
| --- | --- |
| surface | 常に `tlv`（`LIVE_SURFACES.TLV`） |
| ID 正規化 | `normalizeIds` — `broadcastId` / `liveId` / `roomId` 相互補完 |
| Host 入口 | `startHost()` → `Integration.startPublish` |
| Viewer 入口 | `joinViewer()` → `Integration.joinLive` |
| Chat 入口 | `sendChatMessage()` → `Integration.sendChatMessage` |
| Recording | `startRecording()` → `Integration.startRecording` |
| Monitoring | `getMonitoringHealth()` → `Integration.getMonitoringHealth` |
| Diagnostics | `getDiagnostics()` — Integration snapshot + adapter meta |
| Retry | **Adapter 内に実装なし** — P4-6 Integration に委譲 |
| ZEGO | **直接依存禁止** — `TasuLivePlatformIntegration` のみ |

### P5-3 向け flag hook

```javascript
TLV_FEATURE_FLAGS.usePlatformLive === true  // 未追加 · default 相当 false
```

- flag OFF（現状）: `startHost` / `joinViewer` 等は `{ skipped: true, code: PLATFORM_LIVE_DISABLED }`
- テスト用: `skipFlagCheck: true` で Integration 委譲を検証

### 本番 UI

- `studio.html` / `watch.html` / `live-broadcasts.js` — **変更なし**
- `bindStudioActions` / `mountWatchPage` への接続は **P5-3 以降**

---

## 変更ファイル

| 種別 | ファイル |
| --- | --- |
| **A** | `live/tlv-platform-live-adapter.js` |
| **A** | `scripts/test-platform-live-zego-integration-phase5-p5-2.mjs` |
| **A** | `reports/live-platform-zego-phase5-p5-2-adapter.md` |
| **M** | `package.json` |
| **M** | `docs/TODO.md` |

### 非変更（確認済）

- `live/studio.html` · `live/watch.html` · `live/live-broadcasts.js`
- `live/providers/zego-live-provider.js` · TLV PoC
- `platform-live/provider/live-provider-interface.js`
- Token API · DB · dist/deploy

---

## テスト結果

| スイート | 結果 |
| --- | --- |
| P5-2 | **48 PASS** |
| P4-6 regression | PASS |
| P5-1 regression | PASS |

### P5-2 カバレッジ

- Adapter 生成 · surface=`tlv`
- Host / Viewer / Chat / Recording / Monitoring context 正規化
- flag default OFF → skipped
- Integration 未ロード → fail-safe
- Diagnostics 取得 · secret 非露出
- Host `startHost` · Viewer `joinViewer` — Integration 委譲（stub）
- Chat — Integration 委譲（mock integration）
- Retry — Adapter ソースに retry なし · Integration に存在
- 本番 HTML / broadcasts 非変更

---

## 本番挙動変更

**なし** — Adapter は新規モジュールのみ。本番ページは従来どおり Supabase status 更新 + stub player。

---

## 未対応事項（P5-3 以降）

- [ ] `usePlatformLive` feature flag 本実装（`tlv-feature-flags.js`）
- [ ] `bindStudioActions` / `mountWatchPage` から Adapter 呼び出し
- [ ] studio host preview / watch video container
- [ ] P5-4 統合スモーク（Host/Viewer/Chat/Recording/Monitoring/Retry/Diagnostics）
- [ ] Supabase comments と Platform Chat の本番統合方針確定

---

## P5-2 判定

### **GO**

接続土台（Adapter + context 正規化 + Integration 委譲 + flag hook）完了。P5-3 feature flag 実装へ進行可能。
