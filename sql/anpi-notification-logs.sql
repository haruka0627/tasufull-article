-- 安否通知ログ（P9-2）
-- SQL Editor で実行してください。

create table if not exists public.anpi_notification_logs (
  id uuid primary key default gen_random_uuid(),
  log_id text not null,
  user_id text,
  contract_holder_id text not null default '',
  event_type text not null,
  title text not null default '',
  message text not null default '',
  severity text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  source text not null default 'tasful',
  metadata jsonb not null default '{}'::jsonb,
  line_notification_enabled boolean not null default false,
  line_user_id text,
  line_status text not null default 'pending',
  line_sent_at timestamptz,
  line_preview_sent_at timestamptz,
  line_error_message text,
  line_error_code text,
  line_send_in_progress boolean not null default false,
  notification_type text,
  notify_channels jsonb not null default '[]'::jsonb,
  constraint anpi_notification_logs_log_id_unique unique (log_id)
);

comment on table public.anpi_notification_logs is '安否（Anpi）通知ログ — TASFUL内通知・LINE送信状態';
comment on column public.anpi_notification_logs.log_id is 'アプリ側ログ ID（localStorage の id と一致）';
comment on column public.anpi_notification_logs.metadata is 'user_name / intent / phone_masked / status 等の拡張';
comment on column public.anpi_notification_logs.notification_type is '送信種別（多くは event_type と同値）';
comment on column public.anpi_notification_logs.notify_channels is '通知チャネル配列';

create unique index if not exists anpi_notification_logs_log_id_idx
  on public.anpi_notification_logs (log_id);

create index if not exists anpi_notification_logs_user_id_idx
  on public.anpi_notification_logs (user_id);

create index if not exists anpi_notification_logs_contract_holder_id_idx
  on public.anpi_notification_logs (contract_holder_id);

create index if not exists anpi_notification_logs_event_type_idx
  on public.anpi_notification_logs (event_type);

create index if not exists anpi_notification_logs_is_read_idx
  on public.anpi_notification_logs (is_read);

create index if not exists anpi_notification_logs_created_at_desc_idx
  on public.anpi_notification_logs (created_at desc);

create index if not exists anpi_notification_logs_line_status_idx
  on public.anpi_notification_logs (line_status);

create index if not exists anpi_notification_logs_line_user_id_idx
  on public.anpi_notification_logs (line_user_id)
  where line_user_id is not null and line_user_id <> '';

-- RLS 有効化
-- TODO(本番): contract_holder_id / user_id に基づく厳密ポリシーへ差し替え
alter table public.anpi_notification_logs enable row level security;

drop policy if exists "anpi_notification_logs_select_dev" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_insert_dev" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_update_dev" on public.anpi_notification_logs;
drop policy if exists "anpi_notification_logs_delete_dev" on public.anpi_notification_logs;

create policy "anpi_notification_logs_select_dev"
  on public.anpi_notification_logs
  for select
  to anon, authenticated
  using (true);

create policy "anpi_notification_logs_insert_dev"
  on public.anpi_notification_logs
  for insert
  to anon, authenticated
  with check (true);

create policy "anpi_notification_logs_update_dev"
  on public.anpi_notification_logs
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "anpi_notification_logs_delete_dev"
  on public.anpi_notification_logs
  for delete
  to anon, authenticated
  using (true);
