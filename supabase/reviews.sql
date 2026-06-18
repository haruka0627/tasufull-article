-- 取引完了後レビュー（reviews）と掲載者信頼スコア（review_scores）
-- transaction_chat.sql 適用後に SQL Editor で実行してください。

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.transaction_rooms(id) on delete cascade,
  reviewer_id text not null,
  reviewed_user_id text not null,
  rating int,
  comment text,
  is_skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_room_id_idx on public.reviews (room_id);
create index if not exists reviews_reviewed_user_id_idx on public.reviews (reviewed_user_id);
create index if not exists reviews_reviewer_id_idx on public.reviews (reviewer_id);

create unique index if not exists reviews_room_reviewer_unique_idx
  on public.reviews (room_id, reviewer_id);

create table if not exists public.review_scores (
  user_id text primary key,
  average_rating numeric not null default 0,
  total_reviews int not null default 0,
  skipped_reviews int not null default 0,
  updated_at timestamptz not null default now()
);

-- 開発用: RLS 無効化する場合
-- alter table public.reviews disable row level security;
-- alter table public.review_scores disable row level security;
