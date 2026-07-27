-- INDEX ONLY · split verify files under verify-phase2/
-- Run each file alone in Supabase SQL Editor (one Result each).
-- SELECT only · after Phase 2 APPLY · do not run APPLY here

select
  'use_split_files_under_verify-phase2/'::text as instruction,
  '01-tables-readonly.sql'::text as s01,
  '02-indexes-readonly.sql'::text as s02,
  '03-triggers-readonly.sql'::text as s03,
  '04-helper-functions-readonly.sql'::text as s04,
  '05-rpc-functions-readonly.sql'::text as s05,
  '06-rls-enabled-readonly.sql'::text as s06,
  '07-policies-readonly.sql'::text as s07,
  '08-policy-count-readonly.sql'::text as s08,
  '09-grants-readonly.sql'::text as s09,
  '10-security-definer-search-path-readonly.sql'::text as s10,
  '11-legacy-mapping-view-readonly.sql'::text as s11,
  '12-legacy-guard-readonly.sql'::text as s12;
