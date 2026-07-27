-- SELECT only · extension inventory relevant to ANPI

select
  e.extname,
  e.extversion,
  n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('pgcrypto', 'uuid-ossp')
order by 1;

-- Note: 0 rows is acceptable for Phase 2 if gen_random_uuid() works (PG13+ core).
-- Phase 6 later may create pgcrypto in schema extensions.
