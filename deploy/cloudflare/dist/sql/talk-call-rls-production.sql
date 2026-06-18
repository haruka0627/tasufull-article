-- TALK WebRTC 通話 — 本番 RLS（talk-call-schema.sql 適用後）
-- 前提: talk-rls-production.sql の talk_current_user_id() / talk_is_admin()

-- ---------------------------------------------------------------------------
-- talk_call_sessions
-- ---------------------------------------------------------------------------
alter table public.talk_call_sessions enable row level security;

drop policy if exists "talk_call_sessions_select_dev" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_insert_dev" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_update_dev" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_delete_dev" on public.talk_call_sessions;

drop policy if exists "talk_call_sessions_select_participant" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_insert_caller" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_update_participant" on public.talk_call_sessions;

create policy "talk_call_sessions_select_participant"
  on public.talk_call_sessions for select to authenticated
  using (
    public.talk_is_admin()
    or caller_id = public.talk_current_user_id()
    or callee_id = public.talk_current_user_id()
  );

create policy "talk_call_sessions_insert_caller"
  on public.talk_call_sessions for insert to authenticated
  with check (caller_id = public.talk_current_user_id());

create policy "talk_call_sessions_update_participant"
  on public.talk_call_sessions for update to authenticated
  using (
    public.talk_is_admin()
    or caller_id = public.talk_current_user_id()
    or callee_id = public.talk_current_user_id()
  )
  with check (
    public.talk_is_admin()
    or caller_id = public.talk_current_user_id()
    or callee_id = public.talk_current_user_id()
  );

-- ---------------------------------------------------------------------------
-- talk_call_signals — セッション参加者のみ
-- ---------------------------------------------------------------------------
alter table public.talk_call_signals enable row level security;

drop policy if exists "talk_call_signals_select_dev" on public.talk_call_signals;
drop policy if exists "talk_call_signals_insert_dev" on public.talk_call_signals;
drop policy if exists "talk_call_signals_update_dev" on public.talk_call_signals;
drop policy if exists "talk_call_signals_delete_dev" on public.talk_call_signals;

drop policy if exists "talk_call_signals_select_participant" on public.talk_call_signals;
drop policy if exists "talk_call_signals_insert_participant" on public.talk_call_signals;

create policy "talk_call_signals_select_participant"
  on public.talk_call_signals for select to authenticated
  using (
    public.talk_is_admin()
    or exists (
      select 1 from public.talk_call_sessions s
      where s.id = session_id
        and (
          s.caller_id = public.talk_current_user_id()
          or s.callee_id = public.talk_current_user_id()
        )
    )
  );

create policy "talk_call_signals_insert_participant"
  on public.talk_call_signals for insert to authenticated
  with check (
    sender_id = public.talk_current_user_id()
    and exists (
      select 1 from public.talk_call_sessions s
      where s.id = session_id
        and (
          s.caller_id = public.talk_current_user_id()
          or s.callee_id = public.talk_current_user_id()
        )
    )
  );
