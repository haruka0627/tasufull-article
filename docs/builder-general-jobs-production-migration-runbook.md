# Builder 一般案件 — Production Migration Runbook（RL-05）



**種別:** 手順書のみ · **実行は人間承認後**  

**禁止:** 本タスクでの Production Dashboard / migration 自動適用 · Supabase MCP

**凍結（2026-07-05）:** **2026年10月リリース直前まで Production SQL 適用は実行しない。** 正本: [builder-general-jobs-production-freeze-oct2026.md](./builder-general-jobs-production-freeze-oct2026.md) · 10月用チェックリスト: [builder-general-jobs-october-release-checklist.md](../reports/builder-general-jobs-october-release-checklist.md)



---



## 0. 前提



| 項目 | 状態 |

| --- | --- |

| Staging RL-01 適用 | RL-02 PASS（23/23 · `withdraw supabase DELETE`） |

| P0〜P3 コード | Go · Launch Smoke 10/10 |

| Production ref | 人間が Dashboard で Production プロジェクトを確認（MCP 登録禁止） |

| Production SQL | `supabase/manual/production_*`（**Staging ファイル直実行禁止**） |



---



## 1. Go / No-Go ゲート（適用前）



- [ ] Staging で `node scripts/test-builder-general-jobs-launch-smoke.mjs` **Go**

- [ ] Staging で `node scripts/test-builder-general-jobs-rl02-staging-live-e2e.mjs` **Go**

- [ ] `commitBoardApplicationDecision` · Talk UUID 回帰 PASS 記録あり

- [ ] Product: Contact Reveal **一般案件ローンチ不要**（RL-10）確認済み

- [ ] Production 専用 SQL をレビュー済み（§2 ファイル一覧）

- [ ] rollback SQL を用意済み（§4）

- [ ] ロールバック担当者・連絡先確定

- [ ] メンテナンスウィンドウ（任意）告知



---



## 2. 適用順（Production · Dashboard のみ）



**原則:** 上から順に 1 ファイルずつ · 各ステップ後に preflight/postflight で確認。



| Step | ファイル | 内容 | スキップ条件 |

| --- | --- | --- | --- |

| **0** | `production_builder_general_jobs_preflight.sql` | 読取のみ · 前提確認 | 常に実行 |

| **1** | `production_builder_calendar_projects_ddl.sql` | `builder_projects` Calendar 基盤 DDL | 基盤・talk_room_id 既存ならスキップ可 |

| **2** | `production_builder_calendar_rls.sql` | Calendar `builder_projects` RLS（5 policies） | 同等 RLS 既存なら差分レビュー後スキップ可 |

| **3** | `production_builder_general_jobs_p0_01_ddl.sql` | 一般案件 DDL（applications · partners 等） | `spec` 列・applications テーブル既存ならスキップ可 |

| **4** | `production_builder_general_jobs_p0_01_rls.sql` | P0-01 RLS（applications 4 + 関連テーブル） | — |

| **5** | `production_builder_general_jobs_p3_delete_rls.sql` | P3 withdraw DELETE policy | — |

| **6** | `production_partner_seed_template.sql` | **テンプレートのみ** · 実データを人間が記入して別実行 | demo seed **禁止** |

| **7** | `production_builder_general_jobs_postflight.sql` | 読取のみ · RLS 5 件・demo キー 0 件確認 | 常に実行 |



### Staging 正本（Production では実行しない）



| ファイル | 用途 |

| --- | --- |

| `supabase/manual/staging_builder_general_jobs_rl01_staging_apply_bundle.sql` | Staging 一括 |

| `supabase/manual/staging_builder_general_jobs_p0_01_rls.sql` | Staging RLS 正本 |

| `supabase/manual/staging_builder_general_jobs_p3_rls.sql` | Staging withdraw RLS |

| `supabase/manual/staging_builder_partners_p0_05_seed.sql` | **Staging demo seed のみ** |



### Production 専用ファイル一覧（正本）



```text

supabase/manual/production_builder_general_jobs_preflight.sql

supabase/manual/production_builder_calendar_projects_ddl.sql

supabase/manual/production_builder_calendar_rls.sql

supabase/manual/production_builder_general_jobs_p0_01_ddl.sql

supabase/manual/production_builder_general_jobs_p0_01_rls.sql

supabase/manual/production_builder_general_jobs_p3_delete_rls.sql

supabase/manual/production_builder_general_jobs_postflight.sql

supabase/manual/production_partner_seed_template.sql

```



---



## 3. Step D — アプリ接続（DB 適用後 · DevOps）



1. Cloudflare Production env（`docs/builder-general-jobs-production-flags.md`）

2. `TASU_BUILDER_*` ビルド注入 — **Phase 2 実装済み**（`stage-cloudflare-pages.mjs` · Dashboard 設定は人間）

3. `npm run build:pages` → deploy（人間）

4. Smoke（読取のみから段階的に write 有効化）



---



## 4. ロールバック



| 段階 | 操作 | ファイル |

| --- | --- | --- |

| アプリのみ | `TASU_BUILDER_GENERAL_JOBS_REPO=false` · `TASU_BUILDER_STORAGE_MODE=local` で MVP fallback | `docs/builder-general-jobs-production-flags.md` §5 |

| P3 DELETE | DELETE policy DROP | `production_builder_general_jobs_p3_delete_rls_rollback.sql` |

| P0-01 RLS | applications / partners / workers / contact_reveals policy DROP | `production_builder_general_jobs_p0_01_rls_rollback.sql` |

| Calendar RLS | builder_projects Calendar policy DROP（影響確認後） | `production_builder_calendar_rls_rollback.sql` |

| DDL | **ロールバックしない** | forward fix を優先 |



**推奨ロールバック順（RLS のみ）:** P3 DELETE → P0-01 RLS →（必要時のみ）Calendar RLS



---



## 5. 適用後検証



```bash

# Staging で最終確認済みの同一スクリプト（本番接続前は Staging で再確認可）

node scripts/test-builder-general-jobs-rl02-staging-live-e2e.mjs

node scripts/test-builder-general-jobs-launch-smoke.mjs

```



Dashboard（`production_builder_general_jobs_postflight.sql`）:



- `builder_project_applications` policies **5 件**（DELETE 含む）

- `partner_key like 'demo-%'` が **0 行**



手動確認（`tasful.jp` · Phase 3）:



- 投稿 → 応募 → 選定 → `chat-detail.html?thread={UUID}`

- 却下 → Talk Room なし

- 取り下げ → オーナー/パートナーに幽霊応募なし



---



## 6. 担当分離



| 役割 | 作業 |

| --- | --- |

| DB 管理者 | Dashboard SQL · Production 専用ファイル適用 |

| DevOps | Cloudflare env · deploy（Phase 2） |

| QA | launch-smoke · RL-02 証跡 · JWT 実地 |

| Product | RL-09 入口 · RL-10 課金スコープ · Go 承認 |



---



## 7. 関連ドキュメント



| ドキュメント | 内容 |

| --- | --- |

| `reports/builder-general-jobs-production-ready-final.md` | Production Ready チェックリスト |

| `docs/builder-general-jobs-production-freeze-oct2026.md` | **10月リリースまで凍結正本** |

| `reports/builder-general-jobs-october-release-checklist.md` | **10月リリース実行チェックリスト** |

| `docs/builder-general-jobs-production-flags.md` | RL-04 フラグ |

| `docs/builder-general-jobs-jwt-actor.md` | RL-03 JWT 実地 |

| `docs/supabase-environments.md` | Staging / Production 環境分離 |

