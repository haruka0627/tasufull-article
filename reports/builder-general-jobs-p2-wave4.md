# Builder General Jobs — P2 Wave 4 報告

**日付:** 2026-07-05  
**フェーズ:** P2 Wave 4（P2-05〜P2-10）  
**判定:** **Go**

---

## 概要

商用運用前の UI/UX 品質仕上げ。業務ロジック（`commitBoardApplicationDecision` · Talk UUID path · selected/rejected）は未変更。P0-06 / P1 / P2 Wave 3 回帰維持。

---

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `builder/builder.css` | P2-05 レスポンシブ · P2-06 apply dock 768px |
| `builder/builder.js` | dock 768 · adapter bind · ラベル · my-apps adapter |
| `builder/builder-board-adapter.js` | P2-08 一覧/応募/取り下げ adapter |
| `builder/builder-partner-adapter.js` | P2-08 応募取得 adapter |
| `builder/builder-nav-config.js` | P2-09 TASFUL Talk ラベル |
| `builder/board-projects.html` | P2-09 ショートカットラベル |
| `builder/board-project-detail.html` | dock 768 · P2-09 Talk ラベル |
| `builder/mvp-project-new.html` | P2-07 mobile shell · 戻り導線 |
| `builder/mvp-notifications.html` | P2-05 mobile shell · タイトル |
| `tasful-app-mobile.js` | APP_DETAIL_PAGES 追加 |
| `scripts/test-builder-general-jobs-p2-wave4-smoke.mjs` | 新規 smoke + スクショ |
| `reports/builder-general-jobs-ops-guide.md` | P2-10 運営ガイド |
| `deploy/cloudflare/dist/builder/*` | build 同期 |

---

## 実装内容

### P2-05 レスポンシブ QA

- 対象 4 画面: `board-projects` · `board-project-detail` · `mvp-project-new` · `mvp-notifications`
- `overflow-x: hidden` · 検索フォーム縦積み · ショートカット 1 列（390）· カード CTA 縦積み
- 主要 CTA `min-height: 44px`
- Playwright スクショ: `reports/ui-review/builder-general-p2-wave4/{page}/{1280,768,390}.png`

### P2-06 apply dock 768 対応

- ブレークポイント 480px → **768px**（JS + CSS）
- dock に応募 + 取り下げの 2 ボタン（縦積み）
- `builder-main` padding-bottom で本文が dock/tabbar に隠れないよう調整

### P2-07 投稿画面 mobile shell

- `mvp-project-new.html`: `tasful-app-mobile.css/js` · `viewport-fit=cover` · 掲示板戻りリンク
- `tasful-app-mobile.js` に `mvp-project-new.html` / `mvp-notifications.html` 登録
- タイトル **TASFUL Builder** に統一

### P2-08 board/partner adapter

- `listBoardProjects` · `getBoardProject` · `listMyApplications` · `applyToProject` · `withdrawApplication`
- `getApplication` · `getDisplayName` · `isWithdrawn`（partner）
- `bindRuntime({ reload, mvpApi })` — **再帰回避**（partner getApplication は standalone）
- hydrate 既存実装とマージ · Supabase primary / local fallback 維持

### P2-09 やり取り一覧ラベル

- 「やりとり」「やりとり一覧」→ **「TASFUL Talk」**
- サイドバー nav: **TASFUL Talk**
- `getMvpThreadsPageTitle`: 商用表記に統一

### P2-10 運営オペガイド

- `reports/builder-general-jobs-ops-guide.md` — 投稿→応募→選定→Talk→却下→通知の手順
- Staging / 本番で触ってはいけないもの明記

---

## レスポンシブ確認結果

| 画面 | 1280 | 768 | 390 |
| --- | --- | --- | --- |
| board-projects | PASS · 横スクロールなし | PASS · tap 44px | PASS · tap 44px |
| board-project-detail | PASS | PASS · dock CSS gate | PASS |
| mvp-project-new | PASS | PASS · tabbar 余白 | PASS |
| mvp-notifications | PASS | PASS | PASS |

**Console Error:** 0  
**HTTP:** 200（全対象 URL）

---

## 検証結果

| コマンド | 結果 |
| --- | --- |
| `node scripts/test-builder-general-jobs-p2-wave4-smoke.mjs` | **46/46 Go** |
| P2 Wave 3 回帰（smoke 内） | PASS |
| P0-06 回帰（smoke 内） | PASS |
| P1 Wave 1 回帰（smoke 内） | PASS |

---

## Go / No-Go

**Go** — P2 Wave 4 スコープ完了。商用前 UI/UX 最小品質を満たす。

---

## P3 に残す課題

| ID | 内容 |
| --- | --- |
| P3-DB-withdraw | Supabase 応募取り下げ RLS / Migration |
| P3-01-edit | 案件編集（`project_id` update path） |
| P3-adapter-full | adapter 経由の全面切替（builder.js 直実装の段階的縮小） |
| P3-production | 本番 SQL · Production Ready 判定 · billing |
| P3-owner-ghost | 取り下げ後オーナー画面の Supabase 幽霊応募表示 |

---

## 参照

- `reports/builder-general-jobs-ops-guide.md`
- `reports/builder-general-jobs-p2-wave4/result.json`
- `reports/ui-review/builder-general-p2-wave4/`
