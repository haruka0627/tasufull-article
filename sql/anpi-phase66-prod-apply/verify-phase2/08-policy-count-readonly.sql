-- SELECT only · after Phase 2 APPLY · policy count summary (single row)

select
  count(*)::integer as policy_count,
  count(*) filter (where tablename = 'anpi_settings')::integer as settings_policies,
  count(*) filter (where tablename = 'anpi_audit_logs')::integer as audit_policies
from pg_policies
where schemaname = 'public'
  and tablename in (
    'anpi_settings',
    'anpi_check_instances',
    'anpi_contacts',
    'anpi_contact_invitations',
    'anpi_notification_deliveries',
    'anpi_audit_logs'
  );

-- Pass: policy_count = 8 · audit_policies = 0
