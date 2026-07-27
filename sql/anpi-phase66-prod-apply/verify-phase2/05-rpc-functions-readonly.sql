-- SELECT only · after Phase 2 APPLY · business RPCs

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as config_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'anpi_confirm_check',
    'anpi_create_daily_check',
    'anpi_respond_contact_invitation',
    'anpi_revoke_contact',
    'anpi_contact_check_summary',
    'anpi_contact_invitation_summaries'
  )
order by 1, 2;

-- Pass: 6 functions · security_definer=true · config includes search_path
