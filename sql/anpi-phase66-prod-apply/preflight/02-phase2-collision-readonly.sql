-- SELECT only · Phase 2 object name collision check (before Step 1 APPLY)
-- Expect: already_exists = false for all rows

select
  x.object_name,
  to_regclass('public.' || x.object_name) is not null as already_exists
from (
  values
    ('anpi_settings'),
    ('anpi_check_instances'),
    ('anpi_contacts'),
    ('anpi_contact_invitations'),
    ('anpi_notification_deliveries'),
    ('anpi_audit_logs'),
    ('anpi_legacy_check_status_mapping')
) as x(object_name)
order by 1;
