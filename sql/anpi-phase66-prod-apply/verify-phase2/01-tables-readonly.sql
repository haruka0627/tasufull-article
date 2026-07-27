-- SELECT only · after Phase 2 APPLY · 6 foundation tables

select
  x.table_name,
  to_regclass('public.' || x.table_name) is not null as exists
from (
  values
    ('anpi_settings'),
    ('anpi_check_instances'),
    ('anpi_contacts'),
    ('anpi_contact_invitations'),
    ('anpi_notification_deliveries'),
    ('anpi_audit_logs')
) as x(table_name)
order by 1;
