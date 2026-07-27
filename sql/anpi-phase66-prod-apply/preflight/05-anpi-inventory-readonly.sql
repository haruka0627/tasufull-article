-- SELECT only · current public anpi% tables inventory
-- Before Phase 2 APPLY expect only legacy v1 four tables

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'anpi%'
order by 1;
