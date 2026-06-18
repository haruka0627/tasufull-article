-- TasuFull チャット ユーザーブロック
-- reports / moderation_logs と連携して BAN・危険ユーザー分析に利用

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id text not null,
  blocked_id text not null,
  room_id uuid,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_id_idx
  on public.blocked_users (blocker_id);

create index if not exists blocked_users_blocked_id_idx
  on public.blocked_users (blocked_id);

create index if not exists blocked_users_room_id_idx
  on public.blocked_users (room_id);

create index if not exists blocked_users_created_at_desc_idx
  on public.blocked_users (created_at desc);

-- 将来: chat-list.js で blocker_id の room を一覧から除外
-- 将来: reports.reported_user_id + blocked_users → 自動BAN

alter table public.blocked_users enable row level security;

-- 開発用（全操作）
create policy "blocked_users_dev_all"
  on public.blocked_users
  for all
  to anon, authenticated
  using (true)
  with check (true);
