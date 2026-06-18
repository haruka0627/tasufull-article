select count(*)::int as total_policies from pg_policies where schemaname='public';

select tablename, count(*)::int as policy_count
from pg_policies where schemaname='public'
group by tablename
order by tablename;

select tablename, policyname, roles::text as roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'talk_notifications','talk_call_sessions','anpi_user_contexts','anpi_check_sessions',
    'listings','business_listings','support_tickets','connect_issues',
    'builder_projects','shop_orders'
  )
order by tablename, policyname;
