-- TasuFull チャット AI審査ログ（通報確認・BAN判断・危険ユーザー分析用）
-- transaction_chat.sql 適用後に SQL Editor で実行してください。

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  room_id text,
  user_id text,
  message_text text,
  image_urls jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  level text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists moderation_logs_created_at_idx
  on public.moderation_logs (created_at desc);

create index if not exists moderation_logs_user_id_created_at_idx
  on public.moderation_logs (user_id, created_at desc);

create index if not exists moderation_logs_room_id_created_at_idx
  on public.moderation_logs (room_id, created_at desc);

-- RLS
alter table public.moderation_logs enable row level security;

-- 開発用: クライアントから insert 可能（anon / authenticated）
create policy "moderation_logs_insert_dev"
  on public.moderation_logs
  for insert
  to anon, authenticated
  with check (true);

-- 管理者用 SELECT（本番では service_role または管理者ロールに限定すること）
-- create policy "moderation_logs_select_admin"
--   on public.moderation_logs
--   for select
--   to authenticated
--   using (auth.jwt() ->> 'role' = 'admin');

-- Realtime は不要（分析・管理画面向け）
-- alter publication supabase_realtime add table public.moderation_logs;
