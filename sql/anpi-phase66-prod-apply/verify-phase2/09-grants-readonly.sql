-- SELECT only · after Phase 2 APPLY · table grants

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'anpi_settings',
    'anpi_check_instances',
    'anpi_contacts',
    'anpi_contact_invitations',
    'anpi_notification_deliveries',
    'anpi_audit_logs'
  )
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
order by table_name, grantee, privilege_type;
