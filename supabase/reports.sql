-- TasuFull チャット通報（reports）
-- moderation_logs / 将来の BAN・review_scores と連携予定
-- transaction_chat.sql 適用後に SQL Editor で実行してください。

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  reporter_id text not null,
  reported_user_id text,
  target_message_id uuid not null,
  reason text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists reports_room_id_idx
  on public.reports (room_id);

create index if not exists reports_reporter_id_idx
  on public.reports (reporter_id);

create index if not exists idx_reports_reported_user_id
  on public.reports (reported_user_id);

create index if not exists reports_target_message_id_idx
  on public.reports (target_message_id);

create index if not exists reports_created_at_desc_idx
  on public.reports (created_at desc);

-- 将来: moderation_logs.target_message_id / user_id と JOIN して危険率算出
-- 将来: reports 集計 → review_scores / 自動BAN 判定

alter table public.reports enable row level security;

-- 開発用 INSERT（anon / authenticated）
create policy "reports_insert_dev"
  on public.reports
  for insert
  to anon, authenticated
  with check (true);

-- 管理者用 SELECT（本番では service_role または管理者ロールに限定）
-- create policy "reports_select_admin"
--   on public.reports
--   for select
--   to authenticated
--   using (auth.jwt() ->> 'role' = 'admin');
