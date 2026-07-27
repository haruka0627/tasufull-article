-- SELECT only · after Phase 2 APPLY · legacy v1 four tables still present

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

-- Pass: exists=true for all 4 · column_count unchanged vs pre-APPLY baseline
