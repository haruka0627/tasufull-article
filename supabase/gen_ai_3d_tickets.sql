-- 生成AI 3D 生成チケット（単発購入）— 冪等
create table if not exists public.gen_ai_3d_tickets (
  user_id text primary key,
  tickets_remaining integer not null default 0 check (tickets_remaining >= 0),
  total_purchased integer not null default 0 check (total_purchased >= 0),
  total_used integer not null default 0 check (total_used >= 0),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gen_ai_3d_tickets add column if not exists tickets_remaining integer not null default 0;
alter table public.gen_ai_3d_tickets add column if not exists total_purchased integer not null default 0;
alter table public.gen_ai_3d_tickets add column if not exists total_used integer not null default 0;
alter table public.gen_ai_3d_tickets add column if not exists stripe_customer_id text;
alter table public.gen_ai_3d_tickets add column if not exists created_at timestamptz not null default now();
alter table public.gen_ai_3d_tickets add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gen_ai_3d_tickets_tickets_remaining_check'
  ) then
    alter table public.gen_ai_3d_tickets
      add constraint gen_ai_3d_tickets_tickets_remaining_check check (tickets_remaining >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'gen_ai_3d_tickets_total_purchased_check'
  ) then
    alter table public.gen_ai_3d_tickets
      add constraint gen_ai_3d_tickets_total_purchased_check check (total_purchased >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'gen_ai_3d_tickets_total_used_check'
  ) then
    alter table public.gen_ai_3d_tickets
      add constraint gen_ai_3d_tickets_total_used_check check (total_used >= 0);
  end if;
end $$;

comment on table public.gen_ai_3d_tickets is 'TASFUL 生成AI 3D生成チケット残数';

alter table public.gen_ai_3d_tickets enable row level security;

drop policy if exists "gen_ai_3d_tickets_deny_anon" on public.gen_ai_3d_tickets;
create policy "gen_ai_3d_tickets_deny_anon"
  on public.gen_ai_3d_tickets
  for all
  to anon, authenticated
  using (false)
  with check (false);
