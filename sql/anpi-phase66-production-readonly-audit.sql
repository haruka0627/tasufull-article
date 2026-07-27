-- =============================================================================
-- ANPI Phase 66-A — Production READ-ONLY inventory (HUMAN SQL Editor)
-- =============================================================================
-- TARGET PROJECT REF (ONLY): ddojquacsyqesrjhcvmn
-- FORBIDDEN: Staging ahlxuyvhzqdqaojiywmu · any DML/DDL · MCP apply
-- USAGE: Paste into Supabase Dashboard → SQL → Production project only.
--        Confirm Settings → General → Reference ID == ddojquacsyqesrjhcvmn FIRST.
-- PATH IN REPO: sql/anpi-phase66-production-readonly-audit.sql
-- BRANCH: anpi/phase66-production-canary (PR #24) — not yet on main
-- =============================================================================

-- Guard: abort if somehow connected to wrong DB name pattern (best-effort)
do $$
begin
  -- Manual confirm: Dashboard project ref must be ddojquacsyqesrjhcvmn
  raise notice 'ANPI_P66_AUDIT: confirm Dashboard ref = ddojquacsyqesrjhcvmn before trusting results';
end $$;

-- 1) Tables (presence)
select
  c.relname as table_name,
  n.nspname as schema_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'anpi%'
order by 1;

-- 2) Expected Phase 4–10 / 62 / 65 objects (boolean matrix)
select
  to_regclass('public.anpi_scheduler_jobs') is not null as has_scheduler_jobs,
  to_regclass('public.anpi_scheduler_runs') is not null as has_scheduler_runs,
  to_regclass('public.anpi_phase62_claim_allowlist_gate') is not null as has_p62_gate,
  to_regclass('public.anpi_prod_claim_allowlist_gate') is not null as has_prod_gate,
  to_regprocedure('public.anpi_phase6_claim_jobs(text,integer,timestamptz,interval)') is not null as has_legacy_claim,
  to_regprocedure('public.anpi_phase62_claim_jobs_allowlisted(text,integer,timestamptz,interval)') is not null as has_p62_claim,
  to_regprocedure('public.anpi_prod_claim_jobs_allowlisted(text,integer,timestamptz,interval)') is not null as has_prod_claim,
  to_regprocedure('public.anpi_prod_claim_allowlist_emergency_disable()') is not null as has_prod_emergency,
  to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null
    or to_regprocedure('public.anpi_resolve_talk_user_id(text)') is not null as has_talk_resolve;

-- 3) Gate state (null-safe when table missing)
select
  'anpi_prod_claim_allowlist_gate' as gate,
  case
    when to_regclass('public.anpi_prod_claim_allowlist_gate') is null then null
    else (select g.enabled from public.anpi_prod_claim_allowlist_gate g where g.id = 1)
  end as enabled,
  case
    when to_regclass('public.anpi_prod_claim_allowlist_gate') is null then null
    else (
      select cardinality(g.allowed_auth_sha8)
      from public.anpi_prod_claim_allowlist_gate g
      where g.id = 1
    )
  end as allowlist_count,
  case
    when to_regclass('public.anpi_prod_claim_allowlist_gate') is null then null
    else (select g.notes from public.anpi_prod_claim_allowlist_gate g where g.id = 1)
  end as notes,
  case
    when to_regclass('public.anpi_prod_claim_allowlist_gate') is null then null
    else (select g.updated_at from public.anpi_prod_claim_allowlist_gate g where g.id = 1)
  end as updated_at;

-- 4) RPCs / functions matching anpi
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'anpi%'
order by 1, 2;

-- 5) Grants on critical relations (service_role / anon / authenticated)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'anpi%'
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
order by table_name, grantee, privilege_type;

-- 6) Triggers on anpi tables
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table like 'anpi%'
order by 1, 2;

-- 7) Indexes
select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename like 'anpi%'
order by 1, 2;

-- 8) Extensions (digest dependency for sha8)
select extname, extversion
from pg_extension
where extname in ('pgcrypto', 'uuid-ossp')
order by 1;

-- 9) In-flight / pending counts (read-only · no PII · null-safe)
select
  case
    when to_regclass('public.anpi_scheduler_jobs') is null then null
    else (
      select count(*) filter (where status = 'pending')
      from public.anpi_scheduler_jobs
    )
  end as pending,
  case
    when to_regclass('public.anpi_scheduler_jobs') is null then null
    else (
      select count(*) filter (where status = 'processing')
      from public.anpi_scheduler_jobs
    )
  end as processing,
  case
    when to_regclass('public.anpi_scheduler_jobs') is null then null
    else (
      select count(*) filter (
        where status = 'processing'
          and lease_expires_at is not null
          and lease_expires_at > now()
      )
      from public.anpi_scheduler_jobs
    )
  end as leased_active;

-- END READ-ONLY — do not paste Phase 65 apply SQL in the same session without
-- explicit human approval after reviewing this audit output.
