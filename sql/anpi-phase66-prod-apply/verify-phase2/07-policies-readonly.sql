-- SELECT only · after Phase 2 APPLY · policy names + count

select
  schemaname,
  tablename,
  policyname,
  cmd as command,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'anpi_settings',
    'anpi_check_instances',
    'anpi_contacts',
    'anpi_contact_invitations',
    'anpi_notification_deliveries',
    'anpi_audit_logs'
  )
order by tablename, policyname;

-- Expected policy names (8):
-- anpi_settings_select_participant
-- anpi_settings_insert_self
-- anpi_settings_update_owner_self
-- anpi_check_instances_select_participant
-- anpi_contacts_select_participant
-- anpi_contacts_insert_self_pending
-- anpi_contact_invitations_insert_owner
-- anpi_notification_deliveries_select_recipient
-- (no authenticated policy on anpi_audit_logs)
