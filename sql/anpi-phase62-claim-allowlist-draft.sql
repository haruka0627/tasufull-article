-- =============================================================================
-- ANPI Phase 62 — Claim allowlist + stable key (COMPLETE DRAFT FOR REVIEW)
-- STATUS: NOT APPLIED · awaiting human approval for staging only
-- TARGET: staging ahlxuyvhzqdqaojiywmu
-- FORBIDDEN: Production ddojquacsyqesrjhcvmn · supabase/migrations auto-chain
-- =============================================================================
-- Design choices (review-locked):
--   A) Do NOT replace public.anpi_phase6_claim_jobs behavior for stub Cron.
--      Add PARALLEL claim RPC used only by scoped writer path.
--   B) Gate default OFF — claim allowlist inactive until explicitly enabled.
--   C) Allowlist stores auth_user_id sha8 only (no raw UUID in defaults beyond
--      the known Phase 15/17 test bind sha8=0411f04d).
--   D) Stable idempotency helper for scoped path; Phase 6/8 attempt keys unchanged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Gate table (fail-closed)
-- ---------------------------------------------------------------------------
create table if not exists public.anpi_phase62_claim_allowlist_gate (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  allowed_auth_sha8 text[] not null default array['0411f04d']::text[],
  notes text not null default 'Phase62 staging claim allowlist · default OFF',
  updated_at timestamptz not null default now(),
  constraint anpi_phase62_claim_allowlist_sha8_nonempty check (
    cardinality(allowed_auth_sha8) >= 1
  )
);

-- Format validation via trigger (sha8 regex · max 32) — see below.

create or replace function public.anpi_phase62_validate_sha8_array(p text[])
returns boolean
language sql
immutable
as $$
  select p is not null
     and cardinality(p) >= 1
     and cardinality(p) <= 32
     and not exists (
       select 1 from unnest(p) s
       where s is null
          or s !~ '^[a-f0-9]{8}$'
     );
$$;

create or replace function public.anpi_phase62_claim_allowlist_gate_biu()
returns trigger
language plpgsql
as $$
begin
  if not public.anpi_phase62_validate_sha8_array(new.allowed_auth_sha8) then
    raise exception using errcode = '22023', message = 'anpi_phase62_invalid_sha8_allowlist';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_anpi_phase62_claim_allowlist_gate_biu
  on public.anpi_phase62_claim_allowlist_gate;
create trigger trg_anpi_phase62_claim_allowlist_gate_biu
before insert or update on public.anpi_phase62_claim_allowlist_gate
for each row execute function public.anpi_phase62_claim_allowlist_gate_biu();

alter table public.anpi_phase62_claim_allowlist_gate enable row level security;
-- no policies for anon/authenticated → deny; service_role bypasses
revoke all on table public.anpi_phase62_claim_allowlist_gate from public, anon, authenticated;
grant all on table public.anpi_phase62_claim_allowlist_gate to service_role;

insert into public.anpi_phase62_claim_allowlist_gate (id, enabled, allowed_auth_sha8)
values (1, false, array['0411f04d']::text[])
on conflict (id) do nothing;

comment on table public.anpi_phase62_claim_allowlist_gate is
  'STAGING Phase62: claim allowlist gate. Default enabled=false. service_role only.';

-- ---------------------------------------------------------------------------
-- 2. Enable / emergency disable (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase62_claim_allowlist_enable()
returns table (enabled boolean, allowed_count integer, executed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.anpi_phase62_claim_allowlist_gate
  set enabled = true, updated_at = clock_timestamp()
  where id = 1
    and public.anpi_phase62_validate_sha8_array(allowed_auth_sha8);

  if not found then
    raise exception using errcode = '22023', message = 'anpi_phase62_gate_missing_or_invalid';
  end if;

  return query
  select g.enabled, cardinality(g.allowed_auth_sha8), clock_timestamp()
  from public.anpi_phase62_claim_allowlist_gate g where g.id = 1;
end;
$$;

create or replace function public.anpi_phase62_claim_allowlist_emergency_disable()
returns table (enabled boolean, executed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.anpi_phase62_claim_allowlist_gate
  set enabled = false, updated_at = clock_timestamp()
  where id = 1;

  return query select false::boolean, clock_timestamp();
end;
$$;

revoke all on function public.anpi_phase62_claim_allowlist_enable() from public, anon, authenticated;
revoke all on function public.anpi_phase62_claim_allowlist_emergency_disable() from public, anon, authenticated;
grant execute on function public.anpi_phase62_claim_allowlist_enable() to service_role;
grant execute on function public.anpi_phase62_claim_allowlist_emergency_disable() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Stable idempotency key (scoped path only · no attempt)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase62_stable_idempotency_key(
  p_kind text,
  p_check_id uuid,
  p_subject_user_id uuid,
  p_logical_due timestamptz
)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog, public, extensions
as $$
declare
  v_sha8 text;
  v_due_date text;
  v_key text;
begin
  if p_kind is null or char_length(trim(p_kind)) < 1 then
    raise exception using errcode = '22023', message = 'anpi_phase62_stable_key_bad_kind';
  end if;
  v_sha8 := left(encode(extensions.digest(p_subject_user_id::text, 'sha256'), 'hex'), 8);
  v_due_date := to_char((p_logical_due at time zone 'utc'), 'YYYY-MM-DD');
  v_key := 'anpi:p61:v1:' || trim(p_kind) || ':' || p_check_id::text || ':' || v_sha8 || ':' || v_due_date;
  if char_length(v_key) < 8 or char_length(v_key) > 200 then
    raise exception using errcode = '22023', message = 'anpi_phase62_stable_key_length';
  end if;
  if v_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'anpi_phase62_stable_key_charset';
  end if;
  return v_key;
end;
$$;

revoke all on function public.anpi_phase62_stable_idempotency_key(text, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase62_stable_idempotency_key(text, uuid, uuid, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. PARALLEL scoped claim (does not alter anpi_phase6_claim_jobs)
--    When gate.enabled=false → returns zero rows (fail-closed for scoped path).
--    When enabled → only subject_user_id whose auth sha8 is allowlisted.
-- ---------------------------------------------------------------------------
create or replace function public.anpi_phase62_claim_jobs_allowlisted(
  p_worker_id text,
  p_limit integer default 5,
  p_now timestamptz default clock_timestamp(),
  p_lease interval default interval '2 minutes'
)
returns setof public.anpi_scheduler_jobs
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_lease interval := coalesce(p_lease, interval '2 minutes');
  v_enabled boolean;
  v_allow text[];
begin
  if p_worker_id is null or char_length(p_worker_id) < 1 or char_length(p_worker_id) > 64 then
    raise exception using errcode = '22023', message = 'anpi_invalid_worker_id';
  end if;

  select g.enabled, g.allowed_auth_sha8
    into v_enabled, v_allow
  from public.anpi_phase62_claim_allowlist_gate g
  where g.id = 1
  for update;

  if not found or coalesce(v_enabled, false) is not true then
    -- Fail-closed: scoped claim yields nothing unless explicitly enabled.
    return;
  end if;

  if not public.anpi_phase62_validate_sha8_array(v_allow) then
    raise exception using errcode = '22023', message = 'anpi_phase62_invalid_sha8_allowlist';
  end if;

  return query
  with picked as (
    select j.id
    from public.anpi_scheduler_jobs j
    where j.status = 'pending'
      and j.available_at <= p_now
      and j.channel = 'talk'
      and left(encode(extensions.digest(j.subject_user_id::text, 'sha256'), 'hex'), 8)
          = any (v_allow)
    order by j.available_at, j.created_at
    for update skip locked
    limit v_limit
  )
  update public.anpi_scheduler_jobs j
  set status = 'processing',
      claimed_at = p_now,
      claimed_by = p_worker_id,
      lease_expires_at = p_now + v_lease,
      attempt_count = j.attempt_count + 1
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

comment on function public.anpi_phase62_claim_jobs_allowlisted(text, integer, timestamptz, interval) is
  'STAGING Phase62: claim pending talk jobs only for allowlisted subject sha8 when gate enabled. Parallel to anpi_phase6_claim_jobs. service_role only.';

revoke all on function public.anpi_phase62_claim_jobs_allowlisted(text, integer, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase62_claim_jobs_allowlisted(text, integer, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Sanity select (safe)
-- ---------------------------------------------------------------------------
select
  (select enabled from public.anpi_phase62_claim_allowlist_gate where id = 1) as gate_enabled,
  (select allowed_auth_sha8 from public.anpi_phase62_claim_allowlist_gate where id = 1) as allowlist,
  to_regprocedure('public.anpi_phase62_claim_jobs_allowlisted(text,integer,timestamptz,interval)') is not null as scoped_claim_exists,
  to_regprocedure('public.anpi_phase6_claim_jobs(text,integer,timestamptz,interval)') is not null as legacy_claim_untouched;
