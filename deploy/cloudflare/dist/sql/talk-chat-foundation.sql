-- TASFUL TALK — 友達チャット / 仕事チャット 基盤（将来: 友達追加・グループ・プロフィール）
-- 実行前に既存 transaction_* スキーマと整合を確認してください。

-- 共通ユーザープロフィール（一覧・会話ヘッダ・プロフィールページで共有）
create table if not exists public.talk_user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile_image text,
  display_name text not null default '',
  status_message text not null default '',
  category text not null default '',
  location text not null default '',
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  online_status text not null default 'offline'
    check (online_status in ('online', 'away', 'offline')),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.talk_user_profiles is
  'TASFUL TALK 共通プロフィール（友達・仕事チャットで同一表示）';

-- 会話スレッド拡張（transaction_rooms に列追加する場合の例）
-- alter table public.transaction_rooms
--   add column if not exists chat_domain text not null default 'work'
--     check (chat_domain in ('friend', 'work')),
--   add column if not exists thread_kind text not null default 'listing_inquiry'
--     check (thread_kind in ('direct', 'group', 'listing_inquiry'));

-- 将来: 友達関係
-- create table if not exists public.talk_friend_requests (
--   id uuid primary key default gen_random_uuid(),
--   from_user_id uuid not null references auth.users (id),
--   to_user_id uuid not null references auth.users (id),
--   status text not null default 'pending'
--     check (status in ('pending', 'accepted', 'rejected', 'blocked')),
--   created_at timestamptz not null default now(),
--   unique (from_user_id, to_user_id)
-- );

-- 将来: グループ参加者
-- create table if not exists public.talk_group_members (
--   group_thread_id uuid not null,
--   user_id uuid not null references auth.users (id),
--   role text not null default 'member',
--   joined_at timestamptz not null default now(),
--   primary key (group_thread_id, user_id)
-- );
