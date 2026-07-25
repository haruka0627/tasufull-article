-- ============================================================
-- Builder General Jobs — Production 適用後確認（読取のみ）
--
-- 対象: Production Supabase — P0-01 RLS + P3 DELETE 適用後
-- 操作: SELECT のみ
-- ============================================================

-- 1. builder_project_applications RLS — 期待 5 件（DELETE 含む）
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'builder_project_applications'
order by policyname;

-- 期待 policy 名:
--   builder_applications_select_applicant   (SELECT)
--   builder_applications_select_owner       (SELECT)
--   builder_applications_insert_auth        (INSERT)
--   builder_applications_update_owner       (UPDATE)
--   builder_applications_delete_applicant_applied (DELETE)

-- 2. 一般案件 public 閲覧 policy
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'builder_projects'
  and policyname = 'builder_projects_select_general_public';

-- 3. partners / workers / contact_reveals RLS 有効化
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and relname in (
    'builder_project_applications',
    'builder_partners',
    'builder_workers',
    'builder_contact_reveals'
  )
order by relname;

-- 4. demo キー未投入確認（0 行が正常）
select partner_key, display_name
from public.builder_partners
where partner_key like 'demo-%'
   or partner_key like 'demo-partner%'
order by partner_key;
