-- フロント（anon）から members / profiles を SELECT できるようにする（開発用）
-- member が null / rank が NEW のままのときは SQL Editor で実行してください。

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
