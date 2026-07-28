-- Diff & Approve — re-runnable verification (read-only probes)
-- Safe to re-run after migration apply. Does not mutate data.

select
  to_regclass('public.ai_diff_approve_proposals') is not null as has_proposals,
  to_regclass('public.ai_diff_approve_records') is not null as has_records,
  to_regclass('public.ai_diff_approve_events') is not null as has_events,
  to_regclass('public.ai_diff_approve_idempotency') is not null as has_idempotency;

select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'ai_diff_approve_%'
order by c.relname;

select pol.polname, c.relname
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'ai_diff_approve_%'
order by c.relname, pol.polname;

select
  has_table_privilege('anon', 'public.ai_diff_approve_proposals', 'select') as anon_prop_select,
  has_table_privilege('anon', 'public.ai_diff_approve_events', 'insert') as anon_evt_insert,
  has_table_privilege('authenticated', 'public.ai_diff_approve_records', 'update') as auth_rec_update,
  has_table_privilege('authenticated', 'public.ai_diff_approve_events', 'delete') as auth_evt_delete,
  has_table_privilege('service_role', 'public.ai_diff_approve_events', 'select') as srv_evt_select,
  has_table_privilege('service_role', 'public.ai_diff_approve_events', 'insert') as srv_evt_insert,
  has_table_privilege('service_role', 'public.ai_diff_approve_events', 'delete') as srv_evt_delete,
  has_table_privilege('service_role', 'public.ai_diff_approve_idempotency', 'update') as srv_idem_update;

select
  p.proname,
  has_function_privilege('anon', p.oid, 'execute') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
  has_function_privilege('service_role', p.oid, 'execute') as srv_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ai_diff_approve_write_step';
