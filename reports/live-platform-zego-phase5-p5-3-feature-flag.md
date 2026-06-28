# Platform Live ZEGO Integration — Phase 5 P5-3 Report

**Date:** 2026-06-29  
**Base:** P5-2 Adapter · P5-1 audit  
**Branch:** `cf-pages-deploy`  
**Scope:** `usePlatformLive` feature flag · 条件付き bridge 接続 · **未コミット**

---

## 目的

`usePlatformLive=false`（default）では既存 Supabase / stub フローを完全維持し、`true` 時のみ Platform Live Adapter 経由で Host / Viewer を切り替え可能にする。

---

## 実装概要

### Feature Flag（`live/tlv-feature-flags.js`）

```js
usePlatformLive: false  // default · 未定義も false（=== true のみ有効）
TLV_USE_PLATFORM_LIVE   // getter
```

### Bridge（`live/tlv-platform-live-bridge.js`）

| 項目 | 内容 |
| --- | --- |
| `isEnabled()` | `usePlatformLive === true` のみ |
| lazy load | flag ON 時のみ Platform Live script chain を読込 |
| `onStudioStart` | Adapter.startHost |
| `onStudioEnd` | Adapter.stopHost |
| `onWatchJoin` | Adapter.joinViewer |
| `onWatchLeave` | Adapter.leaveViewer |
| 失敗 | `partial: true` · console.warn · ページ非破壊 |
| Diagnostics | `getDiagnostics()` / `getLastResult()` |

### Broadcasts 接続（`live/live-broadcasts.js`）

| タイミング | 呼び出し |
| --- | --- |
| 配信開始（Supabase live 更新後） | `runPlatformLiveBridge("onStudioStart", …)` |
| 配信終了 | `runPlatformLiveBridge("onStudioEnd", …)` |
| watch マウント後 | `runPlatformLiveBridge("onWatchJoin", …)` |

`runPlatformLiveBridge` — flag OFF / bridge 未ロード時は **即 return**（既存フロー優先）。

### Script 配線

- `studio.html` / `watch.html` に **`tlv-platform-live-bridge.js` のみ**追加
- Platform Integration は **lazy load**（flag ON + 初回操作時）
- flag OFF 時は Integration 未ロード · 画面動作不変

### stage 生成（将来 build 用）

- `deploy/cloudflare/stage-cloudflare-pages.mjs` に `usePlatformLive: false` 追加（dist 同期は今回未実施）

---

## 変更ファイル

| 種別 | ファイル |
| --- | --- |
| **A** | `live/tlv-platform-live-bridge.js` |
| **M** | `live/tlv-feature-flags.js` |
| **M** | `live/live-broadcasts.js` |
| **M** | `live/studio.html` |
| **M** | `live/watch.html` |
| **M** | `deploy/cloudflare/stage-cloudflare-pages.mjs` |
| **A** | `scripts/test-platform-live-zego-integration-phase5-p5-3.mjs` |
| **M** | `scripts/test-platform-live-zego-integration-phase5-p5-1-audit.mjs` |
| **A** | `reports/live-platform-zego-phase5-p5-3-feature-flag.md` |
| **M** | `package.json` |
| **M** | `docs/TODO.md` |

### 非変更

- `live/tlv-platform-live-adapter.js`（P5-2 そのまま利用）
- Supabase comments · Token API · DB
- ZEGO provider / Platform Interface
- dist/deploy

---

## Flag OFF 検証

| 項目 | 結果 |
| --- | --- |
| default `usePlatformLive=false` | PASS |
| 未定義 → false | PASS |
| bridge skipped · Integration 未ロード | PASS |
| bridge 未存在でも broadcasts 例外なし | PASS |
| `runPlatformLiveBridge` 呼び出しなし | PASS |
| 既存 Supabase 更新フロー優先 | PASS（コードパス確認） |

**本番 default 状態:** 従来どおり status 更新 + stub player + Supabase comments。

---

## Flag ON 検証

| 項目 | 結果 |
| --- | --- |
| `onStudioStart` → Adapter.startHost | PASS |
| `onWatchJoin` → Adapter.joinViewer | PASS |
| diagnostics / lastResult 記録 | PASS |
| load 失敗時 partial（非 fatal） | PASS |
| Retry — Integration 委譲 | PASS |

---

## テスト結果

| スイート | 結果 |
| --- | --- |
| P5-3 | **37 PASS** |
| P5-2 regression | PASS |
| P5-1 regression | PASS |
| P4-6 regression | PASS |

---

## 本番挙動変更

| 条件 | 挙動 |
| --- | --- |
| **`usePlatformLive=false`（default）** | **変更なし** — Supabase flow · comments · 表示すべて従来通り |
| **`usePlatformLive=true`** | Supabase 更新後に Platform Live 経路を **追加**（失敗 non-fatal） |

HTML 変更は bridge script 1 行追加のみ。UI / DB / Token 変更なし。

---

## 未対応事項（P5-4 以降）

- [ ] P5-4 統合スモーク（8788 · Host/Viewer/Chat/Recording/Monitoring/Retry）
- [ ] flag ON 時の ZEGO provider lazy load（現状 stub 経路）
- [ ] watch leave / beforeunload bridge 接続
- [ ] studio host preview video container
- [ ] Supabase comments との統合方針（置換しない）

---

## P5-3 判定

### **GO**

P5-4 統合スモークへ進行可能。
