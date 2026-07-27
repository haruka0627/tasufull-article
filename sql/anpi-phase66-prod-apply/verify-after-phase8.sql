-- READ-ONLY verify after Phase 8 apply
select to_regclass('public.anpi_talk_templates') is not null as has_templates;
select to_regclass('public.anpi_talk_actions') is not null as has_actions;
select to_regclass('public.anpi_talk_adapter_receipts') is not null as has_receipts;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'anpi_talk%'
order by 1,2
limit 80;

select to_regprocedure('public.anpi_phase6_claim_jobs(text,integer,timestamptz,interval)') is not null
  as legacy_claim_still_present;
select to_regclass('public.anpi_check_sessions') is not null as legacy_ok;
