-- TASFUL TALK — WebRTC 1対1音声通話（Phase1 MVP）
-- 実行後: sql/talk-call-realtime-publication.sql

-- ---------------------------------------------------------------------------
-- talk_call_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.talk_call_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  caller_id text not null,
  callee_id text not null,
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'ended', 'missed', 'rejected', 'busy')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists talk_call_sessions_callee_status_idx
  on public.talk_call_sessions (callee_id, status);

create index if not exists talk_call_sessions_caller_status_idx
  on public.talk_call_sessions (caller_id, status);

create index if not exists talk_call_sessions_room_created_idx
  on public.talk_call_sessions (room_id, created_at desc);

comment on table public.talk_call_sessions is 'TALK WebRTC 1:1 通話セッション（Phase1）';

-- ---------------------------------------------------------------------------
-- talk_call_signals
-- ---------------------------------------------------------------------------
create table if not exists public.talk_call_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.talk_call_sessions (id) on delete cascade,
  sender_id text not null,
  signal_type text not null
    check (signal_type in ('offer', 'answer', 'candidate', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists talk_call_signals_session_created_idx
  on public.talk_call_signals (session_id, created_at);

comment on table public.talk_call_signals is 'TALK WebRTC シグナリング（SDP / ICE / hangup）';

-- ---------------------------------------------------------------------------
-- RLS 開発用（本番は talk-call-rls-production.sql + drop dev）
-- ---------------------------------------------------------------------------
alter table public.talk_call_sessions enable row level security;
alter table public.talk_call_signals enable row level security;

drop policy if exists "talk_call_sessions_select_dev" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_insert_dev" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_update_dev" on public.talk_call_sessions;
drop policy if exists "talk_call_sessions_delete_dev" on public.talk_call_sessions;

create policy "talk_call_sessions_select_dev"
  on public.talk_call_sessions for select to anon, authenticated
  using (true);

create policy "talk_call_sessions_insert_dev"
  on public.talk_call_sessions for insert to anon, authenticated
  with check (true);

create policy "talk_call_sessions_update_dev"
  on public.talk_call_sessions for update to anon, authenticated
  using (true) with check (true);

create policy "talk_call_sessions_delete_dev"
  on public.talk_call_sessions for delete to anon, authenticated
  using (true);

drop policy if exists "talk_call_signals_select_dev" on public.talk_call_signals;
drop policy if exists "talk_call_signals_insert_dev" on public.talk_call_signals;
drop policy if exists "talk_call_signals_update_dev" on public.talk_call_signals;
drop policy if exists "talk_call_signals_delete_dev" on public.talk_call_signals;

create policy "talk_call_signals_select_dev"
  on public.talk_call_signals for select to anon, authenticated
  using (true);

create policy "talk_call_signals_insert_dev"
  on public.talk_call_signals for insert to anon, authenticated
  with check (true);

create policy "talk_call_signals_update_dev"
  on public.talk_call_signals for update to anon, authenticated
  using (true) with check (true);

create policy "talk_call_signals_delete_dev"
  on public.talk_call_signals for delete to anon, authenticated
  using (true);
