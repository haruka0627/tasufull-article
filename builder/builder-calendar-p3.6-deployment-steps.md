# Builder Calendar P3.6 — Staging 適用手順メモ

> **本番DBには絶対に適用しないこと。**
> この手順は Staging (`ahlxuyvhzqdqaojiywmu`) での実データ read 検証用。

---

## 前提

- Supabase Dashboard にアクセス可能
- Staging プロジェクト `ahlxuyvhzqdqaojiywmu` の SQL Editor を使用
- Supabase CLI push は禁止（手動適用のみ）

---

## 手順

### Step 1: migration 適用

1. Supabase Dashboard → Staging → SQL Editor
2. `supabase/migrations/20260717130000_builder_calendar_projects_read.sql` を開く
3. 内容を確認（特に `DO $$` ブロックのカラム追加が冪等であること）
4. **Run** をクリック
5. エラーがないことを確認

### Step 2: テーブル確認

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='builder_projects'
ORDER BY ordinal_position;
```

期待: 全カラム（既存DDL + Calendar拡張）が表示される

### Step 3: seed データ投入

1. `supabase/builder-calendar-p3.5-demo-seed.sql` を SQL Editor に貼り付け
2. **Run** をクリック
3. 3行 INSERT されることを確認

### Step 4: データ確認

```sql
SELECT id, project_key, title, status, schedule_start, schedule_end
FROM public.builder_projects
WHERE project_key LIKE 'CAL-DEMO-%'
ORDER BY schedule_start;
```

期待: 3件の案件が表示される

### Step 5: ローカル検証

```bash
npm run dev
# http://127.0.0.1:8788/builder/project-calendar.html
```

- Store が `supabase` mode になることを確認
- 3件の案件がカレンダーに表示されることを確認
- 各案件の詳細（住所/担当者/電話/Talk/添付/写真/完了報告）が正しく表示されることを確認

### Step 6: 回帰テスト

```bash
node scripts/test-builder-calendar-p3-supabase.mjs
node scripts/test-builder-calendar-p2-talk.mjs
node scripts/test-builder-calendar-p1-detail.mjs
node scripts/test-builder-calendar-phase2.mjs
node scripts/test-builder-calendar-phase3.mjs
```

全テスト PASS を確認。

---

## ロールバック手順

万が一問題が発生した場合:

```sql
-- カラム追加のロールバック（DROP COLUMN は IF EXISTS 非対応のため注意）
-- 実際に実行する前に影響範囲を確認すること
-- ALTER TABLE public.builder_projects DROP COLUMN IF EXISTS customer_name;
-- ... 各カラムを個別に DROP

-- テーブルごと削除（データも消える）
-- DROP TABLE IF EXISTS public.builder_projects CASCADE;
```

---

## 注意点

| # | 注意点 | 対策 |
|---|--------|------|
| 1 | `DO $$` ブロック内の `information_schema` クエリは権限が必要 | Supabase Dashboard の SQL Editor は十分な権限を持つ |
| 2 | `jsonb` カラムの初期値は NULL | seed データで明示的に jsonb 値を指定 |
| 3 | RLS 未設定のため全ユーザーが全件 SELECT 可能 | 検証段階では許容。本番投入前に RLS を設定 |
| 4 | 既存 `builder_projects` にデータがある場合、新カラムは NULL | 既存データには影響なし |
| 5 | `kind` の CHECK 制約 (`builder_board` / `tasful_managed`) | seed は `builder_board` を使用 |