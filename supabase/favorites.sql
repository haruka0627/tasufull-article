-- お気に入り（スキル / 商品 / 求人 / ワーカー）
-- SQL Editor で実行してください。

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  constraint favorites_target_type_check check (
    target_type in ('skill', 'product', 'job', 'worker')
  ),
  constraint favorites_user_target_unique unique (user_id, target_type, target_id)
);

-- 既存DBに誤った unique がある場合は favorites_fix_unique.sql を実行してください。

create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists favorites_target_type_idx on public.favorites (target_type);
create index if not exists favorites_target_id_idx on public.favorites (target_id);
create index if not exists favorites_created_at_desc_idx on public.favorites (created_at desc);

alter table public.favorites enable row level security;

-- 開発用 RLS（SELECT / INSERT / UPDATE / DELETE すべて許可）
drop policy if exists "favorites_all_dev" on public.favorites;
drop policy if exists "favorites_select_dev" on public.favorites;
drop policy if exists "favorites_insert_dev" on public.favorites;
drop policy if exists "favorites_update_dev" on public.favorites;
drop policy if exists "favorites_delete_dev" on public.favorites;

create policy "favorites_select_dev"
  on public.favorites
  for select
  to anon, authenticated
  using (true);

create policy "favorites_insert_dev"
  on public.favorites
  for insert
  to anon, authenticated
  with check (true);

create policy "favorites_update_dev"
  on public.favorites
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "favorites_delete_dev"
  on public.favorites
  for delete
  to anon, authenticated
  using (true);

-- Realtime（別タブからの追加/解除を一覧へ反映）
-- alter publication supabase_realtime add table public.favorites;
