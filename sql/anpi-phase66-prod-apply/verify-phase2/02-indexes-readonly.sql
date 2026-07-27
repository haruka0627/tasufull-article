-- SELECT only · after Phase 2 APPLY · expected indexes (shows missing as present=false)

select
  x.indexname,
  x.tablename as expected_table,
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.indexname = x.indexname
  ) as present
from (
  values
    ('anpi_audit_logs_subject_created_idx', 'anpi_audit_logs'),
    ('anpi_audit_logs_entity_idx', 'anpi_audit_logs'),
    ('anpi_settings_one_current_per_subject_idx', 'anpi_settings'),
    ('anpi_settings_owner_idx', 'anpi_settings'),
    ('anpi_settings_due_idx', 'anpi_settings'),
    ('anpi_check_instances_setting_date_idx', 'anpi_check_instances'),
    ('anpi_check_instances_subject_date_idx', 'anpi_check_instances'),
    ('anpi_check_instances_pending_idx', 'anpi_check_instances'),
    ('anpi_contacts_unique_current_relation_idx', 'anpi_contacts'),
    ('anpi_contacts_owner_idx', 'anpi_contacts'),
    ('anpi_contacts_contact_user_idx', 'anpi_contacts'),
    ('anpi_contact_invitations_one_open_per_contact_idx', 'anpi_contact_invitations'),
    ('anpi_contact_invitations_invitee_idx', 'anpi_contact_invitations'),
    ('anpi_notification_deliveries_retry_idx', 'anpi_notification_deliveries'),
    ('anpi_notification_deliveries_recipient_idx', 'anpi_notification_deliveries')
) as x(indexname, tablename)
order by 1;

-- Pass: 15 rows · present=true for all
