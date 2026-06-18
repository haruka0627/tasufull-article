-- 生成AI 付加 entitlement（2D Live 無制限サブスク等）— 冪等
create table if not exists public.gen_ai_entitlements (
  user_id text not null,
  entitlement_type text not null,
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement_type)
);

alter table public.gen_ai_entitlements add column if not exists status text not null default 'inactive';
alter table public.gen_ai_entitlements add column if not exists stripe_customer_id text;
alter table public.gen_ai_entitlements add column if not exists stripe_subscription_id text;
alter table public.gen_ai_entitlements add column if not exists stripe_price_id text;
alter table public.gen_ai_entitlements add column if not exists subscription_status text;
alter table public.gen_ai_entitlements add column if not exists cancel_at_period_end boolean not null default false;
alter table public.gen_ai_entitlements add column if not exists current_period_end timestamptz;
alter table public.gen_ai_entitlements add column if not exists canceled_at timestamptz;
alter table public.gen_ai_entitlements add column if not exists created_at timestamptz not null default now();
alter table public.gen_ai_entitlements add column if not exists updated_at timestamptz not null default now();

create index if not exists gen_ai_entitlements_status_idx
  on public.gen_ai_entitlements (entitlement_type, status);

create index if not exists gen_ai_entitlements_user_idx
  on public.gen_ai_entitlements (user_id);

comment on table public.gen_ai_entitlements is 'TASFUL 生成AI 付加権利（2D Live 無制限等・Edge Function が service_role で更新）';

alter table public.gen_ai_entitlements enable row level security;

-- 匿名からの直接アクセス不可（Edge Function = service_role のみ）
drop policy if exists "gen_ai_entitlements_deny_anon" on public.gen_ai_entitlements;
create policy "gen_ai_entitlements_deny_anon"
  on public.gen_ai_entitlements
  for all
  to anon, authenticated
  using (false)
  with check (false);
