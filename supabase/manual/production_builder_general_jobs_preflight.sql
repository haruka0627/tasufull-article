-- ============================================================
-- Builder General Jobs — Production 適用前確認（読取のみ）
--
-- 対象: Production Supabase（人間が Dashboard で ref を確認してから実行）
-- 操作: SELECT のみ · DDL/RLS/seed は実行しない
--
-- 実行タイミング: Phase 1 Step 1（RL-05）の最初
-- 禁止: Supabase MCP · CLI migration push · 自動適用
-- ============================================================

-- 1. builder_projects 基盤
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'builder_projects'
) as has_builder_projects;

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'builder_projects' and column_name = 'spec'
) as has_spec_column;

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'builder_projects' and column_name = 'talk_room_id'
) as has_calendar_talk_room_id;

-- 2. 一般案件テーブル（未作成なら DDL 適用が必要）
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'builder_project_applications'
) as has_builder_project_applications;

select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'builder_partners'
) as has_builder_partners;

-- 3. 既存 RLS（適用済みかの目安 · 人間が解釈）
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'builder_project_applications'
order by policyname;

-- 期待（P0-01 + P3 適用後）: builder_project_applications に 5 policies（DELETE 含む）
-- 適用前は 0 行または 4 行（P3 未適用）のいずれか

-- 4. builder_projects 既存 Calendar RLS
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'builder_projects'
order by policyname;
