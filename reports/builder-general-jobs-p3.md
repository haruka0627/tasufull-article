# Builder General Jobs — P3 報告

**日付:** 2026-07-05  
**フェーズ:** P3（本番運用構造整理）  
**判定:** **Go**

---

## 概要

Builder 一般案件を本番運用に出せる構造へ整理。取り下げ RLS（ファイルのみ）· 案件編集 · adapter 全面切替 · legacy 導線縮小 · demo 表記除去を実施。`commitBoardApplicationDecision` · Talk UUID path · selected/rejected ロジックは未変更。

---

## 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `supabase/manual/staging_builder_general_jobs_p3_rls.sql` | 応募者 DELETE RLS（Staging 手動適用用） |
| `supabase/migrations/20260705120000_builder_general_jobs_p3_withdraw_staging.sql` | P3 placeholder migration |
| `builder/builder-general-jobs-dual-write.js` | `withdrawWithMirror` Supabase DELETE · `updateProjectWithMirror` |
| `builder/builder-repositories-supabase.js` | `deleteApplication` · `updateGeneralProject` |
| `builder/builder-repositories-local.js` | `deleteApplication` |
| `builder/builder-application-repository.js` | `deleteApplication` delegate |
| `builder/builder-project-repository.js` | `updateGeneralProject` delegate |
| `builder/builder-board-adapter.js` | `commitBoardMutation` · `ensureFeedListings` · `recordBoardEvent` |
| `builder/builder-partner-adapter.js` | `resolvePartnerForApplication` · state 直渡し対応 |
| `builder/builder.js` | bindRuntime · 編集フォーム · legacy notify · demo 除去 · edit CTA |
| `builder/board-project-detail.html` | オーナー向け「案件を編集」CTA |
| `builder/mvp-projects.html` | `board-projects.html` へ即時リダイレクト |
| `builder/project.html` | `board-project-detail.html` へリダイレクト |
| `scripts/test-builder-general-jobs-p3-smoke.mjs` | P3 smoke + 全回帰 |
| `scripts/test-builder-general-jobs-p2-wave3-smoke.mjs` | 編集 CTA: partner 非表示に更新 |
| `deploy/cloudflare/dist/builder/*` | build 同期 |

---

## 実装内容

### 1. Supabase 取り下げ RLS（ファイルのみ）

- 方針: `status='applied'` かつ `applicant_auth_uid = auth.uid()` の行のみ DELETE
- selected / rejected は削除不可（オーナー選定 UPDATE のみ）
- `withdrawWithMirror`: Supabase `deleteApplication` 成功時は行削除 · 失敗時は MVP overlay + warn（local fallback 維持）

### 2. 案件編集（最小実装）

- `canEditGeneralBoardProject`: 一般 board · owner · 未選定 · open/applied/draft
- `mvp-project-new.html?project_id=` でフォーム preload · submit で `updateProjectWithMirror`
- `board-project-detail.html`: 編集可能時のみ「案件を編集」表示（partner には非表示）

### 3. adapter 全面切替

- `TasuBuilderBoardAdapter.bindRuntime`: `commitBoardMutation` · `ensureFeedListings` · `recordBoardEvent`
- `commitBoardApplicationDecision` は adapter 経由で mutation（従来ロジック維持）
- `TasuBuilderPartnerAdapter.resolvePartnerForApplication` を board 詳細応募一覧で使用

### 4. legacy 導線縮小

- `mvp-projects.html` → `board-projects.html`（head script + JS fallback）
- `project.html` → `board-project-detail.html`
- 一般 board 通知: `completed` / `admin` / `dispatch` / `attachment` / `template` → board 詳細へ

### 5. demo role / demo 表記除去

- 本番ホスト: `renderMvpRole` 非表示
- ローカル: 「開発用：表示切替」→「検証用ロール」
- 協力会社切替ボタン selector 修正（`data-builder-mvp-role-partner-toggle`）
- `mvp-threads` document.title: `Builder MVP` → `TASFUL Builder`

---

## SQL 適用

| 項目 | 内容 |
| --- | --- |
| **適用が必要か** | **はい**（Staging のみ · 人間確認後） |
| **SQL ファイル** | `supabase/manual/staging_builder_general_jobs_p3_rls.sql` |
| **Production** | **触らない**（本タスク範囲外） |
| **未適用時の挙動** | 取り下げは MVP mirror + `withdrawn_board_applications` overlay（P0〜P2 と同様 · warn ログ） |

---

## 検証結果

### コマンド

```bash
npm run build:pages
npm run dev   # http://127.0.0.1:8788
node scripts/test-builder-general-jobs-p3-smoke.mjs
```

### PASS/FAIL

| 区分 | 結果 |
| --- | --- |
| P0-06 | **PASS** |
| P1 Wave 1 | **PASS** |
| P2 Wave 3 | **PASS**（20/20） |
| P2 Wave 4 | **PASS**（46/46） |
| P3 smoke | **PASS**（25/25） |
| Console Error | **0** |
| 1280 / 768 / 390 | **PASS**（P2 Wave 4 回帰内） |

### P3 smoke 内訳

- adapter p3 · dual-write `updateProjectWithMirror`
- mvp-projects / project.html リダイレクト
- owner 編集 CTA · フォーム preload
- demo ラベル除去
- P3 RLS SQL ファイル存在確認

---

## Go / No-Go

| 判定 | **Go** |
| --- | --- |
| 条件 | 全回帰 PASS · Console Error 0 · 禁止事項未抵触 · SQL はファイル作成のみ |

**Staging 次アクション:** `staging_builder_general_jobs_p3_rls.sql` を Dashboard で適用後、取り下げの Supabase 同期を live で再確認。

---

## Production Ready に残る課題

1. **P3 RLS Staging 適用** — 取り下げの Supabase primary 同期
2. **本番 Supabase / Cloudflare フラグ** — `isGeneralJobsRepositoryEnabled` 本番 ON と認証連携
3. **Builder 本番 actor identity** — `isBuilderProdHost` 時のロール/協力会社 ID（demo ロール除去済み · 本番 JWT 必須）
4. **legacy HTML タイトル** — `mvp-thread.html` 等の `Builder MVP` 表記（一般案件フロー外 · 別タスク可）
5. **E2E 本番 smoke** — Staging RLS 適用後の authenticated withdraw/delete ライブ検証
6. **運営 runbook** — Production への RLS 適用は別レビュー（`reports/builder-general-jobs-ops-guide.md` 参照）

---

## 維持確認（P0〜P2）

| 項目 | 状態 |
| --- | --- |
| selected → Talk Room UUID | 維持 |
| notify href `chat-detail.html?thread={UUID}` | 維持 |
| rejected → Talk Room なし | 維持 |
| local fallback | 維持 |
| `commitBoardApplicationDecision` | 未変更（adapter 委譲のみ） |

---

*証跡:* `reports/builder-general-jobs-p3/smoke-report.json`
