-- 安否ユーザーコンテキスト（P9-1）
-- SQL Editor で実行してください。

create table if not exists public.anpi_user_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  contract_holder_id text not null default '',
  contract_holder_name text not null default '',
  user_name text not null default '',
  notification_level text not null default 'call_only',
  notification_method text not null default 'tasful_chat',
  notify_channels jsonb not null default '["tasful_chat"]'::jsonb,
  line_notification_enabled boolean not null default false,
  line_user_id text,
  line_linked_at timestamptz,
  line_user_id_enc text,
  line_oauth_access_token_enc text,
  line_oauth_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint anpi_user_contexts_user_id_unique unique (user_id)
);

comment on table public.anpi_user_contexts is '安否（Anpi）ユーザー設定・LINE連携コンテキスト';
comment on column public.anpi_user_contexts.user_id is 'TASFUL 利用者 ID（localStorage の user_id と一致）';
comment on column public.anpi_user_contexts.notification_method is '契約者連絡手段（contract_holder_contact_method）';
comment on column public.anpi_user_contexts.notify_channels is '通知チャネル配列（tasful_chat / line / email）';
comment on column public.anpi_user_contexts.metadata is 'マスク電話・同意・続柄等の拡張フィールド';

create index if not exists anpi_user_contexts_user_id_idx
  on public.anpi_user_contexts (user_id);

create index if not exists anpi_user_contexts_contract_holder_id_idx
  on public.anpi_user_contexts (contract_holder_id);

create index if not exists anpi_user_contexts_line_user_id_idx
  on public.anpi_user_contexts (line_user_id)
  where line_user_id is not null and line_user_id <> '';

create index if not exists anpi_user_contexts_updated_at_desc_idx
  on public.anpi_user_contexts (updated_at desc);

-- RLS 有効化（本番ポリシーは別途。開発用は下記）
alter table public.anpi_user_contexts enable row level security;

drop policy if exists "anpi_user_contexts_select_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_insert_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_update_dev" on public.anpi_user_contexts;
drop policy if exists "anpi_user_contexts_delete_dev" on public.anpi_user_contexts;

create policy "anpi_user_contexts_select_dev"
  on public.anpi_user_contexts
  for select
  to anon, authenticated
  using (true);

create policy "anpi_user_contexts_insert_dev"
  on public.anpi_user_contexts
  for insert
  to anon, authenticated
  with check (true);

create policy "anpi_user_contexts_update_dev"
  on public.anpi_user_contexts
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "anpi_user_contexts_delete_dev"
  on public.anpi_user_contexts
  for delete
  to anon, authenticated
  using (true);
