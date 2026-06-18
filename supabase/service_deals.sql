-- 業務サービス取引（TASFULはマッチング管理。代金は当事者間）
create table if not exists public.service_deals (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  listing_type text not null default 'business',
  client_user_id text not null,
  provider_user_id text not null,
  chat_id uuid references public.transaction_rooms (id) on delete set null,
  status text not null default 'consulting',
  agreed_amount integer,
  platform_fee_rate numeric(5, 4) not null default 0.0500,
  platform_fee_amount integer,
  payment_method_snapshot jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  fee_paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_deals_status_check check (
    status in (
      'consulting',
      'agreed',
      'payment_pending',
      'completed',
      'fee_pending',
      'fee_paid',
      'cancelled'
    )
  )
);

create index if not exists service_deals_service_id_idx
  on public.service_deals (service_id, created_at desc);

create index if not exists service_deals_chat_id_idx
  on public.service_deals (chat_id);

create index if not exists service_deals_provider_status_idx
  on public.service_deals (provider_user_id, status);

alter table public.transaction_rooms
  add column if not exists service_deal_id uuid references public.service_deals (id) on delete set null;

comment on table public.service_deals is '業務サービス取引。決済は掲載者↔依頼者。TASFUL手数料は fee_paid 時に別途。';
