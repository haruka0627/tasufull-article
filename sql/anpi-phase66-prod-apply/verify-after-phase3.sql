-- READ-ONLY verify after Phase 3 apply
select to_regprocedure('public.anpi_get_my_settings()') is not null as has_get_my_settings;
select to_regprocedure('public.anpi_upsert_my_settings(boolean,text,smallint[],time,smallint,jsonb,interval)') is not null
  as has_upsert_my_settings;
select to_regprocedure('public.anpi_ensure_my_today_check()') is not null as has_ensure_today;
select to_regprocedure('public.anpi_get_my_today_check()') is not null as has_get_today;
select to_regprocedure('public.anpi_list_my_check_history()') is not null
  or to_regprocedure('public.anpi_list_my_check_history(integer)') is not null as has_history;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like 'anpi_phase3%'
    or p.proname in (
      'anpi_get_my_settings','anpi_upsert_my_settings','anpi_pause_my_settings',
      'anpi_resume_my_settings','anpi_get_my_today_check','anpi_ensure_my_today_check',
      'anpi_list_my_check_history'
    )
  )
order by 1,2;

select to_regclass('public.anpi_user_contexts') is not null as legacy_ok;
