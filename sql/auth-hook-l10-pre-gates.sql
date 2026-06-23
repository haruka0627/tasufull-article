-- TASFUL Auth Hook L10 pre-apply gate (match_* must be 0)
select count(*)::int as match_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';
