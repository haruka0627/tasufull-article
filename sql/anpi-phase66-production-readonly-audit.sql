-- =============================================================================
-- ANPI Phase 66-A — Production READ-ONLY inventory (HUMAN SQL Editor)
-- =============================================================================
-- TARGET PROJECT REF (ONLY): ddojquacsyqesrjhcvmn
-- FORBIDDEN: Staging ahlxuyvhzqdqaojiywmu · any DML/DDL · MCP apply
-- USAGE: Paste into Supabase Dashboard → SQL → Production project only.
--        Confirm Settings → General → Reference ID == ddojquacsyqesrjhcvmn FIRST.
-- PATH IN REPO: sql/anpi-phase66-production-readonly-audit.sql
-- BRANCH: anpi/phase66-production-canary (PR #24) — not yet on main
--
-- NOTE: Sections 3 and 9 use dynamic SQL (EXECUTE) + session GUC so missing
-- relations do NOT fail at parse/plan time (avoids ERROR 42P01).
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

-- 3) Gate state — dynamic SQL only (safe when relation missing)
do $$
declare
  payload jsonb;
begin
  if to_regclass('public.anpi_prod_claim_allowlist_gate') is null then
    payload := jsonb_build_object(
      'gate', 'anpi_prod_claim_allowlist_gate',
      'relation_exists', false,
      'enabled', null,
      'allowlist_count', null,
      'notes', null,
      'updated_at', null
    );
  else
    execute $q$
      select jsonb_build_object(
        'gate', 'anpi_prod_claim_allowlist_gate',
        'relation_exists', true,
        'enabled', g.enabled,
        'allowlist_count', cardinality(g.allowed_auth_sha8),
        'notes', g.notes,
        'updated_at', g.updated_at
      )
      from public.anpi_prod_claim_allowlist_gate g
      where g.id = 1
    $q$ into payload;

    if payload is null then
      payload := jsonb_build_object(
        'gate', 'anpi_prod_claim_allowlist_gate',
        'relation_exists', true,
        'enabled', null,
        'allowlist_count', null,
        'notes', 'row_id_1_missing',
        'updated_at', null
      );
    end if;
  end if;

  -- is_local=false: survive autocommit between DO and following SELECT
  perform set_config('anpi.p66_section3', payload::text, false);
end $$;

select
  x.gate,
  x.relation_exists,
  x.enabled,
  x.allowlist_count,
  x.notes,
  x.updated_at
from jsonb_to_record(current_setting('anpi.p66_section3', true)::jsonb) as x(
  gate text,
  relation_exists boolean,
  enabled boolean,
  allowlist_count integer,
  notes text,
  updated_at timestamptz
);

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

-- 9) In-flight / pending counts — dynamic SQL only (safe when relation missing)
do $$
declare
  payload jsonb;
begin
  if to_regclass('public.anpi_scheduler_jobs') is null then
    payload := jsonb_build_object(
      'relation_exists', false,
      'pending', null,
      'processing', null,
      'leased_active', null
    );
  else
    execute $q$
      select jsonb_build_object(
        'relation_exists', true,
        'pending', count(*) filter (where status = 'pending'),
        'processing', count(*) filter (where status = 'processing'),
        'leased_active', count(*) filter (
          where status = 'processing'
            and lease_expires_at is not null
            and lease_expires_at > now()
        )
      )
      from public.anpi_scheduler_jobs
    $q$ into payload;
  end if;

  perform set_config('anpi.p66_section9', payload::text, false);
end $$;

select
  x.relation_exists,
  x.pending,
  x.processing,
  x.leased_active
from jsonb_to_record(current_setting('anpi.p66_section9', true)::jsonb) as x(
  relation_exists boolean,
  pending bigint,
  processing bigint,
  leased_active bigint
);

-- END READ-ONLY — do not paste Phase 65 apply SQL in the same session without
-- explicit human approval after reviewing this audit output.
