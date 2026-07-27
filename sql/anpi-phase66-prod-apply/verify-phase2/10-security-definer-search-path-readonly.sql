-- SELECT only · after Phase 2 APPLY · SECURITY DEFINER + search_path on Phase 2 fns

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  coalesce(p.proconfig, array[]::text[]) as config_including_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like 'anpi_phase2_%'
    or p.proname in (
      'anpi_confirm_check',
      'anpi_create_daily_check',
      'anpi_respond_contact_invitation',
      'anpi_revoke_contact',
      'anpi_contact_check_summary',
      'anpi_contact_invitation_summaries'
    )
  )
order by security_definer desc, function_name, args;

-- Pass: business RPCs + write_safe_audit are security_definer=true
-- and config contains search_path=pg_catalog, public (or pg_catalog for pure helpers)
