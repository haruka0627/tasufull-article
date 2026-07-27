-- =============================================================================
-- ANPI Phase 65 — Production claim allowlist DRAFT (DO NOT APPLY YET)
-- =============================================================================
-- TARGET PROJECT REF (ONLY): ddojquacsyqesrjhcvmn  (Production)
-- FORBIDDEN: ahlxuyvhzqdqaojiywmu (Staging) · MCP apply · auto-chain without review
-- STATUS: DRAFT ONLY · human approval required before any Production apply
-- DESTRUCTIVE: NONE (additive objects · does not replace anpi_phase6_claim_jobs)
-- PREREQ: Phase 4–10 scheduler / delivery / talk objects must already exist on Prod
-- =============================================================================
-- Mis-apply guard (run FIRST on target DB; abort if wrong project):
--   select current_setting('request.jwt.claim.ref', true); -- if available
--   Or Dashboard: confirm project ref == ddojquacsyqesrjhcvmn before paste.
--   If you are on Staging, STOP.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Gate table (fail-closed · empty allowlist until human canary)
-- ---------------------------------------------------------------------------
create table if not exists public.anpi_prod_claim_allowlist_gate (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  allowed_auth_sha8 text[] not null default array[]::text[],
  notes text not null default 'Production claim allowlist · default OFF · empty until canary approved',
  updated_at timestamptz not null default now(),
  constraint anpi_prod_claim_allowlist_sha8_max check (
    cardinality(allowed_auth_sha8) <= 32
  )
);

create or replace function public.anpi_prod_validate_sha8_array(p text[])
returns boolean
language sql
immutable
as $$
  select p is not null
     and cardinality(p) <= 32
     and (
       cardinality(p) = 0
       or not exists (
         select 1 from unnest(p) s
         where s is null
            or s !~ '^[a-f0-9]{8}$'
       )
     );
$$;

create or replace function public.anpi_prod_claim_allowlist_gate_biu()
returns trigger
language plpgsql
as $$
begin
  if not public.anpi_prod_validate_sha8_array(new.allowed_auth_sha8) then
    raise exception using errcode = '22023', message = 'anpi_prod_invalid_sha8_allowlist';
  end if;
  -- Refuse known Staging test sha8 in Production allowlist
  if '0411f04d' = any (coalesce(new.allowed_auth_sha8, array[]::text[])) then
    raise exception using errcode = '22023', message = 'anpi_prod_refusing_staging_test_sha8';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_anpi_prod_claim_allowlist_gate_biu
  on public.anpi_prod_claim_allowlist_gate;
create trigger trg_anpi_prod_claim_allowlist_gate_biu
before insert or update on public.anpi_prod_claim_allowlist_gate
for each row execute function public.anpi_prod_claim_allowlist_gate_biu();

alter table public.anpi_prod_claim_allowlist_gate enable row level security;
revoke all on table public.anpi_prod_claim_allowlist_gate from public, anon, authenticated;
grant all on table public.anpi_prod_claim_allowlist_gate to service_role;

insert into public.anpi_prod_claim_allowlist_gate (id, enabled, allowed_auth_sha8)
values (1, false, array[]::text[])
on conflict (id) do nothing;

comment on table public.anpi_prod_claim_allowlist_gate is
  'PRODUCTION Phase65: claim allowlist gate. Default enabled=false · empty allowlist. service_role only. Never store staging test sha8.';

-- ---------------------------------------------------------------------------
-- 2. Enable / emergency disable
-- ---------------------------------------------------------------------------
create or replace function public.anpi_prod_claim_allowlist_enable()
returns table (enabled boolean, allowed_count integer, executed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.anpi_prod_claim_allowlist_gate
  set enabled = true, updated_at = clock_timestamp()
  where id = 1
    and cardinality(allowed_auth_sha8) >= 1;

  if not found then
    raise exception using errcode = '22000',
      message = 'anpi_prod_enable_requires_nonempty_allowlist';
  end if;

  return query
  select g.enabled, cardinality(g.allowed_auth_sha8), clock_timestamp()
  from public.anpi_prod_claim_allowlist_gate g where g.id = 1;
end;
$$;

create or replace function public.anpi_prod_claim_allowlist_emergency_disable()
returns table (enabled boolean, executed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.anpi_prod_claim_allowlist_gate
  set enabled = false, updated_at = clock_timestamp()
  where id = 1;
  return query
  select g.enabled, clock_timestamp()
  from public.anpi_prod_claim_allowlist_gate g where g.id = 1;
end;
$$;

revoke all on function public.anpi_prod_claim_allowlist_enable() from public, anon, authenticated;
revoke all on function public.anpi_prod_claim_allowlist_emergency_disable() from public, anon, authenticated;
grant execute on function public.anpi_prod_claim_allowlist_enable() to service_role;
grant execute on function public.anpi_prod_claim_allowlist_emergency_disable() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Stable key helper (anpi:prod:v1 · UTC date bucket)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_prod_stable_idempotency_key(
  p_kind text,
  p_check_id uuid,
  p_subject_user_id uuid,
  p_logical_due timestamptz
)
returns text
language sql
immutable
as $$
  select 'anpi:prod:v1:'
    || p_kind || ':'
    || p_check_id::text || ':'
    || left(encode(extensions.digest(p_subject_user_id::text, 'sha256'), 'hex'), 8) || ':'
    || to_char((p_logical_due at time zone 'UTC'), 'YYYY-MM-DD');
$$;

revoke all on function public.anpi_prod_stable_idempotency_key(text, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_prod_stable_idempotency_key(text, uuid, uuid, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. PARALLEL scoped claim (does NOT alter anpi_phase6_claim_jobs)
-- ---------------------------------------------------------------------------
create or replace function public.anpi_prod_claim_jobs_allowlisted(
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
  from public.anpi_prod_claim_allowlist_gate g
  where g.id = 1
  for update;

  if not found or coalesce(v_enabled, false) is not true then
    return;
  end if;

  if cardinality(coalesce(v_allow, array[]::text[])) < 1 then
    return;
  end if;

  if not public.anpi_prod_validate_sha8_array(v_allow) then
    raise exception using errcode = '22023', message = 'anpi_prod_invalid_sha8_allowlist';
  end if;

  if '0411f04d' = any (v_allow) then
    raise exception using errcode = '22023', message = 'anpi_prod_refusing_staging_test_sha8';
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

comment on function public.anpi_prod_claim_jobs_allowlisted(text, integer, timestamptz, interval) is
  'PRODUCTION Phase65: parallel allowlisted claim. Does not replace anpi_phase6_claim_jobs. service_role only.';

revoke all on function public.anpi_prod_claim_jobs_allowlisted(text, integer, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_prod_claim_jobs_allowlisted(text, integer, timestamptz, interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Sanity (safe)
-- ---------------------------------------------------------------------------
select
  (select enabled from public.anpi_prod_claim_allowlist_gate where id = 1) as gate_enabled,
  (select cardinality(allowed_auth_sha8) from public.anpi_prod_claim_allowlist_gate where id = 1) as allowlist_count,
  to_regprocedure('public.anpi_prod_claim_jobs_allowlisted(text,integer,timestamptz,interval)') is not null as prod_scoped_claim_exists,
  to_regprocedure('public.anpi_phase6_claim_jobs(text,integer,timestamptz,interval)') is not null as legacy_claim_untouched;
