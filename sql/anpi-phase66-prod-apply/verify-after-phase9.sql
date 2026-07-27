-- READ-ONLY verify after Phase 9 apply
select to_regclass('public.anpi_talk_adapter_config') is not null as has_adapter_config;
select to_regclass('public.anpi_talk_shadow_notifications') is not null as has_shadow;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'anpi_talk%' or p.proname like 'anpi_phase9%')
order by 1,2
limit 80;

select to_regclass('public.anpi_no_response_audit_log') is not null as legacy_ok;
