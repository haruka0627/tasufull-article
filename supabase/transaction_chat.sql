-- TasuFull 取引用チャット（Supabase）
-- SQL Editor で実行してください。

create table if not exists public.transaction_rooms (
  id uuid primary key default gen_random_uuid(),
  listing_id text,
  listing_type text,
  title text not null,
  partner_id text,
  partner_display_name text,
  partner_avatar_url text,
  buyer_id text,
  seller_id text,
  expires_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transaction_rooms_status_idx
  on public.transaction_rooms (status);

create table if not exists public.transaction_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.transaction_rooms(id) on delete cascade,
  sender_id text not null,
  message text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists transaction_messages_room_id_created_at_idx
  on public.transaction_messages (room_id, created_at);

create table if not exists public.transaction_reads (
  room_id uuid not null references public.transaction_rooms(id) on delete cascade,
  user_id text not null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Realtime（チャット詳細: メッセージ INSERT / 既読 UPDATE）
-- alter publication supabase_realtime add table public.transaction_messages;
-- alter publication supabase_realtime add table public.transaction_reads;

-- 開発用: RLS を無効化する場合（本番ではポリシーを設定してください）
-- alter table public.transaction_rooms disable row level security;
-- alter table public.transaction_messages disable row level security;
-- alter table public.transaction_reads disable row level security;
