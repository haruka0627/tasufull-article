-- SELECT only · after Phase 2 APPLY · triggers on Phase 2 tables

select
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'anpi_settings',
    'anpi_check_instances',
    'anpi_contacts',
    'anpi_contact_invitations',
    'anpi_notification_deliveries',
    'anpi_audit_logs'
  )
order by 2, 1, 4;

-- Expect updated_at + guard + audit triggers on designed tables (audit_logs has none).
