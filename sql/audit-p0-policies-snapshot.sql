select tablename, policyname, cmd, roles::text as roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'talk_notifications',
    'talk_ai_drafts',
    'talk_broadcast_drafts',
    'talk_follow_subscriptions',
    'anpi_check_sessions',
    'anpi_no_response_audit_log',
    'anpi_user_contexts',
    'anpi_notification_logs'
  )
order by tablename, policyname;
