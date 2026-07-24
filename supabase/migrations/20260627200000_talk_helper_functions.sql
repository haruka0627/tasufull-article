-- TALK ヘルパー関数: talk_current_user_id / talk_is_admin
-- 正本: sql/talk-rls-production.sql L10-L46
-- 前提: なし（auth.jwt() に依存するが、関数作成自体は独立）
-- 位置: 20260627190000_tlv_schema.sql の後
--       20260628100000_live_p0_schema.sql の前
-- 冪等: create or replace function

-- ---------------------------------------------------------------------------
-- talk_current_user_id — JWT talk_user_id / member_id / sub / uid フォールバック
-- ---------------------------------------------------------------------------
create or replace function public.talk_current_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    trim(
      coalesce(
        auth.jwt() ->> 'talk_user_id',
        auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
        auth.jwt() -> 'user_metadata' ->> 'talk_user_id',
        auth.jwt() ->> 'member_id',
        auth.jwt() -> 'app_metadata' ->> 'member_id',
        auth.jwt() ->> 'sub',
        auth.uid()::text
      )
    ),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- talk_is_admin — tasu_admin / service_role / supabase_admin 判定
-- ---------------------------------------------------------------------------
create or replace function public.talk_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') in ('tasu_admin', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() ->> 'tasu_admin', '') = 'true'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'tasu_admin', '') = 'true';
$$;