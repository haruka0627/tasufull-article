-- INDEX ONLY · do not run as a multi-result batch for Editor review
-- Split SELECT files live under preflight/
--
-- Run order (each file alone):
--   1) preflight/01-ref-confirm-readonly.sql
--   2) preflight/02-phase2-collision-readonly.sql
--   3) preflight/03-gen-random-uuid-readonly.sql
--   4) preflight/04-extensions-readonly.sql
--   5) preflight/05-anpi-inventory-readonly.sql
--   6) 00-legacy-guard-readonly.sql
--
-- SELECT only · no APPLY

select
  'use_split_files_under_preflight/'::text as instruction,
  '01-ref-confirm-readonly.sql'::text as step_1,
  '02-phase2-collision-readonly.sql'::text as step_2,
  '03-gen-random-uuid-readonly.sql'::text as step_3,
  '04-extensions-readonly.sql'::text as step_4,
  '05-anpi-inventory-readonly.sql'::text as step_5,
  'then run ../00-legacy-guard-readonly.sql'::text as step_6;
