-- READ-ONLY verify after Phase 5 apply
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'anpi_contacts'
    and column_name in ('verification_status','consent_status','paused_at','channel')
) as contacts_phase5_columns_present;

select to_regprocedure('public.anpi_phase4_enqueue_contact_candidates(timestamptz)') is not null
  as has_enqueue_contact_candidates;
select to_regprocedure('public.anpi_phase4_scheduler_tick(timestamptz)') is not null
  or to_regprocedure('public.anpi_phase4_scheduler_tick()') is not null as has_tick_after_rewrite;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'anpi_%contact%' or p.proname like 'anpi_phase5%')
order by 1,2
limit 50;

select to_regclass('public.anpi_notification_logs') is not null as legacy_ok;
