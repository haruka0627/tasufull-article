-- TASFUL TALK — Push Phase7.1（subscription status / retry flag）
-- 前提: talk-call-push-schema.sql 適用済み

-- subscription: active / inactive（410/404 cleanup）
alter table public.talk_push_subscriptions
  add column if not exists status text not null default 'active';

alter table public.talk_push_subscriptions
  drop constraint if exists talk_push_subscriptions_status_check;

alter table public.talk_push_subscriptions
  add constraint talk_push_subscriptions_status_check
  check (status in ('active', 'inactive'));

create index if not exists talk_push_subscriptions_user_active_idx
  on public.talk_push_subscriptions (user_id, status);

-- push event: failed 時のみ retry 対象フラグ
alter table public.talk_call_push_events
  add column if not exists retry_eligible boolean not null default false;

comment on column public.talk_push_subscriptions.status is 'active=配信対象, inactive=410/404等で無効化';
comment on column public.talk_call_push_events.retry_eligible is 'failed 時のみ true — sent/skipped は再送しない';
