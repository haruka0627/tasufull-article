-- TALK 通話 Push — 本番 RLS（talk-call-push-schema.sql 適用後）
-- 前提: talk-rls-production.sql の talk_current_user_id() / talk_is_admin()

-- ---------------------------------------------------------------------------
-- talk_call_push_events
-- ---------------------------------------------------------------------------
alter table public.talk_call_push_events enable row level security;

drop policy if exists "talk_call_push_events_select_dev" on public.talk_call_push_events;
drop policy if exists "talk_call_push_events_insert_dev" on public.talk_call_push_events;
drop policy if exists "talk_call_push_events_update_dev" on public.talk_call_push_events;

drop policy if exists "talk_call_push_events_select_callee" on public.talk_call_push_events;
drop policy if exists "talk_call_push_events_insert_caller" on public.talk_call_push_events;
drop policy if exists "talk_call_push_events_update_participant" on public.talk_call_push_events;

-- callee のみ閲覧（admin 除く）。caller 可読は Phase7 で廃止。
create policy "talk_call_push_events_select_callee"
  on public.talk_call_push_events for select to authenticated
  using (
    public.talk_is_admin()
    or callee_user_id = public.talk_current_user_id()
  );

-- 発信者（caller）のみ ringing セッションに対して enqueue 可
create policy "talk_call_push_events_insert_caller"
  on public.talk_call_push_events for insert to authenticated
  with check (
    caller_user_id = public.talk_current_user_id()
    and exists (
      select 1 from public.talk_call_sessions s
      where s.id = call_id
        and s.caller_id = public.talk_current_user_id()
        and s.callee_id = callee_user_id
        and s.status = 'ringing'
        and s.room_id = room_id
    )
  );

-- cancel: 参加者（caller / callee）のみ pending を cancelled へ
create policy "talk_call_push_events_update_participant"
  on public.talk_call_push_events for update to authenticated
  using (
    public.talk_is_admin()
    or callee_user_id = public.talk_current_user_id()
    or caller_user_id = public.talk_current_user_id()
  )
  with check (
    public.talk_is_admin()
    or callee_user_id = public.talk_current_user_id()
    or caller_user_id = public.talk_current_user_id()
  );

-- ---------------------------------------------------------------------------
-- talk_push_subscriptions — 本人のみ
-- ---------------------------------------------------------------------------
alter table public.talk_push_subscriptions enable row level security;

drop policy if exists "talk_push_subscriptions_select_dev" on public.talk_push_subscriptions;
drop policy if exists "talk_push_subscriptions_insert_dev" on public.talk_push_subscriptions;
drop policy if exists "talk_push_subscriptions_update_dev" on public.talk_push_subscriptions;
drop policy if exists "talk_push_subscriptions_delete_dev" on public.talk_push_subscriptions;

drop policy if exists "talk_push_subscriptions_own" on public.talk_push_subscriptions;

create policy "talk_push_subscriptions_own"
  on public.talk_push_subscriptions for all to authenticated
  using (
    public.talk_is_admin()
    or user_id = public.talk_current_user_id()
  )
  with check (
    public.talk_is_admin()
    or user_id = public.talk_current_user_id()
  );
