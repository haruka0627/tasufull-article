# Builder Calendar P3.8 — Staging 実データ Read 検証レポート

> 検証日: 2026-07-04
> 対象: Staging Supabase `ahlxuyvhzqdqaojiywmu`
> Production 復元確認済み

---

## 1. 検証結果サマリ

| 項目 | 結果 |
|------|------|
| Staging migration 適用 | ✅ 成功（20260717130000 の CREATE TABLE + DO $$ カラム追加 + INDEX） |
| Staging seed 投入 | ✅ 成功（CAL-DEMO-001〜003 の3件） |
| RLS 一時ポリシー | ✅ 適用済み（anon + authenticated の SELECT policy） |
| Mapper 整合性 | ✅ DDL カラムと完全一致（33カラム） |
| Staging 実データ read | ✅ **mode=supabase, 3件取得** |
| Demo fallback | ✅ 強制失敗時に demo_fallback として動作確認 |
| Production config 復元 | ✅ chat-supabase-config.js を Production に戻し `dist` 再ビルド |

## 2. 全回帰テスト結果（Production config 復元後）

| テスト | PASS | 結果 |
|--------|------|------|
| test-builder-calendar-p3-supabase.mjs | **79/79** (Production) / 80/80 (Staging) | ✅ ALL PASS |
| test-builder-calendar-p2-talk.mjs | **44/44** | ✅ ALL PASS |
| test-builder-calendar-p1-detail.mjs | **45/45** | ✅ ALL PASS |
| test-builder-calendar-phase2.mjs | **48/48** | ✅ ALL PASS |
| test-builder-calendar-phase3.mjs | **36/36** | ✅ ALL PASS |
| **合計** | **252/252** | ✅ **ALL PASS** |

## 3. 変更ファイル一覧

| ファイル | 種別 | 内容 |
|----------|------|------|
| `chat-supabase-config.js` | 一時変更 → 復元 | Staging 検証用に切り替え後、Production に復元 |
| `chat-supabase-config.js.production-backup` | 一時ファイル | 存在確認済み（削除可能） |
| `builder/builder-calendar-p3.8-staging-apply-sql.sql` | 新規 | Staging 適用 SQL（migration + seed + 確認SELECT） |
| `builder/builder-calendar-p3.8-temp-rls-policy.sql` | 新規 | 一時 RLS ポリシー（検証後は削除推奨） |
| `builder/builder-calendar-p3.8-staging-read-verification.md` | 新規 | 本レポート |

## 4. 発見された課題と対応

| # | 課題 | Severity | 対応 |
|---|------|----------|------|
| 1 | Staging の `builder_projects` テーブルに RLS が有効で、anon が SELECT できない | **P2** | 一時 SELECT policy を作成して解決。P4 で本格的な RLS 方針を策定 |
| 2 | Staging 検証時、P2 Talk テストが 5件 FAIL（demo 案件 ID が存在しないため） | **P1（一時的）** | Staging データには demo ID が無いため。Production 復元後は ALL PASS 確認済み |
| 3 | `chat-supabase-config.js` が Production 固定。Staging 検証のたびに手動変更が必要 | **P3** | 環境切り替え機能を P4 以降で検討 |

## 5. Staging 適用した構成

| リソース | 状態 |
|----------|------|
| `public.builder_projects` テーブル | ✅ 33カラム（既存DDL + Calendar 拡張15カラム） |
| INDEX 6本 | ✅ 既存2 + Calendar用4 |
| RLS | ✅ 有効（一時 SELECT policy 追加済み） |
| シードデータ | ✅ CAL-DEMO-001〜003（3件） |
| migration ファイル | `supabase/migrations/20260717130000_builder_calendar_projects_read.sql` |

## 6. P4 へ進むための判定

### ✅ Staging 実データ Read 確認完了

Builder Calendar は Staging Supabase の `builder_projects` テーブルから実データを正常に read できることを確認した。

### P4 着手前に必要な作業

1. **一時 RLS ポリシーの後片付け**（検証完了後）:
   ```sql
   DROP POLICY IF EXISTS "builder_projects_select_anon_p38" ON public.builder_projects;
   DROP POLICY IF EXISTS "builder_projects_select_auth_p38" ON public.builder_projects;
   ```

2. `chat-supabase-config.js.production-backup` の削除（任意）

3. P4 で実装予定:
   - Supabase Write（INSERT / UPDATE）
   - completion_report / attachments / site_photos の jsonb スキーマ確定
   - customerContact / managerPhone の分離
   - talkRoomId / talkThreadId の分離
   - RLS 本格導入