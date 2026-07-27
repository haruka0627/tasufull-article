-- READ-ONLY verify after Phase 6 apply
select exists (
  select 1 from pg_extension where extname = 'pgcrypto'
) as has_pgcrypto;

select e.extname, n.nspname as ext_schema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'pgcrypto';

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'anpi_scheduler_jobs'
    and column_name = 'lease_expires_at'
) as has_lease_expires_at;

select to_regclass('public.anpi_delivery_stub_receipts') is not null as has_stub_receipts;
select to_regprocedure('public.anpi_phase6_claim_jobs(text,integer,timestamptz,interval)') is not null
  as has_legacy_claim;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'anpi_phase6%'
order by 1,2;

select to_regclass('public.anpi_user_contexts') is not null as legacy_ok;
