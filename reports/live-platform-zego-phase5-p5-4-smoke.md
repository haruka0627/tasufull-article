# Platform Live ZEGO — Phase 5 P5-4 Integration Smoke

**Date:** 2026-06-29  
**Base URL:** http://127.0.0.1:8788  
**Verdict:** **GO**

## 実施概要

P5-3 `usePlatformLive` 条件付き接続の 8788 統合スモーク（検証フェーズ · 新規機能実装なし）。

## 初回失敗と解消

| 事象 | 原因 | 解消 |
|------|------|------|
| Flag ON `waitForFunction` timeout | **`deploy/cloudflare/dist` が P5-3 未同期**（`runPlatformLiveBridge` が dist に無かった） | `npm run build:pages` で dist 同期後 **GO** |

**前提:** 8788 検証は **`npm run build:pages` → `npm run dev`** を先に実行する。

## Flag OFF — PASS

- `live/studio.html` / `live/watch.html` HTTP **200**
- Viewport **1280 / 768 / 390** — studio / watch · stub comments 維持
- `usePlatformLive=false` — bridge disabled · Integration **未 lazy load**
- **severe console error 0**

## Flag ON — PASS

- InitScript `usePlatformLive=true`（ソース変更なし）
- watch → bridge → Adapter **`joinViewer`** → Integration
- studio → bridge → Adapter **`startHost`**
- Integration script **load abort** → **non-fatal**（page intact）
- Retry → **P4-6 Integration 委譲**
- **severe console error 0**

## P5-4 smoke（最終実行）

**44 PASS / 0 FAIL / 4 SKIP** — GO

| SKIP | 理由 |
|------|------|
| `build:pages` | 直前に別途実行済み |
| `on:studio-button-bridge` | u_me に scheduled broadcast なし |
| `regression:all` | 別途一括実行（下記） |
| `optional:e2e` | P5-4 TLV UI スコープ外 |

## Regression（別途一括 · FAIL 0）

| Script | 結果 |
|--------|------|
| `test:platform-live-zego-integration-phase5-p5-3` | **37 PASS** |
| `test:platform-live-zego-integration-phase5-p5-2` | **48 PASS** |
| `test:platform-live-zego-integration-phase5-p5-1` | **40 PASS** |
| `test:platform-live-zego-integration-phase4-p4-6` | **63 PASS** |

## build:pages

**PASS** — dist 同期（P5-3 bridge / flags 含む）

## 未実行（P5-4 TLV UI スコープ外）

| Script | 理由 |
|--------|------|
| `verify:platform-live-zego-integration-e2e` | ZEGO PoC / token — **TLV studio/watch 対象外** |
| `verify:platform-live-zego-browser-play-check` | Phase 2.5 PoC 実機 — **TLV UI 対象外** |

## P5-4 判定

**GO**

## P5-5+ 後続（Phase 5 · 未着手）

| ID | 項目 |
|----|------|
| P5-5 | Flag ON ZEGO provider lazy load |
| P5-6 | watch leave · studio preview video container |
| P5-7 | Supabase comments vs Platform Chat 統合方針 |
| P5-8 | `renderStreamPlayer` 実映像化 |
| P5-9 | watch URL 正規化 |

## 実行

```bash
npm run build:pages
npm run dev
npm run verify:platform-live-zego-integration-phase5-p5-4-smoke
```
