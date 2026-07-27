-- TALK 基盤: transaction_rooms / transaction_messages / transaction_reads
-- 正本: supabase/transaction_chat.sql
-- 前提: なし（新規テーブル）
-- 位置: 20260621180000（Remote 最終適用済）の直後
--       20260622120000_talk_room_contact_bridge.sql の前提
--       20260623100000_match_talk_room_bridge.sql の前提
-- 冪等: create table if not exists / create index if not exists
-- RLS は別 migration（talk-rls-production.sql 等）で管理。

-- ---------------------------------------------------------------------------
-- transaction_rooms — 取引・マッチ・相談 DM の共通ルーム基盤
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- transaction_messages — ルーム内メッセージ
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- transaction_reads — 既読管理
-- ---------------------------------------------------------------------------
create table if not exists public.transaction_reads (
  room_id uuid not null references public.transaction_rooms(id) on delete cascade,
  user_id text not null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Realtime publication は Supabase SQL Editor または別 migration で管理
-- alter publication supabase_realtime add table public.transaction_messages;
-- alter publication supabase_realtime add table public.transaction_reads;