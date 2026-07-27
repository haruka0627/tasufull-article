-- SELECT only · after Phase 2 APPLY · helper / trigger functions

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as config_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'anpi_phase2_set_updated_at',
    'anpi_phase2_valid_weekdays',
    'anpi_phase2_transition_allowed',
    'anpi_phase2_guard_check_transition',
    'anpi_phase2_guard_contact_delivery',
    'anpi_phase2_guard_immutable_identity',
    'anpi_phase2_write_safe_audit'
  )
order by 1, 2;
