-- Staging probe (read-only)
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'listings'
order by 1;
