-- MATCH closed beta: allowlist + match_is_beta_allowed() RPC

create table if not exists public.match_beta_allowlist (
  id uuid primary key default gen_random_uuid(),
  talk_user_id text not null,
  email text,
  status text not null default 'invited',
  invited_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint match_beta_allowlist_talk_user_id_uidx unique (talk_user_id),
  constraint match_beta_allowlist_status_check check (
    status in ('invited', 'active', 'revoked')
  )
);

comment on table public.match_beta_allowlist is
  'Closed beta participants for TASFUL MATCH. Edge gate uses match_is_beta_allowed().';

create index if not exists match_beta_allowlist_status_idx
  on public.match_beta_allowlist (status);

alter table public.match_beta_allowlist enable row level security;

-- No direct authenticated access; ops via service_role / SQL
drop policy if exists match_beta_allowlist_deny_all on public.match_beta_allowlist;
create policy match_beta_allowlist_deny_all
  on public.match_beta_allowlist
  for all
  to authenticated
  using (false)
  with check (false);

create or replace function public.match_is_beta_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_beta_allowlist b
    where b.talk_user_id = public.match_current_user_id()
      and b.status in ('invited', 'active')
  );
$$;

comment on function public.match_is_beta_allowed() is
  'True when JWT talk_user_id is on MATCH beta allowlist (invited or active).';

revoke all on function public.match_is_beta_allowed() from public;
grant execute on function public.match_is_beta_allowed() to authenticated;
grant execute on function public.match_is_beta_allowed() to service_role;

-- Linked-ref E2E slots (t1–t2, t4–t5 active). t3 intentionally omitted for gate tests.
insert into public.match_beta_allowlist (talk_user_id, email, status, accepted_at)
values
  ('t1', 't1@tasful.invalid', 'active', timezone('utc', now())),
  ('t2', 't2@tasful.invalid', 'active', timezone('utc', now())),
  ('t4', 't4@tasful.invalid', 'active', timezone('utc', now())),
  ('t5', 't5@tasful.invalid', 'active', timezone('utc', now()))
on conflict (talk_user_id) do update
set
  email = excluded.email,
  status = excluded.status,
  accepted_at = coalesce(public.match_beta_allowlist.accepted_at, excluded.accepted_at),
  updated_at = timezone('utc', now());
