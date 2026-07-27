-- READ-ONLY verify after Phase 4 apply
select to_regclass('public.anpi_scheduler_jobs') is not null as has_scheduler_jobs;
select to_regclass('public.anpi_scheduler_runs') is not null as has_scheduler_runs;
select to_regprocedure('public.anpi_phase4_scheduler_tick(timestamptz)') is not null
  or to_regprocedure('public.anpi_phase4_scheduler_tick()') is not null as has_scheduler_tick;

select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('anpi_scheduler_jobs','anpi_scheduler_runs')
order by 1;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('anpi_scheduler_jobs','anpi_scheduler_runs')
  and grantee in ('anon','authenticated','service_role')
order by 1,2,3;

-- expect anon typically has no grants on scheduler tables
select to_regclass('public.anpi_check_sessions') is not null as legacy_ok;
