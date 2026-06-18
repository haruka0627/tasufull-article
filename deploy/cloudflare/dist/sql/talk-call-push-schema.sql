-- TASFUL TALK — 通話 Push 着信イベント（Phase6 土台）
-- 前提: sql/talk-call-schema.sql 適用済み
-- 本番 RLS: sql/talk-call-push-rls-production.sql

-- ---------------------------------------------------------------------------
-- talk_call_push_events — ringing 時の callee 向け Push キュー
-- ---------------------------------------------------------------------------
create table if not exists public.talk_call_push_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.talk_call_sessions (id) on delete cascade,
  callee_user_id text not null,
  caller_user_id text not null,
  room_id text not null,
  event_type text not null default 'talk_call_incoming'
    check (event_type = 'talk_call_incoming'),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'skipped', 'cancelled', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  target_url text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  constraint talk_call_push_events_call_callee_unique unique (call_id, callee_user_id)
);

create index if not exists talk_call_push_events_callee_pending_idx
  on public.talk_call_push_events (callee_user_id, delivery_status, created_at desc);

create index if not exists talk_call_push_events_call_id_idx
  on public.talk_call_push_events (call_id);

comment on table public.talk_call_push_events is 'TALK 通話着信 Web Push イベント（Phase6）— ringing 作成時のみ';

-- ---------------------------------------------------------------------------
-- talk_push_subscriptions — Web Push 購読（Phase6 土台・送信は別フェーズ）
-- ---------------------------------------------------------------------------
create table if not exists public.talk_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint talk_push_subscriptions_user_endpoint_unique unique (user_id, endpoint)
);

create index if not exists talk_push_subscriptions_user_id_idx
  on public.talk_push_subscriptions (user_id);

comment on table public.talk_push_subscriptions is 'TALK Web Push 購読（endpoint 鍵のみ・本番 VAPID は未投入）';

-- ---------------------------------------------------------------------------
-- RLS 開発用
-- ---------------------------------------------------------------------------
alter table public.talk_call_push_events enable row level security;
alter table public.talk_push_subscriptions enable row level security;

drop policy if exists "talk_call_push_events_select_dev" on public.talk_call_push_events;
drop policy if exists "talk_call_push_events_insert_dev" on public.talk_call_push_events;
drop policy if exists "talk_call_push_events_update_dev" on public.talk_call_push_events;

create policy "talk_call_push_events_select_dev"
  on public.talk_call_push_events for select to anon, authenticated
  using (true);

create policy "talk_call_push_events_insert_dev"
  on public.talk_call_push_events for insert to anon, authenticated
  with check (true);

create policy "talk_call_push_events_update_dev"
  on public.talk_call_push_events for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "talk_push_subscriptions_select_dev" on public.talk_push_subscriptions;
drop policy if exists "talk_push_subscriptions_insert_dev" on public.talk_push_subscriptions;
drop policy if exists "talk_push_subscriptions_update_dev" on public.talk_push_subscriptions;
drop policy if exists "talk_push_subscriptions_delete_dev" on public.talk_push_subscriptions;

create policy "talk_push_subscriptions_select_dev"
  on public.talk_push_subscriptions for select to anon, authenticated
  using (true);

create policy "talk_push_subscriptions_insert_dev"
  on public.talk_push_subscriptions for insert to anon, authenticated
  with check (true);

create policy "talk_push_subscriptions_update_dev"
  on public.talk_push_subscriptions for update to anon, authenticated
  using (true) with check (true);

create policy "talk_push_subscriptions_delete_dev"
  on public.talk_push_subscriptions for delete to anon, authenticated
  using (true);
