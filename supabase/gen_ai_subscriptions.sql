-- 生成AI サブスクリプション（Stripe 連携・将来の複数端末同期用）
create table if not exists public.gen_ai_subscriptions (
  user_id text primary key,
  plan_code text not null default 'free',
  daily_text_limit integer not null default 5 check (daily_text_limit >= 0),
  daily_voice_limit integer not null default 5 check (daily_voice_limit >= 0),
  daily_image_limit integer not null default 3 check (daily_image_limit >= 0),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text not null default 'active',
  subscription_status text,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gen_ai_subscriptions_status_idx
  on public.gen_ai_subscriptions (status);

comment on table public.gen_ai_subscriptions is 'TASFUL 生成AI Stripe サブスクプラン（Edge Function が service_role で更新）';

alter table public.gen_ai_subscriptions enable row level security;

-- 匿名クライアントからの直接読み書きは不可（Edge Function 経由のみ）
