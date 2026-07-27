-- SELECT only · legacy v1 four tables (single result)
-- Record column_count baseline before any APPLY

select
  t.table_name,
  to_regclass('public.' || t.table_name) is not null as exists,
  (
    select count(*)::integer
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = t.table_name
  ) as column_count
from (
  values
    ('anpi_check_sessions'),
    ('anpi_user_contexts'),
    ('anpi_notification_logs'),
    ('anpi_no_response_audit_log')
) as t(table_name)
order by 1;

-- Pass: 4 rows · exists=true for all · column_count stable vs prior capture
