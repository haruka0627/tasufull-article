-- ランクデザイン確認用: u_me（users / profiles / members）
-- Supabase Dashboard → SQL Editor でこのファイルを実行してください。

-- anon から members / profiles を読めるようにする（開発用）
alter table public.members enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "members_select_dev" on public.members;
create policy "members_select_dev"
  on public.members
  for select
  using (true);

drop policy if exists "profiles_select_dev" on public.profiles;
create policy "profiles_select_dev"
  on public.profiles
  for select
  using (true);
-- 実行後: detail-skill.html?userId=u_me&id=skill_test_001
-- ランク切替: members.rank を変更（例: legend / GOLD MEMBER / PLATINUM MEMBER / NEW）
-- rank 列（text）の値からデザインを自動正規化（GOLD MEMBER → gold 等）
-- URLプレビュー: 同URLに &rank=bronze 等（DBの rank は上書きしない）

insert into public.users (id, handle)
values ('u_me', 'tasu_rank_test')
on conflict (id) do update set handle = excluded.handle;

insert into public.profiles (
  user_id,
  display_name,
  avatar_url,
  last_seen_at,
  availability_status,
  work_hours
)
values (
  'u_me',
  'ランク確認用出品者',
  'https://placehold.co/160x160/f5f5f4/a3a3a3?text=T',
  now() - interval '2 minutes',
  'online',
  '随時（テスト用）'
)
on conflict (user_id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  last_seen_at = excluded.last_seen_at,
  availability_status = excluded.availability_status,
  work_hours = excluded.work_hours,
  updated_at = now();

insert into public.members (
  user_id,
  rank,
  badge_image_url,
  is_premium,
  identity_verified,
  deals_count,
  followers_count
)
values (
  'u_me',
  'legend',
  null,
  true,
  true,
  128,
  256
)
on conflict (user_id) do update set
  rank = excluded.rank,
  is_premium = excluded.is_premium,
  identity_verified = excluded.identity_verified,
  deals_count = excluded.deals_count,
  followers_count = excluded.followers_count,
  updated_at = now();

-- デザイン確認（枠・名前・チップ文言・色）:
-- update public.members set rank = 'GOLD MEMBER', updated_at = now() where user_id = 'u_me';
