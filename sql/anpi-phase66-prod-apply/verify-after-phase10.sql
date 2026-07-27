-- READ-ONLY verify after Phase 10 apply
select to_regclass('public.anpi_talk_notification_links') is not null as has_notification_links;
select to_regprocedure('public.anpi_resolve_talk_user_id(uuid)') is not null as has_talk_resolve;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'anpi_resolve_talk_user_id',
    'anpi_talk_notification_create_internal'
  )
order by 1,2;

-- Full matrix expected after Phase 10 (prod/p62 still false)
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

select to_regclass('public.anpi_user_contexts') is not null as legacy_ok;
