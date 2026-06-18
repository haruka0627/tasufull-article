-- 出品者プロフィール（users / profiles / members）
-- listings.user_id と紐づけ。listings.sql 適用後に SQL Editor で実行してください。
-- 既に同名テーブルがある場合は衝突する列のみ手動で合わせてください。

create table if not exists public.users (
  id text primary key,
  handle text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id text primary key references public.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz,
  availability_status text default 'offline',
  work_hours text,
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id text primary key references public.users (id) on delete cascade,
  rank text,
  badge_image_url text,
  is_premium boolean not null default false,
  identity_verified boolean not null default false,
  deals_count int not null default 0,
  followers_count int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- 開発用サンプル（詳細ページのフォールバックと一致）
insert into public.users (id, handle)
values
  ('u_sachi', 'watch_store'),
  ('u_hiro', 'hiro_creator'),
  ('u_store', 'premium_home'),
  ('u_me', 'tasu_rank_test')
on conflict (id) do update set handle = excluded.handle;

insert into public.profiles (user_id, display_name, avatar_url, last_seen_at, availability_status, work_hours)
values
  ('u_sachi', 'はるかまん', 'https://placehold.co/160x160/f3ead4/967622?text=S', now() - interval '3 minutes', 'online', '平日10〜20時'),
  ('u_hiro', 'ひろ', 'https://placehold.co/160x160/fff6df/7a5710?text=H', now() - interval '2 hours', 'away', '週末中心'),
  ('u_store', 'premium_home', 'https://placehold.co/160x160/f3ead4/967622?text=PH', now() - interval '1 day', 'offline', '要相談'),
  ('u_me', 'ランク確認用出品者', 'https://placehold.co/160x160/f5f5f4/a3a3a3?text=T', now() - interval '2 minutes', 'online', '随時（テスト用）')
on conflict (user_id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  last_seen_at = excluded.last_seen_at,
  availability_status = excluded.availability_status,
  work_hours = excluded.work_hours,
  updated_at = now();

insert into public.members (user_id, rank, badge_image_url, is_premium, identity_verified, deals_count, followers_count)
values
  (
    'u_sachi',
    'platinum',
    'https://i.postimg.cc/c4PCckc2/purachinabajji-puratto-yong.png',
    true,
    true,
    160,
    153
  ),
  ('u_hiro', 'gold', null, false, true, 42, 28),
  ('u_store', 'new', null, true, false, 88, 201)
on conflict (user_id) do update set
  rank = excluded.rank,
  badge_image_url = excluded.badge_image_url,
  is_premium = excluded.is_premium,
  identity_verified = excluded.identity_verified,
  deals_count = excluded.deals_count,
  followers_count = excluded.followers_count,
  updated_at = now();

insert into public.members
  (user_id, rank, badge_image_url, is_premium, identity_verified, deals_count, followers_count)
values
  ('u_me', 'legend', null, true, true, 128, 256)
on conflict (user_id) do update set
  rank = excluded.rank,
  is_premium = excluded.is_premium,
  identity_verified = excluded.identity_verified,
  deals_count = excluded.deals_count,
  followers_count = excluded.followers_count,
  updated_at = now();

-- 旧ラベル形式（GOLD MEMBER 等）を内部 rank 値へ統一
update public.members
set
  rank = case
    when rank is null or btrim(rank) = '' then 'new'
    when lower(rank) like '%legend%' then 'legend'
    when lower(rank) like '%platinum%' or lower(rank) like '%plat%' then 'platinum'
    when lower(rank) like '%gold%' then 'gold'
    when lower(rank) like '%silver%' then 'silver'
    when lower(rank) like '%bronze%' then 'bronze'
    when lower(rank) in ('new', 'bronze', 'silver', 'gold', 'platinum', 'legend') then lower(rank)
    else 'new'
  end,
  updated_at = now()
where rank is null
   or btrim(rank) = ''
   or lower(rank) not in ('new', 'bronze', 'silver', 'gold', 'platinum', 'legend');

-- 開発用: RLS 無効化する場合
-- alter table public.users disable row level security;
-- alter table public.profiles disable row level security;
-- alter table public.members disable row level security;
