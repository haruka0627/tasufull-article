-- SELECT only · after Phase 2 APPLY · RLS enabled flags

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'anpi_settings',
    'anpi_check_instances',
    'anpi_contacts',
    'anpi_contact_invitations',
    'anpi_notification_deliveries',
    'anpi_audit_logs'
  )
order by 1;

-- Pass: rls_enabled=true for all 6 · force_rls typically false (by design)
