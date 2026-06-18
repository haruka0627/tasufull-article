-- STEP 8 RLS policy inventory (read-only)

select tablename, policyname, roles::text as roles, cmd,
       left(coalesce(qual, ''), 120) as using_expr,
       left(coalesce(with_check, ''), 120) as with_check_expr
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select 'counts' as kind,
  (select count(*) from pg_policies where schemaname='public') as total_policies,
  (select count(*) from pg_policies where schemaname='public' and policyname like '%_dev') as dev_policies,
  (select count(*) from pg_tables t join pg_class c on c.relname=t.tablename
   where t.schemaname='public' and c.relrowsecurity = false) as rls_disabled_tables;

select tablename, policyname, roles::text, cmd, qual
from pg_policies
where schemaname = 'public'
  and (
    qual = 'true' or with_check = 'true'
    or policyname ilike '%allow all%'
    or policyname ilike '%_dev%'
  )
order by tablename, policyname;
