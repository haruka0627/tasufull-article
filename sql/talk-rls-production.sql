-- TASFUL TALK — 本番 RLS（JWT talk_user_id / tasu_admin）
-- 適用順:
--   1) talk-sync-schema.sql / talk-follow-subscriptions.sql（未適用なら）
--   2) 本ファイル
--   3) sql/talk-rls-drop-dev-policies.sql（必須）

-- ---------------------------------------------------------------------------
-- ヘルパー
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

-- ---------------------------------------------------------------------------
-- talk_notifications — 本人のみ read/write、管理者は fanout insert のみ
-- ---------------------------------------------------------------------------
alter table public.talk_notifications enable row level security;

drop policy if exists "talk_notifications_select_own" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_own" on public.talk_notifications;
drop policy if exists "talk_notifications_update_own" on public.talk_notifications;
drop policy if exists "talk_notifications_delete_own" on public.talk_notifications;
drop policy if exists "talk_notifications_insert_admin_fanout" on public.talk_notifications;

create policy "talk_notifications_select_own"
  on public.talk_notifications for select to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_notifications_insert_own"
  on public.talk_notifications for insert to authenticated
  with check (user_id = public.talk_current_user_id());

create policy "talk_notifications_update_own"
  on public.talk_notifications for update to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id())
  with check (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_notifications_delete_own"
  on public.talk_notifications for delete to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_notifications_insert_admin_fanout"
  on public.talk_notifications for insert to authenticated
  with check (public.talk_is_admin());

-- ---------------------------------------------------------------------------
-- talk_ai_drafts — 本人のみ（管理者は閲覧のみ可）
-- ---------------------------------------------------------------------------
alter table public.talk_ai_drafts enable row level security;

drop policy if exists "talk_ai_drafts_select_own" on public.talk_ai_drafts;
drop policy if exists "talk_ai_drafts_insert_own" on public.talk_ai_drafts;
drop policy if exists "talk_ai_drafts_update_own" on public.talk_ai_drafts;
drop policy if exists "talk_ai_drafts_delete_own" on public.talk_ai_drafts;

create policy "talk_ai_drafts_select_own"
  on public.talk_ai_drafts for select to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_ai_drafts_insert_own"
  on public.talk_ai_drafts for insert to authenticated
  with check (user_id = public.talk_current_user_id());

create policy "talk_ai_drafts_update_own"
  on public.talk_ai_drafts for update to authenticated
  using (user_id = public.talk_current_user_id())
  with check (user_id = public.talk_current_user_id());

create policy "talk_ai_drafts_delete_own"
  on public.talk_ai_drafts for delete to authenticated
  using (user_id = public.talk_current_user_id());

-- ---------------------------------------------------------------------------
-- talk_broadcast_drafts — 本人 read/write、管理者は read/update（配信 API 用）
-- ---------------------------------------------------------------------------
alter table public.talk_broadcast_drafts enable row level security;

drop policy if exists "talk_broadcast_drafts_select_own" on public.talk_broadcast_drafts;
drop policy if exists "talk_broadcast_drafts_insert_own" on public.talk_broadcast_drafts;
drop policy if exists "talk_broadcast_drafts_update_own" on public.talk_broadcast_drafts;
drop policy if exists "talk_broadcast_drafts_delete_own" on public.talk_broadcast_drafts;

create policy "talk_broadcast_drafts_select_own"
  on public.talk_broadcast_drafts for select to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_broadcast_drafts_insert_own"
  on public.talk_broadcast_drafts for insert to authenticated
  with check (user_id = public.talk_current_user_id());

create policy "talk_broadcast_drafts_update_own"
  on public.talk_broadcast_drafts for update to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id())
  with check (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_broadcast_drafts_delete_own"
  on public.talk_broadcast_drafts for delete to authenticated
  using (user_id = public.talk_current_user_id());

-- ---------------------------------------------------------------------------
-- talk_follow_subscriptions — 本人のみ
-- ---------------------------------------------------------------------------
alter table public.talk_follow_subscriptions enable row level security;

drop policy if exists "talk_follow_subscriptions_select_own" on public.talk_follow_subscriptions;
drop policy if exists "talk_follow_subscriptions_insert_own" on public.talk_follow_subscriptions;
drop policy if exists "talk_follow_subscriptions_update_own" on public.talk_follow_subscriptions;
drop policy if exists "talk_follow_subscriptions_delete_own" on public.talk_follow_subscriptions;

create policy "talk_follow_subscriptions_select_own"
  on public.talk_follow_subscriptions for select to authenticated
  using (public.talk_is_admin() or user_id = public.talk_current_user_id());

create policy "talk_follow_subscriptions_insert_own"
  on public.talk_follow_subscriptions for insert to authenticated
  with check (user_id = public.talk_current_user_id());

create policy "talk_follow_subscriptions_update_own"
  on public.talk_follow_subscriptions for update to authenticated
  using (user_id = public.talk_current_user_id())
  with check (user_id = public.talk_current_user_id());

create policy "talk_follow_subscriptions_delete_own"
  on public.talk_follow_subscriptions for delete to authenticated
  using (user_id = public.talk_current_user_id());
