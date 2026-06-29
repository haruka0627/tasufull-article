# TLV 仕上げ — T1 / T2 / T4 実装レポート

**Date:** 2026-06-29  
**Scope:** 公開前導線整理 · console severe error 解消 · 主要導線 smoke 追加  
**Commit:** `2ba6d6c`（`fix(tlv): finalize watch links and creator dashboard fallback`）

---

## 概要

| Task | 内容 | 結果 |
| --- | --- | --- |
| **T1** | 通知・深リンクの watch URL を `watch.html?broadcast_id=` に統一。`watch-live.html?id=` は非破壊リダイレクトで互換維持 | **Done** `2ba6d6c` |
| **T2** | `live_creator_monetization` RLS 42501 を severe console error にしない。`console.warn` + fallback UI | **Done** `2ba6d6c` |
| **T4** | 8788 向け主要導線 smoke 1 本追加（1280 / 390） | **Done** `2ba6d6c` |

**対象外（触っていない）:** Platform Live Phase5 bridge 本体 · 実 RTC · Payment 本番 · Chat 統合 · Studio DB · UI 全面変更 · Builder / AI / BD

---

## T1 — watch URL 統一

### 変更

- `live/tlv-notification-types.js` — `liveStartedTargetUrl()` → `TasuLiveConfig.watchUrl()` / `watch.html?broadcast_id=`
- `live/live-notify.js` — fallback URL 同上
- `live/tlv-dev-auth.js` — 通知・深リンク生成 2 箇所
- `supabase/functions/live-notify/index.ts` — Edge 既定 `target_url`
- `live/watch-live.html` — head 内 non-fatal `location.replace`（`id` / `broadcastId` → `broadcast_id` + `watch.html`）
- `scripts/test-tlv-live-started-notify-dev.mjs` — 期待 URL を正規形に更新

### 方針

- `watch-live.html` は**削除しない**
- `live-config.watchUrl()` 正本を優先
- Platform Live bridge 本体は未変更

---

## T2 — creator-dashboard RLS non-fatal

### 変更

- `live/live-monetization-service.js`
  - `isMonetizationAccessFallbackError()` 追加（code `42501` / permission denied / RLS）
  - `getRecordAsync` / `ensureAdRpmDbCache` で DB fallback（localStorage）
- `live/live-creator-dashboard.js`
  - `getMonetizationStatusAsync` を try/catch → `not_applied` + `console.warn`
  - mount 失敗時 `console.error` → `console.warn` + `[data-tlv-creator-dashboard-fallback]` UI

### 方針

- RLS / migration は**変更なし**
- 未ログインは従来どおりログイン案内
- 権限なし時は空 / fallback 表示で画面を維持

---

## T4 — 主要導線 smoke

### 追加

- `scripts/verify-tlv-finish-main-flow-smoke.mjs`
- `package.json` — `verify:tlv-finish-main-flow-smoke`

### 確認対象

| Route | Query |
| --- | --- |
| `live/index.html` | — |
| `live/videos.html` | — |
| `live/watch.html` | `broadcast_id=stub&talkDev=1` |
| `live/studio.html` | `talkDev=1` |
| `live/creator-dashboard.html` | — |
| `live/watch-live.html`（互換） | `id=stub&talkDev=1` → redirect |

### チェック

- HTTP 200
- severe console error 0
- watch URL 正規形（`broadcast_id=stub`）
- creator-dashboard: login / dashboard / fallback のいずれか（`.live-error` なし）
- viewport: **1280** · **390**

---

## 検証コマンド

```bash
npm run verify:tlv-finish-main-flow-smoke
npm run build:pages   # 1 回のみ（完了時）
```

Smoke 詳細: [tlv-finish-t1-t2-t4-smoke.md](./tlv-finish-t1-t2-t4-smoke.md)（実行後生成）

---

## 変更ファイル一覧（ソース）

| ファイル | T1 | T2 | T4 | docs |
| --- | --- | --- | --- | --- |
| `live/tlv-notification-types.js` | ✓ | | | |
| `live/live-notify.js` | ✓ | | | |
| `live/tlv-dev-auth.js` | ✓ | | | |
| `live/watch-live.html` | ✓ | | | |
| `supabase/functions/live-notify/index.ts` | ✓ | | | |
| `live/live-monetization-service.js` | | ✓ | | |
| `live/live-creator-dashboard.js` | | ✓ | | |
| `scripts/verify-tlv-finish-main-flow-smoke.mjs` | | | ✓ | |
| `scripts/test-tlv-live-started-notify-dev.mjs` | ✓ | | | |
| `package.json` | | | ✓ | |
| `docs/TODO.md` | | | | ✓ |
| `reports/tlv-finish-t1-t2-t4.md` | | | | ✓ |

---

## GO / No-Go

**Verdict: GO**（2026-06-29 · `npm run verify:tlv-finish-main-flow-smoke`）

| 項目 | 結果 |
| --- | --- |
| Smoke | **32/32 PASS** — [tlv-finish-t1-t2-t4-smoke.md](./tlv-finish-t1-t2-t4-smoke.md) |
| `build:pages` | **OK** → `deploy/cloudflare/dist` |
| Severe console（主要導線） | **0**（1280 / 390） |
| Viewport | 1280 · 390 |

**判断基準:**

- GO: smoke 全 PASS · build:pages 成功 · severe console 0
- NO-GO: 上記いずれか失敗

---

## 関連

- `docs/TODO.md` — TLV 仕上げ T1/T2/T4 セクション
- `npm run verify:tlv-finish-main-flow-smoke`
