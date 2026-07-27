-- =============================================================================
-- ANPI Phase 66 — legacy v1 integrity check (READ-ONLY)
-- =============================================================================
-- Run before EVERY apply step and after EVERY apply step.
-- Expect: all 4 rows present. Column counts must not drop unexpectedly.
-- =============================================================================

select
  t.table_name,
  (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t.table_name) as column_count,
  to_regclass('public.' || t.table_name) is not null as exists
from (
  values
    ('anpi_check_sessions'),
    ('anpi_no_response_audit_log'),
    ('anpi_notification_logs'),
    ('anpi_user_contexts')
) as t(table_name)
order by 1;

-- Fail criteria for humans: any exists=false OR unexpected column_count regression
-- vs preflight baseline captured in the runbook log.
