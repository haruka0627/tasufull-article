-- favorites RLS を SELECT / INSERT / UPDATE / DELETE 別ポリシーに修正
-- upsert 後の .select() が空になる場合はこの SQL を実行してください。

alter table public.favorites enable row level security;

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
