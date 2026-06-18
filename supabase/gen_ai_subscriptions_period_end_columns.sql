-- 解約予約・期間末まで有料維持用カラム
alter table public.gen_ai_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.gen_ai_subscriptions
  add column if not exists canceled_at timestamptz;

alter table public.gen_ai_subscriptions
  add column if not exists subscription_status text;

comment on column public.gen_ai_subscriptions.cancel_at_period_end is 'Stripe cancel_at_period_end（期間末解約予約）';
comment on column public.gen_ai_subscriptions.canceled_at is 'Stripe subscription.canceled_at';
comment on column public.gen_ai_subscriptions.subscription_status is 'Stripe subscription.status（active / canceled 等）';

-- 既存行: status を subscription_status へバックフィル
update public.gen_ai_subscriptions
set subscription_status = coalesce(subscription_status, status)
where subscription_status is null
  and status is not null;
