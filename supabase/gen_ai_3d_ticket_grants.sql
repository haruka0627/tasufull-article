-- 3D生成チケット Stripe Checkout 付与履歴（session 単位で冪等）
create table if not exists public.gen_ai_3d_ticket_grants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  stripe_session_id text not null,
  plan_id text not null,
  tickets_added integer not null default 1 check (tickets_added > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists gen_ai_3d_ticket_grants_stripe_session_id_key
  on public.gen_ai_3d_ticket_grants (stripe_session_id);

create index if not exists gen_ai_3d_ticket_grants_user_id_idx
  on public.gen_ai_3d_ticket_grants (user_id);

comment on table public.gen_ai_3d_ticket_grants is 'TASFUL 生成AI 3D生成チケット Stripe Checkout 付与履歴';

alter table public.gen_ai_3d_ticket_grants enable row level security;

drop policy if exists "gen_ai_3d_ticket_grants_deny_anon" on public.gen_ai_3d_ticket_grants;
create policy "gen_ai_3d_ticket_grants_deny_anon"
  on public.gen_ai_3d_ticket_grants
  for all
  to anon, authenticated
  using (false)
  with check (false);
