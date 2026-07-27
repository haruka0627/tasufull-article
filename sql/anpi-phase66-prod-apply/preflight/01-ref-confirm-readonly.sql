-- SELECT only · Production read-only OK · NO APPLY
-- Manual + soft check: confirm Dashboard Reference ID == ddojquacsyqesrjhcvmn
-- STOP if Staging ahlxuyvhzqdqaojiywmu

select
  'ddojquacsyqesrjhcvmn'::text as expected_production_ref,
  'ahlxuyvhzqdqaojiywmu'::text as forbidden_staging_ref,
  current_database() as database_name,
  current_user as session_user_name,
  'Open Dashboard → Project Settings → General → Reference ID must equal expected_production_ref'::text as human_action;
